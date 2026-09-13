(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const ROLE_KEY = 'acj_intervenantes_role';
  const ADMIN_SELECTOR = '.acjPlanningAdd,#acjDayAdd,#acjEditSave,#acjCancelService,.acjReplaceOpen,.acjReplacePanel';
  let role = '';
  let observer = null;
  let checking = false;
  let confirmed = false;

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }
  function navItems() {
    return [...document.querySelectorAll('.bottomNav .navItem')];
  }
  function openAuthenticatedApp() {
    const login = document.getElementById('login');
    const app = document.getElementById('app');
    const status = document.getElementById('loginStatus');
    if (login) login.hidden = true;
    if (app) app.hidden = false;
    if (status) status.textContent = '';
  }
  function roleHide(node, { disable = false } = {}) {
    if (!node) return;
    if (!node.hidden) {
      node.dataset.acjRoleHidden = '1';
      node.hidden = true;
    }
    if (disable && 'disabled' in node && !node.disabled) {
      node.dataset.acjRoleDisabled = '1';
      node.disabled = true;
    }
  }
  function roleRestore(node) {
    if (!node) return;
    if (node.dataset.acjRoleHidden === '1') {
      node.hidden = false;
      delete node.dataset.acjRoleHidden;
    }
    if ('disabled' in node && node.dataset.acjRoleDisabled === '1') {
      node.disabled = false;
      delete node.dataset.acjRoleDisabled;
    }
  }
  function lockOwnEmployee() {
    const select = document.getElementById('employee');
    if (!select) return;
    const realOptions = [...select.options].filter((option) => option.value);
    if (realOptions.length === 1) {
      const value = realOptions[0].value;
      const changed = select.value !== value;
      select.value = value;
      localStorage.setItem('acj_intervenantes_employee', value);
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!select.disabled) {
      select.dataset.acjRoleDisabled = '1';
      select.disabled = true;
    }
    const badge = document.querySelector('.pilotBadge');
    if (badge) badge.textContent = 'Mon planning';
  }
  function hideAdminUi() {
    const nav = navItems();
    if (nav[1]) {
      if (nav[1].classList.contains('active')) {
        nav[1].dataset.acjRoleActive = '1';
        nav[1].classList.remove('active');
      }
      roleHide(nav[1], { disable: true });
    }
    roleHide(document.getElementById('acjPlanningMonthPanel'));
    document.querySelectorAll(ADMIN_SELECTOR).forEach((node) => roleHide(node, { disable: true }));
    lockOwnEmployee();
  }
  function showAdminUi() {
    const nav = navItems();
    if (nav[1]) {
      roleRestore(nav[1]);
      if (nav[1].dataset.acjRoleActive === '1') {
        nav[1].classList.add('active');
        delete nav[1].dataset.acjRoleActive;
      }
    }
    roleRestore(document.getElementById('employee'));
    roleRestore(document.getElementById('acjPlanningMonthPanel'));
    document.querySelectorAll(ADMIN_SELECTOR).forEach(roleRestore);
    const badge = document.querySelector('.pilotBadge');
    if (badge) badge.textContent = 'Mode admin';
  }
  function apply(nextRole) {
    role = nextRole === 'admin' ? 'admin' : 'intervenante';
    window.ACJ_INTERVENANTES_ROLE = role;
    localStorage.setItem(ROLE_KEY, role);
    document.documentElement.dataset.acjIntervenantesRole = role;
    if (role === 'admin') showAdminUi();
    else hideAdminUi();

    if (!observer) {
      observer = new MutationObserver(() => {
        if (role === 'admin') return;
        hideAdminUi();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  async function checkRole() {
    if (checking || confirmed) return;
    const currentToken = token();
    if (!currentToken) return;
    checking = true;
    try {
      const response = await fetch(`${API}?action=role`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
      apply(data?.role);
      confirmed = true;
      openAuthenticatedApp();
    } catch {
      apply('intervenante');
    } finally {
      checking = false;
    }
  }

  function init() {
    apply('intervenante');
    checkRole();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      checkRole();
      if (attempts >= 40 || confirmed) clearInterval(timer);
    }, 500);

    document.addEventListener('click', (event) => {
      if (role === 'admin') return;
      const nav = navItems();
      if (nav[1] && (event.target === nav[1] || nav[1].contains(event.target))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
