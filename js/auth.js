// frontend/js/auth.js
// ─────────────────────────────────────────────────────────────
//  Auth Helper — Voiz Frontend
//  TAHAP 1: Setup, Guard & Navbar Sync
// ─────────────────────────────────────────────────────────────

// ============================================================
//  1. NAVBAR SYNC
// ============================================================
function initNavbar() {
  const navActions = document.getElementById('navActions');
  if (!navActions) return;

  if (Auth.isLoggedIn()) {
    const user    = Auth.getUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'pimpinan';

    navActions.innerHTML = `
      <div class="nav-user-info">
        <div class="nav-avatar">${getInitials(user?.nama)}</div>
        <span class="nav-name">${user?.nama?.split(' ')[0] || 'User'}</span>
      </div>
      <a href="${isAdmin ? 'admin.html' : 'dashboard.html'}"
         class="btn btn-ghost btn-sm">
        ${isAdmin ? '⚙️ Admin' : '📋 Dashboard'}
      </a>
      <button class="btn btn-ghost btn-sm" onclick="logoutConfirm()">Keluar</button>
    `;
  } else {
    navActions.innerHTML = `
      <a href="login.html"    class="btn btn-ghost btn-sm">Login</a>
      <a href="register.html" class="btn btn-primary btn-sm">Daftar</a>
    `;
  }
}

// ============================================================
//  2. GUARD — Proteksi halaman
// ============================================================

/**
 * Pastikan user sudah login. Opsional cek role.
 * guardAuth()           — hanya perlu login
 * guardAuth('admin')    — harus role admin
 * guardAuth(['admin','pimpinan']) — salah satu role
 */
function guardAuth(requiredRole = null) {
  if (!Auth.isLoggedIn()) {
    sessionStorage.setItem('voiz_redirect', window.location.href);
    window.location.href = 'login.html';
    return false;
  }

  if (requiredRole) {
    const user    = Auth.getUser();
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user?.role)) {
      toast('Akses ditolak. Kamu tidak memiliki izin halaman ini.', 'error');
      setTimeout(() => {
        window.location.href = user?.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }, 1500);
      return false;
    }
  }
  return true;
}

/** Halaman guest-only (login/register) — redirect jika sudah login */
function guardGuest() {
  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    window.location.href = user?.role === 'admin' ? 'admin.html' : 'dashboard.html';
    return false;
  }
  return true;
}

// ============================================================
//  3. LOGOUT
// ============================================================
function logoutConfirm() {
  if (!confirm('Yakin ingin keluar dari Voiz?')) return;
  logout();
}

function logout() {
  VoteState?.clear();   // bersihkan cache vote jika ada
  Auth.clear();
  showToastThenRedirect('Berhasil keluar. Sampai jumpa! 👋', 'info', 'login.html');
}

// ============================================================
//  4. REDIRECT SETELAH LOGIN
// ============================================================
function redirectAfterLogin(userRole) {
  const saved = sessionStorage.getItem('voiz_redirect');
  sessionStorage.removeItem('voiz_redirect');

  if (saved && !saved.includes('login.html') && !saved.includes('register.html')) {
    window.location.href = saved;
  } else {
    window.location.href = userRole === 'admin' ? 'admin.html' : 'dashboard.html';
  }
}

// ============================================================
//  5. VERIFIKASI SESSION KE SERVER
// ============================================================

/** Ping /auth/me untuk pastikan token masih valid */
async function verifySession() {
  if (!Auth.isLoggedIn()) return false;
  try {
    const res = await api.get('/auth/me');
    if (res?.success) {
      const stored = Auth.getUser();
      Auth.save(Auth.getToken(), { ...stored, ...res.user });
      return true;
    } else {
      Auth.clear();
      return false;
    }
  } catch (_) {
    return false;
  }
}

/** Jalankan pengecekan sesi setiap 5 menit */
function startSessionWatcher() {
  if (!Auth.isLoggedIn()) return;
  setInterval(async () => {
    const valid = await verifySession();
    if (!valid) {
      toast('Sesi kamu sudah berakhir. Silakan login kembali.', 'error');
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    }
  }, 5 * 60 * 1000);
}

// ============================================================
//  6. FORM GANTI PASSWORD
// ============================================================

/**
 * Render form ganti password ke dalam container el.
 * Contoh pemakaian:
 *   renderChangePasswordForm(document.getElementById('profileBox'))
 */
function renderChangePasswordForm(container) {
  container.innerHTML = `
    <form id="changePasswordForm" style="display:flex;flex-direction:column;gap:1rem;">
      <div class="form-group">
        <label class="form-label">Password Lama</label>
        <div class="input-eye">
          <input type="password" id="oldPassword" class="form-control"
                 placeholder="Password saat ini" required/>
          <button type="button" class="eye-btn" onclick="toggleFieldType('oldPassword')">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Password Baru</label>
        <div class="input-eye">
          <input type="password" id="newPassword" class="form-control"
                 placeholder="Min. 6 karakter" minlength="6" required/>
          <button type="button" class="eye-btn" onclick="toggleFieldType('newPassword')">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Konfirmasi Password Baru</label>
        <div class="input-eye">
          <input type="password" id="confirmNewPassword" class="form-control"
                 placeholder="Ulangi password baru" required/>
          <button type="button" class="eye-btn" onclick="toggleFieldType('confirmNewPassword')">👁</button>
        </div>
      </div>
      <div id="pwErrorBox" class="auth-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary" id="changePwBtn">Simpan Password</button>
    </form>
  `;

  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox    = document.getElementById('pwErrorBox');
    const btn       = document.getElementById('changePwBtn');
    const oldPw     = document.getElementById('oldPassword').value;
    const newPw     = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmNewPassword').value;

    errBox.style.display = 'none';

    if (newPw !== confirmPw) {
      errBox.textContent   = 'Password baru dan konfirmasi tidak cocok.';
      errBox.style.display = 'block';
      return;
    }

    btn.disabled    = true;
    btn.innerHTML   = '<span class="spinner"></span> Menyimpan…';

    const res = await api.patch('/auth/password', {
      old_password: oldPw,
      new_password: newPw,
    });

    if (res?.success) {
      toast('Password berhasil diperbarui!', 'success');
      container.innerHTML = `
        <div style="text-align:center;padding:2rem;">
          <div style="font-size:2.5rem;margin-bottom:.75rem;">✅</div>
          <p>Password sudah diperbarui.<br>Gunakan password baru untuk login berikutnya.</p>
        </div>`;
    } else {
      errBox.textContent   = res?.message || 'Gagal mengubah password.';
      errBox.style.display = 'block';
      btn.disabled         = false;
      btn.textContent      = 'Simpan Password';
    }
  });
}

// ============================================================
//  7. UTILITIES
// ============================================================

/** Inisial nama untuk avatar — "Budi Santoso" → "BS" */
function getInitials(nama) {
  if (!nama) return '?';
  return nama.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

/** Toast lalu redirect setelah delay */
function showToastThenRedirect(message, type = 'info', href = 'login.html', delay = 1200) {
  toast(message, type);
  setTimeout(() => { window.location.href = href; }, delay);
}

/** Label ramah untuk role */
function roleLabel(role) {
  const labels = { mahasiswa: 'Mahasiswa', admin: 'Admin BEM', pimpinan: 'Pimpinan' };
  return labels[role] || role;
}

/** Toggle show/hide password field */
function toggleFieldType(fieldId) {
  const inp = document.getElementById(fieldId);
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ============================================================
//  8. INJECT STYLE — Nav avatar
// ============================================================
(function injectAuthStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .nav-user-info {
      display: flex;
      align-items: center;
      gap: .45rem;
    }
    .nav-avatar {
      width: 30px; height: 30px;
      border-radius: 50%;
      background: var(--accent-glow);
      border: 1.5px solid var(--accent);
      color: var(--accent);
      font-size: .72rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .nav-name {
      font-size: .85rem;
      color: var(--text-muted);
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
})();