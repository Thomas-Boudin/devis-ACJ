// Pure reconciliation rules. This module never calls an API or writes an invoice.
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const id = value => String(value ?? '').trim();
const index = (rows, key) => new Map((rows || []).map(row => [id(row[key]), row]));
const day = value => String(value ?? '').replace(/\D/g, '').slice(0, 8);
export const FORFAIT_REVIEW_REASON = 'Forfait : calcul automatique non pris en charge';
export function visibleReviewReasons(row) {
  if (row.billing_kind !== 'forfait' || row.state !== 'review') return row.reasons;
  // The shared forfait instructions already ask the user to confirm realization.
  // Keep all invoice, duplicate, identity and cancellation warnings visible.
  const covered = new Set([FORFAIT_REVIEW_REASON, 'Validation de réalisation manquante', 'Réalisation de la prestation à confirmer']);
  return row.reasons.filter(reason => !covered.has(reason));
}
export function decimal(value) {
  const source = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(source) && Number.isFinite(Number(source)) ? Number(source) : null;
}
function labelled(lists, key, value) { return String(lists?.[key]?.[id(value)] || value || ''); }
function boolean(value) {
  const v = normalize(value);
  if (['1', 'o', 'oui', 'y', 'yes', 'true'].includes(v)) return true;
  if (['0', 'n', 'non', 'no', 'false'].includes(v)) return false;
  return null;
}
function dateTime(value) {
  const d = String(value ?? '').replace(/\D/g, '');
  if (d.length !== 12 && d.length !== 14) return null;
  const [y, m, dt, h, min] = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10), d.slice(10, 12)].map(Number);
  const time = Date.UTC(y, m - 1, dt, h, min);
  const check = new Date(time);
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === dt && h < 24 && min < 60 ? time : null;
}
function validValidation(value) { return dateTime(value) !== null; }
function validDay(value) {
  const valueDay = day(value);
  return valueDay.length === 8 && dateTime(valueDay + '0000') !== null ? valueDay : '';
}
export function unitKind(value, label = '') {
  const raw = normalize(value), name = normalize(label || value);
  if (/hh\s*[:h]\s*mm|heure.*minute|heure.*sexages/.test(name)) return 'clock';
  if (/^(min|mn|minute|minutes)$/.test(raw) || /minute/.test(name)) return 'minutes';
  if (/^(h|hr|hrs|heure|heures)$/.test(raw) || /heure|hour|centiem/.test(name)) return 'hours';
  return null;
}
export function hours(value, kind) {
  if (!kind) return null;
  const raw = String(value ?? '').trim();
  const clock = raw.match(/^(\d{1,3}):([0-5]\d)$/);
  if (clock && kind !== 'minutes') return Number(clock[1]) + Number(clock[2]) / 60;
  if (kind === 'clock') return null; // Never guess whether 2.30 means 2h18 or 2h30.
  const n = decimal(value);
  return n === null || n <= 0 ? null : kind === 'minutes' ? n / 60 : n;
}
export function invoiceState(invoice, lists = {}) {
  const raw = id(invoice?.status).toUpperCase();
  const label = normalize(labelled(lists, 'invoice.status', invoice?.status));
  if (raw === 'S' || /supprim|annul/.test(label)) return 'deleted';
  if (id(invoice?.type).toUpperCase() === 'A') return 'credit';
  if (id(invoice?.type).toUpperCase() !== 'F') return 'unknown';
  if (raw === 'B' || /brouillon/.test(label)) return 'draft';
  if ((id(invoice?.number) && id(invoice.number) !== '0') || validDay(invoice?.validation_date)) return 'final';
  return 'unknown';
}
function overlapsMonth(invoice, month) {
  const target = month.replace('-', '');
  const explicit = String(invoice.invoice_month || '').replace(/\D/g, '');
  const knownMonth = /^20\d{2}(0[1-9]|1[0-2])/.test(explicit);
  if (knownMonth && explicit.startsWith(target)) return true;
  const first = validDay(invoice.start_of_period), last = validDay(invoice.end_of_period);
  if (first && last && first <= last) return first <= target + '31' && last >= target + '01';
  // A partial/invalid period remains ambiguous; a different explicit month can
  // disambiguate a legacy invoice only when both period dates are absent.
  const hasPeriod = [invoice.start_of_period, invoice.end_of_period].some(value => day(value) && day(value) !== '00000000');
  return hasPeriod || !knownMonth;
}
function monthly(label) {
  const value = normalize(label);
  return !/bimens|bimes|trimes|semes|annuel|quinz/.test(value) && /mensuel|chaque mois|par mois|fin de mois|mois civil/.test(value);
}
function realized(service, lists) {
  const raw = id(service.status).toUpperCase();
  const label = normalize(labelled(lists, 'service.status', service.status));
  if (/annul|supprim/.test(label)) return 'cancelled';
  if (raw === 'R' || /realis|effectu|termine/.test(label)) return 'realized';
  return 'unconfirmed';
}
function forfaitFor(service, product, contract, lists) {
  const namedForfait = value => /\bforfait(?:aire)?\b/.test(normalize(value));
  if (namedForfait(product?.label) || namedForfait(labelled(lists, 'contract.pricing', contract?.pricing))) return true;
  const matching = (contract?.lines || []).filter(line =>
    (id(service.rates) && id(line.rates) === id(service.rates)) ||
    (id(service.product_level) && id(line.product_level) === id(service.product_level)));
  return matching.some(line => namedForfait(line.title) || namedForfait(labelled(lists, 'linecontract.unit', line.unit)));
}
function pricingFor(service, contract, rateMap, lists) {
  const issues = [];
  const monetary = (contract.lines || []).filter(line => id(line.line_type).toUpperCase() === 'M');
  let matches = monetary.filter(line => id(service.rates) && id(line.rates) === id(service.rates));
  if (!matches.length) matches = monetary.filter(line => id(line.product_level) === id(service.product_level));
  if (matches.length !== 1) return { issues: ['Ligne tarifaire du contrat absente ou ambiguë'], amount_cents: null, quantity_hours: null };
  const line = matches[0];
  if (id(line.product_level) && id(line.product_level) !== id(service.product_level)) issues.push('Prestation différente de celle du tarif contractuel');
  if (id(service.rates) && id(line.rates) && id(service.rates) !== id(line.rates)) issues.push('Tarif de la prestation différent du contrat');
  const rate = rateMap.get(id(line.rates || service.rates));
  if (rate?.product_level && id(rate.product_level) !== id(service.product_level)) issues.push('Tarif rattaché à une autre prestation');
  const billingUnit = unitKind(service.billing_amount_unit, labelled(lists, 'service.billing_amount_unit', service.billing_amount_unit));
  const priceUnit = unitKind(line.unit || rate?.unit, line.unit ? labelled(lists, 'linecontract.unit', line.unit) : labelled(lists, 'rates.unit', rate?.unit));
  const quantityHours = hours(service.billing_amount, billingUnit);
  if (!quantityHours || quantityHours > 24) issues.push('Quantité facturable ou unité à vérifier');
  if (!priceUnit || priceUnit === 'clock') issues.push('Unité du prix contractuel à vérifier');
  if ((decimal(line.discount_amount) ?? 0) !== 0) issues.push('Remise contractuelle à contrôler');
  const vat = decimal(line.sale_taxe_rat) ?? decimal(rate?.tax_rate);
  const calculation = normalize(contract.calculation_method).toUpperCase();
  let price = null;
  if (calculation === 'TTC') price = decimal(line.amount_unit_TTC) ?? decimal(rate?.selling_price_inc);
  else if (calculation === 'HT') {
    const ht = decimal(line.amount_unit_HT) ?? decimal(rate?.selling_price);
    if (ht !== null && vat !== null) price = ht * (1 + vat / 100);
  } else issues.push('Base de calcul HT ou TTC à confirmer');
  if (price === null || price <= 0 || vat === null || vat < 0 || vat > 100) issues.push('Prix ou TVA manquant dans le contrat');
  const start = dateTime(service.start_date), end = dateTime(service.end_date);
  if (start === null || end === null || end <= start || end - start > 86400000) issues.push('Horaires de prestation incohérents');
  else if (quantityHours && Math.abs(quantityHours - (end - start) / 3600000) > 1 / 60 + 1e-8) issues.push('Quantité facturable différente de la durée enregistrée');
  const quantity = quantityHours && priceUnit === 'minutes' ? quantityHours * 60 : quantityHours;
  return { issues, quantity_hours: quantityHours,
    unit_price_ttc: price, price_source: 'Contrat ' + (contract.reference || contract.id_contract),
    amount_cents: !issues.length && quantity && price !== null ? Math.round((quantity * price + Number.EPSILON) * 100) : null };
}
export function contractsToRead(services, invoices, lists = {}) {
  const invoiced = new Set(invoices.filter(i => invoiceState(i, lists) === 'final').flatMap(i => i.service_ids));
  const byId = index(invoices, 'id_invoice');
  return [...new Set(services.filter(service => !invoiced.has(id(service.id_service)) && !(service.invoice_ids || []).some(key => invoiceState(byId.get(id(key)), lists) === 'final')).map(service => id(service.contract)).filter(Boolean))];
}
export function reconcile(snapshot) {
  const { month, services = [], invoices = [], contracts = [], customers = [], rates = [], products = [], lists = {}, complete = false, contract_errors = [] } = snapshot;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('BILLING_MONTH_INVALID');
  const target = month.replace('-', '');
  const contractMap = index(contracts, 'id_contract'), customerMap = index(customers, 'id_customer');
  const rateMap = index(rates, 'id_rate'), productMap = index(products, 'id_productlevel'), invoiceMap = index(invoices, 'id_invoice');
  const byService = new Map(), ambiguousByCustomer = new Map(), duplicateTimes = new Map();
  for (const invoice of invoices) {
    for (const key of invoice.service_ids || []) {
      if (!byService.has(id(key))) byService.set(id(key), []);
      byService.get(id(key)).push(invoice);
    }
    if (!(invoice.service_ids || []).length && invoiceState(invoice, lists) !== 'deleted' && overlapsMonth(invoice, month)) {
      const key = id(invoice.id_customer);
      if (!ambiguousByCustomer.has(key)) ambiguousByCustomer.set(key, []);
      ambiguousByCustomer.get(key).push(invoice);
    }
  }
  for (const service of services) {
    const key = [service.id_customer, service.id_employee, service.product_level, service.start_date, service.end_date].map(id).join('|');
    if (!duplicateTimes.has(key)) duplicateTimes.set(key, []);
    duplicateTimes.get(key).push(id(service.id_service));
  }
  const rows = services.map(service => {
    const customer = customerMap.get(id(service.id_customer));
    const product = productMap.get(id(service.product_level));
    const contract = contractMap.get(id(service.contract));
    const forfait = forfaitFor(service, product, contract, lists);
    const related = new Map((byService.get(id(service.id_service)) || []).map(i => [id(i.id_invoice), i]));
    const issues = [];
    for (const key of service.invoice_ids || []) {
      const invoice = invoiceMap.get(id(key));
      if (invoice) related.set(id(key), invoice); else issues.push('Facture liée introuvable dans la lecture complète');
    }
    const attached = [...related.values()];
    const states = attached.map(i => invoiceState(i, lists));
    const final = attached.filter((i, n) => states[n] === 'final');
    const realization = realized(service, lists);
    let state = 'review';
    const result = { id: id(service.id_service), customer_id: id(service.id_customer), client: customer?.label || 'Client ' + id(service.id_customer),
      product: product?.label || 'Prestation ' + id(service.product_level), start: service.start_date, end: service.end_date,
      state, reasons: issues, amount_cents: null, quantity_hours: null, contract: contract?.reference || id(service.contract), billing_kind: forfait ? 'forfait' : 'hourly',
      invoices: attached.map(i => ({ id: i.id_invoice, number: i.number, state: invoiceState(i, lists) })) };
    if (!complete) issues.push('Lecture des données incomplète');
    if (id(service.type) !== 'I') issues.push('Type de prestation à vérifier');
    if (!day(service.start_date).startsWith(target)) issues.push('Prestation hors du mois demandé');
    const duplicateKey = [service.id_customer, service.id_employee, service.product_level, service.start_date, service.end_date].map(id).join('|');
    if (duplicateTimes.get(duplicateKey)?.length > 1) issues.push('Deux interventions identiques au même horaire');
    if (attached.some(i => id(i.id_customer) !== id(service.id_customer))) issues.push('Facture liée à un autre client');
    if (states.includes('credit')) issues.push('Avoir associé : vérifier la situation de facturation');
    if (states.includes('draft')) issues.push('Prestation déjà présente dans une facture brouillon');
    if (states.includes('deleted')) issues.push('Lien vers une facture supprimée ou annulée');
    if (states.includes('unknown')) issues.push('Statut de facture à vérifier');
    if (final.length > 1) issues.push('Prestation rattachée à plusieurs factures validées');
    if (realization === 'cancelled') issues.push('Annulation : vérifier les règles de facturation');
    if (final.length === 1 && !issues.length) state = 'billed';
    else if (!attached.length && !issues.length && boolean(product?.internal_hour) === true) state = 'ignored';
    else if (!final.length) {
      if (ambiguousByCustomer.has(id(service.id_customer))) issues.push('Facture client sans lien explicite avec les prestations : rapprochement nécessaire');
      if (!customer) issues.push('Client absent du répertoire Ogust');
      if (!product) issues.push('Prestation absente du catalogue Ogust');
      if (realization !== 'realized' && realization !== 'cancelled') issues.push('Réalisation de la prestation à confirmer');
      if (!validValidation(service.validate_date_I) && !validValidation(service.validate_date_C)) issues.push('Validation de réalisation manquante');
      if (forfait) issues.push(FORFAIT_REVIEW_REASON);
      if (!contract) issues.push(contract_errors.includes(id(service.contract)) ? 'Lecture du contrat impossible' : 'Contrat associé manquant');
      else if (forfait) {
        // Unsupported pricing is one app limitation, not ten hourly-field errors.
        // Known identity conflicts and contract/cancellation facts still matter.
        if (id(contract.id_customer) !== id(service.id_customer)) issues.push('Contrat rattaché à un autre client');
        if (contract.id_company && customer?.id_company && id(contract.id_company) !== id(customer.id_company)) issues.push('Rattachement de l’établissement à vérifier');
        const status = normalize(labelled(lists, 'contract.status', contract.status));
        if (/annul|supprim|brouillon|expire|inactif/.test(status)) issues.push('Statut du contrat à confirmer');
        const start = validDay(contract.start_date), end = validDay(contract.end_date);
        if ((start && day(service.start_date) < start) || (end && day(service.end_date) > end)) issues.push('Dates de validité du contrat à vérifier');
      }
      else {
        if (id(contract.id_customer) !== id(service.id_customer)) issues.push('Contrat rattaché à un autre client');
        if (!contract.id_company || !customer?.id_company || id(contract.id_company) !== id(customer.id_company)) issues.push('Rattachement de l’établissement à vérifier');
        const status = normalize(labelled(lists, 'contract.status', contract.status));
        if (/annul|supprim|brouillon|expire|inactif/.test(status) || !/valide|accepte|signe|actif|en cours/.test(status)) issues.push('Statut du contrat à confirmer');
        const contractStart = validDay(contract.start_date), contractEnd = validDay(contract.end_date);
        const hasEnd = day(contract.end_date) && day(contract.end_date) !== '00000000';
        if (!contractStart || day(service.start_date) < contractStart || (hasEnd && (!contractEnd || day(service.end_date) > contractEnd))) issues.push('Dates de validité du contrat à vérifier');
        if (!monthly(labelled(lists, 'contract.generation', contract.generation))) issues.push('Périodicité de facturation à confirmer');
        const pricing = normalize(labelled(lists, 'contract.pricing', contract.pricing));
        if (!pricing || /forfait|proportion|mensualis/.test(pricing) || !/reel|heure|horaire/.test(pricing)) issues.push('Tarification particulière ou règle à confirmer');
        if (boolean(labelled(lists, 'contract.to_invoice', contract.to_invoice)) !== true) issues.push('Autorisation de facturer du contrat à confirmer');
        const considered = normalize(labelled(lists, 'contract.services_to_consider', contract.services_to_consider));
        if (!/realis|effectu|valid/.test(considered) || /planifi|annul|toutes/.test(considered)) issues.push('Règle de sélection des interventions à confirmer');
        if (!contract.lines_present) issues.push('Lignes du contrat incomplètes');
        if (!contract.majorations_present || contract.has_majorations) issues.push('Majorations contractuelles à contrôler');
        if ([contract.lump_sum_amount, contract.propamount_amount, contract.realamount_mile_amount, contract.realamount_service_amount].some(x => (decimal(x) ?? 0) !== 0)
          || (decimal(service.distance_charged) ?? 0) !== 0 || (decimal(service.fees_amount_charged) ?? 0) !== 0) issues.push('Forfait ou frais supplémentaires à intégrer');
        if (contract.paidfor_service && !['0', 'N', 'n'].includes(id(contract.paidfor_service))) issues.push('Financement du contrat à contrôler');
        const price = pricingFor(service, contract, rateMap, lists);
        issues.push(...price.issues);
        Object.assign(result, { amount_cents: price.amount_cents, quantity_hours: price.quantity_hours, price_source: price.price_source });
      }
      if (!issues.length && state !== 'ignored') state = 'ready';
    }
    result.state = state; result.reasons = [...new Set(issues)];
    if (state === 'ignored') result.reasons = ['Heure interne du catalogue Ogust'];
    return result;
  });
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.customer_id)) groups.set(row.customer_id, { id: row.customer_id, client: row.client, rows: [], state: 'ignored', amount_cents: 0 });
    groups.get(row.customer_id).rows.push(row);
  }
  for (const group of groups.values()) {
    if (group.rows.some(row => row.state === 'review')) {
      group.state = 'review';
      for (const row of group.rows.filter(row => row.state === 'ready')) {
        row.state = 'review'; row.reasons.push('Une autre prestation de ce client reste à vérifier');
      }
    } else if (group.rows.some(row => row.state === 'ready')) group.state = 'ready';
    else if (group.rows.some(row => row.state === 'billed')) group.state = 'billed';
    group.amount_cents = group.rows.filter(row => row.state === 'ready').reduce((sum, row) => sum + (row.amount_cents || 0), 0);
    group.rows.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  }
  const clients = [...groups.values()].sort((a, b) => a.client.localeCompare(b.client, 'fr'));
  return { month, complete, rows, clients, counts: {
    ready: clients.filter(c => c.state === 'ready').length,
    review: clients.filter(c => c.state === 'review').length,
    billed: rows.filter(row => row.state === 'billed').length,
    ignored: rows.filter(row => row.state === 'ignored').length,
    ready_services: rows.filter(row => row.state === 'ready').length,
    total: rows.length, clients: clients.length,
    ready_amount_cents: clients.filter(c => c.state === 'ready').reduce((sum, c) => sum + c.amount_cents, 0)
  } };
}
