(() => {
  const SMS_API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-sms';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  let threadRequest = 0;
  let sending = false;
  let installed = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function serviceId() {
    return String(document.getElementById('liaisonService')?.value || '');
  }

  function employeeId() {
    return String(document.getElementById('employee')?.value || '');
  }

  function audience() {
    return String(document.getElementById('liaisonAudience')?.value || 'agency');
  }

  function setSmsStatus(text, kind = '') {
    const status = document.getElementById('liaisonSmsStatus');
    if (!status) return;
    status.textContent = text || '';
    status.dataset.kind = kind;
  }

  async function smsCall(action, { method = 'GET', query = {}, body = null } = {}) {
    const url = new URL(SMS_API);
    url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || `HTTP_${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  }

  function injectCss() {
    if (document.getElementById('acj-liaison-sms-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-liaison-sms-css';
    style.textContent = `
      .liaisonSmsHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.liaisonSmsHead h3{margin:0}.liaisonSmsRefresh{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:850;color:#334155}.liaisonSmsStatus{min-height:18px;font-size:11px;color:#64748b;line-height:1.4;margin-bottom:8px}.liaisonSmsStatus[data-kind="ok"]{color:#166534}.liaisonSmsStatus[data-kind="warn"]{color:#9a3412}.liaisonSmsStatus[data-kind="error"]{color:#b91c1c}.liaisonSmsThread{display:grid;gap:7px;max-height:360px;overflow:auto}.liaisonSmsBubble{max-width:88%;padding:9px 11px;border-radius:14px;font-size:12px;line-height:1.4}.liaisonSmsBubble.out{justify-self:end;background:#0f766e;color:#fff;border-bottom-right-radius:5px}.liaisonSmsBubble.in{justify-self:start;background:#eef2f7;color:#1e293b;border-bottom-left-radius:5px}.liaisonSmsMeta{margin-top:4px;font-size:9px;opacity:.72}.liaisonSmsEmpty{padding:14px;text-align:center;color:#64748b;font-size:11px}.liaisonSend[data-sms-mode="1"]{background:#166534}.liaisonSend:disabled{opacity:.55}
    `;
    document.head.appendChild(style);
  }

  function renderThread(messages) {
    const root = document.getElementById('liaisonSmsThread');
    if (!root) return;
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) {
      root.innerHTML = '<div class="liaisonSmsEmpty">Aucun SMS échangé avec cette cliente sur les 30 derniers jours.</div>';
      return;
    }
    root.innerHTML = list.map((item) => `
      <div class="liaisonSmsBubble ${item.direction === 'in' ? 'in' : 'out'}">
        <div>${esc(item.message || '')}</div>
        <div class="liaisonSmsMeta">${item.direction === 'in' ? 'Cliente' : 'ACJ'} · ${esc(item.date || '')}${item.status ? ` · ${esc(item.status)}` : ''}</div>
      </div>`).join('');
    root.scrollTop = root.scrollHeight;
  }

  async function loadThread() {
    const currentRequest = ++threadRequest;
    const sid = serviceId();
    const eid = employeeId();
    const root = document.getElementById('liaisonSmsThread');
    if (!root) return;
    if (!sid || !eid) {
      setSmsStatus('Choisissez une intervention pour afficher la conversation SMS.', '');
      root.innerHTML = '<div class="liaisonSmsEmpty">Aucune cliente sélectionnée.</div>';
      return;
    }

    setSmsStatus('Chargement des SMS…', '');
    try {
      const data = await smsCall('thread', { query: { service_id: sid, employee_id: eid } });
      if (currentRequest !== threadRequest) return;
      if (!data.configured) {
        setSmsStatus('Le service SMS n’est pas encore configuré côté serveur.', 'warn');
        renderThread([]);
        return;
      }
      const label = [data.customer?.name, data.customer?.phone_masked].filter(Boolean).join(' · ');
      setSmsStatus(label ? `Conversation avec ${label}` : 'Conversation SMS cliente', 'ok');
      renderThread(data.messages || []);
    } catch (error) {
      if (currentRequest !== threadRequest) return;
      const code = String(error?.message || '');
      if (code === 'SMS_PHONE_INVALID') setSmsStatus('Aucun numéro mobile français utilisable pour cette cliente.', 'warn');
      else if (code === 'OGUST_UNAVAILABLE') setSmsStatus('Ogust est momentanément indisponible.', 'warn');
      else setSmsStatus(`Conversation SMS indisponible (${code}).`, 'error');
      renderThread([]);
    }
  }

  function updateComposer() {
    const select = document.getElementById('liaisonAudience');
    const button = document.getElementById('liaisonSend');
    if (!select || !button) return;
    const hasService = Boolean(serviceId());
    const clientOption = select.querySelector('option[value="client"]');
    const allOption = select.querySelector('option[value="all"]');
    if (clientOption) {
      clientOption.textContent = 'Cliente uniquement · SMS';
      clientOption.disabled = !hasService;
    }
    if (allOption) {
      allOption.textContent = 'Agence + cliente · SMS cliente';
      allOption.disabled = !hasService;
    }
    const agencyOption = select.querySelector('option[value="agency"]');
    if (agencyOption) agencyOption.textContent = 'Agence uniquement';
    if (!hasService && ['client', 'all'].includes(select.value)) select.value = 'agency';

    const smsMode = ['client', 'all'].includes(select.value) && hasService;
    button.dataset.smsMode = smsMode ? '1' : '0';
    button.textContent = smsMode ? 'Envoyer par SMS' : 'Enregistrer le message';
  }

  async function sendClientSms(button) {
    if (sending) return;
    const textarea = document.getElementById('liaisonMessage');
    const message = textarea?.value?.trim() || '';
    const sid = serviceId();
    const eid = employeeId();
    if (!sid || !eid) {
      setSmsStatus('Choisissez d’abord l’intervention de la cliente.', 'warn');
      return;
    }
    if (!message) {
      textarea?.focus();
      return;
    }

    sending = true;
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'Envoi…';
    setSmsStatus('Préparation du SMS…', '');

    try {
      const data = await smsCall('send', {
        method: 'POST',
        body: { service_id: sid, employee_id: eid, message }
      });
      const customer = [data.customer?.name, data.customer?.phone_masked].filter(Boolean).join(' · ');
      if (data.sms?.simulated) {
        setSmsStatus(`Simulation validée pour ${customer || 'la cliente'} : aucun SMS réel n’a été envoyé.`, 'warn');
      } else {
        setSmsStatus(`SMS envoyé à ${customer || 'la cliente'}. Elle peut répondre directement au SMS.`, 'ok');
      }

      button.dataset.smsPass = '1';
      button.click();
      if (!data.sms?.simulated) setTimeout(loadThread, 700);
    } catch (error) {
      const code = String(error?.message || '');
      const labels = {
        SMS_NOT_CONFIGURED: 'Le compte SMSFactor doit encore être configuré.',
        SMS_PHONE_INVALID: 'Cette cliente n’a pas de numéro mobile français utilisable.',
        SMS_PROVIDER_TIMEOUT: 'Le service SMS ne répond pas pour le moment.',
        SMS_PROVIDER_ERROR: 'SMSFactor a refusé l’envoi.',
        OGUST_UNAVAILABLE: 'Impossible de vérifier la prestation dans Ogust.'
      };
      setSmsStatus(labels[code] || `Envoi SMS impossible (${code}).`, 'error');
    } finally {
      sending = false;
      button.disabled = false;
      updateComposer();
      if (!button.textContent) button.textContent = previous;
    }
  }

  function installPanel() {
    const panel = document.getElementById('liaisonPanel');
    if (!panel) return false;
    injectCss();

    const audienceSelect = document.getElementById('liaisonAudience');
    const composerBlock = audienceSelect?.closest('.liaisonBlock');
    if (composerBlock && !document.getElementById('liaisonSmsBlock')) {
      const block = document.createElement('div');
      block.id = 'liaisonSmsBlock';
      block.className = 'liaisonBlock';
      block.innerHTML = `
        <div class="liaisonSmsHead"><h3>Conversation SMS cliente</h3><button id="liaisonSmsRefresh" class="liaisonSmsRefresh" type="button">Actualiser</button></div>
        <div id="liaisonSmsStatus" class="liaisonSmsStatus"></div>
        <div id="liaisonSmsThread" class="liaisonSmsThread"><div class="liaisonSmsEmpty">Choisissez une intervention.</div></div>`;
      composerBlock.insertAdjacentElement('afterend', block);
      block.querySelector('#liaisonSmsRefresh')?.addEventListener('click', loadThread);
    }

    audienceSelect?.addEventListener('change', updateComposer);
    document.getElementById('liaisonService')?.addEventListener('change', () => {
      updateComposer();
      loadThread();
    });
    updateComposer();
    loadThread();
    return true;
  }

  function install() {
    if (installed) return;
    installed = true;

    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('#liaisonSend');
      if (!button) return;
      if (button.dataset.smsPass === '1') {
        delete button.dataset.smsPass;
        return;
      }
      if (!['client', 'all'].includes(audience())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      sendClientSms(button);
    }, true);

    const observer = new MutationObserver(() => {
      if (installPanel()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (installPanel()) observer.disconnect();

    document.getElementById('employee')?.addEventListener('change', () => setTimeout(() => {
      updateComposer();
      loadThread();
    }, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
