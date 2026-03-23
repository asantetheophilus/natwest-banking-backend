// ─── Tickets Routes ──────────────────────────────
// FIX 5: Added validation to create, status update, and respond
const router = require('express').Router();
const { getTickets, createTicket, updateTicketStatus, respondToTicket } = require('../controllers/ticketsController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { createTicketRules, updateTicketStatusRules, respondToTicketRules } = require('../middleware/validate');

router.use(authenticate);

router.get('/',                getTickets);
router.post('/',               createTicketRules, createTicket);

// Admin-only
router.patch('/:id/status',   adminOnly, updateTicketStatusRules, updateTicketStatus);
router.post('/:id/respond',   adminOnly, respondToTicketRules, respondToTicket);

module.exports = router;
