// ─── Auth Controller ─────────────────────────────
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { generateId, generateAccountNumber, generateSortCode, toCamelCase } = require('../utils/helpers');

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 * Creates user + default Current Account + welcome notification.
 * Returns: { message, user }
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    // Check duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const userId = generateId();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user
    await pool.query(
      `INSERT INTO users (id, name, email, password, role, status) VALUES (?, ?, ?, ?, 'user', 'active')`,
      [userId, name, email, hashedPassword]
    );

    // Create default Current Account with £0 balance
    const accountId = generateId();
    const accountNumber = generateAccountNumber();
    const sortCode = generateSortCode();
    await pool.query(
      `INSERT INTO accounts (id, user_id, account_number, sort_code, type, balance, currency)
       VALUES (?, ?, ?, ?, 'Current Account', 0.00, 'GBP')`,
      [accountId, userId, accountNumber, sortCode]
    );

    // Welcome notification
    const notifId = generateId();
    await pool.query(
      `INSERT INTO notifications (id, user_id, title, message)
       VALUES (?, ?, 'Welcome to NatWest', 'Your account has been created successfully. Start exploring your dashboard.')`,
      [notifId, userId]
    );

    // Log activity
    const logId = generateId();
    await pool.query(
      `INSERT INTO activity_logs (id, actor, action, icon, color)
       VALUES (?, 'System', ?, 'Users', 'text-blue-400')`,
      [logId, `New user registration: ${name}`]
    );

    res.status(201).json({
      message: 'Registration successful.',
      user: { id: userId, name, email, role: 'user' },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Step 1 of 2-step auth: validates credentials, returns a temporary pre-2FA token.
 * The frontend shows the OTP screen after this succeeds.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Look up user (both roles)
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account is suspended. Contact support.' });
    }

    // Return a short-lived pre-2FA token (valid for 5 minutes)
    const pre2faToken = jwt.sign(
      { id: user.id, step: 'pre2fa' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.json({
      message: 'Credentials verified. Complete 2FA.',
      pre2faToken,
      userId: user.id,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-2fa
 * Body: { pre2faToken, otp }
 * Mock 2FA — accepts any 6-digit OTP.
 * Returns the full auth token + user object (with accounts).
 */
const verify2fa = async (req, res, next) => {
  try {
    const { pre2faToken, otp } = req.body;

    if (!pre2faToken || !otp) {
      return res.status(400).json({ message: 'Token and OTP are required.' });
    }

    // Verify the pre-2FA token
    let decoded;
    try {
      decoded = jwt.verify(pre2faToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired 2FA session.' });
    }

    if (decoded.step !== 'pre2fa') {
      return res.status(401).json({ message: 'Invalid token type.' });
    }

    // Mock OTP check — accept any 6-digit string
    if (typeof otp !== 'string' || otp.length !== 6) {
      return res.status(400).json({ message: 'OTP must be 6 digits.' });
    }

    // Fetch user with accounts
    const [userRows] = await pool.query(
      'SELECT id, name, email, phone, role, status, joined_at FROM users WHERE id = ?',
      [decoded.id]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = toCamelCase(userRows[0]);

    const [accountRows] = await pool.query(
      'SELECT id, account_number, sort_code, type, balance, currency, status FROM accounts WHERE user_id = ?',
      [decoded.id]
    );
    user.accounts = accountRows.map(toCamelCase);

    // Issue full auth token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response (already excluded from SELECT)
    res.json({
      message: 'Login successful.',
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user + accounts.
 */
const getMe = async (req, res, next) => {
  try {
    const [userRows] = await pool.query(
      'SELECT id, name, email, phone, role, status, joined_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = toCamelCase(userRows[0]);

    const [accountRows] = await pool.query(
      'SELECT id, account_number, sort_code, type, balance, currency, status FROM accounts WHERE user_id = ?',
      [req.user.id]
    );
    user.accounts = accountRows.map(toCamelCase);

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Client-side token removal. Server-side we just acknowledge.
 */
const logout = (_req, res) => {
  res.json({ message: 'Logged out successfully.' });
};

module.exports = { register, login, verify2fa, getMe, logout };
