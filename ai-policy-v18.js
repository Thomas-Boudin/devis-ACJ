// ACJ v42 — estimates are reviewable suggestions; never inflate them by confidence.
(function(){
  window.acjValidateAIForOgust=function(){
    const readiness=window.acjAIReadiness?.();
    if(!readiness||readiness.ok){document.getElementById('aiReadiness42')?.remove();return true}
    const message='Confirme les durées estimées par l’assistant avant de créer ce devis dans Ogust.';
    window.goStep?.(2);
    let box=document.getElementById('aiReadiness42');
    if(!box){box=document.createElement('div');box.id='aiReadiness42';box.className='status show err';box.setAttribute('role','alert');document.getElementById('quoteLines')?.insertAdjacentElement('beforebegin',box)}
    box.textContent=message;box.scrollIntoView?.({behavior:'smooth',block:'center'});
    window.showStatus?.('finalStatus',message,'err');return false;
  };
  function init(){
    const send=window.sendToOgust;
    if(typeof send==='function')window.sendToOgust=function(){if(!window.acjValidateAIForOgust())return;return send.apply(this,arguments)};
  }
  const start=()=>queueMicrotask(init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
