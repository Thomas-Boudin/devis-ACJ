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

      setTimeout(async () => {
        try {
          await window.loadConfig();
          const savedEmployee = localStorage.getItem(EMPLOYEE_KEY) || '';
          if (savedEmployee && employee && [...employee.options].some((option) => option.value === savedEmployee)) {
            employee.value = savedEmployee;
          }

          document.getElementById('login').hidden = true;
          document.getElementById('app').hidden = false;
          if (status) status.textContent = '';

          const datePicker = document.getElementById('datePicker');
          const currentDate = datePicker?.value || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(new Date());

          if (typeof window.setDate === 'function') window.setDate(currentDate);
          else if (employee?.value && typeof window.loadPlanning === 'function') window.loadPlanning();
        } catch (error) {
          const code = String(error?.message || '');
          if (['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_FORBIDDEN'].includes(code)) clearSession();
          if (status) status.textContent = code.startsWith('AUTH_')
            ? 'Votre session a expiré. Reconnectez-vous avec Google.'
            : 'Ogust est momentanément indisponible. Votre connexion reste mémorisée.';
        }
      }, 0);
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

    const notificationsLoaded = [...document.scripts].some((script) => /(?:^|\/)notifications-local\.js(?:$|\?)/.test(script.src));
    if (!notificationsLoaded) {
      const script = document.createElement('script');
      script.src = './notifications-local.js?v=20260909-4';
      script.dataset.acjNotificationsLocal = '1';
      document.body.appendChild(script);
    }
  });
})();
