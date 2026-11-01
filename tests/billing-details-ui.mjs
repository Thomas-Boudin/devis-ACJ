// Real billing page modules; synthetic native-shaped Ogust data, no live requests.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import * as engine from '../facturation/billing-core.mjs';
import * as details from '../facturation/billing-details.mjs';
const root = path.resolve(import.meta.dirname, '..');
const deps = path.resolve(import.meta.dirname, process.env.ACJ_DOM_TEST_DEPS || '../../dom-test/node_modules');
const require = createRequire(path.join(deps, 'billing-details-test.cjs'));
const { JSDOM, VirtualConsole } = require(path.join(deps, 'jsdom/lib/api.js'));
const html = fs.readFileSync(path.join(root, 'facturation/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'facturation/billing-app.mjs'), 'utf8')
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]*billing-core[^'"]*['"];\s*/m, 'const {contractsToRead,normalize,reconcile,visibleReviewReasons}=window.__billingEngine;\n')
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]*billing-details[^'"]*['"];\s*/m, 'const {contractView,invoiceEvidence,ruleLabel,frenchDay,displayUnit,moneyValue}=window.__billingDetails;\n');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 180; i++) { if (fn()) return; await wait(10); } throw new Error('Billing details UI timed out'); }
const contract = { id_contract: 'ct1', id_customer: 'c1', reference: 'CT-EXAMPLE', status: 'C', start_date: '20260101', base_payment: 'TTC', calculation_method: 'PLA', type_hours: 'PLA', pricing: 'CP', to_invoice: 'HEU', generation: 'N', services_to_consider: 'P', lines_present: true, majorations_present: true, has_majorations: false, document_available: true, quotation_id: 'q1', amount_TTC: '140', lines: [{ line_type: 'M', title: 'Forfait Entretien du jardin', quantity: '3.5', unit: 'H', amount_unit_TTC: '40', amount_global_TTC: '140', sale_taxe_rat: '20', product_level: 'p1', rates: 'r1' }] };
const fixture = {
  services: [
    { id_service: 's1', id_customer: 'c1', id_employee: 'e1', product_level: 'p1', rates: '', contract: 'ct1', type: 'I', status: 'R', start_date: '202610141330', end_date: '202610141430', billing_amount: '0', billing_amount_unit: 'H', invoice_ids: [] },
    { id_service: 's2', id_customer: 'c1', id_employee: 'e1', product_level: 'p1', rates: '', contract: 'ct1', type: 'I', status: 'A', start_date: '202610081330', end_date: '202610081630', billing_amount: '0', billing_amount_unit: 'H', invoice_ids: [] }
  ],
  customers: [{ id_customer: 'c1', label: 'Client exemple jardin' }], products: [{ id_productlevel: 'p1', label: 'Forfait Entretien du jardin', internal_hour: 'N' }], rates: [],
  invoices: [{ id_invoice: 'i1', id_customer: 'c1', type: 'F', status: 'V', number: 'F-EXAMPLE', amount_incl_taxe: '80', invoice_date: '20261031', start_of_period: '20261001', end_of_period: '20261031', contract: 'ct1', service_ids: [], document_available: true }],
  lists: { 'service.status': { R: 'Réalisé', A: 'A réaliser', N: 'Annulé' }, 'contract.status': { C: 'Accepté' } }
};
const errors = [], calls = [], objectUrls = [], revoked = []; let releasePdf = null, holdPdf = false;
const vc = new VirtualConsole(); vc.on('jsdomError', error => errors.push(error));
const dom = new JSDOM(html, { url: 'https://thomas-boudin.github.io/devis-ACJ/facturation/?month=2026-10', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window, doc = w.document;
Object.assign(w, { Response, Request, Headers, AbortController, __billingEngine: engine, __billingDetails: details, acjAuthV292: { serverRequired: true, authenticated: true } });
w.URL.createObjectURL = blob => { assert.equal(blob.type, 'application/pdf'); const url = 'blob:https://thomas-boudin.github.io/fixture-' + (objectUrls.length + 1); objectUrls.push(url); return url; };
w.URL.revokeObjectURL = url => revoked.push(url);
w.Storage.prototype.setItem = () => { throw new Error('Financial evidence must not be persisted in browser storage'); };
w.fetch = async (input, options) => {
  const url = new URL(input); assert.equal(url.origin, 'https://acj-ogust-proxy.vercel.app'); assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store');
  const resource = url.searchParams.get('resource'); calls.push({ resource, id: url.searchParams.get('id'), customer: url.searchParams.get('customer_id'), type: url.searchParams.get('document_type') });
  if (url.searchParams.get('month') !== '2026-10') return new Response(JSON.stringify({ ok: false, error: 'BILLING_READ_FAILED' }), { status: 502 });
  if (resource === 'document') {
    assert.equal(url.searchParams.get('customer_id'), 'c1');
    const response = () => new Response('%PDF-1.7\nfixture\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } });
    if (holdPdf) return new Promise(resolve => { releasePdf = () => resolve(response()); });
    return response();
  }
  let data = { resource };
  if (resource === 'list') data.values = fixture.lists[url.searchParams.get('key')] || {};
  else if (resource === 'contract') data.contract = contract;
  else if (resource === 'invoice') {
    assert.equal(url.searchParams.get('id'), 'i1'); assert.equal(url.searchParams.get('customer_id'), 'c1');
    data.invoice = { ...fixture.invoices[0], lines: [{ line_type: 'M', title: 'Entretien facturé', quantity: '2', unit_type: 'H', amount_incl_taxe: '80', unit_price_incl_taxe: '40' }] };
  } else { data.records = fixture[resource]; data.page = 1; data.total = data.records.length; data.has_more = false; data.next_page = null; }
  return new Response(JSON.stringify({ ok: true, company: 'ACJ Services', read_only: true, ...data }), { headers: { 'Content-Type': 'application/json' } });
};
function findButton(container, text) { const found = [...container.querySelectorAll('button')].find(node => node.textContent === text); assert.ok(found, 'Missing action: ' + text); return found; }
try {
  w.eval(app); await until(() => doc.getElementById('status').textContent.includes('Lecture complète'));
  assert.equal(doc.getElementById('ready-count').textContent, '0', 'The pending A réaliser visit still requires review');
  const client = doc.querySelector('.client'); client.open = true; client.dispatchEvent(new w.Event('toggle'));
  await until(() => doc.querySelector('.contract-card') && doc.querySelector('.invoice-card'));
  const source = doc.querySelector('.contract-card');
  assert.match(source.textContent, /40,00\s*€/); assert.match(source.textContent, /140,00\s*€/); assert.match(source.textContent, /Horaires planifiés/);
  assert.match(source.textContent, /Facturation récurrente/); assert.doesNotMatch(source.textContent, /mensuel/i);
  assert.equal(doc.querySelectorAll('.forfait-guide').length, 0, 'A product name does not override its hourly contract rules');
  assert.doesNotMatch(doc.getElementById('clients').textContent, /TVA manquant|Autorisation de facturer|Rattachement de l’établissement|10 points/);
  assert.match(doc.querySelector('.invoice-card').textContent, /passages à rapprocher|rapprochement à vérifier/);
  assert.equal(doc.querySelectorAll('a[href*="ogust"]').length, 0, 'Inspecting the evidence does not navigate to Ogust');
  findButton(doc.querySelector('.invoice-card'), 'Voir les lignes').click();
  await until(() => /Entretien facturé/.test(doc.querySelector('.invoice-card').textContent));
  assert.match(doc.querySelector('.invoice-card').textContent, /2 h/); assert.equal(calls.filter(call => call.resource === 'invoice').length, 1);
  findButton(source, 'Voir le contrat PDF').click();
  await until(() => !doc.getElementById('document-view').hidden);
  assert.ok(doc.getElementById('document-dialog').open); assert.match(doc.getElementById('pdf-object').data, /^blob:/);
  assert.match(doc.getElementById('document-download').href, /^blob:/); assert.equal(calls.at(-1).type, 'contract');
  doc.getElementById('document-close').click(); assert.equal(doc.getElementById('document-dialog').open, false); assert.equal(revoked.length, 1);
  holdPdf = true; findButton(source, 'Voir le devis d’origine').click(); await until(() => releasePdf);
  const month = doc.getElementById('month'); month.value = '2026-09'; month.dispatchEvent(new w.Event('change', { bubbles: true }));
  releasePdf(); await wait(60);
  assert.equal(doc.getElementById('document-dialog').open, false); assert.equal(objectUrls.length, 1, 'A late old-period PDF is discarded before creating a new blob URL');
  assert.equal(doc.querySelectorAll('.contract-card').length, 0); assert.equal(errors.length, 0);
  console.log('Billing evidence UI: native hourly rules under a Forfait label, contract unit prices vs totals, invoice lines, in-app PDF, source-scoped reads, no browser storage and stale document cleanup verified with synthetic APIs.');
} finally { w.close(); }
