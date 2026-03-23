// ─── Auth Routes ─────────────────────────────────
// FIX 5: Added express-validator rules to register, login, verify-2fa
const router = require('express').Router();
const { register, login, verify2fa, getMe, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerRules, loginRules, verify2faRules } = require('../middleware/validate');

router.post('/register',   registerRules,   register);
router.post('/login',      loginRules,      login);
router.post('/verify-2fa', verify2faRules,  verify2fa);
router.get('/me',          authenticate,    getMe);
router.post('/logout',     authenticate,    logout);

module.exports = router;
