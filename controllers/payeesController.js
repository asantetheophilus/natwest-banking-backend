// ─── Payees Controller ───────────────────────────
const pool = require('../config/db');
const { generateId, toCamelCase } = require('../utils/helpers');

/**
 * GET /api/payees
 * Returns the user's saved payees AND other users (as potential payees).
 * The frontend's transfers page lists other users as payees.
 */
const getPayees = async (req, res, next) => {
  try {
    // Get other active users as potential payees (matches frontend logic)
    const [users] = await pool.query(
      `SELECT id, name, email FROM users WHERE id != ? AND role = 'user' AND status = 'active'`,
      [req.user.id]
    );

    // Also get saved payees
    const [saved] = await pool.query(
      'SELECT * FROM payees WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      payees: users.map(toCamelCase),       // other users as payees (matches frontend)
      savedPayees: saved.map(toCamelCase),   // custom saved payees
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payees
 * Body: { name, accountNumber, sortCode }
 */
const addPayee = async (req, res, next) => {
  try {
    const { name, accountNumber, sortCode } = req.body;
    if (!name || !accountNumber || !sortCode) {
      return res.status(400).json({ message: 'Name, account number, and sort code are required.' });
    }

    const id = generateId();
    await pool.query(
      'INSERT INTO payees (id, user_id, name, account_number, sort_code) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, name, accountNumber, sortCode]
    );

    res.status(201).json({
      payee: toCamelCase({ id, name, account_number: accountNumber, sort_code: sortCode }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/payees/:id
 */
const deletePayee = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM payees WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Payee not found.' });
    }
    res.json({ message: 'Payee removed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayees, addPayee, deletePayee };
