(() => {
  const API='https://acj-ogust-proxy.vercel.app/api/intervenante-pilot',TOKEN='acj_intervenantes_google_token';
  // Never import the old local test queue as actual worked hours.
  const DB='acj_intervenantes_pointage_v2',states=new Map();
  let dbPromise,rows=[],cards=[],currentOwner='',busy=false,flushing=false,remoteActive=null,absences=[],generation=0;
  const $=id=>document.getElementById(id),token=()=>sessionStorage.getItem(TOKEN)||localStorage.getItem(TOKEN)||'';
  function owner(){try{return String(JSON.parse(atob(token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).email||'').toLowerCase();}catch{return '';}}
  const employee=()=>String($('employee')?.value||''),date=()=>String($('datePicker')?.value||''),key=id=>`${owner()}:${id}`;
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
  const time=iso=>iso?new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)):'';
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
    POINTAGE_PHOTO_INVALID:'La photo ne peut pas être lue. Prenez une nouvelle photo.',
    AUTH_REQUIRED:'Reconnectez-vous pour envoyer les pointages.',AUTH_INVALID:'Reconnectez-vous pour envoyer les pointages.'
  };
  const message=e=>messages[e?.message]||'Envoi indisponible. Le pointage et sa photo sont conservés sur ce téléphone pour réessayer.';
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const banner=value=>setText(document.querySelector('.banner'),value);
  function css(){const s=document.createElement('style');s.id='acj-pointage-css';s.textContent=`
    .pointage{background:#0f766e;color:white;cursor:pointer}.pointage[data-state="active"]{background:#b91c1c}.pointage[data-state="done"]{background:#dcfce7;color:#166534}.pointage:disabled{opacity:.65;cursor:default}
    .pointageMeta{margin-top:9px;padding:11px;border-radius:12px;background:#f0fdf4;font-size:12px;line-height:1.5;color:#166534}.pointageMeta.pending{background:#fff7ed;color:#9a3412}.pointageTools{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.pointageTools button{background:white;border:1px solid #cbd5e1;border-radius:10px;min-height:40px;padding:8px 12px;color:#334155;font-weight:800}.pointageTools .pointageValidate{background:#0f766e;color:white;border:0}
    .pointageDialog{width:min(calc(100% - 24px),520px);max-height:90dvh;border:0;border-radius:22px;padding:22px;color:#0f172a;overflow:auto}.pointageDialog::backdrop{background:rgba(15,23,42,.65)}.pointageDialog h2{font-size:22px;margin:0 0 10px}.pointageDialog p{line-height:1.5}.pointageDialog button{min-height:48px;border-radius:12px;padding:12px;font-weight:800;cursor:pointer}.pointageDialog .photoButton{width:100%;background:white;border:1px solid #cbd5e1}.pointageDialog img{max-width:100%;max-height:55dvh;object-fit:contain;border-radius:12px;margin-top:12px}.pointageDialog footer{display:flex;gap:8px;margin-top:18px}.pointageDialog .confirm{flex:1;background:#0f766e;color:white;border:0}.pointageDialog .cancel{background:#f1f5f9;color:#334155;border:0}.pointageDialog .error{color:#b91c1c;font-size:14px}.pointageDialog label{display:block;font-size:14px;color:#64748b;margin:8px 0}
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
    const label=document.createElement('label');label.textContent=phase==='start'?'Photo de début (facultative)':'Photo de fin (facultative)';d.appendChild(label);
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;d.appendChild(input);
    const photoButton=button('Prendre une photo','photoButton',()=>input.click());d.appendChild(photoButton);
    const preview=document.createElement('img');preview.alt='Photo de la prestation';preview.hidden=true;d.appendChild(preview);
    const error=p(d,'','error'),footer=document.createElement('footer');let photo=null,processing=false;
    const cancel=button('Annuler','cancel',()=>d.close()),confirm=button(phase==='start'?'Démarrer':'Terminer','confirm',async()=>{
      if(processing)return;
      if(phase==='stop'&&Date.now()-Date.parse(previous.started_at)<60000){setText(error,messages.POINTAGE_DURATION_INVALID);return;}
      processing=true;confirm.disabled=true;cancel.disabled=true;photoButton.disabled=true;const occurred_at=new Date().toISOString();
      try{const selectedOwner=owner();if(!selectedOwner||selectedOwner!==currentOwner)throw new Error('AUTH_REQUIRED');
        const event_id=crypto.randomUUID(),event={key:`${selectedOwner}:${event_id}`,owner:selectedOwner,event_id,type:phase,service_id:String(service.id_service),employee_id:employee(),scheduled_date:previous?.scheduled_date||date(),occurred_at,gps:await gps(),photo};
        const state={...previous,key:key(service.id_service),owner:selectedOwner,service_id:event.service_id,employee_id:event.employee_id,scheduled_date:event.scheduled_date,status:phase==='start'?'active':'completed',ogust_synced:false,error:null,pending:true};
        if(phase==='start')Object.assign(state,{started_at:occurred_at,start_event_id:event_id,start_photo:!!photo,start_gps_status:event.gps.status});else Object.assign(state,{ended_at:occurred_at,stop_event_id:event_id,end_photo:!!photo,end_gps_status:event.gps.status});
        await save(state,event);d.close();paintAll();flush();
      }catch(e){setText(error,message(e));confirm.disabled=false;cancel.disabled=false;photoButton.disabled=false;processing=false;}
    });
    input.onchange=async()=>{if(!input.files?.[0])return;confirm.disabled=true;setText(error,'');try{photo=await compress(input.files[0]);preview.src=photo;preview.hidden=false;setText(photoButton,'Reprendre la photo');}catch(e){setText(error,message(e));}finally{confirm.disabled=false;}};
    footer.append(cancel,confirm);d.appendChild(footer);d.addEventListener('cancel',e=>{if(processing)e.preventDefault();});d.addEventListener('close',()=>{busy=false;paintAll();},{once:true});
  }
  async function viewPhoto(state,phase){const d=dialog(phase==='start'?'Photo de début':'Photo de fin'),status=p(d,'Chargement de la photo…');d.appendChild(button('Fermer','cancel',()=>d.close()));try{const blob=await call('pointage_photo',{service_id:state.service_id,employee_id:state.employee_id,date:state.scheduled_date,type:phase},false,true);const img=document.createElement('img'),url=URL.createObjectURL(blob);img.src=url;img.alt=phase==='start'?'Photo de début':'Photo de fin';d.insertBefore(img,status);status.remove();d.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}catch{setText(status,'La photo sera consultable après son envoi.');}}
  async function validate(state){const d=dialog('Valider les heures réelles');p(d,`Prévu : ${state.scheduled_start?.slice(8,10)||'—'}:${state.scheduled_start?.slice(10,12)||'—'} → ${state.scheduled_end?.slice(8,10)||'—'}:${state.scheduled_end?.slice(10,12)||'—'}`);p(d,`Réalisé : ${time(state.started_at)} → ${time(state.ended_at)} · ${state.duration_minutes} min`);p(d,'La validation remplace les horaires de cette prestation dans Ogust, ajuste la quantité en heures et la marque « Réalisée ». Les pointages et le planning d’origine restent conservés.');const error=p(d,'','error'),footer=document.createElement('footer');const cancel=button('Annuler','cancel',()=>d.close()),confirm=button('Valider dans Ogust','confirm',async()=>{confirm.disabled=true;cancel.disabled=true;try{const result=await call('pointage_validate',{service_id:state.service_id,employee_id:state.employee_id,scheduled_date:state.scheduled_date,confirm:true},true);await save({...state,...result.state,key:key(state.service_id),owner:owner()});paintAll();d.close();if(typeof window.loadPlanning==='function')window.loadPlanning();}catch(e){setText(error,message(e));confirm.disabled=false;cancel.disabled=false;}});footer.append(cancel,confirm);d.appendChild(footer);}
  const absent=s=>absences.some(a=>String(a.start_date)<String(s.end_date||'')&&String(a.end_date)>String(s.start_date||''));
  const otherActive=sid=>[...states.values()].some(s=>s.employee_id===employee()&&s.service_id!==sid&&s.status==='active')||(remoteActive?.service_id&&remoteActive.service_id!==sid);
  function paint(card,service){
    const sid=String(service.id_service||''),b=card.querySelector('.pointage');if(!b||!sid)return;
    const state=states.get(sid),away=absent(service),closed=!!service.status&&service.status!=='A';b.dataset.state=state?.status==='completed'?'done':state?.status==='active'?'active':'ready';
    b.disabled=busy||!currentOwner||state?.status==='completed'||(!state&&(away||closed||date()!==today()||otherActive(sid)));
    setText(b,state?.status==='active'?`TERMINER · ${elapsed(state.started_at)}`:state?.status==='completed'?`TERMINÉE · ${time(state.ended_at)}`:away?'ABSENCE DÉCLARÉE':closed?'PRESTATION CLÔTURÉE':date()!==today()?'POINTAGE LE JOUR PRÉVU':'DÉMARRER');b.onclick=()=>capture(service);
    let meta=card.querySelector('.pointageMeta');if(!meta){meta=document.createElement('div');meta.className='pointageMeta';card.appendChild(meta);}
    const text=state?`${time(state.started_at)}${state.ended_at?` → ${time(state.ended_at)}`:''} · ${state.validated?'Heures validées dans Ogust':state.pending||!state.ogust_synced?'Enregistré sur ce téléphone · en attente d’envoi':state.status==='active'?'Début reçu par Ogust':'Pointages reçus par Ogust · heures à valider'}${state.error?` — ${state.error}`:''}`:away?'Absente · prestation à remplacer dans le planning.':'';
    let desc=meta.querySelector('.pointageDescription');if(!desc){desc=document.createElement('div');desc.className='pointageDescription';meta.appendChild(desc);}setText(desc,text);meta.hidden=!text;meta.classList.toggle('pending',away||!!state?.pending||!!state?.error);
    let tools=meta.querySelector('.pointageTools');if(!tools){tools=document.createElement('div');tools.className='pointageTools';meta.appendChild(tools);}
    const signature=JSON.stringify([state?.status,state?.start_photo,state?.end_photo,state?.pending,state?.ogust_synced,state?.validated,window.ACJ_INTERVENANTES_ROLE]);
    if(tools.dataset.signature!==signature){tools.dataset.signature=signature;tools.replaceChildren();if(state?.start_photo)tools.appendChild(button('Photo début','',()=>viewPhoto(states.get(sid),'start')));if(state?.end_photo)tools.appendChild(button('Photo fin','',()=>viewPhoto(states.get(sid),'stop')));if(state?.pending)tools.appendChild(button('Réessayer l’envoi','',()=>flush()));if(state?.status==='completed'&&state.ogust_synced&&!state.pending&&!state.validated&&window.ACJ_INTERVENANTES_ROLE==='admin')tools.appendChild(button('Valider les heures réelles','pointageValidate',()=>validate(states.get(sid))));}
  }
  function paintAll(){cards.forEach((card,i)=>{if(card.isConnected)paint(card,rows[i]||{});});}
  async function flush(){
    if(flushing||!owner()||navigator.onLine===false)return;flushing=true;const selectedOwner=owner();
    try{const events=(await all('events')).filter(e=>e.owner===selectedOwner).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||(a.type==='start'?-1:1));
      for(const event of events){if(owner()!==selectedOwner)break;try{const {key:eventKey,owner:unused,...payload}=event,result=await call('pointage',payload,true);const old=states.get(event.service_id)||{},laterStop=old.stop_event_id&&!result.state.stop_event_id;const state=laterStop?{...old,error:null}:{...old,...result.state,pending:false,error:null};await save({...state,key:`${selectedOwner}:${event.service_id}`,owner:selectedOwner},null,eventKey);}catch(e){const old=states.get(event.service_id);if(old)await save({...old,pending:true,error:message(e)});paintAll();break;}paintAll();}
    }catch(e){banner(message(e));}finally{flushing=false;paintAll();}
  }
  async function refresh(){
    const attempt=++generation,selectedOwner=owner(),eid=employee(),selectedDate=date();if(!selectedOwner||!eid||!selectedDate)return;
    try{currentOwner=selectedOwner;const cached=await all('states');if(attempt!==generation)return;states.clear();cached.filter(s=>s.owner===selectedOwner).forEach(s=>states.set(s.service_id,s));paintAll();
      const data=await call('pointage_day',{employee_id:eid,date:selectedDate});if(attempt!==generation||owner()!==selectedOwner||employee()!==eid||date()!==selectedDate)return;remoteActive=data.active||null;absences=data.absences||[];
      for(const state of data.pointages||[]){const local=states.get(state.service_id);if(local?.pending)continue;await save({...local,...state,key:`${selectedOwner}:${state.service_id}`,owner:selectedOwner,pending:false,error:null});}
      banner('Pointage avec photos · envoi à Ogust et validation des heures réelles.');paintAll();flush();
    }catch(e){if(attempt===generation){banner(message(e));if(e.message==='POINTAGE_LOCAL_STORAGE_UNAVAILABLE')currentOwner='';paintAll();}}
  }
  function decorate(value){rows=Array.isArray(value)?value:[];cards=[...document.querySelectorAll('#list .card')];remoteActive=null;absences=[];paintAll();refresh();}
  function hook(){const original=window.render;if(typeof original!=='function'||original.__acjPointageWrapped)return false;const wrapped=function(value){const result=original.apply(this,arguments);decorate(value);return result;};wrapped.__acjPointageWrapped=true;window.render=wrapped;return true;}
  function deepLink(){const q=new URLSearchParams(location.search),eid=q.get('employee_id'),selectedDate=q.get('date');if(!q.has('pointage')||!eid||!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate||''))return;let n=0;const t=setInterval(()=>{const select=$('employee');if(owner()&&select&&[...select.options].some(o=>o.value===eid)&&!$('app')?.hidden){select.value=eid;if(typeof window.setDate==='function')window.setDate(selectedDate);else select.dispatchEvent(new Event('change'));clearInterval(t);}else if(++n>600)clearInterval(t);},500);}
  css();if(!hook()){let n=0;const t=setInterval(()=>{if(hook()||++n>40)clearInterval(t);},100);}
  window.addEventListener('online',()=>{flush();refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){flush();refresh();}});
  setInterval(()=>{if(!document.hidden)paintAll();},1000);setInterval(()=>{if(!$('app')?.hidden&&owner()&&!busy){flush();refresh();}},60000);deepLink();
})();
