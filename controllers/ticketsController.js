// ─── Support Tickets Controller ──────────────────
const pool = require('../config/db');
const { generateId, toCamelCase } = require('../utils/helpers');

/**
 * GET /api/tickets
 * User: their own tickets. Admin: all tickets.
 * Each ticket includes its responses array.
 * Matches frontend shape: { id, userId, subject, message, status, date, responses[] }
 */
const getTickets = async (req, res, next) => {
  try {
    let ticketSql, ticketParams;

    if (req.user.role === 'admin') {
      ticketSql = 'SELECT * FROM tickets ORDER BY date DESC';
      ticketParams = [];
    } else {
      ticketSql = 'SELECT * FROM tickets WHERE user_id = ? ORDER BY date DESC';
      ticketParams = [req.user.id];
    }

    const [tickets] = await pool.query(ticketSql, ticketParams);

    // Attach responses to each ticket
    const result = [];
    for (const t of tickets) {
      const [responses] = await pool.query(
        'SELECT id, admin_name, message, date FROM ticket_responses WHERE ticket_id = ? ORDER BY date ASC',
        [t.id]
      );
      const ticket = toCamelCase(t);
      ticket.responses = responses.map(r => toCamelCase(r));
      result.push(ticket);
    }

    res.json({ tickets: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets
 * User: create a new support ticket.
 * Body: { subject, message }
 */
const createTicket = async (req, res, next) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required.' });
    }

    const id = generateId();
    await pool.query(
      `INSERT INTO tickets (id, user_id, subject, message, status) VALUES (?, ?, ?, ?, 'open')`,
      [id, req.user.id, subject, message]
    );

    res.status(201).json({
      ticket: toCamelCase({
        id,
        user_id: req.user.id,
        subject,
        message,
        status: 'open',
        date: new Date().toISOString(),
        responses: [],
      }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/tickets/:id/status
 * Admin: change ticket status.
 * Body: { status: 'open' | 'resolved' }
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "open" or "resolved".' });
    }

    const [result] = await pool.query(
      'UPDATE tickets SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    // Log
    const logId = generateId();
    await pool.query(
      `INSERT INTO activity_logs (id, admin_id, actor, action, icon, color) VALUES (?, ?, 'Admin', ?, 'CheckCircle2', 'text-emerald-400')`,
      [logId, req.user.id, `${status === 'resolved' ? 'Resolved' : 'Reopened'} ticket #${req.params.id.slice(-6)}`]
    );

    res.json({ message: `Ticket ${status}.` });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/:id/respond
 * Admin: add a response to a ticket.
 * Body: { message }
 */
const respondToTicket = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Response message is required.' });
    }

    // Verify ticket exists
    const [ticketRows] = await pool.query('SELECT id, user_id FROM tickets WHERE id = ?', [req.params.id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    const responseId = generateId();
    await pool.query(
      `INSERT INTO ticket_responses (id, ticket_id, admin_name, message) VALUES (?, ?, ?, ?)`,
      [responseId, req.params.id, req.user.name, message]
    );

    // Notify the ticket owner
    const notifId = generateId();
    await pool.query(
      `INSERT INTO notifications (id, user_id, title, message) VALUES (?, ?, 'Support Update', ?)`,
      [notifId, ticketRows[0].user_id, `Your ticket has received a new response from support.`]
    );

    res.status(201).json({
      response: toCamelCase({
        id: responseId,
        admin_name: req.user.name,
        message,
        date: new Date().toISOString(),
      }),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTickets, createTicket, updateTicketStatus, respondToTicket };
