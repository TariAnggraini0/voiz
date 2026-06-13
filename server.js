// backend/server.js
// ─────────────────────────────────────────────────────────────
//  Entry point — Voiz API Server
//  Menggabungkan semua route dan middleware global
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

// ── Routes ──────────────────────────────────────────────────
const authRoute     = require('./routes/auth');
const aspirasiRoute = require('./routes/aspirasi');
const adminRoute    = require('./routes/admin');
const votingRoute   = require('./routes/voting');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Global Middleware ────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Sajikan file upload secara statis
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate Limiting ────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 menit
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak request. Coba lagi nanti.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan login. Tunggu 15 menit.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Mount Routes ─────────────────────────────────────────────
app.use('/api/auth',     authRoute);
app.use('/api/aspirasi', aspirasiRoute);
app.use('/api/admin',    adminRoute);
app.use('/api/voting',   votingRoute);

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'Voiz API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ──────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║  🎤  VOIZ API — Running             ║
  ║  Port   : ${PORT}                      ║
  ║  Mode   : ${process.env.NODE_ENV || 'development'}               ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
