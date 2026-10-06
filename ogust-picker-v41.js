// Choose an Ogust tariff before quantities. Keep edits and drafts scoped to its account.
(function(){
  let selected=null,picking=false,search='',restoreSeq=0;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const unitLabel=u=>({H:'heure',F:'forfait',Q:'unité',K:'km'}[u]||u);
  const fieldIds=['builderDesignation','builderHours','builderRate','builderFlat','builderMetric','detailMetric','detailHeight','detailFaces','detailTop','detailCutType','detailWaste','detailGrass','detailCollection','detailDensity','detailZone','detailMethod','detailSupport','detailExtra'];
  const byId=id=>document.getElementById(id);
  function current(){return selected?.company===state.company&&selected.preset===state.activePreset?selected.rate:null}
  // The catalogue has no activity field. Hide only positively identified other
  // trades; ambiguous services stay available and never change the chosen trade.
  function category(r){
    const title=norm(r.title);
    if(/\b(frais|fourniture|fournitures|materiel|consommable|consommables|dechet|dechets|dechetterie|deplacement|deplacements)\b/.test(title))return 'cost';
    if(/\b(jardin|jardinage|jardi|tonte|pelouse|haie|haies|debroussaillage|debrousaillage|desherbage|elagage)\b/.test(title))return 'jardin';
    if(/\b(bricolage|bricol|montage|fixation)\b/.test(title))return 'bricol';
    if(/\b(locaux|bureaux|commerces)\b/.test(title)||/\b(menage|nettoyage|entretien|vitrerie|vitres)\b.*\b(pro|professionnel|professionnels|professionnelle|professionnelles)\b/.test(title)||/\b(pro|professionnel|professionnels|professionnelle|professionnelles)\b.*\b(menage|nettoyage|entretien|vitrerie|vitres)\b/.test(title))return 'nettoyagePro';
    if(/\b(menage|menager|menagere|repassage|logement|domicile)\b/.test(title))return 'menage';
    return '';
  }
  function allowed(r){const activity=category(r);return ['H','F','Q','K'].includes(r.unit)&&(!activity||activity==='cost'||activity===state.mode)}
  function values(){const out={};for(const id of fieldIds){const input=byId(id);if(input)out[id]=String(input.value??'')}return out}
  function changed(){window.dispatchEvent?.(new CustomEvent('acj:ogust-picker-changed'))}
  function fillBuilder(){
    const r=current();if(!r)return;
    const saved=selected.values||{};
    const defaults={builderDesignation:r.title,[r.unit==='F'?'builderFlat':'builderRate']:String(r.price)};
    for(const id of fieldIds){const input=byId(id);if(input&&Object.hasOwn(saved,id))input.value=saved[id];else if(input&&Object.hasOwn(defaults,id))input.value=defaults[id]}
    const quantity=byId('builderHours'),price=byId('builderRate');
    if(quantity){const label=quantity.parentElement?.querySelector('label');if(label)label.textContent=r.unit==='H'?"Nombre d’heures":`Quantité (${unitLabel(r.unit)})`;quantity.step=r.unit==='Q'?'1':r.unit==='K'?'0.01':'0.25'}
    if(price){const label=price.parentElement?.querySelector('label');if(label)label.textContent=`Tarif TTC / ${r.unit==='H'?'h':unitLabel(r.unit)}`}
    if(r.unit==='Q'||r.unit==='K')document.querySelector('#serviceBuilder .quickHours')?.remove();
    // A tariff has a fixed unit. Changing pricing methods would silently detach it.
    document.querySelector('#serviceBuilder .methodTitle')?.remove();
    document.querySelector('#serviceBuilder .methodGrid')?.remove();
    document.querySelector('#serviceBuilder .ogpsBadge')?.remove();
    const header=document.querySelector('#serviceBuilder .serviceHead');if(header){const title=header.querySelector('strong');if(title)title.textContent=r.title;const spans=header.querySelectorAll('span');if(spans.length)spans[spans.length-1].textContent=`TVA ${r.vat} %`}
  }
  function pick(r,options={}){
    if(!allowed(r))return false;
    const preset=MODES[state.mode]?.presets.find(p=>p.kind==='custom');if(!preset)return false;
    selected={company:state.company,preset:preset.id,rate:r,values:options.values||{}};picking=true;
    try{window.choosePreset(preset.id);state.builderMethod=r.unit==='F'?'flat':'hourly';window.renderServiceBuilder()}finally{picking=false}
    if(options.scroll!==false)byId('serviceBuilder')?.scrollIntoView({behavior:'smooth',block:'start'});
    changed();return true;
  }
  function results(){
    const list=byId('ogPickerResults41');if(!list)return;list.replaceChildren();
    const catalog=window.acjOgustRates?.rates||[],query=norm(search).split(' ').filter(Boolean);
    const found=catalog.filter(r=>allowed(r)&&query.every(word=>norm(r.title).includes(word))).sort((a,b)=>a.title.localeCompare(b.title,'fr'));
    if(!found.length){list.textContent=catalog.length?'Aucune prestation trouvée pour ce métier.':'Les tarifs Ogust ne sont pas encore disponibles.';return}
    for(const r of found){const button=document.createElement('button');button.type='button';button.className='choice';button.style.cssText='width:100%;text-align:left;margin-bottom:6px';const title=document.createElement('strong');title.textContent=r.title;const detail=document.createElement('small');detail.textContent=`${Number(r.price).toFixed(2)} € TTC / ${unitLabel(r.unit)} · TVA ${r.vat} %`;button.append(title,detail);button.onclick=()=>pick(r);list.append(button)}
  }
  async function panel(){
    // fast-flow keeps the builder visible but moves the old preset choices into details.
    const anchor=byId('serviceBuilder')||byId('presetChoices');if(!anchor)return;
    if(!byId('ogPicker41')){
      const box=document.createElement('div');box.id='ogPicker41';box.style.cssText='margin-bottom:18px';
      const title=document.createElement('div');title.className='cardTitle';title.textContent='Choisir dans Ogust';
      const input=document.createElement('input');input.type='search';input.placeholder='Rechercher une prestation : jardinage, haie, ménage…';input.setAttribute('aria-label','Rechercher une prestation Ogust');input.style.cssText='width:100%;margin-bottom:10px';input.oninput=()=>{restoreSeq++;search=input.value;results();changed()};
      const list=document.createElement('div');list.id='ogPickerResults41';list.style.cssText='max-height:260px;overflow-y:auto';
      const note=document.createElement('div');note.className='hint';note.textContent='Le tarif, l’unité et la TVA seront préremplis. Le montant reste modifiable.';
      box.append(title,input,list,note);anchor.insertAdjacentElement('beforebegin',box);results();
    }
    const ok=await window.acjOgustRates?.load();results();if(!ok){const list=byId('ogPickerResults41');if(list&&!window.acjOgustRates?.rates.length)list.textContent='Connecte-toi pour charger les prestations Ogust.'}
  }
  function getDraft(){
    const r=current();return {company:state.company,mode:state.mode,preset:state.activePreset||null,method:state.builderMethod,selected:r?{rateId:r.id,product:r.product,unit:r.unit,vat:r.vat}:null,values:values(),search};
  }
  async function restoreDraft(draft){
    if(!draft||draft.company!==state.company||draft.mode!==state.mode)return false;
    const seq=++restoreSeq,company=state.company,mode=state.mode;
    const saved={};for(const id of fieldIds)if(typeof draft.values?.[id]==='string')saved[id]=draft.values[id].slice(0,4000);
    if(draft.selected){
      if(!await window.acjOgustRates?.load()||seq!==restoreSeq||company!==state.company||mode!==state.mode)return false;
      const wanted=draft.selected,r=window.acjOgustRates.rates.find(rate=>rate.id===wanted.rateId&&rate.product===wanted.product&&rate.unit===wanted.unit&&Math.abs(Number(rate.vat)-Number(wanted.vat))<.001);
      if(!r||!pick(r,{values:saved,scroll:false}))return false;
    }else if(draft.preset){
      const preset=MODES[state.mode]?.presets.find(p=>p.id===draft.preset);if(!preset)return false;
      window.choosePreset(preset.id);state.builderMethod=['hourly','flat','auto'].includes(draft.method)?draft.method:'hourly';window.renderServiceBuilder();
      for(const id of fieldIds)if(byId(id)&&Object.hasOwn(saved,id))byId(id).value=saved[id];
    }
    search=typeof draft.search==='string'?draft.search.slice(0,200):'';const input=document.querySelector('#ogPicker41 input');if(input)input.value=search;results();changed();return true;
  }
  function init(){
    document.addEventListener?.('input',event=>{if(fieldIds.includes(event.target?.id))restoreSeq++},true);
    const choose=window.choosePreset;window.choosePreset=function(){if(!picking){selected=null;restoreSeq++}return choose.apply(this,arguments)};
    const builder=window.renderServiceBuilder;window.renderServiceBuilder=function(){if(!picking)restoreSeq++;const r=current();if(!picking&&r){if((r.unit==='F')!==(state.builderMethod==='flat'))selected=null;else selected.values={...selected.values,...values()}}const out=builder.apply(this,arguments);fillBuilder();return out};
    const add=window.addBuiltService;window.addBuiltService=function(){const r=current(),before=state.lines.length,title=byId('builderDesignation')?.value;const out=add.apply(this,arguments);if(r&&state.lines.length>before){const l=state.lines[state.lines.length-1];l.designation=title?.trim()||r.title;l.vat=r.vat;l.unit=r.unit==='H'?'h':r.unit==='F'?'forfait':r.unit==='K'?'km':'unité';if(r.unit==='Q'||r.unit==='K'){l.meta=`${l.qty} ${l.unit}`;l.pricingMethod='quantity'}if(category(r)==='cost')l.type='cost';window.acjOgustRates.assign(l,r);selected=null;window.renderQuoteLines();changed()}return out};
    const mode=window.setMode;window.setMode=function(){selected=null;restoreSeq++;const out=mode.apply(this,arguments);panel();return out};
    const fresh=window.newQuote;window.newQuote=function(){selected=null;restoreSeq++;search='';const input=document.querySelector('#ogPicker41 input');if(input)input.value='';return fresh.apply(this,arguments)};
    const step=window.goStep;window.goStep=function(n){const out=step.apply(this,arguments);if(Number(n)===2)panel();return out};
    window.addEventListener('acj:company-changed',()=>{selected=null;restoreSeq++;search='';const input=document.querySelector('#ogPicker41 input');if(input)input.value='';panel()});panel();
  }
  window.acjOgustPicker={getDraft,restoreDraft};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
