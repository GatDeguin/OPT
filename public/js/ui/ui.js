export function showToast(text = "Listo") {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

export function initUI() {
  const htmlEl = document.documentElement;
  const THEME_KEY = 'bp-theme';
  const savedTheme = localStorage.getItem(THEME_KEY);
  htmlEl.dataset.theme = savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const themeIcon = document.getElementById('themeIcon');
  function setIcon() {
    if (!themeIcon) return;
    themeIcon.innerHTML = (htmlEl.dataset.theme === 'dark')
      ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
      : '<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>';
  }
  setIcon();
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    htmlEl.dataset.theme = htmlEl.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, htmlEl.dataset.theme);
    setIcon();
  });

  const sections = {
    dashboard: document.getElementById('dashboardSection'),
    rutas: document.getElementById('rutasSection'),
    ordenes: document.getElementById('ordenesSection'),
    sucursales: document.getElementById('sucSection'),
    atms: document.getElementById('atmsSection'),
    cabeceras: document.getElementById('cabSection'),
    otros: document.getElementById('otrosSection'),
    choferes: document.getElementById('choferesSection'),
    camiones: document.getElementById('camionesSection'),
    costos: document.getElementById('costosSection'),
    reportes: document.getElementById('reportesSection'),
    config: document.getElementById('configSection'),
    about: document.getElementById('aboutSection')
  };
  const topTitleText = document.getElementById('topTitleText');
  document.getElementById('nav')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    const target = btn.dataset.target || 'dashboard';
    sections[target].classList.remove('hidden');
    topTitleText.textContent = btn.dataset.name || 'Dashboard';
    setTimeout(() => {
      try {
        if (window.routeMap) routeMap.invalidateSize();
        if (window.sucMap) sucMap.invalidateSize();
        if (window.atmMap) atmMap.invalidateSize();
      } catch (e) {}
    }, 80);
  });
}
