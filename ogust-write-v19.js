// Devis ACJ v20 — client Ogust existant ou création confirmée d’un nouveau particulier, puis devis.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-quotation';
  const CUSTOMER_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';
  const NEW_CUSTOMER='__NEW__';
  let session=null;
  let customerBusy=false;
  let prepareGeneration=0;
  const COMPANY_PREFERENCE='acj_ogust_company_choice_v1';

  function addStyles(){
    if(document.getElementById('ogust-write-v19-style'))return;
    const s=document.createElement('style');
    s.id='ogust-write-v19-style';
    s.textContent=`
      .ogwOverlay{position:fixed;inset:0;z-index:1000;background:rgba(2,8,18,.82);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:12px}
      .ogwModal{width:min(680px,100%);max-height:92vh;overflow:auto;background:#0b1728;border:1px solid #31516d;border-radius:22px 22px 16px 16px;box-shadow:0 30px 80px rgba(0,0,0,.55);padding:17px;color:#f8fafc}
      .ogwHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:13px}.ogwTitle{font-size:19px;font-weight:900}.ogwSub{font-size:11px;color:#9fb3c8;line-height:1.45;margin-top:4px}.ogwClose{border:1px solid #36506a;background:#101d30;color:#fff;border-radius:11px;width:40px;height:40px;font-size:20px}
      .ogwPreview{border:1px solid #23445d;background:#071522;border-radius:14px;padding:12px;margin-bottom:12px}.ogwPreviewRow{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:4px 0}.ogwPreviewRow strong{font-weight:850}.ogwTotal{font-size:16px;border-top:1px solid #29445a;margin-top:5px;padding-top:9px}
      .ogwSection{margin-top:13px}.ogwSectionTitle{font-size:12px;font-weight:850;color:#dbeafe;margin-bottom:8px}.ogwChoice{display:block;border:1px solid #2f4963;background:#091522;border-radius:13px;padding:10px 11px;margin-bottom:7px}.ogwChoice:has(input:checked){border-color:#38bdf8;background:rgba(14,165,233,.12)}.ogwChoice input{width:auto;min-height:0;margin-right:8px;vertical-align:middle}.ogwChoice strong{font-size:12px}.ogwMeta{font-size:10px;color:#94a3b8;margin:4px 0 0 23px}
      .ogwSelect{width:100%;border:1px solid #30435f;background:#081321;color:#f8fafc;border-radius:13px;padding:12px;min-height:46px}.ogwNotice{border:1px solid #854d0e;background:#251a07;color:#fde68a;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.45;margin-top:10px}.ogwGood{border-color:#166534;background:#0b2818;color:#bbf7d0}.ogwError{border-color:#7f1d1d;background:#2b1115;color:#fecaca}.ogwInfo{border-color:#155e75;background:#0b2030;color:#bae6fd}
      .ogwNewCard{border:1px solid #31516d;background:#081522;border-radius:15px;padding:12px}.ogwFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ogwField.full{grid-column:1/-1}.ogwField label{display:block;font-size:10px;color:#a9bad0;margin:0 0 5px;font-weight:800}.ogwField input,.ogwField select{width:100%;border:1px solid #30435f;background:#071321;color:#f8fafc;border-radius:11px;padding:10px 11px;min-height:42px;outline:none}.ogwField input:focus,.ogwField select:focus{border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.11)}.ogwRequired{color:#7dd3fc}.ogwNewHint{font-size:10px;color:#94a3b8;line-height:1.45;margin-top:9px}
      .ogwConfirm{display:flex;gap:9px;align-items:flex-start;border:1px solid #36506a;border-radius:13px;padding:10px 11px;margin-top:13px;font-size:11px;line-height:1.4}.ogwConfirm input{width:auto;min-height:0;margin-top:2px}
      .ogwActions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.ogwActions .btn{width:100%}.ogwActions .wide{grid-column:1/-1}.ogwBusy{font-size:11px;color:#bae6fd;text-align:center;margin-top:10px}.ogwId{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      @media(max-width:520px){.ogwFormGrid{grid-template-columns:1fr}.ogwField.full{grid-column:auto}}
      @media(min-width:700px){.ogwOverlay{align-items:center}.ogwModal{border-radius:22px}}
    `;
    document.head.appendChild(s);
  }

  function htmlEsc(v){
    if(typeof esc==='function')return esc(v);
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function quotationError(data){
    const line=data?.line?` (ligne ${data.line})`:'';
    const messages={QUOTATION_PRODUCT_REQUIRED:'Prestation Ogust manquante'+line+'. Aucun devis créé.',QUOTATION_RATE_NOT_FOUND:'Aucun tarif Ogust actif compatible avec la prestation, l’unité et la TVA'+line+'. Aucun devis créé.',QUOTATION_RATE_AMBIGUOUS:'Plusieurs tarifs Ogust correspondent'+line+'. Le choix doit être précisé avant l’envoi. Aucun devis créé.',QUOTATION_RATES_INCOMPLETE:'Le catalogue des tarifs Ogust n’a pas pu être lu entièrement. Aucun devis créé.'};
    return messages[data?.error]||data?.detail||data?.error||'Création du devis refusée.';
  }
  function fmt(v){return typeof money==='function'?money(v):`${Number(v||0).toFixed(2)} €`}
  function currentQuote(){return typeof quotePayload==='function'?quotePayload():null}
  function currentCompany(){return typeof window.currentOgustCompanyV28==='function'?String(window.currentOgustCompanyV28()):String(currentQuote()?.societe||'ACJ Services')}
  function clientIdFor(quote,company){
    const choice=window.ogustClientChoiceV21;
    if(choice?.selected?.id_customer&&String(choice.company||'')===company)return String(choice.selected.id_customer);
    if(choice?.mode==='new')return '';
    const reopened=window.acjReopenedQuoteV33;
    if(reopened&&String(reopened.societe||'')===company&&String(reopened.numero_devis||'')===String(quote?.numero_devis||''))return String(reopened.id_customer||window.acjReopenedClientIdV33||'');
    return '';
  }
  function sessionCurrent(active){return session===active&&currentCompany()===active.company&&String(currentQuote()?.numero_devis||'')===String(active.quote?.numero_devis||'')}
  function quoteUnchanged(active){return !active.fingerprint||active.fingerprint===JSON.stringify(currentQuote())}
  function companyPreference(company){try{return String(JSON.parse(localStorage.getItem(COMPANY_PREFERENCE)||'{}')[company]||'')}catch{return ''}}
  function saveCompanyPreference(company,id){try{const map=JSON.parse(localStorage.getItem(COMPANY_PREFERENCE)||'{}');map[company]=id;localStorage.setItem(COMPANY_PREFERENCE,JSON.stringify(map))}catch{}}

  function removeModal(){if(customerBusy)return;document.getElementById('ogwOverlay')?.remove();session=null;prepareGeneration++}
  window.closeOgustWriteModal=removeModal;

  function isNewCustomerMode(){return !!document.getElementById('ogwNewCustomerForm')}
  function selectedCustomer(){
    if(session?.createdCustomerId)return session.createdCustomerId;
    if(isNewCustomerMode())return NEW_CUSTOMER;
    if(session?.fixedCustomer)return session.fixedCustomer;
    return document.querySelector('input[name="ogwCustomer"]:checked')?.value||'';
  }
  function selectedCompany(){return document.getElementById('ogwCompany')?.value||''}
  function value(id){return document.getElementById(id)?.value?.trim()||''}

  function newCustomerComplete(){
    if(!isNewCustomerMode())return false;
    return !!(value('ogwNewTitle')&&value('ogwNewLastName')&&value('ogwNewAddress')&&value('ogwNewZip')&&value('ogwNewCity')&&value('ogwNewPayment')&&value('ogwNewManager')&&(!document.getElementById('ogwNewOrigin')||value('ogwNewOrigin'))&&(!document.getElementById('ogwNewType')||document.getElementById('ogwNewType').disabled||value('ogwNewType')));
  }

  function newCustomerPayload(){
    return {
      title:value('ogwNewTitle'),
      last_name:value('ogwNewLastName'),
      first_name:value('ogwNewFirstName'),
      mobile_phone:value('ogwNewPhone'),
      landline:value('ogwNewLandline'),
      type:value('ogwNewType'),
      origin:value('ogwNewOrigin'),
      sector:value('ogwNewSector'),
      email:value('ogwNewEmail'),
      method_of_payment:value('ogwNewPayment'),
      manager:value('ogwNewManager'),
      address:{line:value('ogwNewAddress'),zip:value('ogwNewZip'),city:value('ogwNewCity')},
      external_ref:session?.quote?.numero_devis||''
    };
  }

  function refreshConfirm(){
    const btn=document.getElementById('ogwCreateBtn');if(!btn)return;
    const checked=session?.fixedCustomer&&!session.requiresCheckbox||!!document.getElementById('ogwConfirmCheck')?.checked;
    const customerOk=isNewCustomerMode()?newCustomerComplete():!!selectedCustomer();
    btn.disabled=!(checked&&customerOk&&(session?.customerOnly||selectedCompany())&&!customerBusy&&!session?.created&&!session?.stopAfterCustomer&&(session?.customerOnly||sessionCurrent(session)&&quoteUnchanged(session)));
  }
  window.refreshOgustConfirm=refreshConfirm;

  function options(entries,placeholder,selectedLabel=''){
    const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
    return `<option value="">${htmlEsc(placeholder)}</option>${(entries||[]).map(x=>`<option value="${htmlEsc(x.value)}" ${selectedLabel&&norm(x.label)===norm(selectedLabel)?'selected':''}>${htmlEsc(x.label)}</option>`).join('')}`;
  }

  function renderNewCustomer(quote,config){
    if(!config?.titles?.length||!config?.payments?.length||!config?.managers?.length){
      return `<div class="ogwNotice ogwError">Aucun client correspondant n’a été trouvé et la configuration nécessaire à une création sûre n’a pas pu être lue. Aucun client ne sera créé.</div>`;
    }
    let q=quote?.client||{};
    const d=window.acjNotesClientDraft;
    const company=typeof window.currentOgustCompanyV28==='function'?window.currentOgustCompanyV28():'ACJ Services';
    if(d&&d.company===company&&d.label===q.nom)q={...q,nom:d.last_name,first_name:d.first_name,telephone:d.mobile_phone,email:d.email,landline:d.landline,adresse:d.address,zip:d.zip,city:d.city,title:d.title};
    return `<div id="ogwNewCustomerForm" class="ogwNewCard">
      <div class="ogwNotice ogwInfo" style="margin-top:0">Tu peux créer ici un <strong>nouveau client particulier</strong> dans Ogust. Vérifie chaque champ. Le mode de paiement et le gestionnaire restent à choisir.</div>
      <div class="ogwFormGrid" style="margin-top:11px">
        <div class="ogwField"><label>Civilité <span class="ogwRequired">*</span></label><select id="ogwNewTitle" onchange="refreshOgustConfirm()">${options(config.titles,'Choisir',q.title)}</select></div>
        <div class="ogwField"><label>Nom <span class="ogwRequired">*</span></label><input id="ogwNewLastName" value="${htmlEsc(q.nom||'')}" oninput="refreshOgustConfirm()" placeholder="Nom"></div>
        <div class="ogwField"><label>Prénom</label><input id="ogwNewFirstName" value="${htmlEsc(q.first_name||'')}" oninput="refreshOgustConfirm()" placeholder="Prénom"></div>
        <div class="ogwField"><label>Téléphone mobile</label><input id="ogwNewPhone" value="${htmlEsc(q.telephone||'')}" oninput="refreshOgustConfirm()" type="tel" autocomplete="tel" placeholder="Téléphone mobile"></div>
        <div class="ogwField"><label>Téléphone fixe</label><input id="ogwNewLandline" value="${htmlEsc(q.landline||'')}" type="tel" oninput="refreshOgustConfirm()" placeholder="Téléphone fixe (facultatif)"></div>
        <div class="ogwField full"><label>Email</label><input id="ogwNewEmail" type="email" value="${htmlEsc(q.email||'')}" oninput="refreshOgustConfirm()" placeholder="Email (facultatif)"></div>
        <div class="ogwField full"><label>Adresse d’intervention / principale <span class="ogwRequired">*</span></label><input id="ogwNewAddress" value="${htmlEsc(q.adresse||'')}" oninput="refreshOgustConfirm()" placeholder="N° et rue"></div>
        <div class="ogwField"><label>Code postal <span class="ogwRequired">*</span></label><input id="ogwNewZip" inputmode="numeric" value="${htmlEsc(q.zip||'')}" oninput="refreshOgustConfirm()" placeholder="Code postal"></div>
        <div class="ogwField"><label>Ville <span class="ogwRequired">*</span></label><input id="ogwNewCity" value="${htmlEsc(q.city||'')}" oninput="refreshOgustConfirm()" placeholder="Ville"></div>
        <div class="ogwField"><label>Catégorie</label><input value="Particulier (B2C)" disabled></div>
        <div class="ogwField"><label>Type de fiche${config.types?.length?' <span class="ogwRequired">*</span>':''}</label><select id="ogwNewType" onchange="refreshOgustConfirm()" ${config.types?.length?'':'disabled'}>${options(config.types,config.types?.length?'Prospect ou client':'Valeur par défaut Ogust')}</select></div>
        <div class="ogwField"><label>Origine du contact <span class="ogwRequired">*</span></label><select id="ogwNewOrigin" onchange="refreshOgustConfirm()">${options(config.origins?.length?config.origins:[{value:config.origin_other,label:'Autre'}],'Choisir l’origine')}</select></div>
        <div class="ogwField"><label>Secteur</label><select id="ogwNewSector" onchange="refreshOgustConfirm()" ${config.sectors?.length?'':'disabled'}>${options(config.sectors,config.sectors?.length?'Non renseigné':'Liste indisponible dans Ogust')}</select></div>
        <div class="ogwField"><label>Mode de paiement <span class="ogwRequired">*</span></label><select id="ogwNewPayment" onchange="refreshOgustConfirm()">${options(config.payments,'Choisir le paiement')}</select></div>
        <div class="ogwField"><label>Gestionnaire <span class="ogwRequired">*</span></label><select id="ogwNewManager" onchange="refreshOgustConfirm()">${options(config.managers,'Choisir le gestionnaire')}</select></div>
      </div>
      <div class="ogwNewHint">Les listes proviennent du compte Ogust de la société choisie. L’adresse principale sera enregistrée en France. Si le nom saisi ci-dessus contient aussi le prénom, corrige les champs Nom / Prénom avant de confirmer.</div>
    </div>`;
  }

  function renderCustomerChoices(candidates,quote,config){
    if(!candidates?.length)return renderNewCustomer(quote,config);
    return candidates.map((c,i)=>{
      const meta=[c.code?`Code ${c.code}`:'',c.phone||'',c.city||''].filter(Boolean).join(' · ');
      return `<label class="ogwChoice"><input type="radio" name="ogwCustomer" value="${htmlEsc(c.id_customer)}" ${candidates.length===1||i===0?'checked':''} onchange="refreshOgustConfirm()"><strong>${htmlEsc(c.label||`Client ${c.id_customer}`)}</strong>${meta?`<div class="ogwMeta">${htmlEsc(meta)}</div>`:''}</label>`;
    }).join('');
  }

  function renderFixedCustomer(customer){
    const meta=[customer?.code?`Code ${customer.code}`:'',customer?.phone||'',customer?.city||''].filter(Boolean).join(' · ');
    return `<div class="ogwPreview"><strong>${htmlEsc(customer?.label||'Client sélectionné')}</strong>${meta?`<div class="ogwSub">${htmlEsc(meta)}</div>`:''}<button class="ogcChange" type="button" onclick="changeOgustWriteClient()">Changer de client</button></div>`;
  }
  window.changeOgustWriteClient=function(){if(customerBusy)return;removeModal();if(typeof window.goStep==='function')window.goStep(1);document.getElementById('ogcExistingBtn')?.click();document.getElementById('ogcSearch')?.focus()};

  function renderCompanyChoices(data,company){
    const choices=data.company_choices||[],preferred=companyPreference(company),suggested=String(data.suggested_company_id||'');
    if(!choices.length)return `<div class="ogwNotice ogwError">Aucun établissement Ogust n’a pu être lu. La création est bloquée pour éviter d’enregistrerer le devis dans la mauvaise société.</div>`;
    const picked=choices.find(c=>String(c.id_company)===preferred)||choices.find(c=>String(c.id_company)===suggested)||(choices.length===1?choices[0]:null);
    if(choices.length===1)return `<div class="ogwPreview"><strong>${htmlEsc(choices[0].label)}</strong><input id="ogwCompany" type="hidden" value="${htmlEsc(choices[0].id_company)}"></div>`;
    return `<select id="ogwCompany" class="ogwSelect" onchange="refreshOgustConfirm()"><option value="">Choisir l’établissement Ogust</option>${choices.map(c=>`<option value="${htmlEsc(c.id_company)}" ${String(c.id_company)===String(picked?.id_company||'')?'selected':''}>${htmlEsc(c.label)}</option>`).join('')}</select>`;
  }

  function openPrepareModal(data,quote,company,fixedCustomer){
    removeModal();session={data,quote,company,fixedCustomer,requiresCheckbox:!fixedCustomer,fingerprint:JSON.stringify(quote)};
    const p=data.preview||{};
    const isNew=!(data.customer_candidates||[]).length;
    const canCreateNew=!isNew||!!data.new_customer_config;
    const draft=data.draft?.supported
      ?`Création demandée en <strong>${htmlEsc(data.draft.label||'brouillon')}</strong>.`
      :'Ogust n’a pas exposé clairement la valeur « brouillon » : le statut par défaut Ogust sera utilisé et relu après création.';
    const confirmText=isNew
      ?'Je confirme les informations du nouveau client particulier, l’établissement et le montant. Cette validation va <strong>créer réellement le client puis le devis dans Ogust</strong>.'
      :'Je confirme que le client, l’établissement et le montant ci-dessus sont corrects. Cette validation va <strong>créer réellement un devis dans Ogust</strong>.';
    const overlay=document.createElement('div');overlay.id='ogwOverlay';overlay.className='ogwOverlay';
    overlay.innerHTML=`<div class="ogwModal" role="dialog" aria-modal="true" aria-label="Création du devis dans Ogust">
      <div class="ogwHead"><div><div class="ogwTitle">Créer le devis dans Ogust</div><div class="ogwSub">Vérifie le résumé. Le bouton ci-dessous confirme la création du brouillon.</div></div><button class="ogwClose" type="button" onclick="closeOgustWriteModal()">×</button></div>
      <div class="ogwPreview"><div class="ogwPreviewRow"><span>Référence ACJ</span><strong>${htmlEsc(p.numero_devis||'')}</strong></div><div class="ogwPreviewRow"><span>Société demandée</span><strong>${htmlEsc(p.societe||'')}</strong></div><div class="ogwPreviewRow"><span>Client saisi</span><strong>${htmlEsc(p.client?.nom||'')}</strong></div><div class="ogwPreviewRow"><span>Lignes</span><strong>${Number(p.line_count)||0}</strong></div><div class="ogwPreviewRow ogwTotal"><span>Total TTC</span><strong>${fmt(p.total_ttc)}</strong></div></div>
      <div class="ogwSection"><div class="ogwSectionTitle">Client Ogust</div>${fixedCustomer?renderFixedCustomer(data.customer_candidates[0]):renderCustomerChoices(data.customer_candidates||[],quote,data.new_customer_config)}</div>
      <div class="ogwSection"><div class="ogwSectionTitle">Établissement Ogust</div>${renderCompanyChoices(data,company)}</div>
      <div class="ogwNotice">${draft}</div>
      ${canCreateNew&&!fixedCustomer?`<label class="ogwConfirm"><input id="ogwConfirmCheck" type="checkbox" onchange="refreshOgustConfirm()"><span>${confirmText}</span></label>`:''}
      <div id="ogwResult"></div>
      <div class="ogwActions"><button class="btn" type="button" onclick="closeOgustWriteModal()">Annuler</button>${canCreateNew?'<button id="ogwCreateBtn" class="btn good" type="button" onclick="confirmOgustWrite()" disabled>Créer le devis dans Ogust</button>':''}</div>
    </div>`;
    document.body.appendChild(overlay);refreshConfirm();
  }

  function resultBox(message,type='info'){
    const box=document.getElementById('ogwResult');if(!box)return;
    box.className=`ogwNotice ${type==='ok'?'ogwGood':type==='err'?'ogwError':'ogwInfo'}`;
    box.innerHTML=message;
  }

  async function prepare(){
    if(customerBusy)return;
    const quote=currentQuote();
    if(!quote||!quote.client?.nom||!quote.lignes?.length){
      if(typeof showStatus==='function')showStatus('finalStatus','Client ou prestation manquante.','err');return;
    }
    const company=currentCompany(),idCustomer=clientIdFor(quote,company),seq=++prepareGeneration,fingerprint=JSON.stringify(quote);
    if(String(quote.societe||'')!==company){if(typeof showStatus==='function')showStatus('finalStatus','La société du devis a changé. Vérifie le client avant l’envoi.','err');return}
    if(typeof showStatus==='function')showStatus('finalStatus',idCustomer?'Préparation Ogust : vérification du client choisi…':'Préparation Ogust : recherche du client et de l’établissement…','info');
    try{
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',company,id_customer:idCustomer||undefined,quote})});
      const data=await response.json().catch(()=>null);
      if(seq!==prepareGeneration||company!==currentCompany()||fingerprint!==JSON.stringify(currentQuote()))return;
      if(!response.ok||!data?.ok)throw new Error(data?.error==='CUSTOMER_NOT_FOUND'?'Le client choisi ne peut pas être relu dans Ogust. Retourne à l’étape Client.':data?.error==='COMPANY_SELECTION_MISMATCH'?'La société et le client doivent être vérifiés à l’étape Client.':data?.detail||data?.error||'Préparation Ogust impossible');
      const fixedCustomer=idCustomer&&data.customer_locked===true&&String(data.selected_customer_id||'')===idCustomer&&data.customer_candidates?.length===1&&String(data.customer_candidates[0].id_customer)===idCustomer?idCustomer:'';
      if(idCustomer&&!fixedCustomer)throw new Error('Le client choisi n’a pas pu être confirmé. Retourne à l’étape Client.');
      if(!(data.customer_candidates||[]).length){
        try{
          const cr=await fetch(`${CUSTOMER_ENDPOINT}?company=${encodeURIComponent(company)}`,{method:'GET'});
          const cd=await cr.json().catch(()=>null);
          if(cr.ok&&cd?.ok&&cd?.mode==='particulier_only')data.new_customer_config=cd.config||null;
        }catch(e){}
      }
      if(seq!==prepareGeneration||company!==currentCompany()||fingerprint!==JSON.stringify(currentQuote()))return;
      openPrepareModal(data,quote,company,fixedCustomer);
      if(typeof showStatus==='function')showStatus('finalStatus','Préparation prête. Vérifie puis confirme la création.','info');
    }catch(error){
      if(seq!==prepareGeneration||company!==currentCompany())return;
      if(typeof showStatus==='function')showStatus('finalStatus',`Ogust : ${error?.message||'préparation impossible'}. Aucun devis n’a été créé.`,'err');
    }
  }

  window.openOgustCustomerCreate=async function(onCreated){
    if(customerBusy)throw new Error('Une création Ogust est déjà en cours.');
    const company=typeof window.currentOgustCompanyV28==='function'?window.currentOgustCompanyV28():'ACJ Services';
    const response=await fetch(`${CUSTOMER_ENDPOINT}?company=${encodeURIComponent(company)}`,{method:'GET'});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok||data.mode!=='particulier_only')throw new Error(data?.detail||data?.error||'Configuration client indisponible');
    if((typeof window.currentOgustCompanyV28==='function'?window.currentOgustCompanyV28():company)!==company)return;
    removeModal();
    session={customerOnly:true,company,onCreated,quote:{client:{nom:document.getElementById('client')?.value||'',telephone:document.getElementById('tel')?.value||'',adresse:document.getElementById('adresse')?.value||''},numero_devis:`CLIENT-${crypto.randomUUID()}`}};
    const overlay=document.createElement('div');overlay.id='ogwOverlay';overlay.className='ogwOverlay';
    overlay.innerHTML=`<div class="ogwModal" role="dialog" aria-modal="true" aria-label="Nouveau client Ogust"><div class="ogwHead"><div><div class="ogwTitle">Nouveau client Ogust</div><div class="ogwSub">${htmlEsc(company)} · Création du client uniquement.</div></div><button class="ogwClose" type="button" onclick="closeOgustWriteModal()">×</button></div>${renderNewCustomer(session.quote,data.config)}<label class="ogwConfirm"><input id="ogwConfirmCheck" type="checkbox" onchange="refreshOgustConfirm()"><span>Je confirme la création de ce client dans ${htmlEsc(company)}.</span></label><div id="ogwResult"></div><div class="ogwActions"><button class="btn" type="button" onclick="closeOgustWriteModal()">Annuler</button><button id="ogwCreateBtn" class="btn good" type="button" onclick="confirmOgustCustomerOnly()" disabled>Créer le client dans Ogust</button></div></div>`;
    document.body.appendChild(overlay);refreshConfirm();
  };

  window.confirmOgustCustomerOnly=async function(){
    if(!session?.customerOnly||session.attempted||customerBusy||!newCustomerComplete()||!document.getElementById('ogwConfirmCheck')?.checked)return;
    const email=document.getElementById('ogwNewEmail');
    if(email&&!email.reportValidity())return;
    const active=session, payload=newCustomerPayload(),btn=document.getElementById('ogwCreateBtn');
    active.attempted=true;customerBusy=true;btn.disabled=true;
    try{
      const data=await createNewCustomer(btn);
      const customer={id_customer:String(data.id_customer),label:[payload.first_name,payload.last_name].filter(Boolean).join(' '),phone:payload.mobile_phone||payload.landline,address:[payload.address.line,`${payload.address.zip} ${payload.address.city}`].join(', '),zip:payload.address.zip,city:payload.address.city};
      active.onCreated?.(customer,active.company);
      resultBox(`Client ${htmlEsc(customer.label)} créé et vérifié dans Ogust. ID : ${htmlEsc(customer.id_customer)}.`,'ok');
      btn.textContent='Client créé';
      document.getElementById('ogwNewCustomerForm')?.querySelectorAll('input,select').forEach(x=>x.disabled=true);
      const check=document.getElementById('ogwConfirmCheck');check.disabled=true;check.checked=false;
    }catch(error){
      resultBox(htmlEsc(error?.message||'Création impossible'),'err');
      // Une réponse incertaine ne doit jamais déclencher une seconde création.
      btn.textContent='Vérifier dans Ogust';
      document.getElementById('ogwConfirmCheck').disabled=true;
    }finally{customerBusy=false;btn.disabled=true}
  };

  async function createNewCustomer(btn){
    const payload=newCustomerPayload();
    if(btn)btn.textContent='Création du client…';
    resultBox('Création du nouveau client particulier puis relecture de contrôle…');
    const response=await fetch(CUSTOMER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',confirm:true,company:session?.company||undefined,customer:payload})});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.detail||data?.error||'Création du client refusée.');
    if(!data.id_customer)throw new Error('Client créé sans identifiant exploitable. Vérifie Ogust avant de réessayer.');
    if(!data.verified){
      const e=new Error(`Le client a été créé dans Ogust (ID ${data.id_customer}), mais la relecture automatique n’a pas confirmé ses données. Vérifie ce client dans Ogust avant de créer le devis.`);
      e.customerCreatedId=data.id_customer;e.stopAfterCustomer=true;throw e;
    }
    return data;
  }

  window.confirmOgustWrite=async function(){
    if(!session||session.created||session.stopAfterCustomer||customerBusy||!sessionCurrent(session)||!quoteUnchanged(session))return;
    let customer=selectedCustomer();
    const company=selectedCompany(),check=document.getElementById('ogwConfirmCheck');
    if(!customer||!company||(session.requiresCheckbox&&!check?.checked))return;
    const newMode=customer===NEW_CUSTOMER;
    if(newMode&&!newCustomerComplete())return;
    if(newMode&&document.getElementById('ogwNewEmail')&&!document.getElementById('ogwNewEmail').reportValidity())return;
    const active=session;
    customerBusy=true;saveCompanyPreference(active.company,company);
    const btn=document.getElementById('ogwCreateBtn');if(btn){btn.disabled=true;btn.textContent=newMode?'Création du client…':'Création dans Ogust…'}
    let createdCustomerId='';
    try{
      if(newMode){
        active.customerAttempted=true;
        const customerData=await createNewCustomer(btn);
        customer=customerData.id_customer;createdCustomerId=customer;
        active.createdCustomerId=String(customer);
        document.getElementById('ogwNewCustomerForm')?.querySelectorAll('input,select').forEach(x=>x.disabled=true);
        if(!sessionCurrent(active))return;
        resultBox(`Client créé et vérifié dans Ogust (ID <span class="ogwId">${htmlEsc(customer)}</span>). Création du devis…`,'info');
        if(btn)btn.textContent='Création du devis…';
      }else{
        resultBox('Création du brouillon puis relecture de contrôle…');
      }

      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',confirm:true,company:active.company,id_customer:customer,id_company:company,quote:active.quote})});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok){
        if(data?.orphan_quotation_id)throw new Error(`Une création partielle est possible. Vérifie immédiatement le devis Ogust ID ${data.orphan_quotation_id}.`);
        const extra=data?.rolled_back?' La création incomplète a été annulée automatiquement.':'';
        throw new Error(`${quotationError(data)}${extra}`);
      }
      active.created=true;
      if(!sessionCurrent(active))return;
      if(data.already_exists){
        const prefix=createdCustomerId?`Le client a été créé et vérifié. `:'';
        resultBox(`${prefix}Ce devis semble déjà exister dans Ogust. ID : <span class="ogwId">${htmlEsc(data.id_quotation)}</span>. Aucune copie supplémentaire n’a été créée.`,'ok');
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis déjà présent dans Ogust — ID ${data.id_quotation}.`,'ok');
        if(btn){btn.textContent='Déjà présent';btn.disabled=true}return;
      }
      const id=htmlEsc(data.id_quotation||''),number=htmlEsc(data.ogust_number||'');
      if(data.verified){
        const prefix=createdCustomerId?`Nouveau client créé et vérifié (ID <span class="ogwId">${htmlEsc(createdCustomerId)}</span>). `:'';
        resultBox(`${prefix}Devis créé et relu dans Ogust. ID : <span class="ogwId">${id}</span>${number?` · N° ${number}`:''}. Le client et le total ont été vérifiés.`,'ok');
        if(typeof saveQuote==='function')saveQuote();
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis créé dans Ogust et vérifié — ID ${data.id_quotation}.`,'ok');
        if(btn){btn.textContent='Créé dans Ogust';btn.disabled=true}
      }else{
        const prefix=createdCustomerId?`Le nouveau client a bien été créé (ID ${htmlEsc(createdCustomerId)}). `:'';
        resultBox(`${prefix}Le devis a été créé dans Ogust (ID <span class="ogwId">${id}</span>), mais la relecture automatique n’a pas confirmé tous les contrôles. Vérifie-le dans Ogust avant toute validation ou envoi au client. Le rattachement de la prestation et du tarif doit aussi être contrôlé.`,'err');
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis créé dans Ogust — contrôle automatique incomplet. ID ${data.id_quotation}.`,'err');
        if(btn){btn.textContent='Créé — à vérifier';btn.disabled=true}
      }
    }catch(error){
      if(error?.stopAfterCustomer||active.customerAttempted&&!active.createdCustomerId)active.stopAfterCustomer=true;
      if(!sessionCurrent(active))return;
      const customerNote=createdCustomerId&&!error?.stopAfterCustomer?` Le client Ogust ID ${createdCustomerId} a déjà été créé : ne le recrée pas manuellement.`:'';
      resultBox(`${htmlEsc(error?.message||'Création Ogust impossible.')}${htmlEsc(customerNote)}`,'err');
      if(typeof showStatus==='function')showStatus('finalStatus',`Ogust : ${error?.message||'création impossible'}`,'err');
      if(btn){
        if(active.stopAfterCustomer){btn.disabled=true;btn.textContent=error?.stopAfterCustomer?'Client créé — à vérifier':'Vérifier la création dans Ogust'}
        else{btn.disabled=false;btn.textContent=createdCustomerId?'Réessayer le devis':'Réessayer la création'}
      }
    }finally{
      customerBusy=false;
      if(sessionCurrent(active))refreshConfirm();
      else if(session===active)removeModal();
    }
  };

  window.addEventListener('acj:company-changed',()=>{prepareGeneration++;if(!customerBusy)removeModal()});
  window.addEventListener('acj:quotation-created',()=>{prepareGeneration++;if(!customerBusy)removeModal()});

  window.sendToOgust=prepare;
  addStyles();
  const oldButton=[...document.querySelectorAll('.finalActions .btn.good')].find(b=>/ogust/i.test(b.textContent||''));
  if(oldButton)oldButton.textContent='Créer dans Ogust';
})();
