(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const PANEL_ID = 'acjPlanningMonthPanel';
  let anchorDate = todayIso();
  let viewMode = 'month';
  let selectedEmployee = '';
  let periodData = null;
  let directory = null;
  let loadSeq = 0;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function authToken() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
  function todayIso() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function dateObj(value) {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12);
  }
  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function addDays(value, amount) {
    const d = dateObj(value);
    d.setDate(d.getDate() + amount);
    return isoDate(d);
  }
  function monthKey(value) { return String(value).slice(0, 7); }
  function shiftMonthDate(value, amount) {
    const d = dateObj(value);
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + amount, 1, 12);
    const max = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
    target.setDate(Math.min(day, max));
    return isoDate(target);
  }
  function startOfWeek(value) {
    const d = dateObj(value);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return isoDate(d);
  }
  function daysInMonth(value) {
    const [y, m] = monthKey(value).split('-').map(Number);
    return new Date(y, m, 0, 12).getDate();
  }
  function periodDates() {
    if (viewMode === 'day') return [anchorDate];
    if (viewMode === 'week') {
      const start = startOfWeek(anchorDate);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const key = monthKey(anchorDate);
    return Array.from({ length: daysInMonth(anchorDate) }, (_, index) => `${key}-${String(index + 1).padStart(2, '0')}`);
  }
  function dateLabel(value) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj(value));
  }
  function monthLabel(value) {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(dateObj(value));
  }
  function weekLabel(dates) {
    const first = dateObj(dates[0]);
    const last = dateObj(dates[dates.length - 1]);
    const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
    if (sameMonth) return `${first.getDate()}–${last.getDate()} ${new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(last)}`;
    return `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(first)} – ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(last)}`;
  }
  function periodTitle(dates = periodDates()) {
    if (viewMode === 'day') return dateLabel(dates[0]);
    if (viewMode === 'week') return weekLabel(dates);
    return monthLabel(anchorDate);
  }
  function dayName(value) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: viewMode === 'day' ? 'short' : 'narrow' }).format(dateObj(value)).replace('.', '').toUpperCase();
  }
  function mins(a, b) {
    if (!/^\d\d:\d\d$/.test(a || '') || !/^\d\d:\d\d$/.test(b || '')) return 0;
    const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number);
    return Math.max(0, bh * 60 + bm - ah * 60 - am);
  }
  function durationText(total) {
    if (!total) return '0h';
    const h = Math.floor(total / 60), m = total % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }
  function largestAvailability(services) {
    const rows = [...services].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    let available = 0;
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1]?.end_time || '';
      const next = rows[i]?.start_time || '';
      if (!/^\d\d:\d\d$/.test(previous) || !/^\d\d:\d\d$/.test(next)) continue;
      const [ph, pm] = previous.split(':').map(Number), [nh, nm] = next.split(':').map(Number);
      available = Math.max(available, nh * 60 + nm - (ph * 60 + pm));
    }
    return Math.max(0, available);
  }
  async function api(action, { method = 'GET', query = {}, body = null } = {}) {
    const url = new URL(API);
    url.searchParams.set('action', action);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${authToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || `HTTP_${response.status}`);
      error.payload = data;
      throw error;
    }
    return data;
  }
  function errorText(error) {
    const code = String(error?.message || '');
    const map = {
      MONTH_INVALID: 'Période invalide.',
      OGUST_UNAVAILABLE: 'Ogust est momentanément indisponible.',
      SERVICE_CONTRACT_NOT_FOUND: 'Aucun contrat actif ne correspond à ce client et à cette prestation.',
      SERVICE_CONTRACT_AMBIGUOUS: 'Plusieurs contrats correspondent. La création doit être vérifiée dans Ogust.',
      SERVICE_TIME_INVALID: 'Les horaires sont invalides.',
      SERVICE_DATE_INVALID: 'La date ou les horaires sont invalides.',
      SERVICE_PREVIEW_STALE: 'Les informations ont changé. Relancez la vérification avant de créer.',
      WRITE_RATE_LIMIT: 'Trop de modifications rapprochées. Réessayez dans quelques minutes.',
      SERVICE_CREATE_NOT_VERIFIED: 'La création n’a pas pu être confirmée après relecture Ogust.',
      SERVICE_UPDATE_NOT_VERIFIED: 'La modification n’a pas pu être confirmée après relecture Ogust.'
    };
    return map[code] || `Action impossible (${code || 'erreur inconnue'}).`;
  }

  function injectCss() {
    if (document.getElementById('acj-planning-month-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-planning-month-css';
    style.textContent = `
      .acjPlanningMonth{display:grid;gap:11px;margin-top:10px}.acjPlanningHead{display:flex;align-items:center;justify-content:space-between;gap:8px}.acjPlanningMonthTitle{font-weight:950;font-size:19px;text-transform:capitalize;line-height:1.2}.acjPlanningControls{display:flex;gap:6px;flex-shrink:0}.acjPlanningControls button,.acjPlanningAdd{border:0;border-radius:12px;min-height:42px;padding:0 12px;font-weight:900}.acjPlanningControls button{background:#e9eef5;color:#334155}.acjPlanningAdd{background:#0f766e;color:#fff}
      .acjPlanningToolbar{display:grid;grid-template-columns:auto minmax(150px,1fr);gap:8px}.acjPlanningViews{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;background:#e9eef5;border-radius:13px}.acjPlanningViews button{border:0;background:transparent;color:#64748b;border-radius:9px;min-height:38px;padding:0 10px;font-size:11px;font-weight:900}.acjPlanningViews button.active{background:#fff;color:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,.08)}.acjPlanningEmployeeFilter{width:100%;min-height:46px;border:1px solid #dbe3ee;background:#fff;border-radius:13px;padding:0 10px;color:#0f172a;font-weight:800;outline:none}
      .acjPlanningLegend{display:flex;gap:8px;flex-wrap:wrap;color:#64748b;font-size:10px;font-weight:800}.acjPlanningLegend span{display:flex;align-items:center;gap:5px}.acjPlanningLegend i{width:10px;height:10px;border-radius:3px;background:#eef2f7;border:1px solid #dbe3ee}.acjPlanningLegend .busy{background:#d1fae5;border-color:#6ee7b7}.acjPlanningLegend .available{background:#ffedd5;border-color:#fdba74}
      .acjPlanningScroll{overflow:auto;background:#fff;border:1px solid #dbe3ee;border-radius:18px;max-height:66vh}.acjPlanningGrid{border-collapse:separate;border-spacing:0;min-width:max-content;font-size:11px}.acjPlanningGrid th,.acjPlanningGrid td{border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:0;background:#fff}.acjPlanningGrid thead th{position:sticky;top:0;z-index:5;background:#f8fafc;height:49px;min-width:58px;text-align:center}.acjPlanningGrid .employeeHead,.acjPlanningGrid .employeeCell{position:sticky;left:0;z-index:6;min-width:142px;max-width:142px;text-align:left;padding:0 10px;background:#fff;box-shadow:3px 0 8px rgba(15,23,42,.04)}.acjPlanningGrid .employeeHead{z-index:8;background:#f8fafc}.acjPlanningGrid .employeeCell{height:62px;font-weight:900;line-height:1.2}.acjPlanningGrid .todayCol{box-shadow:inset 0 0 0 2px rgba(15,118,110,.32)}.acjDayCell{width:58px;height:62px;border:0;background:#f8fafc;color:#64748b;display:grid;place-content:center;gap:2px;text-align:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:rgba(15,118,110,.12)}.acjDayCell.busy{background:#ecfdf5;color:#14532d}.acjDayCell.available{background:#fff7ed;color:#9a3412}.acjDayCell strong{font-size:12px}.acjDayCell span{font-size:9px;font-weight:800}.acjDayCell:hover,.acjDayCell:focus-visible{outline:2px solid #0f766e;outline-offset:-2px}.acjDayHeader strong{display:block;font-size:13px}.acjDayHeader span{font-size:9px;color:#64748b}.acjPlanningGrid.dayView .acjDayCell{width:min(58vw,300px)}.acjPlanningGrid.dayView thead th:not(.employeeHead){min-width:min(58vw,300px)}
      .acjPlanningSummary{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;background:#0f172a;color:#fff;border-radius:16px;padding:11px 13px;font-size:11px}.acjPlanningSummary strong{font-size:15px}.acjPlanningLoading{padding:32px;text-align:center;color:#64748b;background:#fff;border:1px solid #dbe3ee;border-radius:18px}
      .acjSheetBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:90;display:flex;align-items:flex-end;justify-content:center;padding:12px}.acjSheet{width:min(100%,680px);max-height:88vh;overflow:auto;background:#fff;border-radius:24px 24px 18px 18px;padding:16px;box-shadow:0 -14px 45px rgba(15,23,42,.22)}.acjSheetTop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.acjSheetTop h2{margin:0;font-size:20px}.acjSheetClose{border:0;background:#e9eef5;color:#334155;border-radius:999px;width:38px;height:38px;font-size:18px}.acjSheetSub{color:#64748b;font-size:12px;margin-top:4px}.acjDayServices{display:grid;gap:9px;margin-top:14px}.acjDayService{border:1px solid #dbe3ee;background:#fff;border-radius:15px;padding:12px;text-align:left;width:100%;color:#0f172a}.acjDayService strong{display:block;font-size:15px}.acjDayService span{display:block;color:#64748b;font-size:11px;margin-top:3px}.acjDayAdd{width:100%;min-height:48px;border:0;border-radius:13px;background:#0f766e;color:#fff;font-weight:900;margin-top:12px}
      .acjForm{display:grid;gap:10px;margin-top:14px}.acjField{display:grid;gap:5px}.acjField label{font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:.05em}.acjField input,.acjField select,.acjField textarea{width:100%;border:1px solid #cbd5e1;border-radius:12px;min-height:44px;padding:9px 10px;background:#fff;color:#0f172a}.acjField textarea{min-height:82px;resize:vertical}.acjFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.acjFormActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.acjFormActions button{min-height:48px;border:0;border-radius:13px;font-weight:900}.acjFormActions .secondary{background:#e9eef5;color:#334155}.acjFormActions .primary{background:#0f766e;color:#fff}.acjPreview{padding:11px;border-radius:13px;background:#ecfdf5;color:#14532d;font-size:12px;line-height:1.5}.acjFormStatus{font-size:12px;color:#b91c1c;min-height:18px}.acjServiceMeta{background:#f8fafc;border-radius:13px;padding:11px;font-size:12px;line-height:1.5;color:#334155}
      @media(max-width:520px){.acjPlanningToolbar{grid-template-columns:1fr}.acjPlanningGrid .employeeHead,.acjPlanningGrid .employeeCell{min-width:116px;max-width:116px;padding:0 7px;font-size:10px}.acjPlanningGrid thead th{min-width:52px}.acjDayCell{width:52px}.acjFormGrid,.acjFormActions{grid-template-columns:1fr}.acjPlanningMonthTitle{font-size:17px}.acjPlanningControls button{padding:0 10px}}
    `;
    document.head.appendChild(style);
  }

  function pageParts() {
    return ['.pilot', '.datebar', '.dayStrip', '.summary', '#list'].map((selector) => document.querySelector(selector)).filter(Boolean);
  }
  function buildPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'acjPlanningMonth';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="acjPlanningHead"><div class="acjPlanningMonthTitle" id="acjPlanningMonthTitle"></div><div class="acjPlanningControls"><button type="button" id="acjPlanningPrev" aria-label="Période précédente">‹</button><button type="button" id="acjPlanningNow">Aujourd'hui</button><button type="button" id="acjPlanningNext" aria-label="Période suivante">›</button></div></div>
      <div class="acjPlanningToolbar"><div class="acjPlanningViews"><button type="button" data-acj-view="day">Jour</button><button type="button" data-acj-view="week">Semaine</button><button type="button" data-acj-view="month">Mois</button></div><select id="acjPlanningEmployeeFilter" class="acjPlanningEmployeeFilter"><option value="">Toutes les intervenantes</option></select></div>
      <div class="acjPlanningLegend"><span><i></i> Libre</span><span><i class="busy"></i> Planifié</span><span><i class="available"></i> Créneau disponible ≥ 1 h</span></div>
      <button type="button" class="acjPlanningAdd" id="acjPlanningAdd">+ Nouvelle prestation</button>
      <div id="acjPlanningContent" class="acjPlanningLoading">Ouvrez Planning pour charger les données Ogust.</div>`;
    const app = document.getElementById('app');
    const nav = app?.querySelector('.bottomNav');
    if (nav) app.insertBefore(panel, nav);
    else app?.appendChild(panel);

    document.getElementById('acjPlanningPrev')?.addEventListener('click', () => movePeriod(-1));
    document.getElementById('acjPlanningNext')?.addEventListener('click', () => movePeriod(1));
    document.getElementById('acjPlanningNow')?.addEventListener('click', () => { anchorDate = todayIso(); loadPeriod(); });
    document.getElementById('acjPlanningAdd')?.addEventListener('click', () => openCreate({ date: anchorDate, employeeId: selectedEmployee || document.getElementById('employee')?.value || '' }));
    document.getElementById('acjPlanningEmployeeFilter')?.addEventListener('change', (event) => {
      selectedEmployee = String(event.target.value || '');
      if (periodData) renderPeriod(periodData);
    });
    panel.querySelectorAll('[data-acj-view]').forEach((button) => button.addEventListener('click', () => {
      viewMode = button.dataset.acjView;
      loadPeriod();
    }));
    panel.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-acj-day]') : null;
      if (!target || !panel.contains(target)) return;
      event.preventDefault();
      const employeeId = String(target.dataset.acjEmployee || '');
      const date = String(target.dataset.acjDay || '');
      if (employeeId && date) openDay(employeeId, date);
    });
    syncViewButtons();
    return panel;
  }
  function syncViewButtons() {
    document.querySelectorAll('[data-acj-view]').forEach((button) => button.classList.toggle('active', button.dataset.acjView === viewMode));
    const now = document.getElementById('acjPlanningNow');
    if (now) now.textContent = viewMode === 'month' ? 'Ce mois' : "Aujourd'hui";
  }
  function movePeriod(direction) {
    if (viewMode === 'day') anchorDate = addDays(anchorDate, direction);
    else if (viewMode === 'week') anchorDate = addDays(anchorDate, direction * 7);
    else anchorDate = shiftMonthDate(anchorDate, direction);
    loadPeriod();
  }
  function activatePlanning() {
    const panel = buildPanel();
    pageParts().forEach((el) => { el.hidden = true; });
    const liaison = document.getElementById('liaisonPanel');
    if (liaison) liaison.hidden = true;
    panel.hidden = false;
    const title = document.querySelector('.top h1');
    if (title) title.textContent = 'Planning';
    const navItems = [...document.querySelectorAll('.bottomNav .navItem')];
    navItems.forEach((button, index) => button.classList.toggle('active', index === 1));
    loadPeriod();
  }
  function showToday() {
    const panel = buildPanel();
    panel.hidden = true;
    pageParts().forEach((el) => { el.hidden = false; });
    const liaison = document.getElementById('liaisonPanel');
    if (liaison) liaison.hidden = true;
    const title = document.querySelector('.top h1');
    if (title) title.textContent = 'Ma journée';
  }

  function mergeDatasets(datasets) {
    const employees = new Map();
    const services = new Map();
    datasets.forEach((data) => {
      (data?.employees || []).forEach((employee) => employees.set(String(employee.id_employee), employee));
      (data?.services || []).forEach((service) => services.set(String(service.id_service), service));
    });
    return {
      employees: [...employees.values()].sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr')),
      services: [...services.values()].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
    };
  }
  async function loadPeriod() {
    const seq = ++loadSeq;
    const panel = buildPanel();
    const content = document.getElementById('acjPlanningContent');
    const dates = periodDates();
    const title = document.getElementById('acjPlanningMonthTitle');
    syncViewButtons();
    if (title) title.textContent = periodTitle(dates);
    if (content) { content.className = 'acjPlanningLoading'; content.textContent = 'Chargement du planning Ogust…'; }
    try {
      const months = [...new Set(dates.map(monthKey))];
      const datasets = await Promise.all(months.map((month) => api('month', { query: { month } })));
      if (seq !== loadSeq || panel.hidden) return;
      periodData = mergeDatasets(datasets);
      renderPeriod(periodData, dates);
    } catch (error) {
      if (seq !== loadSeq) return;
      if (content) { content.className = 'acjPlanningLoading'; content.textContent = errorText(error); }
    }
  }
  function updateEmployeeFilter(employees) {
    const select = document.getElementById('acjPlanningEmployeeFilter');
    if (!select) return;
    if (selectedEmployee && !employees.some((employee) => String(employee.id_employee) === selectedEmployee)) selectedEmployee = '';
    select.innerHTML = `<option value="">Toutes les intervenantes</option>${employees.map((employee) => `<option value="${esc(employee.id_employee)}" ${String(employee.id_employee) === selectedEmployee ? 'selected' : ''}>${esc(employee.label)}</option>`).join('')}`;
    select.value = selectedEmployee;
  }
  function renderPeriod(data, dates = periodDates()) {
    const content = document.getElementById('acjPlanningContent');
    if (!content) return;
    const allEmployees = Array.isArray(data?.employees) ? data.employees : [];
    updateEmployeeFilter(allEmployees);
    const dateSet = new Set(dates);
    const employees = selectedEmployee ? allEmployees.filter((employee) => String(employee.id_employee) === selectedEmployee) : allEmployees;
    const employeeIds = new Set(employees.map((employee) => String(employee.id_employee)));
    const services = (Array.isArray(data?.services) ? data.services : []).filter((service) => dateSet.has(service.date) && employeeIds.has(String(service.id_employee)));
    const byCell = new Map();
    services.forEach((service) => {
      const key = `${service.id_employee}|${service.date}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key).push(service);
    });
    const today = todayIso();
    const totalMinutes = services.reduce((sum, service) => sum + mins(service.start_time, service.end_time), 0);
    const availabilityCells = [...byCell.values()].filter((rows) => largestAvailability(rows) >= 60).length;
    let html = `<div class="acjPlanningSummary"><span><strong>${employees.length}</strong> intervenante${employees.length > 1 ? 's' : ''}</span><span><strong>${services.length}</strong> prestations</span><span><strong>${durationText(totalMinutes)}</strong> planifiées</span><span><strong>${availabilityCells}</strong> créneau${availabilityCells > 1 ? 'x' : ''} disponible${availabilityCells > 1 ? 's' : ''} ≥ 1 h</span></div>`;
    html += `<div class="acjPlanningScroll"><table class="acjPlanningGrid ${viewMode === 'day' ? 'dayView' : ''}"><thead><tr><th class="employeeHead">Intervenante</th>`;
    dates.forEach((date) => {
      const day = Number(date.slice(-2));
      html += `<th class="${date === today ? 'todayCol' : ''}"><div class="acjDayHeader"><span>${esc(dayName(date))}</span><strong>${day}</strong></div></th>`;
    });
    html += '</tr></thead><tbody>';
    employees.forEach((employee) => {
      html += `<tr><th class="employeeCell">${esc(employee.label)}</th>`;
      dates.forEach((date) => {
        const rows = byCell.get(`${employee.id_employee}|${date}`) || [];
        const total = rows.reduce((sum, service) => sum + mins(service.start_time, service.end_time), 0);
        const available = largestAvailability(rows);
        const className = available >= 60 ? 'available' : rows.length ? 'busy' : '';
        html += `<td class="${date === today ? 'todayCol' : ''}"><button type="button" class="acjDayCell ${className}" data-acj-day="${esc(date)}" data-acj-employee="${esc(employee.id_employee)}" aria-label="Ouvrir ${esc(employee.label)}, ${esc(dateLabel(date))}"><strong>${rows.length || '·'}</strong><span>${rows.length ? durationText(total) : 'libre'}</span>${available >= 60 ? `<span>dispo ${durationText(available)}</span>` : ''}</button></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (!employees.length) html = '<div class="acjPlanningLoading">Aucune intervenante à afficher.</div>';
    content.className = '';
    content.innerHTML = html;
  }

  function sheet(title, subtitle = '') {
    closeSheet();
    const backdrop = document.createElement('div');
    backdrop.className = 'acjSheetBackdrop';
    backdrop.id = 'acjPlanningSheet';
    backdrop.innerHTML = `<section class="acjSheet"><div class="acjSheetTop"><div><h2>${esc(title)}</h2><div class="acjSheetSub">${esc(subtitle)}</div></div><button type="button" class="acjSheetClose" aria-label="Fermer">×</button></div><div id="acjSheetBody"></div></section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.acjSheetClose')?.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeSheet(); });
    return document.getElementById('acjSheetBody');
  }
  function closeSheet() { document.getElementById('acjPlanningSheet')?.remove(); }
  function employeeLabel(id) {
    const rows = periodData?.employees || directory?.employees || [];
    return rows.find((item) => String(item.id_employee) === String(id))?.label || 'Intervenante';
  }

  async function openDay(employeeId, date) {
    const body = sheet(dateLabel(date), employeeLabel(employeeId));
    body.innerHTML = '<div class="acjPlanningLoading">Chargement des prestations…</div>';
    try {
      const data = await api('planning', { query: { employee_id: employeeId, date } });
      const services = Array.isArray(data?.services) ? data.services : [];
      body.innerHTML = `<div class="acjDayServices">${services.length ? services.map((service) => {
        const customer = service.customer?.name || 'Client';
        const product = service.product?.label || 'Prestation';
        return `<button type="button" class="acjDayService" data-acj-service="${esc(service.id_service)}"><strong>${esc(service.start_time)} – ${esc(service.end_time)} · ${esc(customer)}</strong><span>${esc(product)}${service.status ? ` · ${esc(service.status)}` : ''}</span></button>`;
      }).join('') : '<div class="acjServiceMeta">Aucune prestation prévue.</div>'}</div><button type="button" class="acjDayAdd" id="acjDayAdd">+ Ajouter une prestation</button>`;
      body.querySelectorAll('[data-acj-service]').forEach((button) => button.addEventListener('click', () => openEdit(button.dataset.acjService)));
      document.getElementById('acjDayAdd')?.addEventListener('click', () => openCreate({ date, employeeId }));
    } catch (error) {
      body.innerHTML = `<div class="acjServiceMeta">${esc(errorText(error))}</div>`;
    }
  }

  async function ensureDirectory() {
    if (directory) return directory;
    directory = await api('directory');
    return directory;
  }
  function optionList(rows, valueKey, labelKey, selected = '') {
    return (rows || []).map((row) => `<option value="${esc(row[valueKey])}" ${String(row[valueKey]) === String(selected) ? 'selected' : ''}>${esc(row[labelKey])}</option>`).join('');
  }

  async function openCreate({ date, employeeId }) {
    const body = sheet('Nouvelle prestation', `${dateLabel(date)} · ${employeeLabel(employeeId)}`);
    body.innerHTML = '<div class="acjPlanningLoading">Chargement des clients et prestations Ogust…</div>';
    try {
      const dir = await ensureDirectory();
      body.innerHTML = `<form class="acjForm" id="acjCreateForm">
        <div class="acjField"><label>Client actif</label><select name="id_customer" required><option value="">Choisir…</option>${optionList(dir.customers, 'id_customer', 'label')}</select></div>
        <div class="acjField"><label>Prestation</label><select name="product_level" required><option value="">Choisir…</option>${optionList(dir.products, 'id_productlevel', 'label')}</select></div>
        <div class="acjField"><label>Intervenante</label><select name="id_employee" required>${optionList(dir.employees, 'id_employee', 'label', employeeId)}</select></div>
        <div class="acjFormGrid"><div class="acjField"><label>Date</label><input type="date" name="date" value="${esc(date)}" required></div><div></div><div class="acjField"><label>Début</label><input type="time" name="start" value="09:00" required></div><div class="acjField"><label>Fin</label><input type="time" name="end" value="11:00" required></div></div>
        <div class="acjField"><label>Ordre de mission / consignes</label><textarea name="comment" maxlength="500"></textarea></div>
        <div id="acjCreatePreview"></div><div class="acjFormStatus" id="acjCreateStatus"></div>
        <div class="acjFormActions"><button type="button" class="secondary" id="acjCreateCheck">Vérifier dans Ogust</button><button type="button" class="primary" id="acjCreateSave" disabled>Créer dans Ogust</button></div>
      </form>`;
      let fingerprint = '';
      let checkedPayload = null;
      const form = document.getElementById('acjCreateForm');
      const status = document.getElementById('acjCreateStatus');
      const previewBox = document.getElementById('acjCreatePreview');
      const save = document.getElementById('acjCreateSave');
      const readPayload = () => Object.fromEntries(new FormData(form).entries());
      form.addEventListener('input', () => { fingerprint = ''; checkedPayload = null; save.disabled = true; previewBox.innerHTML = ''; });
      document.getElementById('acjCreateCheck')?.addEventListener('click', async () => {
        status.textContent = 'Vérification du contrat Ogust…';
        try {
          const service = readPayload();
          const preview = await api('service_preview', { method: 'POST', body: { service } });
          fingerprint = preview.preview_fingerprint;
          checkedPayload = service;
          save.disabled = false;
          status.textContent = '';
          previewBox.innerHTML = `<div class="acjPreview"><strong>Prêt à créer</strong><br>${esc(preview.customer?.name || '')} · ${esc(preview.product?.label || '')}<br>${esc(preview.employee?.label || '')}<br>Contrat : ${esc(preview.contract?.reference || preview.contract?.id_contract || '')}</div>`;
        } catch (error) { save.disabled = true; status.textContent = errorText(error); }
      });
      save.addEventListener('click', async () => {
        if (!fingerprint || !checkedPayload) return;
        save.disabled = true;
        status.textContent = 'Création dans Ogust…';
        try {
          const result = await api('service_create', { method: 'POST', body: { service: checkedPayload, preview_fingerprint: fingerprint, confirm: true } });
          if (result.verified !== true) throw new Error('SERVICE_CREATE_NOT_VERIFIED');
          closeSheet();
          await loadPeriod();
          openDay(checkedPayload.id_employee, checkedPayload.date);
        } catch (error) { save.disabled = false; status.textContent = errorText(error); }
      });
    } catch (error) {
      body.innerHTML = `<div class="acjServiceMeta">${esc(errorText(error))}</div>`;
    }
  }

  async function openEdit(idService) {
    const body = sheet('Modifier la prestation', `Ogust · intervention ${idService}`);
    body.innerHTML = '<div class="acjPlanningLoading">Lecture de la prestation Ogust…</div>';
    try {
      const [detail, dir] = await Promise.all([api('service', { query: { id_service: idService } }), ensureDirectory()]);
      const service = detail.service || {};
      body.innerHTML = `<form class="acjForm" id="acjEditForm">
        <div class="acjServiceMeta"><strong>${esc(service.customer?.name || 'Client')}</strong><br>${esc(service.product?.label || 'Prestation')}<br>Statut : ${esc(service.status || '—')}</div>
        <div class="acjField"><label>Intervenante</label><select name="id_employee" required>${optionList(dir.employees, 'id_employee', 'label', service.id_employee)}</select></div>
        <div class="acjFormGrid"><div class="acjField"><label>Date</label><input type="date" name="date" value="${esc(service.date || '')}" required></div><div></div><div class="acjField"><label>Début</label><input type="time" name="start" value="${esc(service.start_time || '')}" required></div><div class="acjField"><label>Fin</label><input type="time" name="end" value="${esc(service.end_time || '')}" required></div></div>
        <div class="acjField"><label>Ordre de mission / consignes</label><textarea name="comment" maxlength="500">${esc(service.comment || '')}</textarea></div>
        <div class="acjFormStatus" id="acjEditStatus"></div>
        <div class="acjFormActions"><button type="button" class="secondary" id="acjEditCancel">Annuler</button><button type="button" class="primary" id="acjEditSave">Enregistrer dans Ogust</button></div>
      </form>`;
      document.getElementById('acjEditCancel')?.addEventListener('click', closeSheet);
      document.getElementById('acjEditSave')?.addEventListener('click', async () => {
        const form = document.getElementById('acjEditForm');
        const status = document.getElementById('acjEditStatus');
        const save = document.getElementById('acjEditSave');
        const values = Object.fromEntries(new FormData(form).entries());
        if (!window.confirm(`Enregistrer cette modification dans Ogust ?\n${dateLabel(values.date)} · ${values.start}–${values.end}`)) return;
        save.disabled = true;
        status.textContent = 'Écriture puis relecture Ogust…';
        try {
          const result = await api('service_update', { method: 'POST', body: { id_service: idService, ...values, confirm: true } });
          if (result.verified !== true) throw new Error('SERVICE_UPDATE_NOT_VERIFIED');
          const updated = result.service;
          closeSheet();
          await loadPeriod();
          openDay(updated.id_employee, updated.date);
        } catch (error) { save.disabled = false; status.textContent = errorText(error); }
      });
    } catch (error) {
      body.innerHTML = `<div class="acjServiceMeta">${esc(errorText(error))}</div>`;
    }
  }

  function init() {
    injectCss();
    buildPanel();
    const navItems = [...document.querySelectorAll('.bottomNav .navItem')];
    if (navItems.length < 3) return;
    navItems[1].disabled = false;
    navItems[1].addEventListener('click', activatePlanning);
    navItems[0].addEventListener('click', showToday);
    navItems[2].addEventListener('click', () => { const panel = buildPanel(); panel.hidden = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
