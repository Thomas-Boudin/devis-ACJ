// Devis ACJ v25 — unités Ogust officielles : H, Q, K, F.
(function(){
  function norm(v){
    return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  function ogustUnit(line){
    const unit=norm(line?.unite);
    const method=String(line?.methode_chiffrage||'').toLowerCase();
    if(unit==='h'||unit==='hr'||unit==='hrs'||unit.includes('heure'))return 'H';
    if(unit==='km'||unit==='kms'||unit.includes('kilomet'))return 'K';
    if(unit==='forfait'||method==='flat')return 'F';
    return 'Q';
  }

  function wrapPayload(){
    if(window.__acjOgustUnitsV25||typeof window.quotePayload!=='function')return;
    const original=window.quotePayload;
    window.quotePayload=function(){
      const payload=original.apply(this,arguments);
      (payload?.lignes||[]).forEach(line=>{line.ogust_unit=ogustUnit(line)});
      return payload;
    };
    window.__acjOgustUnitsV25=true;
  }

  function init(){wrapPayload()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
