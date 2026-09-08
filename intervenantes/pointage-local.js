(() => {
  const STATE_KEY = 'acj_intervenantes_pointage_state_v1';
  const QUEUE_KEY = 'acj_intervenantes_pointage_queue_v1';
  const timers = new Map();

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function states() { return read(STATE_KEY, {}); }
  function queue() { return read(QUEUE_KEY, []); }

  function saveState(serviceId, value) {
    const all = states();
    all[String(serviceId)] = value;
    write(STATE_KEY, all);
  }

  function getState(serviceId) {
    return states()[String(serviceId)] || null;
  }

  function appendEvent(event) {
    const all = queue();
    all.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sync_status: 'pending_ogust_mapping',
      created_at: new Date().toISOString(),
      ...event
    });
    write(QUEUE_KEY, all.slice(-200));
  }

  function hhmm(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit'
      }).format(new Date(iso));
    } catch { return ''; }
  }

  function elapsed(startIso) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  }

  function getGps() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ status: 'unsupported' });
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          status: 'ok',
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy_m: Math.round(pos.coords.accuracy || 0)
        }),
        (err) => resolve({ status: err?.code === 1 ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    });
  }

  function currentEmployeeId() {
    return String(document.getElementById('employee')?.value || '');
  }

  function currentDate() {
    return String(document.getElementById('datePicker')?.value || '');
  }

  function activeOtherService(exceptId) {
    const all = states();
    return Object.entries(all).find(([id, state]) => id !== String(exceptId) && state?.status === 'active');
  }

  function installCss() {
    if (document.getElementById('acj-pointage-local-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-pointage-local-css';
    style.textContent = `
      .pointage{transition:.15s ease;cursor:pointer}
      .pointage[data-state="ready"]{background:#0f766e;color:#fff}
      .pointage[data-state="active"]{background:#b91c1c;color:#fff}
      .pointage[data-state="done"]{background:#dcfce7;color:#166534;border:1px solid #86efac}
      .pointage:disabled{cursor:default;opacity:1}
      .pointageMeta{margin-top:8px;padding:9px 11px;border-radius:11px;background:#f8fafc;color:#475569;font-size:12px;font-weight:700;line-height:1.4}
      .pointageMeta strong{color:#0f172a}
      .pointageMeta.pending{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
    `;
    document.head.appendChild(style);
  }

  function stopTimer(serviceId) {
    const timer = timers.get(String(serviceId));
    if (timer) clearInterval(timer);
    timers.delete(String(serviceId));
  }

  function setMeta(card, html, pending = false) {
    let meta = card.querySelector('.pointageMeta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'pointageMeta';
      card.appendChild(meta);
    }
    meta.classList.toggle('pending', pending);
    meta.innerHTML = html;
  }

  function paint(card, service) {
    const serviceId = String(service?.id_service || '');
    const button = card.querySelector('.pointage');
    if (!button || !serviceId) return;

    card.dataset.serviceId = serviceId;
    button.disabled = false;
    button.dataset.serviceId = serviceId;
    stopTimer(serviceId);

    const state = getState(serviceId);
    if (!state) {
      button.dataset.state = 'ready';
      button.textContent = 'DÉMARRER';
      const old = card.querySelector('.pointageMeta');
      if (old) old.remove();
      return;
    }

    if (state.status === 'active') {
      button.dataset.state = 'active';
      const refresh = () => {
        button.textContent = `TERMINER · ${elapsed(state.started_at)}`;
      };
      refresh();
      timers.set(serviceId, setInterval(refresh, 1000));
      setMeta(card, `<strong>Prestation en cours</strong> · démarrée à ${hhmm(state.started_at)}<br>Enregistrement local sécurisé sur ce téléphone.`, true);
      return;
    }

    button.dataset.state = 'done';
    button.disabled = true;
    button.textContent = `TERMINÉE · ${hhmm(state.ended_at)}`;
    setMeta(card, `<strong>Pointage test enregistré</strong> · ${hhmm(state.started_at)} → ${hhmm(state.ended_at)}<br>Synchronisation Ogust en attente de validation technique.`, true);
  }

  async function start(service, card) {
    const serviceId = String(service?.id_service || '');
    const other = activeOtherService(serviceId);
    if (other) {
      alert('Une autre prestation est déjà en cours. Terminez-la avant d’en démarrer une nouvelle.');
      return;
    }

    const startedAt = new Date().toISOString();
    const gps = await getGps();
    const state = {
      status: 'active',
      service_id: serviceId,
      employee_id: currentEmployeeId(),
      scheduled_date: currentDate(),
      started_at: startedAt,
      start_gps: gps
    };
    saveState(serviceId, state);
    appendEvent({
      type: 'start',
      service_id: serviceId,
      employee_id: state.employee_id,
      scheduled_date: state.scheduled_date,
      occurred_at: startedAt,
      gps
    });
    paint(card, service);
  }

  async function stop(service, card) {
    const serviceId = String(service?.id_service || '');
    const state = getState(serviceId);
    if (!state || state.status !== 'active') return;

    const endedAt = new Date().toISOString();
    const gps = await getGps();
    const completed = {
      ...state,
      status: 'completed',
      ended_at: endedAt,
      end_gps: gps,
      sync_status: 'pending_ogust_mapping'
    };
    saveState(serviceId, completed);
    appendEvent({
      type: 'stop',
      service_id: serviceId,
      employee_id: state.employee_id,
      scheduled_date: state.scheduled_date,
      occurred_at: endedAt,
      gps
    });
    paint(card, service);
  }

  function bindCard(card, service) {
    const serviceId = String(service?.id_service || '');
    const button = card.querySelector('.pointage');
    if (!button || !serviceId) return;
    paint(card, service);
    button.onclick = async () => {
      button.disabled = true;
      try {
        const state = getState(serviceId);
        if (state?.status === 'active') await stop(service, card);
        else if (!state) await start(service, card);
      } finally {
        const state = getState(serviceId);
        if (state?.status !== 'completed') button.disabled = false;
      }
    };
  }

  function decorate(rows) {
    const cards = [...document.querySelectorAll('#list .card')];
    cards.forEach((card, index) => bindCard(card, rows[index] || {}));
  }

  function installRenderHook() {
    const original = window.render;
    if (typeof original !== 'function' || original.__acjPointageWrapped) return false;
    const wrapped = function (rows) {
      const result = original.apply(this, arguments);
      decorate(Array.isArray(rows) ? rows : []);
      return result;
    };
    wrapped.__acjPointageWrapped = true;
    window.render = wrapped;
    return true;
  }

  function updateBanner() {
    const banner = document.querySelector('.banner');
    if (banner) banner.textContent = 'Connexion Ogust active · pointage en mode test local, sans écriture Ogust.';
  }

  function boot() {
    installCss();
    updateBanner();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installRenderHook() || attempts > 40) clearInterval(timer);
    }, 100);
  }

  boot();
})();
