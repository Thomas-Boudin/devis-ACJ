// Select the Ogust service before entering quantities and prices.
(function(){
  let selected=null,picking=false,search='';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const unitLabel=u=>({H:'heure',F:'forfait',Q:'unité',K:'km'}[u]||u);
  function current(){return selected?.company===state.company&&selected.preset===state.activePreset?selected.rate:null}
  function fillBuilder(){
    const r=current();if(!r)return;
    const designation=document.getElementById('builderDesignation');if(designation)designation.value=r.title;
    const price=document.getElementById(r.unit==='F'?'builderFlat':'builderRate');if(price)price.value=r.price;
    const hours=document.getElementById('builderHours');if(hours&&r.unit!=='H'){const label=hours.parentElement.querySelector('label');if(label)label.textContent=`Quantité (${unitLabel(r.unit)})`;}
    document.querySelector('#serviceBuilder .ogpsBadge')?.remove();
    const header=document.querySelector('#serviceBuilder .serviceHead');if(header){const title=header.querySelector('strong');if(title)title.textContent=r.title;const spans=header.querySelectorAll('span');if(spans.length)spans[spans.length-1].textContent=`TVA ${r.vat} %`;}
  }
  function pick(r){
    const preset=MODES[state.mode]?.presets.find(p=>p.kind==='custom');if(!preset)return;
    selected={company:state.company,preset:preset.id,rate:r};picking=true;
    try{window.choosePreset(preset.id);state.builderMethod=r.unit==='F'?'flat':'hourly';window.renderServiceBuilder();fillBuilder();}finally{picking=false}
    document.getElementById('serviceBuilder')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function results(){
    const list=document.getElementById('ogPickerResults41');if(!list)return;list.replaceChildren();
    const catalog=window.acjOgustRates?.rates||[],query=norm(search).split(' ').filter(Boolean);
    const found=catalog.filter(r=>['H','F','Q','K'].includes(r.unit)&&query.every(word=>norm(r.title).includes(word))).sort((a,b)=>a.title.localeCompare(b.title,'fr'));
    if(!found.length){list.textContent=catalog.length?'Aucune prestation trouvée.':'Les tarifs Ogust ne sont pas encore disponibles.';return}
    for(const r of found){const button=document.createElement('button');button.type='button';button.className='choice';button.style.cssText='width:100%;text-align:left;margin-bottom:6px';const title=document.createElement('strong');title.textContent=r.title;const detail=document.createElement('small');detail.textContent=`${r.price.toFixed(2)} € TTC / ${unitLabel(r.unit)} · TVA ${r.vat} %`;button.append(title,detail);button.onclick=()=>pick(r);list.append(button)}
  }
  async function panel(){
    const presets=document.getElementById('presetChoices');if(!presets)return;
    if(!document.getElementById('ogPicker41')){
      const box=document.createElement('div');box.id='ogPicker41';box.style.cssText='margin-bottom:18px';
      const title=document.createElement('div');title.className='cardTitle';title.textContent='Choisir dans Ogust';
      const input=document.createElement('input');input.type='search';input.placeholder='Rechercher une prestation : jardinage, haie, ménage…';input.setAttribute('aria-label','Rechercher une prestation Ogust');input.style.cssText='width:100%;margin-bottom:10px';input.oninput=()=>{search=input.value;results()};
      const list=document.createElement('div');list.id='ogPickerResults41';list.style.cssText='max-height:260px;overflow-y:auto';
      const note=document.createElement('div');note.className='hint';note.textContent='Le tarif, l’unité et la TVA seront préremplis. Le montant reste modifiable.';
      box.append(title,input,list,note);presets.insertAdjacentElement('beforebegin',box);results();
    }
    const ok=await window.acjOgustRates?.load();results();if(!ok){const list=document.getElementById('ogPickerResults41');if(list&&!window.acjOgustRates?.rates.length)list.textContent='Connecte-toi pour charger les prestations Ogust.'}
  }
  function init(){
    const choose=window.choosePreset;window.choosePreset=function(){if(!picking)selected=null;return choose.apply(this,arguments)};
    const builder=window.renderServiceBuilder;window.renderServiceBuilder=function(){const r=current();if(!picking&&r&&((r.unit==='F')!==(state.builderMethod==='flat')))selected=null;const out=builder.apply(this,arguments);fillBuilder();return out};
    const add=window.addBuiltService;window.addBuiltService=function(){const r=current(),before=state.lines.length;const title=document.getElementById('builderDesignation')?.value;const out=add.apply(this,arguments);if(r&&state.lines.length>before){const l=state.lines[state.lines.length-1];l.designation=title?.trim()||r.title;l.vat=r.vat;l.unit=r.unit==='H'?'h':r.unit==='F'?'forfait':r.unit==='K'?'km':'unité';window.acjOgustRates.assign(l,r);selected=null;window.renderQuoteLines()}return out};
    const mode=window.setMode;window.setMode=function(){selected=null;const out=mode.apply(this,arguments);panel();return out};
    const fresh=window.newQuote;window.newQuote=function(){selected=null;return fresh.apply(this,arguments)};
    const step=window.goStep;window.goStep=function(n){const out=step.apply(this,arguments);if(Number(n)===2)panel();return out};
    window.addEventListener('acj:company-changed',()=>{selected=null;search='';const input=document.querySelector('#ogPicker41 input');if(input)input.value='';panel()});panel();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
