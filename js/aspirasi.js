// frontend/js/aspirasi.js
// ─────────────────────────────────────────────────────────────
//  Dashboard mahasiswa — list, filter, voting, notifikasi, modal
// ─────────────────────────────────────────────────────────────

(async () => {
  // ── Auth ───────────────────────────────────────────────
  let currentUser = null;
  if (Auth.isLoggedIn()) {
    currentUser = Auth.getUser();
    document.getElementById('userGreet').textContent = `Hi, ${currentUser?.nama?.split(' ')[0]}`;
    loadNotifikasi();
  }

  // ── State ──────────────────────────────────────────────
  let currentPage = 1;
  let searchTimer;
  let userVotes = {};   // aspirasi_id -> true/false

  // ── Load Kategori untuk Filter ─────────────────────────
  const katSelect = document.getElementById('filterKategori');
  const katRes = await api.get('/aspirasi/kategori');
  if (katRes?.success) {
    katRes.data.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = k.nama;
      katSelect.appendChild(opt);
    });
  }

  // ── Fetch & Render Aspirasi ────────────────────────────
  async function loadAspirasi(page = 1) {
    currentPage = page;
    const list = document.getElementById('aspirasiList');
    list.innerHTML = `
      <div class="flex-center" style="padding:3rem;flex-direction:column;gap:1rem;">
        <div class="spinner" style="width:28px;height:28px;border-width:3px;"></div>
        <p class="text-muted text-sm">Memuat…</p>
      </div>`;

    const q    = document.getElementById('searchInput').value.trim();
    const kat  = document.getElementById('filterKategori').value;
    const stat = document.getElementById('filterStatus').value;

    let url = `/aspirasi?page=${page}&limit=10`;
    if (q)    url += `&q=${encodeURIComponent(q)}`;
    if (kat)  url += `&kategori_id=${kat}`;
    if (stat) url += `&status=${stat}`;

    const res = await api.get(url);

    if (!res?.success) {
      list.innerHTML = `<div class="empty-state"><p>Gagal memuat aspirasi.</p></div>`;
      return;
    }

    // Jika user login, ambil status vote semua aspirasi yang tampil
    if (currentUser && res.data.length > 0) {
      await Promise.all(res.data.map(async (a) => {
        const v = await api.get(`/voting/${a.id}`);
        if (v?.success) userVotes[a.id] = v.voted;
      }));
    }

    renderAspirasi(res.data);
    renderPagination(res.pagination);
  }

  function renderAspirasi(data) {
    const list = document.getElementById('aspirasiList');
    if (!data.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>Belum ada aspirasi</h3>
          <p>Jadilah yang pertama menyuarakan aspirasimu!</p>
          <a href="kirim-aspirasi.html" class="btn btn-primary" style="margin-top:1rem;">✍️ Kirim Aspirasi</a>
        </div>`;
      return;
    }

    list.innerHTML = data.map((a, i) => `
      <div class="aspirasi-card" style="animation-delay:${i * 0.05}s" onclick="openModal(${a.id})">
        <div class="card-top">
          <div class="card-top-left">
            <div class="card-title">${escHtml(a.judul)}</div>
            <div class="card-meta">
              <span class="chip" style="color:${a.kategori_warna};border-color:${a.kategori_warna}">
                ${a.kategori_nama}
              </span>
              ${statusBadge(a.status)}
              <span>👤 ${escHtml(a.pengirim)}</span>
              <span>🕐 ${formatDate(a.created_at)}</span>
            </div>
          </div>
        </div>
        <div class="card-body">${escHtml(truncate(a.isi, 180))}</div>
        <div class="card-footer">
          <div class="card-footer-left">
            <button
              class="vote-btn ${userVotes[a.id] ? 'voted' : ''}"
              id="voteBtn-${a.id}"
              onclick="toggleVote(event, ${a.id})"
            >
              ▲ <span id="voteCount-${a.id}">${a.vote_count}</span>
            </button>
          </div>
          <span class="text-sm text-muted">Klik untuk detail →</span>
        </div>
      </div>
    `).join('');
  }

  function renderPagination({ page, totalPages }) {
    const pg = document.getElementById('pagination');
    if (totalPages <= 1) { pg.innerHTML = ''; return; }

    let html = '';
    html += `<button class="page-btn" onclick="loadAspirasi(${page-1})" ${page<=1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${i===page?'active':''}" onclick="loadAspirasi(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="loadAspirasi(${page+1})" ${page>=totalPages?'disabled':''}>›</button>`;
    pg.innerHTML = html;
  }

  // ── Voting ─────────────────────────────────────────────
  window.toggleVote = async (e, id) => {
    e.stopPropagation();
    if (!Auth.isLoggedIn()) {
      toast('Login dulu untuk memberikan vote.', 'info');
      return;
    }
    const btn = document.getElementById(`voteBtn-${id}`);
    btn.disabled = true;

    const res = await api.post(`/voting/${id}`, {});
    if (res?.success) {
      userVotes[id] = res.action === 'voted';
      btn.className = `vote-btn ${userVotes[id] ? 'voted' : ''}`;
      document.getElementById(`voteCount-${id}`).textContent = res.vote_count;
    } else {
      toast(res?.message || 'Gagal.', 'error');
    }
    btn.disabled = false;
  };

  // ── Modal Detail ───────────────────────────────────────
  window.openModal = async (id) => {
    const modal   = document.getElementById('detailModal');
    const content = document.getElementById('modalContent');
    modal.style.display = 'flex';
    content.innerHTML = '<div class="flex-center" style="padding:3rem;"><div class="spinner" style="width:28px;height:28px;border-width:3px;"></div></div>';

    const res = await api.get(`/aspirasi/${id}`);
    if (!res?.success) {
      content.innerHTML = '<p class="text-muted">Gagal memuat detail.</p>';
      return;
    }
    const a = res.data;

    const riwayat = (a.riwayat || []).map((r, i) => `
      <div class="timeline-item ${i === a.riwayat.length - 1 ? 'current' : ''}">
        <div class="timeline-date">${formatDate(r.created_at)}</div>
        <div class="timeline-label">
          ${r.status_lama ? `${r.status_lama} → ` : ''}${r.status_baru}
          <span class="text-muted text-sm"> · oleh ${escHtml(r.oleh)}</span>
        </div>
        ${r.catatan ? `<div class="timeline-note">${escHtml(r.catatan)}</div>` : ''}
      </div>
    `).join('');

    content.innerHTML = `
      <div class="modal-header">
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.75rem;">
          <span class="chip" style="color:${a.kategori_warna};border-color:${a.kategori_warna}">${a.kategori_nama}</span>
          ${statusBadge(a.status)}
        </div>
        <h2 class="modal-title">${escHtml(a.judul)}</h2>
        <div class="card-meta" style="font-size:.82rem;">
          <span>👤 ${escHtml(a.pengirim)}</span>
          <span>🕐 ${formatDate(a.created_at)}</span>
          <span>▲ ${a.vote_count} vote</span>
        </div>
      </div>
      <p style="color:var(--text-muted);line-height:1.8;white-space:pre-wrap;">${escHtml(a.isi)}</p>
      ${riwayat ? `<div style="margin-top:1.5rem;"><h4 style="margin-bottom:.75rem;">Riwayat Status</h4><div class="timeline">${riwayat}</div></div>` : ''}
    `;
  };

  window.closeModal = () => {
    document.getElementById('detailModal').style.display = 'none';
  };
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // ── My Aspirasi ────────────────────────────────────────
  document.getElementById('myAspirasiLink')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
    const panel = document.getElementById('myPanel');
    panel.style.display = 'block';

    const res = await api.get('/aspirasi/saya');
    const el  = document.getElementById('myAspirasiList');
    if (!res?.success || !res.data.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:2rem;">
          <div class="empty-state-icon">📋</div>
          <p>Belum ada aspirasi yang kamu kirim.</p>
          <a href="kirim-aspirasi.html" class="btn btn-primary btn-sm" style="margin-top:1rem;">Kirim Sekarang</a>
        </div>`;
      return;
    }
    el.innerHTML = res.data.map(a => `
      <div class="my-aspirasi-item" onclick="closePanel();openModal(${a.id})">
        <div style="font-weight:500;font-size:.9rem;margin-bottom:.3rem;">${escHtml(truncate(a.judul, 60))}</div>
        <div style="display:flex;gap:.5rem;align-items:center;">
          <span class="chip" style="color:${a.kategori_warna};border-color:${a.kategori_warna};font-size:.72rem;">${a.kategori_nama}</span>
          ${statusBadge(a.status)}
        </div>
        <div class="text-sm text-muted" style="margin-top:.3rem;">▲ ${a.vote_count} · ${formatDate(a.created_at)}</div>
      </div>`).join('');
  });
  window.closePanel = () => { document.getElementById('myPanel').style.display = 'none'; };

  // ── Notifikasi ─────────────────────────────────────────
  async function loadNotifikasi() {
    const res = await api.get('/admin/notifikasi');
    if (!res?.success) return;
    const badge = document.getElementById('notifBadge');
    badge.style.display = res.unread > 0 ? 'flex' : 'none';
    badge.textContent = res.unread;
    window._notifData = res.data;
  }

  document.getElementById('notifBtn')?.addEventListener('click', () => {
    const dd = document.getElementById('notifDropdown');
    if (dd.style.display !== 'none') { dd.style.display = 'none'; return; }

    const data = window._notifData || [];
    dd.innerHTML = `
      <div class="notif-header">🔔 Notifikasi</div>
      ${data.length ? data.slice(0,8).map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markRead(${n.id})">
          <div class="notif-item-title">${escHtml(n.judul)}</div>
          <div class="notif-item-msg">${escHtml(n.pesan)}</div>
          <div class="notif-item-time">${formatDate(n.created_at)}</div>
        </div>
      `).join('') : '<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.88rem;">Tidak ada notifikasi</div>'}
    `;
    dd.style.display = 'block';
  });

  window.markRead = async (id) => {
    await api.patch(`/admin/notifikasi/${id}/read`, {});
    loadNotifikasi();
  };

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('notifDropdown');
    if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) {
      dd.style.display = 'none';
    }
  });

  // ── Filter Events ──────────────────────────────────────
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadAspirasi(1), 500);
  });
  document.getElementById('filterKategori').addEventListener('change', () => loadAspirasi(1));
  document.getElementById('filterStatus').addEventListener('change',   () => loadAspirasi(1));

  // ── Expose globals ─────────────────────────────────────
  window.loadAspirasi = loadAspirasi;

  // ── Init ───────────────────────────────────────────────
  loadAspirasi(1);

  // ── Helpers ────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();