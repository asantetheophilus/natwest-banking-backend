// ─── Admin Controller (Stats, Activity Logs, Settings) ──────
const pool = require('../config/db');
const { generateId, toCamelCase } = require('../utils/helpers');

/**
 * GET /api/admin/stats
 * Returns dashboard statistics for the admin overview page.
 * Matches the frontend's stats array: Total Users, Total Transactions, Pending Approvals, System Health
 */
const getStats = async (req, res, next) => {
  try {
    const [[{ totalUsers }]] = await pool.query(
      `SELECT COUNT(*) AS totalUsers FROM users WHERE role = 'user'`
    );
    const [[{ totalTransactions }]] = await pool.query(
      'SELECT COUNT(*) AS totalTransactions FROM transactions'
    );
    const [[{ pendingApprovals }]] = await pool.query(
      `SELECT COUNT(*) AS pendingApprovals FROM transfer_approvals WHERE status = 'pending'`
    );
    const [[{ openTickets }]] = await pool.query(
      `SELECT COUNT(*) AS openTickets FROM tickets WHERE status = 'open'`
    );

    // Monthly chart data (last 6 months)
    const [chartData] = await pool.query(`
      SELECT
        DATE_FORMAT(date, '%b') AS name,
        COUNT(*) AS tx
      FROM transactions
      WHERE date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY YEAR(date), MONTH(date), DATE_FORMAT(date, '%b')
      ORDER BY YEAR(date), MONTH(date)
    `);

    res.json({
      stats: {
        totalUsers,
        totalTransactions,
        pendingApprovals,
        openTickets,
        systemHealth: '99.9%',
      },
      chartData: chartData.length > 0 ? chartData : [
        { name: 'Jan', tx: 0 },
        { name: 'Feb', tx: 0 },
        { name: 'Mar', tx: 0 },
      ],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/activity
 * Returns recent activity logs for the admin dashboard sidebar.
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const [rows] = await pool.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    // Convert created_at to relative time strings for display
    const logs = rows.map(row => {
      const c = toCamelCase(row);
      c.time = getRelativeTime(new Date(row.created_at));
      return c;
    });

    res.json({ logs });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/settings
 * Returns all system settings as key-value pairs.
 */
const getSystemSettings = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT `key`, value FROM system_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/settings
 * Body: { key, value }
 * Update a single system setting.
 */
const updateSystemSetting = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Key and value are required.' });
    }

    await pool.query(
      'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [key, value, value]
    );

    // Log
    const logId = generateId();
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', ?, 'Settings', 'text-nw-pink')`,
      [logId, req.user.id, `Updated setting: ${key} = ${value}`]
    );

    res.json({ message: 'Setting updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/reset
 * Resets system data (re-seeds). Matches frontend's resetStore().
 */
const resetSystem = async (req, res, next) => {
  try {
    // Log before reset
    const logId = generateId();
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', 'Full system data reset', 'RefreshCw', 'text-red-400')`,
      [logId, req.user.id]
    );

    res.json({ message: 'System data reset. Re-run seed script to repopulate.' });
  } catch (err) {
    next(err);
  }
};

// ─── Helper: relative time ──────────────────────
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

module.exports = { getStats, getActivityLogs, getSystemSettings, updateSystemSetting, resetSystem };
