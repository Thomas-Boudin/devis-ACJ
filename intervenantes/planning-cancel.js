(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-alert';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  let observer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
  async function api(action, { method = 'GET', body = null } = {}) {
    const url = new URL(API);
    url.searchParams.set('action', action);
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
  function errorText(error) {
    const code = String(error?.message || '');
    const map = {
      AUTH_REQUIRED: 'Votre session a expiré. Reconnectez-vous.',
      AUTH_INVALID: 'Votre session a expiré. Reconnectez-vous.',
      SERVICE_NOT_FOUND: 'Cette prestation n’existe plus dans Ogust.',
      SERVICE_ALREADY_CANCELLED: 'Cette prestation est déjà annulée.',
      SERVICE_CANCEL_REASONS_UNAVAILABLE: 'Aucun motif d’annulation exploitable n’a été trouvé dans Ogust.',
      SERVICE_CANCEL_STATUS_UNAVAILABLE: 'Les motifs existent, mais aucun statut « annulé » sûr n’a été identifié dans Ogust.',
      SERVICE_CANCEL_REASON_STALE: 'La liste des motifs Ogust a changé. Rechargez les motifs.',
      SERVICE_CANCEL_REASON_INVALID: 'Ce motif n’est plus disponible dans Ogust.',
      SERVICE_CANCEL_NOT_VERIFIED: 'L’annulation n’a pas pu être confirmée après relecture Ogust.',
      SERVICE_CANCEL_REASON_NOT_VERIFIED: 'Le motif n’a pas pu être confirmé après relecture Ogust.',
      EXPLICIT_CONFIRMATION_REQUIRED: 'Confirmation obligatoire.',
      RATE_LIMIT: 'Trop d’actions rapprochées. Réessayez dans quelques minutes.'
    };
    return map[code] || `Annulation impossible (${code || 'erreur inconnue'}).`;
  }
  function injectCss() {
    if (document.getElementById('acj-planning-cancel-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-planning-cancel-css';
    style.textContent = `
      .acjCancelOpen{width:100%;min-height:48px;border:1px solid #fecaca;border-radius:13px;background:#fff1f2;color:#b91c1c;font-weight:950;margin-top:10px}.acjCancelOpen:disabled{opacity:.55}.acjCancelPanel{margin-top:10px;border:1px solid #fecaca;background:#fff7f7;border-radius:15px;padding:12px;display:grid;gap:10px}.acjCancelPanel h3{margin:0;font-size:14px;color:#991b1b}.acjCancelPanel p{margin:0;color:#64748b;font-size:11px;line-height:1.45}.acjCancelPanel select{width:100%;min-height:46px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#0f172a;padding:0 10px}.acjCancelActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.acjCancelActions button{min-height:46px;border:0;border-radius:12px;font-weight:900}.acjCancelBack{background:#e9eef5;color:#334155}.acjCancelConfirm{background:#b91c1c;color:#fff}.acjCancelStatus{font-size:11px;color:#b91c1c;min-height:16px}.acjCancelSuccess{padding:11px;border-radius:12px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:900}@media(max-width:520px){.acjCancelActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  function currentServiceId() {
    const subtitle = document.querySelector('#acjPlanningSheet .acjSheetSub')?.textContent || '';
    const match = subtitle.match(/intervention\s+(\d+)/i);
    return match ? match[1] : '';
  }
  function refreshPlanning() {
    document.getElementById('acjPlanningSheet')?.remove();
    setTimeout(() => document.querySelector('#acjPlanningMonthPanel [data-acj-view].active')?.click(), 80);
  }
  function renderPanel(form, data, button) {
    form.querySelector('.acjCancelPanel')?.remove();
    const reasons = Array.isArray(data?.reasons) ? data.reasons : [];
    const panel = document.createElement('section');
    panel.className = 'acjCancelPanel';
    if (!reasons.length) {
      panel.innerHTML = '<div class="acjCancelStatus">Aucun motif d’annulation n’est disponible dans Ogust.</div>';
      form.appendChild(panel);
      button.disabled = false;
      button.textContent = 'Annuler la prestation';
      return;
    }
    panel.innerHTML = `
      <h3>Annuler la prestation</h3>
      <p>Choisissez le motif configuré dans Ogust. La prestation restera dans l’historique.</p>
      <select id="acjCancelReason" aria-label="Motif d’annulation"><option value="">Choisir un motif…</option>${reasons.map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('')}</select>
      <div class="acjCancelStatus" id="acjCancelStatus"></div>
      <div class="acjCancelActions"><button type="button" class="acjCancelBack" id="acjCancelBack">Retour</button><button type="button" class="acjCancelConfirm" id="acjCancelConfirm">Confirmer l’annulation</button></div>`;
    form.appendChild(panel);
    button.disabled = false;
    button.textContent = 'Annuler la prestation';

    panel.querySelector('#acjCancelBack')?.addEventListener('click', () => panel.remove());
    panel.querySelector('#acjCancelConfirm')?.addEventListener('click', async () => {
      const select = panel.querySelector('#acjCancelReason');
      const status = panel.querySelector('#acjCancelStatus');
      const confirmButton = panel.querySelector('#acjCancelConfirm');
      const value = String(select?.value || '');
      const selected = reasons.find((item) => String(item.value) === value);
      if (!selected) {
        status.textContent = 'Choisissez un motif d’annulation.';
        return;
      }
      const idService = currentServiceId();
      if (!idService) {
        status.textContent = 'Impossible d’identifier la prestation.';
        return;
      }
      const client = form.querySelector('.acjServiceMeta strong')?.textContent?.trim() || 'cette prestation';
      if (!window.confirm(`Annuler ${client} ?\n\nMotif : ${selected.label}\n\nCette action sera enregistrée dans Ogust.`)) return;
      confirmButton.disabled = true;
      select.disabled = true;
      status.textContent = 'Annulation puis relecture Ogust…';
      try {
        const result = await api('service_cancel', {
          method: 'POST',
          body: { id_service: idService, reason_key: data.reason_key, reason_value: selected.value, confirm: true }
        });
        if (result?.verified !== true) throw new Error('SERVICE_CANCEL_NOT_VERIFIED');
        panel.innerHTML = `<div class="acjCancelSuccess">Prestation annulée dans Ogust · ${esc(selected.label)}</div>`;
        setTimeout(refreshPlanning, 650);
      } catch (error) {
        confirmButton.disabled = false;
        select.disabled = false;
        status.textContent = errorText(error);
      }
    });
  }
  async function loadCancelOptions(form, button) {
    button.disabled = true;
    button.textContent = 'Chargement des motifs Ogust…';
    form.querySelector('.acjCancelPanel')?.remove();
    try {
      const data = await api('service_cancel_options');
      renderPanel(form, data, button);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Annuler la prestation';
      const panel = document.createElement('div');
      panel.className = 'acjCancelPanel';
      panel.innerHTML = `<div class="acjCancelStatus">${esc(errorText(error))}</div>`;
      form.appendChild(panel);
    }
  }
  function decorate() {
    const form = document.querySelector('#acjPlanningSheet #acjEditForm');
    if (!form || form.dataset.acjCancelReady === '1') return;
    form.dataset.acjCancelReady = '1';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'acjCancelOpen';
    button.textContent = 'Annuler la prestation';
    button.addEventListener('click', () => loadCancelOptions(form, button));
    form.appendChild(button);
  }
  function init() {
    injectCss();
    observer?.disconnect();
    observer = new MutationObserver(() => decorate());
    observer.observe(document.body, { childList: true, subtree: true });
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
