(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const ROLE_KEY = 'acj_intervenantes_role';
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
    select.disabled = true;
    const badge = document.querySelector('.pilotBadge');
    if (badge) badge.textContent = 'Mon planning';
  }
  function hideAdminUi() {
    const nav = navItems();
    if (nav[1]) {
      nav[1].hidden = true;
      nav[1].disabled = true;
      nav[1].classList.remove('active');
    }
    const panel = document.getElementById('acjPlanningMonthPanel');
    if (panel) panel.hidden = true;
    document.querySelectorAll('.acjPlanningAdd,#acjDayAdd,#acjEditSave,#acjCancelService,.acjReplaceOpen,.acjReplacePanel').forEach((node) => {
      node.hidden = true;
      if ('disabled' in node) node.disabled = true;
    });
    lockOwnEmployee();
  }
  function showAdminUi() {
    const nav = navItems();
    if (nav[1]) {
      nav[1].hidden = false;
      nav[1].disabled = false;
    }
    const select = document.getElementById('employee');
    if (select) select.disabled = false;
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