// Devis ACJ v34 — mise à jour sûre d'un devis Ogust déjà créé par l'application.
(function(){
  if(window.__acjQuotationUpdateV34)return;
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-quotation';
  const META_KEY='acj_devis_history_meta_v29';
  const LOCKED=new Set(['C','V','T','S']);
  const LABELS={B:'Brouillon',C:'Accepté',E:'Envoyé',T:'Terminé',V:'Validé',S:'Supprimé'};

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function readMeta(){try{const x=JSON.parse(localStorage.getItem(META_KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return{}}}
  function writeMeta(x){try{localStorage.setItem(META_KEY,JSON.stringify(x))}catch{}}
  function keyFor(company,ref){return `${String(company||'')}|${String(ref||'')}`}
  function currentContext(){
    const reopened=window.acjReopenedQuoteV33;
    if(!reopened?.numero_devis||reopened.societe!==state.company||reopened.numero_devis!==state.number)return null;
    const company=String(reopened.societe||state?.company||''),ref=String(reopened.numero_devis||state?.number||'');
    const meta=readMeta()[keyFor(company,ref)]||{};
    return{reopened,company,ref,meta,id:String(meta.ogust_id||'')};
  }
  function patchMeta(company,ref,patch){const all=readMeta(),k=keyFor(company,ref);all[k]={...(all[k]||{}),...patch,updated_at:new Date().toISOString()};writeMeta(all)}
  const clone=value=>JSON.parse(JSON.stringify(value));
  const unitCode=value=>{const u=String(value||'').toLowerCase();return u==='h'||u.includes('heure')?'H':u==='km'?'K':u==='forfait'?'F':'Q'};
  function sameService(line,saved){return String(line.designation||'').trim()===String(saved.designation||'').trim()&&Math.abs(Number(line.vat)-Number(saved.tva_rate))<.001&&unitCode(line.unit)===(saved.ogust_unit||unitCode(saved.unite))}
  function existingLine(line){
    const ctx=currentContext();if(!ctx?.id||!ctx.meta.ogust_snapshot)return null;
    const matches=(ctx.meta.ogust_snapshot.lignes||[]).filter(saved=>sameService(line,saved)&&(!line.ogustRateId||line.ogustRateId===saved.ogust_rate_id)&&(!line.ogustProductLevelId||line.ogustProductLevelId===saved.ogust_product_level_id));
    return matches.length===1?matches[0]:null;
  }
  function needsRecovery(ctx){return !!ctx?.id&&(!ctx.meta.ogust_snapshot||!ctx.reopened.id_customer||!ctx.meta.ogust_status||['OK','KO'].includes(String(ctx.meta.ogust_status).toUpperCase())||(!ctx.meta.ogust_recovered_v66&&((!LABELS[String(ctx.meta.ogust_status).toUpperCase()]&&!ctx.meta.ogust_status_verified_v66)||(ctx.meta.ogust_snapshot.lignes||[]).some(l=>!l.ogust_product_level_id||!l.ogust_rate_id))))}
  function fillAssociations(payload,remote){
    const copy=clone(payload);copy.client={...(copy.client||{}),id_customer:remote.client.id_customer};
    for(const line of copy.lignes||[]){const matches=remote.lignes.filter(r=>sameService({designation:line.designation,vat:line.tva_rate,unit:line.unite},r));if(matches.length!==1)continue;const r=matches[0];for(const field of ['ogust_rate_id','ogust_product_level_id','ogust_unit'])if(!line[field]&&r[field])line[field]=r[field]}
    return copy;
  }
  async function recoverCurrent(){
    const ctx=currentContext();if(!ctx?.id)return '';
    if(ctx.reopened.recoveryPromise)return ctx.reopened.recoveryPromise;
    if(!needsRecovery(ctx))return ctx.reopened.id_customer||'';
    const active=()=>window.acjReopenedQuoteV33===ctx.reopened&&state.company===ctx.company&&state.number===ctx.ref;
    const run=(async()=>{
      ctx.reopened.recovering=true;ctx.reopened.recoveryError='';render();result('Récupération de l’ancien devis dans Ogust…');
      try{
        const local=clone(window.quotePayload());
        const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover_legacy',company:ctx.company,id_quotation:ctx.id,local_quote:local})});
        const data=await response.json().catch(()=>null),remote=data?.recovered;
        if(!response.ok||!data?.ok||String(remote?.id_quotation||'')!==ctx.id||!remote.id_customer||remote.snapshot?.societe!==ctx.company||remote.snapshot?.numero_devis!==ctx.ref||String(remote.snapshot?.client?.id_customer||'')!==String(remote.id_customer))throw Error(data?.error||'LEGACY_RECOVERY_FAILED');
        if(!active())return '';
        const baseline=ctx.meta.ogust_snapshot?fillAssociations(ctx.meta.ogust_snapshot,remote.snapshot):remote.snapshot;
        patchMeta(ctx.company,ctx.ref,{ogust_number:remote.ogust_number||ctx.meta.ogust_number||'',ogust_status:remote.ogust_status,ogust_status_label:remote.ogust_status_label,ogust_snapshot:clone(baseline),ogust_recovered_v66:true,ogust_status_verified_v66:true});
        ctx.reopened.snapshot=clone(baseline);ctx.reopened.id_customer=String(remote.id_customer);window.acjReopenedClientIdV33=String(remote.id_customer);
        const customer={id_customer:String(remote.id_customer),label:state.client,phone:state.tel,address:state.address,email:document.getElementById('email')?.value||local.client?.email||''};
        window.restoreOgustDraftClientV42?.({mode:'existing',selected:customer},ctx.company);
        const enriched=fillAssociations(window.quotePayload(),remote.snapshot);
        enriched.lignes.forEach((l,i)=>{const source=state.lines[i];if(!source)return;if(!source.ogustRateId&&l.ogust_rate_id)source.ogustRateId=l.ogust_rate_id;if(!source.ogustProductLevelId&&l.ogust_product_level_id){source.ogustProductLevelId=l.ogust_product_level_id;source.ogustProductCompany=ctx.company}});
        try{const saved=JSON.parse(localStorage.getItem('acj_devis_saved_v6')||'[]');for(const p of saved)if(p.societe===ctx.company&&p.numero_devis===ctx.ref)p.client={...(p.client||{}),id_customer:String(remote.id_customer)};localStorage.setItem('acj_devis_saved_v6',JSON.stringify(saved))}catch{}
        window.renderQuoteLines?.();window.acjDraftV42?.save?.();
        return String(remote.id_customer);
      }catch(error){if(active())ctx.reopened.recoveryError=statusMessage(error?.message);throw error}
      finally{ctx.reopened.recovering=false;ctx.reopened.recoveryPromise=null;if(active()){render();if(ctx.reopened.recoveryError)result(ctx.reopened.recoveryError,'err');else result('Ancien devis retrouvé dans Ogust. Tes modifications locales sont conservées.','ok')}}
    })();ctx.reopened.recoveryPromise=run;return run;
  }
  function statusMessage(code,data){
    if(code==='LEGACY_QUOTE_UNSUPPORTED'||code==='QUOTATION_REFERENCE_MISMATCH')return 'Le contenu de cet ancien devis doit être vérifié directement dans Ogust. Aucun devis n’a été modifié.';
    if(code==='LEGACY_RECOVERY_FAILED')return 'Impossible de récupérer cet ancien devis. Réessaie « Enregistrer dans Ogust ».';
    if(code==='QUOTATION_PRODUCT_REQUIRED')return 'Prestation Ogust manquante. Le devis existant reste inchangé.';
    if(code==='QUOTATION_RATE_NOT_FOUND')return 'Aucun tarif Ogust actif compatible avec la prestation, l’unité et la TVA. Le devis existant reste inchangé.';
    if(code==='QUOTATION_RATE_AMBIGUOUS')return 'Plusieurs tarifs Ogust correspondent. Le devis existant reste inchangé.';
    if(code==='QUOTATION_RATES_INCOMPLETE')return 'Catalogue des tarifs incomplet. Le devis existant reste inchangé.';
    if(code==='REMOTE_QUOTE_CHANGED')return 'Le devis a été modifié dans Ogust depuis la copie locale. Rien n’a été écrasé.';
    if(code==='CUSTOMER_MISMATCH')return 'Le client du devis Ogust ne correspond plus au client sélectionné. Mise à jour bloquée.';
    if(code==='REMOTE_STATUS_LOCKED'||code==='REMOTE_STATUS_NOT_EDITABLE')return data?.remote_verified===true?`Ogust indique « ${data.ogust_status_label||LABELS[data.ogust_status]||data.ogust_status} ». Ce devis ne peut pas être modifié depuis l’application.`:'Ce devis n’est plus dans un état modifiable en sécurité dans Ogust.';
    if(code==='QUOTATION_HEADER_UNREADABLE'||code==='QUOTATION_ID_MISMATCH')return 'Le devis exact n’a pas pu être vérifié dans la réponse Ogust. Rien n’a été modifié.';
    if(code==='REMOTE_STATUS_UNREADABLE')return 'Le statut Ogust n’a pas pu être vérifié. Mise à jour bloquée.';
    if(code==='OGUST_UPDATE_FAILED')return 'Ogust a refusé la mise à jour.';
    return 'La mise à jour du devis dans Ogust n’a pas abouti.';
  }
  function addStyles(){
    if(document.getElementById('quote-update-v34-style'))return;
    const s=document.createElement('style');s.id='quote-update-v34-style';s.textContent=`
      .qu34{border:1px solid #b8d7ea;background:#f6fbfe;border-radius:16px;padding:13px 14px;margin:0 0 14px;color:#234861}.qu34Head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.qu34Title{font-size:14px;font-weight:900;color:#173d58}.qu34Meta{font-size:10px;line-height:1.45;color:#5b7486;margin-top:4px}.qu34Badge{display:inline-flex;border:1px solid #bdd9e8;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:850;background:#fff;color:#35617a}.qu34Actions{display:grid;grid-template-columns:1fr;margin-top:11px}.qu34 .btn{width:100%}.qu34Result{display:none;margin-top:10px;border-radius:11px;padding:9px 10px;font-size:10px;line-height:1.45}.qu34Result.show{display:block}.qu34Result.ok{border:1px solid #86c79b;background:#eefaf2;color:#245d36}.qu34Result.err{border:1px solid #e1a5aa;background:#fff2f3;color:#7b3038}.qu34Result.info{border:1px solid #b8d7ea;background:#eef8fd;color:#29516b}`;document.head.appendChild(s)
  }
  function render(){
    const step=document.querySelector('.step[data-step="4"]');if(!step)return;
    step.querySelector('#quoteUpdateV34')?.remove();
    document.getElementById('reviewStatus64')?.remove();document.getElementById('quoteUpdateResultV34')?.remove();
    restoreCreateButton();renderDelivery(step);
    const ctx=currentContext();if(!ctx?.id)return;
    const status=String(ctx.meta.ogust_status||'').toUpperCase(),label=ctx.meta.ogust_status_label||LABELS[status]||'Statut à revérifier';
    const blocked=ctx.reopened.recovering||ctx.reopened.updating||LOCKED.has(status)||(!!status&&!['B','E'].includes(status)&&!needsRecovery(ctx));
    const card=document.createElement('div');card.id='quoteUpdateV34';card.className='qu34';
    card.innerHTML=`<div class="qu34Head"><div class="qu34Meta">${esc(ctx.meta.ogust_number?`Devis n° ${ctx.meta.ogust_number}`:ctx.ref)} · ${esc(label)}</div></div><div class="qu34Actions"><button id="quoteUpdateBtnV34" class="btn good" type="button" ${blocked?'disabled':''}>${ctx.reopened.recovering?'Vérification…':ctx.reopened.updating?'Enregistrement…':blocked?'Modification bloquée':'Enregistrer dans Ogust'}</button></div><div id="quoteUpdateResultV34" class="qu34Result" role="status"></div>`;
    const footer=document.getElementById('reviewActions53'),primary=document.getElementById('reviewPrimary64');if(primary){primary.prepend(card);const head=card.querySelector('.qu34Head');head.id='reviewStatus64';primary.insertAdjacentElement('beforebegin',head);primary.insertAdjacentElement('afterend',card.querySelector('#quoteUpdateResultV34'))}else if(footer)footer.insertBefore(card,footer.querySelector('.finalActions'));else step.prepend(card);
    card.querySelector('#quoteUpdateBtnV34')?.addEventListener('click',updateNow);
    const createBtn=[...document.querySelectorAll('.finalActions .btn.good')].find(b=>/créer dans ogust/i.test(b.textContent||''));
    if(createBtn){createBtn.style.display='none';createBtn.dataset.hiddenByV34='1'}
  }
  function renderDelivery(step){
    if(window.acjEmailDelivery62){window.acjEmailDelivery62.render(step);return}
    document.getElementById('ogustDelivery59')?.remove();
    const meta=readMeta()[keyFor(state.company,state.number)]||{};if(!meta.ogust_id)return;
    if(meta.ogust_number)window.applyOgustQuotationNumber?.(meta.ogust_number,meta.ogust_id);
    const fingerprint=q=>JSON.stringify({client:q?.client?.id_customer||'',notes:q?.notes||'',lines:(q?.lignes||[]).map(l=>[l.designation,l.detail||'',Number(l.quantite),l.unite,Number(l.prix_unitaire_ttc),Number(l.tva_rate),l.ogust_rate_id||'',l.ogust_product_level_id||''])});
    const baseline=meta.ogust_snapshot||currentContext()?.reopened?.snapshot;
    const pending=!!baseline&&fingerprint(window.quotePayload?.())!==fingerprint(baseline),locked=LOCKED.has(String(meta.ogust_status||'').toUpperCase());
    const card=document.createElement('div');card.id='ogustDelivery59';card.className='card';
    const title=document.createElement('div');title.className='cardTitle';title.textContent='Envoi au client';
    const info=document.createElement('p');info.className='ogustDeliveryInfo59';info.textContent=`${state.company} · ${meta.ogust_number?`Devis n° ${meta.ogust_number}`:state.number}. ${pending?'Les modifications locales ne sont pas encore enregistrées dans Ogust.':'Retrouve ce devis dans Ogust pour l’envoyer par e-mail avec ton modèle habituel.'}`;
    const actions=document.createElement('div');actions.className='ogustDeliveryActions59';
    const link=document.createElement(pending&&!locked?'button':'a');link.className='btn';link.textContent=pending&&locked?'Consulter dans Ogust':'Ouvrir Ogust pour envoyer';
    if(pending&&!locked){link.type='button';link.disabled=true;info.textContent+=' Enregistre-les avant d’envoyer la nouvelle version.'}else{link.href='https://my.ogust.app/';link.target='_blank';link.rel='noopener noreferrer'}
    const copy=document.createElement('button');copy.type='button';copy.className='btn';copy.textContent='Copier le numéro';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(meta.ogust_number||state.number));copy.textContent='Numéro copié'}catch{copy.textContent=String(meta.ogust_number||state.number)}});
    actions.append(link,copy);card.append(title,info,actions);const footer=document.getElementById('reviewActions53');if(footer)footer.insertAdjacentElement('beforebegin',card);else step.appendChild(card);
  }
  function result(text,type='info'){const box=document.getElementById('quoteUpdateResultV34');if(!box)return;box.className=`qu34Result show ${type}`;box.textContent=text}
  function persistLatest(p){
    try{if(typeof window.saveQuote==='function')window.saveQuote()}catch{}
    if(window.acjReopenedQuoteV33){window.acjReopenedQuoteV33.snapshot=JSON.parse(JSON.stringify(p));window.acjReopenedQuoteV33.id_customer=String(p?.client?.id_customer||window.acjReopenedClientIdV33||'')}
  }
  async function updateNow(){
    if(window.acjValidateAIForOgust&&!window.acjValidateAIForOgust())return;
    const ctx=currentContext();if(!ctx?.id)return result('Identifiant Ogust introuvable pour ce devis.','err');
    if(ctx.reopened.updating)return;ctx.reopened.updating=true;
    const button=document.getElementById('quoteUpdateBtnV34');if(button)button.disabled=true;
    result('Vérification du devis Ogust avant mise à jour…','info');
    try{
      if(needsRecovery(ctx))await recoverCurrent();
      if(window.acjReopenedQuoteV33!==ctx.reopened||state.company!==ctx.company||state.number!==ctx.ref)return;
      const quote=typeof window.quotePayload==='function'?window.quotePayload():null;
      const original=ctx.reopened?.snapshot;if(!quote||!original)throw new Error('LOCAL_SNAPSHOT_MISSING');
      const idCustomer=String(window.ogustClientChoiceV21?.selected?.id_customer||window.acjReopenedClientIdV33||quote?.client?.id_customer||'');
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',company:ctx.company,id_quotation:ctx.id,id_customer:idCustomer,quote,original_quote:original})});
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data?.ok){
        const remoteCode=String(data?.ogust_status||'').toUpperCase(),verified=data?.remote_verified===true&&String(data.id_quotation||'')===ctx.id&&/^[A-Z0-9_-]{1,20}$/.test(remoteCode)&&!['OK','KO'].includes(remoteCode);
        if(verified)patchMeta(ctx.company,ctx.ref,{ogust_status:remoteCode,ogust_status_label:LABELS[remoteCode]||String(data.ogust_status_label||remoteCode).slice(0,100),ogust_status_verified_v66:true});
        if(state.company!==ctx.company||state.number!==ctx.ref)return;
        if(verified)render();
        if(data?.rollback_restored===false)result('Échec de mise à jour et restauration incomplète. Vérifie ce devis directement dans Ogust avant toute autre action.','err');
        else if(data?.error==='OGUST_UPDATE_FAILED'&&data?.rollback_restored===true)result('La mise à jour a échoué, mais l’ancien devis a été restauré dans Ogust.','err');
        else result(statusMessage(data?.error,data), 'err');
        return;
      }
      patchMeta(ctx.company,ctx.ref,{ogust_id:ctx.id,ogust_number:String(data.ogust_number||ctx.meta.ogust_number||''),ogust_status:String(data.ogust_status||ctx.meta.ogust_status||''),ogust_status_label:String(data.ogust_status_label||ctx.meta.ogust_status_label||''),ogust_snapshot:JSON.parse(JSON.stringify(quote))});
      if(state.company!==ctx.company||state.number!==ctx.ref)return;
      persistLatest(quote);renderDelivery(document.querySelector('.step[data-step="4"]'));
      result(`Devis ${data.ogust_number?`n° ${data.ogust_number} `:''}mis à jour dans Ogust sans doublon.${String(data.ogust_status||'').toUpperCase()==='E'?' Il avait déjà été envoyé : il faudra renvoyer la nouvelle version au client.':''}`,'ok');
      const notice=document.querySelector('.histReopenNoticeV33');if(notice)notice.innerHTML='<strong>Devis rouvert et synchronisé.</strong> Les modifications enregistrées ici correspondent maintenant au même devis dans Ogust.';
      window.dispatchEvent(new CustomEvent('acj:quotation-updated-v34',{detail:data}));
    }catch(error){if(state.company===ctx.company&&state.number===ctx.ref)result(ctx.reopened.recoveryError||(error?.message==='LOCAL_SNAPSHOT_MISSING'?'La copie locale d’origine est introuvable. Mise à jour bloquée pour éviter d’écraser Ogust.':'Erreur de connexion pendant la mise à jour.'),'err')}
    finally{ctx.reopened.updating=false;if(window.acjReopenedQuoteV33===ctx.reopened&&state.company===ctx.company&&state.number===ctx.ref){const b=document.getElementById('quoteUpdateBtnV34'),fresh=currentContext(),status=String(fresh?.meta.ogust_status||'').toUpperCase(),blocked=LOCKED.has(status)||(!!status&&!['B','E'].includes(status)&&!needsRecovery(fresh));if(b){b.disabled=blocked;b.textContent=blocked?'Modification bloquée':'Enregistrer dans Ogust'}}}
  }
  function restoreCreateButton(){const b=document.querySelector('[data-hidden-by-v34="1"]');if(b){b.style.display='';delete b.dataset.hiddenByV34}}
  function onReopen(){restoreCreateButton();render()}
  function onNewQuote(){window.acjReopenedQuoteV33=null;window.acjReopenedClientIdV33='';for(const id of ['quoteUpdateV34','quoteUpdateResultV34','reviewStatus64','ogustDelivery59'])document.getElementById(id)?.remove();restoreCreateButton()}
  addStyles();window.addEventListener('acj:quote-reopened',onReopen);window.addEventListener('acj:quotation-created',onNewQuote);
  window.addEventListener('acj:quote-reopened-client',()=>requestAnimationFrame(render));
  window.addEventListener('acj:quote-linked-v59',()=>{const meta=readMeta()[keyFor(state.company,state.number)];if(meta?.ogust_id&&meta.ogust_snapshot&&!currentContext())window.acjReopenedQuoteV33={societe:state.company,numero_devis:state.number,id_customer:String(meta.ogust_snapshot?.client?.id_customer||''),snapshot:JSON.parse(JSON.stringify(meta.ogust_snapshot))};requestAnimationFrame(render)});
  const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){onNewQuote();return fresh.apply(this,arguments)};
  const go=window.goStep;if(typeof go==='function')window.goStep=function(step){const result=go.apply(this,arguments);if(Number(step)===4)render();return result};
  window.acjQuotationUpdateV34={render,update:updateNow,recover:recoverCurrent,existingLine};window.__acjQuotationUpdateV34=true;
  if(window.acjReopenedQuoteV33)render();
})();

