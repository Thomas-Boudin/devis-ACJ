import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = 'acj_intervenantes_google_token', invitation = 'A'.repeat(43), goodPassword = 'Une phrase personnelle de test';
async function exercise(scenario) {
  const deps = process.env.ACJ_DOM_TEST_DEPS || path.resolve(root, '../dom-test/node_modules');
  const require = createRequire(path.join(deps, 'password-test.cjs'));
  const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom'); const { IDBFactory } = require('fake-indexeddb');
  const errors = [], calls = [], clipboard = [];
  let actor = 'intervenante', activeToken = '', releaseOldLogin;
  const sessionFor = role => 'acjs1.' + Buffer.from(JSON.stringify({ email: role === 'admin' ? 'manager@fixture.test' : 'employee@fixture.test', role })).toString('base64url') + '.fixture-signature';
  class LocalScripts extends ResourceLoader {
    fetch(url) {
      const parsed = new URL(url), prefix = '/devis-ACJ/';
      if (parsed.origin !== 'https://thomas-boudin.github.io' || !parsed.pathname.startsWith(prefix)) return null;
      return Promise.resolve(fs.readFileSync(path.join(root, parsed.pathname.slice(prefix.length))));
    }
  }
  const vc = new VirtualConsole(); vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'intervenantes/index.html'), 'utf8'), {
    url: 'https://thomas-boudin.github.io/devis-ACJ/intervenantes/' + (['activation', 'expired'].includes(scenario) ? '#activation=' + invitation : ''),
    resources: new LocalScripts(), runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.assign(w, { Response, Request, Headers, AbortController, AbortSignal, structuredClone, indexedDB: new IDBFactory() });
      w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.Notification = class { static permission = 'denied'; };
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async value => clipboard.push(value) } });
      w.google = { accounts: { id: { initialize() {}, renderButton(node) { node.textContent = 'Continuer avec Google'; }, disableAutoSelect() {} } } };
      w.fetch = async (input, init = {}) => {
        const url = new URL(String(input?.url || input)), action = url.searchParams.get('action'), method = init.method || 'GET';
        const authorization = new Headers(init.headers).get('Authorization') || '', body = init.body ? JSON.parse(init.body) : null;
        calls.push({ action, method, authorization, body });
        assert.equal(url.origin, 'https://acj-ogust-proxy.vercel.app');
        assert.equal(url.searchParams.has('password'), false); assert.equal(url.searchParams.has('token'), false);
        let data = { ok: true }, status = 200;
        if (action === 'password_status') { assert.equal(method, 'GET'); assert.equal(authorization, ''); data.available = true; data.email_available = true; }
        else if (action === 'password_activation_info') {
          assert.equal(method, 'POST'); assert.equal(authorization, ''); assert.equal(body.token, invitation);
          if (scenario === 'expired') { status = 410; data = { ok: false, error: 'PASSWORD_INVITATION_INVALID' }; }
          else data = { ok: true, email: 'employee@fixture.test', employee_name: 'Intervenante A' };
        } else if (action === 'password_login' || action === 'password_activate') {
          assert.equal(method, 'POST'); assert.equal(authorization, '');
          if (action === 'password_login') assert.equal(body.email, 'employee@fixture.test');
          else { assert.equal(body.token, invitation); assert.deepEqual(Object.keys(body).sort(), ['password', 'token']); }
          if (body.password !== goodPassword) { status = 401; data = { ok: false, error: 'PASSWORD_LOGIN_INVALID' }; }
          else {
            data = { ok: true, token: sessionFor('intervenante'), role: 'intervenante', expires_in: 1209600 };
            if (scenario === 'stale') return new Promise(resolve => { releaseOldLogin = () => resolve(new Response(JSON.stringify(data), { status: 200 })); });
            actor = 'intervenante'; activeToken = data.token;
          }
        } else if (action === 'session') {
          assert.equal(method, 'POST'); assert.ok(authorization.startsWith('Bearer fixture-google-'));
          actor = authorization.endsWith('admin') ? 'admin' : 'intervenante'; activeToken = sessionFor(actor); data = { ok: true, token: activeToken, role: actor };
        } else {
          assert.equal(authorization, 'Bearer ' + activeToken);
          if (action === 'password_invite') {
            assert.equal(method, 'POST'); assert.equal(actor, 'admin'); assert.equal(body.employee_id, '11'); assert.equal(body.confirm, true);
            data = { ok: true, activation_url: 'https://thomas-boudin.github.io/devis-ACJ/intervenantes/?v=20261014-5#activation=' + invitation, employee: { label: 'Intervenante A', email: 'employee@fixture.test' }, email_sent: scenario !== 'manager-email-failure', email_status: scenario === 'manager-email-failure' ? 'unconfirmed' : 'accepted' };
          } else {
            assert.equal(method, 'GET', 'Authentication and planning never create business writes');
            if (action === 'role') data = { ok: true, role: actor, email: actor + '@fixture.test' };
            if (action === 'config') data = { ok: true, employees: actor === 'admin' ? [{ id_employee: '11', label: 'Intervenante A' }, { id_employee: '22', label: 'Intervenante B' }] : [{ id_employee: '11', label: 'Intervenante A' }], ...(actor === 'intervenante' ? { self_employee_id: '11' } : {}) };
            if (action === 'planning') data.services = [{ id_service: '101', id_employee: '11', start_time: '09:00', end_time: '11:00', status: 'A', type: 'I', customer: { name: 'Client test', address: 'Adresse test' }, product: { label: 'Ménage' } }];
            if (action === 'pointage_day') data = { ok: true, pointages: [], absences: [], active: null };
            if (action === 'password_accounts') {
              assert.equal(actor, 'admin'); data.employees = [{ id_employee: '11', label: 'Intervenante A', email: 'employee@fixture.test', can_create: true, active: false, invitation_pending: false }, { id_employee: '22', label: 'Intervenante B', email: '', can_create: false, reason: 'EMAIL_MISSING', active: false }];
            }
          }
        }
        return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
      };
    }
  });
  const w = dom.window, doc = w.document;
  async function until(predicate, label) { for (let i = 0; i < 120; i++) { if (predicate()) return; await pause(15); } throw Error(label); }
  try {
    await until(() => !doc.getElementById('passwordLogin').disabled, 'Password sign-in becomes ready without SMTP');
    assert.equal(doc.getElementById('loginPassword').getAttribute('autocomplete'), 'current-password');
    assert.equal(doc.getElementById('passwordAccessOpen').hidden, true, 'Signed-out visitors cannot see account management');
    if (scenario === 'expired') {
      await until(() => doc.getElementById('passwordStatus').textContent.includes('expiré'), 'Expired links have an explanation');
      assert.equal(doc.getElementById('passwordLoginForm').hidden, false); assert.equal(doc.getElementById('passwordActivationForm').hidden, true);
      assert.equal(w.location.hash, '', 'The invitation bearer is removed from browser history');
    } else if (scenario.startsWith('manager')) {
      await w.googleLogin({ credential: 'fixture-google-admin' });
      await until(() => !doc.getElementById('passwordAccessOpen').hidden, 'The confirmed manager can manage accounts');
      doc.getElementById('passwordAccessOpen').click();
      await until(() => doc.querySelectorAll('.passwordAccountRow').length === 2, 'The real account dialog lists employee eligibility');
      const buttons = [...doc.querySelectorAll('.passwordAccountRow button')]; assert.equal(buttons[1].disabled, true);
      assert.equal(buttons[0].textContent, 'Créer l’accès et envoyer le mail'); buttons[0].click(); buttons[0].click();
      await until(() => !doc.getElementById('passwordInviteResult').hidden, 'An activation link is ready to hand to the employee');
      if (scenario === 'manager-email-failure') {
        assert.match(doc.getElementById('passwordAccountsStatus').textContent, /n’a pas pu être confirmé/);
        assert.ok(!doc.getElementById('passwordAccountsStatus').textContent.includes('Mail envoyé'));
      } else assert.match(doc.getElementById('passwordAccountsStatus').textContent, /Mail envoyé à employee@fixture.test/);
      doc.getElementById('passwordInviteCopy').click(); await until(() => clipboard.length === 1, 'The manager can copy their link');
      assert.ok(clipboard[0].includes('#activation=')); assert.equal(calls.filter(c => c.action === 'password_invite').length, 1);
      await w.googleLogin({ credential: 'fixture-google-intervenante' });
      await until(() => w.ACJ_INTERVENANTES_ROLE === 'intervenante', 'Switching account removes administration');
      assert.equal(doc.getElementById('passwordAccountsDialog').open, false); assert.equal(doc.getElementById('passwordInviteLink').value, '');
      assert.equal(doc.getElementById('passwordAccountsList').childElementCount, 0); assert.equal(doc.getElementById('passwordAccessOpen').hidden, true);
    } else {
      if (scenario === 'activation') {
        await until(() => !doc.getElementById('passwordActivate').disabled, 'The invitation is validated before choosing a password');
        assert.equal(w.location.hash, ''); assert.equal(doc.getElementById('activationEmail').readOnly, true);
        assert.equal(doc.getElementById('activationEmail').value, 'employee@fixture.test');
        doc.getElementById('newPassword').value = goodPassword; doc.getElementById('confirmPassword').value = 'Une autre phrase personnelle'; doc.getElementById('passwordActivate').click();
        await until(() => doc.getElementById('passwordStatus').textContent.includes('identiques'), 'Password confirmation prevents a typo');
        assert.equal(calls.some(c => c.action === 'password_activate'), false);
        doc.getElementById('confirmPassword').value = goodPassword; doc.getElementById('passwordActivate').click();
      } else {
        doc.getElementById('loginEmail').value = 'Employee@Fixture.test';
        if (scenario === 'password') {
          doc.getElementById('loginPassword').value = 'Une mauvaise phrase personnelle'; doc.getElementById('passwordLogin').click();
          await until(() => doc.getElementById('passwordStatus').textContent.includes('incorrect') && !doc.getElementById('passwordLogin').disabled, 'A wrong password stays signed out');
          assert.equal(doc.getElementById('app').hidden, true); assert.equal(w.localStorage.getItem(key), null);
          doc.getElementById('passwordForgot').click(); assert.match(doc.getElementById('passwordStatus').textContent, /nouveau lien/);
        }
        doc.getElementById('loginPassword').value = goodPassword; doc.getElementById('passwordLogin').click();
      }
      if (scenario === 'stale') {
        await until(() => releaseOldLogin, 'A password response is pending'); await w.googleLogin({ credential: 'fixture-google-admin' });
        await until(() => !doc.getElementById('app').hidden && w.ACJ_INTERVENANTES_ROLE === 'admin', 'The newer account is open');
        releaseOldLogin(); await pause(80); assert.equal(w.localStorage.getItem(key), sessionFor('admin')); assert.equal(w.ACJ_INTERVENANTES_ROLE, 'admin');
      } else {
        await until(() => !doc.getElementById('app').hidden && w.ACJ_INTERVENANTES_ROLE === 'intervenante' && doc.querySelector('#list .client'), 'Password access opens the personal planning');
        assert.equal(doc.getElementById('employee').value, '11'); assert.equal(doc.getElementById('employee').disabled, true);
        assert.equal(w.localStorage.getItem(key), activeToken); assert.equal(w.sessionStorage.getItem(key), activeToken);
        assert.equal(doc.getElementById('loginPassword').value, ''); assert.equal(doc.getElementById('newPassword').value, '');
        for (let i = 0; i < w.localStorage.length; i++) assert.ok(!String(w.localStorage.getItem(w.localStorage.key(i))).includes(goodPassword));
        doc.getElementById('logout').click(); assert.equal(w.localStorage.getItem(key), null); assert.equal(w.sessionStorage.getItem(key), null); assert.equal(doc.getElementById('app').hidden, true);
      }
      assert.ok(!calls.some(c => c.action === 'push_subscribe'), 'A login never activates notifications on its own');
    }
    assert.deepEqual(errors, [], 'Production modules finish without browser errors');
    return { scenario, calls: calls.length };
  } finally { w.close(); }
}
if (isMainThread) {
  for (const scenario of ['password', 'activation', 'stale', 'manager', 'manager-email-failure', 'expired']) {
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: scenario });
      const timeout = setTimeout(() => { worker.terminate(); reject(Error('Password UI blocked: ' + scenario)); }, 10000);
      worker.once('message', result => { clearTimeout(timeout); worker.terminate(); result.error ? reject(Error(result.error)) : resolve(result); });
      worker.once('error', error => { clearTimeout(timeout); reject(error); }); worker.once('exit', code => { clearTimeout(timeout); if (code) reject(Error('Password UI worker stopped: ' + scenario)); });
    });
    console.log('Intervenantes password UI OK: ' + result.scenario + ' (' + result.calls + ' mocked calls)');
  }
} else exercise(workerData).then(result => parentPort.postMessage(result), error => parentPort.postMessage({ error: error.stack || error.message }));
