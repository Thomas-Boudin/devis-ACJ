(() => {
  const CARD_ID = 'acjNotificationCard';
  const SW_PATH = './notification-sw.js?v=20260909-2';
  const PUSH_API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-push';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const PUSH_EMPLOYEE_KEY = 'acj_intervenantes_push_employee';
  const PUSH_ID_KEY = 'acj_intervenantes_push_id';

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
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async function registration() {
    if (!supported()) throw new Error('NOT_SUPPORTED');
    await navigator.serviceWorker.register(SW_PATH, { scope: './' });
    return navigator.serviceWorker.ready;
  }

  function selectedEmployee() {
    const select = document.getElementById('employee');
    const id = String(select?.value || '').trim();
    const name = String(select?.selectedOptions?.[0]?.textContent || '').trim();
    return { id, name };
  }

  function sessionToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setStatus(text, type = '') {
    const el = document.getElementById('acjNotificationStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `acjNotificationStatus ${type}`.trim();
  }

  function permissionLabel() {
    if (!supported()) return ['Notifications non prises en charge par ce navigateur.', 'err'];
    if (Notification.permission === 'denied') return ['Alertes bloquées dans les réglages du navigateur.', 'err'];
    const { id, name } = selectedEmployee();
    const saved = localStorage.getItem(PUSH_EMPLOYEE_KEY) || '';
    if (Notification.permission === 'granted' && id && saved === id && localStorage.getItem(PUSH_ID_KEY)) return [`Notifications activées pour ${name || 'cette intervenante'}.`, 'ok'];
    if (Notification.permission === 'granted') return ['Alertes autorisées, mais ce téléphone doit encore être lié à l’intervenante.', ''];
    return ['Alertes pas encore activées.', ''];
  }

  function b64ToBytes(value) {
    const pad = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function remoteSubscribe({ silent = false } = {}) {
    const { id, name } = selectedEmployee();
    if (!/^\d+$/.test(id)) {
      if (!silent) setStatus('Choisissez d’abord l’intervenante concernée.', 'err');
      return false;
    }
    const token = sessionToken();
    if (!token) {
      if (!silent) setStatus('Session expirée. Reconnectez-vous à ACJ Intervenantes.', 'err');
      return false;
    }
    const reg = await registration();
    const configResponse = await fetch(`${PUSH_API}?action=config`, { cache: 'no-store' });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config?.public_key) throw new Error('PUSH_CONFIG');
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(config.public_key) });
    const response = await fetch(`${PUSH_API}?action=subscribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: id, subscription: subscription.toJSON() }),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.push_id) throw new Error(data?.error || 'PUSH_SUBSCRIBE');
    localStorage.setItem(PUSH_EMPLOYEE_KEY, id);
    localStorage.setItem(PUSH_ID_KEY, data.push_id);
    if (!silent) setStatus(`Notifications activées pour ${data.employee_name || name || 'cette intervenante'}.`, 'ok');
    return true;
  }

  async function enable() {
    if (!supported()) { setStatus('Notifications non prises en charge par ce navigateur.', 'err'); return; }
    try {
      await registration();
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'denied') { setStatus('Alertes bloquées. Il faut les réautoriser dans les réglages du navigateur.', 'err'); return; }
      if (permission !== 'granted') { setStatus('Autorisation non accordée.', 'err'); return; }
      setStatus('Liaison du téléphone avec Ogust…');
      await remoteSubscribe();
    } catch {
      setStatus('Impossible d’activer les notifications distantes sur ce téléphone.', 'err');
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
      await reg.showNotification('ACJ Services · TEST', {
        body: 'Les notifications ACJ Intervenantes fonctionnent sur ce téléphone.',
        tag: `acj-test-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [250, 120, 250, 120, 450],
        data: { url: './' }
      });
      setStatus('Notification test affichée sur ce téléphone.', 'ok');
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
      <h3>Notifications planning</h3>
      <p>Activez-les une fois pour recevoir les nouvelles prestations, modifications et annulations de planning Ogust sur ce téléphone.</p>
      <div class="acjNotificationBtns">
        <button id="acjNotificationEnable" class="acjNotificationBtn">Activer les notifications</button>
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

  function loadSmsModule() {
    const loaded = [...document.scripts].some((script) => /(?:^|\/)liaison-sms\.js(?:$|\?)/.test(script.src));
    if (loaded) return;
    const script = document.createElement('script');
    script.src = './liaison-sms.js?v=20260909-2';
    script.dataset.acjLiaisonSms = '1';
    document.body.appendChild(script);
  }

  function loadAlertsModule() {
    const loaded = [...document.scripts].some((script) => /(?:^|\/)liaison-alerts\.js(?:$|\?)/.test(script.src));
    if (loaded) return;
    const script = document.createElement('script');
    script.src = './liaison-alerts.js?v=20260909-1';
    script.dataset.acjLiaisonAlerts = '1';
    document.body.appendChild(script);
  }

  function bindEmployee() {
    const employee = document.getElementById('employee');
    employee?.addEventListener('change', async () => {
      const [text, type] = permissionLabel();
      setStatus(text, type);
      if (Notification.permission !== 'granted' || !localStorage.getItem(PUSH_ID_KEY)) return;
      try { await remoteSubscribe({ silent: true }); const [t, ty] = permissionLabel(); setStatus(t, ty); }
      catch { setStatus('Le téléphone n’a pas pu être relié à cette intervenante.', 'err'); }
    });
  }

  function init() {
    injectCss();
    registration().catch(() => {});
    loadSmsModule();
    loadAlertsModule();
    bindEmployee();
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
