(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const $ = id => document.getElementById(id);
  let challenge = null, requestGeneration = 0, busy = false, available = false, resendUntil = 0, ticker;

  async function call(action, body) {
    const response = await fetch(API + '?action=' + action, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw Object.assign(new Error(data.error || 'EMAIL_LOGIN_UNAVAILABLE'), { retryAfter: data.retry_after || 0 });
    return data;
  }
  function message(text) { $('emailLoginStatus').textContent = text; }
  function cooldown(seconds) {
    resendUntil = Date.now() + Math.max(0, Number(seconds) || 0) * 1000;
    clearInterval(ticker);
    const update = () => {
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      $('emailResend').disabled = busy || !!remaining;
      $('emailResend').textContent = remaining ? `Renvoyer dans ${remaining} s` : 'Renvoyer le code';
      if (!remaining) clearInterval(ticker);
    };
    update();
    if (seconds > 0) ticker = setInterval(update, 1000);
  }
  function setBusy(value) {
    busy = value;
    $('emailRequest').disabled = value || !available;
    $('emailVerify').disabled = value;
    $('emailChange').disabled = value;
    $('loginEmail').disabled = value;
    $('emailResend').disabled = value || Date.now() < resendUntil;
  }
  function reset() {
    requestGeneration++; challenge = null; clearInterval(ticker); resendUntil = 0;
    $('emailCodeForm').hidden = true; $('emailLoginForm').hidden = false;
    $('loginEmailCode').value = ''; $('loginStatus').textContent = ''; message(''); setBusy(false);
  }
  async function requestCode() {
    if (busy || !available) return;
    const email = $('loginEmail').value.trim().toLowerCase();
    if (!$('loginEmail').checkValidity()) { $('loginEmail').reportValidity(); return; }
    const generation = ++requestGeneration;
    setBusy(true); $('loginStatus').textContent = ''; message('Envoi du code…');
    try {
      const data = await call('email_code_request', { email });
      if (generation !== requestGeneration) return;
      if (!/^[a-f0-9]{48}$/.test(data.challenge_id || '')) throw new Error('EMAIL_LOGIN_UNAVAILABLE');
      challenge = { email, id: data.challenge_id };
      $('emailCodeDestination').textContent = `Code pour ${email}`;
      $('emailLoginForm').hidden = true; $('emailCodeForm').hidden = false; $('loginEmailCode').value = '';
      message('Si cette adresse est autorisée, un code vous a été envoyé. Il est valable 10 minutes. Vérifiez aussi les courriers indésirables.');
      cooldown(data.retry_after || 0); $('loginEmailCode').focus();
    } catch (error) {
      if (generation !== requestGeneration) return;
      message(window.loginMessage(error.message));
      if (error.retryAfter && challenge) cooldown(error.retryAfter);
    } finally {
      if (generation === requestGeneration) setBusy(false);
    }
  }
  async function verifyCode() {
    if (busy || !challenge) return;
    const code = $('loginEmailCode').value.trim();
    if (!/^\d{6}$/.test(code)) { message('Saisissez les 6 chiffres du code reçu.'); return; }
    const requested = challenge, request = requestGeneration, generation = window.beginSessionLogin();
    setBusy(true); $('loginStatus').textContent = ''; message('Vérification du code…');
    try {
      const session = await call('email_code_verify', { email: requested.email, challenge_id: requested.id, code });
      if (request !== requestGeneration || !window.sessionLoginCurrent(generation)) return;
      const opened = await window.completeSessionLogin(session, generation);
      if (opened) reset();
    } catch (error) {
      if (request !== requestGeneration || !window.sessionLoginCurrent(generation)) return;
      window.rejectSession(error, generation); $('loginStatus').textContent = ''; message(window.loginMessage(error.message));
      if (error.retryAfter) cooldown(error.retryAfter);
    } finally {
      if (request === requestGeneration) setBusy(false);
    }
  }
  async function boot() {
    if (!$('emailLoginForm')) return;
    $('emailLoginForm').addEventListener('submit', event => { event.preventDefault(); requestCode(); });
    $('emailCodeForm').addEventListener('submit', event => { event.preventDefault(); verifyCode(); });
    $('emailResend').onclick = requestCode;
    $('emailChange').onclick = () => { reset(); $('loginEmail').focus(); };
    try {
      const status = await call('email_login_status'); available = status.available === true;
      message(available ? '' : 'Connexion par e-mail en cours d’activation.');
    } catch { message('Connexion par e-mail momentanément indisponible.'); }
    setBusy(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
