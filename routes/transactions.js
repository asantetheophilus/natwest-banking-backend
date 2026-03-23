// ─── Transactions Routes ─────────────────────────
// FIX 5: Added validation to transfer and reviewApproval
const router = require('express').Router();
const {
  getMyTransactions,
  getAllTransactions,
  createTransfer,
  getPendingApprovals,
  reviewApproval,
} = require('../controllers/transactionsController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { transferRules, reviewApprovalRules } = require('../middleware/validate');

// User routes
router.get('/',             authenticate, getMyTransactions);
router.post('/transfer',    authenticate, transferRules, createTransfer);

// Admin routes
router.get('/all',                    authenticate, adminOnly, getAllTransactions);
router.get('/approvals',              authenticate, adminOnly, getPendingApprovals);
router.patch('/approvals/:id',        authenticate, adminOnly, reviewApprovalRules, reviewApproval);

module.exports = router;
