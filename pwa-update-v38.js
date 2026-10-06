// Visible version and a user-triggered reload: never discard a quote automatically.
(function(){
  const version='43';
  function init(){
    const bar=document.createElement('div');bar.id='acjVersion';
    bar.style.cssText='display:flex;justify-content:center;align-items:center;gap:12px;padding:12px;font-size:12px;color:#64748b';
    const label=document.createElement('span');label.textContent=`ACJ Devis · v${version}`;
    const button=document.createElement('button');button.type='button';button.textContent='Vérifier les mises à jour';
    button.style.cssText='padding:8px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a';
    bar.append(label,button);document.body.appendChild(bar);
    if(!('serviceWorker' in navigator)){button.remove();return}
    let reloadReady=false;
    function ready(){reloadReady=true;label.textContent=`ACJ Devis · v${version} · Mise à jour disponible`;button.textContent='Charger la mise à jour'}
    navigator.serviceWorker.addEventListener('controllerchange',ready);
    button.addEventListener('click',async()=>{
      if(reloadReady){location.reload();return}
      button.disabled=true;
      try{const registration=await navigator.serviceWorker.getRegistration();if(registration){await registration.update();if(registration.waiting)ready();if(registration.installing){label.textContent='Téléchargement de la mise à jour…';const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='activated'||worker.state==='installed')ready()})}else if(!reloadReady)label.textContent=`ACJ Devis · v${version} · À jour`}}catch{label.textContent='Vérification impossible. Réessaie avec une connexion internet.'}
      finally{button.disabled=false}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
