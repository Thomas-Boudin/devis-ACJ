(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const PANEL_ID = 'acjPlanningMonthPanel';
  const HOLD_MS = 320;
  const SNAP_MIN = 15;
  let drag = null;
  let toastTimer = null;
  let suppressClickUntil = 0;

  function token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function timeFromMinutes(min) {
    const value = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
    return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
  }
  function toMinutes(value) {
    if (!/^\d\d:\d\d$/.test(String(value || ''))) return null;
    const [h, m] = String(value).split(':').map(Number);
    return h * 60 + m;
  }
  function addMinutes(time, amount) {
    const start = toMinutes(time);
    return start === null ? time : timeFromMinutes(start + amount);
  }
  function dateLabel(value) {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d, 12));
  }
  async function api(action, { method = 'GET', query = {}, body = null } = {}) {
    const url = new URL(API);
    url.searchParams.set('action', action);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
    return data;
  }
  function toast(message, error = false) {
    let node = document.getElementById('acjDndToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'acjDndToast';
      document.body.appendChild(node);
    }
    node.className = `acjDndToast ${error ? 'error' : ''}`;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3200);
  }
  function injectCss() {
    if (document.getElementById('acj-dnd-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-dnd-css';
    style.textContent = `
      .acjAgendaBlock{touch-action:none!important;user-select:none;-webkit-user-select:none}.acjAgendaBlock.acjDndArmed{outline:3px solid #0f766e!important;outline-offset:2px;opacity:.8}.acjAgendaDay.acjDndTarget{box-shadow:inset 0 0 0 3px #0f766e;background-color:#ecfdf5!important}.acjDndGhost{position:fixed;z-index:9999;pointer-events:none;min-width:150px;max-width:230px;padding:8px 10px;border-radius:12px;background:#0f172a;color:#fff;box-shadow:0 12px 28px rgba(15,23,42,.28);font-size:11px;font-weight:900;transform:translate(10px,10px)}.acjDndGhost small{display:block;font-size:9px;opacity:.72;margin-top:3px}.acjDndToast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;max-width:calc(100vw - 28px);padding:11px 14px;border-radius:13px;background:#0f172a;color:#fff;font-size:12px;font-weight:900;box-shadow:0 10px 28px rgba(15,23,42,.24)}.acjDndToast.error{background:#991b1b}.acjDndHelp{font-size:10px;color:#64748b;font-weight:800;margin-top:-4px}.acjDndDropTime{position:absolute;left:4px;right:4px;height:2px;background:#0f766e;z-index:20;pointer-events:none}.acjDndDropTime::after{content:attr(data-time);position:absolute;right:4px;top:-11px;background:#0f766e;color:#fff;border-radius:6px;padding:2px 5px;font-size:8px;font-weight:950}
    `;
    document.head.appendChild(style);
  }
  function currentVisual() { return document.querySelector('#acjPlanningContent .acjAgendaVisual'); }
  function sourceBlock(target) { return target instanceof Element ? target.closest('[data-acj-visual-service]') : null; }
  function targetDayAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    return hit instanceof Element ? hit.closest('[data-acj-visual-day]') : null;
  }
  function removeTarget() {
    document.querySelectorAll('.acjDndTarget').forEach((el) => el.classList.remove('acjDndTarget'));
    document.querySelectorAll('.acjDndDropTime').forEach((el) => el.remove());
  }
  function clearDrag() {
    clearTimeout(drag?.holdTimer);
    drag?.block?.classList.remove('acjDndArmed');
    drag?.ghost?.remove();
    removeTarget();
    drag = null;
  }
  function parseTimeline(day) {
    const grid = day?.closest('.acjAgendaGrid');
    if (!day || !grid) return null;
    const times = [...grid.querySelectorAll('.acjAgendaTime')];
    if (times.length < 2) return null;
    const firstHour = Number(String(times[0].textContent || '').replace(/\D/g, ''));
    const lastHour = Number(String(times[times.length - 1].textContent || '').replace(/\D/g, ''));
    if (!Number.isFinite(firstHour) || !Number.isFinite(lastHour) || lastHour <= firstHour) return null;
    const rect = day.getBoundingClientRect();
    const startMin = firstHour * 60;
    const endMin = lastHour * 60;
    return { rect, startMin, endMin, ppm: rect.height / (endMin - startMin) };
  }
  function proposedStart(day, clientY, duration) {
    const line = parseTimeline(day);
    if (!line) return null;
    const raw = line.startMin + (clientY - line.rect.top) / line.ppm;
    let snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
    const latestStart = Math.max(line.startMin, line.endMin - duration);
    snapped = Math.max(line.startMin, Math.min(latestStart, snapped));
    return { ...line, minute: snapped, time: timeFromMinutes(snapped) };
  }
  function showTarget(day, clientY, duration) {
    removeTarget();
    if (!day) return null;
    const proposed = proposedStart(day, clientY, duration);
    if (!proposed) return null;
    day.classList.add('acjDndTarget');
    const marker = document.createElement('div');
    marker.className = 'acjDndDropTime';
    marker.dataset.time = proposed.time;
    marker.style.top = `${(proposed.minute - proposed.startMin) * proposed.ppm}px`;
    day.appendChild(marker);
    return proposed;
  }
  async function beginDrag(block, event) {
    if (!block.isConnected || drag?.active) return;
    const id = String(block.dataset.acjVisualService || '');
    if (!id) return;
    try {
      const detailData = await api('service', { query: { id_service: id } });
      if (!drag || drag.block !== block) return;
      const service = detailData?.service;
      if (!service) throw new Error('SERVICE_NOT_FOUND');
      const start = toMinutes(service.start_time);
      const end = toMinutes(service.end_time);
      if (start === null || end === null || end <= start) throw new Error('SERVICE_TIME_INVALID');
      drag.active = true;
      drag.service = service;
      drag.duration = end - start;
      drag.block.classList.add('acjDndArmed');
      suppressClickUntil = Date.now() + 2000;
      const ghost = document.createElement('div');
      ghost.className = 'acjDndGhost';
      ghost.innerHTML = `${service.start_time}–${service.end_time}<small>Déplacez puis relâchez · durée ${drag.duration} min</small>`;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      moveGhost(event.clientX, event.clientY);
      toast('Déplacement activé — relâchez sur le nouvel horaire');
    } catch {
      clearDrag();
      toast('Impossible de préparer le déplacement.', true);
    }
  }
  function moveGhost(x, y) {
    if (!drag?.ghost) return;
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;
  }
  async function commitDrop(day, proposed) {
    const service = drag?.service;
    if (!service || !day || !proposed) return clearDrag();
    const idEmployee = String(day.dataset.acjVisualEmployee || '');
    const date = String(day.dataset.acjVisualDate || '');
    const start = proposed.time;
    const end = addMinutes(start, drag.duration);
    const oldEmployee = String(service.id_employee || '');
    const oldDate = String(service.date || '');
    const oldStart = String(service.start_time || '');
    const oldEnd = String(service.end_time || '');
    if (idEmployee === oldEmployee && date === oldDate && start === oldStart) return clearDrag();
    const employeeName = day.closest('.acjAgendaEmployee')?.querySelector('.acjAgendaEmployeeTitle')?.textContent?.trim() || 'Intervenante';
    const message = `Déplacer cette prestation ?\n\nDe : ${dateLabel(oldDate)} · ${oldStart}–${oldEnd}\nVers : ${dateLabel(date)} · ${start}–${end}\nIntervenante : ${employeeName}`;
    if (!window.confirm(message)) return clearDrag();
    const payload = {
      id_service: String(service.id_service),
      id_employee: idEmployee,
      date,
      start,
      end,
      comment: String(service.comment || ''),
      confirm: true
    };
    suppressClickUntil = Date.now() + 2000;
    clearDrag();
    toast('Modification dans Ogust…');
    try {
      const result = await api('service_update', { method: 'POST', body: payload });
      if (result?.verified !== true) throw new Error('SERVICE_UPDATE_NOT_VERIFIED');
      const reread = await api('service', { query: { id_service: payload.id_service } });
      const updated = reread?.service;
      if (!updated || String(updated.id_employee) !== idEmployee || updated.date !== date || updated.start_time !== start || updated.end_time !== end) throw new Error('SERVICE_UPDATE_NOT_VERIFIED');
      toast('Prestation déplacée dans Ogust');
      document.querySelector(`#${PANEL_ID} [data-acj-view].active`)?.click();
    } catch (error) {
      toast(`Déplacement non enregistré (${String(error?.message || 'erreur')})`, true);
      document.querySelector(`#${PANEL_ID} [data-acj-view].active`)?.click();
    }
  }
  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const block = sourceBlock(event.target);
    if (!block || !currentVisual()?.contains(block)) return;
    clearDrag();
    drag = { block, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false, service: null, duration: 0, holdTimer: null, ghost: null, targetDay: null, proposed: null };
    drag.holdTimer = setTimeout(() => beginDrag(block, event), HOLD_MS);
  }
  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active) {
      if (distance > 12) clearDrag();
      return;
    }
    event.preventDefault();
    moveGhost(event.clientX, event.clientY);
    const day = targetDayAt(event.clientX, event.clientY);
    drag.targetDay = day;
    drag.proposed = showTarget(day, event.clientY, drag.duration);
  }
  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active) return clearDrag();
    event.preventDefault();
    suppressClickUntil = Date.now() + 2000;
    const day = drag.targetDay || targetDayAt(event.clientX, event.clientY);
    const proposed = drag.proposed || (day ? proposedStart(day, event.clientY, drag.duration) : null);
    commitDrop(day, proposed);
  }
  function onPointerCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    clearDrag();
  }
  function onClickCapture(event) {
    if (Date.now() >= suppressClickUntil) return;
    if (!sourceBlock(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function onContextMenu(event) {
    const block = sourceBlock(event.target);
    if (!block || !currentVisual()?.contains(block)) return;
    event.preventDefault();
  }
  function addHelp() {
    const visual = currentVisual();
    if (!visual || visual.querySelector('.acjDndHelp')) return;
    const hint = visual.querySelector('.acjAgendaHint');
    if (!hint) return;
    const help = document.createElement('div');
    help.className = 'acjDndHelp';
    help.textContent = 'Déplacer : appui long sur une prestation puis glissez-la. Le nouvel horaire est arrondi au quart d’heure. Confirmation obligatoire avant écriture Ogust.';
    hint.insertAdjacentElement('afterend', help);
  }
  function observeVisual() {
    const content = document.getElementById('acjPlanningContent');
    if (!content) return setTimeout(observeVisual, 250);
    const observer = new MutationObserver(() => setTimeout(addHelp, 80));
    observer.observe(content, { childList: true, subtree: true });
    addHelp();
  }
  function init() {
    injectCss();
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, { passive: false });
    document.addEventListener('pointercancel', onPointerCancel, { passive: true });
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    observeVisual();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
