// ─── Users Routes (Admin) ────────────────────────
// FIX 5: Added validation to status update and delete
const router = require('express').Router();
const { getAllUsers, getUserById, updateUserStatus, deleteUser } = require('../controllers/usersController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { updateUserStatusRules, deleteUserRules } = require('../middleware/validate');

router.use(authenticate, adminOnly);

router.get('/',              getAllUsers);
router.get('/:id',           getUserById);
router.patch('/:id/status',  updateUserStatusRules, updateUserStatus);
router.delete('/:id',        deleteUserRules, deleteUser);

module.exports = router;
