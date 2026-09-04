// Devis ACJ v26 — couche ergonomique et visuelle, sans changement métier.
(function(){
  const STEP_LABELS=['Client','Prestation','Chiffrage','Final'];
  let scheduled=false;

  function addStyles(){
    if(document.getElementById('ux-v26-style'))return;
    const s=document.createElement('style');
    s.id='ux-v26-style';
    s.textContent=`
      :root{
        --bg:#08121f;--panel:#0f1b2b;--panel2:#132235;--line:#27405a;--text:#f7fbff;--muted:#9cafc3;
        --accent:#49bff4;--accent2:#258fd3;--good:#38c982;--danger:#f46f72;--shadow:0 10px 30px rgba(0,0,0,.20)
      }
      html{scroll-behavior:smooth}body{background:radial-gradient(circle at 85% -5%,rgba(73,191,244,.13),transparent 30rem),linear-gradient(180deg,#08121f 0%,#07111c 100%)}
      .app{max-width:720px;padding-bottom:40px}.top{padding:calc(12px + env(safe-area-inset-top)) 16px 12px;background:rgba(8,18,31,.93);border-bottom:1px solid rgba(148,178,205,.14);box-shadow:0 7px 22px rgba(0,0,0,.14)}
      .mark{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#63cdf8,#2998dc);box-shadow:0 7px 20px rgba(37,143,211,.22);color:#031522;letter-spacing:-.03em}.brand strong{font-size:17px;letter-spacing:-.02em}.brand span{font-size:11px;color:#9fb1c4}.pill{border-color:#29435b;background:#0d1927;color:#d9e8f4;font-weight:760;padding:8px 10px}
      .progress{gap:6px;margin-top:11px}.progress>span{position:relative;height:32px;border:1px solid #20384f;background:#0b1725;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 5px;color:#748aa0;font-size:9px;font-weight:800;overflow:hidden;transition:border-color .18s ease,background .18s ease,color .18s ease,transform .18s ease}.progress>span.done{background:#10263a;border-color:#275c78;color:#b9dff1}.progress>span.uxCurrent{background:linear-gradient(135deg,rgba(73,191,244,.19),rgba(37,143,211,.12));border-color:#49bff4;color:#fff;box-shadow:inset 0 0 0 1px rgba(73,191,244,.10)}.progress>span.uxReachable{cursor:pointer}.progress>span.uxReachable:active{transform:scale(.98)}.uxStepNo{width:18px;height:18px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.06);font-size:9px}.uxCurrent .uxStepNo{background:#49bff4;color:#031522}.uxStepText{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      main{padding:18px 16px 26px}.eyebrow{font-size:11px;color:#67c9f2;letter-spacing:.10em}h1{font-size:27px;line-height:1.12;margin:8px 0 8px;letter-spacing:-.035em}.lead{font-size:14px;color:#adbed0;line-height:1.5;margin-bottom:16px}
      .card{background:linear-gradient(180deg,rgba(18,32,49,.98),rgba(13,25,40,.98));border:1px solid #263c53;border-radius:18px;padding:16px;box-shadow:var(--shadow);margin-bottom:12px}.cardTitle{font-size:14px;letter-spacing:-.01em;margin-bottom:11px;color:#f3f8fc}
      label{font-size:12px;color:#d7e3ee;margin-bottom:6px}input,select,textarea{min-height:50px;border-color:#2c465f;background:#0a1624;border-radius:13px;padding:13px 14px;color:#f8fbff;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease}input::placeholder,textarea::placeholder{color:#6f8499}input:focus,select:focus,textarea:focus{border-color:#49bff4;background:#0c1928;box-shadow:0 0 0 3px rgba(73,191,244,.11)}
      .choiceGrid{gap:9px}.choice{position:relative;min-height:68px;border-color:#2c435a;background:#0b1725;border-radius:14px;padding:12px 38px 12px 13px;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}.choice strong{font-size:13px}.choice small{font-size:10px;color:#8fa4b8;line-height:1.35}.choice.active{border-color:#49bff4;background:linear-gradient(135deg,rgba(73,191,244,.15),rgba(37,143,211,.08));box-shadow:inset 0 0 0 1px rgba(73,191,244,.08)}.choice.active:after{content:'✓';position:absolute;right:12px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:999px;display:grid;place-items:center;background:#49bff4;color:#031522;font-size:12px;font-weight:950}.choice:active{transform:scale(.985)}
      .btn{min-height:50px;border-radius:13px;border-color:#314960;background:#101c2b;color:#f2f7fb;font-size:13px;font-weight:820;box-shadow:none;transition:transform .12s ease,filter .12s ease,border-color .12s ease,background .12s ease}.btn:active:not(:disabled){transform:scale(.985)}.btn:hover:not(:disabled){filter:brightness(1.05)}.btn.primary{background:linear-gradient(135deg,#56c6f5,#2a98dc);color:#031522;box-shadow:0 7px 18px rgba(42,152,220,.18)}.btn.good,.uxActionStrong{background:linear-gradient(135deg,#43d18a,#28b971)!important;border-color:transparent!important;color:#052016!important;box-shadow:0 7px 18px rgba(40,185,113,.15)}.btn.danger{background:#241317;border-color:#62333a;color:#ffd7d8}.btn:disabled{opacity:.48;cursor:not-allowed;filter:saturate(.7)}.btn.small{min-height:42px;border-radius:11px}
      .actions{gap:9px}.uxStepActions{padding-top:2px}.finalActions{gap:9px}.finalActions .btn{min-height:52px}.uxActionNew{border-color:#3a6680!important;background:#102234!important}.uxActionQuiet{background:#0b1623!important;color:#aebfd0!important}.uxActionPdf{border-color:#31627c!important;background:#0e2030!important}.uxActionMessage{border-color:#31536a!important}
      .notice{border-radius:13px;background:#0c2130;border-color:#1d536c;color:#c5e4f2;font-size:11px}.status{border-radius:13px;font-size:11px}.status.ok{background:#0d2b1c;border-color:#276a46}.status.info{background:#0c2231;border-color:#245b73}.status.err{background:#2a1519;border-color:#73343d}
      .builderCard{background:#0b1826;border-color:#2a465f;border-radius:17px;padding:15px}.serviceHead{margin-bottom:12px}.serviceHead strong{font-size:16px}.methodGrid{gap:7px}.method{min-height:44px;border-radius:11px;background:#0c1724;border-color:#2d455c;color:#cfe1ee}.method.active{border-color:#49bff4;background:rgba(73,191,244,.14);box-shadow:inset 0 0 0 1px rgba(73,191,244,.08)}.quickHours{gap:6px}.quickHours button{min-height:40px;border-radius:10px;border-color:#2c465f;background:#0d1927;color:#dcecf6}.hint{color:#8fcbe5}.ogpsBadge{border-radius:10px!important;margin:-2px 0 11px!important}
      .quoteLine{background:#0b1724;border-color:#263e55;border-radius:15px;padding:13px}.quoteTitle{font-size:13px}.quoteMeta{font-size:11px;color:#8ea4b8}.lineTotal{font-size:14px;color:#f8fbff}.lineEdit{gap:7px}.lineEdit input{background:#091522;border-radius:10px}.summary{background:#0b1825;border-color:#2b475f;border-radius:16px}.totalRow.final{font-size:22px;border-top-color:#2c4b63}
      .reviewLine{border-bottom-color:#21384e;padding:11px 0}.reviewLine .name{font-size:13px}.reviewLine .meta{font-size:10px}.reviewLine .price{font-size:13px}.empty{border-color:#334c64;border-radius:13px;color:#899db1}
      details{background:#0c1826;border-color:#273f56;border-radius:14px}summary{color:#d6e6f2;font-size:12px}
      .ogcTabs{gap:6px!important;padding:4px;background:#0a1623;border:1px solid #273f55;border-radius:14px}.ogcTab{min-height:44px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#8fa5b8!important}.ogcTab.active{background:#18354a!important;color:#fff!important;box-shadow:inset 0 0 0 1px #34779c}.ogcResult{min-height:56px!important;border-color:#2b465e!important;background:#0b1725!important;border-radius:13px!important;padding:11px 12px!important}.ogcResult:active{transform:scale(.99)}.ogcResult strong{font-size:12px!important}.ogcChosen{border-color:#2c6e4a!important;background:#0d2b1d!important;border-radius:13px!important}.ogcChange{color:#65c9f2!important;min-height:36px}.ogcHint{color:#8096aa!important}.ogcStatus{color:#a8d7ec!important}
      .ogwOverlay{background:rgba(2,8,16,.76)!important;backdrop-filter:blur(10px)!important}.ogwModal{background:#0d1928!important;border-color:#304b63!important;border-radius:24px 24px 16px 16px!important;box-shadow:0 26px 70px rgba(0,0,0,.44)!important;padding:16px!important}.ogwModal:before{content:'';display:block;width:42px;height:4px;border-radius:999px;background:#365168;margin:0 auto 12px}.ogwTitle{font-size:18px!important}.ogwClose{border-radius:12px!important;background:#111f30!important}.ogwPreview,.ogwNewCard{background:#0a1724!important;border-color:#29465f!important;border-radius:14px!important}.ogwChoice{background:#0b1725!important;border-color:#2b465d!important;border-radius:13px!important}.ogwChoice:has(input:checked){border-color:#49bff4!important;background:rgba(73,191,244,.11)!important}.ogwSelect,.ogwField input,.ogwField select{background:#0a1624!important;border-color:#2d465e!important;border-radius:12px!important;min-height:48px!important}.ogwConfirm{background:#0b1725;border-color:#304b62!important;border-radius:13px!important}.ogwActions{gap:8px!important}.ogwNotice{border-radius:12px!important}
      button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[role='button']:focus-visible{outline:2px solid #76d4fa;outline-offset:2px}
      @media(max-width:640px){
        .app{padding-bottom:calc(66px + env(safe-area-inset-bottom))}.top{padding-left:12px;padding-right:12px}main{padding:15px 12px 24px}.brand span{display:none}.pill{max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.progress>span{height:30px;padding:0 3px}.uxStepNo{width:17px;height:17px}.uxStepText{font-size:8px}.card{padding:14px;border-radius:16px}.choiceGrid{grid-template-columns:1fr 1fr}.choice{min-height:64px;padding-left:12px}.methodGrid{grid-template-columns:1fr 1fr}.quickHours{grid-template-columns:repeat(5,1fr)}.quickHours button{font-size:10px;padding:7px 2px}.uxStepActions{position:sticky;bottom:calc(8px + env(safe-area-inset-bottom));z-index:35;margin:18px -3px 0;padding:8px;border:1px solid rgba(52,79,101,.82);border-radius:16px;background:rgba(9,20,32,.88);backdrop-filter:blur(14px);box-shadow:0 12px 34px rgba(0,0,0,.30)}.uxStepActions .btn{flex:1}.finalActions{grid-template-columns:1fr}.finalActions .wide{grid-column:auto}.ogwOverlay{padding:7px!important}.ogwModal{max-height:94vh!important;padding-bottom:calc(15px + env(safe-area-inset-bottom))!important}
      }
      @media(max-width:380px){.uxStepText{display:none}.progress>span{height:28px}.choiceGrid{grid-template-columns:1fr}.quickHours{grid-template-columns:repeat(5,1fr)}}
      @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{transition:none!important;animation:none!important}}
      @media print{.uxStepNo,.uxStepText{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  function activeStep(){
    const section=document.querySelector('.step.active');
    return Number(section?.dataset?.step||window.state?.step||1)||1;
  }

  function updateProgress(){
    const current=activeStep();
    for(let i=1;i<=4;i++){
      const p=document.getElementById(`p${i}`);if(!p)continue;
      if(!p.dataset.uxV26){
        p.dataset.uxV26='1';
        p.innerHTML=`<span class="uxStepNo">${i}</span><span class="uxStepText">${STEP_LABELS[i-1]}</span>`;
        p.setAttribute('role','button');
        p.addEventListener('click',()=>{
          const now=activeStep();
          if(i<=now&&typeof window.goStep==='function')window.goStep(i);
        });
        p.addEventListener('keydown',e=>{
          if((e.key==='Enter'||e.key===' ')&&i<=activeStep()){e.preventDefault();p.click()}
        });
      }
      const reachable=i<=current;
      p.classList.toggle('uxCurrent',i===current);
      p.classList.toggle('uxReachable',reachable);
      p.tabIndex=reachable?0:-1;
      p.setAttribute('aria-current',i===current?'step':'false');
      p.setAttribute('aria-label',`Étape ${i} : ${STEP_LABELS[i-1]}${i===current?', étape actuelle':''}`);
    }
  }

  function classifyButton(btn){
    if(!btn||btn.dataset.uxClassified)return;
    btn.dataset.uxClassified='1';
    const t=String(btn.textContent||'').trim().toLowerCase();
    if(/créer.*ogust|valider et créer.*ogust/.test(t))btn.classList.add('uxActionStrong');
    else if(/pdf|imprimer/.test(t))btn.classList.add('uxActionPdf');
    else if(/whatsapp/.test(t))btn.classList.add('uxActionMessage');
    else if(/nouveau devis/.test(t))btn.classList.add('uxActionNew');
    else if(/retour|annuler|fermer/.test(t))btn.classList.add('uxActionQuiet');
  }

  function decorateActions(){
    document.querySelectorAll('.step').forEach(step=>{
      const actions=[...step.querySelectorAll('.actions')];
      const last=actions.at(-1);if(last)last.classList.add('uxStepActions');
    });
    document.querySelectorAll('button,.btn').forEach(classifyButton);
  }

  function improveLiveRegions(){
    document.querySelectorAll('.status,.ogcStatus,#ogwResult,.ogwBusy').forEach(x=>{
      if(!x.hasAttribute('aria-live'))x.setAttribute('aria-live','polite');
    });
  }

  function animateActiveStep(){
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const section=document.querySelector('.step.active');
    if(!section||typeof section.animate!=='function')return;
    section.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'});
  }

  function wrapGoStep(){
    if(window.__acjUxGoStepV26||typeof window.goStep!=='function')return;
    const original=window.goStep;
    window.goStep=function(){
      const before=activeStep();
      const out=original.apply(this,arguments);
      requestAnimationFrame(()=>{
        updateProgress();decorateActions();improveLiveRegions();
        if(activeStep()!==before)animateActiveStep();
      });
      return out;
    };
    window.__acjUxGoStepV26=true;
  }

  function refresh(){scheduled=false;updateProgress();decorateActions();improveLiveRegions()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh)}
  function observe(){
    const obs=new MutationObserver(schedule);
    obs.observe(document.body,{childList:true,subtree:true});
  }

  function init(){
    addStyles();wrapGoStep();refresh();observe();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
