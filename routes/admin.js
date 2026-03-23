// ─── Admin Routes (Stats, Activity, Settings) ───
// FIX 5: Added validation to updateSystemSetting
const router = require('express').Router();
const { getStats, getActivityLogs, getSystemSettings, updateSystemSetting, resetSystem } = require('../controllers/adminController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { updateSystemSettingRules } = require('../middleware/validate');

router.use(authenticate, adminOnly);

router.get('/stats',       getStats);
router.get('/activity',    getActivityLogs);
router.get('/settings',    getSystemSettings);
router.patch('/settings',  updateSystemSettingRules, updateSystemSetting);
router.post('/reset',      resetSystem);

module.exports = router;
