(() => {
  const GOOGLE_SRC = 'https://accounts.google.com/gsi/client';
  const CLIENT_ID = '93181159242-i64qf82vtrij5c4b7l5q18ctjj48l3so.apps.googleusercontent.com';
  const MAX_WAIT_MS = 4500;

  function ready() {
    return Boolean(window.google?.accounts?.id);
  }

  function status(text) {
    const el = document.getElementById('loginStatus');
    if (el) el.textContent = text || '';
  }

  function renderFedCmButton() {
    if (!ready()) return false;
    const box = document.getElementById('googleButton');
    if (!box || typeof window.googleLogin !== 'function') return false;
    try {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: window.googleLogin,
        auto_select: false,
        use_fedcm_for_button: true
      });
      box.innerHTML = '';
      google.accounts.id.renderButton(box, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 300,
        click_listener: () => status('Connexion Google…')
      });
      status('');
      return true;
    } catch (error) {
      status(`Connexion Google indisponible (${String(error?.message || error)}).`);
      return false;
    }
  }

  function injectGoogleScript({ cacheBust = false } = {}) {
    if (ready()) {
      renderFedCmButton();
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
      if (!renderFedCmButton()) status('Connexion Google chargée, initialisation en cours…');
    };
    script.onerror = () => {
      status('Connexion Google indisponible. Vérifiez la connexion puis rechargez la page.');
    };
    document.head.appendChild(script);
  }

  function boot() {
    if (renderFedCmButton()) return;

    injectGoogleScript();

    setTimeout(() => {
      if (renderFedCmButton()) return;
      status('Connexion Google en cours…');
      injectGoogleScript({ cacheBust: true });
    }, MAX_WAIT_MS);

    setTimeout(() => {
      if (!renderFedCmButton()) {
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
