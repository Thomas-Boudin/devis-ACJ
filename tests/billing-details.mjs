import assert from 'node:assert/strict';
import { contractView, invoiceEvidence, frenchDay, moneyValue, ruleLabel } from '../facturation/billing-details.mjs';
const contract = { id_contract: 'ct1', reference: 'CT-EXAMPLE', status: 'C', base_payment: 'TTC', calculation_method: 'PLA', to_invoice: 'HEU', type_hours: 'PLA', pricing: 'CP', generation: 'N', services_to_consider: 'P', amount_TTC: '140.00', start_date: '20260101', document_available: true, lines: [{ line_type: 'M', title: 'Forfait entretien du jardin', unit: 'H', quantity: '3.5', amount_unit_TTC: '40', amount_global_TTC: '140', sale_taxe_rat: '20' }] };
const view = contractView(contract);
assert.equal(view.mode, 'hourly'); assert.equal(view.lines[0].unit_ttc_cents, 4000); assert.equal(view.lines[0].unit, 'h'); assert.equal(view.total_ttc_cents, 14000);
assert.match(view.facts.find(([key]) => key === 'Rythme')[1], /récurrente/); assert.ok(!view.facts.some(([, value]) => /mensuel/i.test(value)), 'Recurrence N does not invent monthly contract terms');
assert.equal(view.document_available, true); assert.equal(contractView({ id_contract: 'empty', lines: [] }).total_ttc_cents, null);
assert.equal(moneyValue(''), null); assert.equal(moneyValue('0'), 0); assert.equal(moneyValue('1 200,50'), 120050);
assert.equal(frenchDay('20260230'), 'Non précisée'); assert.equal(frenchDay('202610141330'), '14/10/2026'); assert.equal(frenchDay('00000000'), 'Non précisée');
assert.match(ruleLabel({}, 'contract.status', '__proto__'), /confirmer/);
const client = { id: 'c1', rows: [{ id: 's1', contract_id: 'ct1', invoices: [] }] };
const invoices = [
  { id_invoice: 'direct', id_customer: 'c1', number: 'F1', type: 'F', status: 'V', amount_incl_taxe: '40', service_ids: ['s1'], invoice_date: '20261101', start_of_period: '20261001', end_of_period: '20261031' },
  { id_invoice: 'same-price', id_customer: 'c1', number: 'F2', type: 'F', status: 'V', amount_incl_taxe: '40', service_ids: [], contract: 'ct1', invoice_date: '20261031', start_of_period: '20261001', end_of_period: '20261031' },
  { id_invoice: 'old', id_customer: 'c1', number: 'F3', type: 'F', status: 'V', amount_incl_taxe: '40', service_ids: [], invoice_date: '20260131', start_of_period: '20260101', end_of_period: '20260131' },
  { id_invoice: 'other', id_customer: 'c2', number: 'F4', type: 'F', status: 'V', amount_incl_taxe: '40', service_ids: [], invoice_date: '20261031' }
];
const related = invoiceEvidence(client, invoices, '2026-10');
assert.equal(related.relevant.length, 2); assert.equal(related.history.length, 1);
assert.equal(related.relevant.find(x => x.id_invoice === 'direct').exact, true);
assert.equal(related.relevant.find(x => x.id_invoice === 'same-price').exact, false, 'Equal amounts are not proof of a service-to-invoice link');
assert.ok(![...related.relevant, ...related.history].some(x => x.id_invoice === 'other'));
assert.equal(contractView({ ...contract, calculation_method: 'FOR', lump_sum_amount: '100' }).fixed_amount_cents, 10000);
console.log('Billing details: source unit price vs contract total, real Ogust recurrence codes, empty amounts, dates, exact invoice links vs unlinked candidates and history are distinguished.');
