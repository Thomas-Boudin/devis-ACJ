// Devis ACJ v33 — rouvrir un devis existant pour le consulter/modifier et retrouver ses disponibilités.
(function(){
  if(window.__acjHistoryReopenV33)return;
  const SAVED_KEY='acj_devis_saved_v6';
  const META_KEY='acj_devis_history_meta_v29';
  const CUSTOMER_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';

  function n(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}}
  function readSaved(){const x=readJson(SAVED_KEY,[]);return Array.isArray(x)?x:[]}
  function readMeta(){const x=readJson(META_KEY,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}
  function keyFor(p){return `${String(p?.societe||'')}|${String(p?.numero_devis||'')}`}
  function dateMs(p){const raw=String(p?.date||'');const d=Date.parse(raw);if(Number.isFinite(d))return d;const m=raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])):0}
  function filtered(){
    const q=norm(document.getElementById('historySearch')?.value||'');
    const company=String(document.getElementById('historyCompany')?.value||'');
    const meta=readMeta();
    return readSaved().sort((a,b)=>dateMs(b)-dateMs(a)).filter(p=>{
      if(company&&p?.societe!==company)return false;
      if(!q)return true;
      const m=meta[keyFor(p)]||{};
      const hay=norm([p?.client?.nom,p?.numero_devis,m.ogust_number,p?.societe,...(p?.lignes||[]).map(l=>l?.designation)].filter(Boolean).join(' '));
      return hay.includes(q);
    });
  }
  function setInput(id,value){const x=document.getElementById(id);if(x)x.value=value||''}
  function exposeOgustClient(p,id){
    const customerId=String(id||'').trim();if(!customerId)return;
    const previous=window.ogustClientChoiceV21||{};
    window.ogustClientChoiceV21={mode:previous.mode||'existing',selected:{id_customer:customerId,label:String(p?.client?.nom||''),phone:String(p?.client?.telephone||''),address:String(p?.client?.adresse||'')},company:String(p?.societe||'ACJ Services')};
    window.acjReopenedClientIdV33=customerId;
  }
  function persistClientId(p,id){
    const list=readSaved(),key=keyFor(p),customerId=String(id||'').trim();if(!customerId)return;
    let changed=false;
    for(const item of list){if(keyFor(item)!==key)continue;item.client=item.client||{};if(String(item.client.id_customer||'')!==customerId){item.client.id_customer=customerId;changed=true}}
    if(changed)try{localStorage.setItem(SAVED_KEY,JSON.stringify(list))}catch{}
    if(p?.client)p.client.id_customer=customerId;
  }
  async function resolveCustomerId(p){
    const known=String(p?.client?.id_customer||'').trim();if(known){exposeOgustClient(p,known);return known}
    const query=String(p?.client?.nom||'').trim();if(query.length<2||!['ACJ Services','ACJ Services Lens'].includes(String(p?.societe||'')))return '';
    try{
      const r=await fetch(CUSTOMER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',query,company:p.societe})});
      const data=await r.json().catch(()=>null);if(!r.ok||!data?.ok)return '';
      const candidates=Array.isArray(data.customer_candidates)?data.customer_candidates:[];
      const exact=candidates.find(c=>norm(c?.label)===norm(query));
      const chosen=exact||(candidates.length===1?candidates[0]:null);
      const id=String(chosen?.id_customer||'').trim();if(!id)return '';
      persistClientId(p,id);exposeOgustClient(p,id);window.dispatchEvent(new CustomEvent('acj:quote-reopened-client',{detail:{id_customer:id,quote:p}}));return id;
    }catch{return ''}
  }
  function reopenNotice(p){
    const step=document.querySelector('.step[data-step="4"]');if(!step)return;
    step.querySelector('.histReopenNoticeV33')?.remove();
    const meta=readMeta()[keyFor(p)]||{};
    const box=document.createElement('div');box.className='histReopenNoticeV33';
    box.style.cssText='margin:0 0 13px;padding:10px 11px;border:1px solid #b9d9ec;background:#eef8fd;border-radius:12px;color:#29516b;font-size:11px;line-height:1.45';
    box.innerHTML=`<strong>Devis rouvert.</strong> Tu peux revenir au chiffrage pour le modifier puis l’enregistrer.${meta.ogust_id?' Ce devis existe déjà dans Ogust : « Créer dans Ogust » ne modifiera pas encore l’original.':''}`;
    const lead=step.querySelector('.lead');if(lead)lead.insertAdjacentElement('afterend',box);else step.prepend(box);
  }
  async function restoreQuote(p){
    if(!p||typeof state==='undefined')return;
    state.step=1;state.number=String(p?.numero_devis||state.number||'');state.company=String(p?.societe||'ACJ Services');state.client=String(p?.client?.nom||'');state.tel=String(p?.client?.telephone||'');state.address=String(p?.client?.adresse||'');
    state.mode=(typeof MODES!=='undefined'&&MODES?.[p?.mode])?p.mode:((p?.lignes||[]).find(l=>typeof MODES!=='undefined'&&MODES?.[l?.activite])?.activite||'jardin');
    state.activePreset=null;state.builderMethod='hourly';state.notes=String(p?.notes||'');
    state.lines=(p?.lignes||[]).map(l=>({
      id:typeof window.uid==='function'?window.uid():`l_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      type:l?.type||'service',designation:String(l?.designation||''),meta:String(l?.detail||''),pricingMethod:String(l?.methode_chiffrage||''),activity:String(l?.activite||p?.mode||state.mode),qty:n(l?.quantite),unit:String(l?.unite||''),unitPriceTTC:n(l?.prix_unitaire_ttc),vat:n(l?.tva_rate),
      ...(l?.ogust_product_level_id?{ogustProductLevelId:String(l.ogust_product_level_id),ogustProductLevelTitle:String(l.ogust_product_level_title||''),ogustProductCompany:String(p?.societe||'')}:{})
    })).filter(l=>l.designation&&l.qty>0);
    window.acjReopenedQuoteV33={societe:state.company,numero_devis:state.number,id_customer:String(p?.client?.id_customer||''),snapshot:p};
    window.acjReopenedClientIdV33=String(p?.client?.id_customer||'');
    if(window.acjReopenedClientIdV33)exposeOgustClient(p,window.acjReopenedClientIdV33);
    setInput('client',state.client);setInput('tel',state.tel);setInput('adresse',state.address);setInput('email',p?.client?.email||'');setInput('notes',state.notes);
    const top=document.getElementById('quoteNumberTop');if(top)top.textContent=state.number;
    if(typeof window.renderCompanies==='function')window.renderCompanies();if(typeof window.renderModes==='function')window.renderModes();if(typeof window.renderQuoteLines==='function')window.renderQuoteLines();
    document.getElementById('historyOverlayV29')?.remove();if(typeof window.goStep==='function')window.goStep(4);reopenNotice(p);
    window.dispatchEvent(new CustomEvent('acj:quote-reopened',{detail:{quote:p}}));window.scrollTo({top:0,behavior:'smooth'});
    await resolveCustomerId(p);
  }
  window.reopenHistoryQuoteV33=function(index){const p=filtered()[Number(index)];if(p)restoreQuote(p)};

  function enhanceHistory(){
    const list=document.getElementById('historyList');if(!list)return;
    [...list.querySelectorAll('.histCard')].forEach((card,i)=>{
      card.dataset.historyIndex=String(i);card.style.cursor='pointer';
      const actions=card.querySelector('.histActions');
      if(actions&&!actions.querySelector('.histReopenBtn')){const btn=document.createElement('button');btn.type='button';btn.className='btn histReopenBtn';btn.textContent='Rouvrir';btn.addEventListener('click',ev=>{ev.stopPropagation();window.reopenHistoryQuoteV33(i)});actions.prepend(btn)}
      if(!card.dataset.reopenBound){card.dataset.reopenBound='1';card.addEventListener('click',ev=>{if(ev.target.closest('button,summary,details,input,select,a'))return;window.reopenHistoryQuoteV33(Number(card.dataset.historyIndex))})}
    });
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceHistory));
  function start(){
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});enhanceHistory();
    const originalPayload=window.quotePayload;
    if(typeof originalPayload==='function'&&!window.__acjHistoryReopenPayloadV33){window.quotePayload=function(){const p=originalPayload.apply(this,arguments);const selected=window.ogustClientChoiceV21?.selected;const id=String(selected?.id_customer||window.acjReopenedClientIdV33||'');if(p?.client&&id)p.client.id_customer=id;return p};window.__acjHistoryReopenPayloadV33=true}
  }
  window.__acjHistoryReopenV33=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
