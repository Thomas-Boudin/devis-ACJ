(() => {
  const PLANNING_API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const PLANNING_KEY = 'acj_intervenantes_liaison_planning_v1';
  let installed = false;
  let opening = false;

  function serviceId() {
    return String(document.getElementById('liaisonService')?.value || '');
  }

  function employeeId() {
    return String(document.getElementById('employee')?.value || '');
  }

  function audience() {
    return String(document.getElementById('liaisonAudience')?.value || 'agency');
  }

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function setStatus(text, kind = '') {
    const el = document.getElementById('liaisonSmsStatus');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.kind = kind;
  }

  function injectCss() {
    if (document.getElementById('acj-liaison-sms-css')) return;
    const style = document.createElement('style');
    style.id = 'acj-liaison-sms-css';
    style.textContent = `
      .liaisonSmsInfo{background:#f8fafc;border:1px solid #dbe3ee;border-radius:15px;padding:12px}.liaisonSmsInfo h3{margin:0 0 6px;font-size:14px}.liaisonSmsInfo p{margin:0;color:#64748b;font-size:11px;line-height:1.45}.liaisonSmsStatus{min-height:18px;margin-top:8px;font-size:11px;font-weight:750;color:#475569}.liaisonSmsStatus[data-kind="ok"]{color:#166534}.liaisonSmsStatus[data-kind="warn"]{color:#9a3412}.liaisonSmsStatus[data-kind="error"]{color:#b91c1c}.liaisonSend[data-sms-mode="1"]{background:#166534}.liaisonSend:disabled{opacity:.55}
    `;
    document.head.appendChild(style);
  }

  function planningDateForService(sid) {
    try {
      const raw = JSON.parse(localStorage.getItem(PLANNING_KEY) || '{}');
      for (const entry of Object.values(raw || {})) {
        const contexts = Array.isArray(entry?.contexts) ? entry.contexts : [];
        const found = contexts.find((item) => String(item?.serviceId || '') === sid && (!employeeId() || String(item?.employeeId || '') === employeeId()));
        if (found?.scheduledDate) return String(found.scheduledDate);
      }
    } catch {}
    return String(document.getElementById('datePicker')?.value || '');
  }

  function normalizeFrenchMobile(value) {
    let phone = String(value || '').replace(/[^+\d]/g, '');
    if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
    if (/^0[67]\d{8}$/.test(phone)) phone = `+33${phone.slice(1)}`;
    else if (/^33[67]\d{8}$/.test(phone)) phone = `+${phone}`;
    return /^\+33[67]\d{8}$/.test(phone) ? phone : '';
  }

  function maskPhone(phone) {
    return phone ? `${phone.slice(0, 5)}••••${phone.slice(-2)}` : '';
  }

  async function customerForSelectedService() {
    const sid = serviceId();
    const eid = employeeId();
    const date = planningDateForService(sid);
    if (!sid || !eid || !date) throw new Error('INTERVENTION_REQUIRED');

    const url = new URL(PLANNING_API);
    url.searchParams.set('action', 'planning');
    url.searchParams.set('employee_id', eid);
    url.searchParams.set('date', date);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}` },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
    const service = (Array.isArray(data?.services) ? data.services : []).find((item) => String(item?.id_service || '') === sid);
    if (!service) throw new Error('INTERVENTION_NOT_FOUND');
    const phone = normalizeFrenchMobile(service?.customer?.phone);
    if (!phone) throw new Error('SMS_PHONE_INVALID');
    return { phone, name: String(service?.customer?.name || 'la cliente') };
  }

  function updateComposer() {
    const select = document.getElementById('liaisonAudience');
    const button = document.getElementById('liaisonSend');
    if (!select || !button) return;
    const hasService = Boolean(serviceId());
    const client = select.querySelector('option[value="client"]');
    const all = select.querySelector('option[value="all"]');
    const agency = select.querySelector('option[value="agency"]');
    if (client) {
      client.textContent = 'Cliente uniquement · SMS téléphone';
      client.disabled = !hasService;
    }
    if (all) {
      all.textContent = 'Agence + cliente · SMS téléphone';
      all.disabled = !hasService;
    }
    if (agency) agency.textContent = 'Agence uniquement';
    if (!hasService && ['client', 'all'].includes(select.value)) select.value = 'agency';
    const smsMode = ['client', 'all'].includes(select.value) && hasService;
    button.dataset.smsMode = smsMode ? '1' : '0';
    button.textContent = smsMode ? 'Préparer le SMS' : 'Enregistrer le message';
    setStatus(smsMode ? 'Le SMS sera ouvert dans l’application Messages du téléphone. Aucun service SMS payant.' : '', smsMode ? 'ok' : '');
  }

  async function openNativeSms(button) {
    if (opening) return;
    const textarea = document.getElementById('liaisonMessage');
    const message = textarea?.value?.trim() || '';
    if (!message) {
      textarea?.focus();
      return;
    }
    if (!serviceId()) {
      setStatus('Choisissez d’abord l’intervention de la cliente.', 'warn');
      return;
    }

    opening = true;
    button.disabled = true;
    button.textContent = 'Préparation…';
    try {
      const customer = await customerForSelectedService();
      setStatus(`SMS prêt pour ${customer.name} · ${maskPhone(customer.phone)}.`, 'ok');

      button.dataset.smsPass = '1';
      button.click();

      const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
      const smsUrl = `sms:${customer.phone}${separator}body=${encodeURIComponent(message)}`;
      setTimeout(() => { window.location.href = smsUrl; }, 0);
    } catch (error) {
      const code = String(error?.message || '');
      const labels = {
        INTERVENTION_REQUIRED: 'Choisissez une intervention avant de préparer le SMS.',
        INTERVENTION_NOT_FOUND: 'La prestation sélectionnée n’a pas été retrouvée dans Ogust.',
        SMS_PHONE_INVALID: 'Cette cliente n’a pas de numéro mobile français utilisable.',
        OGUST_UNAVAILABLE: 'Ogust est momentanément indisponible.'
      };
      setStatus(labels[code] || `Impossible de préparer le SMS (${code}).`, 'error');
    } finally {
      opening = false;
      button.disabled = false;
      updateComposer();
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
      block.className = 'liaisonSmsInfo';
      block.innerHTML = `
        <h3>SMS cliente · gratuit pour l’application</h3>
        <p>ACJ prépare le destinataire et le texte, puis ouvre l’application SMS du téléphone. L’intervenante vérifie et appuie sur Envoyer. Les réponses restent dans Messages et ne remontent pas automatiquement dans Liaison.</p>
        <div id="liaisonSmsStatus" class="liaisonSmsStatus"></div>`;
      composerBlock.insertAdjacentElement('afterend', block);
    }
    audienceSelect?.addEventListener('change', updateComposer);
    document.getElementById('liaisonService')?.addEventListener('change', updateComposer);
    updateComposer();
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
      openNativeSms(button);
    }, true);

    const observer = new MutationObserver(() => {
      if (installPanel()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (installPanel()) observer.disconnect();
    document.getElementById('employee')?.addEventListener('change', () => setTimeout(updateComposer, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
