// Exercise the real Intervenantes bootstrap without Google/Ogust network calls.
// Workers let the test report a frozen event loop instead of freezing CI itself.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function exercise(role) {
  const deps = path.resolve(here, process.env.ACJ_DOM_TEST_DEPS || '../../dom-test/node_modules');
  const require = createRequire(path.join(deps, 'acj-dom-test.cjs'));
  const { JSDOM, ResourceLoader, VirtualConsole } = require(path.join(deps, 'jsdom/lib/api.js'));
  const errors = [];
  const calls = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  vc.on('error', (...items) => errors.push(items.map(String).join(' ')));
  class LocalScripts extends ResourceLoader {
    fetch(url) {
      const parsed = new URL(url);
      const prefix = '/devis-ACJ/';
      if (parsed.origin !== 'https://thomas-boudin.github.io' || !parsed.pathname.startsWith(prefix)) return null;
      return Promise.resolve(fs.readFileSync(path.join(root, parsed.pathname.slice(prefix.length))));
    }
  }
  const html = fs.readFileSync(path.join(root, 'intervenantes/index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://thomas-boudin.github.io/devis-ACJ/intervenantes/?v=20260908-4',
    resources: new LocalScripts(),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      Object.assign(w, { Response, Request, Headers, AbortController });
      w.Notification = class { static permission = 'denied'; };
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.google = { accounts: { id: {
        initialize() {},
        renderButton(container) { container.textContent = 'Continuer avec Google'; },
        disableAutoSelect() {}
      } } };
      // A cached role cannot authorize the signed-out visitor.
      w.localStorage.setItem('acj_intervenantes_role', 'admin');
      if (role !== 'signed-out') {
        w.localStorage.setItem('acj_intervenantes_google_token', 'acjs1.test-only-session');
        w.localStorage.setItem('acj_intervenantes_employee', 'employee-a');
      }
      w.fetch = async (input, init = {}) => {
        const url = new URL(String(input?.url || input));
        const action = url.searchParams.get('action');
        calls.push(action);
        assert.equal(init.method || 'GET', 'GET', 'Bootstrap must only read Ogust');
        let data = { ok: true };
        if (action === 'role') data.role = role;
        if (action === 'config') data.employees = role === 'admin'
          ? [{ id_employee: 'employee-a', label: 'Intervenante A' }, { id_employee: 'employee-b', label: 'Intervenante B' }]
          : [{ id_employee: 'employee-a', label: 'Intervenante A' }];
        if (action === 'planning') data.services = [{
          id_service: 'service-test', id_customer: 'customer-test', start_time: '09:00', end_time: '11:30',
          customer: { name: 'Client test', address: 'Adresse test', phone: '' }, product: { label: 'Ménage' }
        }];
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
    }
  });
  const w = dom.window;
  try {
    for (let attempt = 0; attempt < 80; attempt++) {
      const booted = w.document.getElementById('acjPlanningMonthPanel') && w.document.getElementById('liaisonPanel');
      const ready = role === 'signed-out' || (w.document.getElementById('app').hidden === false && w.ACJ_INTERVENANTES_ROLE === role && w.document.querySelector('#list .client'));
      if (booted && ready) break;
      await pause(20);
    }
    const doc = w.document;
    assert.ok(doc.getElementById('acjPlanningMonthPanel'), 'Planning module boots');
    assert.ok(doc.getElementById('liaisonPanel'), 'Liaison module boots');
    // Unrelated modules, incoming messages and new cards must leave the event loop usable.
    const incoming = doc.createElement('article');
    incoming.textContent = 'New planning element';
    doc.getElementById('list').appendChild(incoming);
    await pause(60);
    incoming.textContent = 'Updated planning element';
    await pause(60);
    assert.deepEqual(errors, [], 'Production modules run without errors');
    const nav = [...doc.querySelectorAll('.bottomNav .navItem')];
    const select = doc.getElementById('employee');
    if (role === 'admin') {
      assert.equal(nav[1].hidden, false, 'Confirmed admin keeps Planning access');
      assert.equal(nav[1].disabled, false);
      assert.equal(select.disabled, false, 'Confirmed admin can choose an intervenante');
      assert.equal(doc.querySelector('.pilotBadge').textContent, 'Mode admin');
    } else {
      assert.equal(nav[1].hidden, true, 'Administrative planning stays hidden');
      assert.equal(nav[1].disabled, true);
      assert.equal(select.disabled, true);
      assert.equal(doc.querySelector('.pilotBadge').textContent, 'Mon planning');
      const write = doc.createElement('button');
      write.className = 'acjReplaceOpen';
      doc.body.appendChild(write);
      await pause(60);
      assert.equal(write.hidden, true, 'New administrative actions remain hidden');
      assert.equal(write.disabled, true);
    }
    if (role === 'signed-out') {
      assert.equal(doc.getElementById('login').hidden, false);
      assert.equal(doc.getElementById('app').hidden, true);
      assert.equal(calls.length, 0, 'Signed-out boot makes no authenticated requests');
    } else {
      assert.equal(doc.querySelector('#list .client').textContent, 'Client test');
      assert.equal(select.value, 'employee-a');
      assert.ok(calls.includes('role') && calls.includes('config') && calls.includes('planning'));
    }
    return { role, calls: calls.length };
  } finally {
    w.close();
  }
}

if (isMainThread) {
  for (const role of ['signed-out', 'intervenante', 'admin']) {
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: role });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error(`Intervenantes bootstrap froze or failed to finish (${role})`));
      }, 5000);
      worker.once('message', result => {
        clearTimeout(timeout);
        worker.terminate();
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      });
      worker.once('error', error => { clearTimeout(timeout); reject(error); });
      worker.once('exit', code => {
        clearTimeout(timeout);
        if (code !== 0) reject(new Error(`Intervenantes worker stopped (${role}, ${code})`));
      });
    });
    console.log(`Intervenantes startup OK: ${result.role} (${result.calls} mocked reads)`);
  }
} else {
  exercise(workerData).then(
    result => parentPort.postMessage(result),
    error => parentPort.postMessage({ error: error.stack || error.message })
  );
}
