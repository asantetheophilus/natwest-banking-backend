// ─── Users Controller (Admin) ────────────────────
const pool = require('../config/db');
const { generateId, toCamelCase } = require('../utils/helpers');

/**
 * GET /api/users
 * Admin: returns all users with their accounts.
 * Matches frontend shape: { id, name, email, role, status, joinedAt, accounts[] }
 */
const getAllUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT id, name, email, role, status, joined_at FROM users WHERE role = 'user' ORDER BY joined_at DESC`
    );

    // Attach accounts to each user
    const result = [];
    for (const u of users) {
      const [accounts] = await pool.query(
        'SELECT id, account_number, sort_code, type, balance, currency, status FROM accounts WHERE user_id = ?',
        [u.id]
      );
      const camelUser = toCamelCase(u);
      camelUser.accounts = accounts.map(toCamelCase);
      result.push(camelUser);
    }

    res.json({ users: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Admin: returns a single user with accounts.
 */
const getUserById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, role, status, joined_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = toCamelCase(rows[0]);
    const [accounts] = await pool.query(
      'SELECT id, account_number, sort_code, type, balance, currency, status FROM accounts WHERE user_id = ?',
      [req.params.id]
    );
    user.accounts = accounts.map(toCamelCase);

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id/status
 * Body: { status: 'active' | 'suspended' }
 * Admin: toggle user active/suspended.
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "active" or "suspended".' });
    }

    const [result] = await pool.query(
      'UPDATE users SET status = ? WHERE id = ? AND role = ?',
      [status, req.params.id, 'user']
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Log the action
    const logId = generateId();
    const action = status === 'suspended'
      ? `Suspended user ${req.params.id}`
      : `Reactivated user ${req.params.id}`;
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', ?, 'ShieldAlert', ?)`,
      [logId, req.user.id, action, status === 'suspended' ? 'text-amber-400' : 'text-emerald-400']
    );

    res.json({ message: `User ${status} successfully.` });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Admin: soft-delete (or hard-delete) a user.
 */
const deleteUser = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM users WHERE id = ? AND role = ?',
      [req.params.id, 'user']
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Log
    const logId = generateId();
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', ?, 'Trash2', 'text-red-400')`,
      [logId, req.user.id, `Deleted user ${req.params.id}`]
    );

    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, getUserById, updateUserStatus, deleteUser };
