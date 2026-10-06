// Explicit tariff selection, scoped to the current Ogust account.
(function(){
  let rates=[],company='',pending=null;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const unit=l=>{const u=norm(l.unit);return u==='h'||u.includes('heure')?'H':u==='km'?'K':u==='forfait'?'F':'Q'};
  const compatible=(r,l)=>r.unit===unit(l)&&Math.abs(r.vat-Number(l.vat))<.001;
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
      const select=document.createElement('select');select.style.cssText='width:100%;margin-top:6px';
      const first=document.createElement('option');first.value='';first.textContent=company===state.company?'Choisir une prestation compatible':'Chargement des tarifs Ogust…';select.append(first);
      if(company===state.company)for(const r of rates.filter(r=>compatible(r,l)).sort((a,b)=>a.title.localeCompare(b.title,'fr'))){const o=document.createElement('option');o.value=r.id;o.textContent=`${r.title} · ${r.unit==='H'?'heure':r.unit==='F'?'forfait':r.unit} · TVA ${r.vat} % · ${r.price.toFixed(2)} € TTC`;select.append(o)}
      select.value=choice(l)?.id||'';
      select.onchange=()=>{const r=rates.find(r=>r.id===select.value);if(r&&compatible(r,l))assign(l,r);else delete l.ogustRateId;render()};box.append(select);
      const hint=document.createElement('div');hint.style.cssText='font-size:12px;margin-top:6px';hint.textContent=choice(l)?'Tarif associé. Le prix de ton devis est conservé.':`Association requise pour ${l.unit}, TVA ${l.vat} %. Si aucun tarif ne correspond, vérifie l’unité et la TVA de la ligne.`;box.append(hint);card.append(box);
    });
  }
  async function load(){
    const c=state.company;if(company===c)return true;
    if(pending?.company===c)return pending.promise;
    const promise=(async()=>{try{const response=await fetch('https://acj-ogust-proxy.vercel.app/api/ogust-history?rates=1&company='+encodeURIComponent(c),{cache:'no-store'});const data=await response.json();if(!response.ok||!data.ok||!Array.isArray(data.rates)||c!==state.company)return false;rates=data.rates;company=c;render();return true}catch{return false}})();
    pending={company:c,promise};try{return await promise}finally{if(pending?.promise===promise)pending=null}
  }
  function init(){
    const originalRender=window.renderQuoteLines;window.renderQuoteLines=function(){const out=originalRender.apply(this,arguments);render();load();return out};
    const originalPayload=window.quotePayload;window.quotePayload=function(){const p=originalPayload.apply(this,arguments);p.lignes.forEach((l,i)=>{const src=state.lines[i];automatic(src);const r=choice(src);delete l.ogust_rate_id;if(r){l.ogust_rate_id=r.id;l.ogust_product_level_id=r.product;l.ogust_product_level_title=r.title;l.ogust_unit=r.unit}});return p};
    const originalSend=window.sendToOgust;window.sendToOgust=async function(){if(!await load()){showStatus('finalStatus','Lecture des tarifs Ogust impossible. Aucun devis créé.','err');return}render();const i=state.lines.findIndex(l=>!choice(l));if(i>=0){goStep(3);showStatus('finalStatus',`Choisis la prestation et le tarif Ogust de la ligne ${i+1} dans le devis avant l’envoi.`,'err');return}return originalSend.apply(this,arguments)};
    window.addEventListener('acj:company-changed',()=>{rates=[];company='';pending=null;for(const l of state.lines)delete l.ogustRateId;render();load()});render();load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
