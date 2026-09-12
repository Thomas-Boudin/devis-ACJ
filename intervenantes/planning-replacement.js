(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  let observer = null;
  let timer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function token() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  }
  function isAdmin() {
    return window.ACJ_INTERVENANTES_ROLE === 'admin' || localStorage.getItem('acj_intervenantes_role') === 'admin';
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
    if (!response.ok) {
      const error = new Error(data?.error || `HTTP_${response.status}`);
      error.payload = data;
      throw error;
    }
    return data;
  }
  function currentServiceId() {
    const subtitle = document.querySelector('#acjPlanningSheet .acjSheetSub')?.textContent || '';
    const match = subtitle.match(/intervention\s+(\d+)/i);
    return match ? match[1] : '';
  }
  function errorText(error) {
    const code = String(error?.message || '');
    const map = {
      AUTH_REQUIRED: 'Votre session a expiré. Reconnectez-vous.',
      AUTH_INVALID: 'Votre session a expiré. Reconnectez-vous.',
      ADMIN_REQUIRED: 'Cette fonction est réservée aux accès administrateur.',
      SERVICE_NOT_FOUND: 'Cette prestation n’existe plus dans Ogust.',
      SERVICE_NOT_REPLACEABLE: 'Le moteur n’a pas pu analyser cette prestation.',
      OPS_REPLACEMENTS_UNAVAILABLE: 'Le moteur de remplacements est momentanément indisponible.',
      OPS_INTERAPP_AUTH_FAILED: 'La liaison sécurisée avec Ops Hub est indisponible.',
      OPS_INTERAPP_NOT_CONFIGURED: 'La liaison avec Ops Hub n’est pas configurée.',
      SERVICE_UPDATE_NOT_VERIFIED: 'Le changement n’a pas pu être confirmé après relecture Ogust.',
      WRITE_RATE_LIMIT: 'Trop de modifications rapprochées. Réessayez dans quelques minutes.'
    };
    return map[code] || `Remplacement impossible (${code || 'erreur inconnue'}).`;
  }
  function durationText(minutes) {
    const n = Math.max(0, Number(minutes) || 0);
    const h = Math.floor(n / 60), m = n % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }
  function injectCss() {
    if (document.getElementById('acj-planning-replacement-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-planning-replacement-css';
    style.textContent = `
      .acjReplaceOpen{width:100%;min-height:50px;border:0;border-radius:13px;background:#0f172a;color:#fff;font-weight:950;margin-top:10px}.acjReplaceOpen:disabled{opacity:.55}.acjReplacePanel{margin-top:10px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:16px;padding:12px;display:grid;gap:10px}.acjReplacePanel h3{margin:0;font-size:15px}.acjReplaceIntro{font-size:11px;line-height:1.45;color:#64748b}.acjReplaceList{display:grid;gap:8px}.acjReplaceCandidate{width:100%;border:1px solid #dbe3ee;background:#fff;border-radius:14px;padding:11px;text-align:left;color:#0f172a}.acjReplaceCandidate.selected{border:2px solid #0f766e;background:#ecfdf5}.acjReplaceCandidate strong{display:block;font-size:14px}.acjReplaceCandidate .acjReplaceTop{display:flex;justify-content:space-between;gap:8px;align-items:center}.acjReplaceScore{font-size:11px;font-weight:950;color:#0f766e;white-space:nowrap}.acjReplaceMetrics{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.acjReplaceMetric{font-size:10px;font-weight:800;color:#475569;background:#f1f5f9;border-radius:999px;padding:4px 7px}.acjReplaceCandidate.selected .acjReplaceMetric{background:#fff}.acjReplaceReason{font-size:10px;line-height:1.45;color:#64748b;margin-top:7px}.acjReplaceBest{display:inline-flex;margin-top:5px;border-radius:999px;padding:4px 7px;background:#d1fae5;color:#166534;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.04em}.acjReplaceActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.acjReplaceActions button{min-height:47px;border:0;border-radius:12px;font-weight:900}.acjReplaceBack{background:#e9eef5;color:#334155}.acjReplaceConfirm{background:#0f766e;color:#fff}.acjReplaceConfirm:disabled{opacity:.5}.acjReplaceStatus{min-height:16px;font-size:11px;color:#b91c1c}.acjReplaceSuccess{padding:11px;border-radius:12px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:900}@media(max-width:520px){.acjReplaceActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  function refreshPlanning() {
    document.getElementById('acjPlanningSheet')?.remove();
    setTimeout(() => document.querySelector('#acjPlanningMonthPanel [data-acj-view].active')?.click(), 100);
  }
  function candidateMetrics(candidate) {
    const metrics = [];
    if (candidate.duree_trajet_minutes !== null && candidate.duree_trajet_minutes !== undefined) metrics.push(`${candidate.duree_trajet_minutes} min trajet`);
    else metrics.push('trajet inconnu');
    metrics.push(`${candidate.heures_deja_planifiees || durationText(candidate.minutes_deja_planifiees)} planifiées`);
    metrics.push(`avant ${candidate.marge_avant || 'Libre'}`);
    metrics.push(`après ${candidate.marge_apres || 'Libre'}`);
    return metrics;
  }
  function renderPanel(form, sourceService, data, button) {
    form.querySelector('.acjReplacePanel')?.remove();
    const prestation = data?.prestation || {};
    const candidates = Array.isArray(prestation.candidats) ? prestation.candidats : [];
    const panel = document.createElement('section');
    panel.className = 'acjReplacePanel';
    if (!candidates.length) {
      panel.innerHTML = `<h3>Trouver une remplaçante</h3><div class="acjReplaceIntro">Aucune intervenante éligible n’a été trouvée pour ce créneau.</div><div class="acjReplaceActions"><button type="button" class="acjReplaceBack">Fermer</button></div>`;
      form.appendChild(panel);
      panel.querySelector('.acjReplaceBack')?.addEventListener('click', () => panel.remove());
      button.disabled = false;
      button.textContent = 'Trouver une remplaçante';
      return;
    }

    panel.innerHTML = `
      <h3>Trouver une remplaçante</h3>
      <div class="acjReplaceIntro"><strong>${esc(prestation.niveau_confiance || '')}</strong>${prestation.decision_message ? ` · ${esc(prestation.decision_message)}` : ''}<br>Sélectionnez une candidate. Rien n’est écrit dans Ogust avant la confirmation finale.</div>
      <div class="acjReplaceList">${candidates.map((candidate) => {
        const reasons = Array.isArray(candidate.raisons) ? candidate.raisons.slice(0, 3).join(' · ') : '';
        return `<button type="button" class="acjReplaceCandidate" data-acj-replacement="${esc(candidate.id_intervenant)}"><div class="acjReplaceTop"><strong>${esc(candidate.intervenant)}</strong><span class="acjReplaceScore">${esc(candidate.score)} / 100</span></div>${candidate.recommande ? '<span class="acjReplaceBest">Recommandée</span>' : ''}<div class="acjReplaceMetrics">${candidateMetrics(candidate).map((metric) => `<span class="acjReplaceMetric">${esc(metric)}</span>`).join('')}</div>${reasons ? `<div class="acjReplaceReason">${esc(reasons)}</div>` : ''}</button>`;
      }).join('')}</div>
      <div class="acjReplaceStatus" id="acjReplaceStatus"></div>
      <div class="acjReplaceActions"><button type="button" class="acjReplaceBack" id="acjReplaceBack">Retour</button><button type="button" class="acjReplaceConfirm" id="acjReplaceConfirm" disabled>Affecter dans Ogust</button></div>`;
    form.appendChild(panel);
    button.disabled = false;
    button.textContent = 'Trouver une remplaçante';

    let selected = null;
    const confirmButton = panel.querySelector('#acjReplaceConfirm');
    panel.querySelectorAll('[data-acj-replacement]').forEach((node) => {
      node.addEventListener('click', () => {
        const id = String(node.dataset.acjReplacement || '');
        selected = candidates.find((candidate) => String(candidate.id_intervenant) === id) || null;
        panel.querySelectorAll('[data-acj-replacement]').forEach((item) => item.classList.toggle('selected', item === node));
        confirmButton.disabled = !selected;
      });
    });
    panel.querySelector('#acjReplaceBack')?.addEventListener('click', () => panel.remove());
    confirmButton?.addEventListener('click', async () => {
      if (!selected || !sourceService) return;
      const status = panel.querySelector('#acjReplaceStatus');
      const oldEmployee = sourceService.employee?.label || form.querySelector('select[name="id_employee"]')?.selectedOptions?.[0]?.textContent || 'Intervenante actuelle';
      const message = `Remplacer ${oldEmployee} par ${selected.intervenant} ?\n\n${sourceService.date} · ${sourceService.start_time}–${sourceService.end_time}\n\nCette modification sera enregistrée dans Ogust.`;
      if (!window.confirm(message)) return;
      confirmButton.disabled = true;
      status.textContent = 'Affectation puis relecture Ogust…';
      try {
        const result = await api('service_update', {
          method: 'POST',
          body: {
            id_service: sourceService.id_service,
            id_employee: String(selected.id_intervenant),
            date: sourceService.date,
            start: sourceService.start_time,
            end: sourceService.end_time,
            comment: sourceService.comment || '',
            confirm: true
          }
        });
        if (result?.verified !== true) throw new Error('SERVICE_UPDATE_NOT_VERIFIED');
        const reread = await api('service', { query: { id_service: sourceService.id_service } });
        if (String(reread?.service?.id_employee || '') !== String(selected.id_intervenant)) throw new Error('SERVICE_UPDATE_NOT_VERIFIED');
        panel.innerHTML = `<div class="acjReplaceSuccess">${esc(selected.intervenant)} affectée dans Ogust. La prestation a été relue et vérifiée.</div>`;
        setTimeout(refreshPlanning, 700);
      } catch (error) {
        confirmButton.disabled = false;
        status.textContent = errorText(error);
      }
    });
  }
  async function loadCandidates(form, button) {
    const idService = currentServiceId();
    if (!idService) return;
    button.disabled = true;
    button.textContent = 'Recherche des disponibilités…';
    form.querySelector('.acjReplacePanel')?.remove();
    try {
      const detail = await api('service', { query: { id_service: idService } });
      const service = detail?.service;
      if (!service?.date) throw new Error('SERVICE_NOT_FOUND');
      const data = await api('replacement_candidates', { query: { id_service: idService, date: service.date } });
      renderPanel(form, service, data, button);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Trouver une remplaçante';
      const panel = document.createElement('section');
      panel.className = 'acjReplacePanel';
      panel.innerHTML = `<div class="acjReplaceStatus">${esc(errorText(error))}</div>`;
      form.appendChild(panel);
    }
  }
  function decorate() {
    if (!isAdmin()) return;
    const form = document.querySelector('#acjPlanningSheet #acjEditForm');
    if (!form || form.dataset.acjReplacementReady === '1') return;
    form.dataset.acjReplacementReady = '1';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'acjReplaceOpen';
    button.textContent = 'Trouver une remplaçante';
    button.addEventListener('click', () => loadCandidates(form, button));
    const actions = form.querySelector('.acjFormActions');
    if (actions) actions.insertAdjacentElement('afterend', button);
    else form.appendChild(button);
  }
  function init() {
    injectCss();
    observer?.disconnect();
    observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setInterval(decorate, 700);
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
