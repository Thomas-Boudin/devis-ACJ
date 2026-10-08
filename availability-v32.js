// Disponibilités : propositions vérifiées, jamais réservations automatiques.
(function(){
  if(window.__acjAvailabilityV32)return;
  const API='https://acj-ogust-proxy.vercel.app/api/ogust-history';
  const FRESH_MS=5*60*1000,SEARCH_TIMEOUT_MS=45000;
  const ACTIVITIES={jardin:'Jardinage',bricol:'Bricolage',menage:'Ménage',nettoyagePro:'Nettoyage pro'};
  let selectedSlot=null,slots=[],responseMeta=null,loading=false,generation=0,controller=null,visible=3,expiryTimer=null;
  let contextStamp='',lastWorkStamp='',manualDuration=false,hasSearched=false,unverifiedSlots=0;
  let employeeOptions=[],requiredEmployeeIds=[],employeeScope='';
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const nameMatches=(name,preference)=>norm(preference).split(' ').filter(Boolean).every(token=>norm(name).includes(token));
  function excludedForCleaning(member){return activity()==='menage'&&(/\b(?:jean ?baptiste|jb|vincent|yohann?)\b/.test(norm(member?.name||member?.intervenant))||['jb','vincent','yohann'].includes(member?.employee_key))}
  function currentState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
  function lineActivity(line){const value=line?.activity||line?.activite||line?.aiProvenance?.mode||line?.ai_provenance?.mode;return Object.hasOwn(ACTIVITIES,value)?value:''}
  function serviceLines(){return (currentState()?.lines||[]).filter(line=>line?.type==='service')}
  function workSignature(){return JSON.stringify((currentState()?.lines||[]).map(line=>({id:line.id||line.line_id||'',type:line.type,designation:line.designation,detail:line.meta||line.detail||'',activity:lineActivity(line),qty:line.qty??line.quantite,unit:line.unit||line.unite||'',method:line.pricingMethod||line.methode_chiffrage||'',price:line.unitPriceTTC??line.prix_unitaire_ttc,vat:line.vat??line.tva_rate,product:line.ogustProductLevelId||line.ogust_product_level_id||'',rate:line.ogustRateId||line.ogust_rate_id||'',ai_confirmed:line.aiProvenance?.durationConfirmed??line.ai_provenance?.durationConfirmed})))}
  function workModel(){
    const all=serviceLines(),trades=[...new Set(all.map(lineActivity).filter(Boolean))],unknown=all.some(line=>!lineActivity(line));
    const chosen=byId('av32Scope')?.value||'',needsScope=trades.length>1||unknown;
    const activity=needsScope?(Object.hasOwn(ACTIVITIES,chosen)?chosen:''):(trades[0]||'');
    const lines=activity?all.filter(line=>lineActivity(line)===activity||!lineActivity(line)):[];
    const hourly=line=>!/^(flat|forfait)$/i.test(String(line.pricingMethod||line.methode_chiffrage||''))&&/^(h|heure|heures)$/i.test(String(line.unit||line.unite||'').trim())&&Number.isFinite(Number(line.qty??line.quantite))&&Number(line.qty??line.quantite)>0;
    const billableHours=lines.filter(hourly).reduce((sum,line)=>sum+Number(line.qty??line.quantite),0);
    const unconfirmed=lines.some(line=>(line.aiProvenance?.durationConfirmed??line.ai_provenance?.durationConfirmed)===false);
    return {all,lines,trades,unknown,needsScope,activity,billableHours,unconfirmed,automatic:lines.length>0&&lines.every(hourly)&&!unconfirmed};
  }
  function activity(){return workModel().activity}
  function company(){return currentState()?.company||'ACJ Services'}
  function selectedClient(){try{return window.ogustClientChoiceV21?.company===company()?window.ogustClientChoiceV21?.selected||null:null}catch{return null}}
  function selectedClientId(){return String(selectedClient()?.id_customer||'').trim()}
  function tomorrow(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function estimateHours(){const work=workModel();return work.automatic?work.billableHours:0}
  function formatDate(iso){try{return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'short'}).format(new Date(`${iso}T12:00:00`))}catch{return iso}}
  function ruleText(){return activity()==='menage'?'Ménage : plannings et absences Ogust. JB, Vincent et Yohann sont exclus, y compris dans les préférences. Les membres de l’équipe doivent être choisis dans Préférences. Aucune réservation n’est effectuée.':'JB, Vincent et Yohann : Google Agenda. Les autres : Ogust. Le métier connu doit correspondre à l’intervention ; un métier non confirmé nécessite un intervenant nommé. Horaires de base, interventions et absences connus sont croisés. Une lecture complète du planning ne confirme pas les compétences, le contrat ni les trajets. Aucune réservation n’est effectuée.'}
  function context(){const s=currentState()||{};return {company:company(),quote:String(s.number||''),customer:selectedClientId(),client:String(byId('client')?.value??s.client??''),address:String(byId('adresse')?.value??s.address??''),activity:activity(),quote_hours:estimateHours(),work:workSignature()}}
  function contextKey(){return JSON.stringify(context())}
  function preferences(){return {labor_minutes:Math.round(Number(byId('av32Duration')?.value||0)*60),persons:Number(byId('av32Persons')?.value||1),daily_minutes:Math.round(Number(byId('av32DailyHours')?.value||8)*60),parallel_confirmed:byId('av32ParallelConfirm')?.checked===true,employee_ids:[...requiredEmployeeIds].sort(),from:byId('av32From')?.value||tomorrow(),days:Number(byId('av32Days')?.value||14),period:byId('av32Period')?.value||'any',weekday:byId('av32Weekday')?.value||'',scope_activity:byId('av32Scope')?.value||'',manual_duration:manualDuration}}
  function requestKey(){return JSON.stringify({context:context(),preferences:preferences()})}
  function status(text,type=''){const el=byId('av32Status');if(el){el.textContent=text;el.className=`av32Status ${type}`.trim()}}
  function notify(){window.dispatchEvent(new CustomEvent('acj:availability-changed'))}
  function reset(message='',clearProposal=true){
    generation++;controller?.abort();controller=null;clearTimeout(expiryTimer);expiryTimer=null;loading=false;slots=[];responseMeta=null;selectedSlot=null;visible=3;hasSearched=false;unverifiedSlots=0;
    if(clearProposal&&currentState())delete currentState().availabilityProposal;
    byId('av32Results')?.replaceChildren();byId('av32Selected')?.replaceChildren();
    const button=byId('av32Search');if(button){button.disabled=false;button.textContent='Trouver 3 propositions'}
    if(message)status(message);notify();
  }
  function clearSelected(){clearTimeout(expiryTimer);expiryTimer=null;selectedSlot=null;if(currentState())delete currentState().availabilityProposal;byId('av32Selected')?.replaceChildren();notify()}
  function resetParallel(){if(byId('av32ParallelConfirm'))byId('av32ParallelConfirm').checked=false;updateDurationHint()}

  function addStyles(){
    if(byId('availability-v32-style'))return;
    const style=document.createElement('style');style.id='availability-v32-style';style.textContent=`
      .av32Card{background:#fff;border:1px solid #dfe8f0;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(24,55,86,.065);margin-bottom:13px}
      .av32Head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.av32Title{font-size:14px;font-weight:860;color:#1b3048}.av32Tag{font-size:10px;color:#64778a}.av32Client{font-size:11px;color:#52687e;margin-bottom:7px}.av32Conditions{font-size:11px;line-height:1.45;color:#795b20;background:#fff8e7;border:1px solid #ecd9a5;padding:9px 10px;border-radius:11px;margin:8px 0 11px}.av32Work{font-size:12px;font-weight:750;color:#315069;margin-bottom:8px}.av32Scope{margin-bottom:10px}.av32Checks{font-size:10px;line-height:1.4;color:#795b20;margin-top:5px}
      .av32Fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.av32MainFields{grid-template-columns:1.25fr .8fr 1.1fr}.av32Field label{font-size:11px;color:#3a5068}.av32Field input,.av32Field select{width:100%;min-height:44px;border:1px solid #d7e2eb;border-radius:12px;padding:10px 11px;font:inherit}.av32Hint{font-size:10px;color:#718197;margin-top:5px}.av32Reset{border:0;background:transparent;color:#0b78c9;font-size:11px;padding:5px 0;cursor:pointer}.av32Parallel{margin:8px 0;padding:10px;border:1px solid #ecd9a5;border-radius:11px;background:#fff8e7;font-size:12px;color:#795b20}.av32CheckLabel{display:flex;gap:9px;align-items:flex-start;font-size:11px;line-height:1.4;color:#315069}.av32CheckLabel input{width:20px;min-height:20px;height:20px;margin:0;flex:none}.av32EmployeeList{display:grid;gap:8px;max-height:220px;overflow:auto;margin-top:8px}.av32EmployeeOption{border:1px solid #d7e2eb;padding:9px;border-radius:10px}.av32Segment{font-size:11px;line-height:1.6;color:#315069}.av32Plan{display:block}.av32DayCap{grid-column:1/-1}
      .av32Preferences{margin:10px 0}.av32Preferences>.av32Fields{padding:0 12px 12px}.av32Search{width:100%;min-height:47px;margin-top:8px;border:0;border-radius:13px;background:linear-gradient(135deg,#0877c7,#14a4c8);color:#fff;font-weight:850}.av32Search:disabled{background:#e7edf2;color:#97a7b6}
      .av32Status{font-size:11px;line-height:1.45;color:#718197;margin-top:10px}.av32Status.err,.av32Status.warn,.av32Status.ok{padding:9px 10px;border:1px solid;border-radius:11px}.av32Status.err{color:#a33d43;background:#fff3f3;border-color:#efd0d2}.av32Status.warn{color:#7b5b13;background:#fff8e7;border-color:#ecd9a5}.av32Status.ok{color:#246744;background:#edf8f2;border-color:#c4e7d2}
      .av32Results{display:grid;gap:10px;margin-top:12px}.av32DateGroup{display:grid;gap:7px}.av32DayTitle{font-size:12px;font-weight:850;color:#315069;margin:4px 0}.av32Slot{width:100%;border:1px solid #dce6ee;background:#fff;border-radius:13px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:10px;text-align:left;color:#173049}.av32Slot.selected{border-color:#55acd5;background:#eef8fd}.av32When{font-size:13px;font-weight:860}.av32Who{font-size:11px;color:#667b90;margin-top:3px}.av32Meta{font-size:10px;color:#8a9aab;margin-top:4px}.av32Source{align-self:center;font-size:9px;font-weight:850;border-radius:999px;padding:5px 7px;border:1px solid #d9e4ec;background:#f6f9fb;color:#64778a}.av32Source.google{border-color:#bfe3d0;background:#eef9f3;color:#27754e}
      .av32Selected{margin-top:10px;border:1px solid #bfe3d0;background:#eef9f3;color:#246744;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.5}.av32Selected.recheck{background:#fff8e7;border-color:#ecd9a5;color:#7b5b13}.av32More{width:100%;border:1px solid #d7e2eb;border-radius:12px;background:#fff;color:#315069;min-height:42px;font-size:12px;font-weight:750}.av32SourceInfo{font-size:10px;color:#718197;line-height:1.5;padding:0 12px 12px}.av32Clear{border:0;background:transparent;color:#315069;text-decoration:underline;padding:6px 0;font-size:11px}
      @media(max-width:520px){.av32Card{padding:14px}.av32Preferences>.av32Fields,.av32MainFields{grid-template-columns:1fr 1fr}.av32EmployeeField,.av32FromField{grid-column:1/-1}}
    `;document.head.appendChild(style);
  }
  function panelHtml(){return `<div class="av32Head"><div class="av32Title">Planifier le chantier</div><div class="av32Tag">Sans réservation</div></div>
    <div class="av32Client" id="av32Client"></div><div class="av32Work" id="av32Work"></div>
    <div class="av32Field av32Scope" id="av32ScopeField" hidden><label for="av32Scope">Intervention à planifier</label><select id="av32Scope"></select></div>
    <div class="av32Fields av32MainFields"><div class="av32Field"><label for="av32Duration">Heures de travail totales (h)</label><input id="av32Duration" type="number" min="0.5" max="480" step="0.25" placeholder="ex. 16"><div class="av32Hint" id="av32DurationHint"></div><button type="button" class="av32Reset" id="av32DurationReset" hidden>Reprendre les heures du devis</button></div><div class="av32Field"><label for="av32Persons">Effectif</label><select id="av32Persons"><option value="1">1 personne</option><option value="2">2 personnes</option><option value="3">3 personnes</option></select></div><div class="av32Field av32FromField"><label for="av32From">À partir du</label><input id="av32From" type="date" value="${tomorrow()}"></div></div>
    <div class="av32Parallel" id="av32Parallel" hidden><div id="av32ParallelMath"></div><label class="av32CheckLabel"><input type="checkbox" id="av32ParallelConfirm">Je confirme que ces tâches peuvent être réalisées en parallèle par cette équipe.</label></div>
    <details class="av32Preferences" id="av32Preferences"><summary>Préférences</summary><div class="av32Fields"><div class="av32Field"><label for="av32Period">Moment de la journée</label><select id="av32Period"><option value="any">Indifférent</option><option value="morning">Matin · avant 12 h</option><option value="afternoon">Après-midi · dès 13 h</option></select></div><div class="av32Field"><label for="av32Weekday">Jour préféré</label><select id="av32Weekday"><option value="">Tous les jours</option><option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option></select></div><div class="av32Field"><label for="av32Days">Chercher sur</label><select id="av32Days"><option value="7">7 jours</option><option value="14" selected>14 jours</option><option value="21">21 jours</option></select></div><div class="av32Field"><label for="av32DailyHours">Maximum de travail par personne et par jour (h)</label><input id="av32DailyHours" type="number" min="0.5" max="9" step="0.25" value="8"><div class="av32Hint">Pause de 12 h à 13 h exclue du temps de travail.</div></div><div class="av32Field av32EmployeeField"><label for="av32Employee">Membres de l’équipe souhaités</label><input id="av32Employee" type="search" maxlength="100" placeholder="Filtrer les noms"><div class="av32Hint" id="av32EmployeeHint">Facultatif : le moteur complète l’équipe avec des profils de métier confirmé.</div><div class="av32EmployeeList" id="av32EmployeeOptions"></div></div></div></details>
    <div class="av32Conditions" id="av32Conditions"></div><button type="button" class="av32Search" id="av32Search">Trouver 3 propositions</button><div class="av32Status" id="av32Status" role="status" aria-live="polite"></div><div class="av32Results" id="av32Results"></div><div id="av32Selected"></div>
    <details><summary>Sources et vérifications</summary><div class="av32SourceInfo" id="av32Intro"></div></details>`}
  function ensurePanel(){
    addStyles();const old=byId('av31Panel');if(old)old.style.display='none';const step=document.querySelector('.step[data-step="4"]');if(!step)return null;
    let panel=byId('av32Panel');if(panel)return panel;
    panel=document.createElement('div');panel.id='av32Panel';panel.className='av32Card';panel.innerHTML=panelHtml();
    const cards=Array.from(step.children).filter(el=>el.classList.contains('card'));if(cards.at(-1))step.insertBefore(panel,cards.at(-1));else step.appendChild(panel);
    byId('av32Search').addEventListener('click',search);
    byId('av32Duration').addEventListener('input',()=>{manualDuration=true;resetParallel();reset('Temps de travail modifié. Recherche de nouvelles propositions.')});
    byId('av32DurationReset').addEventListener('click',()=>{manualDuration=false;byId('av32Duration').value=estimateHours()||'';resetParallel();reset('Heures du devis reprises. Recherche de nouvelles propositions.')});
    byId('av32Persons').addEventListener('change',()=>{resetParallel();renderEmployeeOptions();reset('Effectif modifié. Recherche de nouvelles propositions.');updateConditions()});
    byId('av32ParallelConfirm').addEventListener('change',()=>reset('Organisation de l’équipe modifiée. Recherche de nouvelles propositions.'));
    for(const id of ['av32From','av32Days','av32Period','av32Weekday','av32DailyHours'])byId(id).addEventListener('change',()=>reset('Préférences modifiées. Recherche de nouvelles propositions.'));
    byId('av32Employee').addEventListener('input',renderEmployeeOptions);
    byId('av32Scope').addEventListener('change',()=>{lastWorkStamp='';refreshContext();reset('Intervention choisie. Recherche les créneaux correspondants.')});
    return panel;
  }
  function configureScope(){
    const work=workModel(),field=byId('av32ScopeField'),select=byId('av32Scope');if(!field||!select)return;
    field.hidden=!work.needsScope;const choices=work.unknown?Object.keys(ACTIVITIES):work.trades;
    const key=JSON.stringify(choices);if(select.dataset.choices!==key){const previous=select.value;select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choisir l’intervention';select.appendChild(placeholder);for(const value of choices){const option=document.createElement('option');option.value=value;option.textContent=ACTIVITIES[value];select.appendChild(option)}select.value=choices.includes(previous)?previous:'';select.dataset.choices=key}
  }
  function hoursLabel(minutes){return (Math.round(minutes/60*100)/100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' h'}
  function updateDurationHint(){const work=workModel(),h=estimateHours(),p=preferences();if(byId('av32DurationHint'))byId('av32DurationHint').textContent=manualDuration?'Temps de travail total renseigné pour cette intervention.':h>0?`${String(h).replace('.',',')} h de main-d’œuvre reprises du devis.`:work.unconfirmed?'Estimation IA non confirmée : renseigne explicitement le temps total retenu.':'Forfait, unité ou durée inconnue : renseigne le temps de travail total.';if(byId('av32DurationReset'))byId('av32DurationReset').hidden=!manualDuration||!work.automatic;if(byId('av32Parallel'))byId('av32Parallel').hidden=p.persons===1;if(byId('av32ParallelMath'))byId('av32ParallelMath').textContent=p.labor_minutes>0?`${hoursLabel(p.labor_minutes)} à ${p.persons} personnes = ${hoursLabel(Math.ceil(p.labor_minutes/p.persons))} de travail chacune, hors pauses et trajets.`:'Le travail doit pouvoir être réparti entre les membres de l’équipe.'}
  function updateConditions(){
    const work=workModel(),messages=['Le chantier sera couvert en entier, sur plusieurs jours si nécessaire, par la même équipe. Trajets, chargement et déchetterie restent à confirmer.'];
    if(!selectedClientId())messages.push('Disponibilité du client à confirmer.');
    if(work.needsScope&&!work.activity)messages.push('Choisis une intervention avant la recherche.');
    if(work.unknown&&work.activity)messages.push('Les prestations sans métier sont incluses dans cette intervention.');
    if(['menage','nettoyagePro'].includes(work.activity)&&!requiredEmployeeIds.length)messages.push('Les membres sans métier confirmé doivent être choisis dans Préférences.');
    byId('av32Conditions').textContent=messages.join(' ');
    byId('av32Work').textContent=work.activity?`${ACTIVITIES[work.activity]} · ${work.lines.length} prestation${work.lines.length>1?'s':''} à planifier`:'Intervention à préciser';
  }
  function refreshContext(){
    if(!ensurePanel())return;configureScope();const next=contextKey(),hours=estimateHours(),workStamp=JSON.stringify([workSignature(),activity()]);
    if(contextStamp&&contextStamp!==next){reset('Le devis ou le client a changé. Recherche de nouvelles propositions.');resetParallel()}contextStamp=next;
    const employeeKey=JSON.stringify([company(),activity()]);if(employeeScope!==employeeKey){employeeScope=employeeKey;employeeOptions=[];requiredEmployeeIds=[];byId('av32Employee').value='';renderEmployeeOptions()}
    if(lastWorkStamp!==workStamp){lastWorkStamp=workStamp;manualDuration=false;byId('av32Duration').value=hours>0?String(hours):'';resetParallel()}
    updateDurationHint();byId('av32Intro').textContent=ruleText(activity());const client=selectedClient();byId('av32Client').textContent=client?.id_customer?`Client Ogust : ${client.label||client.id_customer}`:'Aucun client Ogust choisi : contraintes client non vérifiées.';
    updateConditions();expireSelection();if(!slots.length&&!loading&&!hasSearched&&!currentState()?.availabilityProposal)status(hours>0?`${String(hours).replace('.',',')} h de travail au total. Le moteur cherchera un chantier complet.`:'Renseigne le temps de travail total pour chercher des propositions.');
  }
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
  function minutes(value){if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||'')))return null;const [h,m]=value.split(':').map(Number);return h*60+m}
  function validSlot(slot){return slot&&!excludedForCleaning(slot)&&validDate(slot.date)&&minutes(slot.start)!==null&&minutes(slot.end)!==null&&minutes(slot.end)>minutes(slot.start)&&['google','ogust'].includes(slot.source)&&typeof slot.intervenant==='string'&&!!slot.intervenant.trim()}
  function parisNow(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const part=type=>parts.find(item=>item.type===type)?.value;return {date:`${part('year')}-${part('month')}-${part('day')}`,minutes:Number(part('hour'))*60+Number(part('minute'))+Number(part('second'))/60}}
  function validPreferences(p){return Number.isInteger(p.labor_minutes)&&p.labor_minutes>=p.persons*30&&p.labor_minutes<=28800&&[1,2,3].includes(p.persons)&&Number.isInteger(p.daily_minutes)&&p.daily_minutes>=30&&p.daily_minutes<=540&&validDate(p.from)&&[7,14,21].includes(p.days)&&['any','morning','afternoon'].includes(p.period)&&['','0','1','2','3','4','5','6'].includes(String(p.weekday))&&Array.isArray(p.employee_ids)&&p.employee_ids.length<=p.persons&&new Set(p.employee_ids).size===p.employee_ids.length&&p.employee_ids.every(id=>typeof id==='string'&&id.trim()&&id.length<=50)}
  function matchesRequest(plan,p,allowPast=false){
    if(!validPreferences(p)||!plan||plan.complete!==true||plan.verification?.planning_complete!==true||typeof plan.id!=='string'||!plan.id||plan.id.length>160||plan.persons!==p.persons||plan.requested_labor_minutes!==p.labor_minutes||plan.daily_minutes!==p.daily_minutes)return false;
    if(!Array.isArray(plan.crew)||plan.crew.length!==p.persons||!Array.isArray(plan.segments)||!plan.segments.length||plan.segments.length>500)return false;
    const ids=plan.crew.map(member=>member?.id_employee);if(ids.some(id=>typeof id!=='string'||!id.trim()||id.length>50)||new Set(ids).size!==ids.length||plan.crew.some(member=>typeof member.name!=='string'||!member.name.trim()||!['google','ogust'].includes(member.source)))return false;
    if(plan.crew.some(excludedForCleaning))return false;
    if(!p.employee_ids.every(id=>ids.includes(id)))return false;
    if(plan.crew.some(member=>member.activity_checked!==true&&!p.employee_ids.includes(member.id_employee)))return false;
    if(!allowPast&&p.persons>1&&!p.parallel_confirmed)return false;
    const sortedIds=[...ids].sort(),endRange=new Date(`${p.from}T12:00:00Z`);endRange.setUTCDate(endRange.getUTCDate()+p.days);
    const endDate=endRange.toISOString().slice(0,10),now=parisNow(),daily=new Map();let onsite=0,previous=null;
    for(const segment of plan.segments){
      if(!segment||!validDate(segment.date)||minutes(segment.start)===null||minutes(segment.end)===null||segment.verification?.planning_complete!==true||!Array.isArray(segment.employee_ids)||JSON.stringify([...segment.employee_ids].sort())!==JSON.stringify(sortedIds))return false;
      if(!['planning_checked','absences_checked','employee_profile_checked','employee_base_checked'].every(key=>segment.verification[key]===true)||selectedClientId()&&!['client_base_checked','client_planning_checked'].every(key=>segment.verification[key]===true))return false;
      const start=minutes(segment.start),end=minutes(segment.end),duration=end-start;
      if(duration<30||start<480||end>1080||start<780&&end>720||new Date(`${segment.date}T12:00:00Z`).getUTCDay()===0||segment.onsite_minutes!==duration||segment.labor_minutes!==duration*p.persons)return false;
      if(segment.date<p.from||segment.date>=endDate||!allowPast&&(segment.date<now.date||segment.date===now.date&&start<=now.minutes))return false;
      if(p.period==='morning'&&end>720||p.period==='afternoon'&&start<780||p.weekday!==''&&new Date(`${segment.date}T12:00:00Z`).getUTCDay()!==Number(p.weekday))return false;
      if(previous&&(segment.date<previous.date||segment.date===previous.date&&start<minutes(previous.end)))return false;
      previous=segment;onsite+=duration;daily.set(segment.date,(daily.get(segment.date)||0)+duration);
      if(daily.get(segment.date)>p.daily_minutes)return false;
    }
    const planned=onsite*p.persons,roundUp=planned-p.labor_minutes;
    return onsite===Math.ceil(p.labor_minutes/p.persons)&&roundUp>=0&&roundUp<p.persons&&plan.onsite_minutes===onsite&&plan.planned_labor_minutes===planned&&plan.round_up_labor_minutes===roundUp&&plan.day_count===daily.size&&plan.segment_count===plan.segments.length;
  }
  function checkedAt(){return Date.parse(responseMeta?.checked_at||'')}
  function freshChecked(value){const age=Date.now()-Date.parse(value||'');return Number.isFinite(age)&&age>=-60000&&age<FRESH_MS}
  function cleanStoredProposal(){const proposal=currentState()?.availabilityProposal;if(!proposal)return null;const valid=typeof proposal==='object'&&(proposal.plan?matchesRequest(proposal.plan,proposal.preferences||preferences(),true):validSlot(proposal.legacy_slot||proposal.slot));if(valid)return proposal;if(currentState())delete currentState().availabilityProposal;selectedSlot=null;clearTimeout(expiryTimer);expiryTimer=null;byId('av32Selected')?.replaceChildren();notify();return null}
  function expireSelection(){
    const proposal=cleanStoredProposal();
    if(proposal&&!proposal.needs_recheck&&(!freshChecked(proposal.checked_at)||!matchesRequest(proposal.plan,preferences()))){selectedSlot=null;proposal.needs_recheck=true;renderProposal(proposal);status('Le contrôle du planning a expiré ou un horaire est dépassé. Relance la recherche avant de proposer ce chantier.','warn');notify()}
  }
  function slotConditions(slot){
    const conditions=[];
    if(slot.crew?.some(member=>member.activity_checked!==true)||slot.conditions?.employee_activity_confirmed!==true)conditions.push('Métier salarié à confirmer');
    if(slot.conditions?.employment_confirmed!==true)conditions.push('Contrat salarié à confirmer');
    if(slot.conditions?.agency_confirmed!==true)conditions.push('Affectation société à confirmer');
    if(slot.conditions?.employee_hours_configured!==true)conditions.push('Horaires salariés à confirmer');
    if(!selectedClientId()||slot.conditions?.client_hours_configured!==true)conditions.push('Disponibilité client à confirmer');
    if(slot.conditions?.travel_confirmed!==true)conditions.push('Trajets à confirmer');
    if(slot.round_up_labor_minutes>0)conditions.push(`${slot.round_up_labor_minutes} minute${slot.round_up_labor_minutes>1?'s':''} de travail ajoutée${slot.round_up_labor_minutes>1?'s':''} pour l’arrondi de l’équipe`);
    return conditions;
  }
  function intervalKey(plan){return JSON.stringify(plan.segments.map(segment=>[segment.date,segment.start,segment.end]))}
  function slotKey(plan){return JSON.stringify([plan.crew.map(member=>member.id_employee).sort(),intervalKey(plan)])}
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
    if(value==='INVALID_LABOR_MINUTES')return 'Le temps total doit prévoir au moins 30 minutes de travail par personne';
    if(value==='INVALID_PERSONS')return 'Choisis un effectif de 1 à 3 personnes';
    if(value==='INVALID_DAILY_MINUTES')return 'Le maximum quotidien doit être compris entre 30 minutes et 9 heures par personne';
    if(value==='INVALID_EMPLOYEE_IDS')return 'Vérifie les membres souhaités de l’équipe';
    return 'Les plannings n’ont pas pu être vérifiés. Réessaie lorsque la connexion est disponible';
  }
  function warnings(){const list=[...(Array.isArray(responseMeta?.warnings)?responseMeta.warnings:[]),...(Array.isArray(responseMeta?.verification?.warnings)?responseMeta.verification.warnings:[])];const out=list.map(w=>typeof w==='string'?warningText(w):String(w?.message||w?.detail||warningText(w?.code||'')));if(unverifiedSlots)out.push('Des propositions incomplètes ou non conformes ont été exclues.');for(const [source,data] of Object.entries(responseMeta?.sources||{}))if(data?.queried&&data.available===false)out.push(`Une partie du planning ${source==='google'?'Google Agenda':'Ogust'} est indisponible.`);return [...new Set(out)]}
  function filteredSlots(){const p=preferences();return slots.filter(plan=>matchesRequest(plan,p)).sort((a,b)=>a.segments[0].date.localeCompare(b.segments[0].date)||a.segments[0].start.localeCompare(b.segments[0].start)||a.segments.at(-1).date.localeCompare(b.segments.at(-1).date)||a.crew.map(member=>member.name).join(' ').localeCompare(b.crew.map(member=>member.name).join(' '),'fr'))}
  function shortlist(found){
    const distinct=[],seen=new Set();for(const slot of found){const key=slotKey(slot);if(!seen.has(key)){seen.add(key);distinct.push(slot)}}
    if(distinct.length<=3)return distinct;
    const first=distinct[0],chosen=[first],half=plan=>minutes(plan.segments[0].start)<12*60?'morning':'afternoon';
    const nextDay=distinct.find(plan=>plan.segments[0].date!==first.segments[0].date);if(nextDay)chosen.push(nextDay);
    const anotherHalf=distinct.find(plan=>!chosen.includes(plan)&&plan.segments[0].date===first.segments[0].date&&half(plan)!==half(first));if(anotherHalf)chosen.push(anotherHalf);
    for(const slot of distinct)if(chosen.length<3&&!chosen.includes(slot))chosen.push(slot);
    return chosen.sort((a,b)=>a.segments[0].date.localeCompare(b.segments[0].date)||a.segments[0].start.localeCompare(b.segments[0].start));
  }
  function updateEmployeeOptions(){const received=(Array.isArray(responseMeta?.employee_options)?responseMeta.employee_options:[]).filter(employee=>employee&&String(employee.id_employee||'').trim()&&typeof employee.name==='string'&&employee.name.trim());const excluded=new Set(received.filter(excludedForCleaning).map(employee=>String(employee.id_employee)));requiredEmployeeIds=requiredEmployeeIds.filter(id=>!excluded.has(id));employeeOptions=received.filter(employee=>!excludedForCleaning(employee)).map(employee=>({...employee,id_employee:String(employee.id_employee)}));renderEmployeeOptions()}
  function renderEmployeeOptions(){
    const list=byId('av32EmployeeOptions');if(!list)return;list.replaceChildren();const query=byId('av32Employee')?.value||'';
    const options=[...employeeOptions,...requiredEmployeeIds.filter(id=>!employeeOptions.some(employee=>employee.id_employee===id)).map(id=>({id_employee:id,name:`Membre ${id} · à revalider`,activity_checked:false}))];
    for(const employee of options){if(!nameMatches(employee.name,query)&&!requiredEmployeeIds.includes(employee.id_employee))continue;const label=document.createElement('label');label.className='av32CheckLabel av32EmployeeOption';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.employeeId=employee.id_employee;checkbox.checked=requiredEmployeeIds.includes(employee.id_employee);const text=document.createElement('span');text.textContent=`${employee.name} · ${employee.activity_checked===true?'métier confirmé':'métier à confirmer'}`;label.append(checkbox,text);list.appendChild(label);checkbox.addEventListener('change',()=>{if(checkbox.checked&&!requiredEmployeeIds.includes(employee.id_employee)){if(requiredEmployeeIds.length>=preferences().persons){checkbox.checked=false;status('Choisis au maximum autant de membres que l’effectif prévu.','err');return}requiredEmployeeIds.push(employee.id_employee)}else requiredEmployeeIds=requiredEmployeeIds.filter(id=>id!==employee.id_employee);resetParallel();reset('Équipe souhaitée modifiée. Recherche de nouvelles propositions.');renderEmployeeOptions();updateConditions()})}
    byId('av32EmployeeHint').textContent=employeeOptions.length?`${requiredEmployeeIds.length} membre(s) demandé(s) sur ${preferences().persons}. Les autres places sont complétées avec des profils de métier confirmé.`:'Les membres disponibles seront proposés après une première recherche. Aucun choix obligatoire pour les métiers confirmés.';
  }
  function renderStatus(){const found=filteredSlots(),issues=warnings();if(responseMeta&&!freshChecked(responseMeta.checked_at)){status('Le contrôle du planning a expiré. Relance la recherche pour obtenir des propositions actuelles.','warn');return}if(responseMeta?.employee_preference_required){byId('av32Preferences').open=true;status(`Choisis les ${preferences().persons} membre(s) de l’équipe dans Préférences, puis relance la recherche. Leur métier et leur contrat resteront à confirmer.`,'warn');return}if(!slots.length){status(issues.length?`Aucune proposition complète retenue. ${issues.join(' ')}`:'Aucun chantier complet trouvé sur cette période. Essaie une autre période, un effectif adapté ou un autre maximum de travail quotidien.',issues.length?'warn':'');return}if(!found.length){status('Aucune proposition complète ne correspond à cette recherche. Change les préférences puis relance-la.');return}const checked=Number.isFinite(checkedAt())?` Planning contrôlé le ${new Date(checkedAt()).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}.`:'';status(`${found.length} proposition${found.length>1?'s':''} couvrant tout le chantier.${checked}${issues.length?' '+issues.join(' '):''} Trajets, contrats et conditions restent à confirmer.`,'warn')}
  function planSummary(plan){const first=plan.segments[0],last=plan.segments.at(-1),date=first.date===last.date?formatDate(first.date):`${formatDate(first.date)} → ${formatDate(last.date)}`;return `<div class="av32When">${esc(date)} · ${plan.day_count} jour${plan.day_count>1?'s':''}</div><div class="av32Who">${esc(plan.crew.map(member=>member.name).join(' + '))}</div><div class="av32Meta">${esc(hoursLabel(plan.requested_labor_minutes))} de travail au total · ${esc(hoursLabel(plan.onsite_minutes))} sur place par personne</div>`}
  function segmentHtml(segment){return `<div class="av32Segment">${esc(formatDate(segment.date))} · ${esc(segment.start)}–${esc(segment.end)} · ${esc(hoursLabel(segment.onsite_minutes))} par personne</div>`}
  function renderSlots(){
    const box=byId('av32Results');if(!box)return;box.replaceChildren();if(loading&&!responseMeta){status('Vérification des horaires, des interventions et des absences…');return}const found=filteredSlots();renderStatus();
    const featured=shortlist(found),ordered=[...featured,...found.filter(slot=>!featured.includes(slot))],displayed=visible===3?featured:ordered.slice(0,visible);
    for(const slot of displayed){
      const card=document.createElement('div');card.className='av32Plan';const button=document.createElement('button');button.type='button';button.className='av32Slot';button.setAttribute('aria-pressed',String(selectedSlot&&slotKey(selectedSlot)===slotKey(slot)));if(selectedSlot&&slotKey(selectedSlot)===slotKey(slot))button.classList.add('selected');
      button.innerHTML=`<div>${planSummary(slot)}<div class="av32Checks">${esc(slotConditions(slot).join(' · '))}</div><div class="av32Hint">Mémoriser cette proposition · sans réservation</div></div>`;button.addEventListener('click',()=>selectSlot(slot));card.appendChild(button);
      const segments=document.createElement('div');segments.innerHTML=slot.segments.slice(0,3).map(segmentHtml).join('');card.appendChild(segments);
      if(slot.segments.length>3){const details=document.createElement('details');details.innerHTML=`<summary>Voir les ${slot.segments.length-3} autres plages</summary>${slot.segments.slice(3).map(segmentHtml).join('')}`;card.appendChild(details)}box.appendChild(card);
    }
    if(found.length>displayed.length){const more=document.createElement('button');more.type='button';more.className='av32More';more.id='av32More';more.textContent=`Voir ${Math.min(6,found.length-displayed.length)} autres possibilités (${found.length-displayed.length} restantes)`;more.addEventListener('click',()=>{visible+=6;renderSlots()});box.appendChild(more)}
    if(responseMeta?.truncated&&found.length<=displayed.length){const note=document.createElement('div');note.className='av32Hint';note.textContent='D’autres possibilités peuvent exister. Affine la date ou la période pour les rechercher.';box.appendChild(note)}
  }
  function renderProposal(proposal){
    const box=byId('av32Selected');if(!box||!proposal)return;const plan=proposal.plan,legacy=proposal.legacy_slot||proposal.slot,recheck=proposal.needs_recheck;
    if(plan&&!matchesRequest(plan,proposal.preferences||preferences(),true)){box.replaceChildren();return}
    if(!plan&&!validSlot(legacy))return;
    const content=plan?`${planSummary(plan)}${plan.segments.slice(0,3).map(segmentHtml).join('')}<div class="av32Checks">${esc(slotConditions(plan).join(' · '))}</div>`:`Ancienne proposition pour une personne : ${esc(formatDate(legacy.date))}, ${esc(legacy.start)}–${esc(legacy.end)} · ${esc(legacy.intervenant)}. Elle ne couvre pas nécessairement le chantier complet.`;
    box.innerHTML=`<div class="av32Selected ${recheck?'recheck':''}"><strong>${recheck?'Proposition mémorisée · à revérifier':'Chantier complet mémorisé'}</strong><br>${content}<br>${recheck?'Relance la recherche pour contrôler tout le chantier.':'Aucune intervention n’est réservée dans Ogust ou Google Agenda.'}<br><button type="button" class="av32Clear" id="av32Clear">Retirer cette proposition</button></div>`;
    byId('av32Clear')?.addEventListener('click',()=>{clearSelected();renderSlots()});
  }
  function selectSlot(slot){
    if(contextStamp!==contextKey()||!slots.some(candidate=>slotKey(candidate)===slotKey(slot))||!matchesRequest(slot,preferences()))return;
    if(!freshChecked(responseMeta?.checked_at)){status('Le contrôle du planning a expiré. Relance la recherche avant de choisir cet horaire.','warn');return}
    selectedSlot=JSON.parse(JSON.stringify(slot));const proposal={version:3,planning_mode:'job',context:context(),preferences:preferences(),plan:JSON.parse(JSON.stringify(slot)),checked_at:responseMeta.checked_at,needs_recheck:false};currentState().availabilityProposal=proposal;clearTimeout(expiryTimer);expiryTimer=setTimeout(expireSelection,Math.max(1,FRESH_MS-(Date.now()-checkedAt())));renderSlots();renderProposal(proposal);window.dispatchEvent(new CustomEvent('acj:availability-selected',{detail:{plan:JSON.parse(JSON.stringify(slot))}}));notify();
  }
  async function search(){
    refreshContext();if(loading)return;const p=preferences();
    const work=workModel();if(!work.lines.length||!work.activity){status(work.all.length?'Choisis l’intervention à planifier avant la recherche.':'Ajoute une prestation avant de chercher un créneau.','err');byId('av32Scope')?.focus();return}
    if(!work.automatic&&!manualDuration){status(work.unconfirmed?'Renseigne explicitement le temps total retenu : l’estimation IA n’est pas confirmée.':'Renseigne le temps de travail total pour les prestations au forfait, à l’unité ou de durée inconnue.','err');byId('av32Duration')?.focus();return}
    if(!Number.isInteger(p.labor_minutes)||p.labor_minutes<30||p.labor_minutes>28800){status('Indique un temps de travail total compris entre 30 minutes et 480 heures.','err');byId('av32Duration')?.focus();return}
    if(p.labor_minutes<p.persons*30){status('Prévois au moins 30 minutes de travail par personne, ou réduis l’effectif.','err');return}
    if(!validPreferences(p)){status('Vérifie les dates, l’effectif, le maximum quotidien et les membres souhaités.','err');return}
    if(p.persons>1&&!p.parallel_confirmed){status('Confirme que les tâches peuvent être réalisées en parallèle par cette équipe.','err');byId('av32ParallelConfirm')?.focus();return}
    reset('',true);loading=true;hasSearched=true;const seq=++generation,stamp=requestKey(),abort=new AbortController();controller=abort;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;abort.abort()},SEARCH_TIMEOUT_MS);const button=byId('av32Search');button.disabled=true;button.textContent='Recherche en cours…';status('Vérification des horaires, des interventions et des absences…');
    try{
      const url=new URL(API);Object.entries({action:'availability',planning_mode:'job',activity:work.activity,labor_minutes:p.labor_minutes,persons:p.persons,daily_minutes:p.daily_minutes,from:p.from,days:p.days,company:company(),period:p.period,max_results:80}).forEach(([key,value])=>url.searchParams.set(key,String(value)));if(selectedClientId())url.searchParams.set('id_customer',selectedClientId());if(p.weekday!=='')url.searchParams.set('weekday',p.weekday);if(p.employee_ids.length)url.searchParams.set('employee_ids',JSON.stringify(p.employee_ids));if(p.persons>1)url.searchParams.set('parallel_confirmed','1');
      const response=await fetch(url.toString(),{cache:'no-store',signal:abort.signal}),data=await response.json().catch(()=>({}));
      if(seq!==generation||stamp!==requestKey())return;if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP_${response.status}`);
      if(!freshChecked(data.checked_at))throw new Error('VERIFICATION_EXPIRED');
      if(!Array.isArray(data.plans))throw new Error('JOB_PLANS_REQUIRED');
      responseMeta=data;updateEmployeeOptions();const seen=new Set(),returned=data.plans;
      const acceptable=plan=>matchesRequest(plan,p);
      unverifiedSlots=returned.filter(slot=>!acceptable(slot)).length;slots=returned.filter(acceptable).filter(slot=>{const key=slotKey(slot);if(seen.has(key))return false;seen.add(key);return true});visible=3;renderSlots();
    }catch(error){if(seq===generation&&stamp===requestKey()&&(error?.name!=='AbortError'||timedOut))status(timedOut?'La lecture des plannings prend trop de temps. Réessaie ; aucune proposition n’a été retenue.':error?.message==='VERIFICATION_EXPIRED'?'Le contrôle du planning est trop ancien ou sans date exploitable. Relance la recherche.':error?.message==='JOB_PLANS_REQUIRED'?'Le serveur ne fournit pas encore de chantier complet. Aucun ancien créneau n’a été repris comme plan.':`${errorText(error?.message)}. Aucune proposition complète n’a été retenue.`,'err')}
    finally{clearTimeout(timeout);if(seq===generation){loading=false;controller=null;button.disabled=false;button.textContent='Trouver 3 propositions'}}
  }
  function getDraft(){expireSelection();return {version:3,context:context(),preferences:preferences(),proposal:currentState()?.availabilityProposal?JSON.parse(JSON.stringify(currentState().availabilityProposal)):null}}
  function restore(draft){
    const reject=()=>{if(currentState())delete currentState().availabilityProposal;selectedSlot=null;clearTimeout(expiryTimer);expiryTimer=null;byId('av32Selected')?.replaceChildren();notify();return false};
    refreshContext();if(!draft||![1,2,3].includes(draft.version))return reject();
    const proposal=draft.proposal||draft,stored=draft.context||proposal.context,p=draft.preferences||proposal.preferences||{},before=context(),legacy=draft.version<3;
    if(!stored||!['company','quote','customer','client','address'].every(key=>String(stored[key]||'')===String(before[key]||'')))return reject();
    if(stored.work!==undefined&&stored.work!==before.work){if(!legacy)return reject();try{const strip=text=>JSON.stringify(JSON.parse(text).map(line=>{delete line.ai_confirmed;return line}));if(strip(stored.work)!==strip(before.work))return reject()}catch{return reject()}}
    if(workModel().needsScope){const scope=String(p.scope_activity||stored.activity||'');if(!byId('av32Scope').querySelector(`option[value="${Object.hasOwn(ACTIVITIES,scope)?scope:'__invalid'}"]`))return reject();byId('av32Scope').value=scope;refreshContext()}
    const current=context();if(String(stored.activity||'')!==current.activity||Number(stored.quote_hours)!==current.quote_hours)return reject();
    manualDuration=!!p.manual_duration;
    const labor=legacy?Number(p.duration_minutes):Number(p.labor_minutes),persons=legacy?1:Number(p.persons);
    if(Number.isInteger(labor)&&labor>=30&&labor<=28800)byId('av32Duration').value=String(labor/60);
    byId('av32Persons').value=String([1,2,3].includes(persons)?persons:1);
    byId('av32DailyHours').value=String(!legacy&&Number.isInteger(p.daily_minutes)&&p.daily_minutes>=30&&p.daily_minutes<=540?p.daily_minutes/60:8);
    const excluded=new Set((Array.isArray(proposal.plan?.crew)?proposal.plan.crew:[]).filter(excludedForCleaning).map(member=>member.id_employee));
    requiredEmployeeIds=!legacy&&Array.isArray(p.employee_ids)?[...new Set(p.employee_ids.filter(id=>typeof id==='string'&&id.trim()&&id.length<=50&&!excluded.has(id)))].slice(0,3):[];
    resetParallel();renderEmployeeOptions();
    if(validDate(p.from))byId('av32From').value=p.from;
    if([7,14,21].includes(Number(p.days)))byId('av32Days').value=String(p.days);
    if(['any','morning','afternoon'].includes(p.period))byId('av32Period').value=p.period;
    if(['','0','1','2','3','4','5','6'].includes(String(p.weekday??'')))byId('av32Weekday').value=String(p.weekday??'');byId('av32Employee').value='';updateDurationHint();
    updateConditions();const oldSlot=legacy?proposal.slot:proposal.legacy_slot,plan=!legacy&&matchesRequest(proposal.plan,preferences(),true)?proposal.plan:null;
    if(plan||validSlot(oldSlot)){currentState().availabilityProposal={version:3,planning_mode:plan?'job':'legacy_slot',context:context(),preferences:preferences(),...(plan?{plan:JSON.parse(JSON.stringify(plan))}:{legacy_slot:JSON.parse(JSON.stringify(oldSlot))}),checked_at:proposal.checked_at||'',needs_recheck:true};selectedSlot=null;renderProposal(currentState().availabilityProposal);status('Proposition mémorisée. Tout le chantier doit être contrôlé à nouveau.','warn')}
    else if(proposal.plan)return reject();
    return true;
  }
  function wrap(){
    for(const name of ['goStep','renderQuoteLines','setMode','applyImportedNotesClientV39']){const fn=window[name];if(typeof fn==='function')window[name]=function(){const result=fn.apply(this,arguments);refreshContext();return result}}
    const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){reset('',true);const result=fresh.apply(this,arguments);contextStamp='';lastWorkStamp='';manualDuration=false;employeeOptions=[];requiredEmployeeIds=[];employeeScope='';byId('av32Scope').value='';byId('av32Persons').value='1';byId('av32DailyHours').value='8';resetParallel();refreshContext();return result};
    const payload=window.quotePayload;if(typeof payload==='function')window.quotePayload=function(){refreshContext();const result=payload.apply(this,arguments),proposal=currentState()?.availabilityProposal;if(proposal)result.availability_proposal=JSON.parse(JSON.stringify(proposal));return result};
  }
  function init(){ensurePanel();wrap();refreshContext();window.addEventListener('acj:company-changed',refreshContext);document.addEventListener('input',event=>{if(['client','adresse','ogcSearch'].includes(event.target?.id))queueMicrotask(refreshContext)});document.addEventListener('click',event=>{if(event.target?.closest?.('.ogcResult,#ogcChangeBtn,#ogcExistingBtn,#ogcNewBtn'))queueMicrotask(refreshContext)})}
  window.acjAvailabilityV32={search,get selected(){expireSelection();return selectedSlot&&contextStamp===contextKey()&&matchesRequest(selectedSlot,preferences())?selectedSlot:null},getDraft,restore,clear:()=>reset('Proposition retirée.'),get rules(){return {base:'client ∩ équipe',scheduled:'Google pour JB/Vincent/Yohann, Ogust pour les autres',absences:'Ogust',staffing:'équipe constante de 1 à 3 personnes',travel:'non vérifié',pause:'12:00–13:00 exclue'}}};
  window.__acjAvailabilityV32=true;const start=()=>queueMicrotask(init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
