(() => {
  const CARD_ID = 'acjNotificationCard';
  const SW_PATH = './notification-sw.js?v=20260909-1';

  function injectCss() {
    if (document.getElementById('acj-notification-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-notification-css';
    style.textContent = `
      .acjNotificationCard{background:#fff;border:1px solid #dbe3ee;border-radius:19px;padding:14px;display:grid;gap:9px}
      .acjNotificationCard h3{margin:0;font-size:15px}
      .acjNotificationCard p{margin:0;color:#64748b;font-size:11px;line-height:1.45}
      .acjNotificationBtns{display:grid;grid-template-columns:1.35fr 1fr;gap:8px}
      .acjNotificationBtn{min-height:44px;border:0;border-radius:12px;font-weight:900;background:#0f766e;color:#fff}
      .acjNotificationBtn.secondary{background:#e2e8f0;color:#334155}
      .acjNotificationStatus{font-size:11px;font-weight:750;color:#475569}
      .acjNotificationStatus.ok{color:#166534}.acjNotificationStatus.err{color:#b91c1c}
      @media(max-width:390px){.acjNotificationBtns{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function supported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  async function registration() {
    if (!supported()) throw new Error('NOT_SUPPORTED');
    await navigator.serviceWorker.register(SW_PATH, { scope: './' });
    return navigator.serviceWorker.ready;
  }

  function setStatus(text, type = '') {
    const el = document.getElementById('acjNotificationStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `acjNotificationStatus ${type}`.trim();
  }

  function permissionLabel() {
    if (!supported()) return ['Notifications non prises en charge par ce navigateur.', 'err'];
    if (Notification.permission === 'granted') return ['Alertes autorisées sur ce téléphone.', 'ok'];
    if (Notification.permission === 'denied') return ['Alertes bloquées dans les réglages du navigateur.', 'err'];
    return ['Alertes pas encore activées.', ''];
  }

  async function enable() {
    if (!supported()) { setStatus('Notifications non prises en charge par ce navigateur.', 'err'); return; }
    try {
      await registration();
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission === 'granted') setStatus('Alertes autorisées. Tu peux lancer le test.', 'ok');
      else if (permission === 'denied') setStatus('Alertes bloquées. Il faut les réautoriser dans les réglages du navigateur.', 'err');
      else setStatus('Autorisation non accordée.', 'err');
    } catch {
      setStatus('Impossible d’activer les notifications sur ce navigateur.', 'err');
    }
  }

  async function test() {
    if (!supported()) { setStatus('Notifications non prises en charge.', 'err'); return; }
    if (Notification.permission !== 'granted') {
      await enable();
      if (Notification.permission !== 'granted') return;
    }
    try {
      const reg = await registration();
      await reg.showNotification('ACJ Services · ALERTE TEST', {
        body: 'Test notification : retard intervenante de 10 minutes.',
        tag: `acj-test-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [250, 120, 250, 120, 450],
        data: { url: './?open=liaison' }
      });
      setStatus('Notification test envoyée à ce téléphone.', 'ok');
    } catch {
      setStatus('Le téléphone n’a pas pu afficher la notification.', 'err');
    }
  }

  function installCard() {
    const panel = document.getElementById('liaisonPanel');
    if (!panel || document.getElementById(CARD_ID)) return false;
    const card = document.createElement('section');
    card.id = CARD_ID;
    card.className = 'acjNotificationCard';
    card.innerHTML = `
      <h3>Alertes téléphone</h3>
      <p>Autorise les notifications système pour recevoir ensuite les retards, absences et incidents même quand l’application n’est pas au premier plan.</p>
      <div class="acjNotificationBtns">
        <button id="acjNotificationEnable" class="acjNotificationBtn">Activer les alertes</button>
        <button id="acjNotificationTest" class="acjNotificationBtn secondary">Tester</button>
      </div>
      <div id="acjNotificationStatus" class="acjNotificationStatus"></div>`;
    const intro = panel.querySelector('.liaisonIntro');
    if (intro?.nextSibling) panel.insertBefore(card, intro.nextSibling);
    else panel.appendChild(card);
    document.getElementById('acjNotificationEnable')?.addEventListener('click', enable);
    document.getElementById('acjNotificationTest')?.addEventListener('click', test);
    const [text, type] = permissionLabel();
    setStatus(text, type);
    return true;
  }

  function init() {
    injectCss();
    registration().catch(() => {});
    if (installCard()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installCard() || attempts > 100) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
