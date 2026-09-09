(() => {
  const ALERT_API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-alert';
  const TOKEN_KEY = 'acj_intervenantes_google_token';
  const allowed = new Set(['delay', 'absence', 'client_absent', 'problem']);
  let pendingType = '';

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function toast(message, kind = '') {
    let el = document.getElementById('liaisonPushToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'liaisonPushToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:120;width:min(calc(100% - 24px),520px);padding:11px 13px;border-radius:13px;background:#0f172a;color:#fff;font:700 12px/1.4 system-ui;box-shadow:0 14px 36px rgba(15,23,42,.25);opacity:0;pointer-events:none;transition:opacity .18s ease';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = kind === 'warn' ? '#9a3412' : kind === 'error' ? '#991b1b' : '#0f172a';
    el.style.opacity = '1';
    clearTimeout(el.__hideTimer);
    el.__hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 3200);
  }

  function selectedClientLabel(select) {
    const text = String(select?.selectedOptions?.[0]?.textContent || '').trim();
    if (!text || text.startsWith('Message général')) return '';
    const parts = text.split('·').map((x) => x.trim()).filter(Boolean);
    return parts.at(-1) || text;
  }

  async function sendAlert({ eventType, message, serviceId, clientName }) {
    const bearer = token();
    if (!bearer.startsWith('acjs1.')) {
      toast('Signalement enregistré, mais session alerte indisponible.', 'warn');
      return;
    }

    const employeeSelect = document.getElementById('employee');
    const employeeName = employeeSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Intervenante';
    const scheduledDate = document.getElementById('datePicker')?.value || '';

    try {
      const response = await fetch(ALERT_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: eventType,
          message,
          service_id: serviceId,
          client_name: clientName,
          employee_name: employeeName,
          scheduled_date: scheduledDate
        }),
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP_${response.status}`);
      if (Number(data.sent || 0) > 0) {
        toast(`Alerte agence envoyée sur ${data.sent} téléphone${Number(data.sent) > 1 ? 's' : ''}.`);
      } else if (Number(data.registered || 0) === 0) {
        toast('Signalement enregistré, mais aucun téléphone manager n’est encore abonné.', 'warn');
      } else {
        toast('Signalement enregistré, mais la notification n’a pas été délivrée.', 'warn');
      }
    } catch {
      toast('Signalement enregistré. Alerte téléphone momentanément indisponible.', 'error');
    }
  }

  document.addEventListener('click', (event) => {
    const action = event.target?.closest?.('[data-liaison-action]');
    if (action) {
      pendingType = String(action.dataset.liaisonAction || '');
      return;
    }

    const confirm = event.target?.closest?.('.liaisonConfirm');
    if (!confirm || !allowed.has(pendingType)) return;

    const sheet = confirm.closest('.liaisonSheet');
    const agencyChecked = sheet?.querySelector('[data-recipient="agency"]:checked');
    if (!agencyChecked) {
      pendingType = '';
      return;
    }

    const message = String(sheet?.querySelector('#liaisonQuickText')?.value || '').trim();
    const serviceSelect = sheet?.querySelector('#liaisonQuickService');
    const serviceId = String(serviceSelect?.value || '');
    const clientName = selectedClientLabel(serviceSelect);
    const eventType = pendingType;
    pendingType = '';

    setTimeout(() => sendAlert({ eventType, message, serviceId, clientName }), 0);
  }, true);
})();
