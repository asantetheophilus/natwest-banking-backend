// ─── Notifications Controller ────────────────────
const pool = require('../config/db');
const { generateId, toCamelCase } = require('../utils/helpers');

/**
 * GET /api/notifications
 * User: returns their notifications sorted by date desc.
 * Matches frontend shape: { id, userId, title, message, date, read }
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id, title, message, date, `read` FROM notifications WHERE user_id = ? ORDER BY date DESC',
      [req.user.id]
    );
    res.json({ notifications: rows.map(r => {
      const c = toCamelCase(r);
      // MySQL returns `read` as 0/1, frontend expects boolean
      c.read = !!c.read;
      return c;
    })});
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
const markAsRead = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET `read` = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the current user.
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET `read` = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    res.json({ message: 'Notification deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead, deleteNotification };
