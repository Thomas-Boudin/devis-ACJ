(() => {
  const API='https://acj-ogust-proxy.vercel.app/api/intervenante-pilot',TOKEN='acj_intervenantes_google_token';
  // Never import the old local test queue as actual worked hours.
  const DB='acj_intervenantes_pointage_v2',states=new Map(),syncAttempts=new Set(),syncing=new Set();
  let dbPromise,rows=[],cards=[],currentOwner='',busy=false,flushing=false,remoteActive=null,absences=[],generation=0;
  const $=id=>document.getElementById(id),token=()=>sessionStorage.getItem(TOKEN)||localStorage.getItem(TOKEN)||'';
  function owner(){try{return String(JSON.parse(atob(token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).email||'').toLowerCase();}catch{return '';}}
  const employee=()=>String($('employee')?.value||''),date=()=>String($('datePicker')?.value||''),key=id=>`${owner()}:${id}`;
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
  const time=iso=>iso?new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)):'';
  const visibleReceipt=state=>state?.ogust_synced&&state.ogust_destination==='ordre_de_mission';
  const syncKey=state=>`${state.owner}:${state.service_id}:${state.start_event_id}:${state.stop_event_id||''}`;
  const elapsed=iso=>{const n=Math.max(0,Math.floor((Date.now()-Date.parse(iso))/1000));return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':');};
  function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('POINTAGE_LOCAL_STORAGE_UNAVAILABLE'));const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{req.result.createObjectStore('states',{keyPath:'key'});req.result.createObjectStore('events',{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('POINTAGE_LOCAL_STORAGE_UNAVAILABLE'));});return dbPromise;}
  async function all(store){const database=await db();return new Promise((resolve,reject)=>{const req=database.transaction(store).objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('POINTAGE_LOCAL_STORAGE_UNAVAILABLE'));});}
  async function save(state,event,remove){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(['states','events'],'readwrite');if(state)tx.objectStore('states').put(state);if(event)tx.objectStore('events').put(event);if(remove)tx.objectStore('events').delete(remove);tx.oncomplete=()=>{if(state)states.set(state.service_id,state);resolve();};tx.onerror=tx.onabort=()=>reject(new Error('POINTAGE_LOCAL_STORAGE_UNAVAILABLE'));});}
  async function call(action,params={},post=false,raw=false){const u=new URL(API);u.searchParams.set('action',action);if(!post)Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const headers={Authorization:`Bearer ${token()}`};if(post)headers['Content-Type']='application/json';const response=await fetch(u,{method:post?'POST':'GET',headers,body:post?JSON.stringify(params):undefined,cache:'no-store',signal:AbortSignal.timeout(45000)});if(raw&&response.ok)return response.blob();const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw Object.assign(new Error(data.error||'POINTAGE_NETWORK'),{status:response.status});return data;}
  const messages={
    POINTAGE_LOCAL_STORAGE_UNAVAILABLE:'Le stockage du téléphone est indisponible. Le pointage ne peut pas être conservé.',
    POINTAGE_EMPLOYEE_ABSENT:'Absence déclarée dans Ogust. Cette prestation doit être remplacée.',
    POINTAGE_OTHER_ACTIVE:'Une autre prestation est déjà en cours. Terminez-la avant de démarrer celle-ci.',
    POINTAGE_SERVICE_CLOSED:'Cette prestation est déjà réalisée, annulée, facturée ou passée en paie.',
    POINTAGE_SERVICE_CHANGED:'Le planning a changé dans Ogust. Les pointages sont conservés ; le gestionnaire doit vérifier la prestation.',
    POINTAGE_FORBIDDEN:'Ce pointage ne correspond pas à votre compte intervenante.',
    POINTAGE_EVENT_CONFLICT:'Un pointage existe déjà pour cette étape. Rechargez la journée pour le consulter.',
    POINTAGE_TIME_INVALID:'La date du téléphone ou du pointage est incorrecte. Vérifiez-la.',
    POINTAGE_WRONG_DAY:'Vous pouvez démarrer uniquement une prestation prévue pour aujourd’hui.',
    POINTAGE_DURATION_INVALID:'La durée doit être comprise entre une minute et 24 heures.',
    POINTAGE_BILLING_REVIEW_REQUIRED:'Cette prestation exige une vérification manuelle de la quantité à facturer dans Ogust.',
    POINTAGE_PHOTO_TOO_LARGE:'La photo est trop volumineuse. Prenez une nouvelle photo.',
    POINTAGE_PHOTO_REQUIRED:'Prenez une photo pour confirmer ce pointage.',
    POINTAGE_PHOTO_INVALID:'La photo ne peut pas être lue. Prenez une nouvelle photo.',
    POINTAGE_REPORT_TASKS_REQUIRED:'Cochez les tâches obligatoires avant de terminer.',
    POINTAGE_REPORT_NOTE_REQUIRED:'Ajoutez une remarque pour décrire l’anomalie signalée.',
    POINTAGE_REPORT_NOTE_TOO_LONG:'La remarque est trop longue.',
    POINTAGE_REPORT_INVALID:'Vérifiez la fiche d’intervention.',
    POINTAGE_SIGNATURE_REQUIRED:'Faites signer le client ou indiquez son absence.',
    POINTAGE_COMMENT_TOO_LONG:'La note de la prestation Ogust est trop longue pour y ajouter les pointages. Le gestionnaire doit la vérifier.',
    POINTAGE_OGUST_NOT_CONFIRMED:'Le pointage est conservé. Son affichage dans Ogust n’a pas été confirmé.',
    AUTH_REQUIRED:'Reconnectez-vous pour envoyer les pointages.',AUTH_INVALID:'Reconnectez-vous pour envoyer les pointages.'
  };
  const message=e=>messages[e?.message]||'Envoi indisponible. Le pointage, sa fiche et ses photos restent conservés sur ce téléphone pour réessayer.';
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const banner=value=>setText(document.querySelector('.banner'),value);
  function css(){const s=document.createElement('style');s.id='acj-pointage-css';s.textContent=`
    .pointage{background:#0f766e;color:white;cursor:pointer}.pointage[data-state="active"]{background:#b91c1c}.pointage[data-state="done"]{background:#dcfce7;color:#166534}.pointage:disabled{opacity:.65;cursor:default}
    .pointageMeta{margin-top:9px;padding:11px;border-radius:12px;background:#f0fdf4;font-size:12px;line-height:1.5;color:#166534}.pointageMeta.pending{background:#fff7ed;color:#9a3412}.pointageTools{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.pointageTools button{background:white;border:1px solid #cbd5e1;border-radius:10px;min-height:40px;padding:8px 12px;color:#334155;font-weight:800}.pointageTools .pointageValidate{background:#0f766e;color:white;border:0}
    .pointageDialog{width:min(calc(100% - 24px),520px);max-height:90dvh;border:0;border-radius:22px;padding:22px;color:#0f172a;overflow:auto}.pointageDialog::backdrop{background:rgba(15,23,42,.65)}.pointageDialog h2{font-size:22px;margin:0 0 10px}.pointageDialog p{line-height:1.5}.pointageDialog button{min-height:48px;border-radius:12px;padding:12px;font-weight:800;cursor:pointer}.pointageDialog .photoButton{width:100%;background:white;border:1px solid #cbd5e1}.pointageDialog img{max-width:100%;max-height:55dvh;object-fit:contain;border-radius:12px;margin-top:12px}.pointageDialog footer{display:flex;gap:8px;margin-top:18px}.pointageDialog .confirm{flex:1;background:#0f766e;color:white;border:0}.pointageDialog .confirm:disabled{opacity:.45;cursor:default}.pointageDialog .cancel{background:#f1f5f9;color:#334155;border:0}.pointageDialog .error{color:#b91c1c;font-size:14px}.pointageDialog label{display:block;font-size:14px;color:#64748b;margin:8px 0}
    .pointageReport{margin-top:16px;padding:14px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:14px}.pointageReport h3{font-size:16px;margin:0 0 8px}.pointageTask{display:flex!important;align-items:flex-start;gap:10px;padding:9px 0;color:#334155!important}.pointageTask input{width:20px;height:20px;accent-color:#0f766e;flex:0 0 auto}.pointageNote{box-sizing:border-box;width:100%;min-height:82px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;resize:vertical}.pointageSignature{display:block;width:100%;height:150px;border:1px dashed #94a3b8;border-radius:10px;background:#fff;touch-action:none}.pointageSignatureActions{display:flex;gap:8px;align-items:center}.pointageSignatureActions button{background:#fff;border:1px solid #cbd5e1;color:#334155}.pointageAbsent{font-weight:600;color:#334155!important}
    .pointageHistory{background:white;border:1px solid #dbe3ee;border-radius:19px;padding:16px}.pointageHistory h2{font-size:19px;margin:0 0 8px}.pointageHistory>p{font-size:13px;line-height:1.5;color:#64748b}.pointageHistoryEntry{border-top:1px solid #dbe3ee;padding:14px 0 0;margin-top:14px}.pointageHistoryEntry h3{font-size:15px;margin:0}
  `;document.head.appendChild(s);}
  function dialog(title){const d=document.createElement('dialog');d.className='pointageDialog';const h=document.createElement('h2');h.textContent=title;d.appendChild(h);d.addEventListener('close',()=>d.remove(),{once:true});document.body.appendChild(d);d.showModal();return d;}
  function p(d,text,cls){const n=document.createElement('p');n.textContent=text;if(cls)n.className=cls;d.appendChild(n);return n;}
  function button(text,cls,fn){const b=document.createElement('button');b.type='button';b.className=cls||'';b.textContent=text;b.onclick=fn;return b;}
  function gps(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve({status:'unsupported'});navigator.geolocation.getCurrentPosition(pos=>resolve({status:'ok',lat:Number(pos.coords.latitude.toFixed(6)),lng:Number(pos.coords.longitude.toFixed(6)),accuracy_m:Math.round(pos.coords.accuracy||0)}),e=>resolve({status:e.code===1?'denied':'unavailable'}),{enableHighAccuracy:true,timeout:6000,maximumAge:30000});});}
  async function compress(file){if(!file||!file.type.startsWith('image/'))throw new Error('POINTAGE_PHOTO_INVALID');const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('POINTAGE_PHOTO_INVALID'));i.src=url;});const scale=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);for(const quality of [.78,.6,.42]){const data=c.toDataURL('image/jpeg',quality);if(data.length<1_130_000)return data;}throw new Error('POINTAGE_PHOTO_TOO_LARGE');}finally{URL.revokeObjectURL(url);}}
  async function capture(service){
    if(busy||!owner())return;busy=true;
    const previous=states.get(String(service.id_service)),phase=previous?.status==='active'?'stop':'start';
    const d=dialog(phase==='start'?'Démarrer l’intervention':'Terminer l’intervention');p(d,service.customer?.name||'Prestation');
    const label=document.createElement('label');label.textContent=phase==='start'?'Photo de début obligatoire':'Photo de fin obligatoire';d.appendChild(label);
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.required=true;input.setAttribute('capture','environment');input.hidden=true;d.appendChild(input);
    const photoButton=button('Prendre une photo','photoButton',()=>input.click());d.appendChild(photoButton);
    const preview=document.createElement('img');preview.alt='Photo de la prestation';preview.hidden=true;d.appendChild(preview);
    let photo=null,processing=false,photoAttempt=0,signatureDrawn=false,painting=false,taskInputs={},noteInput=null,clientAbsentInput=null,signatureCanvas=null,signatureContext=null,refreshConfirm=()=>{};
    if(phase==='stop'){
      const section=document.createElement('section');section.className='pointageReport';
      const title=document.createElement('h3');title.textContent='Fiche de fin d’intervention';section.appendChild(title);
      p(section,'Cochez les tâches réalisées, puis faites signer le client ou indiquez son absence.');
      const definitions=[
        {key:'service_done',label:'Prestation prévue réalisée',required:true},
        {key:'instructions_followed',label:'Consignes respectées',required:true},
        {key:'area_left_tidy',label:'Zone rangée ou nettoyée',required:true},
        {key:'issue_reported',label:'Anomalie signalée',required:false}
      ];
      for(const item of definitions){
        const row=document.createElement('label');row.className='pointageTask';
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=item.key;checkbox.required=item.required;
        const text=document.createElement('span');text.textContent=item.label+(item.required?' *':' (si besoin)');
        row.append(checkbox,text);section.appendChild(row);taskInputs[item.key]=checkbox;
        checkbox.addEventListener('change',()=>refreshConfirm());
      }
      const noteLabel=document.createElement('label');noteLabel.textContent='Remarque (obligatoire si anomalie signalée, 280 caractères maximum)';
      noteInput=document.createElement('textarea');noteInput.className='pointageNote';noteInput.maxLength=280;noteInput.rows=3;noteInput.setAttribute('aria-label','Remarque sur l’intervention');
      noteLabel.appendChild(noteInput);section.appendChild(noteLabel);
      const absentLabel=document.createElement('label');absentLabel.className='pointageTask pointageAbsent';
      clientAbsentInput=document.createElement('input');clientAbsentInput.type='checkbox';
      const absentText=document.createElement('span');absentText.textContent='Aucun client ou référent présent';
      absentLabel.append(clientAbsentInput,absentText);section.appendChild(absentLabel);
      const signatureLabel=document.createElement('label');signatureLabel.textContent='Signature du client ou du référent';
      signatureCanvas=document.createElement('canvas');signatureCanvas.className='pointageSignature';signatureCanvas.width=600;signatureCanvas.height=180;signatureCanvas.setAttribute('aria-label','Zone de signature du client ou du référent');signatureLabel.appendChild(signatureCanvas);section.appendChild(signatureLabel);
      signatureContext=signatureCanvas.getContext('2d');
      const clearSignature=()=>{
        signatureContext.fillStyle='#fff';signatureContext.fillRect(0,0,signatureCanvas.width,signatureCanvas.height);
        signatureDrawn=false;refreshConfirm();
      };
      clearSignature();
      const actions=document.createElement('div');actions.className='pointageSignatureActions';
      actions.appendChild(button('Effacer la signature','',clearSignature));section.appendChild(actions);
      const point=event=>{
        const rect=signatureCanvas.getBoundingClientRect();
        return {x:(event.clientX-rect.left)*signatureCanvas.width/rect.width,y:(event.clientY-rect.top)*signatureCanvas.height/rect.height};
      };
      signatureCanvas.addEventListener('pointerdown',event=>{
        if(clientAbsentInput.checked)return;
        painting=true;signatureCanvas.setPointerCapture(event.pointerId);clientAbsentInput.checked=false;
        const pos=point(event);signatureContext.beginPath();signatureContext.moveTo(pos.x,pos.y);
        signatureDrawn=true;refreshConfirm();
      });
      signatureCanvas.addEventListener('pointermove',event=>{
        if(!painting)return;
        const pos=point(event);signatureContext.lineWidth=3;signatureContext.lineCap='round';signatureContext.lineJoin='round';signatureContext.strokeStyle='#0f172a';signatureContext.lineTo(pos.x,pos.y);signatureContext.stroke();
      });
      signatureCanvas.addEventListener('pointerup',()=>{painting=false;});
      signatureCanvas.addEventListener('pointercancel',()=>{painting=false;});
      clientAbsentInput.addEventListener('change',()=>{
        if(clientAbsentInput.checked)clearSignature();
        signatureCanvas.style.pointerEvents=clientAbsentInput.checked?'none':'auto';
        refreshConfirm();
      });
      noteInput.addEventListener('input',()=>refreshConfirm());
      d.appendChild(section);
    }
    const error=p(d,'','error'),footer=document.createElement('footer');
    const checklistReady=()=>phase!=='stop'||['service_done','instructions_followed','area_left_tidy'].every(key=>taskInputs[key]?.checked);
    const signatureReady=()=>phase!=='stop'||!!clientAbsentInput?.checked||signatureDrawn;
    const noteReady=()=>phase!=='stop'||!taskInputs.issue_reported?.checked||!!noteInput?.value.trim();
    const canSubmit=()=>!!photo&&checklistReady()&&signatureReady()&&noteReady();
    const cancel=button('Annuler','cancel',()=>d.close());
    let confirm;
    refreshConfirm=()=>{if(confirm&&!processing)confirm.disabled=!canSubmit();};
    confirm=button(phase==='start'?'Démarrer':'Terminer','confirm',async()=>{
      if(processing)return;
      if(!photo){setText(error,messages.POINTAGE_PHOTO_REQUIRED);return;}
      if(!checklistReady()){setText(error,messages.POINTAGE_REPORT_TASKS_REQUIRED);return;}
      if(!noteReady()){setText(error,messages.POINTAGE_REPORT_NOTE_REQUIRED);return;}
      if(!signatureReady()){setText(error,messages.POINTAGE_SIGNATURE_REQUIRED);return;}
      if(phase==='stop'&&Date.now()-Date.parse(previous.started_at)<60000){setText(error,messages.POINTAGE_DURATION_INVALID);return;}
      processing=true;confirm.disabled=true;cancel.disabled=true;photoButton.disabled=true;const occurred_at=new Date().toISOString();
      try{
        const selectedOwner=owner();if(!selectedOwner||selectedOwner!==currentOwner)throw new Error('AUTH_REQUIRED');
        const report=phase==='stop'?{
          tasks:Object.keys(taskInputs).filter(key=>taskInputs[key].checked),
          note:noteInput.value.trim(),
          client_absent:clientAbsentInput.checked,
          signature:signatureDrawn?signatureCanvas.toDataURL('image/png'):null
        }:null;
        const event_id=crypto.randomUUID(),event={key:selectedOwner+':'+event_id,owner:selectedOwner,event_id,type:phase,service_id:String(service.id_service),employee_id:employee(),scheduled_date:previous?.scheduled_date||date(),occurred_at,gps:await gps(),photo};
        if(report)event.report=report;
        const state={...previous,key:key(service.id_service),owner:selectedOwner,service_id:event.service_id,employee_id:event.employee_id,scheduled_date:event.scheduled_date,status:phase==='start'?'active':'completed',ogust_synced:false,error:null,pending:true};
        if(phase==='start')Object.assign(state,{started_at:occurred_at,start_event_id:event_id,start_photo:!!photo,start_gps_status:event.gps.status});
        else Object.assign(state,{ended_at:occurred_at,stop_event_id:event_id,end_photo:!!photo,end_gps_status:event.gps.status,report:{tasks:report.tasks,note:report.note,client_absent:report.client_absent,signature:!!report.signature}});
        await save(state,event);d.close();paintAll();flush();
      }catch(e){setText(error,message(e));confirm.disabled=!canSubmit();cancel.disabled=false;photoButton.disabled=false;processing=false;}
    });
    confirm.disabled=true;
    input.onchange=async()=>{
      if(processing||!input.files?.[0])return;
      const attempt=++photoAttempt;photo=null;confirm.disabled=true;photoButton.disabled=true;preview.hidden=true;preview.removeAttribute('src');setText(error,'');setText(photoButton,'Prendre une photo');
      try{const value=await compress(input.files[0]);if(attempt!==photoAttempt||!d.isConnected)return;photo=value;preview.src=photo;preview.hidden=false;setText(photoButton,'Reprendre la photo');}
      catch(e){if(attempt===photoAttempt&&d.isConnected)setText(error,message(e));}
      finally{if(attempt===photoAttempt&&d.isConnected){photoButton.disabled=false;refreshConfirm();}}
    };
    footer.append(cancel,confirm);d.appendChild(footer);d.addEventListener('cancel',e=>{if(processing)e.preventDefault();});d.addEventListener('close',()=>{busy=false;paintAll();},{once:true});
  }

  async function viewPhoto(state,phase){
    const title=phase==='signature'?'Signature du client ou du référent':phase==='start'?'Photo de début':'Photo de fin';
    const alt=phase==='signature'?'Signature du client ou du référent':phase==='start'?'Photo de début':'Photo de fin';
    const d=dialog(title),status=p(d,'Chargement…');d.appendChild(button('Fermer','cancel',()=>d.close()));
    try{
      const blob=await call('pointage_photo',{service_id:state.service_id,employee_id:state.employee_id,date:state.scheduled_date,type:phase},false,true);
      const img=document.createElement('img'),url=URL.createObjectURL(blob);img.src=url;img.alt=alt;d.insertBefore(img,status);status.remove();
      d.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});
    }catch{setText(status,'La preuve sera consultable après son envoi.');}
  }

  async function validate(state){const d=dialog('Valider les heures réelles');p(d,`Prévu : ${state.scheduled_start?.slice(8,10)||'—'}:${state.scheduled_start?.slice(10,12)||'—'} → ${state.scheduled_end?.slice(8,10)||'—'}:${state.scheduled_end?.slice(10,12)||'—'}`);p(d,`Réalisé : ${time(state.started_at)} → ${time(state.ended_at)} · ${state.duration_minutes} min`);p(d,'La validation remplace les horaires de cette prestation dans Ogust, ajuste la quantité en heures et la marque « Réalisée ». Les pointages et le planning d’origine restent conservés.');const error=p(d,'','error'),footer=document.createElement('footer');const cancel=button('Annuler','cancel',()=>d.close()),confirm=button('Valider dans Ogust','confirm',async()=>{confirm.disabled=true;cancel.disabled=true;try{const result=await call('pointage_validate',{service_id:state.service_id,employee_id:state.employee_id,scheduled_date:state.scheduled_date,confirm:true},true);await save({...state,...result.state,key:key(state.service_id),owner:owner()});paintAll();d.close();if(typeof window.loadPlanning==='function')window.loadPlanning();}catch(e){setText(error,message(e));confirm.disabled=false;cancel.disabled=false;}});footer.append(cancel,confirm);d.appendChild(footer);}
  const absent=s=>absences.some(a=>String(a.start_date)<String(s.end_date||'')&&String(a.end_date)>String(s.start_date||''));
  const otherActive=sid=>[...states.values()].some(s=>s.employee_id===employee()&&s.service_id!==sid&&s.status==='active')||(remoteActive?.service_id&&remoteActive.service_id!==sid);
  async function syncExisting(state,manual=false){
    const selectedOwner=owner();if(!state||state.owner!==selectedOwner||state.employee_id!==employee()||state.scheduled_date!==date()||state.pending||navigator.onLine===false)return;
    const attempt=syncKey(state);if(syncing.has(attempt)||(!manual&&syncAttempts.has(attempt)))return;
    syncAttempts.add(attempt);syncing.add(attempt);paintAll();
    const stillCurrent=()=>owner()===selectedOwner&&currentOwner===selectedOwner&&employee()===state.employee_id&&date()===state.scheduled_date;
    try{const result=await call('pointage_sync',{employee_id:state.employee_id,service_id:state.service_id,scheduled_date:state.scheduled_date,confirm:true},true),latest=states.get(state.service_id);if(stillCurrent()&&latest&&!latest.pending&&latest.start_event_id===result.state.start_event_id&&(!latest.stop_event_id||latest.stop_event_id===result.state.stop_event_id))await save({...latest,...result.state,key:`${selectedOwner}:${state.service_id}`,owner:selectedOwner,pending:false,error:null});}
    catch(e){const latest=states.get(state.service_id);if(stillCurrent()&&latest&&!latest.pending&&!visibleReceipt(latest)&&syncKey(latest)===attempt)await save({...latest,ogust_synced:false,ogust_destination:null,error:message(e)});}
    finally{syncing.delete(attempt);if(stillCurrent())paintAll();}
  }
  async function retry(serviceId){const selectedOwner=owner();for(const event of await all('events')){if(event.owner===selectedOwner&&event.service_id===serviceId&&event.blocked)await save(null,{...event,blocked:false});}const state=states.get(serviceId);if(state)await save({...state,blocked:false,error:null,status:state.stop_event_id?'completed':'active'});paintAll();flush();}
  const description=state=>{
    const base=time(state.started_at)+(state.ended_at?' → '+time(state.ended_at):'')+' · '+(state.blocked?'Envoi bloqué · vérification par le gestionnaire':state.validated?'Heures validées dans Ogust':state.pending?'Enregistré sur ce téléphone · en attente d’envoi':!visibleReceipt(state)?'Pointage enregistré · transmission à Ogust à confirmer':state.status==='active'?'Début transmis · Ogust : Ordre de mission':'Pointages transmis · Ogust : Ordre de mission · heures à valider');
    const report=state.report,reportText=report?' · Fiche : '+report.tasks.length+' tâches · '+(report.signature?'signature jointe':'client/référent absent'):'';
    return base+reportText+(state.error?' — '+state.error:'');
  };
  function paintTools(tools,sid,state,allowValidation=true){
    const transmitting=state?syncing.has(syncKey(state)):false;
    const signature=JSON.stringify([state?.status,state?.blocked,state?.start_photo,state?.end_photo,state?.report?.tasks,state?.report?.signature,state?.pending,visibleReceipt(state),state?.validated,transmitting,window.ACJ_INTERVENANTES_ROLE,allowValidation]);
    if(tools.dataset.signature===signature)return;
    tools.dataset.signature=signature;tools.replaceChildren();if(state?.start_photo)tools.appendChild(button('Photo début','',()=>viewPhoto(states.get(sid),'start')));if(state?.end_photo)tools.appendChild(button('Photo fin','',()=>viewPhoto(states.get(sid),'stop')));if(state?.report?.signature&&!state?.pending)tools.appendChild(button('Signature client','',()=>viewPhoto(states.get(sid),'signature')));if(state?.pending)tools.appendChild(button('Réessayer l’envoi','',()=>retry(sid)));if(state&&!state.pending&&!visibleReceipt(state)){const send=button(transmitting?'Transmission…':'Transmettre à Ogust','pointageSync',()=>syncExisting(states.get(sid),true));send.disabled=transmitting;tools.appendChild(send);}if(allowValidation&&state?.status==='completed'&&visibleReceipt(state)&&!state.pending&&!state.validated&&window.ACJ_INTERVENANTES_ROLE==='admin')tools.appendChild(button('Valider les heures réelles','pointageValidate',()=>validate(states.get(sid))));
  }
  function paint(card,service){
    const sid=String(service.id_service||''),b=card.querySelector('.pointage');if(!b||!sid)return;
    const state=states.get(sid),away=absent(service),closed=!!service.status&&service.status!=='A';b.dataset.state=state?.status==='completed'?'done':state?.status==='active'?'active':'ready';
    b.disabled=busy||!currentOwner||state?.blocked||state?.status==='completed'||(!state&&(away||closed||date()!==today()||otherActive(sid)));
    setText(b,state?.blocked?'POINTAGE À VÉRIFIER':state?.status==='active'?`TERMINER · ${elapsed(state.started_at)}`:state?.status==='completed'?`TERMINÉE · ${time(state.ended_at)}`:away?'ABSENCE DÉCLARÉE':closed?'PRESTATION CLÔTURÉE':date()!==today()?'POINTAGE LE JOUR PRÉVU':'DÉMARRER');b.onclick=()=>capture(service);
    let meta=card.querySelector('.pointageMeta');if(!meta){meta=document.createElement('div');meta.className='pointageMeta';card.appendChild(meta);}
    const text=state?description(state):away?'Absente · prestation à remplacer dans le planning.':'';
    let desc=meta.querySelector('.pointageDescription');if(!desc){desc=document.createElement('div');desc.className='pointageDescription';meta.appendChild(desc);}setText(desc,text);meta.hidden=!text;meta.classList.toggle('pending',away||!!state?.pending||!!state?.error);
    let tools=meta.querySelector('.pointageTools');if(!tools){tools=document.createElement('div');tools.className='pointageTools';meta.appendChild(tools);}
    paintTools(tools,sid,state);
  }
  function paintHistory(){
    const list=$('list');if(!list)return;
    const planned=new Set(rows.map(service=>String(service.id_service))),selectedOwner=owner();
    const recorded=$('app')?.hidden?[]:[...states.values()].filter(state=>selectedOwner&&state.owner===selectedOwner&&state.employee_id===employee()&&state.scheduled_date===date()&&!planned.has(state.service_id)).sort((a,b)=>String(a.started_at).localeCompare(String(b.started_at)));
    let history=$('pointageHistory');const empty=list.querySelector('.empty');if(empty)empty.hidden=recorded.length>0;
    if(!recorded.length){history?.remove();return;}
    if(!history){history=document.createElement('section');history.id='pointageHistory';history.className='pointageHistory';history.setAttribute('aria-label','Pointages enregistrés');list.appendChild(history);}
    const signature=JSON.stringify(recorded.map(state=>[state.service_id,state.scheduled_start,state.scheduled_end,description(state),state.start_photo,state.end_photo,syncing.has(syncKey(state))]));
    if(history.dataset.signature===signature)return;history.dataset.signature=signature;history.replaceChildren();
    const title=document.createElement('h2');title.textContent='Pointages enregistrés';history.appendChild(title);p(history,'Ces interventions n’apparaissent pas dans le planning de cette journée. Leurs pointages et leurs photos restent consultables.');
    for(const state of recorded){
      const entry=document.createElement('article');entry.className='pointageHistoryEntry';const heading=document.createElement('h3'),start=String(state.scheduled_start||''),end=String(state.scheduled_end||'');heading.textContent=start.length>=12&&end.length>=12?`Intervention prévue de ${start.slice(8,10)}:${start.slice(10,12)} à ${end.slice(8,10)}:${end.slice(10,12)}`:'Intervention pointée';entry.appendChild(heading);
      const meta=document.createElement('div');meta.className='pointageMeta';meta.classList.toggle('pending',!!state.pending||!!state.error);p(meta,description(state),'pointageDescription');const tools=document.createElement('div');tools.className='pointageTools';paintTools(tools,state.service_id,state,false);meta.appendChild(tools);entry.appendChild(meta);history.appendChild(entry);
    }
  }
  function paintAll(){cards.forEach((card,i)=>{if(card.isConnected)paint(card,rows[i]||{});});paintHistory();}
  async function flush(){
    if(flushing||!owner()||navigator.onLine===false)return;flushing=true;const selectedOwner=owner();
    try{const events=(await all('events')).filter(e=>e.owner===selectedOwner&&!e.blocked).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||(a.type==='start'?-1:1));const blockedServices=new Set();
      for(const event of events){if(owner()!==selectedOwner)break;if(blockedServices.has(event.service_id))continue;try{const {key:eventKey,owner:unused,blocked:unusedBlocked,...payload}=event,result=await call('pointage',payload,true);const old=states.get(event.service_id)||{},laterStop=old.stop_event_id&&!result.state.stop_event_id;const state=laterStop?{...old,error:null}:{...old,...result.state,pending:false,blocked:false,error:null};await save({...state,key:`${selectedOwner}:${event.service_id}`,owner:selectedOwner},null,eventKey);}catch(e){const old=states.get(event.service_id),permanent=e.status>=400&&e.status<500&&![401,429].includes(e.status);if(old)await save({...old,pending:true,blocked:permanent,status:permanent&&event.type==='start'&&!old.stop_event_id?'rejected':old.status,error:message(e)},permanent?{...event,blocked:true}:null);paintAll();if(permanent){blockedServices.add(event.service_id);continue;}break;}paintAll();}
    }catch(e){banner(message(e));}finally{flushing=false;paintAll();}
  }
  async function refresh(){
    const attempt=++generation,selectedOwner=owner(),eid=employee(),selectedDate=date();if(!selectedOwner||!eid||!selectedDate)return;
    try{currentOwner=selectedOwner;const cached=await all('states');if(attempt!==generation)return;states.clear();cached.filter(s=>s.owner===selectedOwner).forEach(s=>states.set(s.service_id,s));paintAll();
      const data=await call('pointage_day',{employee_id:eid,date:selectedDate});if(attempt!==generation||owner()!==selectedOwner||employee()!==eid||date()!==selectedDate)return;remoteActive=data.active||null;absences=data.absences||[];
      for(const state of data.pointages||[]){const local=states.get(state.service_id),differentStart=local?.blocked&&state.start_event_id!==local.start_event_id;if(local?.pending&&!differentStart)continue;await save({...local,...state,key:`${selectedOwner}:${state.service_id}`,owner:selectedOwner,pending:false,blocked:false,error:visibleReceipt(state)?null:local?.error||null});}
      banner('Dans Ogust : ouvrir l’intervention, puis « Ordre de mission ». Les heures réelles restent à valider par l’agence.');paintAll();flush();
      for(const state of data.pointages||[]){if(attempt!==generation||owner()!==selectedOwner||employee()!==eid||date()!==selectedDate)break;const current=states.get(state.service_id);if(current&&!current.pending&&!visibleReceipt(current))await syncExisting(current);}
    }catch(e){if(attempt===generation){banner(message(e));if(e.message==='POINTAGE_LOCAL_STORAGE_UNAVAILABLE')currentOwner='';paintAll();}}
  }
  function decorate(value){rows=Array.isArray(value)?value:[];cards=[...document.querySelectorAll('#list .card')];remoteActive=null;absences=[];paintAll();refresh();}
  function hook(){const original=window.render;if(typeof original!=='function'||original.__acjPointageWrapped)return false;const wrapped=function(value){const result=original.apply(this,arguments);decorate(value);return result;};wrapped.__acjPointageWrapped=true;window.render=wrapped;return true;}
  function deepLink(){const q=new URLSearchParams(location.search),eid=q.get('employee_id'),selectedDate=q.get('date');if(!q.has('pointage')||!eid||!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate||''))return;let n=0;const t=setInterval(()=>{const select=$('employee');if(owner()&&select&&[...select.options].some(o=>o.value===eid)&&!$('app')?.hidden){select.value=eid;if(typeof window.setDate==='function')window.setDate(selectedDate);else select.dispatchEvent(new Event('change'));clearInterval(t);}else if(++n>600)clearInterval(t);},500);}
  css();if(!hook()){let n=0;const t=setInterval(()=>{if(hook()||++n>40)clearInterval(t);},100);}
  window.addEventListener('online',()=>{flush();refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){flush();refresh();}});
  setInterval(()=>{if(!document.hidden)paintAll();},1000);setInterval(()=>{if(!$('app')?.hidden&&owner()&&!busy){flush();refresh();}},60000);deepLink();
})();

