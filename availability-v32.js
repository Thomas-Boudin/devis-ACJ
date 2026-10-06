// Disponibilités : propositions vérifiées, jamais réservations automatiques.
(function(){
  if(window.__acjAvailabilityV32)return;
  const API='https://acj-ogust-proxy.vercel.app/api/ogust-history';
  let selectedSlot=null,slots=[],responseMeta=null,loading=false,generation=0,controller=null,visible=3;
  let contextStamp='',lastQuoteHours=null,manualDuration=false,hasSearched=false,unverifiedSlots=0;
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function currentState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
  function activity(){return currentState()?.mode||'jardin'}
  function company(){return currentState()?.company||'ACJ Services'}
  function selectedClient(){try{return window.ogustClientChoiceV21?.company===company()?window.ogustClientChoiceV21?.selected||null:null}catch{return null}}
  function selectedClientId(){return String(selectedClient()?.id_customer||'').trim()}
  function tomorrow(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function estimateHours(){return (currentState()?.lines||[]).filter(l=>l?.type==='service'&&/^(h|heure|heures)$/i.test(String(l.unit||'').trim())).reduce((sum,l)=>sum+(Number(l.qty)||0),0)}
  function formatDate(iso){try{return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'short'}).format(new Date(`${iso}T12:00:00`))}catch{return iso}}
  function ruleText(mode){const source=(mode==='jardin'||mode==='bricol')?'JB, Vincent et Yohann : Google Agenda. Les autres : Ogust.':'Planning des intervenants : Ogust.';return `${source} Horaires de base client/intervenant, interventions et absences connus sont croisés. Les trajets ne sont pas estimés.`}
  function context(){const s=currentState()||{};return {company:company(),quote:String(s.number||''),customer:selectedClientId(),client:String(byId('client')?.value??s.client??''),address:String(byId('adresse')?.value??s.address??''),activity:activity(),quote_hours:estimateHours()}}
  function contextKey(){return JSON.stringify(context())}
  function preferences(){return {duration_minutes:Math.round(Number(byId('av32Duration')?.value||0)*60),from:byId('av32From')?.value||tomorrow(),days:Number(byId('av32Days')?.value||14),period:byId('av32Period')?.value||'any',weekday:byId('av32Weekday')?.value||'',employee:byId('av32Employee')?.value||'',manual_duration:manualDuration}}
  function requestKey(){const p=preferences();return JSON.stringify({context:context(),duration:p.duration_minutes,from:p.from,days:p.days,period:p.period})}
  function status(text,type=''){const el=byId('av32Status');if(el){el.textContent=text;el.className=`av32Status ${type}`.trim()}}
  function notify(){window.dispatchEvent(new CustomEvent('acj:availability-changed'))}
  function reset(message='',clearProposal=true){
    generation++;controller?.abort();controller=null;loading=false;slots=[];responseMeta=null;selectedSlot=null;visible=3;hasSearched=false;unverifiedSlots=0;
    if(clearProposal&&currentState())delete currentState().availabilityProposal;
    byId('av32Results')?.replaceChildren();byId('av32Selected')?.replaceChildren();
    const button=byId('av32Search');if(button){button.disabled=false;button.textContent='Chercher les créneaux'}
    if(message)status(message);notify();
  }
  function clearSelected(){selectedSlot=null;if(currentState())delete currentState().availabilityProposal;byId('av32Selected')?.replaceChildren();notify()}

  function addStyles(){
    if(byId('availability-v32-style'))return;
    const style=document.createElement('style');style.id='availability-v32-style';style.textContent=`
      .av32Card{background:#fff;border:1px solid #dfe8f0;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(24,55,86,.065);margin-bottom:13px}
      .av32Head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.av32Title{font-size:14px;font-weight:860;color:#1b3048}.av32Tag{font-size:10px;color:#64778a}.av32Client{font-size:11px;color:#52687e;margin-bottom:10px}
      .av32Fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.av32Field label{font-size:11px;color:#3a5068}.av32Field input,.av32Field select{width:100%;min-height:44px;border:1px solid #d7e2eb;border-radius:12px;padding:10px 11px;font:inherit}.av32Hint{font-size:10px;color:#718197;margin-top:5px}.av32Reset{border:0;background:transparent;color:#0b78c9;font-size:11px;padding:5px 0;cursor:pointer}
      .av32Preferences{margin:10px 0}.av32Preferences>.av32Fields{padding:0 12px 12px}.av32Search{width:100%;min-height:47px;margin-top:8px;border:0;border-radius:13px;background:linear-gradient(135deg,#0877c7,#14a4c8);color:#fff;font-weight:850}.av32Search:disabled{background:#e7edf2;color:#97a7b6}
      .av32Status{font-size:11px;line-height:1.45;color:#718197;margin-top:10px}.av32Status.err,.av32Status.warn,.av32Status.ok{padding:9px 10px;border:1px solid;border-radius:11px}.av32Status.err{color:#a33d43;background:#fff3f3;border-color:#efd0d2}.av32Status.warn{color:#7b5b13;background:#fff8e7;border-color:#ecd9a5}.av32Status.ok{color:#246744;background:#edf8f2;border-color:#c4e7d2}
      .av32Results{display:grid;gap:10px;margin-top:12px}.av32DateGroup{display:grid;gap:7px}.av32DayTitle{font-size:12px;font-weight:850;color:#315069;margin:4px 0}.av32Slot{width:100%;border:1px solid #dce6ee;background:#fff;border-radius:13px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:10px;text-align:left;color:#173049}.av32Slot.selected{border-color:#55acd5;background:#eef8fd}.av32When{font-size:13px;font-weight:860}.av32Who{font-size:11px;color:#667b90;margin-top:3px}.av32Meta{font-size:10px;color:#8a9aab;margin-top:4px}.av32Source{align-self:center;font-size:9px;font-weight:850;border-radius:999px;padding:5px 7px;border:1px solid #d9e4ec;background:#f6f9fb;color:#64778a}.av32Source.google{border-color:#bfe3d0;background:#eef9f3;color:#27754e}
      .av32Selected{margin-top:10px;border:1px solid #bfe3d0;background:#eef9f3;color:#246744;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.5}.av32Selected.recheck{background:#fff8e7;border-color:#ecd9a5;color:#7b5b13}.av32More{width:100%;border:1px solid #d7e2eb;border-radius:12px;background:#fff;color:#315069;min-height:42px;font-size:12px;font-weight:750}.av32SourceInfo{font-size:10px;color:#718197;line-height:1.5;padding:0 12px 12px}.av32Clear{border:0;background:transparent;color:#315069;text-decoration:underline;padding:6px 0;font-size:11px}
      @media(max-width:520px){.av32Card{padding:14px}.av32Preferences>.av32Fields{grid-template-columns:1fr 1fr}.av32EmployeeField{grid-column:1/-1}}
    `;document.head.appendChild(style);
  }
  function panelHtml(){return `<div class="av32Head"><div class="av32Title">Proposer un créneau</div><div class="av32Tag">Sans réservation</div></div>
    <div class="av32Client" id="av32Client"></div>
    <div class="av32Fields"><div class="av32Field"><label for="av32Duration">Durée prévue (h)</label><input id="av32Duration" type="number" min="0.5" max="10" step="0.25" placeholder="ex. 4"><div class="av32Hint" id="av32DurationHint"></div><button type="button" class="av32Reset" id="av32DurationReset" hidden>Reprendre la durée du devis</button></div><div class="av32Field"><label for="av32From">À partir du</label><input id="av32From" type="date" value="${tomorrow()}"></div></div>
    <details class="av32Preferences"><summary>Préférences (facultatif)</summary><div class="av32Fields"><div class="av32Field"><label for="av32Period">Moment de la journée</label><select id="av32Period"><option value="any">Indifférent</option><option value="morning">Matin · avant 12 h</option><option value="afternoon">Après-midi · dès 13 h</option></select></div><div class="av32Field"><label for="av32Weekday">Jour préféré</label><select id="av32Weekday"><option value="">Tous les jours</option><option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option></select></div><div class="av32Field"><label for="av32Days">Chercher sur</label><select id="av32Days"><option value="7">7 jours</option><option value="14" selected>14 jours</option><option value="21">21 jours</option></select></div><div class="av32Field av32EmployeeField"><label for="av32Employee">Filtrer par intervenant</label><input id="av32Employee" type="search" placeholder="Nom ou prénom"></div></div></details>
    <button type="button" class="av32Search" id="av32Search">Chercher les créneaux</button><div class="av32Status" id="av32Status" role="status" aria-live="polite"></div><div class="av32Results" id="av32Results"></div><div id="av32Selected"></div>
    <details><summary>Sources et vérifications</summary><div class="av32SourceInfo" id="av32Intro"></div></details>`}
  function ensurePanel(){
    addStyles();const old=byId('av31Panel');if(old)old.style.display='none';const step=document.querySelector('.step[data-step="4"]');if(!step)return null;
    let panel=byId('av32Panel');if(panel)return panel;
    panel=document.createElement('div');panel.id='av32Panel';panel.className='av32Card';panel.innerHTML=panelHtml();
    const cards=Array.from(step.children).filter(el=>el.classList.contains('card'));if(cards.at(-1))step.insertBefore(panel,cards.at(-1));else step.appendChild(panel);
    byId('av32Search').addEventListener('click',search);
    byId('av32Duration').addEventListener('input',()=>{manualDuration=true;updateDurationHint();reset('Durée modifiée. Recherche les créneaux correspondants.')});
    byId('av32DurationReset').addEventListener('click',()=>{manualDuration=false;byId('av32Duration').value=estimateHours()||'';updateDurationHint();reset('Durée du devis reprise. Recherche les créneaux correspondants.')});
    for(const id of ['av32From','av32Days','av32Period'])byId(id).addEventListener('change',()=>reset('Préférences modifiées. Recherche les créneaux correspondants.'));
    for(const id of ['av32Weekday','av32Employee'])byId(id).addEventListener(id==='av32Employee'?'input':'change',()=>{clearSelected();visible=3;renderSlots()});
    return panel;
  }
  function updateDurationHint(){const h=estimateHours();if(byId('av32DurationHint'))byId('av32DurationHint').textContent=manualDuration?'Durée ajustée pour cette proposition.':h>0?`Reprise du devis : ${String(h).replace('.',',')} h.`:'Durée à renseigner pour les prestations au forfait.';if(byId('av32DurationReset'))byId('av32DurationReset').hidden=!manualDuration}
  function refreshContext(){
    if(!ensurePanel())return;const next=contextKey(),hours=estimateHours();
    if(contextStamp&&contextStamp!==next)reset('Le devis ou le client a changé. Recherche de nouveaux créneaux.');contextStamp=next;
    if(lastQuoteHours===null||lastQuoteHours!==hours){lastQuoteHours=hours;manualDuration=false;byId('av32Duration').value=hours>0?String(hours):''}
    updateDurationHint();byId('av32Intro').textContent=ruleText(activity());const client=selectedClient();byId('av32Client').textContent=client?.id_customer?`Client Ogust : ${client.label||client.id_customer}`:'Aucun client Ogust choisi : contraintes client non vérifiées.';
    if(!slots.length&&!loading&&!hasSearched&&!currentState()?.availabilityProposal)status(hours>0?`Durée du devis : ${String(hours).replace('.',',')} h. Choisis une date puis cherche les créneaux.`:'Renseigne la durée prévue pour chercher un créneau.');
  }
  function validSlot(slot){return slot&&/^\d{4}-\d{2}-\d{2}$/.test(slot.date||'')&&/^\d{2}:\d{2}$/.test(slot.start||'')&&/^\d{2}:\d{2}$/.test(slot.end||'')&&slot.end>slot.start&&['google','ogust'].includes(slot.source)&&typeof slot.intervenant==='string'&&!!slot.intervenant.trim()}
  function slotKey(slot){return [slot.source,slot.employee_key||slot.id_intervenant||slot.intervenant,slot.date,slot.start,slot.end].join('|')}
  function warningText(code){
    const messages={GOOGLE_UNAVAILABLE:'Un planning Google Agenda n’a pas pu être vérifié.',GOOGLE_CALENDAR_UNAVAILABLE:'Un agenda Google n’a pas pu être vérifié.',GOOGLE_EMPLOYEE_ID_MISSING:'Un intervenant Google n’a pas pu être rattaché à son profil Ogust.',EMPLOYEE_PROFILE_MISSING:'Certains profils d’intervenants n’ont pas pu être vérifiés.',EMPLOYEE_ID_MISSING:'Certains intervenants n’ont pas de profil Ogust vérifiable.',BASE_AVAILABILITY_UNAVAILABLE:'Les horaires de base Ogust n’ont pas pu être vérifiés.'};
    return messages[code]||(/GOOGLE/.test(String(code))?'Un planning Google Agenda n’a pas pu être vérifié.':code==='CANCELLATION_STATUSES_UNAVAILABLE'?'Les statuts d’annulation Ogust n’ont pas pu être lus : certaines disponibilités peuvent être masquées.':'')||'Certains plannings ou profils n’ont pas pu être vérifiés. Seuls les créneaux vérifiés sont affichés.';
  }
  function errorText(code){
    const value=String(code||'');
    if(/CUSTOMER|CLIENT/.test(value))return 'La fiche ou les contraintes du client n’ont pas pu être vérifiées';
    if(/BASE|AVAILABILITY_READ/.test(value))return 'Les horaires de base Ogust n’ont pas pu être vérifiés';
    if(/OGUST/.test(value))return 'La lecture complète du planning ou des absences Ogust a échoué';
    if(value==='INVALID_DATE_RANGE')return 'Choisis une date à partir d’aujourd’hui';
    if(value==='INVALID_DURATION')return 'La durée demandée est invalide';
    return 'Les plannings n’ont pas pu être vérifiés. Réessaie lorsque la connexion est disponible';
  }
  function warnings(){const list=[...(Array.isArray(responseMeta?.warnings)?responseMeta.warnings:[]),...(Array.isArray(responseMeta?.verification?.warnings)?responseMeta.verification.warnings:[])];const out=list.map(w=>typeof w==='string'?warningText(w):String(w?.message||w?.detail||warningText(w?.code||'')));if(unverifiedSlots)out.push('Des créneaux non vérifiés ont été exclus.');if(slots.some(slot=>slot.assumptions?.includes('employee_hours_unconfigured')))out.push('Des horaires de base intervenant ne sont pas renseignés : confirme le créneau avec lui.');if(slots.some(slot=>slot.assumptions?.includes('client_hours_unconfigured')))out.push('Les horaires de base client ne sont pas renseignés : confirme sa disponibilité.');if(slots.some(slot=>slot.assumptions?.includes('client_not_selected')))out.push('Aucun client Ogust choisi : sa disponibilité n’a pas été vérifiée.');if(responseMeta?.base_availability?.available===false)out.push('Les horaires de base Ogust n’ont pas pu être lus.');for(const [source,data] of Object.entries(responseMeta?.sources||{}))if(data?.queried&&data.available===false)out.push(`Planning ${source==='google'?'Google Agenda':'Ogust'} indisponible.`);return [...new Set(out)]}
  function filteredSlots(){const p=preferences(),needle=norm(p.employee);return slots.filter(slot=>(p.period==='any'||p.period==='morning'&&slot.end<='12:00'||p.period==='afternoon'&&slot.start>='13:00')&&(p.weekday===''||new Date(`${slot.date}T12:00:00`).getDay()===Number(p.weekday))&&(!needle||norm(slot.intervenant).includes(needle))).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.intervenant.localeCompare(b.intervenant,'fr'))}
  function renderStatus(){const found=filteredSlots(),issues=warnings();if(!slots.length){status(issues.length?`Aucun créneau vérifié disponible. ${issues.join(' ')}`:'Aucun créneau trouvé sur cette période. Essaie une autre date ou une durée plus courte.',issues.length?'warn':'');return}if(!found.length){status('Aucun créneau ne correspond à ces préférences. Change le jour ou le nom de l’intervenant.');return}const checked=Number.isFinite(Date.parse(responseMeta?.checked_at||''))?` Vérifiés le ${new Date(responseMeta.checked_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}.`:'';status(`${found.length} créneau${found.length>1?'x':''} à proposer.${checked}${issues.length?' '+issues.join(' '):''}${responseMeta?.verification?.complete===false&&!issues.length?' Certains contrôles sont incomplets.':''}`,issues.length||responseMeta?.verification?.complete===false?'warn':'ok')}
  function renderSlots(){
    const box=byId('av32Results');if(!box)return;box.replaceChildren();if(loading&&!responseMeta){status('Vérification des horaires, des interventions et des absences…');return}const found=filteredSlots();renderStatus();
    let day='',group=null;
    for(const slot of found.slice(0,visible)){
      if(slot.date!==day){day=slot.date;group=document.createElement('div');group.className='av32DateGroup';const heading=document.createElement('div');heading.className='av32DayTitle';heading.textContent=formatDate(day);group.appendChild(heading);box.appendChild(group)}
      const button=document.createElement('button');button.type='button';button.className='av32Slot';button.setAttribute('aria-pressed',String(selectedSlot&&slotKey(selectedSlot)===slotKey(slot)));if(selectedSlot&&slotKey(selectedSlot)===slotKey(slot))button.classList.add('selected');
      const base=[];if(slot.employee_base_configured)base.push('horaires intervenant');if(slot.client_base_configured)base.push('horaires client');
      button.innerHTML=`<div><div class="av32When">${esc(slot.start)}–${esc(slot.end)}</div><div class="av32Who">${esc(slot.intervenant)}</div><div class="av32Meta">${base.length?`Croisé avec ${esc(base.join(' + '))}`:'Horaires de base non renseignés pour ce profil'}</div></div><span class="av32Source ${slot.source==='google'?'google':''}">${slot.source==='google'?'Google Agenda':'Ogust'}</span>`;
      button.addEventListener('click',()=>selectSlot(slot));group.appendChild(button);
    }
    if(found.length>visible){const more=document.createElement('button');more.type='button';more.className='av32More';more.id='av32More';more.textContent=`Voir ${Math.min(6,found.length-visible)} créneaux de plus (${found.length-visible} restants)`;more.addEventListener('click',()=>{visible+=6;renderSlots()});box.appendChild(more)}
    if(responseMeta?.truncated&&found.length<=visible){const note=document.createElement('div');note.className='av32Hint';note.textContent='D’autres possibilités peuvent exister. Affine la date ou la période pour les rechercher.';box.appendChild(note)}
  }
  function renderProposal(proposal){
    const box=byId('av32Selected');if(!box||!proposal?.slot)return;const slot=proposal.slot,recheck=proposal.needs_recheck;
    box.innerHTML=`<div class="av32Selected ${recheck?'recheck':''}"><strong>${recheck?'Proposition mémorisée · à revérifier':'Créneau retenu pour proposition'}</strong><br>${esc(formatDate(slot.date))}, ${esc(slot.start)}–${esc(slot.end)} · ${esc(slot.intervenant)}.<br>${recheck?'Relance la recherche pour vérifier sa disponibilité.':'Aucune intervention n’est réservée dans Ogust ou Google Agenda.'}<br><button type="button" class="av32Clear" id="av32Clear">Retirer cette proposition</button></div>`;
    byId('av32Clear')?.addEventListener('click',()=>{clearSelected();renderSlots()});
  }
  function selectSlot(slot){
    if(contextStamp!==contextKey()||!slots.some(candidate=>slotKey(candidate)===slotKey(slot)))return;
    selectedSlot={...slot};const proposal={version:1,context:context(),preferences:preferences(),slot:{...slot},checked_at:responseMeta?.checked_at||new Date().toISOString(),needs_recheck:false};currentState().availabilityProposal=proposal;renderSlots();renderProposal(proposal);window.dispatchEvent(new CustomEvent('acj:availability-selected',{detail:{...slot}}));notify();
  }
  async function search(){
    refreshContext();if(loading)return;const p=preferences();
    if(!Number.isFinite(p.duration_minutes)||p.duration_minutes<30||p.duration_minutes>600){status('Indique une durée comprise entre 30 minutes et 10 heures.','err');byId('av32Duration')?.focus();return}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.from)){status('Choisis une date valide.','err');return}
    reset('',true);loading=true;hasSearched=true;const seq=++generation,stamp=requestKey(),abort=new AbortController();controller=abort;const button=byId('av32Search');button.disabled=true;button.textContent='Recherche en cours…';status('Vérification des horaires, des interventions et des absences…');
    try{
      const url=new URL(API);Object.entries({action:'availability',activity:activity(),duration_minutes:p.duration_minutes,from:p.from,days:p.days,company:company(),period:p.period,max_results:80}).forEach(([key,value])=>url.searchParams.set(key,String(value)));if(selectedClientId())url.searchParams.set('id_customer',selectedClientId());
      const response=await fetch(url.toString(),{cache:'no-store',signal:abort.signal}),data=await response.json().catch(()=>({}));
      if(seq!==generation||stamp!==requestKey())return;if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP_${response.status}`);
      responseMeta=data;const seen=new Set(),returned=Array.isArray(data.slots)?data.slots:[];unverifiedSlots=returned.filter(slot=>validSlot(slot)&&slot.verification?.complete!==true).length;slots=returned.filter(slot=>validSlot(slot)&&slot.verification?.complete===true).filter(slot=>{const key=slotKey(slot);if(seen.has(key))return false;seen.add(key);return true});visible=3;renderSlots();
    }catch(error){if(seq===generation&&stamp===requestKey()&&error?.name!=='AbortError')status(`${errorText(error?.message)}. Aucun créneau n’a été retenu.`,'err')}
    finally{if(seq===generation){loading=false;controller=null;button.disabled=false;button.textContent='Chercher les créneaux'}}
  }
  function getDraft(){return {version:1,context:context(),preferences:preferences(),proposal:currentState()?.availabilityProposal?JSON.parse(JSON.stringify(currentState().availabilityProposal)):null}}
  function restore(draft){
    refreshContext();if(!draft||draft.version!==1)return false;
    const proposal=draft.proposal||draft,stored=draft.context||proposal.context,current=context();
    if(!stored||!['company','quote','customer','client','address','activity'].every(key=>String(stored[key]||'')===String(current[key]||''))||Number(stored.quote_hours)!==current.quote_hours)return false;
    const p=draft.preferences||proposal.preferences||{};manualDuration=!!p.manual_duration;
    if(Number(p.duration_minutes)>=30&&Number(p.duration_minutes)<=600)byId('av32Duration').value=String(p.duration_minutes/60);
    if(/^\d{4}-\d{2}-\d{2}$/.test(p.from||''))byId('av32From').value=p.from;
    if([7,14,21].includes(Number(p.days)))byId('av32Days').value=String(p.days);
    if(['any','morning','afternoon'].includes(p.period))byId('av32Period').value=p.period;
    if(['','0','1','2','3','4','5','6'].includes(String(p.weekday??'')))byId('av32Weekday').value=String(p.weekday??'');byId('av32Employee').value=String(p.employee||'').slice(0,100);updateDurationHint();
    if(validSlot(proposal.slot)){currentState().availabilityProposal={...JSON.parse(JSON.stringify(proposal)),needs_recheck:true};selectedSlot=null;renderProposal(currentState().availabilityProposal);status('Proposition mémorisée. Sa disponibilité doit être vérifiée à nouveau.','warn')}
    return true;
  }
  function wrap(){
    for(const name of ['goStep','renderQuoteLines','setMode','applyImportedNotesClientV39']){const fn=window[name];if(typeof fn==='function')window[name]=function(){const result=fn.apply(this,arguments);refreshContext();return result}}
    const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){reset('',true);const result=fresh.apply(this,arguments);contextStamp='';lastQuoteHours=null;manualDuration=false;refreshContext();return result};
    const payload=window.quotePayload;if(typeof payload==='function')window.quotePayload=function(){refreshContext();const result=payload.apply(this,arguments),proposal=currentState()?.availabilityProposal;if(proposal)result.availability_proposal=JSON.parse(JSON.stringify(proposal));return result};
  }
  function init(){ensurePanel();wrap();refreshContext();window.addEventListener('acj:company-changed',refreshContext);document.addEventListener('input',event=>{if(['client','adresse','ogcSearch'].includes(event.target?.id))queueMicrotask(refreshContext)});document.addEventListener('click',event=>{if(event.target?.closest?.('.ogcResult,#ogcChangeBtn,#ogcExistingBtn,#ogcNewBtn'))queueMicrotask(refreshContext)})}
  window.acjAvailabilityV32={search,get selected(){return selectedSlot&&contextStamp===contextKey()?selectedSlot:null},getDraft,restore,clear:()=>reset('Proposition retirée.'),get rules(){return {base:'client ∩ intervenant',scheduled:'Google pour JB/Vincent/Yohann, Ogust pour les autres',absences:'Ogust'}}};
  window.__acjAvailabilityV32=true;const start=()=>queueMicrotask(init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
