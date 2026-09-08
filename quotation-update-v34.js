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
    if(!reopened?.numero_devis)return null;
    const company=String(reopened.societe||state?.company||''),ref=String(reopened.numero_devis||state?.number||'');
    const meta=readMeta()[keyFor(company,ref)]||{};
    return{reopened,company,ref,meta,id:String(meta.ogust_id||'')};
  }
  function patchMeta(company,ref,patch){const all=readMeta(),k=keyFor(company,ref);all[k]={...(all[k]||{}),...patch,updated_at:new Date().toISOString()};writeMeta(all)}
  function statusMessage(code){
    if(code==='REMOTE_QUOTE_CHANGED')return 'Le devis a été modifié dans Ogust depuis la copie locale. Rien n’a été écrasé.';
    if(code==='CUSTOMER_MISMATCH')return 'Le client du devis Ogust ne correspond plus au client sélectionné. Mise à jour bloquée.';
    if(code==='REMOTE_STATUS_LOCKED'||code==='REMOTE_STATUS_NOT_EDITABLE')return 'Ce devis n’est plus dans un état modifiable en sécurité dans Ogust.';
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
    const ctx=currentContext();if(!ctx?.id)return;
    const status=String(ctx.meta.ogust_status||'').toUpperCase(),label=ctx.meta.ogust_status_label||LABELS[status]||'Statut à revérifier';
    const blocked=LOCKED.has(status);
    const card=document.createElement('div');card.id='quoteUpdateV34';card.className='qu34';
    card.innerHTML=`<div class="qu34Head"><div><div class="qu34Title">Modifier le même devis Ogust</div><div class="qu34Meta">Le devis <strong>${esc(ctx.ref)}</strong> sera mis à jour sans créer de doublon. Le serveur vérifie le statut et refuse d’écraser un devis modifié directement dans Ogust.</div></div><span class="qu34Badge">${esc(label)}</span></div><div class="qu34Actions"><button id="quoteUpdateBtnV34" class="btn good" type="button" ${blocked?'disabled':''}>${blocked?'Modification bloquée':'Mettre à jour dans Ogust'}</button></div><div id="quoteUpdateResultV34" class="qu34Result"></div>`;
    const notice=step.querySelector('.histReopenNoticeV33');if(notice)notice.insertAdjacentElement('afterend',card);else{const lead=step.querySelector('.lead');if(lead)lead.insertAdjacentElement('afterend',card);else step.prepend(card)}
    card.querySelector('#quoteUpdateBtnV34')?.addEventListener('click',updateNow);
    const createBtn=[...document.querySelectorAll('.finalActions .btn.good')].find(b=>/créer dans ogust/i.test(b.textContent||''));
    if(createBtn){createBtn.style.display='none';createBtn.dataset.hiddenByV34='1'}
  }
  function result(text,type='info'){const box=document.getElementById('quoteUpdateResultV34');if(!box)return;box.className=`qu34Result show ${type}`;box.textContent=text}
  function persistLatest(p){
    try{if(typeof window.saveQuote==='function')window.saveQuote()}catch{}
    if(window.acjReopenedQuoteV33){window.acjReopenedQuoteV33.snapshot=JSON.parse(JSON.stringify(p));window.acjReopenedQuoteV33.id_customer=String(p?.client?.id_customer||window.acjReopenedClientIdV33||'')}
  }
  async function updateNow(){
    const ctx=currentContext();if(!ctx?.id)return result('Identifiant Ogust introuvable pour ce devis.','err');
    const button=document.getElementById('quoteUpdateBtnV34');if(button)button.disabled=true;
    result('Vérification du devis Ogust avant mise à jour…','info');
    try{
      const quote=typeof window.quotePayload==='function'?window.quotePayload():null;
      const original=ctx.reopened?.snapshot;if(!quote||!original)throw new Error('LOCAL_SNAPSHOT_MISSING');
      const idCustomer=String(window.ogustClientChoiceV21?.selected?.id_customer||window.acjReopenedClientIdV33||quote?.client?.id_customer||'');
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',company:ctx.company,id_quotation:ctx.id,id_customer:idCustomer,quote,original_quote:original})});
      const data=await r.json().catch(()=>null);
      if(!r.ok||!data?.ok){
        if(data?.rollback_restored===false)result('Échec de mise à jour et restauration incomplète. Vérifie ce devis directement dans Ogust avant toute autre action.','err');
        else if(data?.error==='OGUST_UPDATE_FAILED'&&data?.rollback_restored===true)result('La mise à jour a échoué, mais l’ancien devis a été restauré dans Ogust.','err');
        else result(statusMessage(data?.error), 'err');
        return;
      }
      patchMeta(ctx.company,ctx.ref,{ogust_id:ctx.id,ogust_number:String(data.ogust_number||ctx.meta.ogust_number||''),ogust_status:String(data.ogust_status||ctx.meta.ogust_status||''),ogust_status_label:String(data.ogust_status_label||ctx.meta.ogust_status_label||'')});
      persistLatest(quote);
      result(`Devis ${data.ogust_number?`n° ${data.ogust_number} `:''}mis à jour dans Ogust sans doublon.${String(data.ogust_status||'').toUpperCase()==='E'?' Il avait déjà été envoyé : il faudra renvoyer la nouvelle version au client.':''}`,'ok');
      const notice=document.querySelector('.histReopenNoticeV33');if(notice)notice.innerHTML='<strong>Devis rouvert et synchronisé.</strong> Les modifications enregistrées ici correspondent maintenant au même devis dans Ogust.';
      window.dispatchEvent(new CustomEvent('acj:quotation-updated-v34',{detail:data}));
    }catch(error){result(error?.message==='LOCAL_SNAPSHOT_MISSING'?'La copie locale d’origine est introuvable. Mise à jour bloquée pour éviter d’écraser Ogust.':'Erreur de connexion pendant la mise à jour.','err')}
    finally{if(button)button.disabled=false}
  }
  function restoreCreateButton(){const b=document.querySelector('[data-hidden-by-v34="1"]');if(b){b.style.display='';delete b.dataset.hiddenByV34}}
  function onReopen(){restoreCreateButton();requestAnimationFrame(render)}
  function onNewQuote(){window.acjReopenedQuoteV33=null;window.acjReopenedClientIdV33='';document.getElementById('quoteUpdateV34')?.remove();restoreCreateButton()}
  addStyles();window.addEventListener('acj:quote-reopened',onReopen);window.addEventListener('acj:quotation-created',onNewQuote);
  window.acjQuotationUpdateV34={render,update:updateNow};window.__acjQuotationUpdateV34=true;
  if(window.acjReopenedQuoteV33)render();
})();
