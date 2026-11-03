import { decimal, invoiceState, contractMode } from './billing-core.mjs?v=5';

const text = value => String(value ?? '').trim();
const day = value => text(value).replace(/\D/g, '').slice(0, 8);
const RULES = {
  'contract.calculation_method': { PLA: 'Selon les interventions du planning', CON: 'Reprise des lignes du contrat', FOR: 'Forfait par facture', QPR: 'Quantité prépayée', MAN: 'Mandataire sur le planifié', MDR: 'Mandataire au réel' },
  'contract.to_invoice': { HEU: 'Heures d’intervention', QTE: 'Quantité à facturer des interventions' },
  'contract.type_hours': { PLA: 'Horaires planifiés enregistrés dans Ogust', REE: 'Heures réalisées issues de la télégestion' },
  'contract.generation': { '1': 'Une seule facture pour ce contrat', N: 'Facturation récurrente' },
  'contract.pricing': { CP: 'Prix des lignes du contrat', PP: 'Tarif selon le volume de la prestation', PT: 'Tarif selon le volume global de la facture' },
  'contract.services_to_consider': { P: 'Prestataire', M: 'Mandataire' },
  'contract.status': { B: 'Brouillon', V: 'Validé', E: 'Envoyé', C: 'Accepté', T: 'Terminé', R: 'Refusé', S: 'Supprimé' },
  'invoice.status': { B: 'Brouillon', V: 'Validée', E: 'Envoyée', A: 'Annulée', S: 'Supprimée' }
};
export function ruleLabel(lists, key, value) {
  const code = text(value);
  const label = lists?.[key]?.[code] || RULES[key]?.[code];
  return typeof label === 'string' && label ? label : code ? 'Valeur à confirmer (' + code + ')' : 'Non précisé dans les données lues';
}
export function moneyValue(value) { const n = decimal(value); return n === null ? null : Math.round((n + Number.EPSILON) * 100); }
export function frenchDay(value) {
  const d = day(value);
  const year = Number(d.slice(0, 4)), month = Number(d.slice(4, 6)), date = Number(d.slice(6, 8));
  const checked = new Date(Date.UTC(year, month - 1, date));
  return /^20\d{6}$/.test(d) && checked.getUTCFullYear() === year && checked.getUTCMonth() === month - 1 && checked.getUTCDate() === date ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : 'Non précisée';
}
export function displayUnit(value) { return { H: 'h', Q: 'unité', F: 'forfait', K: 'km', min: 'min' }[text(value)] || text(value) || 'unité non précisée'; }
export function contractView(contract, lists = {}) {
  const base = ['HT', 'TTC'].includes(text(contract.base_payment).toUpperCase()) ? text(contract.base_payment).toUpperCase() : null;
  const mode = contractMode(contract);
  const facts = [
    ['Calcul', ruleLabel(lists, 'contract.calculation_method', contract.calculation_method)],
    ['Quantité utilisée', ruleLabel(lists, 'contract.to_invoice', contract.to_invoice)],
    ['Prix appliqué', ruleLabel(lists, 'contract.pricing', contract.pricing)],
    ['Rythme', ruleLabel(lists, 'contract.generation', contract.generation)]
  ];
  if (text(contract.to_invoice) === 'HEU') facts.push(['Heures utilisées', ruleLabel(lists, 'contract.type_hours', contract.type_hours)]);
  facts.push(['Base des prix', base || 'Non précisée'], ['Mode', ruleLabel(lists, 'contract.services_to_consider', contract.services_to_consider)]);
  const start = frenchDay(contract.start_date), end = contract.end_date && day(contract.end_date) !== '00000000' ? frenchDay(contract.end_date) : null;
  facts.push(['Validité', start + (end ? ' au ' + end : ' · sans fin renseignée')]);
  const lines = (contract.lines || []).map(line => ({
    title: text(line.title) || 'Ligne du contrat', text_only: text(line.line_type) === 'T', quantity: decimal(line.quantity), unit: displayUnit(line.unit),
    unit_ttc_cents: moneyValue(line.amount_unit_TTC), unit_ht_cents: moneyValue(line.amount_unit_HT),
    total_ttc_cents: moneyValue(line.amount_global_TTC), total_ht_cents: moneyValue(line.amount_global_HT), vat: decimal(line.sale_taxe_rat),
    discount: decimal(line.discount_amount)
  }));
  return { id: text(contract.id_contract), title: text(contract.reference) || 'Contrat ' + text(contract.id_contract), status: ruleLabel(lists, 'contract.status', contract.status), mode, base, facts, lines,
    total_ttc_cents: moneyValue(contract.amount_TTC), total_ht_cents: moneyValue(contract.amount_HT),
    fixed_amount_cents: mode === 'forfait' ? moneyValue(contract.lump_sum_amount) : null,
    document_available: !!contract.document_available, quotation_id: text(contract.quotation_id) };
}
function periodOverlap(invoice, month) {
  const target = month.replace('-', ''), first = day(invoice.start_of_period), last = day(invoice.end_of_period);
  if (first.length === 8 && last.length === 8 && first !== '00000000' && last !== '00000000') return first <= target + '31' && last >= target + '01';
  return day(invoice.invoice_date).startsWith(target);
}
export function invoiceEvidence(client, invoices, month, lists = {}) {
  const services = new Set(client.rows.map(row => text(row.id)));
  const direct = new Set(client.rows.flatMap(row => (row.invoices || []).map(invoice => text(invoice.id))));
  const contracts = new Set(client.rows.map(row => text(row.contract_id)).filter(Boolean));
  const relevant = [], history = [];
  for (const invoice of invoices || []) {
    const exact = direct.has(text(invoice.id_invoice)) || (invoice.service_ids || []).some(id => services.has(text(id)));
    const sameClient = [text(invoice.id_customer), text(invoice.customer_service)].includes(text(client.id));
    if (!exact && !sameClient) continue;
    const state = invoiceState(invoice, lists), overlaps = periodOverlap(invoice, month);
    const sameContract = contracts.has(text(invoice.contract));
    const relation = exact ? 'Liée aux passages affichés' : overlaps && sameContract ? 'Même contrat sur cette période · rapprochement à vérifier' : overlaps ? 'Facture du client sur cette période · passages à rapprocher' : 'Historique du client';
    const row = { ...invoice, state, label: (text(invoice.type) === 'A' ? 'Avoir · ' : '') + ruleLabel(lists, 'invoice.status', invoice.status), relation, exact, same_client: sameClient,
      amount_cents: moneyValue(invoice.amount_incl_taxe), title: text(invoice.number) || 'Brouillon ' + text(invoice.id_invoice) };
    (exact || overlaps ? relevant : history).push(row);
  }
  const sort = (a, b) => text(b.invoice_date).localeCompare(text(a.invoice_date));
  relevant.sort(sort); history.sort(sort);
  return { relevant, history };
}
