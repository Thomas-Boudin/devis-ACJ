// French dictation into the existing note. Only final text becomes quote input.
(function(){
  const byId=id=>document.getElementById(id);
  const readState=()=>typeof state!=='undefined'?state:(window.state||{});
  let session=null,writing=false,stopTimer=null;
  const scope=()=>{const s=readState();return [s.company,s.number,s.mode].join('|')};
  const onWorkspace=()=>Number(readState().step)===2;
  function message(text){const box=byId('voiceStatus43');if(box)box.textContent=text}
  function preview(text=''){const box=byId('voicePreview43');if(box){box.textContent=text;box.hidden=!text}}
  function refresh(){const button=byId('voiceToggle43');if(!button)return;button.textContent=session?'Arrêter':'Dicter';button.disabled=!!session?.stopping;button.setAttribute('aria-pressed',String(!!session))}
  function current(s){return session===s&&scope()===s.scope&&onWorkspace()&&document.visibilityState!=='hidden'&&byId('aiChantierText')?.value===s.expected}
  function finish(text){clearTimeout(stopTimer);stopTimer=null;session=null;preview();refresh();if(text)message(text)}
  function abort(text='Dictée arrêtée. Le texte reconnu est conservé.'){
    const s=session;if(!s)return;
    finish(text);try{s.recognition.abort()}catch{}
  }
  function stop(){
    const s=session;if(!s||s.stopping)return;
    if(!current(s)){abort();return}
    s.stopping=true;refresh();message('Fin de la dictée…');
    // Keep the session until end: stop() can still deliver one final result.
    stopTimer=setTimeout(()=>{if(session===s)abort('Dictée arrêtée. Vérifie le texte reconnu.')},8000);
    try{s.recognition.stop()}catch{abort('Dictée arrêtée. Vérifie le texte reconnu.')}
  }
  function append(s,text){
    const input=byId('aiChantierText');if(!input||!text)return;
    const separator=input.value.trim()&&!/\s$/.test(input.value)?(s.added?' ':'\n'):'';
    input.value+=separator+text;s.expected=input.value;s.added=true;
    writing=true;try{input.dispatchEvent(new Event('input',{bubbles:true}))}finally{writing=false}
    window.acjDraftV42?.save?.();
  }
  function errorText(code){return {
    'not-allowed':'Micro refusé. Autorise le microphone dans les paramètres du site, ou utilise le micro du clavier.',
    'service-not-allowed':'Dictée indisponible dans ce navigateur. Utilise le micro du clavier.',
    'audio-capture':'Microphone indisponible. Vérifie qu’il n’est pas utilisé par une autre application.',
    'network':'Connexion vocale impossible. Vérifie Internet, ou utilise le micro du clavier.',
    'no-speech':'Aucune parole reconnue. Relance la dictée et parle près du micro.',
    'language-not-supported':'La dictée française est indisponible ici. Utilise le micro du clavier.',
    aborted:'Dictée arrêtée. Le texte reconnu est conservé.'
  }[code]||'La dictée n’a pas abouti. Le texte reconnu est conservé. Utilise le micro du clavier.'}
  function start(Recognition){
    if(session){stop();return}
    if(!onWorkspace()){message('Ouvre le devis pour dicter les travaux.');return}
    if(!Recognition){byId('aiChantierText')?.focus();message('Utilise le micro du clavier de ton téléphone pour remplir ce champ.');return}
    let recognition;try{recognition=new Recognition()}catch{message(errorText('service-not-allowed'));return}
    const s={recognition,scope:scope(),expected:byId('aiChantierText').value,committed:new Set(),added:false,stopping:false};
    session=s;recognition.lang='fr-FR';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
    refresh();preview();message('Autorise le microphone si le navigateur le demande.');
    recognition.onstart=()=>{if(!current(s)){if(session===s)abort();return}if(!s.stopping)message('Micro actif. Dicte les travaux, puis appuie sur Arrêter.')};
    recognition.onresult=event=>{
      if(!current(s)){if(session===s)abort();return}
      const results=event.results;if(!results)return;
      const first=Math.max(0,Number(event.resultIndex)||0);
      for(let i=first;i<results.length;i++){
        const r=results[i],text=String(r?.[0]?.transcript||'').trim();
        if(r?.isFinal&&!s.committed.has(i)){s.committed.add(i);append(s,text)}
      }
      const words=[];for(let i=0;i<results.length;i++)if(!results[i]?.isFinal)words.push(String(results[i]?.[0]?.transcript||'').trim());
      preview(words.filter(Boolean).join(' '));
    };
    recognition.onnomatch=()=>{if(current(s)){preview();message('Paroles non reconnues. Parle près du micro, ou arrête la dictée.')}};
    recognition.onerror=event=>{if(session===s)abort(errorText(event.error))};
    recognition.onend=()=>{if(session===s)finish(s.added?'Dictée terminée. Vérifie le texte avant l’analyse.':'Aucune parole reconnue. Tu peux relancer la dictée.')};
    try{recognition.start()}catch(error){abort(errorText(error?.name==='NotAllowedError'?'not-allowed':'service-not-allowed'))}
  }
  function init(){
    const input=byId('aiChantierText');if(!input||byId('voiceToggle43'))return;
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    const supported=typeof Recognition==='function'&&window.isSecureContext!==false;
    const box=document.createElement('div');box.className='voiceTools43';
    const button=document.createElement('button');button.id='voiceToggle43';button.className='btn small';button.type='button';button.textContent=supported?'Dicter':'Dicter avec le clavier';button.setAttribute('aria-controls','aiChantierText');button.setAttribute('aria-pressed','false');
    const status=document.createElement('div');status.id='voiceStatus43';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    status.textContent=supported?'Dicte les travaux, puis vérifie le texte avant l’analyse.':'Utilise le micro du clavier de ton téléphone.';
    const draft=document.createElement('div');draft.id='voicePreview43';draft.hidden=true;draft.setAttribute('aria-label','Transcription provisoire');
    box.append(button,status,draft);input.parentElement.insertAdjacentElement('beforebegin',box);
    const style=document.createElement('style');style.textContent='.voiceTools43{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.voiceTools43 .btn{min-width:104px}.voiceTools43 .btn[aria-pressed="true"]{color:#991b1b!important;background:#fff1f2!important;border-color:#fca5a5!important}#voiceStatus43{flex:1;min-width:160px;font-size:12px;line-height:1.45;color:#64748b}#voicePreview43{flex-basis:100%;font-size:13px;padding:9px 11px;border-radius:10px;background:#f1f5f9;color:#475569}#voicePreview43[hidden]{display:none}@media print{.voiceTools43{display:none!important}}';document.head.appendChild(style);
    button.addEventListener('click',()=>start(supported?Recognition:null));
    input.addEventListener('input',()=>{if(!writing)abort('Dictée arrêtée pour conserver ta correction.');});
    for(const event of ['acj:company-changed','acj:quote-reopened'])window.addEventListener(event,()=>abort());
    window.addEventListener('pagehide',()=>abort());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')abort()});
    for(const name of ['newQuote','setMode']){const fn=window[name];if(typeof fn==='function')window[name]=function(){abort();return fn.apply(this,arguments)}}
    const go=window.goStep;if(typeof go==='function')window.goStep=function(){const out=go.apply(this,arguments);if(!onWorkspace())abort();return out};
    const analyse=window.analyseChantierAI;if(typeof analyse==='function')window.analyseChantierAI=function(){if(session){stop();message('Fin de la dictée… Vérifie le texte, puis lance l’analyse.');return}return analyse.apply(this,arguments)};
    window.acjVoiceV43={stop,get active(){return !!session}};
  }
  const ready=()=>queueMicrotask(init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
