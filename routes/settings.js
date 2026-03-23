// ─── Settings Routes (User Profile) ──────────────
// FIX 5: Added validation to profile update and password change
const router = require('express').Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const { updateProfileRules, changePasswordRules } = require('../middleware/validate');

router.use(authenticate);

router.get('/profile',      getProfile);
router.patch('/profile',    updateProfileRules, updateProfile);
router.patch('/password',   changePasswordRules, changePassword);

module.exports = router;
