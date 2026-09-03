// Devis ACJ v20 — client Ogust existant ou création confirmée d’un nouveau particulier, puis devis.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-quotation';
  const CUSTOMER_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';
  const NEW_CUSTOMER='__NEW__';
  let session=null;

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
  function fmt(v){return typeof money==='function'?money(v):`${Number(v||0).toFixed(2)} €`}
  function currentQuote(){return typeof quotePayload==='function'?quotePayload():null}

  function removeModal(){document.getElementById('ogwOverlay')?.remove();session=null}
  window.closeOgustWriteModal=removeModal;

  function isNewCustomerMode(){return !!document.getElementById('ogwNewCustomerForm')}
  function selectedCustomer(){
    if(isNewCustomerMode())return NEW_CUSTOMER;
    return document.querySelector('input[name="ogwCustomer"]:checked')?.value||'';
  }
  function selectedCompany(){return document.getElementById('ogwCompany')?.value||''}
  function value(id){return document.getElementById(id)?.value?.trim()||''}

  function newCustomerComplete(){
    if(!isNewCustomerMode())return false;
    return !!(value('ogwNewTitle')&&value('ogwNewLastName')&&value('ogwNewAddress')&&value('ogwNewZip')&&value('ogwNewCity')&&value('ogwNewPayment')&&value('ogwNewManager'));
  }

  function newCustomerPayload(){
    return {
      title:value('ogwNewTitle'),
      last_name:value('ogwNewLastName'),
      first_name:value('ogwNewFirstName'),
      mobile_phone:value('ogwNewPhone'),
      email:value('ogwNewEmail'),
      method_of_payment:value('ogwNewPayment'),
      manager:value('ogwNewManager'),
      address:{line:value('ogwNewAddress'),zip:value('ogwNewZip'),city:value('ogwNewCity')},
      external_ref:session?.quote?.numero_devis||''
    };
  }

  function refreshConfirm(){
    const btn=document.getElementById('ogwCreateBtn');if(!btn)return;
    const checked=!!document.getElementById('ogwConfirmCheck')?.checked;
    const customerOk=isNewCustomerMode()?newCustomerComplete():!!selectedCustomer();
    btn.disabled=!(checked&&customerOk&&selectedCompany());
  }
  window.refreshOgustConfirm=refreshConfirm;

  function options(entries,placeholder){
    return `<option value="">${htmlEsc(placeholder)}</option>${(entries||[]).map(x=>`<option value="${htmlEsc(x.value)}">${htmlEsc(x.label)}</option>`).join('')}`;
  }

  function renderNewCustomer(quote,config){
    if(!config?.titles?.length||!config?.payments?.length||!config?.managers?.length){
      return `<div class="ogwNotice ogwError">Aucun client correspondant n’a été trouvé et la configuration nécessaire à une création sûre n’a pas pu être lue. Aucun client ne sera créé.</div>`;
    }
    const q=quote?.client||{};
    return `<div id="ogwNewCustomerForm" class="ogwNewCard">
      <div class="ogwNotice ogwInfo" style="margin-top:0">Aucun client existant correspondant. Tu peux créer ici un <strong>nouveau client particulier</strong> dans Ogust. Vérifie chaque champ : aucune civilité, aucun paiement et aucun gestionnaire ne sont choisis automatiquement.</div>
      <div class="ogwFormGrid" style="margin-top:11px">
        <div class="ogwField"><label>Civilité <span class="ogwRequired">*</span></label><select id="ogwNewTitle" onchange="refreshOgustConfirm()">${options(config.titles,'Choisir')}</select></div>
        <div class="ogwField"><label>Nom <span class="ogwRequired">*</span></label><input id="ogwNewLastName" value="${htmlEsc(q.nom||'')}" oninput="refreshOgustConfirm()" placeholder="Nom"></div>
        <div class="ogwField"><label>Prénom</label><input id="ogwNewFirstName" value="" oninput="refreshOgustConfirm()" placeholder="Prénom"></div>
        <div class="ogwField"><label>Téléphone</label><input id="ogwNewPhone" value="${htmlEsc(q.telephone||'')}" oninput="refreshOgustConfirm()" placeholder="Téléphone"></div>
        <div class="ogwField full"><label>Email</label><input id="ogwNewEmail" type="email" value="" oninput="refreshOgustConfirm()" placeholder="Email (facultatif)"></div>
        <div class="ogwField full"><label>Adresse d’intervention / principale <span class="ogwRequired">*</span></label><input id="ogwNewAddress" value="${htmlEsc(q.adresse||'')}" oninput="refreshOgustConfirm()" placeholder="N° et rue"></div>
        <div class="ogwField"><label>Code postal <span class="ogwRequired">*</span></label><input id="ogwNewZip" inputmode="numeric" value="" oninput="refreshOgustConfirm()" placeholder="Code postal"></div>
        <div class="ogwField"><label>Ville <span class="ogwRequired">*</span></label><input id="ogwNewCity" value="" oninput="refreshOgustConfirm()" placeholder="Ville"></div>
        <div class="ogwField"><label>Mode de paiement <span class="ogwRequired">*</span></label><select id="ogwNewPayment" onchange="refreshOgustConfirm()">${options(config.payments,'Choisir le paiement')}</select></div>
        <div class="ogwField"><label>Gestionnaire <span class="ogwRequired">*</span></label><select id="ogwNewManager" onchange="refreshOgustConfirm()">${options(config.managers,'Choisir le gestionnaire')}</select></div>
      </div>
      <div class="ogwNewHint">Ogust enregistrera automatiquement l’origine « Autre », une adresse principale et le pays France. Si le nom saisi ci-dessus contient aussi le prénom, corrige les champs Nom / Prénom avant de confirmer.</div>
    </div>`;
  }

  function renderCustomerChoices(candidates,quote,config){
    if(!candidates?.length)return renderNewCustomer(quote,config);
    return candidates.map((c,i)=>{
      const meta=[c.code?`Code ${c.code}`:'',c.phone||'',c.city||''].filter(Boolean).join(' · ');
      return `<label class="ogwChoice"><input type="radio" name="ogwCustomer" value="${htmlEsc(c.id_customer)}" ${candidates.length===1||i===0?'checked':''} onchange="refreshOgustConfirm()"><strong>${htmlEsc(c.label||`Client ${c.id_customer}`)}</strong>${meta?`<div class="ogwMeta">${htmlEsc(meta)}</div>`:''}</label>`;
    }).join('');
  }

  function renderCompanyChoices(data){
    const choices=data.company_choices||[],suggested=String(data.suggested_company_id||'');
    if(!choices.length)return `<div class="ogwNotice ogwError">Aucun établissement Ogust n’a pu être lu. La création est bloquée pour éviter d’enregistrerer le devis dans la mauvaise société.</div>`;
    return `<select id="ogwCompany" class="ogwSelect" onchange="refreshOgustConfirm()"><option value="">Choisir l’établissement Ogust</option>${choices.map(c=>`<option value="${htmlEsc(c.id_company)}" ${String(c.id_company)===suggested?'selected':''}>${htmlEsc(c.label)}</option>`).join('')}</select>`;
  }

  function openPrepareModal(data,quote){
    removeModal();session={data,quote};
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
      <div class="ogwHead"><div><div class="ogwTitle">Préparer dans Ogust</div><div class="ogwSub">Rien n’est créé tant que tu n’appuies pas sur « Valider et créer dans Ogust ».</div></div><button class="ogwClose" type="button" onclick="closeOgustWriteModal()">×</button></div>
      <div class="ogwPreview"><div class="ogwPreviewRow"><span>Référence ACJ</span><strong>${htmlEsc(p.numero_devis||'')}</strong></div><div class="ogwPreviewRow"><span>Société demandée</span><strong>${htmlEsc(p.societe||'')}</strong></div><div class="ogwPreviewRow"><span>Client saisi</span><strong>${htmlEsc(p.client?.nom||'')}</strong></div><div class="ogwPreviewRow"><span>Lignes</span><strong>${Number(p.line_count)||0}</strong></div><div class="ogwPreviewRow ogwTotal"><span>Total TTC</span><strong>${fmt(p.total_ttc)}</strong></div></div>
      <div class="ogwSection"><div class="ogwSectionTitle">1. Client Ogust</div>${renderCustomerChoices(data.customer_candidates||[],quote,data.new_customer_config)}</div>
      <div class="ogwSection"><div class="ogwSectionTitle">2. Établissement Ogust</div>${renderCompanyChoices(data)}</div>
      <div class="ogwNotice">${draft}</div>
      ${canCreateNew?`<label class="ogwConfirm"><input id="ogwConfirmCheck" type="checkbox" onchange="refreshOgustConfirm()"><span>${confirmText}</span></label>`:''}
      <div id="ogwResult"></div>
      <div class="ogwActions"><button class="btn" type="button" onclick="closeOgustWriteModal()">Annuler</button>${canCreateNew?'<button id="ogwCreateBtn" class="btn good" type="button" onclick="confirmOgustWrite()" disabled>Valider et créer dans Ogust</button>':''}</div>
    </div>`;
    document.body.appendChild(overlay);refreshConfirm();
  }

  function resultBox(message,type='info'){
    const box=document.getElementById('ogwResult');if(!box)return;
    box.className=`ogwNotice ${type==='ok'?'ogwGood':type==='err'?'ogwError':'ogwInfo'}`;
    box.innerHTML=message;
  }

  async function prepare(){
    const quote=currentQuote();
    if(!quote||!quote.client?.nom||!quote.lignes?.length){
      if(typeof showStatus==='function')showStatus('finalStatus','Client ou prestation manquante.','err');return;
    }
    if(typeof showStatus==='function')showStatus('finalStatus','Préparation Ogust : recherche du client et de l’établissement…','info');
    try{
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',quote})});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok)throw new Error(data?.detail||data?.error||'Préparation Ogust impossible');
      if(!(data.customer_candidates||[]).length){
        try{
          const cr=await fetch(CUSTOMER_ENDPOINT,{method:'GET'});
          const cd=await cr.json().catch(()=>null);
          if(cr.ok&&cd?.ok&&cd?.mode==='particulier_only')data.new_customer_config=cd.config||null;
        }catch(e){}
      }
      openPrepareModal(data,quote);
      if(typeof showStatus==='function')showStatus('finalStatus','Préparation prête. Vérifie puis confirme la création.','info');
    }catch(error){
      if(typeof showStatus==='function')showStatus('finalStatus',`Ogust : ${error?.message||'préparation impossible'}. Aucun devis n’a été créé.`,'err');
    }
  }

  async function createNewCustomer(btn){
    const payload=newCustomerPayload();
    if(btn)btn.textContent='Création du client…';
    resultBox('Création du nouveau client particulier puis relecture de contrôle…');
    const response=await fetch(CUSTOMER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',confirm:true,customer:payload})});
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
    if(!session)return;
    let customer=selectedCustomer();
    const company=selectedCompany(),check=document.getElementById('ogwConfirmCheck');
    if(!customer||!company||!check?.checked)return;
    const newMode=customer===NEW_CUSTOMER;
    const btn=document.getElementById('ogwCreateBtn');if(btn){btn.disabled=true;btn.textContent=newMode?'Création du client…':'Création dans Ogust…'}
    let createdCustomerId='';
    try{
      if(newMode){
        const customerData=await createNewCustomer(btn);
        customer=customerData.id_customer;createdCustomerId=customer;
        resultBox(`Client créé et vérifié dans Ogust (ID <span class="ogwId">${htmlEsc(customer)}</span>). Création du devis…`,'info');
        if(btn)btn.textContent='Création du devis…';
      }else{
        resultBox('Création du brouillon puis relecture de contrôle…');
      }

      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',confirm:true,id_customer:customer,id_company:company,quote:session.quote})});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok){
        if(data?.orphan_quotation_id)throw new Error(`Une création partielle est possible. Vérifie immédiatement le devis Ogust ID ${data.orphan_quotation_id}.`);
        const extra=data?.rolled_back?' La création incomplète a été annulée automatiquement.':'';
        throw new Error(`${data?.detail||data?.error||'Création du devis refusée.'}${extra}`);
      }
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
        resultBox(`${prefix}Le devis a été créé dans Ogust (ID <span class="ogwId">${id}</span>), mais la relecture automatique n’a pas confirmé tous les contrôles. Vérifie-le dans Ogust avant toute validation ou envoi au client.`,'err');
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis créé dans Ogust — contrôle automatique incomplet. ID ${data.id_quotation}.`,'err');
        if(btn){btn.textContent='Créé — à vérifier';btn.disabled=true}
      }
    }catch(error){
      const customerNote=createdCustomerId&&!error?.stopAfterCustomer?` Le client Ogust ID ${createdCustomerId} a déjà été créé : ne le recrée pas manuellement.`:'';
      resultBox(`${htmlEsc(error?.message||'Création Ogust impossible.')}${htmlEsc(customerNote)}`,'err');
      if(typeof showStatus==='function')showStatus('finalStatus',`Ogust : ${error?.message||'création impossible'}`,'err');
      if(btn){
        if(error?.stopAfterCustomer){btn.disabled=true;btn.textContent='Client créé — à vérifier'}
        else{btn.disabled=false;btn.textContent=createdCustomerId?'Réessayer le devis':'Réessayer la création'}
      }
    }
  };

  window.sendToOgust=prepare;
  addStyles();
  const oldButton=[...document.querySelectorAll('.finalActions .btn.good')].find(b=>/ogust/i.test(b.textContent||''));
  if(oldButton)oldButton.textContent='Créer dans Ogust';
})();
