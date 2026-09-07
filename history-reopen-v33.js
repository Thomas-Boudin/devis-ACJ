// Devis ACJ v33 — rouvrir un devis existant pour le consulter/modifier et retrouver ses disponibilités.
(function(){
  if(window.__acjHistoryReopenV33)return;
  const SAVED_KEY='acj_devis_saved_v6';
  const META_KEY='acj_devis_history_meta_v29';

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
  function restoreQuote(p){
    if(!p||typeof state==='undefined')return;
    state.step=1;
    state.number=String(p?.numero_devis||state.number||'');
    state.company=String(p?.societe||'ACJ Services');
    state.client=String(p?.client?.nom||'');
    state.tel=String(p?.client?.telephone||'');
    state.address=String(p?.client?.adresse||'');
    state.mode=(typeof MODES!=='undefined'&&MODES?.[p?.mode])?p.mode:((p?.lignes||[]).find(l=>typeof MODES!=='undefined'&&MODES?.[l?.activite])?.activite||'jardin');
    state.activePreset=null;state.builderMethod='hourly';state.notes=String(p?.notes||'');
    state.lines=(p?.lignes||[]).map(l=>({
      id:typeof window.uid==='function'?window.uid():`l_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      type:l?.type||'service',designation:String(l?.designation||''),meta:String(l?.detail||''),pricingMethod:String(l?.methode_chiffrage||''),activity:String(l?.activite||p?.mode||state.mode),qty:n(l?.quantite),unit:String(l?.unite||''),unitPriceTTC:n(l?.prix_unitaire_ttc),vat:n(l?.tva_rate),
      ...(l?.ogust_product_level_id?{ogustProductLevelId:String(l.ogust_product_level_id),ogustProductLevelTitle:String(l.ogust_product_level_title||''),ogustProductCompany:String(p?.societe||'')}:{})
    })).filter(l=>l.designation&&l.qty>0);
    window.acjReopenedQuoteV33={societe:state.company,numero_devis:state.number,id_customer:String(p?.client?.id_customer||''),snapshot:p};
    window.acjReopenedClientIdV33=String(p?.client?.id_customer||'');
    setInput('client',state.client);setInput('tel',state.tel);setInput('adresse',state.address);setInput('email',p?.client?.email||'');setInput('notes',state.notes);
    const top=document.getElementById('quoteNumberTop');if(top)top.textContent=state.number;
    if(typeof window.renderCompanies==='function')window.renderCompanies();
    if(typeof window.renderModes==='function')window.renderModes();
    if(typeof window.renderQuoteLines==='function')window.renderQuoteLines();
    document.getElementById('historyOverlayV29')?.remove();
    if(typeof window.goStep==='function')window.goStep(4);
    setTimeout(()=>{window.dispatchEvent(new CustomEvent('acj:quote-reopened',{detail:{quote:p}}));window.scrollTo({top:0,behavior:'smooth'})},0);
  }
  window.reopenHistoryQuoteV33=function(index){const p=filtered()[Number(index)];if(p)restoreQuote(p)};

  function enhanceHistory(){
    const list=document.getElementById('historyList');if(!list)return;
    [...list.querySelectorAll('.histCard')].forEach((card,i)=>{
      card.dataset.historyIndex=String(i);card.style.cursor='pointer';
      const actions=card.querySelector('.histActions');
      if(actions&&!actions.querySelector('.histReopenBtn')){
        const btn=document.createElement('button');btn.type='button';btn.className='btn histReopenBtn';btn.textContent='Rouvrir';btn.addEventListener('click',ev=>{ev.stopPropagation();window.reopenHistoryQuoteV33(i)});actions.prepend(btn);
      }
      if(!card.dataset.reopenBound){card.dataset.reopenBound='1';card.addEventListener('click',ev=>{if(ev.target.closest('button,summary,details,input,select,a'))return;window.reopenHistoryQuoteV33(Number(card.dataset.historyIndex))})}
    });
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceHistory));
  function start(){
    const body=document.body;if(body)observer.observe(body,{childList:true,subtree:true});enhanceHistory();
    const originalPayload=window.quotePayload;
    if(typeof originalPayload==='function'&&!window.__acjHistoryReopenPayloadV33){
      window.quotePayload=function(){const p=originalPayload.apply(this,arguments);const selected=window.ogustClientChoiceV21?.selected;const id=String(selected?.id_customer||window.acjReopenedClientIdV33||'');if(p?.client&&id)p.client.id_customer=id;return p};
      window.__acjHistoryReopenPayloadV33=true;
    }
  }
  window.__acjHistoryReopenV33=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
