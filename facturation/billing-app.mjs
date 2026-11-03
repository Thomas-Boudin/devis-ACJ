import { contractsToRead, normalize, reconcile, visibleReviewReasons } from './billing-core.mjs?v=5';
import { contractView, invoiceEvidence, ruleLabel, frenchDay, displayUnit, moneyValue } from './billing-details.mjs?v=2';

const API = 'https://acj-ogust-proxy.vercel.app/api/ogust-history';
const COMPANY = 'ACJ Services';
const $ = key => document.getElementById(key);
const money = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const labels = { services: 'prestations du mois', invoices: 'factures et avoirs', customers: 'clients', rates: 'tarifs', products: 'prestations du catalogue' };
const ids = { services: 'id_service', invoices: 'id_invoice', customers: 'id_customer', rates: 'id_rate', products: 'id_productlevel' };
const stateLabels = { review: 'À vérifier', ready: 'Prêt à facturer', billed: 'Déjà facturé', ignored: 'Hors facturation' };
const listKeys = ['service.status', 'service.billing_amount_unit', 'invoice.status', 'contract.status', 'contract.generation', 'contract.pricing', 'contract.to_invoice', 'contract.services_to_consider', 'linecontract.unit', 'rates.unit', 'contract.calculation_method', 'contract.type_hours', 'invoice.invoice_month'];
let report = null, filter = 'review', controller = null, serial = 0, authReady = false, evidence = null;
let pdfController = null, pdfVersion = 0, pdfUrl = '', pdfTrigger = null;

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
function button(label, action) { const node = element('button', 'quiet source-action', label); node.type = 'button'; node.addEventListener('click', action); return node; }
function sourceAmount(cents, base = 'TTC') { return cents === null ? 'Montant non communiqué' : money(cents) + ' ' + base; }
const quantityText = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value);
function closeDocument() {
  pdfController?.abort(); pdfController = null; pdfVersion++;
  const object = $('pdf-object'); if (object) object.removeAttribute('data');
  if (pdfUrl) { URL.revokeObjectURL(pdfUrl); pdfUrl = ''; }
  const dialog = $('document-dialog'); if (dialog?.open) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  if (pdfTrigger?.isConnected) pdfTrigger.focus(); pdfTrigger = null;
}
async function openDocument(kind, id, customer, title, trigger) {
  closeDocument(); pdfTrigger = trigger; const scope = evidence, turn = ++pdfVersion, abort = new AbortController(); pdfController = abort;
  const dialog = $('document-dialog'); $('document-title').textContent = title; $('document-status').textContent = 'Chargement du document Ogust…';
  $('document-status').hidden = false; $('document-view').hidden = true;
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  try {
    const url = new URL(API); url.search = new URLSearchParams({ action: 'billing', company: COMPANY, month: scope.data.month, resource: 'document', document_type: kind, id, customer_id: customer });
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal: abort.signal });
    if (!response.ok || !(response.headers.get('content-type') || '').includes('application/pdf')) {
      const result = await response.json().catch(() => ({}));
      throw new Error(response.status === 401 || response.status === 403 ? 'BILLING_AUTH_REQUIRED' : result.error || 'BILLING_DOCUMENT_READ_FAILED');
    }
    const blob = await response.blob(); abort.signal.throwIfAborted();
    if (turn !== pdfVersion || scope !== evidence) return;
    pdfUrl = URL.createObjectURL(blob); $('pdf-object').data = pdfUrl;
    $('document-download').href = pdfUrl; $('document-download').download = `${kind}-${id}.pdf`;
    $('document-fullscreen').href = pdfUrl;
    $('document-status').hidden = true; $('document-view').hidden = false;
  } catch (error) {
    if (turn !== pdfVersion || abort.signal.aborted) return;
    $('document-status').textContent = error.message === 'BILLING_AUTH_REQUIRED' ? errorMessage(error.message) : error.message === 'BILLING_DOCUMENT_UNAVAILABLE' ? 'Ogust ne fournit pas de PDF pour ce document, notamment s’il est encore en brouillon. Les informations lues restent dans la fiche.' : 'Le PDF n’a pas pu être chargé. Ferme cette fenêtre puis réessaie.';
  }
}
function renderContractCard(parent, source, client, scope) {
  const view = contractView(source, scope.data.lists), card = element('article', 'contract-card');
  const head = element('div', 'source-head'); head.append(element('h4', '', view.title), element('span', 'badge', view.status)); card.append(head);
  const facts = element('dl', 'contract-facts');
  for (const [name, value] of view.facts) { const fact = element('div'); fact.append(element('dt', '', name), element('dd', '', value)); facts.append(fact); }
  card.append(facts);
  for (const line of view.lines) {
    const row = element('div', 'source-price-line'), top = element('div', 'source-head'); top.append(element('strong', '', line.title));
    if (!line.text_only) {
      const price = line.unit_ttc_cents !== null ? sourceAmount(line.unit_ttc_cents) : sourceAmount(line.unit_ht_cents, 'HT');
      top.append(element('strong', 'source-price', price + ' / ' + line.unit));
    }
    row.append(top);
    if (!line.text_only) {
      const parts = [];
      if (line.quantity !== null) parts.push('Quantité au contrat : ' + quantityText(line.quantity) + ' ' + line.unit);
      if (line.total_ttc_cents !== null) parts.push('Total de la ligne : ' + sourceAmount(line.total_ttc_cents));
      if (line.vat !== null) parts.push('TVA : ' + quantityText(line.vat) + ' %');
      row.append(element('p', 'source-muted', parts.join(' · ')));
      if (line.discount) row.append(element('p', 'source-muted', 'Une remise est renseignée sur cette ligne ; consulter le document pour son application.'));
    }
    card.append(row);
  }
  const totals = element('div', 'contract-totals');
  if (view.fixed_amount_cents !== null) totals.append(element('p', '', 'Montant forfaitaire paramétré : ' + sourceAmount(view.fixed_amount_cents, view.base || 'base à confirmer')));
  totals.append(element('p', '', 'Total indiqué au contrat : ' + sourceAmount(view.total_ttc_cents)));
  totals.append(element('p', 'source-muted', 'Ce total reprend le contrat. Le montant du mois dépend du mode de calcul et des passages retenus.')); card.append(totals);
  const actions = element('div', 'source-actions');
  const pdf = button('Voir le contrat PDF', () => openDocument('contract', view.id, client.id, view.title, pdf)); pdf.disabled = !view.document_available;
  if (!view.document_available) pdf.title = 'Ogust ne fournit pas de PDF pour ce contrat dans son état actuel';
  actions.append(pdf);
  if (view.quotation_id) { const quote = button('Voir le devis d’origine', () => openDocument('quotation', view.quotation_id, client.id, 'Devis d’origine du ' + view.title, quote)); actions.append(quote); }
  card.append(actions); parent.append(card);
}
function renderInvoiceCard(parent, invoice, client, scope) {
  const card = element('article', 'invoice-card'), head = element('div', 'source-head');
  head.append(element('strong', '', invoice.title), element('strong', '', sourceAmount(invoice.amount_cents))); card.append(head);
  const type = invoice.state === 'draft' ? 'review' : invoice.state === 'final' ? 'billed' : '';
  card.append(element('span', 'badge ' + type, invoice.label));
  card.append(element('p', 'source-muted', 'Date : ' + frenchDay(invoice.invoice_date) + ' · Période : ' + frenchDay(invoice.start_of_period) + ' au ' + frenchDay(invoice.end_of_period)));
  card.append(element('p', 'invoice-relation', invoice.relation));
  const actions = element('div', 'source-actions'), lines = element('div'); let shown = false;
  const detail = button('Voir les lignes', async () => {
    if (shown) { lines.hidden = !lines.hidden; detail.textContent = lines.hidden ? 'Voir les lignes' : 'Masquer les lignes'; return; }
    detail.disabled = true; lines.replaceChildren(element('p', 'source-muted', 'Lecture des lignes de facture…'));
    try {
      const cacheKey = client.id + ':' + invoice.id_invoice;
      let source = scope.invoices.get(cacheKey);
      if (!source) { source = (await request(scope.data.month, { resource: 'invoice', id: invoice.id_invoice, customer_id: client.id })).invoice; scope.invoices.set(cacheKey, source); }
      if (scope !== evidence || !card.isConnected) return;
      lines.replaceChildren();
      for (const line of source.lines || []) {
        const row = element('div', 'source-price-line'); row.append(element('strong', '', line.title || 'Ligne de facture'));
        if (line.line_type !== 'T') {
          const total = moneyValue(line.amount_incl_taxe);
          row.append(element('p', 'source-muted', `${line.quantity || '—'} ${displayUnit(line.unit_type)} · ${sourceAmount(total)}`));
        }
        lines.append(row);
      }
      if (!source.lines?.length) lines.append(element('p', 'source-muted', 'Aucune ligne renvoyée par Ogust.'));
      shown = true; detail.textContent = 'Masquer les lignes';
    } catch { if (scope === evidence && card.isConnected) lines.replaceChildren(element('p', 'source-muted', 'Les lignes n’ont pas pu être chargées. Réessaie.')); }
    finally { detail.disabled = false; }
  });
  actions.append(detail);
  const pdf = button(invoice.type === 'A' ? 'Voir l’avoir PDF' : 'Voir la facture PDF', () => openDocument('invoice', invoice.id_invoice, client.id, invoice.title, pdf));
  pdf.disabled = !invoice.document_available; actions.append(pdf); card.append(actions, lines); parent.append(card);
}
async function mountEvidence(parent, client, scope) {
  if (!scope || scope !== evidence || !parent.isConnected) return;
  parent.replaceChildren(); parent.append(element('h3', '', 'Contrats et montants prévus'));
  const ids = [...new Set(client.rows.map(row => row.contract_id).filter(Boolean))];
  if (!ids.length) parent.append(element('p', 'source-muted', 'Aucun contrat n’est associé aux prestations lues.'));
  for (const id of ids) {
    const holder = element('div'); parent.append(holder);
    try {
      let contract = scope.contracts.get(id);
      if (!contract) {
        holder.append(element('p', 'source-muted', 'Lecture du contrat…'));
        contract = (await request(scope.data.month, { resource: 'contract', id, customer_id: client.id })).contract;
        scope.contracts.set(id, contract);
      }
      if (scope !== evidence || !parent.isConnected) return;
      holder.replaceChildren(); renderContractCard(holder, contract, client, scope);
    } catch {
      if (scope !== evidence || !parent.isConnected) return;
      holder.replaceChildren(element('p', 'source-muted', 'Le contrat n’a pas pu être lu.'));
      holder.append(button('Réessayer la lecture', () => mountEvidence(parent, client, scope)));
      const pdf = button('Consulter le contrat PDF', () => openDocument('contract', id, client.id, 'Contrat ' + id, pdf)); holder.append(pdf);
    }
  }
  if (scope !== evidence || !parent.isConnected) return;
  const matches = invoiceEvidence(client, scope.data.invoices, scope.data.month, scope.data.lists);
  parent.append(element('h3', '', 'Factures et avoirs associés'));
  if (!matches.relevant.length) parent.append(element('p', 'source-muted', 'Aucune facture liée aux passages ou correspondant à cette période n’a été retrouvée dans la lecture. L’historique du client reste consultable ci-dessous.'));
  for (const invoice of matches.relevant) renderInvoiceCard(parent, invoice, client, scope);
  if (matches.history.length) {
    const history = element('details', 'invoice-history'), summary = element('summary', '', `Autres factures et avoirs du client (${matches.history.length})`), list = element('div'); let loaded = 0;
    const more = button('Afficher la suite', () => appendMore());
    function appendMore() {
      for (const invoice of matches.history.slice(loaded, loaded + 10)) renderInvoiceCard(list, invoice, client, scope);
      loaded += 10; more.hidden = loaded >= matches.history.length;
    }
    history.append(summary, list, more); history.addEventListener('toggle', () => { if (history.open && !loaded) appendMore(); }); parent.append(history);
  }
}
const passageClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
let passage = null, savingPassage = false;

function closePassage() {
  if (savingPassage) return;
  const dialog = $('passage-dialog');
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  passage?.trigger.focus();
  passage = null;
}
async function openPassage(row, trigger) {
  if (!evidence || savingPassage) return;
  const selected = { row, scope: evidence, trigger, canEdit: false };
  passage = selected;
  const summary = [row.client, row.product, serviceDate(row)];
  if (row.quantity != null) summary.push(quantityText(row.quantity) + ' ' + displayUnit(row.quantity_unit));
  if (row.unit_price_ttc != null) summary.push(sourceAmount(Math.round(row.unit_price_ttc * 100)) + ' / ' + displayUnit(row.quantity_unit));
  summary.push(row.amount_cents === null ? 'Montant à vérifier' : money(row.amount_cents) + ' TTC estimés');
  $('passage-summary').textContent = summary.join(' · ');
  $('passage-note').value = '';
  $('passage-confirm').hidden = true;
  $('passage-report').hidden = true;
  $('passage-status').textContent = 'Vérification du passage dans Ogust…';
  const dialog = $('passage-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  try {
    const url = passageUrl();
    url.searchParams.set('company', COMPANY);
    url.searchParams.set('month', selected.scope.data.month);
    url.searchParams.set('service_id', row.id);
    url.searchParams.set('customer_id', row.customer_id);
    url.searchParams.set('version', row.version);
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (selected !== passage) return;
    selected.canEdit = response.ok && data.ok && data.can_edit === true;
    $('passage-confirm').hidden = !selected.canEdit;
    $('passage-report').hidden = !selected.canEdit;
    $('passage-status').textContent = selected.canEdit ? '' : passageError(
      response.status === 401 || response.status === 403 ? 'BILLING_AUTH_REQUIRED' : data.reason || data.error
    );
  } catch {
    if (selected === passage) $('passage-status').textContent = passageError();
  }
}
function passageUrl() {
  const url = new URL(API);
  url.searchParams.set('action', 'billing-confirm');
  return url;
}
function passageError(code) {
  const messages = {
    BILLING_CONFIRM_CHANGED: 'Le passage a changé dans Ogust. Ferme cette fenêtre et actualise la fiche.',
    BILLING_CONFIRM_INVOICE: 'Ogust indique une facture liée à ce passage. Son statut est protégé.',
    BILLING_CONFIRM_PAYROLL: 'Ce passage est rattaché à un bulletin de paie. Son statut est protégé.',
    BILLING_CONFIRM_LOCKED: 'Ce passage est déjà traité ou annulé dans Ogust. Actualise la fiche.',
    BILLING_CONFIRM_DATE: 'Le passage ne peut être traité qu’après sa fin, pour le mois affiché.',
    BILLING_CONFIRM_BUSY: 'Ce passage est déjà en cours de traitement. Actualise la fiche.',
    BILLING_CONFIRM_NOTE: 'Indique un motif de 300 caractères maximum.',
    BILLING_CONFIRM_COMMENT_FULL: 'La note Ogust est déjà trop longue pour y ajouter ce signalement.'
  };
  if (code === 'BILLING_AUTH_REQUIRED') return errorMessage(code);
  return messages[code] || 'Le résultat n’a pas pu être vérifié. Ferme cette fenêtre et actualise avant de réessayer.';
}
async function savePassage(operation) {
  if (!passage?.canEdit || passage.scope !== evidence || savingPassage) return;
  const { row, scope } = passage;
  const note = $('passage-note').value.trim();
  if (operation === 'report' && !note) {
    $('passage-status').textContent = 'Indique le motif de l’anomalie.';
    $('passage-note').focus();
    return;
  }
  const controls = ['passage-confirm', 'passage-send-report', 'passage-note', 'passage-close'];
  savingPassage = true;
  for (const id of controls) $(id).disabled = true;
  $('passage-status').textContent = 'Enregistrement et vérification dans Ogust…';
  let success;
  try {
    const response = await fetch(passageUrl(), {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: COMPANY, month: scope.data.month, service_id: row.id,
        customer_id: row.customer_id, version: row.version, operation, note: operation === 'report' ? note : undefined })
    });
    const data = await response.json().catch(() => ({}));
    const verified = operation === 'confirm' ? data.status === 'R' : data.anomaly_reported === true;
    if (!response.ok || !data.ok || !verified) {
      if (response.status === 401 || response.status === 403) throw new Error('BILLING_AUTH_REQUIRED');
      throw new Error(data.error || 'BILLING_CONFIRM_UNVERIFIED');
    }
    success = operation === 'confirm' ? 'Passage confirmé dans Ogust.' : 'Anomalie enregistrée dans Ogust.';
  } catch (error) {
    $('passage-status').textContent = passageError(error.message);
  } finally {
    savingPassage = false;
    for (const id of controls) $(id).disabled = false;
  }
  if (success && scope === evidence) {
    closePassage();
    load({ reopenClient: row.customer_id, success });
  }
}

function serviceDate(row) {
  const raw = String(row.start || '').replace(/\D/g, ''), end = String(row.end || '').replace(/\D/g, '');
  if (raw.length < 12) return 'Date à vérifier';
  const first = `${raw.slice(6, 8)}/${raw.slice(4, 6)} · ${raw.slice(8, 10)} h ${raw.slice(10, 12)}`;
  return first + (end.length >= 12 ? ` – ${end.slice(8, 10)} h ${end.slice(10, 12)}` : '');
}
function render(reopenClient) {
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
    const meta = onlyForfaits ? (reasonCount ? ` · ${reasonCount} point${reasonCount > 1 ? 's' : ''} et montant à contrôler` : ' · montant à contrôler dans la fiche') : client.state === 'review' ? ` · ${reasonCount + (hasForfait ? 1 : 0)} point${reasonCount + (hasForfait ? 1 : 0) > 1 ? 's' : ''} à contrôler` : '';
    left.append(element('span', 'client-meta', `${n} prestation${n > 1 ? 's' : ''}` + meta));
    const right = element('span', 'client-right');
    if (client.state === 'ready') right.append(element('span', 'client-amount', money(client.amount_cents)));
    right.append(badge(client.state, onlyForfaits && !reasonCount ? 'Forfait à contrôler' : stateLabels[client.state]), element('span', 'chevron', '›')); summary.append(left, right); details.append(summary);
    const content = element('div', 'client-content');
    const workspace = element('section', 'client-evidence'); let mounted = false;
    content.append(workspace);
    details.addEventListener('toggle', () => { if (details.open && !mounted && evidence) { mounted = true; mountEvidence(workspace, client, evidence); } });
    if (hasForfait) {
      const guide = element('section', 'forfait-guide');
      guide.append(element('strong', '', 'Montant défini par le contrat'), element('p', '', 'Consulte le calcul, les montants du contrat et les factures dans cette fiche. Un montant par facture ne se déduit pas de la somme des heures affichées.')); content.append(guide);
    }
    for (const row of client.rows) {
      const service = element('article', 'service'), top = element('div', 'service-top'), info = element('div');
      info.append(element('div', 'service-title', row.product), element('p', 'service-date', serviceDate(row)));
      if (row.status_label) info.append(element('p', 'service-date', 'Statut Ogust : ' + row.status_label));
      top.append(info, badge(row.state, forfaitToReview(row) ? 'Montant à contrôler' : stateLabels[row.state])); service.append(top);
      const visibleReasons = visibleReviewReasons(row);
      if (visibleReasons.length) {
        const reasons = element('ul', 'service-reasons');
        for (const reason of visibleReasons) reasons.append(element('li', '', reason));
        service.append(reasons);
      }
      if (row.realization === 'realized' && row.amount_cents !== null && !row.invoices.length) service.append(element('p', 'service-source', `${money(row.amount_cents)} TTC estimés · ${quantityText(row.quantity)} ${displayUnit(row.quantity_unit)} · ${row.price_source}`));
      if (row.invoices.length) service.append(element('p', 'invoice-ref', 'Facture' + (row.invoices.length > 1 ? 's' : '') + ' : ' + row.invoices.map(invoice => invoice.number || 'brouillon ' + invoice.id).join(', ')));
      if (row.anomaly_reported) service.append(element('p', 'service-source', 'Anomalie signalée dans Ogust'));
      const end = String(row.end || '').slice(0, 12);
      if (row.status === 'A' && row.version && !row.invoices.length && /^\d{12}$/.test(end)
          && end < passageClock.format(new Date()).replace(/\D/g, '')) {
        const reviewPassage = button('Traiter le passage', () => openPassage(row, reviewPassage));
        service.append(reviewPassage);
      }
      content.append(service);
    }
    details.append(content); fragment.append(details);
    if (client.id === reopenClient) details.open = true;
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
async function load({ reopenClient, success } = {}) {
  if (!authReady || !$('period-form').reportValidity()) return;
  controller?.abort(); const turn = ++serial; const abort = new AbortController(); controller = abort;
  const month = $('month').value; closeDocument(); evidence = null; report = null; render(); $('error').hidden = true; $('loading').hidden = false; $('refresh').disabled = true;
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
    data.complete = true; evidence = { data, contracts: new Map(data.contracts.map(contract => [String(contract.id_contract), contract])), invoices: new Map() }; report = reconcile(data);
    if (reopenClient && !report.clients.some(client => client.id === reopenClient && (filter === 'all' || client.state === filter))) {
      filter = 'all';
      for (const option of document.querySelectorAll('[data-filter]')) option.setAttribute('aria-pressed', String(option.dataset.filter === filter));
    }
    render(reopenClient);
    const completedAt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date());
    $('status').textContent = (success ? success + ' ' : '') + `Lecture complète le ${completedAt} · ${report.counts.total} prestations · ${report.counts.clients} clients`;
    $('sources').textContent = `${data.services.length} prestations du mois, ${data.invoices.length} factures et avoirs parcourus, ${data.customers.length} clients, ${data.rates.length} tarifs, ${data.products.length} prestations du catalogue et ${read} contrats consultés.` + (missingLists || data.contract_errors.length ? ' Les règles ou contrats non disponibles sont signalés dans les dossiers concernés.' : '') + ' Les données sont gardées uniquement en mémoire dans cette page.';
    const url = new URL(location.href); url.searchParams.set('month', month); history.replaceState(null, '', url);
  } catch (error) {
    if (turn !== serial) return;
    const cancelled = abort.signal.aborted; abort.abort(); evidence = null; report = null; render();
    $('status').textContent = cancelled ? 'Lecture arrêtée. Les résultats restent incomplets.' : 'Rapprochement indisponible.';
    if (!cancelled) { $('error').hidden = false; $('error-message').textContent = errorMessage(error.message); }
  } finally {
    if (turn === serial) { $('loading').hidden = true; $('refresh').disabled = false; controller = null; }
  }
}
$('period-form').addEventListener('submit', event => { event.preventDefault(); load(); });
$('month').addEventListener('change', () => { controller?.abort(); closeDocument(); serial++; controller = null; evidence = null; report = null; render(); $('loading').hidden = true; $('refresh').disabled = false; $('error').hidden = true; load(); });
$('cancel').addEventListener('click', () => controller?.abort());
$('retry').addEventListener('click', load);
$('search').addEventListener('input', render);
$('passage-close').addEventListener('click', closePassage);
$('passage-dialog').addEventListener('cancel', event => { event.preventDefault(); closePassage(); });
$('passage-confirm').addEventListener('click', () => savePassage('confirm'));
$('passage-report').addEventListener('submit', event => { event.preventDefault(); savePassage('report'); });
$('document-close').addEventListener('click', closeDocument);
$('document-dialog').addEventListener('cancel', event => { event.preventDefault(); closeDocument(); });
window.addEventListener('pagehide', () => { closeDocument(); evidence = null; });
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => {
  filter = button.dataset.filter;
  for (const option of document.querySelectorAll('[data-filter]')) option.setAttribute('aria-pressed', String(option === button));
  render();
});
function authenticated() { if (authReady) return; authReady = true; load(); }
window.addEventListener('acj:auth-ready', authenticated);
if (window.acjAuthV292?.serverRequired && window.acjAuthV292.authenticated) authenticated();
navigator.serviceWorker?.getRegistration('../').then(registration => registration?.update()).catch(() => {});
