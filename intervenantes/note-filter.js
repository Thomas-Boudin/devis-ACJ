(() => {
  const head = document.head || document.getElementsByTagName('head')[0];
  if (head && !document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = './manifest.webmanifest?v=20260912-1';
    head.appendChild(manifest);
  }
  if (head && !document.querySelector('link[rel="apple-touch-icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'apple-touch-icon';
    icon.href = './acj-intervenantes-icon-192.png?v=20260912-1';
    head.appendChild(icon);
  }
  if (head && !document.querySelector('meta[name="mobile-web-app-capable"]')) {
    const capable = document.createElement('meta');
    capable.name = 'mobile-web-app-capable';
    capable.content = 'yes';
    head.appendChild(capable);
  }
  if (head && !document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const appleCapable = document.createElement('meta');
    appleCapable.name = 'apple-mobile-web-app-capable';
    appleCapable.content = 'yes';
    head.appendChild(appleCapable);
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./notification-sw.js?v=20260912-pwa1', { scope: './' }).catch(() => {});
    }, { once: true });
  }
})();

window.meaningfulOgustNote = function (value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const technical = new Set(['N', '0', 'FALSE', 'NON', 'NONE', 'NULL']);
  return technical.has(text.toUpperCase()) ? '' : text;
};

(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const EMPLOYEE_KEY = 'acj_intervenantes_employee';
  const SESSION_PREFIX = 'acjs1.';
  const nativeFetch = window.fetch.bind(window);
  let exchangePromise = null;

  function urlOf(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return String(input?.url || '');
  }

  function saveSession(token) {
    if (!String(token || '').startsWith(SESSION_PREFIX)) return;
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('acj_intervenantes_role');
  }

  const remembered = localStorage.getItem(TOKEN_KEY) || '';
  if (remembered.startsWith(SESSION_PREFIX)) {
    sessionStorage.setItem(TOKEN_KEY, remembered);
  }

  async function exchangeGoogleToken(googleToken) {
    if (exchangePromise) return exchangePromise;
    exchangePromise = (async () => {
      try {
        const response = await nativeFetch(`${API}?action=session`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.token) return '';
        saveSession(data.token);
        if (data?.role) localStorage.setItem('acj_intervenantes_role', data.role);
        return data.token;
      } catch {
        return '';
      }
    })();
    try { return await exchangePromise; }
    finally { exchangePromise = null; }
  }

  window.fetch = async function (input, init = {}) {
    const url = urlOf(input);
    if (!url.startsWith(API) || url.includes('action=session')) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const auth = headers.get('Authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    let bearer = match ? match[1] : '';

    if (bearer && !bearer.startsWith(SESSION_PREFIX)) {
      const session = await exchangeGoogleToken(bearer);
      if (session) {
        bearer = session;
        headers.set('Authorization', `Bearer ${session}`);
        init = { ...init, headers };
      }
    }

    const response = await nativeFetch(input, init);
    if (response.status === 401 && bearer.startsWith(SESSION_PREFIX)) clearSession();
    return response;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const employee = document.getElementById('employee');
    const logout = document.getElementById('logout');

    employee?.addEventListener('change', () => {
      if (employee.value) localStorage.setItem(EMPLOYEE_KEY, employee.value);
    });

    logout?.addEventListener('click', clearSession, { capture: true });

    const persistentSession = localStorage.getItem(TOKEN_KEY) || '';
    if (persistentSession.startsWith(SESSION_PREFIX) && typeof window.loadConfig === 'function') {
      const status = document.getElementById('loginStatus');
      if (status) status.textContent = 'Ouverture de votre espace…';

      const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('STARTUP_TIMEOUT')), ms))
      ]);

      const openPersistentSession = async (attempt = 0) => {
        try {
          await withTimeout(window.loadConfig(), 12000);
          const savedEmployee = localStorage.getItem(EMPLOYEE_KEY) || '';
          if (savedEmployee && employee && [...employee.options].some((option) => option.value === savedEmployee)) {
            employee.value = savedEmployee;
          }

          const login = document.getElementById('login');
          const app = document.getElementById('app');
          if (login) login.hidden = true;
          if (app) app.hidden = false;
          if (status) {
            status.textContent = '';
            status.onclick = null;
            status.style.cursor = '';
          }

          const datePicker = document.getElementById('datePicker');
          const currentDate = datePicker?.value || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(new Date());

          if (typeof window.setDate === 'function') window.setDate(currentDate);
          else if (employee?.value && typeof window.loadPlanning === 'function') window.loadPlanning();
        } catch (error) {
          const code = String(error?.message || '');
          if (['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_FORBIDDEN'].includes(code)) {
            clearSession();
            if (status) status.textContent = 'Votre session a expiré. Reconnectez-vous avec Google.';
            return;
          }
          if (attempt < 1) {
            if (status) status.textContent = 'Connexion à Ogust… nouvelle tentative.';
            setTimeout(() => openPersistentSession(attempt + 1), 800);
            return;
          }
          if (status) {
            status.textContent = 'Chargement trop long. Touchez ici pour réessayer.';
            status.style.cursor = 'pointer';
            status.onclick = () => {
              status.onclick = null;
              status.style.cursor = '';
              status.textContent = 'Ouverture de votre espace…';
              openPersistentSession(0);
            };
          }
        }
      };

      setTimeout(() => openPersistentSession(0), 0);
    }

    const roleGuardLoaded = [...document.scripts].some((script) => /(?:^|\/)role-guard\.js(?:$|\?)/.test(script.src));
    if (!roleGuardLoaded) {
      const script = document.createElement('script');
      script.src = './role-guard.js?v=20260911-1';
      script.dataset.acjRoleGuard = '1';
      document.body.appendChild(script);
    }

    const alreadyLoaded = [...document.scripts].some((script) => /(?:^|\/)pointage-local\.js(?:$|\?)/.test(script.src));
    if (!alreadyLoaded) {
      const script = document.createElement('script');
      script.src = './pointage-local.js';
      script.dataset.acjPointageLocal = '1';
      document.body.appendChild(script);
    }

    const liaisonLoaded = [...document.scripts].some((script) => /(?:^|\/)liaison-local\.js(?:$|\?)/.test(script.src));
    if (!liaisonLoaded) {
      const script = document.createElement('script');
      script.src = './liaison-local.js';
      script.dataset.acjLiaisonLocal = '1';
      document.body.appendChild(script);
    }

    const planningLoaded = [...document.scripts].some((script) => /(?:^|\/)planning-month\.js(?:$|\?)/.test(script.src));
    if (!planningLoaded) {
      const script = document.createElement('script');
      script.src = './planning-month.js?v=20260911-2';
      script.dataset.acjPlanningMonth = '1';
      document.body.appendChild(script);
    }

    const planningVisualLoaded = [...document.scripts].some((script) => /(?:^|\/)planning-visual\.js(?:$|\?)/.test(script.src));
    if (!planningVisualLoaded) {
      const script = document.createElement('script');
      script.src = './planning-visual.js?v=20260911-1';
      script.dataset.acjPlanningVisual = '1';
      document.body.appendChild(script);
    }

    const planningDndLoaded = [...document.scripts].some((script) => /(?:^|\/)planning-dnd\.js(?:$|\?)/.test(script.src));
    if (!planningDndLoaded) {
      const script = document.createElement('script');
      script.src = './planning-dnd.js?v=20260911-1';
      script.dataset.acjPlanningDnd = '1';
      document.body.appendChild(script);
    }

    const planningCancelLoaded = [...document.scripts].some((script) => /(?:^|\/)planning-cancel\.js(?:$|\?)/.test(script.src));
    if (!planningCancelLoaded) {
      const script = document.createElement('script');
      script.src = './planning-cancel.js?v=20260911-1';
      script.dataset.acjPlanningCancel = '1';
      document.body.appendChild(script);
    }

    const planningReplacementLoaded = [...document.scripts].some((script) => /(?:^|\/)planning-replacement\.js(?:$|\?)/.test(script.src));
    if (!planningReplacementLoaded) {
      const script = document.createElement('script');
      script.src = './planning-replacement.js?v=20260912-1';
      script.dataset.acjPlanningReplacement = '1';
      document.body.appendChild(script);
    }

    const notificationsLoaded = [...document.scripts].some((script) => /(?:^|\/)notifications-local\.js(?:$|\?)/.test(script.src));
    if (!notificationsLoaded) {
      const script = document.createElement('script');
      script.src = './notifications-local.js?v=20260909-4';
      script.dataset.acjNotificationsLocal = '1';
      document.body.appendChild(script);
    }
  });
})();
