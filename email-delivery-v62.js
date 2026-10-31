// Opens the user's own mail app. Only an explicit post-send confirmation
// updates Ogust; neither a share handoff nor a mailto click means 'sent'.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-quotation',META='acj_devis_history_meta_v29';
  let active=null;const writes=new Set(),validations=new Set();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validEmail=value=>/^[^\s@<>:,;]+@[^\s@<>:,;]+\.[^\s@<>:,;]+$/.test(String(value||'').trim());
  const key=q=>`${q.societe}|${q.numero_devis}`;
  function metas(){try{return JSON.parse(localStorage.getItem(META)||'{}')}catch{return{}}}
  function patch(k,values){const all=metas();all[k]={...(all[k]||{}),...values,updated_at:new Date().toISOString()};try{localStorage.setItem(META,JSON.stringify(all))}catch{}}
  function fingerprint(q){return JSON.stringify({company:q?.societe,number:q?.numero_devis,client:[q?.client?.id_customer||'',q?.client?.nom||'',q?.client?.telephone||'',q?.client?.adresse||''],notes:q?.notes||'',lines:(q?.lignes||[]).map(l=>[l.designation,l.detail||'',Number(l.quantite),l.unite,Number(l.prix_unitaire_ttc),Number(l.tva_rate),l.ogust_rate_id||'',l.ogust_product_level_id||''])})}
  function context(){const quote=clone(window.quotePayload()),k=key(quote),meta=metas()[k]||{};return{quote,k,meta,id:String(meta.ogust_id||''),customer:String(quote.client?.id_customer||''),hash:fingerprint(quote)}}
  function current(ctx){try{return fingerprint(window.quotePayload())===ctx.hash&&String(metas()[ctx.k]?.ogust_id||'')===ctx.id}catch{return false}}
  function errorText(code){return({REMOTE_QUOTE_CHANGED:'Le devis a changé dans Ogust. L’envoi de cette copie est bloqué.',REMOTE_STATUS_LOCKED:'Ce devis est maintenant accepté, clôturé ou supprimé dans Ogust. Son statut reste inchangé.',CUSTOMER_MISMATCH:'Le client Ogust ne correspond plus à cette copie.',VALIDATION_REQUIRED:'Valide le devis dans Ogust avant de préparer son envoi.',QUOTATION_CONTEXT_UNREADABLE:'Les informations d’origine du devis n’ont pas pu être vérifiées dans Ogust. Aucune validation effectuée.',QUOTATION_OPPORTUNITY_MISSING:'Ce devis n’a pas d’opportunité liée dans Ogust. Sa liaison doit être vérifiée avant validation.',QUOTATION_OPPORTUNITY_UNREADABLE:'L’opportunité liée à ce devis n’a pas pu être vérifiée. Aucune validation effectuée.',QUOTATION_OPPORTUNITY_AMBIGUOUS:'Plusieurs opportunités correspondent à la liaison Ogust. Aucune validation effectuée.',QUOTATION_OPPORTUNITY_MISMATCH:'L’opportunité liée ne correspond pas au client ou à l’établissement du devis. Aucune validation effectuée.',OGUST_OPPORTUNITY_REJECTED:'Ogust refuse l’opportunité liée au devis. Le statut n’a pas été modifié.',VALIDATED_STATUS_UNAVAILABLE:'Ogust n’a pas confirmé la valeur du statut « Validé ». Aucune validation effectuée.',VALIDATION_NOT_CONFIRMED:'La validation n’a pas pu être confirmée. Réessaie la préparation pour vérifier le statut actuel.',SENT_STATUS_UNAVAILABLE:'Ogust n’a pas confirmé la valeur du statut « Envoyé ».',SENT_STATUS_NOT_CONFIRMED:'Le statut envoyé n’a pas pu être confirmé. Vérifie Ogust avant de réessayer.',AUTH_REQUIRED:'Reconnecte-toi pour continuer.',COMPANY_NOT_SUPPORTED:'L’envoi avec suivi Ogust n’est pas disponible pour cette société.'})[code]||'Ogust n’a pas confirmé l’opération. Le statut local reste inchangé.'}
  async function request(ctx,action){const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,company:ctx.quote.societe,id_quotation:ctx.id,id_customer:ctx.customer,quote:ctx.quote,...(action==='mark_sent'?{confirm_sent:true}:action==='validate_for_delivery'?{confirm_validate:true}:{})})});const data=await response.json().catch(()=>null);if(!response.ok||!data?.ok||String(data.id_quotation)!==ctx.id){const error=Error(errorText(data?.error));throw error}return data}
  function close(){const session=active;if(!session)return;session.overlay.remove();document.body.style.overflow=session.bodyOverflow;active=null;document.getElementById('emailLaunch62')?.focus()}
  function node(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el}
  function status(session,text,kind='info'){if(active!==session)return;session.message.textContent=text;session.message.className=`emailMessage62 ${kind}`}
  function markOpened(session){patch(session.ctx.k,{email_delivery_pending:{fingerprint:session.ctx.hash,envelope:session.envelope?.(),opened_at:new Date().toISOString()}});session.opened=true;session.confirm.hidden=false;status(session,'Après l’envoi du mail, reviens ici et clique sur « J’ai envoyé le devis ».')}
  function download(session){const url=URL.createObjectURL(session.file),link=node('a');link.href=url;link.download=session.file.name;document.body.appendChild(link);link.click();link.remove();session.pdfDownloaded=true;setTimeout(()=>URL.revokeObjectURL(url),30000)}
  async function confirmSent(session){
    if(!session.opened||session.done||writes.has(session.ctx.k))return;
    if(!current(session.ctx))return status(session,'Le devis a été modifié. Enregistre et prépare la nouvelle version avant de confirmer son envoi.','err');
    writes.add(session.ctx.k);session.confirm.disabled=true;status(session,'Mise à jour du statut dans Ogust…');
    try{const data=await request(session.ctx,'mark_sent');if(data.verified!==true||String(data.ogust_status)!=='E')throw Error('Le statut envoyé n’a pas été confirmé par Ogust.');patch(session.ctx.k,{ogust_status:'E',ogust_status_label:data.ogust_status_label||'Envoyé',ogust_number:data.ogust_number||session.ctx.meta.ogust_number,email_delivery_pending:null,email_sent_confirmed_at:new Date().toISOString()});session.done=true;if(current(session.ctx))window.acjQuotationUpdateV34?.render();status(session,'Statut « Envoyé » confirmé dans Ogust.','ok');session.confirm.textContent='Envoyé dans Ogust';session.confirm.disabled=true;const share=session.content.querySelector('#emailShare62');if(share)share.disabled=true;const mail=session.content.querySelector('#emailMailto62');if(mail)mail.removeAttribute('href');session.content.querySelector('input').readOnly=true;const copy=session.content.querySelector('#emailCopyRecipient70');if(copy)copy.disabled=true}
    catch(error){status(session,error.message||'Connexion Ogust impossible. Le statut reste à vérifier.','err')}
    finally{writes.delete(session.ctx.k);if(!session.done)session.confirm.disabled=false}
  }
  function mailTemplate(quote,number){
    const amount=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(quote.totaux.ttc);
    const titles=(quote.lignes||[]).map(line=>String(line.designation||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const summary=['Prestations prévues :',...titles.slice(0,8).map(title=>`- ${title}`)];
    if(titles.length>8)summary.push('Le détail complet figure dans le devis joint.');
    if(quote.client?.adresse)summary.push(`Adresse d’intervention : ${String(quote.client.adresse).replace(/\s+/g,' ').trim()}`);
    summary.push(`Montant total : ${amount} TTC`);
    return{amount,subject:`Votre devis n° ${number} - ${quote.societe}`,body:['Bonjour,','',`Vous trouverez en pièce jointe votre devis n° ${number}.`,'',...summary,'','Pour confirmer votre accord, merci de nous retourner le devis daté et signé.','','Cordialement,',quote.societe].join('\n')};
  }
  function ready(session,data){
    const ctx=session.ctx;ctx.meta.ogust_number=String(data.ogust_number||'');if(!ctx.meta.ogust_number||!['V','E'].includes(String(data.ogust_status)))throw Error('Le numéro et la validation Ogust doivent être confirmés avant l’envoi.');
    patch(ctx.k,{ogust_number:ctx.meta.ogust_number,ogust_status:data.ogust_status,ogust_status_label:data.ogust_status_label});
    window.applyOgustQuotationNumber?.(ctx.meta.ogust_number,ctx.id);
    session.file=window.acjQuotePdf62.create(window.buildPrintHTML(),ctx.meta.ogust_number);
    const number=ctx.meta.ogust_number,{amount,subject,body}=mailTemplate(ctx.quote,number);
    session.content.replaceChildren();session.content.appendChild(node('p',`Devis n° ${number} · ${amount}`,'emailSummary62'));
    const choice=window.ogustClientChoiceV21,selected=choice?.company===ctx.quote.societe?choice.selected:null,selectedEmail=String(selected?.id_customer||'')===ctx.customer?selected.email:'';
    let native=false;try{native=!!navigator.share&&!!navigator.canShare?.({files:[session.file]})}catch{}
    const field=node('label','Adresse e-mail du client'),email=node('input');email.type='email';email.autocomplete='email';email.id='emailRecipient62';email.value=String(data.recipient_email||selectedEmail||ctx.quote.client?.email||'');field.htmlFor=email.id;session.content.appendChild(field);
    const recipientRow=node('div',null,'emailRecipientRow70'),copy=node('button','Copier','btn');copy.id='emailCopyRecipient70';copy.type='button';recipientRow.append(email,copy);session.content.appendChild(recipientRow);
    const recipientHint=node('p',null,'emailRecipientHint63');recipientHint.id='emailRecipientHint63';recipientHint.setAttribute('role','status');session.content.appendChild(recipientHint);
    const mail=node('a',native?'Ouvrir avec l’adresse préremplie':'Ouvrir ma messagerie','btn');mail.id='emailMailto62';
    const share=native?node('button','Envoyer avec le PDF','btn primary'):null;
    if(share){share.id='emailShare62';share.type='button'}
    session.envelope=()=>JSON.stringify([email.value.trim(),subject,body]);
    function address(){if(session.done)return;const to=email.value.trim(),valid=validEmail(to);copy.disabled=!valid;if(share)share.disabled=!valid;mail.setAttribute('aria-disabled',String(!valid));if(valid)mail.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g,'\r\n'))}`;else mail.removeAttribute('href');recipientHint.textContent=valid?(native?'L’adresse sera copiée pour la coller dans « À ».':'Cette adresse sera préremplie dans le champ « À » de ta messagerie.'):'Aucune adresse utilisable trouvée. Renseigne celle du client pour préparer le mail.'}
    function resetHandoff(){if(!session.opened)return;session.opened=false;session.confirm.hidden=true;patch(ctx.k,{email_delivery_pending:null});status(session,'L’adresse a changé. Ouvre le mail avec ce nouveau destinataire.')}
    email.addEventListener('input',()=>{if(session.done)return;copy.textContent='Copier';resetHandoff();address()});address();
    function copyRecipient(){
      const to=email.value.trim();if(!validEmail(to))return Promise.resolve(false);
      try{return Promise.resolve(navigator.clipboard.writeText(to)).then(()=>{if(active===session&&email.value.trim()===to){copy.textContent='Copié';recipientHint.textContent='Adresse copiée. Colle-la dans le champ « À » de Gmail ou Outlook.'}return true},()=>{if(active===session)recipientHint.textContent='Appui long sur l’adresse pour la copier, puis colle-la dans « À ».';return false})}
      catch{recipientHint.textContent='Appui long sur l’adresse pour la copier, puis colle-la dans « À ».';return Promise.resolve(false)}
    }
    copy.addEventListener('click',copyRecipient);
    const preview=node('details',null,'emailPreview70'),previewTitle=node('summary','Voir le message préparé'),subjectView=node('p',`Objet : ${subject}`,'emailSubject70'),messageView=node('p',body,'emailBody70'),copyBody=node('button','Copier le message','btn');copyBody.type='button';copyBody.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(body);copyBody.textContent='Message copié';recipientHint.textContent='Message copié. Le bouton avec PDF recopiera l’adresse du client.'}catch{status(session,'Sélectionne le texte du message pour le copier.','err')}});preview.append(previewTitle,subjectView,messageView,copyBody);
    const save=node('button','Télécharger le PDF','btn');save.id='emailDownload62';save.type='button';save.addEventListener('click',()=>download(session));
    let manual=null;
    if(native){
      const attachment=node('p',`PDF prêt : ${session.file.name}`,'emailAttachment70');attachment.id='emailAttachment70';
      session.content.append(attachment,node('p','Choisis Gmail ou Outlook dans le partage du téléphone. Le PDF est joint au message ; colle l’adresse dans « À ».'),share,preview);
      manual=node('details');manual.id='emailManual70';manual.append(node('summary','Autres options'),node('p','Avec l’adresse préremplie, le PDF est à ajouter manuellement dans la messagerie.'),mail,save);session.content.appendChild(manual);
      share.addEventListener('click',async()=>{
        if(session.done||session.sharing)return;if(!current(ctx))return status(session,'Le devis a changé. Prépare la nouvelle version.','err');if(!validEmail(email.value)){email.focus();return}
        const envelope=session.envelope();session.sharing=true;share.disabled=true;
        // Keep the share call in the original click: awaiting clipboard access
        // first can consume the browser's transient user activation.
        copyRecipient();
        try{await navigator.share({files:[session.file],title:subject,text:body});if(active!==session)return;if(!current(ctx)||session.envelope()!==envelope)return status(session,'Le devis ou le destinataire a changé. Prépare le nouvel envoi.','err');markOpened(session)}
        catch(error){if(active!==session)return;status(session,error?.name==='AbortError'?'Partage annulé. Le statut Ogust reste inchangé.':'Le partage avec PDF n’a pas abouti. Utilise les autres options.','err');if(error?.name!=='AbortError')manual.open=true}
        finally{session.sharing=false;if(!session.done)share.disabled=!validEmail(email.value)}
      });
    }else{
      mail.classList.add('primary');session.content.append(node('p','L’adresse, l’objet et le message seront préremplis. Ce navigateur demande d’ajouter le PDF manuellement.'),mail,save,preview);
    }
    mail.addEventListener('click',event=>{if(session.done){event.preventDefault();return}if(!current(ctx)){event.preventDefault();mail.removeAttribute('href');status(session,'Le devis a changé. Prépare la nouvelle version.','err');return}if(!validEmail(email.value)){event.preventDefault();address();email.focus();return}try{if(!session.pdfDownloaded)download(session);markOpened(session)}catch{event.preventDefault();status(session,'Le téléchargement du PDF n’a pas abouti. Réessaie avec « Télécharger le PDF ».','err')}});
    session.confirm=node('button','J’ai envoyé le devis','btn good');session.confirm.id='emailConfirm62';session.confirm.type='button';session.confirm.hidden=true;session.confirm.addEventListener('click',()=>confirmSent(session));session.content.append(session.confirm);
    const pending=metas()[ctx.k]?.email_delivery_pending;if(pending?.fingerprint===ctx.hash&&(!pending.envelope||pending.envelope===session.envelope())){session.opened=true;session.confirm.hidden=false;status(session,'Un envoi avait été préparé. Confirme seulement si le mail a bien été envoyé.')}else status(session,'Le statut Ogust reste inchangé pendant la préparation du mail.');
  }
  function preparationStep(session,data){
    session.content.replaceChildren();
    if(data.needs_validation){
      session.content.appendChild(node('p','Ce devis est encore en brouillon. Valide-le dans Ogust avant de préparer son envoi.'));
      const validate=node('button','Valider dans Ogust','btn good');validate.id='emailValidate67';validate.type='button';validate.disabled=validations.has(session.ctx.k);validate.addEventListener('click',()=>prepareSession(session,'validate_for_delivery'));session.content.appendChild(validate);
      status(session,'Le statut « Envoyé » sera appliqué après ta confirmation de l’envoi du mail.');
    }else{
      session.content.appendChild(node('p','Le devis est validé dans Ogust. Son numéro officiel n’a pas encore été retourné.'));
      status(session,'Réessaie la préparation pour récupérer le numéro et le PDF.','info');
    }
    const retry=node('button','Réessayer la préparation','btn');retry.id='emailRetry67';retry.type='button';retry.addEventListener('click',()=>prepareSession(session));session.content.appendChild(retry);
  }
  async function prepareSession(session,action='prepare_delivery'){
    if(session.busy||active!==session)return;
    if(!current(session.ctx))return status(session,'Le devis a changé. Enregistre et prépare la nouvelle version.','err');
    const validate=action==='validate_for_delivery';if(validate&&validations.has(session.ctx.k))return status(session,'La validation de ce devis est déjà en cours.');
    session.busy=true;if(validate)validations.add(session.ctx.k);session.content.querySelectorAll('button').forEach(b=>{b.disabled=true});status(session,validate?'Validation du devis dans Ogust…':'Vérification du devis dans Ogust…');
    try{
      const data=await request(session.ctx,action);
      const values={ogust_status:data.ogust_status,ogust_status_label:data.ogust_status_label};if(data.ogust_number)values.ogust_number=String(data.ogust_number);patch(session.ctx.k,values);
      if(active!==session)return;if(!current(session.ctx))throw Error('Le devis a changé pendant sa préparation.');
      window.acjQuotationUpdateV34?.render();
      if(data.needs_validation||data.needs_number){preparationStep(session,data);return}
      await window.acjQuotePdf62.load();if(active!==session)return;if(!current(session.ctx))throw Error('Le devis a changé pendant sa préparation.');ready(session,data);
    }catch(error){if(active===session){status(session,error.message||'La préparation a échoué.','err');if(!session.content.querySelector('#emailRetry67')){const retry=node('button','Réessayer la préparation','btn');retry.id='emailRetry67';retry.type='button';retry.addEventListener('click',()=>prepareSession(session));session.content.appendChild(retry)}}}
    finally{session.busy=false;if(validate)validations.delete(session.ctx.k);if(active===session)session.content.querySelectorAll('#emailValidate67,#emailRetry67').forEach(b=>{b.disabled=false});else if(validate&&active?.ctx.k===session.ctx.k){const b=active.content.querySelector('#emailValidate67');if(b)b.disabled=false}}
  }
  async function open(){
    close();const ctx=context();if(!ctx.id||!ctx.customer||!ctx.meta.ogust_snapshot||fingerprint(ctx.meta.ogust_snapshot)!==ctx.hash)return;
    const overlay=node('div');overlay.id='emailOverlay62';const dialog=node('section');dialog.className='emailDialog62';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Envoyer le devis');const head=node('div',null,'emailHead62'),title=node('h2','Envoyer le devis'),exit=node('button','×','btn');exit.type='button';exit.setAttribute('aria-label','Fermer l’envoi du devis');exit.addEventListener('click',close);head.append(title,exit);
    const content=node('div',null,'emailContent62'),message=node('p','Vérification du devis dans Ogust…','emailMessage62');message.setAttribute('role','status');dialog.append(head,content,message);overlay.appendChild(dialog);document.body.appendChild(overlay);
    const session={ctx,overlay,content,message,opened:false,done:false,bodyOverflow:document.body.style.overflow};document.body.style.overflow='hidden';active=session;exit.focus();overlay.addEventListener('click',event=>{if(event.target===overlay)close()});overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}else if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button,input,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus()}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus()}}});
    await prepareSession(session);
  }
  function render(step){
    document.getElementById('ogustDelivery59')?.remove();document.getElementById('emailFooterHint64')?.remove();document.getElementById('ogustAlt64')?.remove();const ctx=context();if(!ctx.id)return;
    if(ctx.meta.ogust_number)window.applyOgustQuotationNumber?.(ctx.meta.ogust_number,ctx.id);
    const synced=!!ctx.meta.ogust_snapshot&&fingerprint(ctx.meta.ogust_snapshot)===ctx.hash,allowed=['ACJ Services','ACJ Services Lens'].includes(ctx.quote.societe)&&['B','V','E'].includes(String(ctx.meta.ogust_status||'').toUpperCase());
    const card=node('div',null,'card');card.id='ogustDelivery59';const title=node('div','Envoi au client','cardTitle'),info=node('p',`${ctx.meta.ogust_number?`Devis n° ${ctx.meta.ogust_number}`:ctx.quote.numero_devis} · ${ctx.meta.ogust_status_label||'Statut à vérifier'}`,'ogustDeliveryInfo59');const launch=node('button',ctx.meta.email_delivery_pending?.fingerprint===ctx.hash?'Terminer l’envoi':'Envoyer par e-mail','btn primary');launch.id='emailLaunch62';launch.type='button';launch.disabled=!synced||!allowed||!ctx.customer;launch.addEventListener('click',open);card.append(title,info,launch);
    const footer=document.getElementById('reviewActions53');let host=footer?.querySelector('#reviewPrimary64');
    if(footer&&!host){host=node('div');host.id='reviewPrimary64';footer.insertBefore(host,footer.querySelector('.finalActions'))}
    if(host){card.classList.add('emailFooter64');host.appendChild(card);if(!synced||!allowed){const hint=node('p',!allowed?'Ce statut Ogust ne permet pas l’envoi depuis l’application.':'Enregistre le devis dans Ogust pour activer l’envoi.');hint.id='emailFooterHint64';hint.setAttribute('role','status');host.insertAdjacentElement('afterend',hint)}const statusLine=document.querySelector('#reviewStatus64 .qu34Meta');if(statusLine)statusLine.textContent=info.textContent}else{if(!synced)card.appendChild(node('p','Enregistre les modifications dans Ogust avant d’envoyer cette version.'));if(!allowed)card.appendChild(node('p','Ce devis ne peut pas passer au statut envoyé depuis l’application.'));step.appendChild(card)}
    if(synced){const link=node('a','Ouvrir Ogust','btn');link.id='ogustAlt64';link.href='https://my.ogust.app/';link.target='_blank';link.rel='noopener noreferrer';const alternatives=footer?.querySelector('.secondaryActionGrid53');if(alternatives)alternatives.appendChild(link);else card.appendChild(link)}
  }
  const style=node('style');style.textContent=`#emailOverlay62{position:fixed;inset:0;z-index:16000;background:rgba(17,40,57,.48);display:flex;align-items:center;justify-content:center;padding:12px}.emailDialog62{background:#f7fbfe;border:1px solid #d4e6f0;border-radius:20px;width:min(560px,100%);max-height:calc(100dvh - 24px);padding:16px;overflow:auto;color:#203c50}.emailHead62{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.emailHead62 h2{font-size:21px;margin:0}.emailHead62 button{width:44px;min-height:44px!important;padding:0!important;font-size:22px!important;flex-shrink:0}.emailContent62{display:grid;gap:10px}.emailContent62 p,.emailMessage62{font-size:13px;line-height:1.5;margin:0}.emailContent62 input{width:100%;font-size:16px;min-height:46px}.emailContent62 label{font-size:12px;font-weight:750}.emailContent62 .btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px!important;text-decoration:none}.emailContent62 [hidden]{display:none!important}.emailContent62 details>summary,#ogustDelivery59 summary{font-size:12px;padding:12px 0;cursor:pointer}.emailContent62 details .btn,.emailContent62 details p{margin-top:9px}.emailSummary62{font-weight:800;color:#194d6c}.emailMessage62{margin-top:12px;padding:10px;border-radius:10px;background:#eaf4fb}.emailMessage62.err{background:#fff0f0;color:#8a3030}.emailMessage62.ok{background:#eaf9ef;color:#245b37}#ogustDelivery59>.btn{width:100%}#ogustDelivery59>p{font-size:12px;line-height:1.5}#emailOverlay62 :focus-visible{outline:2px solid #0b78c9;outline-offset:2px}.emailRecipientHint63{color:#47687f;font-size:12px!important}.emailRecipientRow70{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.emailRecipientRow70 .btn{width:auto;min-width:64px;padding:9px!important;font-size:12px}.emailRecipientRow70 input{min-width:0}.emailAttachment70{padding:9px 10px;border:1px solid #c8e4d3;border-radius:10px;background:#effaf3;color:#286041;overflow-wrap:anywhere;font-weight:750}.emailSubject70{font-weight:750}.emailBody70{white-space:pre-wrap;user-select:text}.emailPreview70 .emailBody70{margin:12px 0;padding:12px;background:#fff;border:1px solid #d4e6f0;border-radius:10px}.emailContent62 a[aria-disabled="true"]{opacity:.5;pointer-events:none}#reviewPrimary64{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start;margin:8px 0}#reviewPrimary64 #quoteUpdateV34{margin:0!important;padding:0!important;border:0!important;background:transparent!important}#reviewPrimary64 .qu34Actions{margin:0!important}#reviewPrimary64 .btn{width:100%;min-height:48px!important;font-size:12px!important;line-height:1.3!important;padding:10px 8px!important}#reviewPrimary64 .emailFooter64{margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}#reviewPrimary64 .emailFooter64:only-child{grid-column:1/-1}#reviewPrimary64 .emailFooter64>.cardTitle,#reviewPrimary64 .emailFooter64>.ogustDeliveryInfo59{display:none!important}#reviewStatus64 .qu34Meta{margin:0 0 6px;font-size:11px}#emailFooterHint64{font-size:11px;line-height:1.4;color:#5b7486;margin:5px 0 8px}#reviewActions53 .secondaryActionGrid53{grid-template-columns:repeat(2,minmax(0,1fr))!important;max-height:125px;overflow:auto;overscroll-behavior:contain}#reviewActions53 .secondaryActionGrid53 .btn{grid-column:auto!important}#reviewActions53>#quoteUpdateResultV34{margin:6px 0!important}@media print{#emailOverlay62{display:none!important}}`;document.head.appendChild(style);
  window.acjEmailDelivery62={render,open,close,fingerprint};
  const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){close();for(const id of ['reviewPrimary64','emailFooterHint64','ogustAlt64'])document.getElementById(id)?.remove();return fresh.apply(this,arguments)};
  window.addEventListener('acj:quote-reopened',close);
})();
