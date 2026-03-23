// ─── Notifications Routes ────────────────────────
const router = require('express').Router();
const { getMyNotifications, markAsRead, markAllAsRead, deleteNotification } = require('../controllers/notificationsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/',              getMyNotifications);
router.patch('/read-all',    markAllAsRead);
router.patch('/:id/read',   markAsRead);
router.delete('/:id',       deleteNotification);

module.exports = router;
