// Devis ACJ v19 — création de devis Ogust en 2 temps : préparation puis confirmation explicite.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-quotation';
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
      .ogwSelect{width:100%;border:1px solid #30435f;background:#081321;color:#f8fafc;border-radius:13px;padding:12px;min-height:46px}.ogwNotice{border:1px solid #854d0e;background:#251a07;color:#fde68a;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.45;margin-top:10px}.ogwGood{border-color:#166534;background:#0b2818;color:#bbf7d0}.ogwError{border-color:#7f1d1d;background:#2b1115;color:#fecaca}
      .ogwConfirm{display:flex;gap:9px;align-items:flex-start;border:1px solid #36506a;border-radius:13px;padding:10px 11px;margin-top:13px;font-size:11px;line-height:1.4}.ogwConfirm input{width:auto;min-height:0;margin-top:2px}
      .ogwActions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.ogwActions .btn{width:100%}.ogwActions .wide{grid-column:1/-1}.ogwBusy{font-size:11px;color:#bae6fd;text-align:center;margin-top:10px}.ogwId{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
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

  function selectedCustomer(){return document.querySelector('input[name="ogwCustomer"]:checked')?.value||''}
  function selectedCompany(){return document.getElementById('ogwCompany')?.value||''}
  function refreshConfirm(){
    const btn=document.getElementById('ogwCreateBtn');if(!btn)return;
    const checked=!!document.getElementById('ogwConfirmCheck')?.checked;
    btn.disabled=!(checked&&selectedCustomer()&&selectedCompany());
  }
  window.refreshOgustConfirm=refreshConfirm;

  function renderCustomerChoices(candidates){
    if(!candidates?.length)return `<div class="ogwNotice ogwError">Aucun client correspondant n’a été retrouvé dans Ogust. Ferme cette fenêtre et vérifie le nom ou le téléphone du client avant de réessayer.</div>`;
    return candidates.map((c,i)=>{
      const meta=[c.code?`Code ${c.code}`:'',c.phone||'',c.city||''].filter(Boolean).join(' · ');
      return `<label class="ogwChoice"><input type="radio" name="ogwCustomer" value="${htmlEsc(c.id_customer)}" ${candidates.length===1||i===0?'checked':''} onchange="refreshOgustConfirm()"><strong>${htmlEsc(c.label||`Client ${c.id_customer}`)}</strong>${meta?`<div class="ogwMeta">${htmlEsc(meta)}</div>`:''}</label>`;
    }).join('');
  }

  function renderCompanyChoices(data){
    const choices=data.company_choices||[],suggested=String(data.suggested_company_id||'');
    if(!choices.length)return `<div class="ogwNotice ogwError">Aucun établissement Ogust n’a pu être lu. La création est bloquée pour éviter d’enregistrer le devis dans la mauvaise société.</div>`;
    return `<select id="ogwCompany" class="ogwSelect" onchange="refreshOgustConfirm()"><option value="">Choisir l’établissement Ogust</option>${choices.map(c=>`<option value="${htmlEsc(c.id_company)}" ${String(c.id_company)===suggested?'selected':''}>${htmlEsc(c.label)}</option>`).join('')}</select>`;
  }

  function openPrepareModal(data,quote){
    removeModal();session={data,quote};
    const p=data.preview||{};
    const draft=data.draft?.supported
      ?`Création demandée en <strong>${htmlEsc(data.draft.label||'brouillon')}</strong>.`
      :'Ogust n’a pas exposé clairement la valeur « brouillon » : le statut par défaut Ogust sera utilisé et relu après création.';
    const overlay=document.createElement('div');overlay.id='ogwOverlay';overlay.className='ogwOverlay';
    overlay.innerHTML=`<div class="ogwModal" role="dialog" aria-modal="true" aria-label="Création du devis dans Ogust">
      <div class="ogwHead"><div><div class="ogwTitle">Préparer dans Ogust</div><div class="ogwSub">Rien n’est créé tant que tu n’appuies pas sur « Valider et créer dans Ogust ».</div></div><button class="ogwClose" type="button" onclick="closeOgustWriteModal()">×</button></div>
      <div class="ogwPreview"><div class="ogwPreviewRow"><span>Référence ACJ</span><strong>${htmlEsc(p.numero_devis||'')}</strong></div><div class="ogwPreviewRow"><span>Société demandée</span><strong>${htmlEsc(p.societe||'')}</strong></div><div class="ogwPreviewRow"><span>Client saisi</span><strong>${htmlEsc(p.client?.nom||'')}</strong></div><div class="ogwPreviewRow"><span>Lignes</span><strong>${Number(p.line_count)||0}</strong></div><div class="ogwPreviewRow ogwTotal"><span>Total TTC</span><strong>${fmt(p.total_ttc)}</strong></div></div>
      <div class="ogwSection"><div class="ogwSectionTitle">1. Client Ogust</div>${renderCustomerChoices(data.customer_candidates||[])}</div>
      <div class="ogwSection"><div class="ogwSectionTitle">2. Établissement Ogust</div>${renderCompanyChoices(data)}</div>
      <div class="ogwNotice">${draft}</div>
      <label class="ogwConfirm"><input id="ogwConfirmCheck" type="checkbox" onchange="refreshOgustConfirm()"><span>Je confirme que le client, l’établissement et le montant ci-dessus sont corrects. Cette validation va <strong>créer réellement un devis dans Ogust</strong>.</span></label>
      <div id="ogwResult"></div>
      <div class="ogwActions"><button class="btn" type="button" onclick="closeOgustWriteModal()">Annuler</button><button id="ogwCreateBtn" class="btn good" type="button" onclick="confirmOgustWrite()" disabled>Valider et créer dans Ogust</button></div>
    </div>`;
    document.body.appendChild(overlay);refreshConfirm();
  }

  function resultBox(message,type='info'){
    const box=document.getElementById('ogwResult');if(!box)return;
    box.className=`ogwNotice ${type==='ok'?'ogwGood':type==='err'?'ogwError':''}`;
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
      openPrepareModal(data,quote);
      if(typeof showStatus==='function')showStatus('finalStatus','Préparation prête. Vérifie puis confirme la création.','info');
    }catch(error){
      if(typeof showStatus==='function')showStatus('finalStatus',`Ogust : ${error?.message||'préparation impossible'}. Aucun devis n’a été créé.`,'err');
    }
  }

  window.confirmOgustWrite=async function(){
    if(!session)return;
    const customer=selectedCustomer(),company=selectedCompany(),check=document.getElementById('ogwConfirmCheck');
    if(!customer||!company||!check?.checked)return;
    const btn=document.getElementById('ogwCreateBtn');if(btn){btn.disabled=true;btn.textContent='Création dans Ogust…'}
    resultBox('Création du brouillon puis relecture de contrôle…');
    try{
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',confirm:true,id_customer:customer,id_company:company,quote:session.quote})});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok){
        if(data?.orphan_quotation_id){
          throw new Error(`Une création partielle est possible. Vérifie immédiatement le devis Ogust ID ${data.orphan_quotation_id}.`);
        }
        const extra=data?.rolled_back?' La création incomplète a été annulée automatiquement.':'';
        throw new Error(`${data?.detail||data?.error||'Création refusée.'}${extra}`);
      }
      if(data.already_exists){
        resultBox(`Ce devis semble déjà exister dans Ogust. ID : <span class="ogwId">${htmlEsc(data.id_quotation)}</span>. Aucune copie supplémentaire n’a été créée.`,'ok');
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis déjà présent dans Ogust — ID ${data.id_quotation}.`,'ok');
        if(btn){btn.textContent='Déjà présent';btn.disabled=true}return;
      }
      const id=htmlEsc(data.id_quotation||''),number=htmlEsc(data.ogust_number||'');
      if(data.verified){
        resultBox(`Devis créé et relu dans Ogust. ID : <span class="ogwId">${id}</span>${number?` · N° ${number}`:''}. Le client et le total ont été vérifiés.`,'ok');
        if(typeof saveQuote==='function')saveQuote();
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis créé dans Ogust et vérifié — ID ${data.id_quotation}.`,'ok');
        if(btn){btn.textContent='Créé dans Ogust';btn.disabled=true}
      }else{
        resultBox(`Le devis a été créé dans Ogust (ID <span class="ogwId">${id}</span>), mais la relecture automatique n’a pas confirmé tous les contrôles. Vérifie-le dans Ogust avant toute validation ou envoi au client.`,'err');
        if(typeof showStatus==='function')showStatus('finalStatus',`Devis créé dans Ogust — contrôle automatique incomplet. ID ${data.id_quotation}.`,'err');
        if(btn){btn.textContent='Créé — à vérifier';btn.disabled=true}
      }
    }catch(error){
      resultBox(htmlEsc(error?.message||'Création Ogust impossible.'),'err');
      if(typeof showStatus==='function')showStatus('finalStatus',`Ogust : ${error?.message||'création impossible'}`,'err');
      if(btn){btn.disabled=false;btn.textContent='Réessayer la création'}
    }
  };

  window.sendToOgust=prepare;
  addStyles();
  const oldButton=[...document.querySelectorAll('.finalActions .btn.good')].find(b=>/ogust/i.test(b.textContent||''));
  if(oldButton)oldButton.textContent='Créer dans Ogust';
})();
