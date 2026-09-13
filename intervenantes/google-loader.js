(() => {
  const GOOGLE_SRC = 'https://accounts.google.com/gsi/client';
  const MAX_WAIT_MS = 4500;

  function ready() {
    return Boolean(window.google?.accounts?.id);
  }

  function status(text) {
    const el = document.getElementById('loginStatus');
    if (el) el.textContent = text || '';
  }

  function injectGoogleScript({ cacheBust = false } = {}) {
    if (ready()) return;
    const existing = [...document.scripts].some((script) => script.dataset.acjGoogleRetry === '1');
    if (existing && !cacheBust) return;

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.acjGoogleRetry = '1';
    script.src = cacheBust ? `${GOOGLE_SRC}?acj_retry=${Date.now()}` : GOOGLE_SRC;
    script.onload = () => {
      if (ready()) status('');
    };
    script.onerror = () => {
      status('Connexion Google indisponible. Vérifiez la connexion puis rechargez la page.');
    };
    document.head.appendChild(script);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (ready()) return;

    // Le script Google statique de la page peut rester bloqué sur certains chargements
    // mobiles. Une seconde injection reproduit le mécanisme de secours qui existait
    // auparavant via Devis ACJ, mais cette fois Intervenantes reste autonome.
    injectGoogleScript();

    setTimeout(() => {
      if (ready()) return;
      status('Connexion Google en cours…');
      injectGoogleScript({ cacheBust: true });
    }, MAX_WAIT_MS);

    setTimeout(() => {
      if (!ready()) {
        status('Google ne répond pas. Rechargez cette page pour réessayer.');
      }
    }, MAX_WAIT_MS + 5000);
  });
})();
