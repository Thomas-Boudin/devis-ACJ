// Devis ACJ v29 — historique local, statuts Ogust exacts et duplication rapide.
(function(){
  if(window.__acjHistoryV29)return;
  const SAVED_KEY='acj_devis_saved_v6';
  const META_KEY='acj_devis_history_meta_v29';
  const STATUS_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-quotation';
  const STATUS_LABELS={B:'Brouillon',C:'Accepté',E:'Envoyé',T:'Terminé',V:'Validé'};
  let displayed=[];
  let syncMessage='';

  function e(v){
    if(typeof window.esc==='function')return window.esc(v);
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function n(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0}
  function euro(v){return typeof window.money==='function'?window.money(v):new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n(v))}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function keyFor(company,ref){return `${String(company||'')}|${String(ref||'')}`}
  function quoteKey(p){return keyFor(p?.societe,p?.numero_devis)}
  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}}
  function readSaved(){const a=readJson(SAVED_KEY,[]);return Array.isArray(a)?a:[]}
  function readMeta(){const x=readJson(META_KEY,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}
  function writeMeta(meta){try{localStorage.setItem(META_KEY,JSON.stringify(meta))}catch{}}
  function patchMeta(company,ref,patch){
    if(!company||!ref)return;
    const meta=readMeta(),k=keyFor(company,ref);
    meta[k]={...(meta[k]||{}),...patch,updated_at:new Date().toISOString()};
    writeMeta(meta);
  }
  function currentPayload(){try{return typeof window.quotePayload==='function'?window.quotePayload():null}catch{return null}}
  function dedupeSaved(){
    const saved=readSaved(),seen=new Set(),out=[];
    for(const p of saved){const k=quoteKey(p);if(!k||seen.has(k))continue;seen.add(k);out.push(p);if(out.length>=50)break}
    try{localStorage.setItem(SAVED_KEY,JSON.stringify(out))}catch{}
    return out;
  }
  function ensureSnapshot(p){
    if(!p?.societe||!p?.numero_devis||!p?.client?.nom||!p?.lignes?.length)return;
    const saved=readSaved(),k=quoteKey(p);
    if(!saved.some(x=>quoteKey(x)===k))saved.unshift(p);
    const seen=new Set(),out=[];
    for(const item of saved){const ik=quoteKey(item);if(!ik||seen.has(ik))continue;seen.add(ik);out.push(item);if(out.length>=50)break}
    try{localStorage.setItem(SAVED_KEY,JSON.stringify(out))}catch{}
  }
  function dateMs(p){
    const raw=String(p?.date||'');
    const d=Date.parse(raw);if(Number.isFinite(d))return d;
    const m=raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);if(m)return Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1]));
    return 0;
  }
  function dateLabel(p){
    const ms=dateMs(p);if(ms)return new Date(ms).toLocaleDateString('fr-FR');
    return String(p?.date||'').slice(0,10)||'—';
  }
  function statusText(meta){
    if(meta?.ogust_status_label)return meta.ogust_status_label;
    if(meta?.ogust_status&&STATUS_LABELS[meta.ogust_status])return STATUS_LABELS[meta.ogust_status];
    if(meta?.ogust_id)return 'Créé dans Ogust';
    return 'Enregistré localement';
  }
  function statusClass(label){
    const x=norm(label);
    if(/accepte|valide|termine/.test(x))return 'good';
    if(/envoye|ogust/.test(x))return 'sent';
    return 'local';
  }
  function displayNumber(p,meta){return meta?.ogust_number?`N° ${meta.ogust_number}`:`Réf. ${p?.numero_devis||'—'}`}
  function lineSummary(p){
    const names=(p?.lignes||[]).map(l=>String(l?.designation||'').trim()).filter(Boolean);
    if(!names.length)return 'Aucune prestation';
    const shown=names.slice(0,2).join(' · ');
    return names.length>2?`${shown} · +${names.length-2}`:shown;
  }

  function addStyles(){
    if(document.getElementById('history-v29-style'))return;
    const s=document.createElement('style');s.id='history-v29-style';s.textContent=`
      .histLaunch{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #456784;background:#1a3349;border-radius:16px;padding:13px 14px;margin:0 0 14px;color:#f5f9fc}.histLaunchText strong{display:block;font-size:14px}.histLaunchText small{display:block;color:#b6c7d8;font-size:10px;line-height:1.4;margin-top:3px}.histLaunch .btn{min-width:112px}
      .histOverlay{position:fixed;inset:0;z-index:1600;background:rgba(3,10,18,.76);backdrop-filter:blur(7px);display:flex;align-items:flex-end;justify-content:center;padding:10px}.histModal{width:min(760px,100%);max-height:94vh;overflow:auto;background:#13283d;border:1px solid #456784;border-radius:22px 22px 15px 15px;color:#f5f9fc;padding:15px;box-shadow:0 28px 80px rgba(0,0,0,.5)}.histHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.histTitle{font-size:20px;font-weight:900}.histSub{font-size:10px;color:#b6c7d8;line-height:1.45;margin-top:3px}.histClose{width:42px;height:42px;border:1px solid #456784;border-radius:12px;background:#1a3349;color:#fff;font-size:21px}.histTools{display:grid;grid-template-columns:1.6fr 1fr;gap:8px;margin:13px 0}.histTools input,.histTools select{width:100%;min-height:46px;border:1px solid #456784;background:#1c344a;color:#f5f9fc;border-radius:12px;padding:10px 11px}.histSync{font-size:10px;color:#b6c7d8;line-height:1.4;margin:-3px 0 10px}.histList{display:grid;gap:9px}.histCard{border:1px solid #355675;background:#172b40;border-radius:15px;padding:12px}.histCardTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.histClient{font-size:14px;font-weight:900}.histAmount{font-size:15px;font-weight:900;white-space:nowrap}.histMeta{font-size:10px;color:#b6c7d8;line-height:1.45;margin-top:3px}.histLine{font-size:11px;color:#dce8f2;line-height:1.4;margin-top:8px}.histStatus{display:inline-flex;margin-top:8px;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;border:1px solid #4b647b}.histStatus.good{background:#113a27;border-color:#2e8b57;color:#bbf7d0}.histStatus.sent{background:#0f3450;border-color:#319fd9;color:#d8f3ff}.histStatus.local{background:#24384a;border-color:#526b82;color:#d6e1ea}.histDetails{margin-top:9px;border-top:1px solid #355675;padding-top:8px}.histDetails summary{font-size:10px;color:#bfe9fb;cursor:pointer}.histDetailLine{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:#c8d7e4;padding:6px 0;border-bottom:1px solid rgba(53,86,117,.45)}.histActions{display:flex;justify-content:flex-end;margin-top:10px}.histActions .btn{min-height:44px}.histEmpty{border:1px dashed #456784;border-radius:14px;padding:18px;text-align:center;color:#b6c7d8;font-size:11px;line-height:1.5}.histDuplicateNotice{margin:0 0 13px;padding:10px 11px;border:1px solid #2e8b57;background:#113a27;border-radius:12px;color:#d8ffe7;font-size:11px;line-height:1.45}
      @media(max-width:560px){.histTools{grid-template-columns:1fr}.histLaunch{align-items:stretch}.histLaunch .btn{min-width:104px}.histCardTop{gap:8px}.histModal{padding:13px}}
      @media(min-width:760px){.histOverlay{align-items:center}.histModal{border-radius:22px}}
    `;document.head.appendChild(s);
  }

  function injectLauncher(){
    if(document.getElementById('historyLaunchV29'))return;
    const step=document.querySelector('.step[data-step="1"]');if(!step)return;
    const lead=step.querySelector('.lead');
    const block=document.createElement('div');block.id='historyLaunchV29';block.className='histLaunch';
    block.innerHTML='<div class="histLaunchText"><strong>Mes devis</strong><small>Retrouver, rechercher et dupliquer un ancien devis.</small></div><button class="btn" type="button" id="historyOpenBtn">Ouvrir</button>';
    if(lead)lead.insertAdjacentElement('afterend',block);else step.prepend(block);
    document.getElementById('historyOpenBtn')?.addEventListener('click',openHistory);
  }

  function filterQuotes(){
    const q=norm(document.getElementById('historySearch')?.value||'');
    const company=String(document.getElementById('historyCompany')?.value||'');
    const meta=readMeta();
    return readSaved().sort((a,b)=>dateMs(b)-dateMs(a)).filter(p=>{
      if(company&&p?.societe!==company)return false;
      if(!q)return true;
      const m=meta[quoteKey(p)]||{};
      const hay=norm([p?.client?.nom,p?.numero_devis,m.ogust_number,p?.societe,...(p?.lignes||[]).map(l=>l?.designation)].filter(Boolean).join(' '));
      return hay.includes(q);
    });
  }

  function renderHistory(){
    const list=document.getElementById('historyList');if(!list)return;
    displayed=filterQuotes();const meta=readMeta();
    if(!displayed.length){list.innerHTML='<div class="histEmpty">Aucun devis enregistré ne correspond à cette recherche.<br>Les prochains devis enregistrés apparaîtront automatiquement ici.</div>';return}
    list.innerHTML=displayed.map((p,i)=>{
      const m=meta[quoteKey(p)]||{},status=statusText(m),lines=p?.lignes||[];
      const details=lines.map(l=>`<div class="histDetailLine"><span>${e(l?.designation||'Prestation')} · ${e(l?.quantite??'')} ${e(l?.unite||'')}</span><strong>${euro(l?.total_ttc??(n(l?.quantite)*n(l?.prix_unitaire_ttc)))}</strong></div>`).join('');
      return `<div class="histCard"><div class="histCardTop"><div><div class="histClient">${e(p?.client?.nom||'Client non renseigné')}</div><div class="histMeta">${e(p?.societe||'')} · ${e(dateLabel(p))} · ${e(displayNumber(p,m))}</div></div><div class="histAmount">${euro(p?.totaux?.ttc||0)}</div></div><div class="histLine">${e(lineSummary(p))}</div><span class="histStatus ${statusClass(status)}">${e(status)}</span>${details?`<details class="histDetails"><summary>Voir le détail</summary>${details}</details>`:''}<div class="histActions"><button class="btn primary" type="button" onclick="duplicateHistoryQuoteV29(${i})">Dupliquer</button></div></div>`;
    }).join('');
  }

  function openHistory(){
    document.getElementById('historyOverlayV29')?.remove();
    const overlay=document.createElement('div');overlay.id='historyOverlayV29';overlay.className='histOverlay';
    overlay.innerHTML=`<div class="histModal" role="dialog" aria-modal="true" aria-label="Mes devis"><div class="histHead"><div><div class="histTitle">Mes devis</div><div class="histSub">Historique enregistré sur cet appareil. Les statuts Ogust sont relus pour les devis connus par l’application.</div></div><button class="histClose" type="button" id="historyCloseBtn">×</button></div><div class="histTools"><input id="historySearch" autocomplete="off" placeholder="Client, n° ou prestation"><select id="historyCompany"><option value="">Toutes les sociétés</option><option>ACJ Services</option><option>ACJ Services Lens</option><option>Jet Services</option></select></div><div id="historySync" class="histSync">${e(syncMessage||'Synchronisation des statuts Ogust…')}</div><div id="historyList" class="histList"></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('historyCloseBtn')?.addEventListener('click',()=>overlay.remove());
    overlay.addEventListener('click',ev=>{if(ev.target===overlay)overlay.remove()});
    document.getElementById('historySearch')?.addEventListener('input',renderHistory);
    document.getElementById('historyCompany')?.addEventListener('change',renderHistory);
    renderHistory();syncStatuses();
  }
  window.openQuoteHistoryV29=openHistory;

  function duplicateNotice(sourceRef,newRef){
    const step=document.querySelector('.step[data-step="3"]');if(!step)return;
    step.querySelector('.histDuplicateNotice')?.remove();
    const n=document.createElement('div');n.className='histDuplicateNotice';n.innerHTML=`Copie de <strong>${e(sourceRef||'l’ancien devis')}</strong>. Nouveau devis : <strong>${e(newRef||'')}</strong>. Vérifie les quantités, heures et prix avant de continuer.`;
    const lead=step.querySelector('.lead');if(lead)lead.insertAdjacentElement('afterend',n);else step.prepend(n);
  }

  window.duplicateHistoryQuoteV29=function(index){
    const p=displayed[Number(index)];if(!p)return;
    const sourceRef=p.numero_devis||'';
    if(typeof window.newQuote==='function')window.newQuote();
    if(typeof window.setCompany==='function')window.setCompany(p.societe||'ACJ Services');else{state.company=p.societe||'ACJ Services';if(typeof window.renderCompanies==='function')window.renderCompanies()}
    state.client=String(p?.client?.nom||'');state.tel=String(p?.client?.telephone||'');state.address=String(p?.client?.adresse||'');
    state.mode=MODES?.[p?.mode]?p.mode:((p?.lignes||[]).find(l=>MODES?.[l?.activite])?.activite||'jardin');
    state.activePreset=null;state.builderMethod='hourly';state.notes=String(p?.notes||'');
    state.lines=(p?.lignes||[]).map(l=>{
      const line={
        id:typeof window.uid==='function'?window.uid():`l_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        type:l?.type||'service',designation:String(l?.designation||''),meta:String(l?.detail||''),
        pricingMethod:String(l?.methode_chiffrage||''),activity:String(l?.activite||p?.mode||state.mode),
        qty:n(l?.quantite),unit:String(l?.unite||''),unitPriceTTC:n(l?.prix_unitaire_ttc),vat:n(l?.tva_rate)
      };
      if(l?.ogust_product_level_id){line.ogustProductLevelId=String(l.ogust_product_level_id);line.ogustProductLevelTitle=String(l.ogust_product_level_title||'');line.ogustProductCompany=String(p?.societe||'')}
      return line;
    }).filter(l=>l.designation&&l.qty>0);
    const set=(id,value)=>{const x=document.getElementById(id);if(x)x.value=value||''};
    set('client',state.client);set('tel',state.tel);set('adresse',state.address);set('email',p?.client?.email||'');set('notes',state.notes);
    if(typeof window.renderCompanies==='function')window.renderCompanies();if(typeof window.renderModes==='function')window.renderModes();if(typeof window.renderQuoteLines==='function')window.renderQuoteLines();
    document.getElementById('historyOverlayV29')?.remove();
    if(typeof window.goStep==='function')window.goStep(3);
    duplicateNotice(sourceRef,state.number);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  async function syncCompany(company,items){
    const ids=items.map(x=>String(x.meta.ogust_id||'')).filter(Boolean).slice(0,12);if(!ids.length)return 0;
    const url=`${STATUS_ENDPOINT}?action=history&company=${encodeURIComponent(company)}&ids=${encodeURIComponent(ids.join(','))}`;
    const r=await fetch(url,{cache:'no-store'});const data=await r.json().catch(()=>null);if(!r.ok||!data?.ok||!Array.isArray(data.quotations))return 0;
    const byId=new Map(data.quotations.map(x=>[String(x.id_quotation||''),x]));let updated=0;
    for(const item of items){const id=String(item.meta.ogust_id||''),remote=byId.get(id);if(!remote)continue;patchMeta(item.p.societe,item.p.numero_devis,{ogust_id:id,ogust_number:remote.number||item.meta.ogust_number||'',ogust_status:remote.status||'',ogust_status_label:remote.status_label||STATUS_LABELS[remote.status]||''});updated++}
    return updated;
  }
  async function syncStatuses(){
    const saved=readSaved(),meta=readMeta();
    const groups={};
    for(const p of saved){if(!['ACJ Services','ACJ Services Lens'].includes(p?.societe))continue;const m=meta[quoteKey(p)]||{};if(!m.ogust_id)continue;(groups[p.societe]||(groups[p.societe]=[])).push({p,meta:m})}
    let total=0,attempted=0;
    try{
      for(const [company,items] of Object.entries(groups)){attempted+=Math.min(items.length,12);total+=await syncCompany(company,items)}
      syncMessage=attempted?`${total} statut${total>1?'s':''} Ogust actualisé${total>1?'s':''}. Les devis sans identifiant Ogust restent indiqués comme locaux.`:'Aucun devis avec identifiant Ogust à actualiser pour le moment.';
    }catch{syncMessage='Historique local disponible. La mise à jour des statuts Ogust n’a pas abouti.'}
    const box=document.getElementById('historySync');if(box)box.textContent=syncMessage;renderHistory();
  }

  function wrapSave(){
    if(window.__acjHistorySaveV29||typeof window.saveQuote!=='function')return;
    const original=window.saveQuote;
    window.saveQuote=function(){const p=currentPayload();const out=original.apply(this,arguments);dedupeSaved();if(p?.societe&&p?.numero_devis)patchMeta(p.societe,p.numero_devis,{saved_at:new Date().toISOString()});return out};
    window.__acjHistorySaveV29=true;
  }
  function wrapOfficialNumber(){
    if(window.__acjHistoryNumberV29||typeof window.applyOgustQuotationNumber!=='function')return;
    const original=window.applyOgustQuotationNumber;
    window.applyOgustQuotationNumber=function(number,id){const p=currentPayload();const out=original.apply(this,arguments);if(p?.societe&&p?.numero_devis)patchMeta(p.societe,p.numero_devis,{ogust_id:String(id||''),ogust_number:String(number||'')});return out};
    window.__acjHistoryNumberV29=true;
  }
  function wrapFetch(){
    if(window.__acjHistoryFetchV29||typeof window.fetch!=='function')return;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      let requestQuote=null,target=false;
      try{
        const url=typeof input==='string'||input instanceof URL?String(input):String(input?.url||'');
        const method=String(init?.method||input?.method||'GET').toUpperCase();target=method==='POST'&&new URL(url,location.href).pathname==='/api/ogust-quotation';
        if(target&&typeof init?.body==='string'){const body=JSON.parse(init.body);requestQuote=body?.quote||null}
      }catch{}
      const response=await nativeFetch(input,init);
      if(target&&requestQuote?.societe&&requestQuote?.numero_devis){
        try{
          const data=await response.clone().json();
          if(data?.ok&&data?.id_quotation){
            patchMeta(requestQuote.societe,requestQuote.numero_devis,{ogust_id:String(data.id_quotation),ogust_number:String(data.ogust_number||''),ogust_status:String(data.ogust_status||''),ogust_status_label:STATUS_LABELS[data.ogust_status]||''});
            ensureSnapshot(requestQuote);
          }
        }catch{}
      }
      return response;
    };
    window.__acjHistoryFetchV29=true;
  }

  function init(){addStyles();dedupeSaved();wrapSave();wrapOfficialNumber();wrapFetch();injectLauncher()}
  window.__acjHistoryV29=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
