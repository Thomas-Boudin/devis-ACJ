// Devis ACJ v30 — refonte visuelle mobile-first, claire et cohérente avec ACJ Terrain.
(function(){
  if(window.__acjUxV30)return;
  const STEP_LABELS=['Client','Chantier','Chiffrage','Validation'];

  function addStyles(){
    if(document.getElementById('ux-v30-style'))return;
    const s=document.createElement('style');
    s.id='ux-v30-style';
    s.textContent=`
      :root{
        --bg:#f3f7fb!important;--panel:#ffffff!important;--panel2:#f8fbfd!important;--line:#d9e4ef!important;
        --text:#10233c!important;--muted:#718197!important;--accent:#0b78c9!important;--accent2:#14a5c8!important;
        --good:#24a865!important;--danger:#d94e55!important;--shadow:0 10px 30px rgba(25,55,86,.08)!important
      }
      html{background:#f3f7fb!important;color-scheme:light!important}
      body{background:radial-gradient(circle at 90% -5%,rgba(20,165,200,.11),transparent 24rem),linear-gradient(180deg,#f8fbfe 0%,#f3f7fb 48%,#eef4f8 100%)!important;color:#10233c!important}
      .app{max-width:760px!important;min-height:100vh!important;padding-bottom:42px!important}

      .top{background:rgba(255,255,255,.94)!important;border-bottom:1px solid #e3ebf2!important;box-shadow:0 6px 24px rgba(28,56,84,.06)!important;backdrop-filter:blur(18px)!important;padding:calc(11px + env(safe-area-inset-top)) 16px 10px!important}
      .toprow{min-height:48px!important}
      .brand{gap:10px!important}
      .mark{width:42px!important;height:42px!important;border-radius:13px!important;background:#fff url('./icon-192.png') center/34px 34px no-repeat!important;border:1px solid #dce8f1!important;box-shadow:0 5px 14px rgba(28,80,120,.08)!important;color:transparent!important;font-size:0!important;overflow:hidden!important}
      .brand strong{color:#10233c!important;font-size:18px!important;font-weight:900!important;letter-spacing:-.02em!important}
      .brand span{color:#718197!important;font-size:11px!important;font-weight:650!important}
      .pill{background:#f5f9fc!important;border:1px solid #dce6ef!important;color:#52667c!important;box-shadow:none!important;font-weight:760!important;padding:7px 10px!important}

      .progress{position:relative!important;display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:0!important;margin-top:11px!important;overflow:visible!important}
      .progress:before{content:''!important;position:absolute!important;left:11%!important;right:11%!important;top:14px!important;height:2px!important;background:#dbe6ef!important;z-index:0!important}
      .progress>span{height:44px!important;border:0!important;background:transparent!important;border-radius:0!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:4px!important;color:#8291a4!important;position:relative!important;z-index:1!important;padding:0!important}
      .uxStepNo{width:29px!important;height:29px!important;min-width:29px!important;border-radius:50%!important;background:#eef3f7!important;border:1px solid #d7e2eb!important;color:#6d7f93!important;font-size:11px!important;font-weight:850!important;display:grid!important;place-items:center!important;box-shadow:0 0 0 4px rgba(255,255,255,.95)!important}
      .progress>span.done:not(.uxCurrent) .uxStepNo{background:#e1f6ef!important;border-color:#a7ddc6!important;color:#17784a!important}
      .progress>span.uxCurrent .uxStepNo{background:linear-gradient(135deg,#0b78c9,#14a5c8)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 0 0 4px #fff,0 5px 14px rgba(11,120,201,.22)!important}
      .uxStepText{font-size:9px!important;font-weight:760!important;color:inherit!important;max-width:76px!important;line-height:1.1!important}
      .progress>span.uxCurrent .uxStepText{color:#0d5e9e!important}
      .progress>span.done:not(.uxCurrent) .uxStepText{color:#3c715b!important}

      main{padding:18px 16px 30px!important}
      .eyebrow{display:none!important}
      h1{color:#10233c!important;font-size:27px!important;line-height:1.08!important;margin:4px 0 6px!important;letter-spacing:-.035em!important;font-weight:920!important}
      .lead{color:#718197!important;font-size:14px!important;line-height:1.48!important;margin:0 0 17px!important;max-width:640px!important}
      .card{background:#fff!important;border:1px solid #dfe8f0!important;border-radius:18px!important;padding:16px!important;box-shadow:0 8px 24px rgba(24,55,86,.065)!important;margin-bottom:13px!important}
      .cardTitle{color:#1b3048!important;font-size:14px!important;font-weight:860!important;margin-bottom:11px!important}
      label{color:#3a5068!important;font-size:12px!important;font-weight:760!important;margin-bottom:6px!important}
      input,select,textarea,.ogwSelect,.ogwField input,.ogwField select{background:#f9fbfd!important;border:1px solid #d7e2eb!important;color:#152a42!important;border-radius:13px!important;box-shadow:none!important;min-height:48px!important}
      input::placeholder,textarea::placeholder{color:#99a8b8!important;opacity:1!important}
      input:focus,select:focus,textarea:focus,.ogwField input:focus,.ogwField select:focus{background:#fff!important;border-color:#48a7d8!important;box-shadow:0 0 0 3px rgba(11,120,201,.10)!important}

      .choiceGrid{gap:9px!important}
      .choice{background:#fff!important;border:1px solid #dce6ee!important;color:#1a2f46!important;border-radius:14px!important;padding:12px 13px!important;min-height:62px!important;box-shadow:0 3px 10px rgba(32,61,88,.035)!important;position:relative!important;transition:border-color .15s ease,background .15s ease,transform .15s ease!important}
      .choice strong{color:#1a2f46!important;font-size:13px!important;font-weight:820!important}
      .choice small{color:#7a8b9d!important;font-size:10.5px!important}
      .choice.active{background:linear-gradient(180deg,#eef8fd,#e9f5fb)!important;border-color:#64b8dc!important;box-shadow:inset 0 0 0 1px rgba(11,120,201,.07),0 4px 12px rgba(11,120,201,.06)!important}
      .choice.active strong{color:#075f9d!important}
      .choice.active:after{background:#0b78c9!important;color:#fff!important;box-shadow:0 3px 8px rgba(11,120,201,.15)!important}
      .choice:active{transform:scale(.99)!important}

      .builderCard{background:#f8fbfd!important;border:1px solid #dbe6ee!important;border-radius:16px!important;padding:14px!important;box-shadow:none!important}
      .serviceHead strong{color:#16314c!important}.serviceHead span{color:#75879a!important}
      .methodTitle{color:#52667b!important}
      .method,.quickHours button{background:#fff!important;border:1px solid #d7e2eb!important;color:#476078!important;border-radius:11px!important;box-shadow:none!important}
      .method.active{background:#eaf6fc!important;border-color:#62b4d8!important;color:#08649f!important}
      .quickHours button:active{background:#eef7fb!important}
      .hint{color:#5c7890!important}
      .addedMini{border-top-color:#dbe6ee!important}.addedMiniTitle{color:#7d8da0!important}

      .notice{background:#eef8fd!important;border:1px solid #cce7f4!important;color:#315d78!important;border-radius:13px!important}
      .status.info,.ogwInfo{background:#eef8fd!important;border-color:#c8e5f3!important;color:#315d78!important}
      .status.ok,.ogwGood,.ogcChosen{background:#edf8f2!important;border-color:#c4e7d2!important;color:#246744!important}
      .status.err,.ogwError{background:#fff2f3!important;border-color:#efc9cc!important;color:#96373d!important}

      .btn,.ogcTab,.ogwClose{min-height:50px!important;border-radius:13px!important;font-size:13px!important;font-weight:800!important;background:#fff!important;border:1px solid #d5e0e9!important;color:#315069!important;text-shadow:none!important;box-shadow:0 3px 10px rgba(31,60,88,.035)!important;opacity:1!important}
      .btn.primary{background:linear-gradient(135deg,#0877c7,#14a4c8)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 20px rgba(11,120,201,.18)!important}
      .btn.good,.uxActionStrong{background:linear-gradient(135deg,#239f61,#32ba72)!important;border-color:transparent!important;color:#fff!important;box-shadow:0 8px 20px rgba(35,159,97,.18)!important}
      .btn.danger{background:#fff5f5!important;border-color:#efcdd0!important;color:#b6464d!important;box-shadow:none!important}
      .btn:disabled,.btn[disabled],button:disabled{background:#edf2f6!important;border-color:#dde6ed!important;color:#9aabba!important;opacity:1!important;filter:none!important;box-shadow:none!important}
      .btn:active:not(:disabled){transform:scale(.988)!important}
      .uxActionPdf,.uxActionMessage,.uxActionNew,.uxActionQuiet{background:#fff!important;border-color:#d5e0e9!important;color:#315069!important}

      .quoteLine{background:#fff!important;border:1px solid #dce6ee!important;border-radius:15px!important;padding:13px!important;box-shadow:0 3px 12px rgba(30,61,90,.035)!important}
      .quoteTitle{color:#193149!important;font-size:13px!important}.quoteMeta{color:#7b8b9c!important}.lineTotal{color:#0d6cae!important;font-size:14px!important}
      .lineEdit{border-top:1px solid #edf2f6!important;padding-top:10px!important}.lineEdit label{color:#8392a2!important}
      .lineEdit input{background:#f9fbfd!important}
      .summary{background:linear-gradient(135deg,#eef7fd,#f5fbfd)!important;border:1px solid #cfe4f0!important;border-radius:16px!important;padding:14px 15px!important;box-shadow:none!important}
      .totalRow{color:#547087!important}.totalRow strong{color:#203a53!important}
      .totalRow.final{border-top:1px solid #d4e6ef!important;color:#0d5f9e!important;font-size:21px!important}
      .totalRow.final span:last-child{color:#0873bb!important;font-size:24px!important}
      .empty{background:#fafcfe!important;border:1px dashed #ccd9e4!important;color:#7d8d9f!important}

      .clientSummary{color:#60778d!important}.clientSummary strong{color:#183149!important;font-size:15px!important}
      .reviewLine{border-bottom-color:#e7eef4!important}.reviewLine .name{color:#1b3249!important}.reviewLine .meta{color:#7d8d9f!important}.reviewLine .price{color:#0e68a9!important}
      details{background:#fff!important;border:1px solid #dce6ee!important;border-radius:14px!important;box-shadow:none!important}
      summary{color:#466079!important}.settings{background:#fbfdfe!important}.tiny{color:#7f8fa0!important}

      .step[data-step="4"] .finalActions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin-top:13px!important}
      .step[data-step="4"] .finalActions .btn{width:100%!important;min-height:50px!important;margin:0!important;grid-column:auto!important}
      .step[data-step="4"] .finalActions .uxFinalPrimary{grid-column:1/-1!important;order:1!important;min-height:56px!important;font-size:14px!important}
      .step[data-step="4"] .finalActions .uxFinalPdf{order:2!important}.step[data-step="4"] .finalActions .uxFinalWhatsapp{order:3!important}.step[data-step="4"] .finalActions .uxFinalSave{order:4!important}.step[data-step="4"] .finalActions .uxFinalNew{order:5!important}
      .step[data-step="4"] .finalActions .wide{grid-column:auto!important}
      .step[data-step="4"] .uxStepActions{position:static!important;display:grid!important;grid-template-columns:1fr 1fr!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin:13px 0 0!important;backdrop-filter:none!important;gap:9px!important}
      .step[data-step="4"] .uxStepActions .btn{min-height:46px!important;background:#f8fbfd!important;color:#63768a!important;border-color:#dce6ee!important}

      .ogcTabs{background:#f3f7fa!important;border-color:#dce6ee!important}.ogcTab{background:transparent!important;border:0!important;color:#76889a!important;min-height:43px!important;box-shadow:none!important}.ogcTab.active{background:#fff!important;color:#0b6fae!important;box-shadow:0 2px 8px rgba(30,61,90,.06)!important}
      .ogcResult,.ogwChoice,.ogwPreview,.ogwNewCard,.ogwConfirm{background:#fff!important;border-color:#dce6ee!important;color:#1e364d!important;box-shadow:none!important}
      .ogcResult small,.ogcHint{color:#77899b!important}
      .ogwOverlay{background:rgba(15,35,54,.34)!important;backdrop-filter:blur(4px)!important}
      .ogwModal{background:#f8fbfd!important;border:1px solid #d7e3ec!important;color:#1d344b!important;box-shadow:0 24px 70px rgba(20,45,68,.22)!important}
      .ogwActions .btn{color:#315069!important}.ogwActions .btn.good{color:#fff!important}

      .aiCard{background:linear-gradient(135deg,#f2f8ff,#effbfd)!important;border-color:#cfe5f2!important;color:#193149!important;box-shadow:0 8px 20px rgba(28,73,105,.055)!important}
      .aiTitle,.aiResultName{color:#193149!important}.aiBadge{background:#e4f4fc!important;color:#0a6ba8!important;border-color:#b8dff0!important}.aiHelp,.aiResultMeta{color:#617b92!important}.aiResultCard{background:#fff!important;border-color:#d7e5ee!important}.aiMissing{color:#9a661c!important}.aiConfidence{color:#7e8e9e!important}.aiSupplies{border-top-color:#dce7ee!important;color:#304e67!important}

      .history-row{background:#fff!important;border-color:#dce6ee!important;color:#1b334a!important;box-shadow:0 3px 12px rgba(30,61,90,.035)!important}.history-month-title{background:linear-gradient(180deg,#f3f7fb 72%,transparent)!important;color:#39536c!important}.history-date{color:#78899a!important}.history-date strong{color:#173049!important}.history-main p,.history-meta,.history-count,.event-source-line{color:#78899a!important}.source-badge{background:#eef8fd!important;border-color:#c7e3f0!important;color:#216789!important}.source-badge.manual{background:#fff8e9!important;border-color:#f0d7a2!important;color:#8c641f!important}

      .acjAuthGate{background:linear-gradient(180deg,#eef6fb,#f8fbfd)!important;color:#183149!important}.acjAuthCard{background:#fff!important;border:1px solid #d8e5ee!important;box-shadow:0 28px 80px rgba(27,57,83,.16)!important;color:#183149!important}.acjAuthLogo{background:#fff url('./icon-192.png') center/46px 46px no-repeat!important;border:1px solid #dce7ef!important;color:transparent!important}.acjAuthTitle{color:#17314b!important}.acjAuthText,.acjAuthStatus,.acjAuthSession{color:#718397!important}.acjAuthRetry,.acjAuthLogout{background:#f7fafc!important;border-color:#d8e3ec!important;color:#35516a!important}.acjAuthSession{border-top-color:#e5edf3!important}

      @media(max-width:640px){
        .app{max-width:none!important}.top{padding-left:12px!important;padding-right:12px!important}.brand span{display:none!important}main{padding:15px 12px 28px!important}
        .card{padding:14px!important;border-radius:16px!important}.choice{padding:11px 12px!important}.progress:before{left:10%!important;right:10%!important}
        .step.active>.actions{position:sticky!important;bottom:8px!important;z-index:16!important;margin:16px -2px 0!important;padding:8px!important;border:1px solid rgba(214,226,235,.9)!important;border-radius:16px!important;background:rgba(248,251,253,.92)!important;backdrop-filter:blur(14px)!important;box-shadow:0 10px 28px rgba(28,55,80,.10)!important}
        .step[data-step="4"].active>.actions{position:static!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin-top:12px!important}
      }
      @media(max-width:390px){.uxStepText{font-size:8px!important}.progress:before{left:11%!important;right:11%!important}.brand strong{font-size:17px!important}.pill{font-size:9px!important;padding:6px 8px!important}.finalActions{grid-template-columns:1fr!important}.step[data-step="4"] .finalActions .btn{grid-column:1!important}}
    `;
    document.head.appendChild(s);
  }

  function currentStep(){return Number(document.querySelector('.step.active')?.dataset?.step||1)||1}
  function ensureStepUi(){
    const current=currentStep();
    for(let i=1;i<=4;i++){
      const p=document.getElementById(`p${i}`);if(!p)continue;
      p.classList.toggle('uxCurrent',i===current);
      let no=p.querySelector('.uxStepNo');
      let label=p.querySelector('.uxStepText');
      if(!no){no=document.createElement('span');no.className='uxStepNo';p.appendChild(no)}
      if(!label){label=document.createElement('span');label.className='uxStepText';p.appendChild(label)}
      no.textContent=i<current?'✓':String(i);
      label.textContent=STEP_LABELS[i-1];
    }
  }

  function polishCopy(){
    const copy={
      1:['Client','Recherchez ou sélectionnez le client concerné par le devis.'],
      2:['Chantier','Décrivez le besoin puis choisissez les prestations à chiffrer.'],
      3:['Chiffrage','Ajustez les quantités, les prix et les frais avant validation.'],
      4:['Validation du devis','Vérifiez une dernière fois le devis avant PDF, partage ou création dans Ogust.']
    };
    document.querySelectorAll('.step').forEach(step=>{
      const n=Number(step.dataset.step||0),vals=copy[n];if(!vals)return;
      const h=step.querySelector('h1'),lead=step.querySelector('.lead');
      if(h)h.textContent=vals[0];if(lead)lead.textContent=vals[1];
    });
    const brand=document.querySelector('.brand strong');if(brand)brand.textContent='Devis ACJ';
    const label=document.getElementById('stepLabel');if(label)label.textContent=STEP_LABELS[currentStep()-1]||'Devis';
  }

  function themeMeta(){
    let meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
    meta.content='#ffffff';
  }

  function refresh(){ensureStepUi();polishCopy()}
  function wrapGoStep(){
    if(window.__acjUxV30GoStep||typeof window.goStep!=='function')return;
    const original=window.goStep;
    window.goStep=function(){const out=original.apply(this,arguments);requestAnimationFrame(refresh);return out};
    window.__acjUxV30GoStep=true;
  }
  function init(){
    addStyles();themeMeta();wrapGoStep();refresh();
    const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(refresh,70)});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }

  window.__acjUxV30=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
