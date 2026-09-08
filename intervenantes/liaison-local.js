(() => {
  const STORAGE_KEY = 'acj_intervenantes_liaison_v1';
  const PLANNING_KEY = 'acj_intervenantes_liaison_planning_v1';
  const MAX_ITEMS = 50;
  const MAX_PLANNING_DAYS = 30;
  let planningContexts = [];
  let selectedServiceId = '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function nowIso() { return new Date().toISOString(); }

  function fmtTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit'
    }).format(d);
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value ?? fallback;
    } catch { return fallback; }
  }

  function loadItems() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  }

  function employeeLabel() {
    const select = document.getElementById('employee');
    return select?.selectedOptions?.[0]?.textContent?.trim() || 'Intervenante';
  }

  function employeeId() {
    return String(document.getElementById('employee')?.value || '');
  }

  function selectedDate() {
    return String(document.getElementById('datePicker')?.value || '');
  }

  function planningCacheKey() {
    return `${employeeId()}|${selectedDate()}`;
  }

  function serviceContext(service) {
    const customer = service?.customer || {};
    const product = service?.product || {};
    return {
      serviceId: String(service?.id_service || ''),
      customerId: String(service?.id_customer || customer?.id_customer || ''),
      clientName: String(customer?.name || 'Client'),
      productLabel: String(product?.label || 'Prestation'),
      startTime: String(service?.start_time || ''),
      endTime: String(service?.end_time || ''),
      scheduledDate: selectedDate(),
      employeeId: employeeId(),
      employeeLabel: employeeLabel()
    };
  }

  function savePlanningCache(contexts) {
    const key = planningCacheKey();
    if (!key || key.startsWith('|')) return;
    const all = readJson(PLANNING_KEY, {});
    const next = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
    next[key] = { savedAt: nowIso(), contexts: contexts.slice(0, 30) };
    const keys = Object.keys(next).sort((a, b) => String(next[b]?.savedAt || '').localeCompare(String(next[a]?.savedAt || '')));
    keys.slice(MAX_PLANNING_DAYS).forEach((oldKey) => delete next[oldKey]);
    localStorage.setItem(PLANNING_KEY, JSON.stringify(next));
  }

  function loadPlanningCache() {
    const all = readJson(PLANNING_KEY, {});
    const entry = all?.[planningCacheKey()];
    return Array.isArray(entry?.contexts) ? entry.contexts : [];
  }

  function contextLabel(context) {
    if (!context?.serviceId) return 'Message général';
    const hours = [context.startTime, context.endTime].filter(Boolean).join(' – ');
    return [hours, context.clientName].filter(Boolean).join(' · ');
  }

  function selectedContext(serviceId = selectedServiceId) {
    const id = String(serviceId || '');
    return planningContexts.find((item) => item.serviceId === id) || null;
  }

  function contextFields(context) {
    if (!context) return {};
    return {
      service_id: context.serviceId,
      customer_id: context.customerId,
      client_name: context.clientName,
      product_label: context.productLabel,
      start_time: context.startTime,
      end_time: context.endTime,
      scheduled_date: context.scheduledDate,
      employee_id: context.employeeId
    };
  }

  function defaultContextIndex(rows) {
    const cards = [...document.querySelectorAll('#list .card')];
    const heroIndex = cards.findIndex((card) => card.classList.contains('hero'));
    if (heroIndex >= 0 && heroIndex < rows.length) return heroIndex;
    return rows.length ? 0 : -1;
  }

  function capturePlanning(rows) {
    const source = Array.isArray(rows) ? rows : [];
    planningContexts = source.map(serviceContext).filter((item) => item.serviceId);
    const index = defaultContextIndex(source);
    selectedServiceId = planningContexts[index]?.serviceId || planningContexts[0]?.serviceId || '';
    if (planningContexts.length) savePlanningCache(planningContexts);
    refreshContextUi();
  }

  function ensurePlanningContext() {
    const currentKey = planningContexts[0] ? `${planningContexts[0].employeeId}|${planningContexts[0].scheduledDate}` : '';
    if (currentKey !== planningCacheKey()) {
      planningContexts = loadPlanningCache();
      selectedServiceId = planningContexts[0]?.serviceId || '';
    }
    refreshContextUi();
  }

  function injectCss() {
    if (document.getElementById('acj-liaison-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-liaison-css';
    style.textContent = `
      .liaisonPanel{display:grid;gap:12px;margin-top:12px}
      .liaisonIntro{background:#0f172a;color:#fff;border-radius:20px;padding:17px}
      .liaisonIntro h2{margin:0 0 6px;font-size:20px;letter-spacing:-.02em}
      .liaisonIntro p{margin:0;color:#cbd5e1;font-size:12px;line-height:1.5}
      .liaisonContext{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:17px;padding:12px}
      .liaisonContext label{display:block;color:#166534;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}
      .liaisonContext select{width:100%;min-height:44px;border:1px solid #a7f3d0;background:#fff;border-radius:12px;padding:0 10px;color:#0f172a;font-weight:800;outline:none}
      .liaisonContextMeta{margin-top:7px;color:#475569;font-size:11px;line-height:1.4}
      .liaisonQuick{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .liaisonAction{min-height:88px;border:1px solid #dbe3ee;background:#fff;border-radius:17px;padding:12px;text-align:left;color:#0f172a;box-shadow:0 4px 15px rgba(15,23,42,.035)}
      .liaisonAction strong{display:block;font-size:14px;margin-bottom:5px}
      .liaisonAction span{display:block;color:#64748b;font-size:11px;line-height:1.35}
      .liaisonAction.urgent{border-color:#fecaca;background:#fffafa}
      .liaisonBlock{background:#fff;border:1px solid #dbe3ee;border-radius:19px;padding:14px}
      .liaisonBlock h3{margin:0 0 10px;font-size:15px}
      .liaisonComposer{display:grid;gap:8px}
      .liaisonComposer select,.liaisonComposer textarea,.liaisonSheet select{width:100%;border:1px solid #dbe3ee;background:#f8fafc;border-radius:12px;padding:11px;color:#0f172a;outline:none}
      .liaisonComposer textarea{min-height:82px;resize:vertical}
      .liaisonSend{min-height:46px;border:0;border-radius:12px;background:#0f766e;color:#fff;font-weight:900}
      .liaisonHint{font-size:11px;color:#64748b;line-height:1.4}
      .liaisonFeed{display:grid;gap:8px}
      .liaisonItem{padding:11px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}
      .liaisonItemTop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}
      .liaisonItemType{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#0f766e}
      .liaisonItemTime{font-size:10px;color:#94a3b8}
      .liaisonItemMsg{font-size:12px;line-height:1.4;color:#334155}
      .liaisonItemContext{margin-top:7px;padding:7px 8px;border-radius:9px;background:#ecfdf5;color:#166534;font-size:10px;font-weight:800}
      .liaisonItemMeta{margin-top:6px;font-size:10px;color:#64748b}
      .liaisonPending{display:inline-flex;margin-top:7px;border-radius:999px;background:#fff7ed;color:#9a3412;padding:4px 7px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
      .liaisonEmpty{padding:18px;text-align:center;color:#64748b;font-size:12px}
      .liaisonSheetBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:80;display:flex;align-items:flex-end;justify-content:center;padding:12px}
      .liaisonSheet{width:min(100%,560px);background:#fff;border-radius:24px;padding:17px;box-shadow:0 24px 80px rgba(15,23,42,.28)}
      .liaisonSheet h3{margin:0 0 5px;font-size:19px}.liaisonSheet p{margin:0 0 13px;color:#64748b;font-size:12px;line-height:1.45}
      .liaisonSheetContext{margin-bottom:10px}
      .liaisonSheetContext label{display:block;font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
      .liaisonPresets{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}
      .liaisonPreset{min-height:42px;border:1px solid #cbd5e1;background:#fff;border-radius:11px;font-weight:850}
      .liaisonRecipients{display:grid;gap:8px;margin:10px 0;padding:11px;background:#f8fafc;border-radius:13px}
      .liaisonRecipients label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:750}
      .liaisonSheet textarea{width:100%;min-height:86px;border:1px solid #dbe3ee;background:#f8fafc;border-radius:12px;padding:11px;resize:vertical}
      .liaisonSheetBtns{display:grid;grid-template-columns:1fr 1.5fr;gap:8px;margin-top:12px}
      .liaisonCancel,.liaisonConfirm{min-height:46px;border:0;border-radius:12px;font-weight:900}.liaisonCancel{background:#e2e8f0;color:#334155}.liaisonConfirm{background:#0f766e;color:#fff}
      @media(max-width:390px){.liaisonQuick{grid-template-columns:1fr}.liaisonPresets{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function recipientLabel(recipients) {
    const names = [];
    if (recipients.includes('agency')) names.push('Agence');
    if (recipients.includes('client')) names.push('Client');
    if (recipients.includes('team')) names.push('Équipe');
    return names.join(' + ') || 'Agence';
  }

  function addItem(item) {
    const items = loadItems();
    items.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: nowIso(), pending: true, ...item });
    saveItems(items);
    renderFeed();
  }

  function itemContextLabel(item) {
    if (!item?.service_id) return '';
    const hours = [item.start_time, item.end_time].filter(Boolean).join(' – ');
    return [hours, item.client_name, item.product_label].filter(Boolean).join(' · ');
  }

  function renderFeed() {
    const feed = document.getElementById('liaisonFeed');
    if (!feed) return;
    const items = loadItems();
    if (!items.length) {
      feed.innerHTML = '<div class="liaisonEmpty">Aucune communication enregistrée.</div>';
      return;
    }
    feed.innerHTML = items.slice(0, 12).map((item) => `
      <article class="liaisonItem">
        <div class="liaisonItemTop"><span class="liaisonItemType">${esc(item.type || 'Message')}</span><span class="liaisonItemTime">${esc(fmtTime(item.createdAt))}</span></div>
        <div class="liaisonItemMsg">${esc(item.message || '')}</div>
        ${item.service_id ? `<div class="liaisonItemContext">${esc(itemContextLabel(item))}</div>` : ''}
        <div class="liaisonItemMeta">${esc(item.author || employeeLabel())} · vers ${esc(recipientLabel(item.recipients || ['agency']))}</div>
        ${item.pending ? '<span class="liaisonPending">À synchroniser</span>' : ''}
      </article>`).join('');
  }

  const quickDefs = {
    delay: { title: 'Je suis en retard', sub: 'Prévenir agence + client', recipients: ['agency', 'client'], urgent: true },
    absence: { title: 'Je ne peux pas intervenir', sub: 'Absence ou empêchement', recipients: ['agency', 'client'], urgent: true },
    client_absent: { title: 'Client absent', sub: 'Tracer immédiatement la situation', recipients: ['agency'], urgent: false },
    problem: { title: 'J’ai un problème', sub: 'Accès, matériel, casse, incident…', recipients: ['agency'], urgent: false }
  };

  function messageFor(type, minutes = 10) {
    const who = employeeLabel();
    if (type === 'delay') return `${who} signale un retard estimé de ${minutes} minutes.`;
    if (type === 'absence') return `${who} signale qu’elle ne pourra pas assurer l’intervention prévue.`;
    if (type === 'client_absent') return `${who} signale que le client est absent ou inaccessible à l’arrivée.`;
    return `${who} signale un problème pendant ou avant l’intervention.`;
  }

  function contextOptions(selectedId = selectedServiceId) {
    const general = '<option value="">Message général · sans prestation</option>';
    return general + planningContexts.map((context) => `<option value="${esc(context.serviceId)}" ${context.serviceId === selectedId ? 'selected' : ''}>${esc(contextLabel(context))}</option>`).join('');
  }

  function refreshContextUi() {
    const select = document.getElementById('liaisonService');
    const meta = document.getElementById('liaisonContextMeta');
    if (select) {
      const previous = selectedServiceId;
      select.innerHTML = contextOptions(previous);
      if (previous && planningContexts.some((context) => context.serviceId === previous)) select.value = previous;
      else if (planningContexts[0]) {
        selectedServiceId = planningContexts[0].serviceId;
        select.value = selectedServiceId;
      }
    }
    const context = selectedContext();
    if (meta) {
      meta.textContent = context
        ? `${context.productLabel} · ${context.clientName} · ${context.scheduledDate || 'date du planning'}`
        : 'Aucune prestation liée. Le message sera enregistré comme communication générale.';
    }
  }

  function openSheet(type) {
    const def = quickDefs[type];
    if (!def) return;
    ensurePlanningContext();
    const backdrop = document.createElement('div');
    backdrop.className = 'liaisonSheetBackdrop';
    backdrop.innerHTML = `
      <section class="liaisonSheet" role="dialog" aria-modal="true">
        <h3>${esc(def.title)}</h3>
        <p>Le signalement sera rattaché à la prestation sélectionnée et gardé hors ligne tant que le serveur de communication n’est pas branché.</p>
        <div class="liaisonSheetContext"><label>Intervention concernée</label><select id="liaisonQuickService">${contextOptions(selectedServiceId)}</select></div>
        ${type === 'delay' ? '<div class="liaisonPresets"><button class="liaisonPreset" data-min="5">+5 min</button><button class="liaisonPreset" data-min="10">+10 min</button><button class="liaisonPreset" data-min="15">+15 min</button><button class="liaisonPreset" data-min="30">+30 min</button></div>' : ''}
        <textarea id="liaisonQuickText">${esc(messageFor(type))}</textarea>
        <div class="liaisonRecipients">
          <strong style="font-size:11px">Prévenir automatiquement :</strong>
          <label><input type="checkbox" data-recipient="agency" ${def.recipients.includes('agency') ? 'checked' : ''}> Agence ACJ</label>
          <label><input type="checkbox" data-recipient="client" ${def.recipients.includes('client') ? 'checked' : ''}> Client</label>
        </div>
        <div class="liaisonSheetBtns"><button class="liaisonCancel">Annuler</button><button class="liaisonConfirm">Enregistrer le signalement</button></div>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.querySelectorAll('.liaisonPreset').forEach((button) => button.addEventListener('click', () => {
      const min = Number(button.dataset.min || 10);
      const text = backdrop.querySelector('#liaisonQuickText');
      if (text) text.value = messageFor(type, min);
    }));
    backdrop.querySelector('.liaisonCancel')?.addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('.liaisonConfirm')?.addEventListener('click', () => {
      const recipients = [...backdrop.querySelectorAll('[data-recipient]:checked')].map((el) => el.dataset.recipient);
      const message = backdrop.querySelector('#liaisonQuickText')?.value?.trim() || messageFor(type);
      const serviceId = String(backdrop.querySelector('#liaisonQuickService')?.value || '');
      selectedServiceId = serviceId;
      const context = selectedContext(serviceId);
      refreshContextUi();
      addItem({
        type: def.title,
        message,
        recipients: recipients.length ? recipients : ['agency'],
        author: employeeLabel(),
        ...contextFields(context)
      });
      backdrop.remove();
    });
  }

  function buildPanel() {
    if (document.getElementById('liaisonPanel')) return document.getElementById('liaisonPanel');
    const panel = document.createElement('section');
    panel.id = 'liaisonPanel';
    panel.className = 'liaisonPanel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="liaisonIntro"><h2>Liaison</h2><p>Agence, intervenante et client au même endroit. Les urgences terrain doivent pouvoir être signalées en quelques secondes.</p></div>
      <div class="liaisonContext"><label>Intervention concernée</label><select id="liaisonService"></select><div id="liaisonContextMeta" class="liaisonContextMeta"></div></div>
      <div class="liaisonQuick">
        ${Object.entries(quickDefs).map(([key, def]) => `<button class="liaisonAction ${def.urgent ? 'urgent' : ''}" data-liaison-action="${key}"><strong>${esc(def.title)}</strong><span>${esc(def.sub)}</span></button>`).join('')}
      </div>
      <div class="liaisonBlock"><h3>Écrire un message</h3><div class="liaisonComposer"><select id="liaisonAudience"><option value="all">Agence + client</option><option value="agency">Agence uniquement</option><option value="client">Client uniquement</option></select><textarea id="liaisonMessage" placeholder="Votre message…"></textarea><button id="liaisonSend" class="liaisonSend">Enregistrer le message</button><div class="liaisonHint">La messagerie serveur et les notifications seront branchées ensuite. Le message conserve déjà la prestation et le client concernés.</div></div></div>
      <div class="liaisonBlock"><h3>Dernières communications</h3><div id="liaisonFeed" class="liaisonFeed"></div></div>`;

    const nav = document.querySelector('.bottomNav');
    nav?.parentElement?.insertBefore(panel, nav);
    panel.querySelector('#liaisonService')?.addEventListener('change', (event) => {
      selectedServiceId = String(event.target.value || '');
      refreshContextUi();
    });
    panel.querySelectorAll('[data-liaison-action]').forEach((button) => button.addEventListener('click', () => openSheet(button.dataset.liaisonAction)));
    panel.querySelector('#liaisonSend')?.addEventListener('click', () => {
      const textarea = panel.querySelector('#liaisonMessage');
      const audience = panel.querySelector('#liaisonAudience')?.value || 'all';
      const message = textarea?.value?.trim();
      if (!message) { textarea?.focus(); return; }
      const recipients = audience === 'all' ? ['agency', 'client'] : [audience];
      const context = selectedContext();
      addItem({ type: 'Message', message, recipients, author: employeeLabel(), ...contextFields(context) });
      textarea.value = '';
    });
    renderFeed();
    refreshContextUi();
    return panel;
  }

  function setMode(mode) {
    const panel = buildPanel();
    const selectors = ['.pilot', '.datebar', '.dayStrip', '.summary', '#list'];
    const pageParts = selectors.map((s) => document.querySelector(s)).filter(Boolean);
    const title = document.querySelector('.top h1');
    const navItems = [...document.querySelectorAll('.bottomNav .navItem')];
    const liaison = mode === 'liaison';
    if (liaison) ensurePlanningContext();
    pageParts.forEach((el) => { el.hidden = liaison; });
    panel.hidden = !liaison;
    if (title) title.textContent = liaison ? 'Liaison' : 'Ma journée';
    navItems.forEach((button, index) => button.classList.toggle('active', liaison ? index === 2 : index === 0));
  }

  function installRenderHook() {
    const original = window.render;
    if (typeof original !== 'function' || original.__acjLiaisonWrapped) return false;
    const wrapped = function (rows) {
      const result = original.apply(this, arguments);
      capturePlanning(Array.isArray(rows) ? rows : []);
      return result;
    };
    wrapped.__acjLiaisonWrapped = true;
    window.render = wrapped;
    return true;
  }

  function init() {
    injectCss();
    const navItems = [...document.querySelectorAll('.bottomNav .navItem')];
    if (navItems.length < 3) return;
    navItems[2].disabled = false;
    navItems[2].addEventListener('click', () => setMode('liaison'));
    navItems[0].addEventListener('click', () => setMode('today'));
    buildPanel();
    installRenderHook();
    document.getElementById('employee')?.addEventListener('change', () => {
      planningContexts = loadPlanningCache();
      selectedServiceId = planningContexts[0]?.serviceId || '';
      refreshContextUi();
    });
    document.getElementById('datePicker')?.addEventListener('change', () => {
      planningContexts = loadPlanningCache();
      selectedServiceId = planningContexts[0]?.serviceId || '';
      refreshContextUi();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
