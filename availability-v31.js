// Devis ACJ v31 — propositions de créneaux : JB/Vincent/Yohann via Google Agenda, autres intervenants via Ogust.
(function(){
  if(window.__acjAvailabilityV31)return;
  const API='https://acj-ogust-proxy.vercel.app/api/ogust-history';
  const MODE_LABELS={jardin:'Jardinage',bricol:'Bricolage',menage:'Ménage',nettoyagePro:'Nettoyage pro'};
  let selectedSlot=null;
  let loading=false;

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function currentState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
  function activity(){return currentState()?.mode||'jardin'}
  function company(){return currentState()?.company||'ACJ Services'}
  function tomorrow(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function estimateHours(){
    const s=currentState();if(!s?.lines?.length)return 0;
    return s.lines.filter(l=>l?.type==='service'&&String(l?.unit||'').toLowerCase()==='h').reduce((sum,l)=>sum+(Number(l?.qty)||0),0);
  }
  function formatDate(iso){try{return new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${iso}T12:00:00`))}catch{return iso}}
  function ruleText(mode){
    if(mode==='jardin'||mode==='bricol')return 'Jean-Baptiste, Vincent et Yohann : Google Agenda. Les autres intervenants : Ogust.';
    return 'Recherche sur Ogust. Jean-Baptiste, Vincent et Yohann sont exclus par défaut pour cette prestation.';
  }

  function addStyles(){
    if(document.getElementById('availability-v31-style'))return;
    const s=document.createElement('style');s.id='availability-v31-style';s.textContent=`
      .av31Card{background:#fff;border:1px solid #dfe8f0;border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(24,55,86,.065);margin-bottom:13px}
      .av31Head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:5px}.av31Title{font-size:14px;font-weight:860;color:#1b3048}.av31Tag{font-size:9px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;background:#eef8fd;border:1px solid #cce7f4;color:#176b9e;padding:5px 7px;border-radius:999px;white-space:nowrap}
      .av31Intro{font-size:11px;color:#718197;line-height:1.45;margin-bottom:12px}.av31Fields{display:grid;grid-template-columns:1fr 1fr 92px;gap:9px;align-items:end}.av31Field label{display:block;color:#3a5068;font-size:10px;font-weight:760;margin-bottom:5px}.av31Field input,.av31Field select{width:100%;min-height:44px;background:#f9fbfd;border:1px solid #d7e2eb;color:#152a42;border-radius:12px;padding:10px 11px;font:inherit}
      .av31Search{width:100%;min-height:47px;margin-top:10px;border:0;border-radius:13px;background:linear-gradient(135deg,#0877c7,#14a4c8);color:#fff;font-weight:850;box-shadow:0 8px 20px rgba(11,120,201,.18)}.av31Search:disabled{background:#e7edf2;color:#97a7b6;box-shadow:none}
      .av31Status{font-size:11px;line-height:1.45;color:#718197;margin-top:10px}.av31Status.err{color:#a33d43;background:#fff3f3;border:1px solid #efd0d2;padding:9px 10px;border-radius:11px}.av31Status.ok{color:#246744;background:#edf8f2;border:1px solid #c4e7d2;padding:9px 10px;border-radius:11px}
      .av31Results{display:grid;gap:8px;margin-top:11px}.av31Slot{border:1px solid #dce6ee;background:#fff;border-radius:13px;padding:11px;display:grid;grid-template-columns:1fr auto;gap:10px;text-align:left;color:#173049;box-shadow:0 3px 10px rgba(31,60,88,.035)}.av31Slot.selected{border-color:#55acd5;background:#eef8fd;box-shadow:inset 0 0 0 1px rgba(11,120,201,.06)}.av31When{font-size:13px;font-weight:860}.av31Who{font-size:11px;color:#667b90;margin-top:3px}.av31Source{align-self:center;font-size:9px;font-weight:850;border-radius:999px;padding:5px 7px;border:1px solid #d9e4ec;background:#f6f9fb;color:#64778a}.av31Source.google{border-color:#bfe3d0;background:#eef9f3;color:#27754e}.av31Selected{margin-top:10px;border:1px solid #bfe3d0;background:#eef9f3;color:#246744;border-radius:12px;padding:10px 11px;font-size:11px;line-height:1.45}.av31More{font-size:10px;color:#8b9aab;text-align:center;margin-top:8px}
      @media(max-width:520px){.av31Fields{grid-template-columns:1fr 1fr}.av31Fields .av31Field:last-child{grid-column:1/-1}.av31Card{padding:14px}.av31Slot{grid-template-columns:1fr auto}}
    `;document.head.appendChild(s);
  }

  function panelHtml(){
    const hours=estimateHours();const mode=activity();
    return `<div class="av31Head"><div class="av31Title">Proposer un créneau</div><div class="av31Tag">Disponibilités</div></div>
      <div class="av31Intro" id="av31Intro">${esc(ruleText(mode))}</div>
      <div class="av31Fields">
        <div class="av31Field"><label>Durée prévue</label><input id="av31Duration" type="number" min="0.5" max="10" step="0.25" value="${hours>0?hours:''}" placeholder="ex. 4"></div>
        <div class="av31Field"><label>À partir du</label><input id="av31From" type="date" value="${tomorrow()}"></div>
        <div class="av31Field"><label>Horizon</label><select id="av31Days"><option value="7">7 jours</option><option value="14" selected>14 jours</option><option value="21">21 jours</option></select></div>
      </div>
      <button type="button" class="av31Search" id="av31Search">Chercher les disponibilités</button>
      <div class="av31Status" id="av31Status">${hours>0?`Durée reprise du devis : ${String(hours).replace('.',',')} h.`:'Renseigne la durée prévue du chantier pour lancer la recherche.'}</div>
      <div class="av31Results" id="av31Results"></div><div id="av31Selected"></div>`;
  }

  function ensurePanel(){
    addStyles();
    const step=document.querySelector('.step[data-step="4"]');if(!step)return null;
    let panel=document.getElementById('av31Panel');
    if(!panel){
      panel=document.createElement('div');panel.id='av31Panel';panel.className='av31Card';panel.innerHTML=panelHtml();
      const directCards=[...step.children].filter(el=>el.classList?.contains('card'));
      const lastCard=directCards.at(-1);if(lastCard)step.insertBefore(panel,lastCard);else step.appendChild(panel);
      panel.querySelector('#av31Search')?.addEventListener('click',search);
    }
    return panel;
  }

  function refreshContext(){
    const panel=ensurePanel();if(!panel)return;
    const intro=panel.querySelector('#av31Intro');if(intro)intro.textContent=ruleText(activity());
    const input=panel.querySelector('#av31Duration');
    if(input&&!input.dataset.touched){const h=estimateHours();if(h>0)input.value=String(h)}
    if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('input',()=>input.dataset.touched='1')}
  }

  function status(text,type=''){const el=document.getElementById('av31Status');if(el){el.textContent=text;el.className=`av31Status ${type}`.trim()}}
  function renderSlots(slots){
    const box=document.getElementById('av31Results');if(!box)return;
    if(!slots?.length){box.innerHTML='';status('Aucun créneau trouvé sur la période demandée.','err');return}
    box.innerHTML=slots.slice(0,12).map((slot,i)=>`<button type="button" class="av31Slot" data-i="${i}"><div><div class="av31When">${esc(formatDate(slot.date))} · ${esc(slot.start)}–${esc(slot.end)}</div><div class="av31Who">${esc(slot.intervenant)}</div></div><span class="av31Source ${slot.source==='google'?'google':''}">${slot.source==='google'?'Google Agenda':'Ogust'}</span></button>`).join('')+(slots.length>12?`<div class="av31More">${slots.length-12} autre(s) possibilité(s) non affichée(s).</div>`:'');
    [...box.querySelectorAll('.av31Slot')].forEach((btn,i)=>btn.addEventListener('click',()=>selectSlot(slots[i],btn)));
  }
  function selectSlot(slot,btn){
    selectedSlot=slot;document.querySelectorAll('.av31Slot').forEach(x=>x.classList.remove('selected'));btn?.classList.add('selected');
    const box=document.getElementById('av31Selected');if(box)box.innerHTML=`<div class="av31Selected"><strong>Créneau retenu pour proposition</strong><br>${esc(formatDate(slot.date))}, ${esc(slot.start)}–${esc(slot.end)} · ${esc(slot.intervenant)} · ${slot.source==='google'?'Google Agenda':'Ogust'}.</div>`;
    window.dispatchEvent(new CustomEvent('acj:availability-selected',{detail:{...slot}}));
  }

  async function search(){
    if(loading)return;const panel=ensurePanel();if(!panel)return;
    const hours=Number(panel.querySelector('#av31Duration')?.value||0),from=panel.querySelector('#av31From')?.value||tomorrow(),days=Number(panel.querySelector('#av31Days')?.value||14);
    if(!Number.isFinite(hours)||hours<0.5){status('Indique une durée d’au moins 30 minutes.','err');panel.querySelector('#av31Duration')?.focus();return}
    loading=true;const button=panel.querySelector('#av31Search');if(button){button.disabled=true;button.textContent='Recherche en cours…'}
    document.getElementById('av31Results').innerHTML='';document.getElementById('av31Selected').innerHTML='';selectedSlot=null;status('Lecture des plannings Google Agenda et Ogust…');
    try{
      const url=new URL(API);url.searchParams.set('action','availability');url.searchParams.set('activity',activity());url.searchParams.set('duration_minutes',String(Math.round(hours*60)));url.searchParams.set('from',from);url.searchParams.set('days',String(days));url.searchParams.set('company',company());
      const resp=await fetch(url.toString(),{cache:'no-store'});const data=await resp.json().catch(()=>({}));
      if(!resp.ok||!data?.ok)throw new Error(data?.error||`HTTP_${resp.status}`);
      renderSlots(data.slots||[]);
      const googleUsed=!!data?.sources?.google?.queried;const parts=[];if(googleUsed)parts.push('Google Agenda');if(data?.sources?.ogust?.queried)parts.push('Ogust');status(`${data.count||0} créneau(x) trouvé(s) · ${parts.join(' + ')||'planning'}.`,'ok');
    }catch(e){status(`Recherche impossible : ${String(e?.message||'erreur').replace(/_/g,' ')}.`,'err')}
    finally{loading=false;if(button){button.disabled=false;button.textContent='Chercher les disponibilités'}}
  }

  function wrapGoStep(){
    if(window.__acjAvailabilityV31GoStep||typeof window.goStep!=='function')return;
    const original=window.goStep;window.goStep=function(){const out=original.apply(this,arguments);requestAnimationFrame(refreshContext);return out};window.__acjAvailabilityV31GoStep=true;
  }
  function init(){ensurePanel();wrapGoStep();refreshContext();setTimeout(wrapGoStep,300)}

  window.acjAvailabilityV31={search,get selected(){return selectedSlot},get rules(){return{google:['Jean-Baptiste','Vincent','Yohann'],google_primary_activities:['jardin','bricol'],others:'ogust'}}};
  window.__acjAvailabilityV31=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
