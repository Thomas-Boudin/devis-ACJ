import assert from 'node:assert/strict';
import { reconcile, contractsToRead, invoiceState, hours, unitKind } from '../facturation/billing-core.mjs';

function fixture() {
  return { month: '2026-10', complete: true,
    services: [{ id_service: 's1', id_customer: 'c1', id_employee: 'e1', product_level: 'p1', rates: 'r1', contract: 'ct1', type: 'I', status: 'R', start_date: '202610050900', end_date: '202610051100', billing_amount: '2', billing_amount_unit: 'H', validate_date_I: '202610051100', invoice_ids: [] }],
    customers: [{ id_customer: 'c1', label: 'Client exemple', id_company: 'agency1' }],
    rates: [{ id_rate: 'r1', product_level: 'p1', unit: 'H', selling_price_inc: '32', selling_price: '29.090909', tax_rate: '10' }],
    products: [{ id_productlevel: 'p1', label: 'Ménage', internal_hour: 'N' }], invoices: [],
    contracts: [{ id_contract: 'ct1', id_customer: 'c1', id_company: 'agency1', reference: 'CT-1', status: 'V', start_date: '20260101', end_date: '', calculation_method: 'TTC', generation: 'M', pricing: 'R', to_invoice: 'O', services_to_consider: 'R', majorations_present: true, has_majorations: false, lines_present: true,
      lines: [{ line_type: 'M', rates: 'r1', product_level: 'p1', unit: 'H', amount_unit_TTC: '30', sale_taxe_rat: '10', discount_amount: '0' }] }],
    lists: { 'contract.status': { V: 'Validé' }, 'contract.generation': { M: 'Mensuelle' }, 'contract.pricing': { R: 'Au réel' }, 'contract.to_invoice': { O: 'Oui' }, 'contract.services_to_consider': { R: 'Réalisées' }, 'service.status': { R: 'Réalisé', A: 'Annulé' }, 'invoice.status': { B: 'Brouillon', S: 'Supprimé' }, 'service.billing_amount_unit': { H: 'Heures', MN: 'Minutes' } } };
}
function invoice(values = {}) { return { id_invoice: 'i1', id_customer: 'c1', type: 'F', status: 'V', number: 'F-2026-100', validation_date: '20261031', service_ids: ['s1'], ...values }; }
let cases = 0;
function test(name, fn) { fn(); cases++; console.log('ok', name); }
function review(change, pattern) { const data = fixture(); change(data); const result = reconcile(data); assert.equal(result.rows[0].state, 'review'); if (pattern) assert.match(result.rows[0].reasons.join(' | '), pattern); assert.equal(result.counts.ready, 0); return result; }

test('Uses the customer contract price, not the generic catalogue price', () => { const result = reconcile(fixture()); assert.equal(result.rows[0].state, 'ready'); assert.equal(result.rows[0].amount_cents, 6000); assert.equal(result.counts.ready_amount_cents, 6000); });
test('Incomplete scans never produce ready or already-billed conclusions', () => review(d => { d.complete = false; d.invoices.push(invoice()); }, /incomplète/));
test('Draft invoices reserve their services', () => review(d => d.invoices.push(invoice({ status: 'B', number: '', validation_date: '' })), /brouillon/));
test('Final invoices are matched using reverse service references', () => { const d = fixture(); d.invoices.push(invoice()); const r = reconcile(d); assert.equal(r.rows[0].state, 'billed'); assert.equal(r.counts.billed, 1); assert.equal(r.counts.ready_amount_cents, 0); });
test('Final invoices are matched using the service reference', () => { const d = fixture(); d.services[0].invoice_ids = ['i1']; d.invoices.push(invoice({ service_ids: [] })); assert.equal(reconcile(d).rows[0].state, 'billed'); });
test('Deleted invoices are not proof of billing', () => review(d => d.invoices.push(invoice({ status: 'S' })), /supprimée/));
test('Credit notes require review and never trigger rebilling', () => review(d => { d.invoices.push(invoice(), invoice({ id_invoice: 'credit1', type: 'A' })); }, /Avoir/));
test('Two final invoices for one service are an anomaly', () => review(d => d.invoices.push(invoice(), invoice({ id_invoice: 'i2', number: 'F-101' })), /plusieurs/));
test('An unresolved linked invoice is an anomaly', () => review(d => { d.services[0].invoice_ids = ['missing']; }, /introuvable/));
test('An invoice for a different client cannot prove billing', () => review(d => d.invoices.push(invoice({ id_customer: 'c2' })), /autre client/));
test('An unlinked invoice for the period blocks potential double billing', () => review(d => d.invoices.push(invoice({ service_ids: [], invoice_month: '202610' })), /sans lien explicite/));
test('An older unlinked invoice with an explicit nonoverlapping period does not block October', () => { const d = fixture(); d.invoices.push(invoice({ service_ids: [], start_of_period: '20260901', end_of_period: '20260930', invoice_month: '202609' })); assert.equal(reconcile(d).rows[0].state, 'ready'); });
test('Minutes are converted against an hourly contract without changing quantity', () => { const d = fixture(); d.services[0].billing_amount = '120'; d.services[0].billing_amount_unit = 'MN'; const r = reconcile(d).rows[0]; assert.equal(r.state, 'ready'); assert.equal(r.amount_cents, 6000); assert.equal(r.quantity_hours, 2); });
test('Sexagesimal decimals are never guessed', () => { assert.equal(hours('2.30', 'clock'), null); assert.equal(hours('2:30', 'clock'), 2.5); assert.equal(unitKind('X', 'Heure en centièmes'), 'hours'); });
test('A zero billing quantity is not replaced by planned hours', () => review(d => { d.services[0].billing_amount = '0'; }, /Quantité/));
test('A quantity-duration discrepancy remains visible', () => review(d => { d.services[0].billing_amount = '3'; }, /différente de la durée/));
test('Missing validation is visible even if service status is realized', () => review(d => { d.services[0].validate_date_I = ''; }, /Validation/));
test('Canceled services are reviewed, including when already invoiced', () => review(d => { d.services[0].status = 'A'; d.invoices.push(invoice()); }, /Annulation/));
test('Missing contracts prevent a ready classification', () => review(d => { d.contracts = []; }, /Contrat associé manquant/));
test('Cross-client contracts cannot be used', () => review(d => { d.contracts[0].id_customer = 'c2'; }, /Contrat rattaché à un autre/));
test('Cross-establishment contracts require review', () => review(d => { d.contracts[0].id_company = 'other'; }, /établissement/));
test('Forfaits are never billed using planned hours', () => review(d => { d.lists['contract.pricing'].R = 'Forfait'; }, /Tarification particulière/));
test('Discounts, fees and markups require review', () => review(d => { d.contracts[0].lines[0].discount_amount = '10'; d.services[0].fees_amount_charged = '5'; d.contracts[0].has_majorations = true; }, /Remise/));
test('Unknown periodicity is not inferred', () => review(d => { d.lists['contract.generation'] = {}; }, /Périodicité/));
test('An annulled contract is never treated as active', () => review(d => { d.lists['contract.status'].V = 'Annulé'; }, /Statut/));
test('Expired contracts remain blocked', () => review(d => { d.contracts[0].end_date = '20260930'; }, /validité/));
test('Conflicting contract lines are ambiguous', () => review(d => { d.contracts[0].lines.push({ ...d.contracts[0].lines[0], amount_unit_TTC: '20' }); }, /ambiguë/));
test('Internal hours are excluded using their explicit catalogue flag', () => { const d = fixture(); d.products[0].internal_hour = 'O'; assert.equal(reconcile(d).rows[0].state, 'ignored'); });
test('A client dossier is blocked as a whole when one intervention has an issue', () => { const d = fixture(); d.services.push({ ...d.services[0], id_service: 's2', start_date: '202610060900', end_date: '202610061100', validate_date_I: '' }); const result = reconcile(d); assert.ok(result.rows.every(r => r.state === 'review')); assert.equal(result.counts.ready_amount_cents, 0); });
test('Duplicate interventions are flagged before an amount can be ready', () => { const d = fixture(); d.services.push({ ...d.services[0], id_service: 's2' }); assert.ok(reconcile(d).rows.every(r => r.reasons.some(s => /identiques/.test(s)))); });
test('A finalized reverse link avoids unnecessary contract reads', () => { const d = fixture(); d.invoices.push(invoice()); assert.deepEqual(contractsToRead(d.services, d.invoices, d.lists), []); });
test('Invalid months are rejected', () => assert.throws(() => reconcile({ month: '2026-13' }), /MONTH/));
test('Unknown invoice types cannot prove billing', () => assert.equal(invoiceState(invoice({ type: 'X' })), 'unknown'));
console.log(`${cases} billing reconciliation checks passed`);
