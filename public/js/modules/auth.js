import { showToast } from '../ui/ui.js';

export function initAuth() {
  const AUTH_KEY = 'bp-auth';
  const MAX_AGE = 1000 * 60 * 60 * 8; // 8 horas
  const USERS = {
    "1001@oper": { pwd: "oper123", name: "Operador", role: "oper" },
    "2001@super": { pwd: "super123", name: "Supervisor", role: "super" },
    "admin@tesoro": { pwd: "admin123", name: "Administrador", role: "admin" }
  };

  const appRoot = document.getElementById('appRoot');
  const loginView = document.getElementById('loginView');
  const loginForm = document.getElementById('loginForm');
  const userEl = document.getElementById('usuario');
  const passEl = document.getElementById('password');
  const err = document.getElementById('loginError');
  const remember = document.getElementById('remember');
  const userChip = document.getElementById('userChip');
  const logoutBtn = document.getElementById('logoutBtn');
  const splash = document.getElementById('splash');

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function setSession(s) {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    } catch (e) {
      // Fallback when storage is unavailable (e.g. private mode)
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (e) {
      // ignore
    }
  }

  function isSessionValid(s) {
    if (!s || !s.user) return false;
    const age = Date.now() - (s.ts || 0);
    if (s.remember) return true;
    return age < MAX_AGE;
  }

  function showApp() {
    loginView.classList.add('hidden');
    appRoot.classList.remove('hidden');
    appRoot.removeAttribute('aria-hidden');
    const s = getSession();
    if (userChip && s) {
      userChip.textContent = s.name || s.user;
      userChip.classList.remove('hidden');
    }
    // splash al ingresar
    splash.classList.add('is-open');
    // Leaflet sizing
    setTimeout(() => {
      try {
        if (window.routeMap) routeMap.invalidateSize();
      } catch (e) {
        /* ignore */
      }
    }, 200);
    setTimeout(() => {
      splash.classList.remove('is-open');
      splash.setAttribute('aria-hidden', 'true');
    }, 2400);
  }

  function showLogin() {
    appRoot.classList.add('hidden');
    appRoot.setAttribute('aria-hidden', 'true');
    loginView.classList.remove('hidden');
    if (err) err.textContent = '';
    userEl && userEl.focus();
  }

  function tryAuto() {
    const s = getSession();
    if (isSessionValid(s)) showApp(); else showLogin();
  }

  loginForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!userEl.value || !passEl.value) {
      err.textContent = 'Completá usuario y contraseña';
      return;
    }
    const u = (userEl.value || '').trim().toLowerCase();
    const p = passEl.value.trim();
    const ok = !!u && !!p && ((USERS[u] && USERS[u].pwd === p) || (!USERS[u] && p === 'bapro')); // fallback demo
    if (ok) {
      const profile = USERS[u] || { name: u, role: 'invitado' };
      setSession({ user: u, name: profile.name, role: profile.role, ts: Date.now(), remember: !!remember?.checked });
      passEl.value = '';
      showApp();
    } else {
      err.textContent = 'Usuario o contraseña inválidos';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    clearSession();
    showToast('Sesión cerrada');
    showLogin();
  });

  tryAuto();
}

