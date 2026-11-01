import assert from 'node:assert/strict';
import { reconcile, contractsToRead, invoiceState, hours, unitKind, visibleReviewReasons, FORFAIT_REVIEW_REASON } from '../facturation/billing-core.mjs';

function fixture() {
  return { month: '2026-10', complete: true,
    services: [{ id_service: 's1', id_customer: 'c1', id_employee: 'e1', product_level: 'p1', rates: 'r1', contract: 'ct1', type: 'I', status: 'R', start_date: '202610050900', end_date: '202610051100', billing_amount: '2', billing_amount_unit: 'H', validate_date_I: '202610051100', invoice_ids: [] }],
    customers: [{ id_customer: 'c1', label: 'Client exemple', id_company: 'agency1' }],
    rates: [{ id_rate: 'r1', product_level: 'p1', unit: 'H', selling_price_inc: '32', selling_price: '29.090909', tax_rate: '10' }],
    products: [{ id_productlevel: 'p1', label: 'Ménage', internal_hour: 'N' }], invoices: [],
    contracts: [{ id_contract: 'ct1', id_customer: 'c1', id_company: 'agency1', reference: 'CT-1', status: 'V', start_date: '20260101', end_date: '', base_payment: 'TTC', calculation_method: 'PLA', type_hours: 'PLA', generation: 'N', pricing: 'CP', to_invoice: 'QTE', services_to_consider: 'P', majorations_present: true, has_majorations: false, lines_present: true,
      lines: [{ line_type: 'M', rates: 'r1', product_level: 'p1', unit: 'H', amount_unit_TTC: '30', sale_taxe_rat: '10', discount_amount: '0' }] }],
    lists: { 'contract.status': { V: 'Validé', C: 'Accepté' }, 'contract.generation': { N: 'De manière récurrente', '1': 'Une seule facture' }, 'contract.pricing': { CP: 'Tarif du contrat' }, 'contract.to_invoice': { HEU: 'Heures d’intervention', QTE: 'Quantité à facturer' }, 'contract.services_to_consider': { P: 'Prestataire', M: 'Mandataire' }, 'service.status': { R: 'Réalisé', A: 'A réaliser', N: 'Annulé' }, 'invoice.status': { B: 'Brouillon', S: 'Supprimé', A: 'Annulé' }, 'service.billing_amount_unit': { H: 'Heures', MN: 'Minutes', Q: 'Qte' } } };
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
test('An unlinked payer invoice also reserves the named beneficiary for reconciliation', () => review(d => d.invoices.push(invoice({ id_customer: 'payer1', customer_service: 'c1', service_ids: [], start_of_period: '20261001', end_of_period: '20261031' })), /sans lien explicite/));
test('An older unlinked invoice with an explicit nonoverlapping period does not block October', () => { const d = fixture(); d.invoices.push(invoice({ service_ids: [], start_of_period: '20260901', end_of_period: '20260930', invoice_month: '202609' })); assert.equal(reconcile(d).rows[0].state, 'ready'); });
test('An explicit different invoice month remains sufficient when period dates are absent', () => { const d = fixture(); d.invoices.push(invoice({ service_ids: [], invoice_month: '202609' })); assert.equal(reconcile(d).rows[0].state, 'ready'); });
test('A multi-month invoice still blocks overlapping services even when its invoice month differs', () => review(d => d.invoices.push(invoice({ service_ids: [], invoice_month: '202609', start_of_period: '20260901', end_of_period: '20261031' })), /sans lien explicite/));
test('Minutes are converted against an hourly contract without changing quantity', () => { const d = fixture(); d.services[0].billing_amount = '120'; d.services[0].billing_amount_unit = 'MN'; const r = reconcile(d).rows[0]; assert.equal(r.state, 'ready'); assert.equal(r.amount_cents, 6000); assert.equal(r.quantity_hours, 2); });
test('Sexagesimal decimals are never guessed', () => { assert.equal(hours('2.30', 'clock'), null); assert.equal(hours('2:30', 'clock'), 2.5); assert.equal(unitKind('X', 'Heure en centièmes'), 'hours'); });
test('A zero billing quantity is not replaced by planned hours', () => review(d => { d.services[0].billing_amount = '0'; }, /Quantité/));
test('Explicit QTE contract quantities are authoritative even when the planned duration differs', () => { const d = fixture(); d.services[0].billing_amount = '3'; const r = reconcile(d).rows[0]; assert.equal(r.state, 'ready'); assert.equal(r.amount_cents, 9000); });
test('The actual realized status does not require unavailable validation timestamps', () => { const d = fixture(); d.services[0].validate_date_I = ''; assert.equal(reconcile(d).rows[0].state, 'ready'); });
test('A réaliser is not confused with Réalisé', () => review(d => { d.services[0].status = 'A'; }, /Réalisation/));
test('Canceled services are reviewed, including when already invoiced', () => review(d => { d.services[0].status = 'N'; d.invoices.push(invoice()); }, /Annulation/));
test('Missing contracts prevent a ready classification', () => review(d => { d.contracts = []; }, /Contrat associé manquant/));
test('Cross-client contracts cannot be used', () => review(d => { d.contracts[0].id_customer = 'c2'; }, /Contrat rattaché à un autre/));
test('Cross-establishment contracts require review', () => review(d => { d.contracts[0].id_company = 'other'; }, /établissement/));
test('FOR fixed invoice amounts are not multiplied by planned visit hours', () => { const r = review(d => { d.contracts[0].calculation_method = 'FOR'; }, /Montant par facture/); assert.equal(r.rows[0].amount_cents, null); });
test('A product called Forfait follows its actual hourly contract rules', () => { const d = fixture(); d.products[0].label = 'Forfait Entretien complet du jardin'; d.contracts[0].to_invoice = 'HEU'; d.services[0].billing_amount = '0.00'; d.services[0].rates = '0'; d.services[0].validate_date_I = ''; delete d.customers[0].id_company; const r = reconcile(d).rows[0]; assert.equal(r.billing_kind, 'hourly'); assert.equal(r.state, 'ready'); assert.equal(r.amount_cents, 6000); });
test('Uninterpreted FOR fields do not become a list of hourly billing errors', () => {
  const r = review(d => { d.products[0].label = 'Forfait Entretien complet du jardin'; d.contracts[0].generation = ''; d.contracts[0].pricing = ''; d.contracts[0].to_invoice = ''; d.contracts[0].services_to_consider = ''; d.contracts[0].calculation_method = 'FOR'; d.contracts[0].id_company = ''; d.services[0].billing_amount_unit = ''; d.contracts[0].lines[0].amount_unit_TTC = ''; d.contracts[0].lines[0].sale_taxe_rat = ''; d.services[0].validate_date_I = ''; }, /Montant par facture/);
  assert.deepEqual(r.rows[0].reasons, [FORFAIT_REVIEW_REASON]);
  assert.deepEqual(visibleReviewReasons(r.rows[0]), []);
});
test('A forfait already linked to a final invoice remains billed', () => { const d = fixture(); d.products[0].label = 'Forfait jardin'; d.invoices.push(invoice()); const r = reconcile(d); assert.equal(r.rows[0].state, 'billed'); assert.equal(r.counts.billed, 1); });
test('Forfait guidance never hides credit notes or drafts', () => { const r = review(d => { d.products[0].label = 'Forfait jardin'; d.invoices.push(invoice({ status: 'B', number: '', validation_date: '' }), invoice({ id_invoice: 'credit', type: 'A' })); }); assert.match(visibleReviewReasons(r.rows[0]).join('|'), /Avoir/); assert.match(visibleReviewReasons(r.rows[0]).join('|'), /brouillon/); });
test('Forfait guidance never hides duplicates or known contract identity conflicts', () => { const d = fixture(); d.products[0].label = 'Forfait jardin'; d.services.push({ ...d.services[0], id_service: 's2' }); d.contracts[0].id_customer = 'c2'; const r = reconcile(d); assert.ok(r.rows.every(row => visibleReviewReasons(row).some(reason => /identiques/.test(reason)))); assert.match(visibleReviewReasons(r.rows[0]).join('|'), /autre client/); });
test('Discounts, fees and markups require review', () => review(d => { d.contracts[0].lines[0].discount_amount = '10'; d.services[0].fees_amount_charged = '5'; d.contracts[0].has_majorations = true; }, /Remise/));
test('Unknown recurrence is not inferred', () => review(d => { d.contracts[0].generation = 'X'; }, /Récurrence/));
test('An annulled contract is never treated as active', () => review(d => { d.lists['contract.status'].V = 'Annulé'; }, /Statut/));
test('Expired contracts remain blocked', () => review(d => { d.contracts[0].end_date = '20260930'; }, /validité/));
test('An invalid contract start date remains blocked', () => review(d => { d.contracts[0].start_date = '00000000'; }, /validité/));
test('Conflicting contract lines are ambiguous', () => review(d => { d.contracts[0].lines.push({ ...d.contracts[0].lines[0], amount_unit_TTC: '20' }); }, /ambiguë/));
test('Internal hours are excluded using their explicit catalogue flag', () => { const d = fixture(); d.products[0].internal_hour = 'O'; assert.equal(reconcile(d).rows[0].state, 'ignored'); });
test('A client dossier is blocked as a whole when one intervention is still A réaliser', () => { const d = fixture(); d.services.push({ ...d.services[0], id_service: 's2', start_date: '202610060900', end_date: '202610061100', status: 'A' }); const result = reconcile(d); assert.ok(result.rows.every(r => r.state === 'review')); assert.equal(result.counts.ready_amount_cents, 0); });
test('QTE forfait units are priced by their explicit quantities, not by their duration', () => { const d = fixture(); d.services[0].billing_amount_unit = 'Q'; d.services[0].billing_amount = '1'; d.contracts[0].lines[0].unit = 'F'; const r = reconcile(d).rows[0]; assert.equal(r.state, 'ready'); assert.equal(r.amount_cents, 3000); assert.equal(r.quantity_hours, null); });
test('REE telemanagement hours never fall back to planned hours', () => review(d => { d.contracts[0].to_invoice = 'HEU'; d.contracts[0].type_hours = 'REE'; }, /télégestion/));
test('HT/TTC base is separate from Ogust calculation method', () => { const d = fixture(); d.contracts[0].base_payment = 'HT'; d.contracts[0].lines[0].amount_unit_HT = '25'; const r = reconcile(d).rows[0]; assert.equal(r.state, 'ready'); assert.equal(r.amount_cents, 5500); });
test('Volume-based PP/PT pricing is not silently treated as a fixed contract price', () => review(d => { d.contracts[0].pricing = 'PP'; }, /volume/));
test('One-invoice contracts require checking their full scope before treating a month as ready', () => review(d => { d.contracts[0].generation = '1'; }, /seule facture/));
test('Invoice status A means annulled even if the status catalogue is unavailable', () => assert.equal(invoiceState(invoice({ status: 'A' }), {}), 'deleted'));
test('Duplicate interventions are flagged before an amount can be ready', () => { const d = fixture(); d.services.push({ ...d.services[0], id_service: 's2' }); assert.ok(reconcile(d).rows.every(r => r.reasons.some(s => /identiques/.test(s)))); });
test('A finalized reverse link avoids unnecessary contract reads', () => { const d = fixture(); d.invoices.push(invoice()); assert.deepEqual(contractsToRead(d.services, d.invoices, d.lists), []); });
test('Invalid months are rejected', () => assert.throws(() => reconcile({ month: '2026-13' }), /MONTH/));
test('Unknown invoice types cannot prove billing', () => assert.equal(invoiceState(invoice({ type: 'X' })), 'unknown'));
console.log(`${cases} billing reconciliation checks passed`);
