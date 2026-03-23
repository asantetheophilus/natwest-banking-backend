// ─── Settings Controller (User Profile & Preferences) ───────
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
const { toCamelCase } = require('../utils/helpers');

/**
 * GET /api/settings/profile
 * Returns the user's profile information.
 * Matches the frontend settings page shape.
 */
const getProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, role, status, joined_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ profile: toCamelCase(rows[0]) });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/settings/profile
 * Body: { name?, email?, phone? }
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const updates = [];
    const params = [];

    if (name)  { updates.push('name = ?');  params.push(name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (phone) { updates.push('phone = ?'); params.push(phone); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    params.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/settings/password
 * Body: { currentPassword, newPassword }
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Verify current password
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, changePassword };
