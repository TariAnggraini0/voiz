// backend/routes/voting.js
// ─────────────────────────────────────────────────────────────
//  POST   /api/voting/:aspirasi_id   — toggle vote (upvote/unvote)
//  GET    /api/voting/:aspirasi_id   — cek apakah user sudah vote
// ─────────────────────────────────────────────────────────────

const express          = require('express');
const pool             = require('../config/db');
const { verifyToken }  = require('../middleware/auth');

const router = express.Router();

// ── Toggle vote ───────────────────────────────────────────
router.post('/:aspirasi_id', verifyToken, async (req, res) => {
  const { aspirasi_id } = req.params;
  const userId = req.user.id;

  try {
    // Cek aspirasi ada
    const [[asp]] = await pool.query(
      'SELECT id FROM aspirasi WHERE id = ?', [aspirasi_id]
    );
    if (!asp) {
      return res.status(404).json({ success: false, message: 'Aspirasi tidak ditemukan.' });
    }

    // Cek sudah vote?
    const [[existing]] = await pool.query(
      'SELECT id FROM votes WHERE aspirasi_id = ? AND user_id = ?',
      [aspirasi_id, userId]
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (existing) {
        // Unvote
        await conn.query(
          'DELETE FROM votes WHERE aspirasi_id = ? AND user_id = ?',
          [aspirasi_id, userId]
        );
        await conn.query(
          'UPDATE aspirasi SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = ?',
          [aspirasi_id]
        );
        await conn.commit();

        const [[{ vote_count }]] = await pool.query(
          'SELECT vote_count FROM aspirasi WHERE id = ?', [aspirasi_id]
        );
        return res.json({ success: true, action: 'unvoted', vote_count });
      } else {
        // Upvote
        await conn.query(
          'INSERT INTO votes (aspirasi_id, user_id) VALUES (?, ?)',
          [aspirasi_id, userId]
        );
        await conn.query(
          'UPDATE aspirasi SET vote_count = vote_count + 1 WHERE id = ?',
          [aspirasi_id]
        );
        await conn.commit();

        const [[{ vote_count }]] = await pool.query(
          'SELECT vote_count FROM aspirasi WHERE id = ?', [aspirasi_id]
        );
        return res.json({ success: true, action: 'voted', vote_count });
      }
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[voting]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Cek status vote user ──────────────────────────────────
router.get('/:aspirasi_id', verifyToken, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT id FROM votes WHERE aspirasi_id = ? AND user_id = ?',
      [req.params.aspirasi_id, req.user.id]
    );
    return res.json({ success: true, voted: !!row });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;