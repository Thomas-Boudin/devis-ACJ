import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const deps = process.env.ACJ_DOM_TEST_DEPS || path.resolve('../dom-test/node_modules');
const require = createRequire(path.join(deps, 'swipe-test.cjs'));
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(new URL('../intervenantes/index.html', import.meta.url), 'utf8')
  .replace(/<script[^>]+src=[\s\S]*?<\/script>/g, '');
const script = fs.readFileSync(new URL('../intervenantes/planning-swipe.js', import.meta.url), 'utf8');
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

for (const mode of ['pointer', 'touch']) {
  const errors = [], requests = [];
  const dom = new JSDOM(html, {
    url: 'https://thomas-boudin.github.io/devis-ACJ/intervenantes/',
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.AbortController = AbortController;
      w.meaningfulOgustNote = value => String(value || '');
      w.google = { accounts: { id: { initialize() {}, renderButton() {}, disableAutoSelect() {} } } };
      if (mode === 'pointer') w.PointerEvent = w.Event;
      w.fetch = (input, init) => new Promise((resolve, reject) => {
        requests.push({ url: new URL(String(input)), signal: init.signal, resolve, reject });
      });
      w.addEventListener('error', event => errors.push(event.message));
      w.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    }
  });
  const w = dom.window, doc = w.document;
  doc.getElementById('employee').innerHTML = '<option value="11">Intervenante A</option><option value="12">Intervenante B</option>';
  doc.getElementById('app').hidden = false;
  w.eval(script);
  const date = () => doc.getElementById('datePicker').value;
  const target = doc.getElementById('dayHeading');
  function emit(kind, node, x, y, extra = {}) {
    const event = new w.Event(mode === 'pointer' ? `pointer${kind}` : `touch${kind === 'down' ? 'start' : kind === 'up' ? 'end' : kind}`, { bubbles: true, cancelable: true });
    if (mode === 'pointer') Object.assign(event, { clientX: x, clientY: y, pointerType: 'touch', pointerId: 1, isPrimary: true }, extra);
    else {
      const point = { identifier: 1, clientX: x, clientY: y };
      Object.assign(event, { touches: kind === 'up' || kind === 'cancel' ? {length:0} : {0:point,length:1}, changedTouches: {0:point,length:1} }, extra);
    }
    node.dispatchEvent(event);
    return event;
  }
  function swipe(dx, dy = 0, node = target) {
    emit('down', node, 240, 240);
    const move = emit('move', node, 240 + dx, 240 + dy);
    emit('up', node, 240 + dx, 240 + dy);
    return move;
  }

  w.setDate('2028-02-28');
  assert.equal(swipe(-100).defaultPrevented, true, 'Horizontal navigation consumes the gesture');
  assert.equal(date(), '2028-02-29');
  swipe(-100); assert.equal(date(), '2028-03-01');
  swipe(100); assert.equal(date(), '2028-02-29');
  swipe(100); assert.equal(date(), '2028-02-28');
  for (let n = 0; n < 120; n++) swipe(-100);
  assert.equal(date(), '2028-06-27', 'Navigation has no week or month boundary');
  for (let n = 0; n < 120; n++) swipe(100);
  assert.equal(date(), '2028-02-28');
  assert.ok(requests.slice(0, -1).every(request => request.signal.aborted), 'A new day cancels earlier requests');
  const before = date();
  assert.equal(swipe(8, 130).defaultPrevented, false, 'Vertical scrolling remains native');
  swipe(35); swipe(100, 95);
  assert.equal(date(), before, 'Short or diagonal movements do not change the day');
  emit('down', target, 240, 240); emit('move', target, 245, 320); emit('up', target, 120, 320);
  assert.equal(date(), before, 'A vertical scroll cannot later become a day swipe');
  emit('down', target, 240, 240); emit('cancel', target, 120, 240); emit('up', target, 120, 240);
  assert.equal(date(), before, 'Cancelled gestures do not navigate');
  emit('down', target, 240, 240);
  if (mode === 'pointer') emit('down', target, 240, 240, { pointerId: 2, isPrimary: false });
  else emit('down', target, 240, 240, { touches: [{ identifier: 1, clientX: 240, clientY: 240 }, { identifier: 2, clientX: 260, clientY: 240 }] });
  emit('up', target, 120, 240);
  assert.equal(date(), before, 'A pinch cannot change the day');

  const button = doc.createElement('button'); button.textContent = 'Démarrer'; doc.querySelector('.top').appendChild(button);
  const link = doc.createElement('a'); link.href = '#fixture'; link.textContent = 'Itinéraire'; doc.querySelector('.top').appendChild(link);
  let buttonClicks = 0, linkClicks = 0;
  button.addEventListener('click', () => buttonClicks++);
  link.addEventListener('click', event => { event.preventDefault(); linkClicks++; });
  const wholePage = [doc.documentElement, doc.body, doc.getElementById('app'), doc.querySelector('.top'), doc.querySelector('.brandRow'), doc.querySelector('.pilot'), doc.getElementById('employee'), doc.querySelector('.bottomNav'), doc.querySelector('.navItem'), doc.getElementById('dateButton')];
  for (const node of wholePage) {
    swipe(-100, 0, node); assert.equal(date(), '2028-02-29', `Swiping from ${node.id || node.className || node.tagName} opens the next day`);
    swipe(100, 0, node); assert.equal(date(), before);
  }
  for (const node of [button, link, doc.getElementById('logout')]) {
    swipe(-100, 0, node); assert.equal(date(), '2028-02-29');
    node.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true, detail:1 }));
    assert.equal(buttonClicks, 0); assert.equal(linkClicks, 0); assert.equal(doc.getElementById('app').hidden, false, 'A swipe over Quitter does not sign out');
    swipe(100); assert.equal(date(), before);
  }
  emit('down', button, 240, 240); emit('up', button, 240, 240);
  button.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true, detail:1 }));
  assert.equal(buttonClicks, 1, 'A regular tap still starts the button action');
  emit('down', link, 240, 240); emit('up', link, 240, 240);
  link.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true, detail:1 }));
  assert.equal(linkClicks, 1, 'A regular link tap stays usable');
  assert.equal(date(), before, 'Taps do not change the selected day');
  const dialog = doc.createElement('dialog'); dialog.open = true; doc.body.appendChild(dialog);
  swipe(-100); swipe(-100, 0, doc.body); assert.equal(date(), before, 'An open photo dialog keeps the selected day'); dialog.remove();
  const modal = doc.createElement('section'); modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); doc.body.appendChild(modal);
  swipe(-100, 0, modal); assert.equal(date(), before, 'A liaison sheet cannot change the selected day'); modal.remove();
  doc.getElementById('app').hidden = true; swipe(-100); assert.equal(date(), before); doc.getElementById('app').hidden = false;
  doc.querySelector('.dayStrip').hidden = true; swipe(-100); assert.equal(date(), before); doc.querySelector('.dayStrip').hidden = false;
  doc.querySelector('.datebar').hidden = true;
  swipe(-100, 0, doc.querySelector('.top')); swipe(-100, 0, doc.body); await pause();
  assert.equal(date(), before, 'The global gesture does not alter the hidden day when another module is open');
  assert.equal(doc.documentElement.classList.contains('acj-day-swipe'), false, 'Other modules keep their native horizontal scrolling');
  doc.querySelector('.datebar').hidden = false; await pause();
  assert.equal(doc.documentElement.classList.contains('acj-day-swipe'), true);
  emit('down', target, 240, 240); doc.getElementById('employee').value = '12'; emit('up', target, 120, 240);
  assert.equal(date(), before, 'Changing the employee cancels an unfinished gesture');
  emit('down', target, 240, 240); doc.getElementById('next').click(); emit('up', target, 120, 240);
  assert.equal(date(), '2028-02-29', 'An arrow click does not combine with an old gesture');
  doc.getElementById('prev').click(); assert.equal(date(), before, 'Existing arrows still work');

  const response = name => new Response(JSON.stringify({ services: [{ id_service: '101', start_time: '09:00', end_time: '11:00', customer: { name }, product: { label: 'Ménage' } }] }));
  requests.at(-1).resolve(response('Planning actuel')); await pause();
  assert.equal(doc.querySelector('#list .client').textContent, 'Planning actuel');
  requests[0].resolve(response('Ancien planning')); requests[1].reject(Error('Ancienne erreur réseau')); await pause();
  assert.equal(doc.querySelector('#list .client').textContent, 'Planning actuel', 'Delayed responses and errors cannot replace the latest day');
  w.setDate('2028-03-01'); doc.getElementById('app').hidden = true;
  requests.at(-1).resolve(response('Planning après déconnexion')); await pause();
  assert.equal(doc.querySelector('#list .client'), null, 'A response after sign-out does not render personal planning');
  assert.deepEqual(errors, []);
  w.close();
  console.log(`Intervenantes swipe OK: ${mode} (whole viewport, header, empty space, controls, no accidental clicks, unlimited days, scroll, cancellation, stale responses)`);
}
