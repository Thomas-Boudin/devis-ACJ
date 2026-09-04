// Devis ACJ v21/v28 — choix client Ogust dès l'étape 1, isolé par société.
(function(){
  const CUSTOMER_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';
  let mode='existing';
  let selected=null;
  let results=[];
  let timer=null;
  let requestSeq=0;

  function companyName(){try{return String(state?.company||'ACJ Services')}catch{return 'ACJ Services'}}
  function ogustName(){return companyName()==='ACJ Services Lens'?'Ogust Lens':'Ogust'}
  function searchHint(){return `Tape au moins 2 lettres du nom, du prénom ou du téléphone dans ${ogustName()}.`}
  function esc(v){
    if(typeof window.esc==='function')return window.esc(v);
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function addStyles(){
    if(document.getElementById('ogc-v21-style'))return;
    const s=document.createElement('style');s.id='ogc-v21-style';
    s.textContent=`
      .ogcTabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.ogcTab{border:1px solid #30435f;background:#091522;color:#dbeafe;border-radius:13px;padding:11px 10px;font-size:12px;font-weight:850}.ogcTab.active{border-color:#38bdf8;background:rgba(14,165,233,.15);color:#fff}
      .ogcSearchWrap{position:relative}.ogcResults{display:grid;gap:7px;margin-top:9px}.ogcResult{width:100%;border:1px solid #2f4963;background:#091522;color:#f8fafc;border-radius:13px;padding:10px 11px;text-align:left}.ogcResult strong{display:block;font-size:12px}.ogcResult small{display:block;color:#94a3b8;font-size:10px;margin-top:3px;line-height:1.35}.ogcResult.selected{border-color:#22c55e;background:rgba(34,197,94,.10)}
      .ogcHint{font-size:11px;color:#94a3b8;line-height:1.45;margin-top:8px}.ogcStatus{font-size:11px;line-height:1.4;margin-top:8px;color:#bae6fd}.ogcStatus.err{color:#fecaca}.ogcChosen{border:1px solid #166534;background:#0b2818;border-radius:13px;padding:10px 11px;margin-top:9px}.ogcChosen strong{font-size:12px}.ogcChosen small{display:block;color:#bbf7d0;font-size:10px;margin-top:3px}.ogcChange{border:0;background:transparent;color:#7dd3fc;padding:7px 0 0;font-size:11px;font-weight:800}
    `;
    document.head.appendChild(s);
  }
  function formCard(){return document.getElementById('client')?.closest('.card')||null}
  function setInput(id,value){const x=document.getElementById(id);if(x)x.value=value||''}
  function clearClientInputs(){setInput('client','');setInput('tel','');setInput('adresse','')}
  function setClientInputs(c){
    setInput('client',c?.label||'');
    setInput('tel',c?.phone||'');
    setInput('adresse',c?.address||([c?.zip,c?.city].filter(Boolean).join(' ')));
  }
  function status(text,error=false){const x=document.getElementById('ogcStatus');if(!x)return;x.textContent=text||'';x.className=`ogcStatus${error?' err':''}`}
  function renderResults(){
    const box=document.getElementById('ogcResults');if(!box)return;
    if(selected){
      const meta=[selected.code?`Code ${selected.code}`:'',selected.phone||'',selected.city||''].filter(Boolean).join(' · ');
      box.innerHTML=`<div class="ogcChosen"><strong>${esc(selected.label)}</strong>${meta?`<small>${esc(meta)}</small>`:''}<button class="ogcChange" type="button" id="ogcChangeBtn">Changer de client</button></div>`;
      document.getElementById('ogcChangeBtn')?.addEventListener('click',()=>{selected=null;clearClientInputs();box.innerHTML='';const q=document.getElementById('ogcSearch');if(q){q.value='';q.focus()}status(searchHint());});
      return;
    }
    box.innerHTML=results.map((c,i)=>{
      const meta=[c.code?`Code ${c.code}`:'',c.phone||'',c.city||''].filter(Boolean).join(' · ');
      return `<button class="ogcResult" type="button" data-i="${i}"><strong>${esc(c.label)}</strong>${meta?`<small>${esc(meta)}</small>`:''}</button>`;
    }).join('');
    box.querySelectorAll('.ogcResult').forEach(btn=>btn.addEventListener('click',()=>{
      const c=results[Number(btn.dataset.i)];if(!c)return;
      selected=c;setClientInputs(c);renderResults();status(`Client ${ogustName()} sélectionné.`);
    }));
  }
  async function searchNow(query){
    const q=String(query||'').trim();
    if(q.length<2){results=[];renderResults();status(searchHint());return}
    const company=companyName();const seq=++requestSeq;status(`Recherche dans ${ogustName()}…`);
    try{
      const r=await fetch(CUSTOMER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',query:q,company})});
      const data=await r.json().catch(()=>null);if(seq!==requestSeq)return;
      if(!r.ok||!data?.ok)throw new Error(data?.detail||data?.error||'Recherche impossible');
      results=data.customer_candidates||[];renderResults();
      status(results.length?`${results.length} client${results.length>1?'s':''} trouvé${results.length>1?'s':''} dans ${ogustName()}.`:`Aucun client trouvé dans ${ogustName()}. Vérifie l’orthographe ou choisis « Nouveau client ».`);
    }catch(e){if(seq!==requestSeq)return;results=[];renderResults();status(`${ogustName()} : ${e?.message||'recherche impossible'}.`,true)}
  }
  function queueSearch(value){clearTimeout(timer);timer=setTimeout(()=>searchNow(value),280)}
  function applyMode(next,clear=true){
    mode=next==='new'?'new':'existing';
    document.getElementById('ogcExistingBtn')?.classList.toggle('active',mode==='existing');
    document.getElementById('ogcNewBtn')?.classList.toggle('active',mode==='new');
    const panel=document.getElementById('ogcExistingPanel');if(panel)panel.style.display=mode==='existing'?'block':'none';
    const card=formCard();if(card)card.style.display=mode==='new'?'block':'none';
    if(clear){selected=null;results=[];clearClientInputs();renderResults()}
    if(mode==='existing')status(searchHint());
    else status('');
    window.ogustClientChoiceV21={mode,get selected(){return selected},get company(){return companyName()}};
  }
  function resetAfterCompanyChange(company){
    clearTimeout(timer);requestSeq++;selected=null;results=[];
    const q=document.getElementById('ogcSearch');if(q)q.value='';
    if(mode==='existing')clearClientInputs();
    renderResults();if(mode==='existing')status(searchHint());
    window.ogustClientChoiceV21={mode,get selected(){return selected},get company(){return companyName()}};
    window.dispatchEvent(new CustomEvent('acj:company-changed',{detail:{company}}));
  }
  function inject(){
    if(document.getElementById('ogcClientCard'))return;
    const companyCard=document.getElementById('companyChoices')?.closest('.card'),clientCard=formCard();
    if(!companyCard||!clientCard)return;
    addStyles();
    const card=document.createElement('div');card.className='card';card.id='ogcClientCard';
    card.innerHTML=`<div class="cardTitle">Client</div>
      <div class="ogcTabs"><button id="ogcExistingBtn" class="ogcTab active" type="button">Existant dans Ogust</button><button id="ogcNewBtn" class="ogcTab" type="button">Nouveau client</button></div>
      <div id="ogcExistingPanel"><div class="field"><label>Rechercher dans Ogust</label><input id="ogcSearch" autocomplete="off" placeholder="Nom, prénom ou téléphone"></div><div id="ogcResults" class="ogcResults"></div><div id="ogcStatus" class="ogcStatus"></div></div>
      <div class="ogcHint">La recherche utilise automatiquement le compte Ogust de la société choisie. Changer de société efface la sélection pour éviter tout mélange de clients.</div>`;
    companyCard.insertAdjacentElement('afterend',card);
    document.getElementById('ogcExistingBtn').addEventListener('click',()=>applyMode('existing'));
    document.getElementById('ogcNewBtn').addEventListener('click',()=>applyMode('new'));
    document.getElementById('ogcSearch').addEventListener('input',e=>{selected=null;clearClientInputs();results=[];renderResults();queueSearch(e.target.value)});
    applyMode('existing',false);

    const originalSetCompany=window.setCompany;
    if(typeof originalSetCompany==='function'&&!window.__acjMultiOgustCompanyV28)window.setCompany=function(n){
      const before=companyName();const out=originalSetCompany.apply(this,arguments);if(String(n)!==before)resetAfterCompanyChange(String(n));return out;
    };
    window.__acjMultiOgustCompanyV28=true;

    const originalGoStep=window.goStep;
    if(typeof originalGoStep==='function')window.goStep=function(step){
      if(Number(step)===2&&mode==='existing'&&!selected){status(`Sélectionne d’abord un client dans ${ogustName()}, ou choisis « Nouveau client ».`,true);document.getElementById('ogcSearch')?.focus();return}
      return originalGoStep.apply(this,arguments);
    };
    const originalNewQuote=window.newQuote;
    if(typeof originalNewQuote==='function')window.newQuote=function(){
      const out=originalNewQuote.apply(this,arguments);const q=document.getElementById('ogcSearch');if(q)q.value='';selected=null;results=[];applyMode('existing',false);renderResults();return out;
    };
    const originalSend=window.sendToOgust;
    if(typeof originalSend==='function')window.sendToOgust=async function(){
      const out=await originalSend.apply(this,arguments);
      if(mode==='existing'&&selected?.id_customer){
        const radio=[...document.querySelectorAll('input[name="ogwCustomer"]')].find(x=>String(x.value)===String(selected.id_customer));
        if(radio){radio.checked=true;if(typeof window.refreshOgustConfirm==='function')window.refreshOgustConfirm()}
      }
      return out;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
