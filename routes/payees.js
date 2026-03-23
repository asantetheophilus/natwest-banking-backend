// ─── Payees Routes ───────────────────────────────
// FIX 5: Added validation to addPayee
const router = require('express').Router();
const { getPayees, addPayee, deletePayee } = require('../controllers/payeesController');
const { authenticate } = require('../middleware/auth');
const { addPayeeRules } = require('../middleware/validate');

router.use(authenticate);

router.get('/',       getPayees);
router.post('/',      addPayeeRules, addPayee);
router.delete('/:id', deletePayee);

module.exports = router;
