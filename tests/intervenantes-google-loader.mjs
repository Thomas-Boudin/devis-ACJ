// Isolated Google SDK fixture: no browser sessions, credentials or network calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../intervenantes/google-loader.js', import.meta.url), 'utf8');
const elements = {
  login: { hidden: false },
  loginStatus: { textContent: '' },
  passwordStatus: { textContent: 'Ancienne erreur de mot de passe' },
  googleButton: { innerHTML: '' }
};
const timers = new Map();
let timerId = 0;
let config;
let button;
let returned;
let initializations = 0;
const google = { accounts: { id: {
  initialize(value) { config = value; initializations++; },
  renderButton(container, value) { assert.equal(container, elements.googleButton); button = value; }
} } };
const window = { google, googleLogin(response) { returned = response; elements.loginStatus.textContent = 'Connexion…'; } };
const document = { readyState: 'complete', getElementById(id) { return elements[id]; } };
vm.runInNewContext(source, {
  window, google, document,
  setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
  clearTimeout(id) { timers.delete(id); }
});
const tick = () => {
  const pending = [...timers.values()];
  timers.clear();
  pending.forEach(callback => callback());
};
assert.equal(initializations, 1, 'Initialize the Google SDK once');
assert.equal(config.ux_mode, 'popup', 'Use the supported Google popup flow');
assert.equal(config.use_fedcm_for_button, false, 'Do not force the stuck browser-mediated flow');
assert.equal(config.auto_select, false, 'Keep explicit account selection');

button.click_listener();
assert.equal(elements.passwordStatus.textContent, '', 'Clear the unrelated password error');
assert.equal(elements.loginStatus.textContent, 'Connexion Google…');
tick();
assert.match(elements.loginStatus.textContent, /fenêtre Google/, 'Explain how to finish a pending Google flow');

button.click_listener();
elements.loginStatus.textContent = 'Cette adresse n’est pas autorisée.';
tick();
assert.equal(elements.loginStatus.textContent, 'Cette adresse n’est pas autorisée.', 'Preserve an actual authentication error');

button.click_listener();
const response = { fixture: 'isolated-callback' };
config.callback(response);
assert.equal(returned, response, 'Pass the SDK response unchanged to the real login handler');
assert.equal(timers.size, 0, 'Stop the waiting hint as soon as Google responds');
tick();
assert.equal(elements.loginStatus.textContent, 'Connexion…');

button.click_listener();
elements.login.hidden = true;
tick();
assert.equal(elements.loginStatus.textContent, 'Connexion Google…', 'Do not change the status after a successful login');
console.log('Intervenantes Google loader: OK');
