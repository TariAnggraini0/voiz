// frontend/js/api.js
// ─────────────────────────────────────────────────────────────
//  Central fetch wrapper — semua request ke backend Voiz API
//  Otomatis menyisipkan Authorization header dari localStorage
// ─────────────────────────────────────────────────────────────

const API_BASE = 'http://voiz-production.up.railway.app/api';

// ── Token helpers ─────────────────────────────────────────
const Auth = {
  getToken: ()       => localStorage.getItem('voiz_token'),
  getUser:  ()       => JSON.parse(localStorage.getItem('voiz_user') || 'null'),
  save:     (token, user) => {
    localStorage.setItem('voiz_token', token);
    localStorage.setItem('voiz_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('voiz_token');
    localStorage.removeItem('voiz_user');
  },
  isLoggedIn: () => !!localStorage.getItem('voiz_token'),
  requireAuth: (redirectTo = 'login.html') => {
    if (!localStorage.getItem('voiz_token')) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },
  requireRole: (role, redirectTo = 'dashboard.html') => {
    const user = JSON.parse(localStorage.getItem('voiz_user') || 'null');
    if (!user || user.role !== role) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },
};

// ── Core fetch wrapper ────────────────────────────────────
async function request(method, endpoint, data = null, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers, ...opts };
  if (data) config.body = JSON.stringify(data);

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const json = await res.json().catch(() => ({ success: false, message: 'Gagal membaca respons.' }));

  if (res.status === 401) {
    Auth.clear();
    window.location.href = 'login.html';
    return;
  }

  return { ok: res.ok, status: res.status, ...json };
}

const api = {
  get:    (url)        => request('GET',    url),
  post:   (url, data)  => request('POST',   url, data),
  patch:  (url, data)  => request('PATCH',  url, data),
  put:    (url, data)  => request('PUT',    url, data),
  delete: (url)        => request('DELETE', url),
};

// ── Toast utility ─────────────────────────────────────────
function toast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all .3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Status badge helper ────────────────────────────────────
function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

// ── Format tanggal ─────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Truncate teks ──────────────────────────────────────────
function truncate(str, n = 100) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}
