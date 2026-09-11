(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const PANEL_ID = 'acjPlanningMonthPanel';
  const CONTENT_ID = 'acjPlanningContent';
  const VISUAL_CLASS = 'acjAgendaVisual';
  const detailCache = new Map();
  let renderSeq = 0;
  let observer = null;
  let detailObserver = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
  function toMinutes(value) {
    if (!/^\d\d:\d\d$/.test(String(value || ''))) return null;
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }
  function durationText(total) {
    const minutes = Math.max(0, Number(total) || 0);
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }
  function monthKey(date) { return String(date || '').slice(0, 7); }
  function dayShort(date) {
    const [y, m, d] = String(date).split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      .format(new Date(y, m - 1, d, 12)).replace('.', '');
  }
  function currentMode() {
    return document.querySelector(`${'#' + PANEL_ID} [data-acj-view].active`)?.dataset?.acjView || '';
  }
  function authHeaders() { return { Authorization: `Bearer ${token()}` }; }
  async function api(action, query = {}) {
    const url = new URL(API);
    url.searchParams.set('action', action);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
    return data;
  }
  function injectCss() {
    if (document.getElementById('acj-agenda-visual-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-agenda-visual-css';
    style.textContent = `
      .${VISUAL_CLASS}{display:grid;gap:12px}.acjAgendaHint{font-size:10px;color:#64748b;font-weight:800;padding:0 2px}.acjAgendaEmployee{background:#fff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden}.acjAgendaEmployeeTitle{position:sticky;left:0;z-index:8;padding:10px 12px;background:#0f172a;color:#fff;font-size:12px;font-weight:950}.acjAgendaScroll{overflow:auto;max-height:68vh}.acjAgendaGrid{display:grid;grid-template-columns:52px repeat(var(--days),minmax(var(--day-min),1fr));min-width:var(--agenda-min);position:relative;background:#fff}.acjAgendaCorner{position:sticky;left:0;top:0;z-index:12;background:#f8fafc;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;height:52px}.acjAgendaDayHead{position:sticky;top:0;z-index:10;height:52px;background:#f8fafc;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:8px}.acjAgendaDayHead.today{background:#ecfdf5;color:#0f766e}.acjAgendaDayHead strong{font-size:12px;text-transform:capitalize}.acjAgendaDayHead button{border:0;background:#e2e8f0;color:#334155;border-radius:9px;width:30px;height:30px;font-weight:950}.acjAgendaTimes{position:sticky;left:0;z-index:7;background:#fff;border-right:1px solid #e5e7eb}.acjAgendaTime{position:absolute;right:7px;transform:translateY(-7px);font-size:9px;color:#94a3b8;font-weight:800}.acjAgendaDay{position:relative;border-right:1px solid #e5e7eb;background:linear-gradient(to bottom,transparent calc(100% - 1px),#f1f5f9 1px);background-size:100% var(--hour-h);cursor:pointer}.acjAgendaDay.today{background-color:#fbfffd}.acjAgendaDay.empty::after{content:'Libre';position:absolute;top:18px;left:8px;font-size:10px;font-weight:850;color:#94a3b8}.acjAgendaBlock{position:absolute;border:0;border-radius:10px;padding:5px 7px;text-align:left;background:#d1fae5;color:#14532d;box-shadow:0 2px 6px rgba(15,23,42,.10);overflow:hidden;z-index:4;cursor:pointer;touch-action:manipulation}.acjAgendaBlock:hover,.acjAgendaBlock:focus-visible{outline:2px solid #0f766e;outline-offset:1px}.acjAgendaBlock.overlap{background:#fee2e2;color:#991b1b;box-shadow:inset 0 0 0 1px #fca5a5,0 2px 6px rgba(15,23,42,.10)}.acjAgendaBlockTime{display:block;font-size:10px;font-weight:950;white-space:nowrap}.acjAgendaBlockClient{display:block;font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.acjAgendaBlockProduct{display:block;font-size:8px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.acjAgendaOverlapBadge{display:inline-block;margin-top:2px;font-size:7px;font-weight:950;text-transform:uppercase}.acjAgendaAvailable{position:absolute;left:5px;right:5px;border:1px dashed #fb923c;background:rgba(255,237,213,.60);border-radius:8px;color:#9a3412;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none}.acjAgendaNowLine{position:absolute;left:0;right:0;height:2px;background:#ef4444;z-index:6;pointer-events:none}.acjAgendaNowLine::before{content:'';position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:#ef4444}.acjAgendaLoad{padding:20px;text-align:center;color:#64748b;font-size:11px}.acjPlanningScroll.acjAgendaSourceHidden{display:none!important}@media(max-width:520px){.acjAgendaEmployeeTitle{font-size:11px}.acjAgendaGrid{--day-min:118px!important}.acjAgendaBlock{padding:4px 5px}.acjAgendaBlockProduct{display:none}}
    `;
    document.head.appendChild(style);
  }
  function sourceMeta(content) {
    const source = content.querySelector('.acjPlanningScroll');
    if (!source) return null;
    const mode = currentMode();
    if (!['day', 'week'].includes(mode)) return { mode, source, dates: [], employees: [] };
    const dayButtons = [...source.querySelectorAll('[data-acj-day][data-acj-employee]')];
    const dates = [...new Set(dayButtons.map((button) => String(button.dataset.acjDay || '')).filter(Boolean))];
    const employees = [];
    const seen = new Set();
    source.querySelectorAll('tbody tr').forEach((row) => {
      const button = row.querySelector('[data-acj-employee]');
      const id = String(button?.dataset?.acjEmployee || '');
      if (!id || seen.has(id)) return;
      seen.add(id);
      employees.push({ id, label: row.querySelector('.employeeCell')?.textContent?.trim() || 'Intervenante' });
    });
    return { mode, source, dates, employees };
  }
  function removeVisual(content, source) {
    content.querySelector(`.${VISUAL_CLASS}`)?.remove();
    source?.classList.remove('acjAgendaSourceHidden');
    detailObserver?.disconnect();
    detailObserver = null;
  }
  function groupLayout(services) {
    const rows = services.map((service) => ({ ...service, _start: toMinutes(service.start_time), _end: toMinutes(service.end_time) }))
      .filter((service) => service._start !== null && service._end !== null && service._end > service._start)
      .sort((a, b) => a._start - b._start || a._end - b._end);
    const groups = [];
    let current = [], groupEnd = -1;
    rows.forEach((service) => {
      if (!current.length || service._start < groupEnd) {
        current.push(service);
        groupEnd = Math.max(groupEnd, service._end);
      } else {
        groups.push(current);
        current = [service];
        groupEnd = service._end;
      }
    });
    if (current.length) groups.push(current);
    const output = [];
    groups.forEach((group) => {
      const laneEnds = [];
      group.forEach((service) => {
        let lane = laneEnds.findIndex((end) => end <= service._start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = service._end;
        output.push({ ...service, _lane: lane, _lanes: 1 });
      });
      const lanes = Math.max(1, laneEnds.length);
      output.slice(output.length - group.length).forEach((service) => { service._lanes = lanes; service._overlap = lanes > 1; });
    });
    return output;
  }
  function availabilityBands(services, startMin, endMin) {
    const rows = services.map((service) => ({ start: toMinutes(service.start_time), end: toMinutes(service.end_time) }))
      .filter((row) => row.start !== null && row.end !== null && row.end > row.start)
      .sort((a, b) => a.start - b.start);
    const merged = [];
    rows.forEach((row) => {
      const last = merged[merged.length - 1];
      if (last && row.start <= last.end) last.end = Math.max(last.end, row.end);
      else merged.push({ ...row });
    });
    const gaps = [];
    for (let i = 1; i < merged.length; i += 1) {
      const from = Math.max(startMin, merged[i - 1].end);
      const to = Math.min(endMin, merged[i].start);
      if (to - from >= 60) gaps.push({ from, to });
    }
    return gaps;
  }
  function blockFallback(service) {
    const client = service.id_customer ? `Client #${service.id_customer}` : 'Client';
    const product = service.product_level ? `Prestation ${service.product_level}` : 'Prestation';
    return { client, product };
  }
  function serviceBlock(service, startMin, ppm) {
    const fallback = blockFallback(service);
    const top = Math.max(0, (service._start - startMin) * ppm);
    const height = Math.max(30, (service._end - service._start) * ppm - 2);
    const width = 100 / service._lanes;
    const left = service._lane * width;
    const style = `top:${top}px;height:${height}px;left:calc(${left}% + 3px);width:calc(${width}% - 6px)`;
    return `<button type="button" class="acjAgendaBlock ${service._overlap ? 'overlap' : ''}" style="${style}" data-acj-visual-service="${esc(service.id_service)}" data-acj-visual-employee="${esc(service.id_employee)}" data-acj-visual-date="${esc(service.date)}"><span class="acjAgendaBlockTime">${esc(service.start_time)}–${esc(service.end_time)}</span><span class="acjAgendaBlockClient">${esc(fallback.client)}</span><span class="acjAgendaBlockProduct">${esc(fallback.product)}</span>${service._overlap ? '<span class="acjAgendaOverlapBadge">Chevauchement</span>' : ''}</button>`;
  }
  async function loadDetail(id) {
    if (detailCache.has(id)) return detailCache.get(id);
    const promise = api('service', { id_service: id }).then((data) => data?.service || null).catch(() => null);
    detailCache.set(id, promise);
    return promise;
  }
  function observeDetails(root) {
    detailObserver?.disconnect();
    detailObserver = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        const block = entry.target;
        detailObserver.unobserve(block);
        const id = String(block.dataset.acjVisualService || '');
        if (!id) return;
        const detail = await loadDetail(id);
        if (!detail || !block.isConnected) return;
        const client = block.querySelector('.acjAgendaBlockClient');
        const product = block.querySelector('.acjAgendaBlockProduct');
        if (client) client.textContent = detail.customer?.name || client.textContent;
        if (product) product.textContent = detail.product?.label || product.textContent;
      });
    }, { root: null, rootMargin: '180px 0px' });
    root.querySelectorAll('[data-acj-visual-service]').forEach((block) => detailObserver.observe(block));
  }
  function todayIso() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function parisMinutesNow() {
    const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const h = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const m = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    return h * 60 + m;
  }
  function triggerDay(employeeId, date) {
    const selector = `[data-acj-day="${CSS.escape(date)}"][data-acj-employee="${CSS.escape(employeeId)}"]`;
    document.querySelector(`#${PANEL_ID} ${selector}`)?.click();
  }
  async function openService(serviceId, employeeId, date) {
    triggerDay(employeeId, date);
    const deadline = Date.now() + 1800;
    while (Date.now() < deadline) {
      const button = document.querySelector(`#acjPlanningSheet [data-acj-service="${CSS.escape(serviceId)}"]`);
      if (button) { button.click(); return; }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
  function bindVisual(root) {
    root.addEventListener('click', (event) => {
      const block = event.target instanceof Element ? event.target.closest('[data-acj-visual-service]') : null;
      if (block) {
        event.preventDefault(); event.stopPropagation();
        openService(String(block.dataset.acjVisualService), String(block.dataset.acjVisualEmployee), String(block.dataset.acjVisualDate));
        return;
      }
      const add = event.target instanceof Element ? event.target.closest('[data-acj-visual-add]') : null;
      if (add) {
        event.preventDefault(); event.stopPropagation();
        triggerDay(String(add.dataset.acjVisualEmployee), String(add.dataset.acjVisualDate));
        return;
      }
      const day = event.target instanceof Element ? event.target.closest('[data-acj-visual-day]') : null;
      if (day) triggerDay(String(day.dataset.acjVisualEmployee), String(day.dataset.acjVisualDate));
    });
  }
  async function renderVisual() {
    const seq = ++renderSeq;
    const content = document.getElementById(CONTENT_ID);
    if (!content) return;
    const meta = sourceMeta(content);
    if (!meta) return;
    if (!['day', 'week'].includes(meta.mode) || !meta.dates.length || !meta.employees.length) {
      removeVisual(content, meta.source);
      return;
    }
    removeVisual(content, meta.source);
    meta.source.classList.add('acjAgendaSourceHidden');
    const visual = document.createElement('div');
    visual.className = VISUAL_CLASS;
    visual.innerHTML = '<div class="acjAgendaLoad">Construction de l’agenda visuel…</div>';
    meta.source.insertAdjacentElement('afterend', visual);
    const months = [...new Set(meta.dates.map(monthKey))];
    try {
      const datasets = await Promise.all(months.map((month) => api('month', { month })));
      if (seq !== renderSeq || !visual.isConnected) return;
      const employeeIds = new Set(meta.employees.map((employee) => employee.id));
      const dateSet = new Set(meta.dates);
      const services = [];
      const seen = new Set();
      datasets.forEach((data) => (data?.services || []).forEach((service) => {
        const id = String(service.id_service || '');
        if (!id || seen.has(id) || !employeeIds.has(String(service.id_employee)) || !dateSet.has(service.date)) return;
        seen.add(id); services.push(service);
      }));
      const timed = services.map((service) => ({ ...service, _start: toMinutes(service.start_time), _end: toMinutes(service.end_time) }))
        .filter((service) => service._start !== null && service._end !== null && service._end > service._start);
      const earliest = timed.length ? Math.min(...timed.map((service) => service._start)) : 7 * 60;
      const latest = timed.length ? Math.max(...timed.map((service) => service._end)) : 20 * 60;
      const startMin = Math.min(7 * 60, Math.floor(earliest / 60) * 60);
      const endMin = Math.max(20 * 60, Math.ceil(latest / 60) * 60);
      const ppm = meta.mode === 'day' ? 0.9 : 0.75;
      const bodyHeight = (endMin - startMin) * ppm;
      const dayMin = meta.mode === 'day' ? 280 : 126;
      const agendaMin = 52 + meta.dates.length * dayMin;
      const today = todayIso();
      const now = parisMinutesNow();
      const byCell = new Map();
      services.forEach((service) => {
        const key = `${service.id_employee}|${service.date}`;
        if (!byCell.has(key)) byCell.set(key, []);
        byCell.get(key).push(service);
      });
      const hourLines = [];
      for (let minute = startMin; minute <= endMin; minute += 60) hourLines.push(minute);
      let html = '<div class="acjAgendaHint">Touchez une prestation pour l’ouvrir. Touchez une zone vide ou + pour afficher la journée.</div>';
      meta.employees.forEach((employee) => {
        html += `<section class="acjAgendaEmployee"><div class="acjAgendaEmployeeTitle">${esc(employee.label)}</div><div class="acjAgendaScroll"><div class="acjAgendaGrid" style="--days:${meta.dates.length};--day-min:${dayMin}px;--agenda-min:${agendaMin}px;--hour-h:${60 * ppm}px"><div class="acjAgendaCorner"></div>`;
        meta.dates.forEach((date) => {
          html += `<div class="acjAgendaDayHead ${date === today ? 'today' : ''}"><strong>${esc(dayShort(date))}</strong><button type="button" data-acj-visual-add="1" data-acj-visual-employee="${esc(employee.id)}" data-acj-visual-date="${esc(date)}" aria-label="Ouvrir la journée">+</button></div>`;
        });
        html += `<div class="acjAgendaTimes" style="height:${bodyHeight}px">${hourLines.map((minute) => `<span class="acjAgendaTime" style="top:${(minute - startMin) * ppm}px">${String(Math.floor(minute / 60)).padStart(2, '0')}h</span>`).join('')}</div>`;
        meta.dates.forEach((date) => {
          const rows = byCell.get(`${employee.id}|${date}`) || [];
          const laid = groupLayout(rows);
          const gaps = availabilityBands(rows, startMin, endMin);
          html += `<div class="acjAgendaDay ${date === today ? 'today' : ''} ${rows.length ? '' : 'empty'}" style="height:${bodyHeight}px" data-acj-visual-day="1" data-acj-visual-employee="${esc(employee.id)}" data-acj-visual-date="${esc(date)}">`;
          html += gaps.map((gap) => `<div class="acjAgendaAvailable" style="top:${(gap.from - startMin) * ppm}px;height:${(gap.to - gap.from) * ppm}px">Disponible ${esc(durationText(gap.to - gap.from))}</div>`).join('');
          html += laid.map((service) => serviceBlock(service, startMin, ppm)).join('');
          if (date === today && now >= startMin && now <= endMin) html += `<div class="acjAgendaNowLine" style="top:${(now - startMin) * ppm}px"></div>`;
          html += '</div>';
        });
        html += '</div></div></section>';
      });
      visual.innerHTML = html;
      bindVisual(visual);
      observeDetails(visual);
    } catch (error) {
      if (seq !== renderSeq) return;
      meta.source.classList.remove('acjAgendaSourceHidden');
      visual.innerHTML = '<div class="acjAgendaLoad">Agenda visuel indisponible. Le planning classique reste accessible.</div>';
    }
  }
  function scheduleRender() {
    clearTimeout(scheduleRender.timer);
    scheduleRender.timer = setTimeout(renderVisual, 60);
  }
  function attach() {
    injectCss();
    const panel = document.getElementById(PANEL_ID);
    const content = document.getElementById(CONTENT_ID);
    if (!panel || !content) {
      setTimeout(attach, 200);
      return;
    }
    observer?.disconnect();
    observer = new MutationObserver(scheduleRender);
    observer.observe(content, { childList: true, subtree: true });
    panel.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-acj-view],#acjPlanningPrev,#acjPlanningNext,#acjPlanningNow')) scheduleRender();
    });
    document.getElementById('acjPlanningEmployeeFilter')?.addEventListener('change', scheduleRender);
    scheduleRender();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
})();
