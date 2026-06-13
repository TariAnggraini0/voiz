// backend/config/db.js
// ─────────────────────────────────────────────────────────────
//  MySQL connection pool — dipakai di seluruh route handler
// ─────────────────────────────────────────────────────────────

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'voiz_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+07:00',              // WIB
  charset:            'utf8mb4',
});

// Verifikasi koneksi saat pertama kali modul dimuat
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL terhubung ke database:', process.env.DB_NAME || 'voiz_db');
    conn.release();
  } catch (err) {
    console.error('❌  Gagal konek ke MySQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;