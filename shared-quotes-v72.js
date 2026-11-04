// Shared drafts and confirmed delivery history. The local copy remains durable
// until its exact version is acknowledged; a newer shared edit is never overwritten.
(function(){
  const API='https://acj-ogust-proxy.vercel.app/api/ogust-quotation';
  const SAVED='acj_devis_saved_v6',META='acj_devis_history_meta_v29',ACTIVE='acj_devis_active_v42',SYNC='acj_devis_shared_state_v72',DRAFTS='acj_devis_shared_drafts_v72';
  const COMPANIES=['ACJ Services','ACJ Services Lens','Jet Services'];
  const META_FIELDS=['ogust_id','ogust_number','ogust_status','ogust_status_label','ogust_snapshot','email_first_sent_confirmed_at','email_sent_confirmed_at','email_last_reminded_at','email_reminder_count'];
  const clone=x=>JSON.parse(JSON.stringify(x)),key=q=>`${q.societe}|${q.numero_devis}`;
  const uuid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
  const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
  let enabled=false,applying=false,timer=null,pullTask=null,syncTask=null,initializing=false,message='Connexion requise pour partager les devis.',failed=false;
  const sending=new Map(),conflicts=new Map(),sharedState=read(SYNC,{});
  let hidden=read('acj_devis_hidden_v72',{});
  let drafts=read(DRAFTS,{});
  function persist(){try{localStorage.setItem(SYNC,JSON.stringify(sharedState));localStorage.setItem(DRAFTS,JSON.stringify(drafts));return true}catch{setStatus('Stockage local plein. La saisie reste ouverte ; la synchronisation est suspendue.',true);return false}}
  function setStatus(text,error=false){message=text;failed=error;renderStatus()}
  function renderStatus(){
    for(const el of document.querySelectorAll('[data-shared-status72]')){el.textContent=message;el.classList.toggle('sharedError72',failed)}
    if(enabled){const localStatus=document.getElementById('draftStatus42');if(localStatus)localStatus.style.display='none'}
    const current=window.quotePayload?.();if(!current)return;
    const conflict=conflicts.get(key(current)),banner=document.getElementById('sharedConflict72');
    if(banner)banner.remove();
    if(conflict){const box=document.createElement('div');box.id='sharedConflict72';box.className='sharedConflict72';box.setAttribute('role','status');
      const text=document.createElement('p');text.textContent='Ce devis a une autre version partagée. Ta saisie est conservée sur cet appareil.';
      const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='Voir les deux versions';open.addEventListener('click',()=>resolveDialog(key(current)));box.append(text,open);document.querySelector('.top')?.after(box);
    }
  }
  function projected(q,meta={},draft){
    const quote={};for(const field of ['version','societe','numero_devis','date','mode','client','lignes','totaux','notes','availability_proposal'])if(q[field]!==undefined)quote[field]=clone(q[field]);
    const out={quote,meta:{}};for(const field of META_FIELDS)if(meta[field]!==undefined&&meta[field]!==null)out.meta[field]=clone(meta[field]);
    if(draft?.version===42&&draft.state?.company===q.societe&&draft.state.number===q.numero_devis){out.draft={};for(const field of ['version','state','inputs','clientChoice','clientDraft','clientForm','picker','workspace'])if(draft[field]!==undefined)out.draft[field]=clone(draft[field]);out.draft.state.step=quote.lignes.length?2:1;}
    return out;
  }
  function currentDraft(){const draft=read(ACTIVE,null);return draft?.state?.company&&draft?.state?.number?draft:null}
  function records(){
    const list=read(SAVED,[]),meta=read(META,{}),result=new Map();
    for(const q of list)if(COMPANIES.includes(q?.societe)&&q?.numero_devis&&!hidden[key(q)])result.set(key(q),projected(q,meta[key(q)]||{},drafts[key(q)]));
    const draft=currentDraft();if(draft){let q;try{q=window.quotePayload?.()}catch{}if(q&&!hidden[key(q)]&&q.societe===draft.state.company&&q.numero_devis===draft.state.number){if(result.get(key(q))?.quote.date)q.date=result.get(key(q)).quote.date;drafts[key(q)]=draft;result.set(key(q),projected(q,meta[key(q)]||{},draft))}}
    return result;
  }
  function apply(record){
    const q=record.quote,k=key(q),list=read(SAVED,[]),meta=read(META,{}),index=list.findIndex(x=>key(x)===k);
    const previous={};for(const item of [SAVED,META,SYNC,DRAFTS])previous[item]=localStorage.getItem(item);
    if(index<0)list.unshift(q);else list[index]=q;
    // Device-only pending handoffs stay on this device, never in the shared record.
    meta[k]={...(meta[k]||{})};for(const field of META_FIELDS)delete meta[k][field];Object.assign(meta[k],record.meta);
    if(record.draft)drafts[k]=record.draft;else delete drafts[k];
    try{localStorage.setItem(SAVED,JSON.stringify(list));localStorage.setItem(META,JSON.stringify(meta));localStorage.setItem(SYNC,JSON.stringify(sharedState));localStorage.setItem(DRAFTS,JSON.stringify(drafts))}catch{for(const [name,value] of Object.entries(previous))try{if(value===null)localStorage.removeItem(name);else localStorage.setItem(name,value)}catch{}drafts=read(DRAFTS,{});setStatus('La copie partagée est disponible, mais le stockage local est plein.',true);return false}
    return true;
  }
  function normalized(record){return projected(record.quote,record.meta,record.draft)}
  function same(a,b){return canonical(a)===canonical(b)}
  // Merge independent fields. Quote lines are atomic: two different edits to
  // the lines require a human choice, rather than a guessed combined quote.
  function merge(base,local,remote,path=''){
    if(same(local,remote))return local;if(same(local,base))return remote;if(same(remote,base))return local;
    if(/email_(?:last_reminded_at|sent_confirmed_at)$/.test(path))return [local,remote].filter(Boolean).sort().at(-1);
    if(/email_first_sent_confirmed_at$/.test(path))return [local,remote].filter(Boolean).sort()[0];
    if(path.endsWith('email_reminder_count'))return Math.max(Number(local)||0,Number(remote)||0);
    if(local&&remote&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(local)&&!Array.isArray(remote)){
      const out={};for(const field of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){const value=merge(base?.[field],local[field],remote[field],`${path}.${field}`);if(value!==undefined)out[field]=value}return out;
    }
    throw Error('SHARED_CONFLICT');
  }
  async function request(action,company,extra={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{const response=await rawFetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,company,...extra}),signal:controller.signal}),data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok)throw Object.assign(Error(data?.error||'SHARED_UNAVAILABLE'),{data,status:response.status});return data;
    }finally{clearTimeout(timeout)}
  }
  function backup(){
    if(localStorage.getItem('acj_devis_before_shared_v72'))return;
    const saved=read(SAVED,[]),meta=read(META,{}),active=currentDraft();
    try{localStorage.setItem('acj_devis_before_shared_v72',JSON.stringify({saved,meta,active,at:new Date().toISOString()}))}catch{throw Error('LOCAL_BACKUP_FAILED')}
  }
  function markConflict(k,remote){conflicts.set(k,remote);sharedState[k]={...(sharedState[k]||{}),conflict:remote,seen_version:remote.version};persist();setStatus('Une autre version est disponible. Ta copie locale est conservée.',true);window.dispatchEvent(new CustomEvent('acj:shared-quotes-updated'))}
  async function push(k){
    if(!enabled)return false;if(conflicts.has(k))return false;if(sending.has(k))return sending.get(k);
    const task=(async()=>{
      let record=records().get(k);if(!record)return false;
      let info=sharedState[k]||{},hash=canonical(record);const sentHash=hash;if(hash===info.hash)return true;
      let changeId=info.pending?.hash===hash?info.pending.id:uuid();
      sharedState[k]={...info,pending:{id:changeId,hash}};if(!persist())return false;
      try{
        let data;
        try{data=await request('shared_put',record.quote.societe,{record,base_version:info.version||null,change_id:changeId})}
        catch(error){
          const remote=error.data?.remote;if(error.data?.error!=='SHARED_CONFLICT'||!remote)throw error;
          const current=window.quotePayload?.();if(current&&key(current)===k&&!same(record.quote,remote.quote)){markConflict(k,remote);return false}
          let merged;try{merged=merge(info.hash?JSON.parse(info.hash):undefined,record,normalized(remote))}catch{markConflict(k,remote);return false}
          // A successful three-way merge is conditional on that same remote version.
          record=merged;hash=canonical(record);changeId=uuid();
          data=await request('shared_put',record.quote.societe,{record,base_version:remote.version,change_id:changeId});
          if(records().get(k)&&canonical(records().get(k))===sentHash){applying=true;try{apply(record)}finally{applying=false}}
        }
        sharedState[k]={version:data.version,hash:canonical(normalized(data.record)),updated_at:data.record.updated_at};persist();
        setStatus('Devis synchronisés entre les appareils.');return true;
      }catch(error){if(error.data?.error==='SHARED_CONFLICT'&&error.data.remote)markConflict(k,error.data.remote);else setStatus('Synchronisation indisponible. Ta saisie reste enregistrée sur cet appareil.',true);return false}
    })();sending.set(k,task);try{return await task}finally{sending.delete(k)}
  }
  async function pull(){
    if(!enabled)return false;if(pullTask)return pullTask;
    const task=(async()=>{
      try{backup();let pending=0;
        for(const company of COMPANIES){
          let more=true,turn=0;while(more&&turn++<85){
            const localRecords=records(),known={};for(const [k,info] of Object.entries(sharedState))if(k.startsWith(company+'|')&&(info.seen_version||info.version)&&(localRecords.has(k)||conflicts.has(k)||hidden[k]))known[k.slice(company.length+1)]=conflicts.has(k)?info.seen_version:info.version;
            const data=await request('shared_list',company,{known});
            for(const record of data.records||[]){
              if(record.quote?.societe!==company||typeof record.version!=='string')throw Error('SHARED_RESPONSE_INVALID');
              const k=key(record.quote),local=records().get(k),info=sharedState[k]||{},remote=normalized(record),remoteHash=canonical(remote);
              if(hidden[k]){sharedState[k]={version:record.version,hash:remoteHash,updated_at:record.updated_at};persist();continue}
              if(conflicts.has(k)){markConflict(k,record);pending++;continue}
              const current=window.quotePayload?.();if(local&&current&&key(current)===k&&!same(local.quote,remote.quote)){markConflict(k,record);pending++;continue}
              if(local&&canonical(local)!==info.hash&&canonical(local)!==remoteHash){
                let combined;try{combined=merge(info.hash?JSON.parse(info.hash):undefined,local,remote)}catch{markConflict(k,record);pending++;continue}
                if(!same(local,combined)){applying=true;try{apply(combined)}finally{applying=false}}
                sharedState[k]={version:record.version,hash:remoteHash,updated_at:record.updated_at};persist();continue;
              }
              // Keep an open editor stable; ask before loading a newer content version.
              applying=true;try{if(apply(record))sharedState[k]={version:record.version,hash:remoteHash,updated_at:record.updated_at}}finally{applying=false}
              persist();
            }
            // Conflicts are acknowledged for paging, without advancing their edit baseline.
            for(const c of data.catalogue||[]){const k=company+'|'+c.ref;if(conflicts.has(k))sharedState[k].seen_version=c.version}
            more=!!data.more;
            if(more){const blocked=Object.keys(sharedState).filter(k=>k.startsWith(company+'|')&&conflicts.has(k));if(blocked.length){for(const k of blocked)sharedState[k].paging_version=sharedState[k].seen_version}}
            if(!data.records?.length)break;
          }
        }
        setStatus(pending?'Des versions sont à vérifier. Les copies locales sont conservées.':'Devis synchronisés entre les appareils.',!!pending);
        window.dispatchEvent(new CustomEvent('acj:shared-quotes-updated'));return true;
      }catch{setStatus('Synchronisation indisponible. Ta saisie reste enregistrée sur cet appareil.',true);return false}
    })();pullTask=task;try{return await task}finally{pullTask=null}
  }
  async function sync(){if(!enabled)return false;if(syncTask)return syncTask;const task=(async()=>{window.acjDraftV42?.save();let ok=await pull();for(const k of records().keys())if(!conflicts.has(k)&&!await push(k))ok=false;if(conflicts.size)setStatus('Des versions sont à vérifier. Les copies locales sont conservées.',true);else if(!ok)setStatus('Synchronisation indisponible. Ta saisie reste sur cet appareil.',true);return ok})();syncTask=task;try{return await task}finally{syncTask=null}}
  function queue(){if(!enabled||applying||initializing)return;clearTimeout(timer);if([...records()].some(([k,record])=>!conflicts.has(k)&&canonical(record)!==sharedState[k]?.hash))setStatus('Saisie enregistrée sur cet appareil · synchronisation en attente.');timer=setTimeout(async()=>{if(pullTask){queue();return}for(const k of records().keys())if(!conflicts.has(k))await push(k)},1500)}
  function saveAsCopy(k){
    const record=records().get(k);if(!record)return;
    const backupKey='acj_devis_conflict_copies_v72',copies=read(backupKey,[]);copies.push({at:new Date().toISOString(),record});try{localStorage.setItem(backupKey,JSON.stringify(copies))}catch{setStatus('La copie locale n’a pas pu être conservée.',true);return}
    const ref=window.nextQuoteNumber(),copy=clone(record);copy.quote.numero_devis=ref;copy.meta={};if(copy.draft){copy.draft.state.number=ref;copy.draft.reopened=null}
    apply(copy);const remote=conflicts.get(k);if(remote){apply(remote);sharedState[k]={version:remote.version,hash:canonical(normalized(remote)),updated_at:remote.updated_at};conflicts.delete(k);persist()}
    window.openSavedQuoteV59(copy.quote.societe,ref,'edit');push(key(copy.quote));document.getElementById('sharedResolve72')?.remove();
  }
  function loadShared(k){
    const remote=conflicts.get(k);if(!remote)return;
    // Always keep the discarded local editor as a recoverable local copy.
    const copies=read('acj_devis_conflict_copies_v72',[]),local=records().get(k);if(local)copies.push({at:new Date().toISOString(),record:local});
    try{localStorage.setItem('acj_devis_conflict_copies_v72',JSON.stringify(copies))}catch{setStatus('La copie locale n’a pas pu être conservée.',true);return}
    let base;try{base=JSON.parse(sharedState[k]?.hash||'null')}catch{}
    if(local&&!same(local.quote,base?.quote)&&!same(local.quote,remote.quote)){const copy=clone(local),ref=window.nextQuoteNumber();copy.quote.numero_devis=ref;copy.meta={};if(copy.draft)copy.draft.state.number=ref;if(!apply(copy))return;queue()}
    if(!apply(remote))return;sharedState[k]={version:remote.version,hash:canonical(normalized(remote)),updated_at:remote.updated_at};conflicts.delete(k);persist();document.getElementById('sharedResolve72')?.remove();window.openSavedQuoteV59(remote.quote.societe,remote.quote.numero_devis,'view');setStatus('Version partagée chargée. La saisie différente reste disponible dans les brouillons.');
  }
  function resolveDialog(k){
    document.getElementById('sharedResolve72')?.remove();const remote=conflicts.get(k),local=records().get(k);if(!remote||!local)return;
    const overlay=document.createElement('div');overlay.id='sharedResolve72';overlay.className='sharedOverlay72';const dialog=document.createElement('section');dialog.className='sharedDialog72';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Versions du devis');
    const title=document.createElement('h2');title.textContent='Deux versions du devis';const detail=document.createElement('p');detail.textContent=`${local.quote.client.nom||'Client'} · ${local.quote.numero_devis}. La version partagée a été enregistrée le ${new Date(remote.updated_at).toLocaleString('fr-FR')}.`;
    const options=[['Charger la version partagée',()=>loadShared(k)],['Garder ma saisie dans un nouveau brouillon',()=>saveAsCopy(k)],['Fermer',()=>overlay.remove()]];
    dialog.append(title,detail);for(const [label,action] of options){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.addEventListener('click',action);dialog.appendChild(button)}overlay.appendChild(dialog);document.body.appendChild(overlay);dialog.querySelector('button').focus();
  }
  function decorate(){
    const modal=document.querySelector('.histModal');if(!modal)return;
    const sub=modal.querySelector('.histSub');if(sub&&enabled)sub.textContent='Devis partagés · suivi des envois confirmés.';
    if(!modal.querySelector('.sharedHistory72')){const row=document.createElement('div');row.className='sharedHistory72';const text=document.createElement('span');text.dataset.sharedStatus72='1';text.setAttribute('role','status');const ogust=document.createElement('button');ogust.type='button';ogust.textContent='Retrouver dans Ogust';ogust.addEventListener('click',()=>discover());row.append(text,ogust);modal.querySelector('.histTools').before(row)}
    const row=modal.querySelector('.sharedHistory72');row.querySelector('[data-hidden72]')?.remove();if(Object.keys(hidden).length){const b=document.createElement('button');b.type='button';b.dataset.hidden72='1';b.textContent=`Réafficher (${Object.keys(hidden).length})`;b.addEventListener('click',()=>{hidden={};localStorage.setItem('acj_devis_hidden_v72','{}');sync()});row.appendChild(b)}
    for(const card of modal.querySelectorAll('.histCard')){const index=Number(card.dataset.historyIndex),q=window.acjHistory71?.displayed()[index];if(!q||!conflicts.has(key(q))||card.querySelector('.sharedVersion72'))continue;const b=document.createElement('button');b.type='button';b.className='btn sharedVersion72';b.textContent='Versions à vérifier';b.addEventListener('click',()=>resolveDialog(key(q)));card.appendChild(b)}renderStatus();
  }
  async function discover(){
    document.getElementById('sharedDiscover72')?.remove();const company=document.getElementById('historyCompany')?.value||window.quotePayload?.().societe||COMPANIES[0];
    const overlay=document.createElement('div');overlay.id='sharedDiscover72';overlay.className='sharedOverlay72';const dialog=document.createElement('section');dialog.className='sharedDialog72';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Devis Ogust');
    const title=document.createElement('h2');title.textContent=`Devis Ogust · ${company}`;const note=document.createElement('p');note.setAttribute('role','status');const list=document.createElement('div');list.className='sharedDiscoverList72';const more=document.createElement('button');more.type='button';more.className='btn';more.textContent='Charger la suite';const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Fermer';close.addEventListener('click',()=>overlay.remove());dialog.append(title,note,list,more,close);overlay.appendChild(dialog);document.body.appendChild(overlay);let page=0;
    async function load(){more.disabled=true;note.textContent='Lecture des devis Ogust…';try{const response=await rawFetch(`${API}?action=history&company=${encodeURIComponent(company)}&limit=40&days=1460&page=${++page}`,{cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok)throw Error();if(!overlay.isConnected)return;
      for(const item of data.quotations||[]){const row=document.createElement('div'),label=document.createElement('p');label.textContent=`${item.number||item.id_quotation} · ${item.status_label||item.status||'Statut à vérifier'}`;const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Ajouter à Mes devis';button.addEventListener('click',async()=>{button.disabled=true;note.textContent='Récupération du devis…';try{const data=await request('shared_import',company,{id_quotation:String(item.id_quotation)});if(!overlay.isConnected)return;const record=data.record,k=key(record.quote),local=records().get(k);if(local&&!same(local.quote,record.quote)){markConflict(k,{...record,version:sharedState[k]?.version||'',updated_at:new Date().toISOString()});note.textContent='Une copie existe déjà. Vérifie ses versions dans Mes devis.';return}apply(record);await push(k);button.textContent='Ajouté';note.textContent='Devis ajouté au suivi partagé.';window.dispatchEvent(new CustomEvent('acj:shared-quotes-updated'))}catch(error){button.disabled=false;note.textContent=error.data?.error==='SHARED_OGUST_NOT_FROM_APP'?'Ce devis se consulte dans Ogust. Les devis créés par l’application peuvent être repris ici.':'La récupération a échoué. Réessaie.'}});row.append(label,button);list.appendChild(row)}note.textContent=list.children.length?`${list.children.length} devis affichés.`:'Aucun devis trouvé.';more.hidden=(data.quotations||[]).length<40;
    }catch{note.textContent='Lecture Ogust indisponible. Réessaie.';page--}finally{more.disabled=false}}
    if(company==='Jet Services'){note.textContent='La connexion Ogust de Jet Services reste à configurer.';more.hidden=true;return}more.addEventListener('click',load);await load();
  }
  const rawFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    let target=null;if(enabled&&String(init?.method||'').toUpperCase()==='POST')try{const url=new URL(String(input?.url||input),location.href),body=typeof init.body==='string'?JSON.parse(init.body):null;if(url.origin===new URL(API).origin&&url.pathname==='/api/ogust-quotation'&&body?.quote?.societe&&body.quote.numero_devis)target=body.quote}catch{}
    if(target){let saved=false;try{window.acjDraftV42?.save();saved=await push(key(target))}catch{}if(!saved){const conflict=conflicts.has(key(target)),error=conflict?'SHARED_CONFLICT':'SHARED_SYNC_REQUIRED';setStatus(conflict?'Une autre version partagée doit être vérifiée avant de continuer.':'Synchronisation indisponible. Ta saisie reste sur cet appareil.',true);return new Response(JSON.stringify({ok:false,error}),{status:409,headers:{'Content-Type':'application/json'}})}}
    return rawFetch(input,init);
  };
  const next=window.nextQuoteNumber;if(typeof next==='function')window.nextQuoteNumber=function(){return next.apply(this,arguments)+'-'+uuid().replaceAll('-','').slice(0,16)};
  const style=document.createElement('style');style.textContent='.sharedHistory72{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:10px 0}.sharedHistory72 span{width:100%;font-size:11px;line-height:1.5;color:#526d83}.sharedHistory72 button{min-height:40px;border:1px solid #d4e2ec;background:#fff;color:#29516b;border-radius:9px;padding:7px 9px;font-size:11px}.sharedError72{color:#965820!important}.sharedConflict72{padding:12px;border:1px solid #e6c47a;background:#fff8e9;border-radius:12px;color:#705112;font-size:12px;margin:10px}.sharedConflict72 p{margin:0 0 8px}.sharedOverlay72{position:fixed;inset:0;z-index:18000;background:#17334888;display:flex;align-items:center;justify-content:center;padding:12px}.sharedDialog72{width:min(520px,100%);max-height:92dvh;overflow:auto;display:grid;gap:10px;background:#f7fbfe;border-radius:18px;padding:18px;color:#203c50}.sharedDialog72 h2{font-size:20px;margin:0}.sharedDialog72 p{font-size:13px;line-height:1.5;margin:0}.sharedDialog72 .btn{min-height:46px}.sharedDiscoverList72{display:grid;gap:10px}.sharedDiscoverList72>div{display:grid;gap:7px;background:white;border:1px solid #d4e2ec;border-radius:12px;padding:10px}.sharedVersion72{width:100%;margin-top:10px}';document.head.appendChild(style);
  function init(){
    for(const [k,value] of Object.entries(sharedState))if(value.conflict)conflicts.set(k,value.conflict);
    const status=document.createElement('div');status.id='sharedStatus72';status.dataset.sharedStatus72='1';status.setAttribute('role','status');status.style.cssText='font-size:11px;text-align:center;color:#64748b;padding:3px 12px';document.querySelector('.top')?.appendChild(status);
    for(const event of ['acj:local-quote-changed','acj:draft-saved','acj:quote-reopened'])window.addEventListener(event,queue);
    window.addEventListener('storage',event=>{if([SAVED,META,ACTIVE].includes(event.key))queue()});
    window.addEventListener('online',()=>sync());window.addEventListener('focus',()=>{if(enabled)sync()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&enabled)sync()});
    window.addEventListener('acj:history-rendered',decorate);window.addEventListener('acj:shared-quotes-updated',()=>{window.acjHistory71?.render?.();renderStatus()});
    window.addEventListener('acj:auth-ready',async event=>{if(event.detail?.legacy)return;enabled=true;initializing=true;setStatus('Synchronisation des devis…');try{await sync()}finally{initializing=false;queue()}});
    const originalOpen=window.openSavedQuoteV59;window.openSavedQuoteV59=async function(company,ref,target='view'){
      const k=company+'|'+ref,opening=originalOpen.apply(this,arguments),reopened=window.acjReopenedQuoteV33;await opening;
      if(window.acjReopenedQuoteV33!==reopened)return;
      if(drafts[k]&&!conflicts.has(k)){applying=true;try{window.acjDraftV42?.restoreShared?.(drafts[k]);if(target==='view')window.goStep?.(4)}finally{applying=false}}
      renderStatus();
    };
    const openHistory=window.openQuoteHistoryV29;window.openQuoteHistoryV29=function(){const result=openHistory.apply(this,arguments);decorate();if(enabled)sync();return result};
    // The menu listener captures its function before this module loads.
    document.getElementById('historyOpenBtn')?.addEventListener('click',()=>{decorate();if(enabled)sync()});
    window.acjSharedQuotes72={sync,push,records,resolve:resolveDialog,isShared(q){return !!(enabled&&q&&sharedState[key(q)]?.version)},hideLocal(company,ref){hidden[company+'|'+ref]=true;localStorage.setItem('acj_devis_hidden_v72',JSON.stringify(hidden))},get enabled(){return enabled},get drafts(){return drafts}};
    renderStatus();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
