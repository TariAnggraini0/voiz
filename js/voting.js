// frontend/js/voting.js
// ─────────────────────────────────────────────────────────────
//  Voting System — Voiz Frontend
//  Berisi:
//   1. State Management (cache vote lokal)
//   2. Fetch status vote dari server
//   3. Toggle vote (optimistic update + rollback)
//   4. Render tombol vote
//   5. Animasi & feedback visual
//   6. Login prompt jika belum login
//   7. Leaderboard / top voted
//   8. Utilities
// ─────────────────────────────────────────────────────────────

// ============================================================
//  1. STATE — Cache vote agar tidak double-fetch
// ============================================================
const VoteState = (() => {
  const _state = new Map(); // aspirasi_id (number) → boolean

  return {
    set(id, voted)  { _state.set(Number(id), Boolean(voted)); },
    get(id)         { return _state.get(Number(id)) ?? false; },
    has(id)         { return _state.has(Number(id)); },
    remove(id)      { _state.delete(Number(id)); },
    clear()         { _state.clear(); },
    getAllIds()      { return [..._state.keys()]; },
  };
})();

// ============================================================
//  2. FETCH STATUS VOTE DARI SERVER
// ============================================================

/** Cek status vote 1 aspirasi. Hasilnya di-cache ke VoteState. */
async function fetchVoteStatus(aspirasiId) {
  if (VoteState.has(aspirasiId)) return VoteState.get(aspirasiId);
  if (!Auth.isLoggedIn()) { VoteState.set(aspirasiId, false); return false; }

  try {
    const res   = await api.get(`/voting/${aspirasiId}`);
    const voted = res?.success ? Boolean(res.voted) : false;
    VoteState.set(aspirasiId, voted);
    return voted;
  } catch (_) {
    VoteState.set(aspirasiId, false);
    return false;
  }
}

/**
 * Fetch status vote banyak aspirasi sekaligus (paralel).
 * Hanya fetch yang belum ada di cache.
 * @param {number[]} ids
 */
async function fetchVoteStatusBatch(ids) {
  if (!Auth.isLoggedIn() || !ids.length) return;
  const toFetch = ids.filter(id => !VoteState.has(id));
  if (!toFetch.length) return;
  await Promise.allSettled(toFetch.map(id => fetchVoteStatus(id)));
}

// ============================================================
//  3. TOGGLE VOTE — Core Logic
//  Optimistic update: UI langsung berubah, rollback jika gagal.
// ============================================================

/**
 * Toggle vote. Dipanggil dari tombol vote di halaman.
 * @param {number|string} aspirasiId
 * @param {HTMLButtonElement} btnEl — elemen tombol yang diklik
 */
async function toggleVote(aspirasiId, btnEl) {
  const id = Number(aspirasiId);

  if (!Auth.isLoggedIn()) { showVoteLoginPrompt(); return; }
  if (btnEl.disabled) return;

  btnEl.disabled = true;

  // Snapshot state sebelum request (untuk rollback)
  const wasVoted     = VoteState.get(id);
  const currentCount = getVoteCountFromBtn(btnEl);
  const newVoted     = !wasVoted;
  const newCount     = newVoted ? currentCount + 1 : Math.max(currentCount - 1, 0);

  // Optimistic update — UI langsung berubah sebelum server menjawab
  applyVoteUI(id, newVoted, newCount);
  VoteState.set(id, newVoted);

  try {
    const res = await api.post(`/voting/${id}`, {});

    if (res?.success) {
      // Sinkronisasi count dari server (lebih akurat)
      applyVoteUI(id, newVoted, res.vote_count);
      animateVoteBtn(id, newVoted);
    } else {
      // Rollback jika server menolak
      applyVoteUI(id, wasVoted, currentCount);
      VoteState.set(id, wasVoted);
      toast(res?.message || 'Gagal memberikan vote.', 'error');
    }
  } catch (_) {
    // Rollback jika network error
    applyVoteUI(id, wasVoted, currentCount);
    VoteState.set(id, wasVoted);
    toast('Koneksi bermasalah. Coba lagi.', 'error');
  }

  // Re-enable semua tombol aspirasi yang sama di halaman
  document.querySelectorAll(`[data-vote-id="${id}"]`)
    .forEach(b => { b.disabled = false; });
}

// ============================================================
//  4. RENDER TOMBOL VOTE
//  Hasilkan HTML string tombol vote yang siap disisipkan.
//  Gunakan: container.innerHTML += createVoteBtn(id, count, voted)
// ============================================================

/**
 * Buat HTML tombol vote.
 * @param {number} aspirasiId
 * @param {number} voteCount
 * @param {boolean} voted     — apakah user sudah vote
 * @returns {string} HTML string
 */
function createVoteBtn(aspirasiId, voteCount, voted = false) {
  return `
    <button
      class="vote-btn ${voted ? 'voted' : ''}"
      data-vote-id="${aspirasiId}"
      onclick="toggleVote(${aspirasiId}, this)"
      title="${voted ? 'Batalkan vote' : 'Dukung aspirasi ini'}"
    >
      <span class="vote-arrow">▲</span>
      <span class="vote-count" id="voteCount-${aspirasiId}">${formatVoteCount(voteCount)}</span>
    </button>
  `;
}

/**
 * Update semua tombol vote untuk aspirasi tertentu di halaman.
 * Dipanggil setelah toggle berhasil.
 * @param {number} aspirasiId
 * @param {boolean} voted
 * @param {number} count
 */
function applyVoteUI(aspirasiId, voted, count) {
  // Update class tombol
  document.querySelectorAll(`[data-vote-id="${aspirasiId}"]`).forEach(btn => {
    btn.classList.toggle('voted', voted);
    btn.title = voted ? 'Batalkan vote' : 'Dukung aspirasi ini';
  });

  // Update angka count
  document.querySelectorAll(`#voteCount-${aspirasiId}`).forEach(el => {
    el.textContent = formatVoteCount(count);
  });
}

// ============================================================
//  5. ANIMASI & FEEDBACK VISUAL
// ============================================================

/**
 * Animasi pop pada tombol vote setelah berhasil.
 * @param {number} aspirasiId
 * @param {boolean} voted
 */
function animateVoteBtn(aspirasiId, voted) {
  document.querySelectorAll(`[data-vote-id="${aspirasiId}"]`).forEach(btn => {
    btn.classList.remove('vote-pop');
    // Force reflow agar animasi bisa diulang
    void btn.offsetWidth;
    btn.classList.add('vote-pop');

    if (voted) {
      spawnVoteParticle(btn);
    }

    setTimeout(() => btn.classList.remove('vote-pop'), 400);
  });
}

/**
 * Munculkan partikel ▲ kecil yang melayang ke atas saat upvote.
 * @param {HTMLElement} btnEl
 */
function spawnVoteParticle(btnEl) {
  const rect      = btnEl.getBoundingClientRect();
  const particle  = document.createElement('span');

  particle.textContent  = '▲';
  particle.className    = 'vote-particle';
  particle.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2}px;
    top:  ${rect.top}px;
    color: var(--accent);
    font-size: .75rem;
    font-weight: 700;
    pointer-events: none;
    z-index: 9999;
    animation: voteParticleUp .7s ease forwards;
  `;

  document.body.appendChild(particle);
  setTimeout(() => particle.remove(), 700);
}

// Inject style animasi (hanya sekali)
(function injectVoteStyles() {
  if (document.getElementById('voiz-vote-styles')) return;
  const style       = document.createElement('style');
  style.id          = 'voiz-vote-styles';
  style.textContent = `
    @keyframes voteParticleUp {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-40px) scale(.6); }
    }
    @keyframes votePop {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.25); }
      70%  { transform: scale(.92); }
      100% { transform: scale(1); }
    }
    .vote-pop {
      animation: votePop .4s ease;
    }
    .vote-btn {
      transition: background .2s, border-color .2s, color .2s;
    }
    .vote-btn .vote-arrow {
      display: inline-block;
      transition: transform .2s;
    }
    .vote-btn.voted .vote-arrow {
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);
})();

// ============================================================
//  6. LOGIN PROMPT — Muncul jika belum login saat klik vote
// ============================================================
function showVoteLoginPrompt() {
  // Hapus prompt lama jika ada
  document.getElementById('voteLoginPrompt')?.remove();

  const el = document.createElement('div');
  el.id    = 'voteLoginPrompt';
  el.style.cssText = `
    position: fixed;
    bottom: 5rem; left: 50%;
    transform: translateX(-50%);
    background: var(--bg-elevated);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: 1rem 1.5rem;
    display: flex; align-items: center; gap: 1rem;
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    animation: slideIn .3s ease;
    white-space: nowrap;
  `;
  el.innerHTML = `
    <span style="font-size:.9rem;color:var(--text-muted);">
      🔒 Login dulu untuk memberikan vote
    </span>
    <a href="login.html" class="btn btn-primary btn-sm">Login</a>
    <button
      onclick="document.getElementById('voteLoginPrompt').remove()"
      style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1rem;"
    >✕</button>
  `;

  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

// ============================================================
//  7. LEADERBOARD — Render top voted aspirasi
// ============================================================

/**
 * Render leaderboard top N aspirasi by vote ke dalam container.
 * @param {HTMLElement} container
 * @param {number} limit — jumlah item yang ditampilkan (default 5)
 */
async function renderLeaderboard(container, limit = 5) {
  if (!container) return;

  container.innerHTML = `
    <div class="flex-center" style="padding:2rem;">
      <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
    </div>
  `;

  const res = await api.get(`/aspirasi?limit=${limit}&page=1`);

  if (!res?.success || !res.data.length) {
    container.innerHTML = `
      <p class="text-muted text-sm text-center" style="padding:1.5rem;">
        Belum ada aspirasi.
      </p>
    `;
    return;
  }

  // Urutkan by vote_count descending (sudah dari server, tapi sort ulang untuk aman)
  const sorted = [...res.data].sort((a, b) => b.vote_count - a.vote_count);

  container.innerHTML = sorted.map((a, i) => {
    const medal = ['🥇','🥈','🥉'][i] ?? `<span style="color:var(--text-dim);font-weight:700;">#${i+1}</span>`;
    return `
      <div style="
        display: flex; align-items: center; gap: .85rem;
        padding: .75rem 0;
        border-bottom: 1px solid var(--border);
      ">
        <span style="font-size:1.2rem;min-width:28px;text-align:center;">${medal}</span>
        <div style="flex:1;min-width:0;">
          <div style="
            font-size: .9rem; font-weight: 500;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          ">${escVote(a.judul)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem;">
            <span style="color:${a.kategori_warna}">● ${escVote(a.kategori_nama)}</span>
          </div>
        </div>
        <span style="
          color: var(--accent); font-weight: 700;
          font-size: .9rem; flex-shrink: 0;
        ">▲ ${formatVoteCount(a.vote_count)}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
//  8. UTILITIES
// ============================================================

/** Ambil angka vote dari dalam elemen tombol */
function getVoteCountFromBtn(btnEl) {
  const countEl = btnEl.querySelector('.vote-count');
  if (!countEl) return 0;
  // Hapus suffix 'k' jika ada lalu parse
  const raw = countEl.textContent.trim().replace('k', '');
  return parseFloat(raw) * (countEl.textContent.includes('k') ? 1000 : 1) || 0;
}

/**
 * Format angka vote — lebih dari 999 disingkat jadi "1.2k"
 * @param {number} n
 * @returns {string}
 */
function formatVoteCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

/** Escape HTML untuk mencegah XSS pada output leaderboard */
function escVote(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}