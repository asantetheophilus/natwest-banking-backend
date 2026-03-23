// ─── NatWest Banking API — Server Entry Point ───
// FIX 6: Added helmet, rate-limiting, hpp, improved CORS, body size limits
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const hpp          = require('hpp');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Security Headers (helmet) ──────────────────
// Sets various HTTP headers to help protect the app
app.use(helmet());

// ─── HTTP Parameter Pollution protection ────────
app.use(hpp());

// ─── CORS — improved configuration ─────────────
// Supports comma-separated origins from FRONTEND_URL env var
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing with size limits ──────────────
app.use(express.json({ limit: '10kb' }));   // Prevent large payload attacks
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── General Rate Limiter ───────────────────────
// Applies to all /api routes
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api', generalLimiter);

// ─── Stricter Rate Limiter for Auth endpoints ───
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

// ─── Health Check ───────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ─────────────────────────────────
// Auth routes get the stricter limiter
app.use('/api/auth', authLimiter, require('./routes/auth'));

app.use('/api/users',         require('./routes/users'));
app.use('/api/accounts',      require('./routes/accounts'));
app.use('/api/transactions',  require('./routes/transactions'));
app.use('/api/payees',        require('./routes/payees'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tickets',       require('./routes/tickets'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/settings',      require('./routes/settings'));

// ─── 404 Handler ────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ─── Global Error Handler ───────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 NatWest Banking API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend:    ${allowedOrigins.join(', ')}\n`);
});
