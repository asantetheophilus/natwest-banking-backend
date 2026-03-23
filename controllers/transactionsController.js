// ─── Transactions Controller ─────────────────────
// FIX 2: getPendingApprovals now filters WHERE status = 'pending'
// FIX 3: No "Payment Received" notification for pending transfers;
//        notification is sent only when admin approves the transfer.
// FIX 4: Approval record now stores credit_transaction_id for reliable
//        lookup during approve/reject (no fragile matching queries).
const pool = require('../config/db');
const { generateId, toCamelCase } = require('../utils/helpers');

// Read threshold from env, fallback to 5000
const APPROVAL_THRESHOLD = parseFloat(process.env.APPROVAL_THRESHOLD || '5000');

/**
 * GET /api/transactions
 * User: their own transactions, with optional filters.
 * Query params: ?search=&type=all|debit|credit&days=30
 */
const getMyTransactions = async (req, res, next) => {
  try {
    const { search, type, days } = req.query;
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [req.user.id];

    if (search) {
      sql += ' AND (merchant LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (days) {
      sql += ' AND date >= DATE_SUB(NOW(), INTERVAL ? DAY)';
      params.push(parseInt(days, 10));
    }

    sql += ' ORDER BY date DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ transactions: rows.map(toCamelCase) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions/all
 * Admin: all transactions system-wide with optional search.
 */
const getAllTransactions = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let sql = 'SELECT * FROM transactions';
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push('(merchant LIKE ? OR user_id LIKE ? OR id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY date DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ transactions: rows.map(toCamelCase) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/transactions/transfer
 * User: send money to another user.
 * Body: { payeeId, amount, reference? }
 *
 * If amount >= APPROVAL_THRESHOLD → status = 'pending', create transfer_approval.
 * Otherwise → immediate completion with notification.
 *
 * FIX 3: Notification is only sent for completed (instant) transfers.
 *        Pending transfers notify the payee only after admin approval.
 */
const createTransfer = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { payeeId, amount, reference } = req.body;
    const transferAmount = parseFloat(amount);

    // Validation is handled by middleware/validate.js, but double-check
    if (!payeeId || !transferAmount || transferAmount <= 0) {
      conn.release();
      return res.status(400).json({ message: 'Payee and a valid positive amount are required.' });
    }

    // Prevent self-transfer
    if (payeeId === req.user.id) {
      conn.release();
      return res.status(400).json({ message: 'Cannot transfer to yourself.' });
    }

    // Get sender's main (first active) account
    const [senderAccounts] = await conn.query(
      `SELECT * FROM accounts WHERE user_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
      [req.user.id]
    );
    if (senderAccounts.length === 0) {
      conn.release();
      return res.status(400).json({ message: 'No active account found.' });
    }
    const senderAcc = senderAccounts[0];

    if (parseFloat(senderAcc.balance) < transferAmount) {
      conn.release();
      return res.status(400).json({ message: 'Insufficient funds in your account.' });
    }

    // Verify payee exists and is an active user
    const [payeeRows] = await conn.query(
      `SELECT id, name FROM users WHERE id = ? AND role = 'user' AND status = 'active'`,
      [payeeId]
    );
    if (payeeRows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Payee not found or inactive.' });
    }
    const payee = payeeRows[0];

    // Get payee's main active account
    const [payeeAccounts] = await conn.query(
      `SELECT * FROM accounts WHERE user_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
      [payeeId]
    );
    if (payeeAccounts.length === 0) {
      conn.release();
      return res.status(400).json({ message: 'Payee has no active account.' });
    }
    const payeeAcc = payeeAccounts[0];

    // Determine if admin approval is needed
    const needsApproval = transferAmount >= APPROVAL_THRESHOLD;
    const txStatus = needsApproval ? 'pending' : 'completed';

    // Create debit transaction (sender)
    const debitId = generateId();
    await conn.query(
      `INSERT INTO transactions (id, user_id, account_id, type, category, merchant, amount, reference, status)
       VALUES (?, ?, ?, 'debit', 'Transfer', ?, ?, ?, ?)`,
      [debitId, req.user.id, senderAcc.id, payee.name, transferAmount, reference || null, txStatus]
    );

    // Create credit transaction (payee)
    const creditId = generateId();
    await conn.query(
      `INSERT INTO transactions (id, user_id, account_id, type, category, merchant, amount, reference, status)
       VALUES (?, ?, ?, 'credit', 'Transfer', ?, ?, ?, ?)`,
      [creditId, payeeId, payeeAcc.id, req.user.name, transferAmount, reference || null, txStatus]
    );

    if (needsApproval) {
      // Create approval record — stores BOTH transaction IDs for reliable lookup
      const approvalId = generateId();
      await conn.query(
        `INSERT INTO transfer_approvals (id, transaction_id, credit_transaction_id, user_id, payee_id, amount, payee_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [approvalId, debitId, creditId, req.user.id, payeeId, transferAmount, payee.name]
      );

      // Hold the funds (deduct from sender, don't credit payee yet)
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [transferAmount, senderAcc.id]
      );

      // FIX 3: Notify sender that transfer is pending, but do NOT notify payee yet
      const senderNotifId = generateId();
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, message)
         VALUES (?, ?, 'Transfer Pending', ?)`,
        [senderNotifId, req.user.id, `Your transfer of £${transferAmount.toFixed(2)} to ${payee.name} is awaiting admin approval.`]
      );
    } else {
      // Immediately update both balances
      await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [transferAmount, senderAcc.id]
      );
      await conn.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [transferAmount, payeeAcc.id]
      );

      // FIX 3: Only notify payee when transfer is actually completed
      const notifId = generateId();
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, message)
         VALUES (?, ?, 'Payment Received', ?)`,
        [notifId, payeeId, `You received £${transferAmount.toFixed(2)} from ${req.user.name}.`]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: needsApproval
        ? 'Transfer submitted for admin approval.'
        : 'Transfer completed successfully.',
      transaction: toCamelCase({
        id: debitId,
        user_id: req.user.id,
        account_id: senderAcc.id,
        type: 'debit',
        category: 'Transfer',
        merchant: payee.name,
        amount: transferAmount,
        date: new Date().toISOString(),
        status: txStatus,
      }),
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
};

/**
 * GET /api/transactions/approvals
 * Admin: list transfer approvals.
 * FIX 2: Now correctly filters by status = 'pending' by default.
 * Supports ?status=all to see all approvals.
 */
const getPendingApprovals = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || 'pending';

    let sql = `SELECT ta.*, u.name AS user_name, u.email AS user_email
               FROM transfer_approvals ta
               JOIN users u ON u.id = ta.user_id`;

    const params = [];

    // FIX 2: Default to pending-only; allow ?status=all to see everything
    if (statusFilter !== 'all') {
      sql += ' WHERE ta.status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY ta.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ approvals: rows.map(toCamelCase) });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/transactions/approvals/:id
 * Admin: approve or reject a pending transfer.
 * Body: { action: 'approved' | 'rejected' }
 *
 * FIX 3: On approval, send "Payment Received" notification to payee.
 * FIX 4: Uses stored credit_transaction_id instead of fragile matching queries.
 */
const reviewApproval = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { action } = req.body;
    // Validation handled by middleware, but sanity check
    if (!['approved', 'rejected'].includes(action)) {
      conn.release();
      return res.status(400).json({ message: 'Action must be "approved" or "rejected".' });
    }

    // Get the approval record — must be pending
    const [approvalRows] = await conn.query(
      'SELECT * FROM transfer_approvals WHERE id = ? AND status = ?',
      [req.params.id, 'pending']
    );
    if (approvalRows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Pending approval not found.' });
    }
    const approval = approvalRows[0];

    // Update approval status
    await conn.query(
      'UPDATE transfer_approvals SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [action, req.user.id, req.params.id]
    );

    if (action === 'approved') {
      // Mark both transactions as completed
      await conn.query(
        'UPDATE transactions SET status = ? WHERE id = ?',
        ['completed', approval.transaction_id]
      );
      await conn.query(
        'UPDATE transactions SET status = ? WHERE id = ?',
        ['completed', approval.credit_transaction_id]
      );

      // Credit the payee's account
      const [creditTx] = await conn.query(
        'SELECT account_id FROM transactions WHERE id = ?',
        [approval.credit_transaction_id]
      );
      if (creditTx.length > 0) {
        await conn.query(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [parseFloat(approval.amount), creditTx[0].account_id]
        );
      }

      // FIX 3: NOW notify the payee that payment arrived
      const payeeNotifId = generateId();
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, message)
         VALUES (?, ?, 'Payment Received', ?)`,
        [payeeNotifId, approval.payee_id, `You received £${parseFloat(approval.amount).toFixed(2)} (transfer approved by admin).`]
      );

      // Also notify the sender that their transfer was approved
      const senderNotifId = generateId();
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, message)
         VALUES (?, ?, 'Transfer Approved', ?)`,
        [senderNotifId, approval.user_id, `Your transfer of £${parseFloat(approval.amount).toFixed(2)} to ${approval.payee_name} has been approved.`]
      );

    } else {
      // Rejected — mark transactions failed, refund sender
      await conn.query(
        'UPDATE transactions SET status = ? WHERE id = ?',
        ['failed', approval.transaction_id]
      );
      await conn.query(
        'UPDATE transactions SET status = ? WHERE id = ?',
        ['failed', approval.credit_transaction_id]
      );

      // Refund sender's held amount
      const [debitTx] = await conn.query(
        'SELECT account_id FROM transactions WHERE id = ?',
        [approval.transaction_id]
      );
      if (debitTx.length > 0) {
        await conn.query(
          'UPDATE accounts SET balance = balance + ? WHERE id = ?',
          [parseFloat(approval.amount), debitTx[0].account_id]
        );
      }

      // Notify sender that transfer was rejected
      const senderNotifId = generateId();
      await conn.query(
        `INSERT INTO notifications (id, user_id, title, message)
         VALUES (?, ?, 'Transfer Rejected', ?)`,
        [senderNotifId, approval.user_id, `Your transfer of £${parseFloat(approval.amount).toFixed(2)} to ${approval.payee_name} has been rejected. Funds returned.`]
      );
    }

    // Log admin action
    const logId = generateId();
    await conn.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color)
       VALUES (?, ?, 'Admin', ?, 'CheckCircle2', ?)`,
      [
        logId,
        req.user.id,
        `${action === 'approved' ? 'Approved' : 'Rejected'} transfer #${approval.transaction_id.slice(-6)}`,
        action === 'approved' ? 'text-emerald-400' : 'text-red-400',
      ]
    );

    await conn.commit();
    conn.release();

    res.json({ message: `Transfer ${action} successfully.` });
  } catch (err) {
    await conn.rollback();
    conn.release();
    next(err);
  }
};

module.exports = {
  getMyTransactions,
  getAllTransactions,
  createTransfer,
  getPendingApprovals,
  reviewApproval,
};
