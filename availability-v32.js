// Disponibilités : propositions vérifiées, jamais réservations automatiques.
(function(){
  if(window.__acjAvailabilityV32)return;
  const API='https://acj-ogust-proxy.vercel.app/api/ogust-history';
  const FRESH_MS=5*60*1000,SEARCH_TIMEOUT_MS=45000;
  const ACTIVITIES={jardin:'Jardinage',bricol:'Bricolage',menage:'Ménage',nettoyagePro:'Nettoyage pro'};
  let selectedSlot=null,slots=[],responseMeta=null,loading=false,generation=0,controller=null,visible=3,expiryTimer=null;
  let contextStamp='',lastWorkStamp='',manualDuration=false,hasSearched=false,unverifiedSlots=0;
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const nameMatches=(name,preference)=>norm(preference).split(' ').filter(Boolean).every(token=>norm(name).includes(token));
  function currentState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
  function lineActivity(line){const value=line?.activity||line?.activite||line?.aiProvenance?.mode||line?.ai_provenance?.mode;return Object.hasOwn(ACTIVITIES,value)?value:''}
  function serviceLines(){return (currentState()?.lines||[]).filter(line=>line?.type==='service')}
  function workSignature(){return JSON.stringify((currentState()?.lines||[]).map(line=>({id:line.id||line.line_id||'',type:line.type,designation:line.designation,detail:line.meta||line.detail||'',activity:lineActivity(line),qty:line.qty??line.quantite,unit:line.unit||line.unite||'',method:line.pricingMethod||line.methode_chiffrage||'',price:line.unitPriceTTC??line.prix_unitaire_ttc,vat:line.vat??line.tva_rate,product:line.ogustProductLevelId||line.ogust_product_level_id||'',rate:line.ogustRateId||line.ogust_rate_id||''})))}
  function workModel(){
    const all=serviceLines(),trades=[...new Set(all.map(lineActivity).filter(Boolean))],unknown=all.some(line=>!lineActivity(line));
    const chosen=byId('av32Scope')?.value||'',needsScope=trades.length>1||unknown;
    const activity=needsScope?(Object.hasOwn(ACTIVITIES,chosen)?chosen:''):(trades[0]||'');
    const lines=activity?all.filter(line=>lineActivity(line)===activity||!lineActivity(line)):[];
    const hourly=line=>!/^(flat|forfait)$/i.test(String(line.pricingMethod||line.methode_chiffrage||''))&&/^(h|heure|heures)$/i.test(String(line.unit||line.unite||'').trim())&&Number.isFinite(Number(line.qty??line.quantite))&&Number(line.qty??line.quantite)>0;
    const billableHours=lines.filter(hourly).reduce((sum,line)=>sum+Number(line.qty??line.quantite),0);
    return {all,lines,trades,unknown,needsScope,activity,billableHours,automatic:lines.length>0&&lines.every(hourly)};
  }
  function activity(){return workModel().activity}
  function company(){return currentState()?.company||'ACJ Services'}
  function selectedClient(){try{return window.ogustClientChoiceV21?.company===company()?window.ogustClientChoiceV21?.selected||null:null}catch{return null}}
  function selectedClientId(){return String(selectedClient()?.id_customer||'').trim()}
  function tomorrow(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function estimateHours(){const work=workModel();return work.automatic?work.billableHours:0}
  function formatDate(iso){try{return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'short'}).format(new Date(`${iso}T12:00:00`))}catch{return iso}}
  function ruleText(){return 'JB, Vincent et Yohann : Google Agenda. Les autres : Ogust. Le métier connu doit correspondre à l’intervention ; un métier non confirmé nécessite un intervenant nommé. Horaires de base, interventions et absences connus sont croisés. Une lecture complète du planning ne confirme pas les compétences, le contrat ni les trajets. Aucune réservation n’est effectuée.'}
  function context(){const s=currentState()||{};return {company:company(),quote:String(s.number||''),customer:selectedClientId(),client:String(byId('client')?.value??s.client??''),address:String(byId('adresse')?.value??s.address??''),activity:activity(),quote_hours:estimateHours(),work:workSignature()}}
  function contextKey(){return JSON.stringify(context())}
  function preferences(){return {duration_minutes:Math.round(Number(byId('av32Duration')?.value||0)*60),from:byId('av32From')?.value||tomorrow(),days:Number(byId('av32Days')?.value||14),period:byId('av32Period')?.value||'any',weekday:byId('av32Weekday')?.value||'',employee:byId('av32Employee')?.value.trim()||'',scope_activity:byId('av32Scope')?.value||'',manual_duration:manualDuration}}
  function requestKey(){return JSON.stringify({context:context(),preferences:preferences()})}
  function status(text,type=''){const el=byId('av32Status');if(el){el.textContent=text;el.className=`av32Status ${type}`.trim()}}
  function notify(){window.dispatchEvent(new CustomEvent('acj:availability-changed'))}
  function reset(message='',clearProposal=true){
    generation++;controller?.abort();controller=null;clearTimeout(expiryTimer);expiryTimer=null;loading=false;slots=[];responseMeta=null;selectedSlot=null;visible=3;hasSearched=false;unverifiedSlots=0;
    if(clearProposal&&currentState())delete currentState().availabilityProposal;
    byId('av32Results')?.replaceChildren();byId('av32Selected')?.replaceChildren();
    const button=byId('av32Search');if(button){button.disabled=false;button.textContent='Trouver 3 créneaux'}
    if(message)status(message);notify();
  }
  function clearSelected(){clearTimeout(expiryTimer);expiryTimer=null;selectedSlot=null;if(currentState())delete currentState().availabilityProposal;byId('av32Selected')?.replaceChildren();notify()}

  function addStyles(){
    if(byId('availability-v32-style'))return;
    const style=document.createElement('style');style.id='availability-v32-style';style.textContent=`
      .av32Card{background:#fff;border:1px solid #dfe8f0;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(24,55,86,.065);margin-bottom:13px}
      .av32Head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.av32Title{font-size:14px;font-weight:860;color:#1b3048}.av32Tag{font-size:10px;color:#64778a}.av32Client{font-size:11px;color:#52687e;margin-bottom:7px}.av32Conditions{font-size:11px;line-height:1.45;color:#795b20;background:#fff8e7;border:1px solid #ecd9a5;padding:9px 10px;border-radius:11px;margin:8px 0 11px}.av32Work{font-size:12px;font-weight:750;color:#315069;margin-bottom:8px}.av32Scope{margin-bottom:10px}.av32Checks{font-size:10px;line-height:1.4;color:#795b20;margin-top:5px}
      .av32Fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.av32Field label{font-size:11px;color:#3a5068}.av32Field input,.av32Field select{width:100%;min-height:44px;border:1px solid #d7e2eb;border-radius:12px;padding:10px 11px;font:inherit}.av32Hint{font-size:10px;color:#718197;margin-top:5px}.av32Reset{border:0;background:transparent;color:#0b78c9;font-size:11px;padding:5px 0;cursor:pointer}
      .av32Preferences{margin:10px 0}.av32Preferences>.av32Fields{padding:0 12px 12px}.av32Search{width:100%;min-height:47px;margin-top:8px;border:0;border-radius:13px;background:linear-gradient(135deg,#0877c7,#14a4c8);color:#fff;font-weight:850}.av32Search:disabled{background:#e7edf2;color:#97a7b6}
      .av32Status{font-size:11px;line-height:1.45;color:#718197;margin-top:10px}.av32Status.err,.av32Status.warn,.av32Status.ok{padding:9px 10px;border:1px solid;border-radius:11px}.av32Status.err{color:#a33d43;background:#fff3f3;border-color:#efd0d2}.av32Status.warn{color:#7b5b13;background:#fff8e7;border-color:#ecd9a5}.av32Status.ok{color:#246744;background:#edf8f2;border-color:#c4e7d2}
      .av32Results{display:grid;gap:10px;margin-top:12px}.av32DateGroup{display:grid;gap:7px}.av32DayTitle{font-size:12px;font-weight:850;color:#315069;margin:4px 0}.av32Slot{width:100%;border:1px solid #dce6ee;background:#fff;border-radius:13px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:10px;text-align:left;color:#173049}.av32Slot.selected{border-color:#55acd5;background:#eef8fd}.av32When{font-size:13px;font-weight:860}.av32Who{font-size:11px;color:#667b90;margin-top:3px}.av32Meta{font-size:10px;color:#8a9aab;margin-top:4px}.av32Source{align-self:center;font-size:9px;font-weight:850;border-radius:999px;padding:5px 7px;border:1px solid #d9e4ec;background:#f6f9fb;color:#64778a}.av32Source.google{border-color:#bfe3d0;background:#eef9f3;color:#27754e}
      .av32Selected{margin-top:10px;border:1px solid #bfe3d0;background:#eef9f3;color:#246744;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.5}.av32Selected.recheck{background:#fff8e7;border-color:#ecd9a5;color:#7b5b13}.av32More{width:100%;border:1px solid #d7e2eb;border-radius:12px;background:#fff;color:#315069;min-height:42px;font-size:12px;font-weight:750}.av32SourceInfo{font-size:10px;color:#718197;line-height:1.5;padding:0 12px 12px}.av32Clear{border:0;background:transparent;color:#315069;text-decoration:underline;padding:6px 0;font-size:11px}
      @media(max-width:520px){.av32Card{padding:14px}.av32Preferences>.av32Fields{grid-template-columns:1fr 1fr}.av32EmployeeField{grid-column:1/-1}}
    `;document.head.appendChild(style);
  }
  function panelHtml(){return `<div class="av32Head"><div class="av32Title">Proposer un créneau</div><div class="av32Tag">Sans réservation</div></div>
    <div class="av32Client" id="av32Client"></div><div class="av32Work" id="av32Work"></div>
    <div class="av32Field av32Scope" id="av32ScopeField" hidden><label for="av32Scope">Intervention à planifier</label><select id="av32Scope"></select></div>
    <div class="av32Fields"><div class="av32Field"><label for="av32Duration">Durée sur place pour 1 intervenant (h)</label><input id="av32Duration" type="number" min="0.5" max="10" step="0.25" placeholder="ex. 4"><div class="av32Hint" id="av32DurationHint"></div><button type="button" class="av32Reset" id="av32DurationReset" hidden>Reprendre les heures du devis</button></div><div class="av32Field"><label for="av32From">À partir du</label><input id="av32From" type="date" value="${tomorrow()}"></div></div>
    <details class="av32Preferences" id="av32Preferences"><summary>Préférences</summary><div class="av32Fields"><div class="av32Field"><label for="av32Period">Moment de la journée</label><select id="av32Period"><option value="any">Indifférent</option><option value="morning">Matin · avant 12 h</option><option value="afternoon">Après-midi · dès 13 h</option></select></div><div class="av32Field"><label for="av32Weekday">Jour préféré</label><select id="av32Weekday"><option value="">Tous les jours</option><option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option></select></div><div class="av32Field"><label for="av32Days">Chercher sur</label><select id="av32Days"><option value="7">7 jours</option><option value="14" selected>14 jours</option><option value="21">21 jours</option></select></div><div class="av32Field av32EmployeeField"><label for="av32Employee">Intervenant souhaité</label><input id="av32Employee" type="search" list="av32EmployeeOptions" maxlength="100" placeholder="Nom ou prénom"><datalist id="av32EmployeeOptions"></datalist></div></div></details>
    <div class="av32Conditions" id="av32Conditions"></div><button type="button" class="av32Search" id="av32Search">Trouver 3 créneaux</button><div class="av32Status" id="av32Status" role="status" aria-live="polite"></div><div class="av32Results" id="av32Results"></div><div id="av32Selected"></div>
    <details><summary>Sources et vérifications</summary><div class="av32SourceInfo" id="av32Intro"></div></details>`}
  function ensurePanel(){
    addStyles();const old=byId('av31Panel');if(old)old.style.display='none';const step=document.querySelector('.step[data-step="4"]');if(!step)return null;
    let panel=byId('av32Panel');if(panel)return panel;
    panel=document.createElement('div');panel.id='av32Panel';panel.className='av32Card';panel.innerHTML=panelHtml();
    const cards=Array.from(step.children).filter(el=>el.classList.contains('card'));if(cards.at(-1))step.insertBefore(panel,cards.at(-1));else step.appendChild(panel);
    byId('av32Search').addEventListener('click',search);
    byId('av32Duration').addEventListener('input',()=>{manualDuration=true;updateDurationHint();reset('Durée modifiée. Recherche les créneaux correspondants.')});
    byId('av32DurationReset').addEventListener('click',()=>{manualDuration=false;byId('av32Duration').value=estimateHours()||'';updateDurationHint();reset('Durée du devis reprise. Recherche les créneaux correspondants.')});
    for(const id of ['av32From','av32Days','av32Period','av32Weekday'])byId(id).addEventListener('change',()=>reset('Préférences modifiées. Recherche les créneaux correspondants.'));
    byId('av32Employee').addEventListener('input',()=>{reset('Intervenant modifié. Relance la recherche pour vérifier son planning.');updateConditions()});
    byId('av32Scope').addEventListener('change',()=>{lastWorkStamp='';refreshContext();reset('Intervention choisie. Recherche les créneaux correspondants.')});
    return panel;
  }
  function configureScope(){
    const work=workModel(),field=byId('av32ScopeField'),select=byId('av32Scope');if(!field||!select)return;
    field.hidden=!work.needsScope;const choices=work.unknown?Object.keys(ACTIVITIES):work.trades;
    const key=JSON.stringify(choices);if(select.dataset.choices!==key){const previous=select.value;select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choisir l’intervention';select.appendChild(placeholder);for(const value of choices){const option=document.createElement('option');option.value=value;option.textContent=ACTIVITIES[value];select.appendChild(option)}select.value=choices.includes(previous)?previous:'';select.dataset.choices=key}
  }
  function updateDurationHint(){const work=workModel(),h=estimateHours();if(byId('av32DurationHint'))byId('av32DurationHint').textContent=manualDuration?'Durée sur place renseignée pour cette intervention.':h>0?`${String(h).replace('.',',')} h de main-d’œuvre reprises, pour une personne.`:'Forfait, unité ou durée inconnue : renseigne tout le temps nécessaire sur place.';if(byId('av32DurationReset'))byId('av32DurationReset').hidden=!manualDuration||!work.automatic}
  function updateConditions(){
    const work=workModel(),messages=['Recherche pour une seule personne. Trajets, chargement et déchetterie restent à confirmer.'];
    if(!selectedClientId())messages.push('Disponibilité du client à confirmer.');
    if(work.needsScope&&!work.activity)messages.push('Choisis une intervention avant la recherche.');
    if(work.unknown&&work.activity)messages.push('Les prestations sans métier sont incluses dans cette intervention.');
    if(['menage','nettoyagePro'].includes(work.activity)&&!preferences().employee)messages.push('Si aucun métier salarié n’est confirmé, choisis un intervenant nommé dans Préférences.');
    byId('av32Conditions').textContent=messages.join(' ');
    byId('av32Work').textContent=work.activity?`${ACTIVITIES[work.activity]} · ${work.lines.length} prestation${work.lines.length>1?'s':''} à planifier`:'Intervention à préciser';
  }
  function refreshContext(){
    if(!ensurePanel())return;configureScope();const next=contextKey(),hours=estimateHours(),workStamp=JSON.stringify([workSignature(),activity()]);
    if(contextStamp&&contextStamp!==next){reset('Le devis ou le client a changé. Recherche de nouveaux créneaux.');byId('av32EmployeeOptions')?.replaceChildren()}contextStamp=next;
    if(lastWorkStamp!==workStamp){lastWorkStamp=workStamp;manualDuration=false;byId('av32Duration').value=hours>0?String(hours):''}
    updateDurationHint();byId('av32Intro').textContent=ruleText(activity());const client=selectedClient();byId('av32Client').textContent=client?.id_customer?`Client Ogust : ${client.label||client.id_customer}`:'Aucun client Ogust choisi : contraintes client non vérifiées.';
    updateConditions();expireSelection();if(!slots.length&&!loading&&!hasSearched&&!currentState()?.availabilityProposal)status(hours>0?`Durée proposée pour une personne : ${String(hours).replace('.',',')} h. Ajuste-la si nécessaire.`:'Renseigne la durée sur place pour chercher un créneau.');
  }
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
  function minutes(value){if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||'')))return null;const [h,m]=value.split(':').map(Number);return h*60+m}
  function validSlot(slot){return slot&&validDate(slot.date)&&minutes(slot.start)!==null&&minutes(slot.end)!==null&&minutes(slot.end)>minutes(slot.start)&&['google','ogust'].includes(slot.source)&&typeof slot.intervenant==='string'&&!!slot.intervenant.trim()}
  function parisNow(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const part=type=>parts.find(item=>item.type===type)?.value;return {date:`${part('year')}-${part('month')}-${part('day')}`,minutes:Number(part('hour'))*60+Number(part('minute'))+Number(part('second'))/60}}
  function matchesRequest(slot,p){
    if(!validSlot(slot)||minutes(slot.end)-minutes(slot.start)!==p.duration_minutes)return false;
    const end=new Date(`${p.from}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+p.days);if(slot.date<p.from||slot.date>=end.toISOString().slice(0,10))return false;
    const now=parisNow();if(slot.date<now.date||slot.date===now.date&&minutes(slot.start)<=now.minutes)return false;
    return (p.period==='any'||p.period==='morning'&&slot.end<='12:00'||p.period==='afternoon'&&slot.start>='13:00')&&(p.weekday===''||new Date(`${slot.date}T12:00:00Z`).getUTCDay()===Number(p.weekday))&&(!p.employee||nameMatches(slot.intervenant,p.employee));
  }
  function checkedAt(){return Date.parse(responseMeta?.checked_at||'')}
  function freshChecked(value){const age=Date.now()-Date.parse(value||'');return Number.isFinite(age)&&age>=-60000&&age<FRESH_MS}
  function expireSelection(){
    const proposal=currentState()?.availabilityProposal;
    if(proposal&&!proposal.needs_recheck&&(!freshChecked(proposal.checked_at)||!matchesRequest(proposal.slot,preferences()))){selectedSlot=null;proposal.needs_recheck=true;renderProposal(proposal);status('Le contrôle du planning a expiré ou cet horaire est dépassé. Relance la recherche avant de le proposer.','warn');notify()}
  }
  function slotConditions(slot){
    const conditions=[];
    if(slot.employee_activity_checked!==true&&slot.verification?.employee_activity_checked!==true)conditions.push('Métier salarié à confirmer');
    if(slot.verification?.employment_checked!==true&&slot.conditions?.employment_confirmed!==true)conditions.push('Contrat salarié à confirmer');
    if(slot.verification?.agency_checked!==true&&slot.conditions?.agency_confirmed!==true)conditions.push('Affectation société à confirmer');
    if(!slot.employee_base_configured)conditions.push('Horaires salarié à confirmer');
    if(!selectedClientId()||!slot.client_base_configured)conditions.push('Disponibilité client à confirmer');
    if(slot.verification?.travel_checked!==true)conditions.push('Trajets à confirmer');
    return conditions;
  }
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
  function filteredSlots(){const p=preferences();return slots.filter(slot=>matchesRequest(slot,p)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.intervenant.localeCompare(b.intervenant,'fr'))}
  function shortlist(found){
    const distinct=[],seen=new Set();for(const slot of found){const key=[slot.date,slot.start,slot.end].join('|');if(!seen.has(key)){seen.add(key);distinct.push(slot)}}
    if(distinct.length<=3)return distinct;
    const first=distinct[0],chosen=[first],half=slot=>minutes(slot.start)<12*60?'morning':'afternoon';
    const nextDay=distinct.find(slot=>slot.date!==first.date);if(nextDay)chosen.push(nextDay);
    const anotherHalf=distinct.find(slot=>!chosen.includes(slot)&&slot.date===first.date&&half(slot)!==half(first));if(anotherHalf)chosen.push(anotherHalf);
    for(const slot of distinct)if(chosen.length<3&&!chosen.includes(slot))chosen.push(slot);
    return chosen.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  }
  function updateEmployeeOptions(){const list=byId('av32EmployeeOptions');list.replaceChildren();for(const employee of Array.isArray(responseMeta?.employee_options)?responseMeta.employee_options:[]){if(typeof employee?.name!=='string'||!employee.name.trim())continue;const option=document.createElement('option');option.value=employee.name.trim();option.label=employee.activity_checked===true?'Métier confirmé':'Métier à confirmer';list.appendChild(option)}}
  function renderStatus(){const found=filteredSlots(),issues=warnings();if(responseMeta&&!freshChecked(responseMeta.checked_at)){status('Le contrôle du planning a expiré. Relance la recherche pour obtenir des propositions actuelles.','warn');return}if(responseMeta?.employee_preference_required&&!preferences().employee){byId('av32Preferences').open=true;status('Choisis un intervenant nommé dans Préférences, puis relance la recherche. Son métier et son contrat resteront à confirmer.','warn');return}if(!slots.length){status(issues.length?`Aucun horaire retenu après contrôle du planning. ${issues.join(' ')}`:'Aucun créneau trouvé sur cette période. Essaie une autre période ou prévois plusieurs interventions.',issues.length?'warn':'');return}if(!found.length){status('Aucun créneau ne correspond à cette recherche. Change les préférences puis relance-la.');return}const checked=Number.isFinite(checkedAt())?` Planning contrôlé le ${new Date(checkedAt()).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}.`:'';const conditions=[...new Set(found.flatMap(slotConditions))];status(`${found.length} horaire${found.length>1?'s':''} libre${found.length>1?'s':''} au planning.${checked}${conditions.length?' '+conditions.join(' · ')+'.':''}${issues.length?' '+issues.join(' '):''}`,conditions.length||issues.length||responseMeta?.verification?.complete===false?'warn':'ok')}
  function renderSlots(){
    const box=byId('av32Results');if(!box)return;box.replaceChildren();if(loading&&!responseMeta){status('Vérification des horaires, des interventions et des absences…');return}const found=filteredSlots();renderStatus();
    let day='',group=null;
    const featured=shortlist(found),ordered=[...featured,...found.filter(slot=>!featured.includes(slot))],displayed=visible===3?featured:ordered.slice(0,visible);
    for(const slot of displayed){
      if(slot.date!==day){day=slot.date;group=document.createElement('div');group.className='av32DateGroup';const heading=document.createElement('div');heading.className='av32DayTitle';heading.textContent=formatDate(day);group.appendChild(heading);box.appendChild(group)}
      const button=document.createElement('button');button.type='button';button.className='av32Slot';button.setAttribute('aria-pressed',String(selectedSlot&&slotKey(selectedSlot)===slotKey(slot)));if(selectedSlot&&slotKey(selectedSlot)===slotKey(slot))button.classList.add('selected');
      const base=[];if(slot.employee_base_configured)base.push('horaires intervenant');if(slot.client_base_configured)base.push('horaires client');
      button.innerHTML=`<div><div class="av32When">${esc(slot.start)}–${esc(slot.end)}</div><div class="av32Who">${esc(slot.intervenant)}</div><div class="av32Meta">${base.length?`Planning croisé avec ${esc(base.join(' + '))}`:'Horaires de base non renseignés pour ce profil'}</div><div class="av32Checks">${esc(slotConditions(slot).join(' · '))}</div></div><span class="av32Source ${slot.source==='google'?'google':''}">${slot.source==='google'?'Google Agenda':'Ogust'}</span>`;
      button.addEventListener('click',()=>selectSlot(slot));group.appendChild(button);
    }
    if(found.length>displayed.length){const more=document.createElement('button');more.type='button';more.className='av32More';more.id='av32More';more.textContent=`Voir ${Math.min(6,found.length-displayed.length)} autres possibilités (${found.length-displayed.length} restantes)`;more.addEventListener('click',()=>{visible+=6;renderSlots()});box.appendChild(more)}
    if(responseMeta?.truncated&&found.length<=displayed.length){const note=document.createElement('div');note.className='av32Hint';note.textContent='D’autres possibilités peuvent exister. Affine la date ou la période pour les rechercher.';box.appendChild(note)}
  }
  function renderProposal(proposal){
    const box=byId('av32Selected');if(!box||!proposal?.slot)return;const slot=proposal.slot,recheck=proposal.needs_recheck;
    box.innerHTML=`<div class="av32Selected ${recheck?'recheck':''}"><strong>${recheck?'Proposition mémorisée · à revérifier':'Proposition mémorisée'}</strong><br>${esc(formatDate(slot.date))}, ${esc(slot.start)}–${esc(slot.end)} · ${esc(slot.intervenant)}.<br>${recheck?'Relance la recherche pour contrôler le planning.':'Aucune intervention n’est réservée dans Ogust ou Google Agenda.'}<br>${esc(slotConditions(slot).join(' · '))}<br><button type="button" class="av32Clear" id="av32Clear">Retirer cette proposition</button></div>`;
    byId('av32Clear')?.addEventListener('click',()=>{clearSelected();renderSlots()});
  }
  function selectSlot(slot){
    if(contextStamp!==contextKey()||!slots.some(candidate=>slotKey(candidate)===slotKey(slot))||!matchesRequest(slot,preferences()))return;
    if(!freshChecked(responseMeta?.checked_at)){status('Le contrôle du planning a expiré. Relance la recherche avant de choisir cet horaire.','warn');return}
    selectedSlot={...slot};const proposal={version:2,context:context(),preferences:preferences(),slot:{...slot},checked_at:responseMeta.checked_at,needs_recheck:false};currentState().availabilityProposal=proposal;clearTimeout(expiryTimer);expiryTimer=setTimeout(expireSelection,Math.max(1,FRESH_MS-(Date.now()-checkedAt())));renderSlots();renderProposal(proposal);window.dispatchEvent(new CustomEvent('acj:availability-selected',{detail:{...slot}}));notify();
  }
  async function search(){
    refreshContext();if(loading)return;const p=preferences();
    const work=workModel();if(!work.lines.length||!work.activity){status(work.all.length?'Choisis l’intervention à planifier avant la recherche.':'Ajoute une prestation avant de chercher un créneau.','err');byId('av32Scope')?.focus();return}
    if(!work.automatic&&!manualDuration){status('Renseigne la durée sur place pour cette intervention au forfait, à l’unité ou de durée inconnue.','err');byId('av32Duration')?.focus();return}
    if(!Number.isFinite(p.duration_minutes)||p.duration_minutes<30||p.duration_minutes>600){status('Indique une durée comprise entre 30 minutes et 10 heures.','err');byId('av32Duration')?.focus();return}
    if(!validDate(p.from)||![7,14,21].includes(p.days)){status('Choisis une date et une période valides.','err');return}
    reset('',true);loading=true;hasSearched=true;const seq=++generation,stamp=requestKey(),abort=new AbortController();controller=abort;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;abort.abort()},SEARCH_TIMEOUT_MS);const button=byId('av32Search');button.disabled=true;button.textContent='Recherche en cours…';status('Vérification des horaires, des interventions et des absences…');
    try{
      const url=new URL(API);Object.entries({action:'availability',activity:work.activity,duration_minutes:p.duration_minutes,from:p.from,days:p.days,company:company(),period:p.period,max_results:80}).forEach(([key,value])=>url.searchParams.set(key,String(value)));if(selectedClientId())url.searchParams.set('id_customer',selectedClientId());if(p.weekday!=='')url.searchParams.set('weekday',p.weekday);if(p.employee)url.searchParams.set('employee_name',p.employee);
      const response=await fetch(url.toString(),{cache:'no-store',signal:abort.signal}),data=await response.json().catch(()=>({}));
      if(seq!==generation||stamp!==requestKey())return;if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP_${response.status}`);
      if(!freshChecked(data.checked_at))throw new Error('VERIFICATION_EXPIRED');
      responseMeta=data;updateEmployeeOptions();const seen=new Set(),returned=Array.isArray(data.slots)?data.slots:[];
      const acceptable=slot=>matchesRequest(slot,p)&&slot.verification?.complete===true&&(slot.employee_activity_checked===true||slot.verification?.employee_activity_checked===true||!!p.employee);
      unverifiedSlots=returned.filter(slot=>!acceptable(slot)).length;slots=returned.filter(acceptable).filter(slot=>{const key=slotKey(slot);if(seen.has(key))return false;seen.add(key);return true});visible=3;renderSlots();
    }catch(error){if(seq===generation&&stamp===requestKey()&&(error?.name!=='AbortError'||timedOut))status(timedOut?'La lecture des plannings prend trop de temps. Réessaie ; aucune proposition n’a été retenue.':error?.message==='VERIFICATION_EXPIRED'?'Le contrôle du planning est trop ancien ou sans date exploitable. Relance la recherche.':`${errorText(error?.message)}. Aucun créneau n’a été retenu.`,'err')}
    finally{clearTimeout(timeout);if(seq===generation){loading=false;controller=null;button.disabled=false;button.textContent='Trouver 3 créneaux'}}
  }
  function getDraft(){expireSelection();return {version:2,context:context(),preferences:preferences(),proposal:currentState()?.availabilityProposal?JSON.parse(JSON.stringify(currentState().availabilityProposal)):null}}
  function restore(draft){
    refreshContext();if(!draft||![1,2].includes(draft.version))return false;
    const proposal=draft.proposal||draft,stored=draft.context||proposal.context,p=draft.preferences||proposal.preferences||{},before=context();
    if(!stored||!['company','quote','customer','client','address'].every(key=>String(stored[key]||'')===String(before[key]||''))||stored.work!==undefined&&stored.work!==before.work)return false;
    if(workModel().needsScope){const scope=String(p.scope_activity||stored.activity||'');if(!byId('av32Scope').querySelector(`option[value="${Object.hasOwn(ACTIVITIES,scope)?scope:'__invalid'}"]`))return false;byId('av32Scope').value=scope;refreshContext()}
    const current=context();if(String(stored.activity||'')!==current.activity||Number(stored.quote_hours)!==current.quote_hours)return false;
    manualDuration=!!p.manual_duration;
    if(Number(p.duration_minutes)>=30&&Number(p.duration_minutes)<=600)byId('av32Duration').value=String(p.duration_minutes/60);
    if(validDate(p.from))byId('av32From').value=p.from;
    if([7,14,21].includes(Number(p.days)))byId('av32Days').value=String(p.days);
    if(['any','morning','afternoon'].includes(p.period))byId('av32Period').value=p.period;
    if(['','0','1','2','3','4','5','6'].includes(String(p.weekday??'')))byId('av32Weekday').value=String(p.weekday??'');byId('av32Employee').value=String(p.employee||'').slice(0,100);updateDurationHint();
    updateConditions();if(validSlot(proposal.slot)){currentState().availabilityProposal={...JSON.parse(JSON.stringify(proposal)),needs_recheck:true};selectedSlot=null;renderProposal(currentState().availabilityProposal);status('Proposition mémorisée. Le planning doit être contrôlé à nouveau.','warn')}
    return true;
  }
  function wrap(){
    for(const name of ['goStep','renderQuoteLines','setMode','applyImportedNotesClientV39']){const fn=window[name];if(typeof fn==='function')window[name]=function(){const result=fn.apply(this,arguments);refreshContext();return result}}
    const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){reset('',true);const result=fresh.apply(this,arguments);contextStamp='';lastWorkStamp='';manualDuration=false;byId('av32Scope').value='';refreshContext();return result};
    const payload=window.quotePayload;if(typeof payload==='function')window.quotePayload=function(){refreshContext();const result=payload.apply(this,arguments),proposal=currentState()?.availabilityProposal;if(proposal)result.availability_proposal=JSON.parse(JSON.stringify(proposal));return result};
  }
  function init(){ensurePanel();wrap();refreshContext();window.addEventListener('acj:company-changed',refreshContext);document.addEventListener('input',event=>{if(['client','adresse','ogcSearch'].includes(event.target?.id))queueMicrotask(refreshContext)});document.addEventListener('click',event=>{if(event.target?.closest?.('.ogcResult,#ogcChangeBtn,#ogcExistingBtn,#ogcNewBtn'))queueMicrotask(refreshContext)})}
  window.acjAvailabilityV32={search,get selected(){expireSelection();return selectedSlot&&contextStamp===contextKey()&&matchesRequest(selectedSlot,preferences())?selectedSlot:null},getDraft,restore,clear:()=>reset('Proposition retirée.'),get rules(){return {base:'client ∩ intervenant',scheduled:'Google pour JB/Vincent/Yohann, Ogust pour les autres',absences:'Ogust',staffing:'une personne',travel:'non vérifié'}}};
  window.__acjAvailabilityV32=true;const start=()=>queueMicrotask(init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
