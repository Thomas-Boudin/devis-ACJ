// Devis ACJ v27 — lisibilité mobile, palette dark plus claire et hiérarchie des actions.
(function(){
  const STEP_LABELS=['Client','Prestation','Chiffrage','Final'];

  function addStyles(){
    if(document.getElementById('ux-v27-style'))return;
    const s=document.createElement('style');
    s.id='ux-v27-style';
    s.textContent=`
      :root{
        --bg:#102033!important;--panel:#172b40!important;--panel2:#1b3148!important;--line:#355675!important;
        --text:#f5f9fc!important;--muted:#b6c7d8!important;--accent:#58c7f3!important;--accent2:#319fd9!important;
        --good:#4ade80!important;--danger:#f87171!important;--shadow:0 8px 24px rgba(2,10,20,.18)!important
      }
      html{background:#102033!important}
      body{background:linear-gradient(180deg,#12243a 0%,#102033 42%,#0e1c2c 100%)!important;color:#f5f9fc!important}
      .app{max-width:720px!important}
      .top{background:rgba(14,29,46,.96)!important;border-bottom:1px solid #294762!important;box-shadow:0 5px 18px rgba(0,0,0,.12)!important;padding-bottom:10px!important}
      .mark{background:linear-gradient(135deg,#6fd5fb,#3caee6)!important;box-shadow:none!important}
      .brand strong{color:#f8fbfe!important}.brand span{color:#b4c6d8!important}
      .pill{background:#152a3d!important;border-color:#355675!important;color:#e8f1f8!important;box-shadow:none!important}

      /* Stepper compact : plus de gros pavés sombres */
      .progress{position:relative!important;gap:4px!important;margin-top:10px!important;overflow:visible!important}
      .progress:before{content:'';position:absolute;left:10%;right:10%;top:16px;height:1px;background:#41627e;z-index:0}
      .progress>span{height:34px!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;color:#a9bccd!important;padding:0 2px!important;position:relative!important;z-index:1!important;gap:4px!important;overflow:visible!important}
      .progress>span.done,.progress>span.uxCurrent{background:transparent!important;border:0!important;box-shadow:none!important;color:#eef7fc!important}
      .uxStepNo{width:25px!important;height:25px!important;min-width:25px!important;background:#203a52!important;border:1px solid #4a6d89!important;color:#d7e7f3!important;font-size:10px!important;box-shadow:0 0 0 4px #0f1f31!important}
      .progress>span.done:not(.uxCurrent) .uxStepNo{background:#2fbd71!important;border-color:#4ade80!important;color:#062415!important}
      .progress>span.uxCurrent .uxStepNo{background:#58c7f3!important;border-color:#81d9f9!important;color:#062034!important}
      .uxStepText{font-size:9px!important;font-weight:750!important;color:inherit!important;max-width:62px!important}

      main{padding-top:16px!important}
      h1{color:#f8fbfe!important}.lead{color:#bed0df!important}.eyebrow{color:#77d2f4!important}
      .card{background:#172b40!important;border-color:#355675!important;box-shadow:0 7px 20px rgba(0,0,0,.12)!important}
      .cardTitle{color:#f7fbfe!important}
      label{color:#e0eaf2!important}
      input,select,textarea,.ogwSelect,.ogwField input,.ogwField select{background:#1c344a!important;border-color:#416381!important;color:#f8fbfe!important;box-shadow:none!important}
      input::placeholder,textarea::placeholder{color:#91a7bc!important;opacity:1!important}
      input:focus,select:focus,textarea:focus,.ogwField input:focus,.ogwField select:focus{border-color:#62c9f2!important;background:#213a52!important;box-shadow:0 0 0 3px rgba(88,199,243,.14)!important}

      .choice,.method,.quickHours button,.quoteLine,.summary,details,.ogcResult,.ogwChoice{background:#162a3e!important;border-color:#355675!important;color:#eef6fb!important;box-shadow:none!important}
      .choice.active,.method.active,.ogcTab.active,.ogwChoice:has(input:checked){background:#20415a!important;border-color:#65c9f1!important;color:#fff!important;box-shadow:none!important}
      .choice small,.quoteMeta,.reviewLine .meta,.tiny,.ogcHint,.ogcResult small{color:#a8bbcd!important}
      .choice.active:after{background:#5bcaf4!important;color:#062034!important}
      .builderCard{background:#15293d!important;border-color:#365a77!important}
      .notice{background:#17364a!important;border-color:#39708c!important;color:#d5edf7!important}
      .status.info,.ogwInfo{background:#17364a!important;border-color:#39708c!important;color:#d5edf7!important}
      .status.ok,.ogwGood,.ogcChosen{background:#173c2b!important;border-color:#3a815b!important;color:#d6f8e2!important}
      .status.err,.ogwError{background:#452229!important;border-color:#91505b!important;color:#ffe0e4!important}

      /* Boutons : contraste garanti, y compris disabled */
      .btn,.ogcTab,.ogwClose{min-height:52px!important;border-radius:15px!important;font-size:14px!important;font-weight:760!important;background:#1b3349!important;border:1px solid #45627d!important;color:#f4f8fc!important;text-shadow:none!important;box-shadow:none!important;opacity:1!important}
      .btn.primary{background:#55c5f2!important;border-color:#55c5f2!important;color:#062033!important}
      .btn.good,.uxActionStrong{background:linear-gradient(135deg,#55df90,#35c779)!important;border-color:#4ade80!important;color:#062415!important;box-shadow:0 6px 16px rgba(45,190,111,.16)!important}
      .btn.danger{background:#4a232a!important;border-color:#8b4c57!important;color:#ffe6e9!important}
      .btn:disabled,.btn[disabled],button:disabled{background:#243b50!important;border-color:#3d5871!important;color:#9fb4c7!important;opacity:1!important;filter:none!important;text-shadow:none!important}
      .uxActionPdf,.uxActionMessage,.uxActionNew,.uxActionQuiet{background:#1a3349!important;border-color:#456784!important;color:#f4f8fc!important}
      .uxActionPdf:disabled,.uxActionNew:disabled{color:#9fb4c7!important;background:#243b50!important}
      .btn:hover:not(:disabled){filter:none!important}.btn:active:not(:disabled){transform:scale(.985)}

      /* Écran final : une action forte, puis 2x2 actions utiles */
      .step[data-step="4"] .finalActions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:14px!important}
      .step[data-step="4"] .finalActions .btn{width:100%!important;min-height:54px!important;margin:0!important;grid-column:auto!important}
      .step[data-step="4"] .finalActions .uxFinalPrimary{grid-column:1/-1!important;order:1!important;min-height:58px!important;font-size:15px!important}
      .step[data-step="4"] .finalActions .uxFinalPdf{order:2!important}
      .step[data-step="4"] .finalActions .uxFinalWhatsapp{order:3!important}
      .step[data-step="4"] .finalActions .uxFinalSave{order:4!important}
      .step[data-step="4"] .finalActions .uxFinalNew{order:5!important}
      .step[data-step="4"] .finalActions .wide{grid-column:auto!important}
      .step[data-step="4"] .uxStepActions{position:static!important;display:grid!important;grid-template-columns:1fr 1fr!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin:14px 0 0!important;backdrop-filter:none!important;gap:9px!important}
      .step[data-step="4"] .uxStepActions .btn{min-height:48px!important;font-size:12px!important;background:#13283a!important;color:#c8d7e4!important;border-color:#35536e!important}

      .ogcTabs{background:#13283a!important;border-color:#355675!important}
      .ogcTab{background:transparent!important;border:0!important;color:#b5c6d6!important;min-height:44px!important}
      .ogcTab.active{background:#20415a!important;color:#fff!important}
      .ogwOverlay{background:rgba(5,13,23,.68)!important}
      .ogwModal{background:#172b40!important;border-color:#41627e!important;box-shadow:0 22px 60px rgba(0,0,0,.32)!important}
      .ogwPreview,.ogwNewCard,.ogwConfirm{background:#14293c!important;border-color:#355675!important}
      .ogwActions .btn{color:#f4f8fc!important}
      .ogwActions .btn.good{color:#062415!important}

      @media(max-width:640px){
        .top{padding-left:12px!important;padding-right:12px!important}.brand span{display:none!important}
        .progress:before{left:8%;right:8%}.uxStepText{font-size:8.5px!important;max-width:52px!important}
        .card{padding:15px!important}.step[data-step="4"] .finalActions{grid-template-columns:1fr 1fr!important}
      }
      @media(max-width:390px){.uxStepText{display:none!important}.progress:before{left:11%;right:11%}}
    `;
    document.head.appendChild(s);
  }

  function text(btn){return String(btn?.textContent||'').trim().toLowerCase()}

  function orderFinalActions(){
    const box=document.querySelector('.step[data-step="4"] .finalActions');
    if(!box)return;
    [...box.querySelectorAll('button,.btn')].forEach(btn=>{
      btn.classList.remove('uxFinalPrimary','uxFinalPdf','uxFinalWhatsapp','uxFinalSave','uxFinalNew');
      const t=text(btn);
      if(/créer.*ogust|creer.*ogust/.test(t))btn.classList.add('uxFinalPrimary','good');
      else if(/pdf|imprimer/.test(t))btn.classList.add('uxFinalPdf');
      else if(/whatsapp/.test(t))btn.classList.add('uxFinalWhatsapp');
      else if(/enregistrer/.test(t))btn.classList.add('uxFinalSave');
      else if(/nouveau devis/.test(t))btn.classList.add('uxFinalNew');
    });
  }

  function currentStep(){return Number(document.querySelector('.step.active')?.dataset?.step||1)||1}
  function updateStepper(){
    const current=currentStep();
    for(let i=1;i<=4;i++){
      const p=document.getElementById(`p${i}`);if(!p)continue;
      const no=p.querySelector('.uxStepNo'),label=p.querySelector('.uxStepText');
      if(label)label.textContent=STEP_LABELS[i-1];
      if(no)no.textContent=i<current?'✓':String(i);
    }
  }

  function enforceReadableButtons(){
    document.querySelectorAll('button,.btn').forEach(btn=>{
      if(!String(btn.textContent||'').trim())return;
      btn.style.removeProperty('color');
    });
  }

  function refresh(){orderFinalActions();updateStepper();enforceReadableButtons()}

  function wrapGoStep(){
    if(window.__acjUxV27GoStep||typeof window.goStep!=='function')return;
    const original=window.goStep;
    window.goStep=function(){const out=original.apply(this,arguments);requestAnimationFrame(refresh);return out};
    window.__acjUxV27GoStep=true;
  }

  function init(){
    addStyles();wrapGoStep();refresh();
    const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(refresh,40)});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
