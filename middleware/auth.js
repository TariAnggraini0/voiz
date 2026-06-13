// backend/middleware/auth.js
// ─────────────────────────────────────────────────────────────
//  Middleware verifikasi JWT + role-based guard
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');

/**
 * Verifikasi token JWT dari header Authorization: Bearer <token>
 * Menyuntikkan req.user = { id, email, role, nama }
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token sudah kedaluwarsa.' });
    }
    return res.status(401).json({ success: false, message: 'Token tidak valid.' });
  }
};

/**
 * Guard role — gunakan setelah verifyToken
 * Contoh: requireRole('admin'), requireRole('admin','pimpinan')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Akses ditolak. Diperlukan role: ${roles.join(' / ')}.`,
    });
  }
  next();
};

module.exports = { verifyToken, requireRole };