(() => {
  const API = 'https://acj-ogust-proxy.vercel.app/api/intervenante-pilot';
  const TOKEN = 'acj_intervenantes_google_token';
  const $ = id => document.getElementById(id);
  let available = false, busy = false, activationToken = '', managerRequest = 0;
  const token = () => sessionStorage.getItem(TOKEN) || localStorage.getItem(TOKEN) || '';

  async function call(action, body, authenticated = false) {
    const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Authorization: 'Bearer ' + token() } : {}) };
    const response = await fetch(API + '?action=' + action, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'PASSWORD_UNAVAILABLE');
    return data;
  }
  function message(text) { $('passwordStatus').textContent = text; }
  function setBusy(value) {
    busy = value;
    $('passwordLogin').disabled = value || !available;
    $('passwordActivate').disabled = value || !available || !activationToken;
  }
  async function signIn(activating) {
    if (busy || !available || activating && !activationToken) return;
    if (activating && $('newPassword').value !== $('confirmPassword').value) { message('Les deux mots de passe doivent être identiques.'); return; }
    const generation = window.beginSessionLogin();
    setBusy(true); $('loginStatus').textContent = ''; message(activating ? 'Activation de votre accès…' : 'Connexion…');
    try {
      const session = await call(activating ? 'password_activate' : 'password_login', activating
        ? { token: activationToken, password: $('newPassword').value }
        : { email: $('loginEmail').value.trim().toLowerCase(), password: $('loginPassword').value });
      if (!window.sessionLoginCurrent(generation)) return;
      if (await window.completeSessionLogin(session, generation)) {
        $('loginPassword').value = ''; $('newPassword').value = ''; $('confirmPassword').value = ''; activationToken = '';
        $('passwordActivationForm').hidden = true; $('passwordLoginForm').hidden = false; message('');
      }
    } catch (error) {
      if (!window.sessionLoginCurrent(generation)) return;
      window.rejectSession(error, generation); $('loginStatus').textContent = ''; message(window.loginMessage(error.message));
    } finally { setBusy(false); }
  }
  function closeAccess() {
    managerRequest++;
    const dialog = $('passwordAccountsDialog');
    if (dialog?.open) dialog.close();
    if ($('passwordAccountsList')) $('passwordAccountsList').replaceChildren();
    if ($('passwordInviteLink')) $('passwordInviteLink').value = '';
    if ($('passwordInviteResult')) $('passwordInviteResult').hidden = true;
  }
  async function openAccess() {
    if (window.ACJ_INTERVENANTES_ROLE !== 'admin' || !token()) return;
    const request = ++managerRequest, expectedToken = token();
    const dialog = $('passwordAccountsDialog');
    $('passwordAccountsList').replaceChildren(); $('passwordInviteResult').hidden = true; $('passwordInviteLink').value = '';
    $('passwordAccountsStatus').textContent = 'Chargement des accès…'; dialog.showModal();
    try {
      const data = await call('password_accounts', undefined, true);
      if (request !== managerRequest || token() !== expectedToken || window.ACJ_INTERVENANTES_ROLE !== 'admin') return;
      $('passwordAccountsStatus').textContent = '';
      for (const employee of data.employees || []) {
        const row = document.createElement('article'); row.className = 'passwordAccountRow';
        const name = document.createElement('strong'); name.textContent = employee.label;
        const email = document.createElement('p'); email.textContent = employee.email || 'Adresse e-mail à renseigner dans Ogust';
        const status = document.createElement('p'); status.className = 'muted';
        status.textContent = !employee.can_create
          ? ({ EMAIL_MISSING: 'Renseignez une adresse e-mail dans Ogust.', EMAIL_AMBIGUOUS: 'Cette adresse appartient à plusieurs fiches Ogust.', ADMIN_GOOGLE_ONLY: 'Compte administrateur : connexion Google.' })[employee.reason] || 'Accès indisponible'
          : employee.active ? 'Accès actif' : employee.invitation_pending ? 'Lien déjà créé' : 'Accès à créer';
        const button = document.createElement('button'); button.type = 'button'; button.disabled = !employee.can_create;
        button.textContent = employee.active ? 'Réinitialiser le mot de passe' : employee.invitation_pending ? 'Créer un nouveau lien' : 'Créer l’accès';
        button.onclick = async () => {
          if (window.ACJ_INTERVENANTES_ROLE !== 'admin' || token() !== expectedToken) return;
          button.disabled = true; $('passwordAccountsStatus').textContent = 'Création du lien…';
          try {
            const result = await call('password_invite', { employee_id: employee.id_employee, confirm: true }, true);
            if (request !== managerRequest || token() !== expectedToken || window.ACJ_INTERVENANTES_ROLE !== 'admin') return;
            const url = new URL(result.activation_url);
            if (url.origin !== 'https://thomas-boudin.github.io' || url.pathname !== '/devis-ACJ/intervenantes/') throw new Error('PASSWORD_UNAVAILABLE');
            $('passwordInviteName').textContent = result.employee.label + ' — ' + result.employee.email;
            $('passwordInviteLink').value = result.activation_url; $('passwordInviteResult').hidden = false;
            $('passwordAccountsStatus').textContent = 'Lien créé. Transmettez-le à cette salariée. Il est valable 72 heures et sert une seule fois.';
            status.textContent = employee.active ? 'Réinitialisation prête : le mot de passe actuel fonctionne jusqu’au choix du nouveau.' : 'Lien créé : la salariée choisit son mot de passe.';
          } catch (error) {
            if (request === managerRequest) $('passwordAccountsStatus').textContent = window.loginMessage(error.message);
          } finally { button.disabled = !employee.can_create; }
        };
        row.append(name, email, status, button); $('passwordAccountsList').appendChild(row);
      }
    } catch (error) { if (request === managerRequest) $('passwordAccountsStatus').textContent = window.loginMessage(error.message); }
  }
  async function boot() {
    if (!$('passwordLoginForm')) return;
    $('passwordLoginForm').addEventListener('submit', event => { event.preventDefault(); signIn(false); });
    $('passwordActivationForm').addEventListener('submit', event => { event.preventDefault(); signIn(true); });
    $('passwordForgot').onclick = () => message('Demandez à l’agence un nouveau lien pour choisir votre mot de passe.');
    const style = document.createElement('style');
    style.textContent = '.acjPasswordManager{width:100%;margin:10px 0 0;border:1px solid #cbd5e1;border-radius:13px;padding:12px;background:white;color:#0f766e;font-weight:800}#passwordAccountsDialog{width:min(680px,calc(100% - 32px));max-height:85vh;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:20px;padding:20px;color:#0f172a}#passwordAccountsDialog::backdrop{background:rgba(15,23,42,.55)}#passwordAccountsDialog header{display:flex;justify-content:space-between;gap:12px;align-items:center}#passwordAccountsDialog h2{font-size:20px;margin:0}.passwordAccountRow{border-top:1px solid #e2e8f0;padding:16px 0}.passwordAccountRow p{margin:6px 0;font-size:13px;overflow-wrap:anywhere}.passwordAccountRow button,#passwordInviteCopy{min-height:42px;border:0;border-radius:10px;background:#0f766e;color:white;padding:10px 14px;font-weight:750}#passwordAccountsClose{border:0;border-radius:10px;background:#e2e8f0;padding:10px}#passwordInviteResult{border:1px solid #99f6e4;border-radius:12px;padding:14px;background:#f0fdfa;margin:14px 0}#passwordInviteLink{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin:10px 0}#passwordAccountsStatus{font-size:13px;line-height:1.5;margin-top:14px}';
    document.head.appendChild(style);
    const dialog = document.createElement('dialog'); dialog.id = 'passwordAccountsDialog';
    dialog.innerHTML = '<header><h2>Accès salariés</h2><button id="passwordAccountsClose" type="button">Fermer</button></header><p class="muted">Créez un lien pour que chaque salariée choisisse son mot de passe personnel.</p><p id="passwordAccountsStatus" role="status" aria-live="polite"></p><section id="passwordInviteResult" hidden><strong id="passwordInviteName"></strong><label for="passwordInviteLink">Lien à transmettre</label><input id="passwordInviteLink" type="text" readonly><button id="passwordInviteCopy" type="button">Copier le lien</button></section><section id="passwordAccountsList"></section>';
    document.body.appendChild(dialog);
    $('passwordAccountsClose').onclick = closeAccess;
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeAccess(); });
    $('passwordAccessOpen').onclick = openAccess;
    $('passwordInviteCopy').onclick = async () => {
      try { await navigator.clipboard.writeText($('passwordInviteLink').value); $('passwordAccountsStatus').textContent = 'Lien copié.'; }
      catch { $('passwordInviteLink').focus(); $('passwordInviteLink').select(); $('passwordAccountsStatus').textContent = 'Sélectionnez et copiez le lien affiché.'; }
    };
    document.addEventListener('acj:role-changed', event => { if (event.detail?.role !== 'admin') closeAccess(); });
    document.addEventListener('acj:session-changed', () => {
      if (!token()) { closeAccess(); $('app').hidden = true; $('login').hidden = false; }
    });
    const fragment = new URLSearchParams(location.hash.slice(1)); activationToken = fragment.get('activation') || '';
    if (activationToken) {
      history.replaceState(null, '', location.pathname + location.search);
      $('passwordLoginForm').hidden = true; $('passwordActivationForm').hidden = false;
    }
    try {
      const status = await call('password_status'); available = status.available === true;
      if (!available) { message('Connexion par mot de passe momentanément indisponible.'); return; }
      if (activationToken) {
        const info = await call('password_activation_info', { token: activationToken });
        $('activationEmail').value = info.email; $('loginEmail').value = info.email;
        $('passwordActivationName').textContent = info.employee_name + ' : choisissez votre mot de passe personnel.';
      }
      message('');
    } catch (error) {
      activationToken = ''; $('passwordActivationForm').hidden = true; $('passwordLoginForm').hidden = false;
      message(window.loginMessage(error.message));
    }
    finally { setBusy(false); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
