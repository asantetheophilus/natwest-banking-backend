// ─── Accounts Controller ─────────────────────────
const pool = require('../config/db');
const { generateId, generateAccountNumber, generateSortCode, toCamelCase } = require('../utils/helpers');

/**
 * GET /api/accounts
 * User: returns their own accounts.
 */
const getMyAccounts = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, account_number, sort_code, type, balance, currency, status FROM accounts WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ accounts: rows.map(toCamelCase) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/accounts
 * User: create a new account (Savings, etc.).
 * Body: { type } — defaults to 'Savings Account'
 */
const createAccount = async (req, res, next) => {
  try {
    const type = req.body.type || 'Savings Account';
    const id = generateId();
    const accountNumber = generateAccountNumber();
    const sortCode = generateSortCode();

    await pool.query(
      `INSERT INTO accounts (id, user_id, account_number, sort_code, type, balance, currency)
       VALUES (?, ?, ?, ?, ?, 0.00, 'GBP')`,
      [id, req.user.id, accountNumber, sortCode, type]
    );

    res.status(201).json({
      account: toCamelCase({
        id, account_number: accountNumber, sort_code: sortCode,
        type, balance: 0.00, currency: 'GBP', status: 'active',
      }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/accounts/:id/status  (Admin)
 * Body: { status: 'active' | 'frozen' }
 */
const updateAccountStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'frozen'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "active" or "frozen".' });
    }

    const [result] = await pool.query(
      'UPDATE accounts SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    // Log
    const logId = generateId();
    const action = status === 'frozen'
      ? `Froze account ${req.params.id}`
      : `Unfroze account ${req.params.id}`;
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', ?, 'CreditCard', ?)`,
      [logId, req.user.id, action, status === 'frozen' ? 'text-blue-400' : 'text-emerald-400']
    );

    res.json({ message: `Account ${status} successfully.` });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/accounts/:id/balance  (Admin)
 * Body: { balance: number }
 */
const updateAccountBalance = async (req, res, next) => {
  try {
    const { balance } = req.body;
    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({ message: 'Balance must be a positive number.' });
    }

    const [result] = await pool.query(
      'UPDATE accounts SET balance = ? WHERE id = ?',
      [balance, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    // Log
    const logId = generateId();
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', ?, 'Activity', 'text-nw-pink')`,
      [logId, req.user.id, `Edited balance for account ${req.params.id} → £${balance.toFixed(2)}`]
    );

    res.json({ message: 'Balance updated successfully.', balance });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyAccounts, createAccount, updateAccountStatus, updateAccountBalance };
