// ─── Authentication & Authorization Middleware ───
const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Verifies the JWT token from the Authorization header.
 * Attaches the decoded user payload to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active
    const [rows] = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = ?', [decoded.id]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    const user = rows[0];
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account is suspended. Contact support.' });
    }

    req.user = user; // { id, name, email, role, status }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

/**
 * Restricts access to admin-only routes.
 * Must be used AFTER authenticate.
 */
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

/**
 * Restricts access to regular user-only routes.
 * Must be used AFTER authenticate.
 */
const userOnly = (req, res, next) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Access denied. User account required.' });
  }
  next();
};

module.exports = { authenticate, adminOnly, userOnly };
