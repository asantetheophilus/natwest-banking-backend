// ─── Input Validation Schemas (express-validator) ─────────
// Centralised validation rules for every endpoint that accepts user input.
// Each export is an array of validation chains usable as Express middleware.

const { body, query, param } = require('express-validator');
const xss = require('xss');

// ─── Helper: run validators and return 400 on failure ────
const { validationResult } = require('express-validator');
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return the first error message for a clean UX
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Helper: custom sanitiser that strips XSS from strings ─
const sanitize = (value) => (typeof value === 'string' ? xss(value.trim()) : value);

// ════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════

const registerRules = [
  body('name')
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters.')
    .customSanitizer(sanitize),
  body('email')
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters.'),
  validate,
];

const loginRules = [
  body('email')
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
  validate,
];

const verify2faRules = [
  body('pre2faToken')
    .notEmpty().withMessage('Pre-2FA token is required.'),
  body('otp')
    .notEmpty().withMessage('OTP is required.')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits.')
    .matches(/^\d{6}$/).withMessage('OTP must contain only digits.'),
  validate,
];

// ════════════════════════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════════════════════════

const transferRules = [
  body('payeeId')
    .notEmpty().withMessage('Payee is required.')
    .isString().withMessage('Payee ID must be a string.'),
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isFloat({ gt: 0, lt: 1000000 }).withMessage('Amount must be between £0.01 and £999,999.99.'),
  body('reference')
    .optional()
    .isLength({ max: 255 }).withMessage('Reference must be under 255 characters.')
    .customSanitizer(sanitize),
  validate,
];

const reviewApprovalRules = [
  param('id')
    .notEmpty().withMessage('Approval ID is required.'),
  body('action')
    .notEmpty().withMessage('Action is required.')
    .isIn(['approved', 'rejected']).withMessage('Action must be "approved" or "rejected".'),
  validate,
];

// ════════════════════════════════════════════════════
//  USERS (Admin)
// ════════════════════════════════════════════════════

const updateUserStatusRules = [
  param('id').notEmpty().withMessage('User ID is required.'),
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(['active', 'suspended']).withMessage('Status must be "active" or "suspended".'),
  validate,
];

const deleteUserRules = [
  param('id').notEmpty().withMessage('User ID is required.'),
  validate,
];

// ════════════════════════════════════════════════════
//  ACCOUNTS (Admin)
// ════════════════════════════════════════════════════

const updateAccountStatusRules = [
  param('id').notEmpty().withMessage('Account ID is required.'),
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(['active', 'frozen']).withMessage('Status must be "active" or "frozen".'),
  validate,
];

const updateAccountBalanceRules = [
  param('id').notEmpty().withMessage('Account ID is required.'),
  body('balance')
    .notEmpty().withMessage('Balance is required.')
    .isFloat({ min: 0 }).withMessage('Balance must be a non-negative number.'),
  validate,
];

// ════════════════════════════════════════════════════
//  TICKETS
// ════════════════════════════════════════════════════

const createTicketRules = [
  body('subject')
    .notEmpty().withMessage('Subject is required.')
    .isLength({ min: 3, max: 200 }).withMessage('Subject must be 3-200 characters.')
    .customSanitizer(sanitize),
  body('message')
    .notEmpty().withMessage('Message is required.')
    .isLength({ min: 10, max: 5000 }).withMessage('Message must be 10-5000 characters.')
    .customSanitizer(sanitize),
  validate,
];

const updateTicketStatusRules = [
  param('id').notEmpty().withMessage('Ticket ID is required.'),
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(['open', 'resolved']).withMessage('Status must be "open" or "resolved".'),
  validate,
];

const respondToTicketRules = [
  param('id').notEmpty().withMessage('Ticket ID is required.'),
  body('message')
    .notEmpty().withMessage('Response message is required.')
    .isLength({ min: 1, max: 5000 }).withMessage('Response must be 1-5000 characters.')
    .customSanitizer(sanitize),
  validate,
];

// ════════════════════════════════════════════════════
//  PAYEES
// ════════════════════════════════════════════════════

const addPayeeRules = [
  body('name')
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters.')
    .customSanitizer(sanitize),
  body('accountNumber')
    .notEmpty().withMessage('Account number is required.')
    .matches(/^\d{8}$/).withMessage('Account number must be 8 digits.'),
  body('sortCode')
    .notEmpty().withMessage('Sort code is required.')
    .matches(/^\d{2}-\d{2}-\d{2}$/).withMessage('Sort code must be in format XX-XX-XX.'),
  validate,
];

// ════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════

const updateProfileRules = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters.')
    .customSanitizer(sanitize),
  body('email')
    .optional()
    .isEmail().withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('phone')
    .optional()
    .isLength({ max: 20 }).withMessage('Phone must be under 20 characters.')
    .customSanitizer(sanitize),
  validate,
];

const changePasswordRules = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required.'),
  body('newPassword')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 6, max: 128 }).withMessage('New password must be 6-128 characters.'),
  validate,
];

// ════════════════════════════════════════════════════
//  ADMIN SETTINGS
// ════════════════════════════════════════════════════

const updateSystemSettingRules = [
  body('key')
    .notEmpty().withMessage('Setting key is required.')
    .isLength({ max: 100 }).withMessage('Key must be under 100 characters.')
    .customSanitizer(sanitize),
  body('value')
    .exists({ checkNull: true }).withMessage('Setting value is required.'),
  validate,
];

module.exports = {
  registerRules,
  loginRules,
  verify2faRules,
  transferRules,
  reviewApprovalRules,
  updateUserStatusRules,
  deleteUserRules,
  updateAccountStatusRules,
  updateAccountBalanceRules,
  createTicketRules,
  updateTicketStatusRules,
  respondToTicketRules,
  addPayeeRules,
  updateProfileRules,
  changePasswordRules,
  updateSystemSettingRules,
};
