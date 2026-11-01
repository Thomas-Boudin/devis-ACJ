// Production billing renderer with synthetic contracts and fully mocked read APIs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import * as engine from '../facturation/billing-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const deps = path.resolve(import.meta.dirname, process.env.ACJ_DOM_TEST_DEPS || '../../dom-test/node_modules');
const require = createRequire(path.join(deps, 'billing-test.cjs'));
const { JSDOM, VirtualConsole } = require(path.join(deps, 'jsdom/lib/api.js'));
const html = fs.readFileSync(path.join(root, 'facturation/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'facturation/billing-app.mjs'), 'utf8')
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];\s*/, 'const {contractsToRead,normalize,reconcile,visibleReviewReasons}=window.__billingEngine;\n');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 150; i++) { if (fn()) return; await wait(10); } throw new Error('Billing renderer timed out'); }
function fixture() {
  return {
    services: [
      { id_service: 's1', id_customer: 'c1', id_employee: 'e1', product_level: 'p1', rates: 'r1', contract: 'ct1', type: 'I', status: 'R', start_date: '202610081330', end_date: '202610081630', billing_amount: '1', billing_amount_unit: 'Q', invoice_ids: [] },
      { id_service: 's2', id_customer: 'c1', id_employee: 'e1', product_level: 'p1', rates: 'r1', contract: 'ct1', type: 'I', status: 'R', start_date: '202610141330', end_date: '202610141430', billing_amount: '1', billing_amount_unit: 'Q', invoice_ids: [] }
    ],
    customers: [{ id_customer: 'c1', label: 'Client jardin exemple', id_company: 'agency1' }],
    products: [{ id_productlevel: 'p1', label: 'Forfait Entretien complet du jardin', internal_hour: 'N' }],
    rates: [{ id_rate: 'r1', product_level: 'p1', unit: 'Q', tax_rate: '20', selling_price_inc: '100' }],
    invoices: [],
    contract: { id_contract: 'ct1', id_customer: 'c1', status: 'V', start_date: '20260101', lines_present: true, lines: [] },
    lists: { 'contract.status': { V: 'Validé' } }
  };
}
async function render(data, check) {
  const errors = [], calls = [], vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url: 'https://thomas-boudin.github.io/devis-ACJ/facturation/?month=2026-10', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, doc = w.document;
  Object.assign(w, { Response, Request, Headers, AbortController, __billingEngine: engine, acjAuthV292: { serverRequired: true, authenticated: true } });
  w.fetch = async (input, options) => {
    assert.equal(options.method, 'GET', 'Billing guidance must not perform business writes');
    const url = new URL(input), resource = url.searchParams.get('resource'); calls.push(resource);
    let result = { resource };
    if (resource === 'list') result.values = data.lists[url.searchParams.get('key')] || {};
    else if (resource === 'contract') result.contract = data.contract;
    else { result.records = data[resource]; result.page = 1; result.total = result.records.length; result.has_more = false; result.next_page = null; }
    return new Response(JSON.stringify({ ok: true, company: 'ACJ Services', read_only: true, ...result }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    w.eval(app);
    await until(() => doc.getElementById('status').textContent.includes('Lecture complète'));
    assert.equal(errors.length, 0);
    await check(doc, calls);
  } finally { w.close(); }
}
await render(fixture(), doc => {
  assert.equal(doc.querySelectorAll('.forfait-guide').length, 1, 'A client gets one guide for both visits');
  assert.equal(doc.querySelectorAll('.forfait-guide ol li').length, 3);
  assert.match(doc.querySelector('.forfait-guide').textContent, /pas encore pris en charge/);
  assert.match(doc.querySelector('.client-meta').textContent, /forfait à contrôler dans Ogust/);
  assert.equal(doc.querySelectorAll('.service').length, 2);
  assert.equal(doc.querySelectorAll('.service-reasons').length, 0, 'Covered realization instructions are not repeated per visit');
  assert.equal(doc.querySelectorAll('.service-source').length, 0, 'Planned hours cannot produce a forfait amount');
  assert.equal(doc.getElementById('ready-count').textContent, '0');
  assert.doesNotMatch(doc.getElementById('clients').textContent, /TVA manquant|Quantité facturable|Base de calcul|Périodicité de facturation|10 points/);
});
const reserved = fixture();
reserved.invoices = [{ id_invoice: 'draft1', id_customer: 'c1', status: 'B', type: 'F', number: '', validation_date: '', service_ids: ['s1'] }];
await render(reserved, doc => {
  assert.match(doc.querySelector('.service-reasons').textContent, /brouillon/);
  assert.equal(doc.querySelector('.client > summary .badge').textContent, 'À vérifier', 'A real invoice warning is not replaced by the forfait limitation badge');
  assert.match(doc.getElementById('clients').textContent, /draft1/);
});
const billed = fixture();
billed.invoices = [{ id_invoice: 'final1', id_customer: 'c1', status: 'V', type: 'F', number: 'F-EXEMPLE', validation_date: '20261031', service_ids: ['s1', 's2'] }];
await render(billed, (doc, calls) => {
  doc.querySelector('[data-filter="billed"]').click();
  assert.equal(doc.getElementById('billed-count').textContent, '2');
  assert.equal(doc.querySelectorAll('.forfait-guide').length, 0, 'Already billed forfaits do not create extra manual work');
  assert.equal(calls.includes('contract'), false);
  assert.match(doc.getElementById('clients').textContent, /F-EXEMPLE/);
});
console.log('Billing forfait UI: one actionable guide per client, no hourly false alerts or fabricated amounts, draft warnings retained and finalized invoices preserved; mocked read-only APIs.');
