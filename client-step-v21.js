// Devis ACJ v21/v28 — choix client Ogust dès l'étape 1, isolé par société.
(function(){
  const CUSTOMER_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';
  let mode='existing';
  let selected=null;
  let results=[];
  let timer=null;
  let requestSeq=0;
  let formDraft=null,newConfig=null,configCompany='',configSeq=0,creating=false,contextSeq=0;
  const fields={Title:'title_value',LastName:'last_name',FirstName:'first_name',Phone:'mobile_phone',Landline:'landline',Email:'email',Address:'address',Zip:'zip',City:'city',Type:'type',Origin:'origin',Sector:'sector',Payment:'method_of_payment',Manager:'manager'};
  const selectFields=['Title','Type','Origin','Sector','Payment','Manager'];
  const byId=id=>document.getElementById(id);
  const clone=x=>JSON.parse(JSON.stringify(x));

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
    const formStyle=document.createElement('style');formStyle.textContent='#ogcNewPanel46 .ogwField label{color:#456075!important;font-size:12px}#ogcNewPanel46 .ogwNewHint{color:#64748b!important}#ogcClientCard .ogcStatus{color:#315d78}#ogcClientCard .ogcStatus.err{color:#96373d}#ogcNewPanel46[hidden]{display:none}#ogcCreateClient46{width:100%;margin-top:10px}';document.head.appendChild(formStyle);
  }
  function formCard(){return document.getElementById('client')?.closest('.card')||null}
  function setInput(id,value){const x=document.getElementById(id);if(x)x.value=value||''}
  function clearClientInputs(){setInput('client','');setInput('tel','');setInput('adresse','')}
  function setClientInputs(c){
    setInput('client',c?.label||'');
    setInput('tel',c?.phone||'');
    setInput('adresse',c?.address||([c?.zip,c?.city].filter(Boolean).join(' ')));
  }
  function freshDraft(d={}){return {...d,company:companyName(),reference:d.reference||`CLIENT-${crypto.randomUUID()}`}}
  function readDraft(){
    const d=freshDraft(formDraft||{});
    for(const [suffix,key] of Object.entries(fields)){const node=byId('ogcNew'+suffix);if(node)d[key]=node.disabled&&configCompany!==companyName()&&selectFields.includes(suffix)?String(d[key]||''):node.value.trim();}
    const title=byId('ogcNewTitle');d.title=title?.value?title.selectedOptions?.[0]?.textContent||'':configCompany===companyName()?'':d.title||'';
    d.label=[d.first_name,d.last_name].filter(Boolean).join(' ');return d;
  }
  function updateForm(){
    if(mode!=='new'||!byId('ogcNewCustomerForm'))return;
    formDraft=readDraft();window.acjNotesClientDraft=clone(formDraft);
    setInput('client',formDraft.label);setInput('tel',formDraft.mobile_phone||formDraft.landline);setInput('adresse',[formDraft.address,[formDraft.zip,formDraft.city].filter(Boolean).join(' ')].filter(Boolean).join(', '));
    if(typeof syncClient==='function')syncClient();
    const button=byId('ogcCreateClient46');if(button)button.disabled=creating||!!formDraft.creation_status||configCompany!==companyName()||!window.acjOgustCustomerFieldsV46.complete(formDraft,newConfig)||!byId('ogcConfirmClient46')?.checked;
    if(formDraft.creation_status){byId('ogcNewFields46').querySelectorAll('input,select').forEach(x=>x.disabled=true);byId('ogcConfirmClient46').disabled=true;byId('ogcFormStatus46').textContent=creating?'Création du client dans Ogust…':'Création à vérifier dans Ogust. Recherche le client existant avant toute nouvelle tentative.';}
  }
  function getDraft(){if(mode!=='new')return null;updateForm();return formDraft?clone(formDraft):null}
  function mountForm(d){
    const host=byId('ogcNewFields46');if(!host)return;
    formDraft=freshDraft(d||{});host.innerHTML=window.acjOgustCustomerFieldsV46.render(formDraft,configCompany===companyName()?newConfig:null);
    host.querySelectorAll('.ogwField').forEach(field=>{const input=field.querySelector('input[id],select[id]'),label=field.querySelector('label');if(input&&label)label.htmlFor=input.id});
    host.querySelectorAll('select').forEach(node=>node.disabled=configCompany!==companyName()||node.disabled);
    host.querySelectorAll('input,select').forEach(node=>node.addEventListener('input',()=>{if(byId('ogcConfirmClient46'))byId('ogcConfirmClient46').checked=false;updateForm()}));
    if(byId('ogcConfirmClient46'))byId('ogcConfirmClient46').checked=false;
    if(byId('ogcConfirmClient46'))byId('ogcConfirmClient46').disabled=false;
    updateForm();
  }
  async function loadConfig(){
    if(!byId('ogcNewFields46'))return;
    if(configCompany===companyName()&&newConfig)return;
    const company=companyName(),seq=++configSeq;byId('ogcFormStatus46').textContent='Chargement des choix Ogust…';
    try{
      const r=await fetch(`${CUSTOMER_ENDPOINT}?company=${encodeURIComponent(company)}`,{method:'GET'}),data=await r.json().catch(()=>null);
      if(seq!==configSeq||company!==companyName())return;
      if(!r.ok||!data?.ok||data.mode!=='particulier_only'||!data.config?.titles?.length||!data.config?.payments?.length||!data.config?.managers?.length)throw new Error(data?.detail||'Choix Ogust indisponibles');
      // Read the current fields before applying a late catalogue response.
      const d=mode==='new'?readDraft():formDraft;newConfig=data.config;configCompany=company;
      if(mode==='new'){
        const temp=document.createElement('div');temp.innerHTML=window.acjOgustCustomerFieldsV46.render(d,newConfig);
        for(const suffix of selectFields){const current=byId('ogcNew'+suffix),updated=temp.querySelector('#ogcNew'+suffix);if(current&&updated){current.innerHTML=updated.innerHTML;current.value=updated.value;current.disabled=updated.disabled}}
        updateForm();
      }
      if(!formDraft?.creation_status)byId('ogcFormStatus46').textContent='';byId('ogcRetryConfig46').hidden=true;
    }catch(e){if(seq!==configSeq||company!==companyName())return;byId('ogcFormStatus46').textContent=e?.message||'Choix Ogust indisponibles';byId('ogcRetryConfig46').hidden=false;}
  }
  function markAttempt(ref,company){if(formDraft?.reference!==ref||company!==companyName())return;formDraft.creation_status='pending';window.acjNotesClientDraft=clone(formDraft);updateForm();window.acjDraftV42?.save?.();}
  function bindCreated(data,d,company,quoteRef){
    if(company!==companyName()||quoteRef!==state.number||formDraft?.reference!==d.reference)return false;
    const customer={id_customer:String(data.id_customer),label:d.label,phone:d.mobile_phone||d.landline,email:d.email,address:[d.address,[d.zip,d.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),zip:d.zip,city:d.city};
    selected=customer;results=[];formDraft=null;byId('ogcNewFields46').innerHTML='';window.acjNotesClientDraft=null;window.acjReopenedClientIdV33='';applyMode('existing',false,true);setClientInputs(customer);window.syncClient?.();renderResults();status('Client créé et vérifié dans Ogust.');window.acjDraftV42?.save?.();return true;
  }
  async function createInline(){
    updateForm();const button=byId('ogcCreateClient46'),d=getDraft();
    if(!d||button.disabled||creating||!byId('ogcNewEmail').reportValidity())return;
    const company=companyName(),quoteRef=state.number,context=contextSeq;creating=true;markAttempt(d.reference,company);button.textContent='Création du client…';
    try{const data=await window.acjOgustCustomerFieldsV46.create(d,company);if(context!==contextSeq||!bindCreated(data,d,company,quoteRef))return;byId('ogcFormStatus46').textContent='';}
    catch(e){if(context!==contextSeq||company!==companyName()||quoteRef!==state.number)return;formDraft.creation_status='uncertain';byId('ogcFormStatus46').textContent=`${e?.message||'Réponse Ogust incertaine'}. Vérifie le client dans Ogust avant de réessayer.`;window.acjDraftV42?.save?.();}
    finally{creating=false;button.textContent='Créer le client dans Ogust';updateForm();}
  }
  window.acjClientFormV46={update:updateForm,getDraft,restore(d){if(!d||d.company!==companyName())return false;mountForm(d);loadConfig();return true},markAttempt,bindCreated};
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
  function applyMode(next,clear=true,allowCreating=false){
    if(creating&&!allowCreating)return;
    clearTimeout(timer);requestSeq++;
    mode=next==='new'?'new':'existing';
    document.getElementById('ogcExistingBtn')?.classList.toggle('active',mode==='existing');
    document.getElementById('ogcNewBtn')?.classList.toggle('active',mode==='new');
    const panel=document.getElementById('ogcExistingPanel');if(panel)panel.style.display=mode==='existing'?'block':'none';
    const card=formCard();if(card)card.style.display='none';
    const newPanel=byId('ogcNewPanel46');if(newPanel)newPanel.hidden=mode!=='new';
    if(clear){window.acjNotesClientDraft=null;window.acjReopenedClientIdV33='';selected=null;results=[];clearClientInputs();renderResults()}
    if(mode==='existing')status(searchHint());
    else status('');
    window.ogustClientChoiceV21={mode,get selected(){return selected},get company(){return companyName()}};
    if(mode==='new'){mountForm(formDraft);updateForm();loadConfig();}
  }
  window.applyImportedNotesClientV39=function(client){
    if(creating)return;
    clearTimeout(timer);requestSeq++;applyMode('new');
    const label=[client.first_name,client.last_name].filter(Boolean).join(' ');
    setInput('client',label);setInput('tel',client.mobile_phone||client.landline);setInput('adresse',[client.address,[client.zip,client.city].filter(Boolean).join(' ')].filter(Boolean).join(', '));
    window.acjNotesClientDraft={...client,label,company:companyName()};
    mountForm(window.acjNotesClientDraft);
    if(typeof syncClient==='function')syncClient();
  };
  // Restore an unfinished local quote without searching by a possibly shared name.
  // The server still verifies this ID in the chosen company before any write.
  window.restoreOgustDraftClientV42=function(choice,company){
    if(String(company||'')!==companyName())return false;
    clearTimeout(timer);requestSeq++;results=[];selected=null;
    applyMode(choice?.mode==='new'?'new':'existing',false);
    if(mode==='existing'&&choice?.selected?.id_customer){
      selected={...choice.selected};setClientInputs(selected);
      status('Client mémorisé. Ogust le vérifiera avant la création.');
    }
    renderResults();return true;
  };
  function resetAfterCompanyChange(company){
    contextSeq++;configSeq++;newConfig=null;configCompany='';
    if(mode==='new'){const d=readDraft();formDraft=freshDraft({...d,reference:'',title_value:'',type:'',origin:'',sector:'',method_of_payment:'',manager:'',creation_status:''});mountForm(formDraft);loadConfig();}
    window.acjNotesClientDraft=null;
    window.acjReopenedClientIdV33='';clearTimeout(timer);requestSeq++;selected=null;results=[];
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
      <div id="ogcNewPanel46" hidden><div id="ogcNewFields46"></div><div id="ogcFormStatus46" class="ogcStatus" role="status"></div><button id="ogcRetryConfig46" class="btn" type="button" hidden>Recharger les choix Ogust</button><label class="ogwConfirm"><input id="ogcConfirmClient46" type="checkbox"><span>Je confirme la création de cette fiche dans Ogust.</span></label><button id="ogcCreateClient46" class="btn good" type="button" disabled>Créer le client dans Ogust</button><div class="ogcHint">Tu peux aussi préparer le devis : la fiche sera créée avec le devis après confirmation.</div></div>
      <div class="ogcHint">La recherche utilise automatiquement le compte Ogust de la société choisie. Changer de société efface la sélection pour éviter tout mélange de clients.</div>`;
    companyCard.insertAdjacentElement('afterend',card);
    document.getElementById('ogcExistingBtn').addEventListener('click',()=>applyMode('existing'));
    document.getElementById('ogcNewBtn').addEventListener('click',()=>applyMode('new'));
    byId('ogcConfirmClient46').addEventListener('change',updateForm);
    byId('ogcCreateClient46').addEventListener('click',createInline);
    byId('ogcRetryConfig46').addEventListener('click',loadConfig);
    document.getElementById('ogcSearch').addEventListener('input',e=>{selected=null;clearClientInputs();results=[];renderResults();queueSearch(e.target.value)});
    applyMode('existing',false);

    const originalSetCompany=window.setCompany;
    if(typeof originalSetCompany==='function'&&!window.__acjMultiOgustCompanyV28)window.setCompany=function(n){
      if(creating)return;
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
      if(creating)return;
      contextSeq++;configSeq++;formDraft=null;newConfig=null;configCompany='';byId('ogcNewFields46').innerHTML='';byId('ogcFormStatus46').textContent='';
      const out=originalNewQuote.apply(this,arguments);const q=document.getElementById('ogcSearch');if(q)q.value='';selected=null;results=[];applyMode('existing',false);renderResults();return out;
    };
    const originalPayload=window.quotePayload;
    if(typeof originalPayload==='function')window.quotePayload=function(){const p=originalPayload.apply(this,arguments),d=getDraft();if(d&&p?.client)p.client.fiche=d;return p};
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
