// Devis ACJ v22 — navigation de fin de parcours.
(function(){
  function inject(){
    const step4=document.querySelector('.step[data-step="4"]');
    if(!step4||document.getElementById('returnHomeBtn'))return;
    const actions=[...step4.querySelectorAll('.actions')].at(-1);
    if(!actions)return;
    const btn=document.createElement('button');
    btn.id='returnHomeBtn';
    btn.type='button';
    btn.className='btn flex';
    btn.textContent='Retour à l’accueil';
    btn.addEventListener('click',()=>{
      if(typeof window.goStep==='function')window.goStep(1);
      else window.scrollTo({top:0,behavior:'smooth'});
    });
    actions.appendChild(btn);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
