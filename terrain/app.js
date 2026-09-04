const CONFIG = {
  ogustCustomerSearchUrl: 'https://acj-ogust-proxy.vercel.app/api/ogust-customer',
  useRealOgustSearch: true,
  googleCalendarConnected: false,
  ogustWriteConnected: false
};

const employees = [
  { id_employee:'emp-101', name:'Julien Martin' },
  { id_employee:'emp-102', name:'Nicolas Dubois' },
  { id_employee:'emp-103', name:'Thomas Leroy' }
];

const fallbackCustomers = [
  {id_customer:'demo-1001',label:'DUPONT Jean',phone:'06 12 34 56 78',city:'Lille',address:'12 rue Nationale, 59000 Lille',zip:'59000'},
  {id_customer:'demo-1002',label:'DUPONT Jean',phone:'06 98 76 54 32',city:'Seclin',address:'8 rue Pasteur, 59113 Seclin',zip:'59113'},
  {id_customer:'demo-1003',label:'MARTIN Sophie',phone:'07 11 22 33 44',city:'Marquillies',address:'5 rue du Moulin, 59274 Marquillies',zip:'59274'},
  {id_customer:'demo-1004',label:'LEFEBVRE Alain',phone:'06 44 55 66 77',city:'Tourcoing',address:'24 rue de Lille, 59200 Tourcoing',zip:'59200'}
];

const demoInterventions = [
  {
    local_id:'loc-1', id_customer:'demo-1003', id_employee:'emp-101', id_service:null, google_event_id:null,
    client:'MARTIN Sophie', phone:'07 11 22 33 44', address:'5 rue du Moulin, 59274 Marquillies', city:'Marquillies',
    service:'Taille de haies', date:todayISO(), start:'08:00', end:'10:30', instructions:'Haie arrière uniquement. Évacuation des déchets prévue.',
    km:12, status:'planned'
  },
  {
    local_id:'loc-2', id_customer:'demo-1001', id_employee:'emp-101', id_service:null, google_event_id:null,
    client:'DUPONT Jean', phone:'06 12 34 56 78', address:'12 rue Nationale, 59000 Lille', city:'Lille',
    service:'Tonte', date:todayISO(), start:'11:15', end:'13:15', instructions:'Accès par le portillon gauche.',
    km:21, status:'planned'
  },
  {
    local_id:'loc-3', id_customer:'demo-1004', id_employee:'emp-101', id_service:null, google_event_id:null,
    client:'LEFEBVRE Alain', phone:'06 44 55 66 77', address:'24 rue de Lille, 59200 Tourcoing', city:'Tourcoing',
    service:'Bricolage', date:todayISO(), start:'14:30', end:'17:00', instructions:'Pose de deux étagères. Vérifier chevilles avant départ.',
    km:18, status:'planned'
  }
];

const state = {
  currentEmployee:'emp-101',
  selectedCustomer:null,
  selectedDate:todayISO(),
  interventions: loadInterventions()
};

function todayISO(){
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10);
}
function addDaysISO(base,n){
  const d=new Date(base+'T12:00:00'); d.setDate(d.getDate()+n); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10);
}
function loadInterventions(){
  try{
    const x=JSON.parse(localStorage.getItem('acj-terrain-interventions')||'null');
    return Array.isArray(x) && x.length ? x : demoInterventions;
  }catch{return demoInterventions}
}
function saveInterventions(){
  localStorage.setItem('acj-terrain-interventions',JSON.stringify(state.interventions));
}
function minutesBetween(a,b){
  const [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number); return (bh*60+bm)-(ah*60+am);
}
function durationLabel(a,b){
  const m=Math.max(0,minutesBetween(a,b)); const h=Math.floor(m/60),r=m%60;
  return r ? `${h} h ${String(r).padStart(2,'0')}` : `${h} h`;
}
function formatDateFr(iso){
  return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(iso+'T12:00:00'));
}
function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

const api = {
  async searchCustomers(query){
    const q=String(query||'').trim();
    if(q.length<2) return [];
    if(CONFIG.useRealOgustSearch){
      try{
        const r=await fetch(`${CONFIG.ogustCustomerSearchUrl}?q=${encodeURIComponent(q)}`,{headers:{'Accept':'application/json'}});
        if(r.ok){
          const data=await r.json();
          if(Array.isArray(data.customer_candidates)) return data.customer_candidates;
        }
      }catch(e){}
    }
    const n=q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return fallbackCustomers.filter(c =>
      [c.label,c.phone,c.city,c.address].some(v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(n))
    ).slice(0,8);
  },
  async createIntervention(payload){
    return {
      ...payload,
      local_id:'loc-'+Date.now(),
      id_service:null,
      google_event_id:null,
      sync_status:'pending'
    };
  }
};

function interventionCard(i){
  const status=i.status==='done' ? '<span class="badge good">Terminée</span>' : '<span class="badge">Prévue</span>';
  return `
    <article class="intervention-card">
      <div class="intervention-top">
        <div class="time-block"><strong>${escapeHtml(i.start)}</strong><span>${escapeHtml(i.end)}<br>${escapeHtml(durationLabel(i.start,i.end))}</span></div>
        <div>
          <div class="client-name">${escapeHtml(i.client)}</div>
          <div class="service-name">${escapeHtml(i.service)}</div>
          <div class="city">${escapeHtml(i.city||'')} · ${escapeHtml(i.address||'')}</div>
        </div>
        ${status}
      </div>
      <div class="card-actions">
        <button class="secondary-btn open-intervention" data-id="${escapeHtml(i.local_id)}">Ouvrir</button>
      </div>
    </article>`;
}

function renderToday(){
  const list=state.interventions.filter(i=>i.date===todayISO() && i.id_employee===state.currentEmployee).sort((a,b)=>a.start.localeCompare(b.start));
  document.getElementById('todayTitle').textContent=formatDateFr(todayISO()).replace(/^./,c=>c.toUpperCase());
  const mins=list.reduce((s,i)=>s+Math.max(0,minutesBetween(i.start,i.end)),0);
  const km=list.reduce((s,i)=>s+Number(i.km||0),0);
  document.getElementById('statCount').textContent=list.length;
  document.getElementById('statHours').textContent=(mins/60).toLocaleString('fr-FR',{maximumFractionDigits:1})+' h';
  document.getElementById('statKm').textContent=km+' km';
  document.getElementById('todayList').innerHTML=list.length?list.map(interventionCard).join(''):'<div class="notice">Aucune intervention prévue aujourd’hui.</div>';
}

function renderWeek(){
  const days=[0,1,2,3,4,5,6].map(n=>addDaysISO(todayISO(),n));
  document.getElementById('weekDays').innerHTML=days.map((iso,idx)=>{
    const d=new Date(iso+'T12:00:00');
    return `<button class="day-chip ${iso===state.selectedDate?'active':''}" data-date="${iso}">
      <span>${new Intl.DateTimeFormat('fr-FR',{weekday:'short'}).format(d)}</span>
      <strong>${d.getDate()}</strong>
    </button>`;
  }).join('');
  const list=state.interventions.filter(i=>i.date===state.selectedDate && i.id_employee===state.currentEmployee).sort((a,b)=>a.start.localeCompare(b.start));
  document.getElementById('planningList').innerHTML=list.length?list.map(interventionCard).join(''):'<div class="notice">Aucune intervention ce jour.</div>';
}

function populateEmployees(){
  const opts=employees.map(e=>`<option value="${e.id_employee}">${escapeHtml(e.name)}</option>`).join('');
  document.getElementById('employeeFilter').innerHTML=opts;
  document.getElementById('employeeSelect').innerHTML='<option value="">Choisir</option>'+opts;
  document.getElementById('employeeFilter').value=state.currentEmployee;
  document.getElementById('employeeSelect').value=state.currentEmployee;
}

function selectCustomer(c){
  state.selectedCustomer=c;
  document.getElementById('customerId').value=c.id_customer;
  document.getElementById('customerSearch').value=c.label;
  document.getElementById('customerResults').hidden=true;
  const box=document.getElementById('selectedCustomer');
  box.hidden=false;
  box.innerHTML=`<strong>${escapeHtml(c.label)} — ${escapeHtml(c.city||'')}</strong>
    <span>${escapeHtml(c.phone||'Sans téléphone')}</span>
    <span>${escapeHtml(c.address||'Adresse non remontée')}</span>`;
  const addr=document.getElementById('serviceAddress');
  addr.innerHTML=`<option value="${escapeHtml(c.address||'')}">${escapeHtml(c.address||'Adresse à compléter')}</option>`;
}

function openIntervention(id){
  const i=state.interventions.find(x=>x.local_id===id); if(!i)return;
  document.getElementById('dialogTitle').textContent=i.client;
  const gps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address||'')}`;
  const phoneHref='tel:'+String(i.phone||'').replace(/\s/g,'');
  document.getElementById('dialogBody').innerHTML=`
    <div class="detail-grid">
      <div class="detail-box"><span>Prestation</span><strong>${escapeHtml(i.service)}</strong></div>
      <div class="detail-box"><span>Horaires</span><strong>${escapeHtml(i.start)} → ${escapeHtml(i.end)} · ${escapeHtml(durationLabel(i.start,i.end))}</strong></div>
      <div class="detail-box"><span>Adresse</span><strong>${escapeHtml(i.address)}</strong>
        <div class="card-actions"><a class="secondary-btn" href="${gps}" target="_blank" rel="noopener">GPS</a><a class="secondary-btn" href="${phoneHref}">Appeler</a></div>
      </div>
      <div class="detail-box"><span>Consignes</span><strong>${escapeHtml(i.instructions||'Aucune consigne')}</strong></div>
      <div class="photo-grid"><div class="photo-box">Photo avant<br>＋ Ajouter</div><div class="photo-box">Photo après<br>＋ Ajouter</div></div>
      <div class="detail-box"><span>Compte-rendu terrain</span><textarea id="fieldNote" rows="3" placeholder="Commentaire…">${escapeHtml(i.field_note||'')}</textarea></div>
      <div class="detail-box"><span>Kilomètres</span><input id="fieldKm" type="number" min="0" step="1" value="${Number(i.km||0)}"></div>
      <div class="card-actions">
        <button class="secondary-btn" id="startBtn">Démarrer</button>
        <button class="primary-btn" id="finishBtn" style="width:auto;flex:1">Terminer</button>
      </div>
      <button class="danger-btn" id="problemBtn">Signaler un problème</button>
    </div>`;
  const dlg=document.getElementById('interventionDialog');
  dlg.showModal();
  document.getElementById('finishBtn').onclick=()=>{
    i.status='done'; i.field_note=document.getElementById('fieldNote').value; i.km=Number(document.getElementById('fieldKm').value||0); saveInterventions(); dlg.close(); renderAll();
  };
  document.getElementById('startBtn').onclick=()=>{ i.status='in_progress'; saveInterventions(); document.getElementById('startBtn').textContent='En cours'; };
  document.getElementById('problemBtn').onclick=()=>alert('Signalement enregistré localement dans cette V1. Le branchement bureau sera ajouté ensuite.');
}

function renderAll(){renderToday();renderWeek()}

document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');
  if(nav){
    const target=nav.dataset.nav;
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-'+target).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===target));
  }
  const open=e.target.closest('.open-intervention'); if(open)openIntervention(open.dataset.id);
  const chip=e.target.closest('.day-chip'); if(chip){state.selectedDate=chip.dataset.date;renderWeek()}
  const tool=e.target.closest('.tool-card'); if(tool){
    const s=document.getElementById('toolStatus'); s.hidden=false; s.textContent=`${tool.dataset.tool} : module préparé. Le branchement sera ajouté dans une prochaine étape.`;
  }
});

document.getElementById('employeeFilter').addEventListener('change',e=>{state.currentEmployee=e.target.value;renderAll()});
document.getElementById('closeDialog').addEventListener('click',()=>document.getElementById('interventionDialog').close());

let searchTimer;
document.getElementById('customerSearch').addEventListener('input',e=>{
  state.selectedCustomer=null; document.getElementById('customerId').value=''; document.getElementById('selectedCustomer').hidden=true;
  clearTimeout(searchTimer);
  const q=e.target.value.trim();
  const box=document.getElementById('customerResults');
  if(q.length<2){box.hidden=true;return}
  searchTimer=setTimeout(async()=>{
    box.hidden=false; box.innerHTML='<div class="search-result"><span>Recherche Ogust…</span></div>';
    const rows=await api.searchCustomers(q);
    box.innerHTML=rows.length?rows.map((c,idx)=>`
      <div class="search-result customer-pick" data-idx="${idx}">
        <strong>${escapeHtml(c.label)} — ${escapeHtml(c.city||'')}</strong>
        <span>${escapeHtml(c.phone||'')} · ${escapeHtml(c.address||'')}</span>
      </div>`).join(''):'<div class="search-result"><span>Aucun client trouvé.</span></div>';
    box._rows=rows;
  },260);
});
document.getElementById('customerResults').addEventListener('click',e=>{
  const pick=e.target.closest('.customer-pick'); if(!pick)return;
  const rows=document.getElementById('customerResults')._rows||[];
  const c=rows[Number(pick.dataset.idx)]; if(c)selectCustomer(c);
});

document.getElementById('newInterventionForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const status=document.getElementById('createStatus');
  if(!state.selectedCustomer || !document.getElementById('customerId').value){
    status.hidden=false;status.textContent='Sélectionne le client dans la liste Ogust. La saisie libre n’est pas autorisée.';return;
  }
  const payload={
    id_customer:state.selectedCustomer.id_customer,
    id_employee:document.getElementById('employeeSelect').value,
    client:state.selectedCustomer.label,
    phone:state.selectedCustomer.phone||'',
    address:document.getElementById('serviceAddress').value,
    city:state.selectedCustomer.city||'',
    service:document.getElementById('serviceType').value,
    date:document.getElementById('serviceDate').value,
    start:document.getElementById('startTime').value,
    end:document.getElementById('endTime').value,
    instructions:document.getElementById('instructions').value,
    km:0,status:'planned'
  };
  if(minutesBetween(payload.start,payload.end)<=0){
    status.hidden=false;status.textContent='L’heure de fin doit être après l’heure de début.';return;
  }
  const created=await api.createIntervention(payload);
  state.interventions.push(created);saveInterventions();renderAll();
  status.hidden=false;
  status.innerHTML=`Intervention créée dans ACJ Terrain.<br><strong>Client Ogust :</strong> ${escapeHtml(created.id_customer)}<br>
    <strong>Google Agenda :</strong> en attente de connexion<br><strong>Ogust planning :</strong> en attente de validation de l’écriture API.`;
  e.target.reset(); state.selectedCustomer=null;document.getElementById('selectedCustomer').hidden=true;document.getElementById('serviceAddress').innerHTML='';
  document.getElementById('serviceDate').value=todayISO(); document.getElementById('employeeSelect').value=state.currentEmployee;
});

document.getElementById('serviceDate').value=todayISO();
document.getElementById('startTime').value='08:00';
document.getElementById('endTime').value='10:00';

let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').hidden=false});
document.getElementById('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').hidden=true});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}

populateEmployees();
renderAll();
