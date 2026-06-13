// frontend/js/admin.js
// ─────────────────────────────────────────────────────────────
//  Admin Dashboard Logic — Voiz
// ─────────────────────────────────────────────────────────────

(async () => {
  // ── Auth Guard ─────────────────────────────────────────
  if (!Auth.requireAuth('login.html')) return;
  Auth.requireRole('admin', 'dashboard.html');

  const user = Auth.getUser();
  document.getElementById('adminName').textContent = user?.nama || '';

  // ── View Switcher ──────────────────────────────────────
  window.showView = (name, btn) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${name}`)?.classList.add('active');
    if (btn) btn.classList.add('active');

    if (name === 'aspirasi')   loadAdminAspirasi();
    if (name === 'notifikasi') loadAdminNotif();
  };

  window.filterByStatus = (status) => {
    document.getElementById('adminStatusFilter').value = status;
    showView('aspirasi', null);
  };

  // ──────────────────────────────────────────────────────
  //  OVERVIEW — Stats & Charts
  // ──────────────────────────────────────────────────────
  async function loadOverview() {
    const res = await api.get('/admin/stats');
    if (!res?.success) { toast('Gagal memuat statistik.', 'error'); return; }
    const d = res.data;

    // Status map
    const sm = d.statusStats.reduce((acc, r) => { acc[r.status] = r.total; return acc; }, {});

    // Stat Cards
    const cards = [
      { icon: '📥', num: d.total,          label: 'Total Aspirasi',  color: 'var(--accent)' },
      { icon: '⏳', num: sm.menunggu || 0, label: 'Menunggu',        color: 'var(--status-menunggu)' },
      { icon: '⚙️', num: sm.diproses || 0, label: 'Diproses',        color: 'var(--status-diproses)' },
      { icon: '✅', num: sm.selesai  || 0, label: 'Selesai',         color: 'var(--status-selesai)' },
      { icon: '👥', num: d.totalUser,      label: 'Mahasiswa',       color: 'var(--blue)' },
    ];
    document.getElementById('statsGrid').innerHTML = cards.map(c => `
      <div class="stat-card">
        <div class="stat-card-icon">${c.icon}</div>
        <div class="stat-card-num" style="color:${c.color}">${c.num}</div>
        <div class="stat-card-label">${c.label}</div>
      </div>
    `).join('');

    // Trend Chart
    const trendLabels = d.tren.map(t => {
      const [y, m] = t.bulan.split('-');
      return new Date(y, m-1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    });
    new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: 'Aspirasi',
          data: d.tren.map(t => t.total),
          borderColor: '#f5a623',
          backgroundColor: 'rgba(245,166,35,.12)',
          tension: .4,
          fill: true,
          pointBackgroundColor: '#f5a623',
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#252836' }, ticks: { color: '#8891aa' } },
          y: { grid: { color: '#252836' }, ticks: { color: '#8891aa', stepSize: 1 } },
        }
      }
    });

    // Kategori Donut
    new Chart(document.getElementById('katChart'), {
      type: 'doughnut',
      data: {
        labels: d.kategoriStats.map(k => k.nama),
        datasets: [{
          data: d.kategoriStats.map(k => k.total),
          backgroundColor: d.kategoriStats.map(k => k.warna + 'cc'),
          borderColor: d.kategoriStats.map(k => k.warna),
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8891aa', padding: 16, font: { size: 12 } } }
        },
        cutout: '65%',
      }
    });

    // Top Vote
    const tvEl = document.getElementById('topVoteList');
    if (!d.topVote.length) {
      tvEl.innerHTML = '<p class="text-muted text-sm">Belum ada aspirasi.</p>';
    } else {
      tvEl.innerHTML = d.topVote.map((a, i) => `
        <div style="display:flex;align-items:center;gap:.75rem;padding:.7rem 0;border-bottom:1px solid var(--border);">
          <span style="font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--text-dim);min-width:24px;">#${i+1}</span>
          <div style="flex:1;">
            <div style="font-size:.92rem;font-weight:500;">${escHtml(a.judul)}</div>
            <div style="font-size:.78rem;color:var(--text-muted);">${a.kategori}</div>
          </div>
          <span style="color:var(--accent);font-weight:600;">▲ ${a.vote_count}</span>
        </div>
      `).join('');
    }
  }

  // ──────────────────────────────────────────────────────
  //  ASPIRASI — Tabel kelola
  // ──────────────────────────────────────────────────────
  let adminPage = 1;

  window.loadAdminAspirasi = async (page) => {
    if (page) adminPage = page;
    const status = document.getElementById('adminStatusFilter')?.value || '';
    const tbody  = document.getElementById('adminAspirasiBody');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;"><div class="spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;"></div></td></tr>`;

    const res = await api.get(`/admin/aspirasi?page=${adminPage}&limit=15${status ? '&status='+status : ''}`);
    if (!res?.success) { tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center" style="padding:2rem;">Gagal memuat.</td></tr>`; return; }

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Tidak ada aspirasi.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(a => `
      <tr>
        <td style="max-width:260px;">
          <div style="font-weight:500;font-size:.9rem;">${escHtml(truncate(a.judul, 65))}</div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-top:.2rem;">${formatDate(a.created_at)}</div>
        </td>
        <td>
          <span style="font-size:.8rem;color:${a.kategori_warna};">● ${a.kategori_nama}</span>
        </td>
        <td style="font-size:.85rem;">${escHtml(a.pengirim)}</td>
        <td style="font-weight:600;color:var(--accent);">▲ ${a.vote_count}</td>
        <td>${statusBadgeAdmin(a.status)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openStatusModal(${a.id},'${escHtml(a.judul)}','${a.status}')">
            Update
          </button>
        </td>
      </tr>
    `).join('');

    // Pagination
    const { page, totalPages } = res.pagination;
    const pg = document.getElementById('adminPagination');
    if (totalPages <= 1) { pg.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="loadAdminAspirasi(${page-1})" ${page<=1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${i===page?'active':''}" onclick="loadAdminAspirasi(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="loadAdminAspirasi(${page+1})" ${page>=totalPages?'disabled':''}>›</button>`;
    pg.innerHTML = html;
  };

  // ──────────────────────────────────────────────────────
  //  STATUS MODAL
  // ──────────────────────────────────────────────────────
  window.openStatusModal = (id, judul, currentStatus) => {
    const modal   = document.getElementById('statusModal');
    const content = document.getElementById('statusModalContent');
    modal.style.display = 'flex';

    const statuses = ['diterima','diproses','selesai','ditolak'];
    content.innerHTML = `
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:1.25rem;">
        ID #${id} — <strong>${escHtml(judul)}</strong>
      </p>
      <div class="form-group">
        <label class="form-label">Status Baru</label>
        <select id="newStatus" class="form-control">
          ${statuses.map(s => `<option value="${s}" ${s===currentStatus?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-top:1rem;">
        <label class="form-label">Catatan (opsional)</label>
        <textarea id="statusCatatan" class="form-control" rows="3" placeholder="Catatan atau alasan…"></textarea>
      </div>
      <div class="form-group" style="margin-top:1rem;">
        <label class="form-label">Prioritas</label>
        <select id="newPrioritas" class="form-control">
          <option value="">— Tidak ubah —</option>
          <option value="rendah">Rendah</option>
          <option value="sedang">Sedang</option>
          <option value="tinggi">Tinggi</option>
        </select>
      </div>
      <div style="display:flex;gap:.75rem;margin-top:1.5rem;">
        <button class="btn btn-ghost" onclick="document.getElementById('statusModal').style.display='none'">Batal</button>
        <button class="btn btn-primary" style="flex:1;" onclick="submitStatusUpdate(${id})">Simpan Perubahan</button>
      </div>
    `;
  };

  window.submitStatusUpdate = async (id) => {
    const status   = document.getElementById('newStatus').value;
    const catatan  = document.getElementById('statusCatatan').value;
    const prioritas = document.getElementById('newPrioritas').value;

    const body = { status };
    if (catatan)   body.catatan  = catatan;
    if (prioritas) body.prioritas = prioritas;

    const res = await api.patch(`/admin/aspirasi/${id}/status`, body);
    if (res?.success) {
      toast('Status berhasil diperbarui.', 'success');
      document.getElementById('statusModal').style.display = 'none';
      loadAdminAspirasi();
    } else {
      toast(res?.message || 'Gagal update.', 'error');
    }
  };

  // ──────────────────────────────────────────────────────
  //  NOTIFIKASI
  // ──────────────────────────────────────────────────────
  async function loadAdminNotif() {
    const res = await api.get('/admin/notifikasi');
    const el  = document.getElementById('adminNotifList');
    if (!res?.success || !res.data.length) {
      el.innerHTML = '<div class="text-muted text-center" style="padding:2rem;">Tidak ada notifikasi.</div>';
      return;
    }
    el.innerHTML = res.data.map(n => `
      <div class="card ${n.is_read ? '' : 'card-elevated'}" style="cursor:pointer;" onclick="markAdminRead(${n.id})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;">
          <div>
            <div style="font-weight:600;font-size:.9rem;${n.is_read ? 'color:var(--text-muted)' : ''}">${escHtml(n.judul)}</div>
            <div style="font-size:.85rem;color:var(--text-muted);margin-top:.3rem;">${escHtml(n.pesan)}</div>
            <div style="font-size:.75rem;color:var(--text-dim);margin-top:.4rem;">${formatDate(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:.3rem;"></span>' : ''}
        </div>
      </div>
    `).join('');
  }
  window.markAdminRead = async (id) => {
    await api.patch(`/admin/notifikasi/${id}/read`, {});
    loadAdminNotif();
  };

  // ──────────────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────────────
  function statusBadgeAdmin(status) {
    return `<span class="badge badge-${status}">${status}</span>`;
  }
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ───────────────────────────────────────────────
  loadOverview();
})();