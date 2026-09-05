// Devis ACJ v29.1 — suppression locale des entrées de l'historique.
(function(){
  if(window.__acjHistoryDeleteV291)return;
  const SAVED_KEY='acj_devis_saved_v6';
  const META_KEY='acj_devis_history_meta_v29';

  function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function keyFor(company,ref){return `${String(company||'')}|${String(ref||'')}`}
  function quoteKey(p){return keyFor(p?.societe,p?.numero_devis)}
  function dateMs(p){
    const raw=String(p?.date||'');
    const d=Date.parse(raw);if(Number.isFinite(d))return d;
    const m=raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);if(m)return Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1]));
    return 0;
  }
  function savedQuotes(){const a=readJson(SAVED_KEY,[]);return Array.isArray(a)?a:[]}
  function visibleQuotes(){
    const q=norm(document.getElementById('historySearch')?.value||'');
    const company=String(document.getElementById('historyCompany')?.value||'');
    const meta=readJson(META_KEY,{});
    return savedQuotes().sort((a,b)=>dateMs(b)-dateMs(a)).filter(p=>{
      if(company&&p?.societe!==company)return false;
      if(!q)return true;
      const m=meta?.[quoteKey(p)]||{};
      const hay=norm([p?.client?.nom,p?.numero_devis,m.ogust_number,p?.societe,...(p?.lignes||[]).map(l=>l?.designation)].filter(Boolean).join(' '));
      return hay.includes(q);
    });
  }
  function addStyles(){
    if(document.getElementById('history-delete-v29-1-style'))return;
    const s=document.createElement('style');s.id='history-delete-v29-1-style';
    s.textContent='.histActions{gap:8px;flex-wrap:wrap}.histDeleteBtn{background:#3a2028!important;border:1px solid #8f4558!important;color:#ffdce5!important}.histDeleteBtn:active{transform:translateY(1px)}';
    document.head.appendChild(s);
  }
  function refreshHistory(message){
    const search=document.getElementById('historySearch');
    if(search)search.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>{const box=document.getElementById('historySync');if(box&&message)box.textContent=message;enhanceCards()},0);
  }
  function removeLocal(index){
    const p=visibleQuotes()[Number(index)];if(!p)return;
    const client=String(p?.client?.nom||'ce devis');
    const ref=String(p?.numero_devis||'');
    const suffix=ref?` (${ref})`:'';
    if(!window.confirm(`Supprimer ${client}${suffix} de l’historique de cette application ?\n\nCela ne supprime rien dans Ogust.`))return;

    const key=quoteKey(p);
    const remaining=savedQuotes().filter(item=>quoteKey(item)!==key);
    try{localStorage.setItem(SAVED_KEY,JSON.stringify(remaining))}catch{}
    const meta=readJson(META_KEY,{});
    if(meta&&typeof meta==='object'&&!Array.isArray(meta)&&key in meta){delete meta[key];try{localStorage.setItem(META_KEY,JSON.stringify(meta))}catch{}}
    refreshHistory('Devis supprimé de l’historique local. Aucun devis Ogust n’a été supprimé.');
  }
  function enhanceCards(){
    const cards=document.querySelectorAll('#historyList .histCard');
    cards.forEach((card,index)=>{
      const actions=card.querySelector('.histActions');if(!actions||actions.querySelector('.histDeleteBtn'))return;
      const button=document.createElement('button');
      button.type='button';button.className='btn histDeleteBtn';button.textContent='Supprimer';
      button.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();removeLocal(index)});
      actions.insertBefore(button,actions.firstChild);
    });
  }
  function init(){
    addStyles();enhanceCards();
    const observer=new MutationObserver(()=>enhanceCards());
    observer.observe(document.body,{childList:true,subtree:true});
  }

  window.__acjHistoryDeleteV291=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
