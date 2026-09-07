// Devis ACJ v32 — disponibilités de base Ogust + planning réel + absences.
(function(){
  if(window.__acjAvailabilityV32)return;
  const API='https://acj-ogust-proxy.vercel.app/api/ogust-history';
  let selectedSlot=null;
  let loading=false;

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function currentState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
  function activity(){return currentState()?.mode||'jardin'}
  function company(){return currentState()?.company||'ACJ Services'}
  function selectedClient(){try{return window.ogustClientChoiceV21?.selected||null}catch{return null}}
  function selectedClientId(){return String(selectedClient()?.id_customer||'').trim()}
  function tomorrow(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function estimateHours(){const s=currentState();if(!s?.lines?.length)return 0;return s.lines.filter(l=>l?.type==='service'&&String(l?.unit||'').toLowerCase()==='h').reduce((sum,l)=>sum+(Number(l?.qty)||0),0)}
  function formatDate(iso){try{return new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${iso}T12:00:00`))}catch{return iso}}
  function ruleText(mode){
    const source=(mode==='jardin'||mode==='bricol')?'JB, Vincent et Yohann : Google Agenda. Les autres : Ogust.':'Planning des intervenants : Ogust.';
    return `${source} Le calcul croise les horaires de base client/intervenant, puis retire les interventions déjà prévues et les absences connues.`;
  }

  function addStyles(){
    if(document.getElementById('availability-v32-style'))return;
    const s=document.createElement('style');s.id='availability-v32-style';s.textContent=`
      .av32Card{background:#fff;border:1px solid #dfe8f0;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(24,55,86,.065);margin-bottom:13px}
      .av32Head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:5px}.av32Title{font-size:14px;font-weight:860;color:#1b3048}.av32Tag{font-size:9px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;background:#eef8fd;border:1px solid #cce7f4;color:#176b9e;padding:5px 7px;border-radius:999px;white-space:nowrap}
      .av32Intro{font-size:11px;color:#718197;line-height:1.5;margin-bottom:12px}.av32Client{font-size:10px;color:#3a5068;background:#f6f9fb;border:1px solid #dfe8f0;border-radius:10px;padding:8px 9px;margin-bottom:10px}.av32Client strong{color:#173049}
      .av32Fields{display:grid;grid-template-columns:1fr 1fr 92px;gap:9px;align-items:end}.av32Field label{display:block;color:#3a5068;font-size:10px;font-weight:760;margin-bottom:5px}.av32Field input,.av32Field select{width:100%;min-height:44px;background:#f9fbfd;border:1px solid #d7e2eb;color:#152a42;border-radius:12px;padding:10px 11px;font:inherit}
      .av32Search{width:100%;min-height:47px;margin-top:10px;border:0;border-radius:13px;background:linear-gradient(135deg,#0877c7,#14a4c8);color:#fff;font-weight:850;box-shadow:0 8px 20px rgba(11,120,201,.18)}.av32Search:disabled{background:#e7edf2;color:#97a7b6;box-shadow:none}
      .av32Status{font-size:11px;line-height:1.45;color:#718197;margin-top:10px}.av32Status.err{color:#a33d43;background:#fff3f3;border:1px solid #efd0d2;padding:9px 10px;border-radius:11px}.av32Status.ok{color:#246744;background:#edf8f2;border:1px solid #c4e7d2;padding:9px 10px;border-radius:11px}.av32Status.warn{color:#7b5b13;background:#fff8e7;border:1px solid #ecd9a5;padding:9px 10px;border-radius:11px}
      .av32Results{display:grid;gap:8px;margin-top:11px}.av32Slot{border:1px solid #dce6ee;background:#fff;border-radius:13px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:10px;text-align:left;color:#173049;box-shadow:0 3px 10px rgba(31,60,88,.035)}.av32Slot.selected{border-color:#55acd5;background:#eef8fd;box-shadow:inset 0 0 0 1px rgba(11,120,201,.06)}.av32When{font-size:13px;font-weight:860}.av32Who{font-size:11px;color:#667b90;margin-top:3px}.av32Meta{font-size:9px;color:#8a9aab;margin-top:4px}.av32Source{align-self:center;font-size:9px;font-weight:850;border-radius:999px;padding:5px 7px;border:1px solid #d9e4ec;background:#f6f9fb;color:#64778a}.av32Source.google{border-color:#bfe3d0;background:#eef9f3;color:#27754e}.av32Selected{margin-top:10px;border:1px solid #bfe3d0;background:#eef9f3;color:#246744;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.45}.av32More{font-size:10px;color:#8b9aab;text-align:center;margin-top:8px}
      @media(max-width:520px){.av32Fields{grid-template-columns:1fr 1fr}.av32Fields .av32Field:last-child{grid-column:1/-1}.av32Card{padding:14px}.av32Slot{grid-template-columns:1fr auto}}
    `;document.head.appendChild(s);
  }

  function panelHtml(){
    const hours=estimateHours(),mode=activity(),client=selectedClient();
    return `<div class="av32Head"><div class="av32Title">Proposer un créneau</div><div class="av32Tag">Disponibilités réelles</div></div>
      <div class="av32Intro" id="av32Intro">${esc(ruleText(mode))}</div>
      <div class="av32Client" id="av32Client">${client?.id_customer?`Client Ogust : <strong>${esc(client.label||client.id_customer)}</strong> · horaires de base client pris en compte.`:'Aucun client Ogust sélectionné : les horaires de base du client ne peuvent pas encore être croisés.'}</div>
      <div class="av32Fields">
        <div class="av32Field"><label>Durée prévue</label><input id="av32Duration" type="number" min="0.5" max="10" step="0.25" value="${hours>0?hours:''}" placeholder="ex. 4"></div>
        <div class="av32Field"><label>À partir du</label><input id="av32From" type="date" value="${tomorrow()}"></div>
        <div class="av32Field"><label>Horizon</label><select id="av32Days"><option value="7">7 jours</option><option value="14" selected>14 jours</option><option value="21">21 jours</option></select></div>
      </div>
      <button type="button" class="av32Search" id="av32Search">Chercher les disponibilités</button>
      <div class="av32Status" id="av32Status">${hours>0?`Durée reprise du devis : ${String(hours).replace('.',',')} h.`:'Renseigne la durée prévue du chantier pour lancer la recherche.'}</div>
      <div class="av32Results" id="av32Results"></div><div id="av32Selected"></div>`;
  }

  function ensurePanel(){
    addStyles();
    const old=document.getElementById('av31Panel');if(old)old.style.display='none';
    const step=document.querySelector('.step[data-step="4"]');if(!step)return null;
    let panel=document.getElementById('av32Panel');
    if(!panel){panel=document.createElement('div');panel.id='av32Panel';panel.className='av32Card';panel.innerHTML=panelHtml();const directCards=[...step.children].filter(el=>el.classList?.contains('card'));const lastCard=directCards.at(-1);if(lastCard)step.insertBefore(panel,lastCard);else step.appendChild(panel);panel.querySelector('#av32Search')?.addEventListener('click',search)}
    return panel;
  }
  function refreshContext(){
    const panel=ensurePanel();if(!panel)return;
    const intro=panel.querySelector('#av32Intro');if(intro)intro.textContent=ruleText(activity());
    const c=selectedClient(),clientBox=panel.querySelector('#av32Client');if(clientBox)clientBox.innerHTML=c?.id_customer?`Client Ogust : <strong>${esc(c.label||c.id_customer)}</strong> · horaires de base client pris en compte.`:'Aucun client Ogust sélectionné : les horaires de base du client ne peuvent pas encore être croisés.';
    const input=panel.querySelector('#av32Duration');if(input&&!input.dataset.touched){const h=estimateHours();if(h>0)input.value=String(h)}if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('input',()=>input.dataset.touched='1')}
  }
  function status(text,type=''){const el=document.getElementById('av32Status');if(el){el.textContent=text;el.className=`av32Status ${type}`.trim()}}
  function renderSlots(slots){
    const box=document.getElementById('av32Results');if(!box)return;
    if(!slots?.length){box.innerHTML='';status('Aucun créneau trouvé avec les contraintes connues.','err');return}
    box.innerHTML=slots.slice(0,12).map((slot,i)=>{const base=[];if(slot.employee_base_configured)base.push('base intervenant');if(slot.client_base_configured)base.push('base client');return `<button type="button" class="av32Slot" data-i="${i}"><div><div class="av32When">${esc(formatDate(slot.date))} · ${esc(slot.start)}–${esc(slot.end)}</div><div class="av32Who">${esc(slot.intervenant)}</div><div class="av32Meta">${base.length?`Croisé avec ${esc(base.join(' + '))}`:'Horaires de base non renseignés pour ce profil'}</div></div><span class="av32Source ${slot.source==='google'?'google':''}">${slot.source==='google'?'Google Agenda':'Ogust'}</span></button>`}).join('')+(slots.length>12?`<div class="av32More">${slots.length-12} autre(s) possibilité(s) non affichée(s).</div>`:'');
    [...box.querySelectorAll('.av32Slot')].forEach((btn,i)=>btn.addEventListener('click',()=>selectSlot(slots[i],btn)));
  }
  function selectSlot(slot,btn){selectedSlot=slot;document.querySelectorAll('.av32Slot').forEach(x=>x.classList.remove('selected'));btn?.classList.add('selected');const box=document.getElementById('av32Selected');if(box)box.innerHTML=`<div class="av32Selected"><strong>Créneau retenu pour proposition</strong><br>${esc(formatDate(slot.date))}, ${esc(slot.start)}–${esc(slot.end)} · ${esc(slot.intervenant)} · ${slot.source==='google'?'Google Agenda':'Ogust'}.</div>`;window.dispatchEvent(new CustomEvent('acj:availability-selected',{detail:{...slot}}))}

  async function search(){
    if(loading)return;const panel=ensurePanel();if(!panel)return;
    const hours=Number(panel.querySelector('#av32Duration')?.value||0),from=panel.querySelector('#av32From')?.value||tomorrow(),days=Number(panel.querySelector('#av32Days')?.value||14),clientId=selectedClientId();
    if(!Number.isFinite(hours)||hours<0.5){status('Indique une durée d’au moins 30 minutes.','err');panel.querySelector('#av32Duration')?.focus();return}
    loading=true;const button=panel.querySelector('#av32Search');if(button){button.disabled=true;button.textContent='Recherche en cours…'}document.getElementById('av32Results').innerHTML='';document.getElementById('av32Selected').innerHTML='';selectedSlot=null;status('Croisement horaires de base, planning et absences…');
    try{
      const url=new URL(API);url.searchParams.set('action','availability');url.searchParams.set('activity',activity());url.searchParams.set('duration_minutes',String(Math.round(hours*60)));url.searchParams.set('from',from);url.searchParams.set('days',String(days));url.searchParams.set('company',company());if(clientId)url.searchParams.set('id_customer',clientId);
      const resp=await fetch(url.toString(),{cache:'no-store'}),data=await resp.json().catch(()=>({}));if(!resp.ok||!data?.ok)throw new Error(data?.error||`HTTP_${resp.status}`);
      renderSlots(data.slots||[]);
      const parts=[];if(data?.sources?.google?.queried)parts.push('Google Agenda');if(data?.sources?.ogust?.queried)parts.push('Ogust');
      if(data?.base_availability?.available===false)status(`${data.count||0} créneau(x) trouvé(s), mais les horaires de base Ogust n’ont pas pu être lus. Ne valide pas sans vérification.`,'warn');
      else status(`${data.count||0} créneau(x) trouvé(s) · horaires de base + planning + absences · ${parts.join(' + ')||'Ogust'}.`,'ok');
    }catch(e){status(`Recherche impossible : ${String(e?.message||'erreur').replace(/_/g,' ')}.`,'err')}
    finally{loading=false;if(button){button.disabled=false;button.textContent='Chercher les disponibilités'}}
  }
  function wrapGoStep(){if(window.__acjAvailabilityV32GoStep||typeof window.goStep!=='function')return;const original=window.goStep;window.goStep=function(){const out=original.apply(this,arguments);requestAnimationFrame(refreshContext);return out};window.__acjAvailabilityV32GoStep=true}
  function init(){ensurePanel();wrapGoStep();refreshContext();window.addEventListener('acj:company-changed',()=>setTimeout(refreshContext,0));setTimeout(wrapGoStep,300)}

  window.acjAvailabilityV32={search,get selected(){return selectedSlot},get rules(){return{base:'client ∩ intervenant',scheduled:'Google pour JB/Vincent/Yohann, Ogust pour les autres',absences:'Ogust'}}};
  window.__acjAvailabilityV32=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
