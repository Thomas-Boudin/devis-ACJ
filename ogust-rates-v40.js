// Explicit tariff selection, scoped to the current Ogust account.
(function(){
  let rates=[],company='',pending=null;
  const searches=new Map();
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const unit=l=>{const u=norm(l.unit);return u==='h'||u.includes('heure')?'H':u==='km'?'K':u==='forfait'?'F':'Q'};
  const compatible=(r,l)=>r.unit===unit(l)&&Math.abs(r.vat-Number(l.vat))<.001;
  const unitLabel=u=>({H:'heure',F:'forfait',Q:'unité',K:'km'}[u]||u);
  const valid=r=>r&&String(r.id||'').trim()&&String(r.product||'').trim()&&typeof r.title==='string'&&r.title.trim()&&['H','F','Q','K'].includes(r.unit)&&r.vat!==null&&r.vat!==''&&Number.isFinite(Number(r.vat))&&Number(r.vat)>=0&&Number(r.vat)<=100&&r.price!==null&&r.price!==''&&Number.isFinite(Number(r.price))&&Number(r.price)>=0;
  const supplies=v=>/\b(fourniture|fournitures|materiel|consommable|consommables)\b/.test(norm(v));
  function matches(r,search){
    const title=norm(r.title),words=norm(search).split(' ').filter(w=>w&&!['de','du','des','et','a','la','le','les','d'].includes(w));
    return words.every(w=>supplies(w)?supplies(title):title.includes(w));
  }
  function selectRate(l,r){
    l.unit=r.unit==='H'?'h':r.unit==='F'?'forfait':r.unit==='K'?'km':'unité';
    l.vat=Number(r.vat);l.pricingMethod=r.unit==='H'?'hourly':r.unit==='F'?'flat':'quantity';
    if(supplies(r.title))l.type='cost';
    if(/^\d+(?:[.,]\d+)? h de main-d’œuvre$/.test(l.meta||''))l.meta=r.unit==='H'?`${l.qty} h de main-d’œuvre`:`${l.qty} ${l.unit}`;
    assign(l,r);
  }
  function choice(l){
    if(l.ogustProductCompany!==state.company)return null;
    return rates.find(r=>r.id===l.ogustRateId&&r.product===l.ogustProductLevelId&&compatible(r,l));
  }
  function assign(l,r){l.ogustRateId=r.id;l.ogustProductLevelId=r.product;l.ogustProductLevelTitle=r.title;l.ogustProductCompany=state.company}
  function automatic(l){
    if(choice(l))return;
    delete l.ogustRateId;
    let candidates=rates.filter(r=>compatible(r,l)&&l.ogustProductCompany===state.company&&r.product===l.ogustProductLevelId);
    // The general hourly garden service is safe only for an unlinked hourly garden line.
    if(!l.ogustProductLevelId&&l.type==='service'&&l.activity==='jardin'&&unit(l)==='H')candidates=rates.filter(r=>compatible(r,l)&&norm(r.title)===norm("Jardinage à l'heure"));
    if(candidates.length>1){const exact=candidates.filter(r=>norm(r.title)===norm(l.ogustProductLevelTitle));if(exact.length===1)candidates=exact}
    if(candidates.length===1)assign(l,candidates[0]);
  }
  function render(){
    document.querySelectorAll('#quoteLines .quoteLine').forEach((card,i)=>{
      card.querySelector('.ogRate40')?.remove();const l=state.lines[i];if(!l)return;
      if(company===state.company)automatic(l);
      const box=document.createElement('div');box.className='ogRate40';box.style.cssText='margin-top:12px;padding:12px;border:1px solid #94a3b8;border-radius:12px';
      const label=document.createElement('label');label.textContent='Prestation et tarif Ogust';box.append(label);
      const scope=state.company,key=`${scope}:${l.id||i}`,search=document.createElement('input');search.type='search';search.className='ogRateSearch40';search.placeholder='Rechercher : fournitures, matériel, jardinage…';search.setAttribute('aria-label','Rechercher une prestation Ogust pour cette ligne');search.style.cssText='width:100%;margin-top:8px';search.value=searches.get(key)??(supplies(l.designation)?'fournitures':'');box.append(search);
      const select=document.createElement('select');select.className='ogRateSelect40';select.setAttribute('aria-label','Prestation et tarif Ogust');select.style.cssText='width:100%;margin-top:6px';
      const hint=document.createElement('div');hint.className='ogRateHint40';hint.style.cssText='font-size:12px;margin-top:6px';
      function options(){
        select.replaceChildren();const selected=choice(l),found=company===state.company?rates.filter(r=>matches(r,search.value)).sort((a,b)=>a.title.localeCompare(b.title,'fr')):[];
        const first=document.createElement('option');first.value='';first.textContent=company!==state.company?'Chargement des tarifs Ogust…':found.length?'Choisir une prestation Ogust':'Aucun tarif actif trouvé';select.append(first);
        const shown=selected&&!found.some(r=>r.id===selected.id)?[selected,...found]:found;
        for(const r of shown){const o=document.createElement('option');o.value=r.id;o.textContent=`${r.title} · ${unitLabel(r.unit)} · TVA ${r.vat} % · ${Number(r.price).toFixed(2)} € TTC`;select.append(o)}
        select.value=selected?.id||'';
        hint.textContent=selected?`Tarif associé · ${unitLabel(selected.unit)} · TVA ${selected.vat} %. Quantité et prix TTC conservés.`:company===state.company&&!found.length?'Aucun tarif actif ne correspond à cette recherche dans cette société.':`La sélection applique l’unité et la TVA du tarif Ogust. Quantité et prix TTC conservés. Ligne actuelle : ${l.unit}, TVA ${l.vat} %.`;
      }
      search.oninput=()=>{searches.set(key,search.value);options()};
      select.onchange=()=>{if(scope!==state.company||!state.lines.includes(l)||!card.isConnected)return;const r=company===state.company?rates.find(r=>r.id===select.value):null;if(r)selectRate(l,r);else delete l.ogustRateId;window.renderQuoteLines()};
      box.append(select,hint);options();card.append(box);
    });
  }
  async function load(){
    const c=state.company;if(company===c)return true;
    if(pending?.company===c)return pending.promise;
    const promise=(async()=>{try{const response=await fetch('https://acj-ogust-proxy.vercel.app/api/ogust-history?rates=1&company='+encodeURIComponent(c),{cache:'no-store'});const data=await response.json();if(!response.ok||!data.ok||!Array.isArray(data.rates)||c!==state.company)return false;rates=data.rates.filter(valid);company=c;render();return true}catch{return false}})();
    pending={company:c,promise};try{return await promise}finally{if(pending?.promise===promise)pending=null}
  }
  window.acjOgustRates={load,assign,get rates(){return company===state.company?rates:[]},get company(){return company}};
  function init(){
    const originalRender=window.renderQuoteLines;window.renderQuoteLines=function(){const out=originalRender.apply(this,arguments);render();load();return out};
    const originalPayload=window.quotePayload;window.quotePayload=function(){const p=originalPayload.apply(this,arguments);p.lignes.forEach((l,i)=>{const src=state.lines[i];automatic(src);const r=choice(src);delete l.ogust_rate_id;if(r){l.ogust_rate_id=r.id;l.ogust_product_level_id=r.product;l.ogust_product_level_title=r.title;l.ogust_unit=r.unit}});return p};
    const originalSend=window.sendToOgust;window.sendToOgust=async function(){if(!await load()){showStatus('finalStatus','Lecture des tarifs Ogust impossible. Aucun devis créé.','err');return}render();const i=state.lines.findIndex(l=>!choice(l));if(i>=0){goStep(3);showStatus('finalStatus',`Choisis la prestation et le tarif Ogust de la ligne ${i+1} dans le devis avant l’envoi.`,'err');return}return originalSend.apply(this,arguments)};
    const originalNew=window.newQuote;if(typeof originalNew==='function')window.newQuote=function(){searches.clear();return originalNew.apply(this,arguments)};
    window.addEventListener('acj:company-changed',()=>{searches.clear();rates=[];company='';pending=null;for(const l of state.lines)delete l.ogustRateId;render();load()});render();load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
