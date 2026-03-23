// ─── Accounts Routes ─────────────────────────────
// FIX 5: Added validation to admin status/balance updates
const router = require('express').Router();
const { getMyAccounts, createAccount, updateAccountStatus, updateAccountBalance } = require('../controllers/accountsController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { updateAccountStatusRules, updateAccountBalanceRules } = require('../middleware/validate');

// User routes
router.get('/',     authenticate, getMyAccounts);
router.post('/',    authenticate, createAccount);

// Admin routes
router.patch('/:id/status',   authenticate, adminOnly, updateAccountStatusRules, updateAccountStatus);
router.patch('/:id/balance',  authenticate, adminOnly, updateAccountBalanceRules, updateAccountBalance);

module.exports = router;
