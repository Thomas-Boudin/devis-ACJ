import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = 'acj_intervenantes_google_token';

async function exercise(scenario) {
  const deps = process.env.ACJ_DOM_TEST_DEPS || path.resolve(root, '../dom-test/node_modules');
  const require = createRequire(path.join(deps, 'email-login-test.cjs'));
  const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
  const { IDBFactory } = require('fake-indexeddb');
  const errors = [], calls = [];
  let actor = 'intervenante', activeToken = '', serial = 0, releaseOldCode;
  const sessionFor = role => 'acjs1.' + Buffer.from(JSON.stringify({ email: role === 'admin' ? 'admin@fixture.test' : 'employee@fixture.test', role })).toString('base64url') + '.fixture-signature';
  class LocalScripts extends ResourceLoader {
    fetch(url) {
      const parsed = new URL(url), prefix = '/devis-ACJ/';
      if (parsed.origin !== 'https://thomas-boudin.github.io' || !parsed.pathname.startsWith(prefix)) return null;
      return Promise.resolve(fs.readFileSync(path.join(root, parsed.pathname.slice(prefix.length))));
    }
  }
  const vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'intervenantes/index.html'), 'utf8'), {
    url: 'https://thomas-boudin.github.io/devis-ACJ/intervenantes/', resources: new LocalScripts(), runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.assign(w, { Response, Request, Headers, AbortController, AbortSignal, structuredClone, indexedDB: new IDBFactory() });
      w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
      w.Notification = class { static permission = 'denied'; };
      w.google = { accounts: { id: { initialize() {}, renderButton(node) { node.textContent = 'Continuer avec Google'; }, disableAutoSelect() {} } } };
      w.fetch = async (input, init = {}) => {
        const url = new URL(String(input?.url || input)), action = url.searchParams.get('action'), method = init.method || 'GET';
        const authorization = new Headers(init.headers).get('Authorization') || '';
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ action, method, authorization, body });
        assert.equal(url.origin, 'https://acj-ogust-proxy.vercel.app');
        let data = { ok: true }, status = 200;
        if (action === 'email_login_status') {
          assert.equal(method, 'GET'); assert.equal(authorization, ''); data.available = scenario !== 'unavailable';
        } else if (action === 'email_code_request') {
          assert.equal(method, 'POST'); assert.equal(authorization, ''); assert.equal(body.email, 'employee@fixture.test');
          assert.equal(url.searchParams.has('email'), false, 'Addresses and codes are never placed in URLs');
          data = { ok: true, challenge_id: String(++serial).padStart(48, '0'), expires_in: 600, retry_after: 0 };
        } else if (action === 'email_code_verify') {
          assert.equal(method, 'POST'); assert.equal(authorization, ''); assert.equal(body.email, 'employee@fixture.test');
          assert.equal(body.challenge_id, String(serial).padStart(48, '0'));
          if (body.code !== '012345') { status = 401; data = { ok: false, error: 'EMAIL_LOGIN_CODE_INVALID' }; }
          else {
            const token = sessionFor('intervenante');
            data = { ok: true, token, role: 'intervenante', expires_in: 1209600 };
            if (scenario === 'stale') return new Promise(resolve => { releaseOldCode = () => resolve(new Response(JSON.stringify(data), { status: 200 })); });
            activeToken = token; actor = 'intervenante';
          }
        } else if (action === 'session') {
          assert.equal(method, 'POST'); assert.equal(authorization, 'Bearer fixture-google-admin');
          actor = 'admin'; activeToken = sessionFor(actor); data = { ok: true, token: activeToken, role: actor };
        } else {
          assert.equal(method, 'GET', 'Loading the planning never creates a business write');
          assert.equal(authorization, 'Bearer ' + activeToken);
          if (action === 'role') data = { ok: true, role: actor, email: actor + '@fixture.test' };
          if (action === 'config') data = { ok: true, employees: actor === 'admin'
            ? [{ id_employee: '11', label: 'Intervenante A' }, { id_employee: '22', label: 'Intervenante B' }]
            : [{ id_employee: '11', label: 'Intervenante A' }], ...(actor === 'intervenante' ? { self_employee_id: '11' } : {}) };
          if (action === 'planning') data.services = [{ id_service: '101', id_employee: '11', start_time: '09:00', end_time: '11:00', status: 'A', type: 'I', customer: { name: 'Client test', address: 'Adresse test' }, product: { label: 'Ménage' } }];
          if (action === 'pointage_day') data = { ok: true, pointages: [], absences: [], active: null };
        }
        return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
      };
    }
  });
  const w = dom.window, doc = w.document;
  async function until(predicate, label) {
    for (let i = 0; i < 120; i++) { if (predicate()) return; await pause(15); }
    throw Error(label);
  }
  try {
    await until(() => calls.some(c => c.action === 'email_login_status'), 'Public readiness is checked');
    if (scenario === 'unavailable') {
      await until(() => doc.getElementById('emailLoginStatus').textContent.includes('activation'), 'Missing delivery is clearly shown');
      assert.equal(doc.getElementById('emailRequest').disabled, true);
      assert.equal(doc.getElementById('login').hidden, false);
      assert.equal(calls.length, 1, 'An unconfigured sender never pretends to send a code');
    } else {
      await until(() => !doc.getElementById('emailRequest').disabled, 'Email sign-in becomes available');
      doc.getElementById('loginEmail').value = 'Employee@Fixture.test'; doc.getElementById('emailRequest').click();
      await until(() => !doc.getElementById('emailCodeForm').hidden && !doc.getElementById('emailVerify').disabled, 'The code step is shown');
      assert.equal(doc.getElementById('loginEmailCode').getAttribute('autocomplete'), 'one-time-code');
      assert.equal(doc.getElementById('app').hidden, true); assert.equal(w.localStorage.getItem(key), null);
      if (scenario === 'email') {
        doc.getElementById('loginEmailCode').value = '999999'; doc.getElementById('emailVerify').click();
        await until(() => doc.getElementById('emailLoginStatus').textContent.includes('Code incorrect') && !doc.getElementById('emailVerify').disabled, 'An incorrect code is actionable');
        assert.equal(doc.getElementById('app').hidden, true); assert.equal(w.localStorage.getItem(key), null);
        doc.getElementById('emailResend').click();
        await until(() => serial === 2 && !doc.getElementById('emailVerify').disabled, 'A new challenge replaces the previous one');
      }
      doc.getElementById('loginEmailCode').value = '012345'; doc.getElementById('emailVerify').click();
      if (scenario === 'stale') {
        await until(() => releaseOldCode, 'Email exchange is pending');
        await w.googleLogin({ credential: 'fixture-google-admin' });
        await until(() => !doc.getElementById('app').hidden && w.ACJ_INTERVENANTES_ROLE === 'admin', 'The newer Google login succeeds');
        releaseOldCode(); await pause(80);
        assert.equal(w.localStorage.getItem(key), sessionFor('admin'), 'An old email response cannot replace the newer account');
        assert.equal(w.ACJ_INTERVENANTES_ROLE, 'admin');
      } else {
        await until(() => !doc.getElementById('app').hidden && w.ACJ_INTERVENANTES_ROLE === 'intervenante' && doc.querySelector('#list .client'), 'Email sign-in opens the personal planning');
        assert.equal(doc.getElementById('employee').value, '11'); assert.equal(doc.getElementById('employee').disabled, true);
        assert.equal(doc.querySelector('#list .client').textContent, 'Client test');
        assert.equal(w.localStorage.getItem(key), activeToken); assert.equal(w.sessionStorage.getItem(key), activeToken);
        assert.equal(doc.getElementById('loginEmailCode').value, '', 'The code is cleared after use');
        doc.getElementById('logout').click();
        assert.equal(w.localStorage.getItem(key), null); assert.equal(w.sessionStorage.getItem(key), null); assert.equal(doc.getElementById('app').hidden, true);
      }
      assert.ok(!calls.some(c => c.action === 'push_subscribe'), 'Authentication never subscribes a phone without activation');
    }
    assert.deepEqual(errors, [], 'All production modules run without browser errors');
    return { scenario, calls: calls.length };
  } finally { w.close(); }
}

if (isMainThread) {
  for (const scenario of ['email', 'stale', 'unavailable']) {
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: scenario });
      const timeout = setTimeout(() => { worker.terminate(); reject(Error('Email login blocked: ' + scenario)); }, 10000);
      worker.once('message', result => { clearTimeout(timeout); worker.terminate(); result.error ? reject(Error(result.error)) : resolve(result); });
      worker.once('error', error => { clearTimeout(timeout); reject(error); });
      worker.once('exit', code => { clearTimeout(timeout); if (code) reject(Error('Email login worker stopped: ' + scenario)); });
    });
    console.log('Intervenantes email UI OK: ' + result.scenario + ' (' + result.calls + ' mocked calls)');
  }
} else exercise(workerData).then(result => parentPort.postMessage(result), error => parentPort.postMessage({ error: error.stack || error.message }));
