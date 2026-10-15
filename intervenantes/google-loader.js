(() => {
  const GOOGLE_SRC = 'https://accounts.google.com/gsi/client';
  const CLIENT_ID = '93181159242-i64qf82vtrij5c4b7l5q18ctjj48l3so.apps.googleusercontent.com';
  const MAX_WAIT_MS = 4500;
  const SIGN_IN_WAIT_MS = 25000;
  let initialized = false;
  let rendered = false;
  let signInTimer;

  function ready() {
    return Boolean(window.google?.accounts?.id);
  }

  function status(text) {
    const el = document.getElementById('loginStatus');
    if (el) el.textContent = text || '';
  }

  function startSignIn() {
    clearTimeout(signInTimer);
    const passwordStatus = document.getElementById('passwordStatus');
    if (passwordStatus) passwordStatus.textContent = '';
    status('Connexion Google…');
    signInTimer = setTimeout(() => {
      const login = document.getElementById('login');
      const message = document.getElementById('loginStatus');
      if (login && !login.hidden && message?.textContent === 'Connexion Google…') {
        status('Terminez la connexion dans la fenêtre Google. Si elle a été fermée, appuyez de nouveau sur le bouton Google.');
      }
    }, SIGN_IN_WAIT_MS);
  }

  function renderGoogleButton() {
    if (rendered) return true;
    if (!ready()) return false;
    const box = document.getElementById('googleButton');
    if (!box || typeof window.googleLogin !== 'function') return false;
    try {
      if (!initialized) {
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            clearTimeout(signInTimer);
            return window.googleLogin(response);
          },
          auto_select: false,
          ux_mode: 'popup',
          use_fedcm_for_button: false
        });
        initialized = true;
      }
      box.innerHTML = '';
      google.accounts.id.renderButton(box, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 300,
        click_listener: startSignIn
      });
      rendered = true;
      status('');
      return true;
    } catch (error) {
      status(`Connexion Google indisponible (${String(error?.message || error)}).`);
      return false;
    }
  }

  function injectGoogleScript({ cacheBust = false } = {}) {
    if (ready()) {
      renderGoogleButton();
      return;
    }
    const existing = [...document.scripts].some((script) => script.dataset.acjGoogleRetry === '1');
    if (existing && !cacheBust) return;

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.acjGoogleRetry = '1';
    script.src = cacheBust ? `${GOOGLE_SRC}?acj_retry=${Date.now()}` : GOOGLE_SRC;
    script.onload = () => {
      if (!renderGoogleButton()) status('Connexion Google chargée, initialisation en cours…');
    };
    script.onerror = () => {
      status('Connexion Google indisponible. Vérifiez la connexion puis rechargez la page.');
    };
    document.head.appendChild(script);
  }

  function boot() {
    if (renderGoogleButton()) return;

    injectGoogleScript();

    setTimeout(() => {
      if (renderGoogleButton()) return;
      status('Connexion Google en cours…');
      injectGoogleScript({ cacheBust: true });
    }, MAX_WAIT_MS);

    setTimeout(() => {
      if (!renderGoogleButton()) {
        status('Google ne répond pas. Rechargez cette page pour réessayer.');
      }
    }, MAX_WAIT_MS + 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

