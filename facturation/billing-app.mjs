import { contractsToRead, normalize, reconcile, visibleReviewReasons } from './billing-core.mjs?v=3';

const API = 'https://acj-ogust-proxy.vercel.app/api/ogust-history';
const COMPANY = 'ACJ Services';
const $ = key => document.getElementById(key);
const money = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const labels = { services: 'prestations du mois', invoices: 'factures et avoirs', customers: 'clients', rates: 'tarifs', products: 'prestations du catalogue' };
const ids = { services: 'id_service', invoices: 'id_invoice', customers: 'id_customer', rates: 'id_rate', products: 'id_productlevel' };
const stateLabels = { review: 'À vérifier', ready: 'Prêt à facturer', billed: 'Déjà facturé', ignored: 'Hors facturation' };
const listKeys = ['service.status', 'service.billing_amount_unit', 'invoice.status', 'contract.status', 'contract.generation', 'contract.pricing', 'contract.to_invoice', 'contract.services_to_consider', 'linecontract.unit', 'rates.unit'];
let report = null, filter = 'review', controller = null, serial = 0, authReady = false;

const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
const currentMonth = `${parts.year}-${parts.month}`;
const previous = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1));
const defaultMonth = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
const requestedMonth = new URLSearchParams(location.search).get('month');
$('month').max = currentMonth;
$('month').value = /^20\d{2}-(0[1-9]|1[0-2])$/.test(requestedMonth || '') && requestedMonth <= currentMonth ? requestedMonth : defaultMonth;

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function badge(state, label = stateLabels[state]) { return element('span', 'badge ' + state, label); }
function forfaitToReview(row) { return row.billing_kind === 'forfait' && row.state === 'review'; }
function serviceDate(row) {
  const raw = String(row.start || '').replace(/\D/g, ''), end = String(row.end || '').replace(/\D/g, '');
  if (raw.length < 12) return 'Date à vérifier';
  const first = `${raw.slice(6, 8)}/${raw.slice(4, 6)} · ${raw.slice(8, 10)} h ${raw.slice(10, 12)}`;
  return first + (end.length >= 12 ? ` – ${end.slice(8, 10)} h ${end.slice(10, 12)}` : '');
}
function render() {
  const clientsBox = $('clients'); clientsBox.replaceChildren();
  if (!report) {
    clientsBox.append(element('div', 'empty', 'Les dossiers apparaîtront après la lecture complète d’Ogust.'));
    ['review-count', 'ready-count', 'billed-count'].forEach(key => $(key).textContent = '—');
    $('ready-amount').textContent = 'Estimation TTC à calculer'; $('search').disabled = true;
    $('results-title').textContent = 'Dossiers du mois';
    return;
  }
  const count = report.counts;
  $('review-count').textContent = count.review; $('ready-count').textContent = count.ready; $('billed-count').textContent = count.billed;
  $('ready-amount').textContent = money(count.ready_amount_cents) + ' TTC estimés';
  $('search').disabled = false;
  const query = normalize($('search').value);
  const visible = report.clients.filter(client => (filter === 'all' || (filter === 'billed' ? client.rows.some(row => row.state === 'billed') : client.state === filter)) && normalize(client.client).includes(query));
  $('results-title').textContent = `${visible.length} dossier${visible.length > 1 ? 's' : ''}`;
  if (!visible.length) {
    const empty = query ? 'Aucun client ne correspond à cette recherche.' : filter === 'review' ? 'Aucun dossier à vérifier pour ce mois.' : filter === 'ready' ? 'Aucun dossier prêt selon les contrôles de cette première version.' : filter === 'billed' ? 'Aucune prestation rattachée à une facture validée.' : 'Aucune prestation pour ce mois.';
    clientsBox.append(element('div', 'empty', empty)); return;
  }
  const fragment = document.createDocumentFragment();
  for (const client of visible) {
    const details = element('details', 'client'), summary = element('summary');
    const left = element('span'); left.append(element('span', 'client-title', client.client));
    const n = client.rows.length, hasForfait = client.rows.some(forfaitToReview);
    const reviews = client.rows.filter(row => row.state === 'review');
    const onlyForfaits = reviews.length > 0 && reviews.every(forfaitToReview);
    const reasonCount = new Set(client.rows.flatMap(visibleReviewReasons)).size;
    const meta = onlyForfaits ? (reasonCount ? ` · ${reasonCount} point${reasonCount > 1 ? 's' : ''} et forfait à contrôler` : ' · forfait à contrôler dans Ogust') : client.state === 'review' ? ` · ${reasonCount + (hasForfait ? 1 : 0)} point${reasonCount + (hasForfait ? 1 : 0) > 1 ? 's' : ''} à contrôler` : '';
    left.append(element('span', 'client-meta', `${n} prestation${n > 1 ? 's' : ''}` + meta));
    const right = element('span', 'client-right');
    if (client.state === 'ready') right.append(element('span', 'client-amount', money(client.amount_cents)));
    right.append(badge(client.state, onlyForfaits && !reasonCount ? 'Forfait à contrôler' : stateLabels[client.state]), element('span', 'chevron', '›')); summary.append(left, right); details.append(summary);
    const content = element('div', 'client-content');
    if (hasForfait) {
      const guide = element('section', 'forfait-guide');
      guide.append(element('strong', '', 'Ce forfait demande un contrôle dans Ogust.'), element('p', '', 'Le calcul automatique des forfaits n’est pas encore pris en charge par cette version. Les horaires ci-dessous sont ceux du planning.'));
      const steps = element('ol');
      for (const step of ['Vérifier si les passages figurent déjà sur une facture.', 'Confirmer les passages réellement effectués.', 'Retrouver le montant et le rythme du forfait dans le devis ou le contrat : par passage, par mois ou selon les travaux prévus.']) steps.append(element('li', '', step));
      guide.append(steps, element('p', '', 'Les horaires affichés ne suffisent pas à calculer le montant de ce forfait.')); content.append(guide);
    }
    for (const row of client.rows) {
      const service = element('article', 'service'), top = element('div', 'service-top'), info = element('div');
      info.append(element('div', 'service-title', row.product), element('p', 'service-date', serviceDate(row)));
      top.append(info, badge(row.state, forfaitToReview(row) ? 'Contrôle dans Ogust' : stateLabels[row.state])); service.append(top);
      const visibleReasons = visibleReviewReasons(row);
      if (visibleReasons.length) {
        const reasons = element('ul', 'service-reasons');
        for (const reason of visibleReasons) reasons.append(element('li', '', reason));
        service.append(reasons);
      }
      if (row.state === 'ready' && row.amount_cents !== null) service.append(element('p', 'service-source', `${money(row.amount_cents)} TTC estimés · ${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(row.quantity_hours)} h · ${row.price_source}`));
      if (row.invoices.length) service.append(element('p', 'invoice-ref', 'Facture' + (row.invoices.length > 1 ? 's' : '') + ' : ' + row.invoices.map(invoice => invoice.number || 'brouillon ' + invoice.id).join(', ')));
      content.append(service);
    }
    details.append(content); fragment.append(details);
  }
  clientsBox.append(fragment);
}
function progress(title, detail, value) {
  $('loading-title').textContent = title; $('loading-detail').textContent = detail; $('progress').value = Math.max(Number($('progress').value), value);
}
async function tasks(items, worker, concurrency = 3) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; await worker(item); }
  }));
}
async function request(month, params, signal) {
  const url = new URL(API);
  url.search = new URLSearchParams({ action: 'billing', company: COMPANY, month, ...params });
  const response = await fetch(url, { method: 'GET', cache: 'no-store', signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || data.company !== COMPANY || data.read_only !== true) throw new Error(response.status === 401 || response.status === 403 ? 'BILLING_AUTH_REQUIRED' : String(data.error || 'BILLING_READ_FAILED'));
  return data;
}
async function collection(resource, month, signal, onProgress) {
  const records = [], seen = new Set(); let page = 1, total = null;
  while (page !== null) {
    signal.throwIfAborted();
    const data = await request(month, { resource, page: String(page) }, signal);
    if (!Array.isArray(data.records) || data.page !== page || data.resource !== resource) throw new Error('BILLING_RESPONSE_INVALID');
    if (page > 1 && total !== data.total) throw new Error('BILLING_DATA_CHANGED');
    total = data.total;
    for (const row of data.records) {
      const key = String(row[ids[resource]] || '');
      if (!key || seen.has(key)) throw new Error('BILLING_DATA_CHANGED');
      seen.add(key); records.push(row);
    }
    onProgress(`${records.length}${total === null ? '' : ' / ' + total} ${labels[resource]} lues`);
    if (data.has_more !== (data.next_page !== null) || (data.next_page !== null && data.next_page !== page + 1)) throw new Error('BILLING_PAGINATION_INVALID');
    page = data.next_page;
  }
  if (total !== null && records.length !== total) throw new Error('BILLING_PAGINATION_INCOMPLETE');
  return records;
}
function errorMessage(code) {
  if (code === 'BILLING_AUTH_REQUIRED') return 'Ta session Google doit être renouvelée. Recharge cette page puis utilise ton compte ACJ habituel.';
  if (code === 'BILLING_DATA_CHANGED') return 'Les données ont changé pendant leur lecture. Actualise pour refaire un rapprochement complet.';
  if (code === 'OGUST_NOT_CONFIGURED') return 'La connexion Ogust ACJ Services n’est pas disponible.';
  if (code === 'BILLING_PAGE_LIMIT') return 'Le volume dépasse la limite de lecture de cette première version. Le rapprochement reste incomplet.';
  if (/PAGINATION|RESPONSE|REFERENCE/.test(code)) return 'Ogust n’a pas renvoyé une lecture complète et vérifiable. Aucun dossier ne peut être classé prêt. Réessaie.';
  return 'La lecture d’Ogust n’a pas abouti. Les résultats restent indisponibles jusqu’à une lecture complète.';
}
async function load() {
  if (!authReady || !$('period-form').reportValidity()) return;
  controller?.abort(); const turn = ++serial; const abort = new AbortController(); controller = abort;
  const month = $('month').value; report = null; render(); $('error').hidden = true; $('loading').hidden = false; $('refresh').disabled = true;
  $('progress').value = 0; $('status').textContent = 'Rapprochement en cours…'; $('sources').textContent = 'Lecture des sources Ogust en cours.';
  progress('Lecture des prestations et des factures', 'Les dossiers apparaîtront à la fin du contrôle.', 3);
  try {
    const data = { month, lists: {}, contracts: [], contract_errors: [], complete: false }; let finished = 0;
    await tasks(Object.keys(labels), async resource => {
      data[resource] = await collection(resource, month, abort.signal, detail => progress('Lecture des données Ogust', detail, 5 + finished * 10));
      finished++; progress('Lecture des données Ogust', `${finished} sources sur 5 lues intégralement.`, 5 + finished * 10);
    });
    let listsRead = 0, missingLists = 0;
    await tasks(listKeys, async key => {
      try { const values = await request(month, { resource: 'list', key }, abort.signal); data.lists[key] = values.values; }
      catch (error) { if (abort.signal.aborted || error.message === 'BILLING_AUTH_REQUIRED') throw error; missingLists++; }
      listsRead++; progress('Lecture des règles de facturation', `${listsRead} règles sur ${listKeys.length} consultées.`, 55 + listsRead);
    });
    const contractIds = contractsToRead(data.services, data.invoices, data.lists); let read = 0;
    await tasks(contractIds, async key => {
      try { const result = await request(month, { resource: 'contract', id: key }, abort.signal); data.contracts.push(result.contract); }
      catch (error) { if (abort.signal.aborted || error.message === 'BILLING_AUTH_REQUIRED') throw error; data.contract_errors.push(key); }
      read++; progress('Vérification des contrats clients', `${read} contrats sur ${contractIds.length} consultés.`, 65 + Math.round(read / contractIds.length * 30));
    });
    abort.signal.throwIfAborted(); if (turn !== serial) return;
    data.complete = true; report = reconcile(data); render();
    const completedAt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date());
    $('status').textContent = `Lecture complète le ${completedAt} · ${report.counts.total} prestations · ${report.counts.clients} clients`;
    $('sources').textContent = `${data.services.length} prestations du mois, ${data.invoices.length} factures et avoirs parcourus, ${data.customers.length} clients, ${data.rates.length} tarifs, ${data.products.length} prestations du catalogue et ${read} contrats consultés.` + (missingLists || data.contract_errors.length ? ' Les règles ou contrats non disponibles sont signalés dans les dossiers concernés.' : '') + ' Les données sont gardées uniquement en mémoire dans cette page.';
    const url = new URL(location.href); url.searchParams.set('month', month); history.replaceState(null, '', url);
  } catch (error) {
    if (turn !== serial) return;
    const cancelled = abort.signal.aborted; abort.abort(); report = null; render();
    $('status').textContent = cancelled ? 'Lecture arrêtée. Les résultats restent incomplets.' : 'Rapprochement indisponible.';
    if (!cancelled) { $('error').hidden = false; $('error-message').textContent = errorMessage(error.message); }
  } finally {
    if (turn === serial) { $('loading').hidden = true; $('refresh').disabled = false; controller = null; }
  }
}
$('period-form').addEventListener('submit', event => { event.preventDefault(); load(); });
$('month').addEventListener('change', () => { controller?.abort(); serial++; controller = null; report = null; render(); $('loading').hidden = true; $('refresh').disabled = false; $('error').hidden = true; load(); });
$('cancel').addEventListener('click', () => controller?.abort());
$('retry').addEventListener('click', load);
$('search').addEventListener('input', render);
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => {
  filter = button.dataset.filter;
  for (const option of document.querySelectorAll('[data-filter]')) option.setAttribute('aria-pressed', String(option === button));
  render();
});
function authenticated() { if (authReady) return; authReady = true; load(); }
window.addEventListener('acj:auth-ready', authenticated);
if (window.acjAuthV292?.serverRequired && window.acjAuthV292.authenticated) authenticated();
navigator.serviceWorker?.getRegistration('../').then(registration => registration?.update()).catch(() => {});
