// Single presentation layer. Layout mounts once; business modules own their updates.
(function(){
  if(window.__acjUxV30)return;

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

      .fastProgress42{gap:5px!important;margin-top:6px!important}
      .fastProgress42:before{display:none!important}
      .fastProgress42 button{flex-direction:row!important;justify-content:center;gap:6px!important;min-height:32px!important;font-size:11px!important}
      .fastProgress42 .fastStepNo42{width:25px!important;height:25px!important;box-shadow:none!important;font-size:10px!important}
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

      .top{padding-top:calc(8px + env(safe-area-inset-top))!important;padding-bottom:6px!important;backdrop-filter:none!important}
      .toprow{min-height:40px!important}.mark{width:36px!important;height:36px!important;background-size:30px!important}.brand strong{font-size:17px!important}
      .brand .pill{display:block!important;border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;margin-top:2px;font-size:9px!important;line-height:1.3;color:#718197!important}
      #newQuoteHeader55{flex-shrink:0;min-height:42px;border:1px solid #b9ddef;border-radius:12px;padding:9px 11px;background:#edf8ff;color:#0b6fae;font-size:12px;font-weight:800;white-space:nowrap}
      #newQuoteHeader55:hover{background:#dff2ff}#newQuoteHeader55:focus-visible{outline:2px solid #0b78c9;outline-offset:2px}
      .headerActions55{display:flex;gap:6px;flex-shrink:0}.headerHome55{min-height:42px;padding:9px 8px;border:0;border-radius:10px;background:transparent;color:#466079;font-size:12px;font-weight:750}
      .headerHome55:hover{background:#f0f5f9}.headerHome55:focus-visible{outline:2px solid #0b78c9;outline-offset:1px}
      @media(max-width:350px){.toprow .mark{display:none!important}.toprow{gap:7px!important}}
      #draftStatus42{padding:3px 0 0!important;font-size:10px!important;line-height:14px}
      .fastHeader42 h2{font-size:23px!important;margin:0 0 12px!important}.fastHeader42 p{display:none}
      #companyChoices{grid-template-columns:repeat(3,minmax(0,1fr))}.choice small{line-height:1.4}
      #companyChoices .choice{padding:10px 7px!important;min-height:52px!important;text-align:center}#companyChoices .choice small,#companyChoices .choice.active:after{display:none}
      #companyChoices .choice strong{font-size:11px!important}
      #historyLaunchV29{padding:9px 12px!important;margin-bottom:12px!important;border:0!important;box-shadow:none!important;background:#edf4f9!important}
      #historyLaunchV29 small{display:none}#historyLaunchV29 .btn{min-height:36px!important;padding:7px 14px!important;font-size:12px!important}
      #modeChoices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
      #modeChoices .choice{min-height:42px!important;padding:8px 4px!important;text-align:center;border-radius:10px!important}
      #modeChoices .choice strong{font-size:11px!important}#modeChoices small,#modeChoices .choice.active:after{display:none}
      .sapScreenBox{background:#f0faf4!important;border:1px solid #c8e6d4!important;color:#315d43!important}.sapScreenTitle,.sapScreenRow,.sapScreenRow strong{color:#315d43!important}.sapScreenNote{color:#5b7666!important}
      .aiCard>summary{display:list-item!important;padding:0!important;list-style:disclosure-closed;font-size:14px!important;min-height:30px;cursor:pointer}.aiCard>summary .aiBadge{float:right}.aiCard[open]>summary{margin-bottom:10px}.aiCard:not([open]){padding-top:11px!important;padding-bottom:11px!important}.aiCard:not([open]) .aiBadge{display:none}
      .fastTaxDetails53{margin:8px 0!important;padding:0!important}.fastTaxDetails53>summary{padding:10px 12px}.fastTaxDetails53>.summary{margin:0!important;border:0!important;box-shadow:none!important}
      .aiHelp{margin:8px 0 10px!important;font-size:12px!important;line-height:1.45!important}
      #aiChantierText{min-height:90px!important;height:90px;font-size:16px!important;resize:vertical}
      .aiPhotoZone{border:0!important;background:transparent!important;padding:10px 0 0!important;margin:0!important}
      .aiPhotoHelp{font-size:11px!important;color:#64748b!important}.aiPhotoActions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
      .aiPhotosDetails{padding:0!important;margin:10px 0!important;border:0!important;background:transparent!important}
      .aiPhotosDetails>summary{font-size:12px!important;padding:6px 0!important;color:#126d9f!important;min-height:32px}
      .aiPhotoZone .btn{font-size:12px!important;min-height:42px!important}
      .aiCard .aiActions{margin-top:10px!important}.aiCard .aiActions .btn{min-height:44px!important;font-size:13px!important}
      .voiceTools43{margin:8px 0!important;gap:8px!important}.voiceTools43 .btn{min-height:36px!important;padding:6px 12px!important;font-size:12px!important}
      #voiceStatus43{font-size:11px!important;min-width:130px!important}
      #ogPicker41{margin-bottom:10px!important}#ogPicker41>.hint{font-size:11px!important}
      #fastDetailed42,#fastNotesImport42{margin:8px 0!important}#fastDetailed42>summary,#fastNotesImport42>summary{padding:10px 12px!important}
      #fastPricing42{margin-top:12px!important}.quoteTop{gap:10px}.quoteTitle{white-space:pre-wrap}.lineTotal{white-space:nowrap}
      .lineEdit{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important}
      .lineEdit>div{grid-column:auto!important;min-width:0}.lineEdit input{width:100%;font-size:16px!important}
      .quickCosts{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
      .quickCosts .btn{min-height:42px!important;padding:7px 5px!important;font-size:11px!important;line-height:1.35}
      .lineEdit .lineDetails53{grid-column:1/-1;margin:0!important;padding:0!important;background:transparent!important;border-color:#e2eaf1!important}
      .lineDetails53>summary{padding:9px 11px;font-size:12px!important;min-height:38px}
      .lineMoreGrid53{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 11px 10px}
      .lineMoreGrid53>div:first-child{grid-column:1/-1}.lineDetails53 .ogRate40{margin:0!important;padding:10px 11px!important;border:0!important;border-top:1px solid #e5edf3!important;border-radius:0!important}
      .quoteLine{position:relative}.quoteTop{padding-right:34px}.quoteTop>div:first-child{min-width:0}.quoteTitle{overflow-wrap:anywhere}
      .lineRemove54{position:absolute;top:2px;right:2px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:#8495a7;display:grid;place-items:center;font-size:24px;font-weight:500;line-height:1;padding:0}
      .lineRemove54:hover{background:#fff1f2;color:#c14652}.lineRemove54:focus-visible{outline:2px solid #0b78c9;outline-offset:-4px}.lineRemove54:active{background:#ffe4e6;color:#b42335}
      #av32Panel{padding:0!important}#av32Panel>summary{padding:14px;font-weight:750;min-height:48px}.av32Body53{padding:0 14px 14px}
      #reviewActions53{position:sticky;bottom:calc(6px + env(safe-area-inset-bottom));z-index:20;padding:11px;background:#fff;border:1px solid #dbe6ef;border-radius:16px;box-shadow:0 5px 22px rgba(25,55,86,.12);margin-top:14px}
      .reviewTotal53{display:flex;justify-content:space-between;align-items:center;color:#547087;font-size:12px;margin-bottom:8px}.reviewTotal53 strong{font-size:20px;color:#0b6fae}
      #reviewActions53 .finalActions{display:block!important;margin:0!important}#reviewActions53 .uxFinalPrimary{min-height:48px!important}
      #reviewActions53 .secondaryActions53{padding:0!important;border:0!important;margin:6px 0 0!important;background:transparent!important}
      .secondaryActions53>summary{text-align:center;padding:8px;font-size:12px!important;min-height:32px}
      .secondaryActionGrid53{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding-top:6px}
      #reviewActions53 .secondaryActionGrid53 .btn{min-height:42px!important;background:#f7fafc!important;color:#315069!important;border:1px solid #d7e2eb!important;box-shadow:none!important;font-size:12px!important}
      input,select,textarea{scroll-margin-top:125px}details[open]>summary{margin-bottom:4px}
      @media print{#reviewActions53{display:none!important}}

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

  function mountHeaderActions(){
    const button=document.querySelector('.finalActions button[onclick="newQuote()"]');
    const row=document.querySelector('.toprow');if(!button||!row)return;
    button.id='newQuoteHeader55';button.className='newQuoteHeader55';button.type='button';button.textContent='+ Nouveau devis';button.setAttribute('aria-label','Nouveau devis');
    button.setAttribute('onclick',"newQuote();document.getElementById('ogcSearch')?.focus()");
    const actions=document.createElement('div');actions.className='headerActions55';
    const home=document.createElement('button');home.type='button';home.className='headerHome55';home.textContent='Accueil';home.setAttribute('aria-label','Revenir à l’accueil');home.addEventListener('click',()=>window.goStep?.(1));
    actions.append(home,button);row.appendChild(actions);
    const title=document.querySelector('.brand strong'),reference=document.getElementById('quoteNumberTop');if(title&&reference)title.parentElement.appendChild(reference);
  }

  function mountActions(){
    const box=document.querySelector('.step[data-step="4"] .finalActions');
    if(!box||document.getElementById('reviewActions53'))return;
    const primary=box.querySelector('button[onclick="sendToOgust()"]');if(!primary)return;
    primary.classList.add('uxFinalPrimary','good');
    const details=document.createElement('details');details.className='secondaryActions53';
    const summary=document.createElement('summary');summary.textContent='PDF et autres actions';
    const body=document.createElement('div');body.className='secondaryActionGrid53';
    for(const button of [...box.children])if(button!==primary)body.appendChild(button);
    details.append(summary,body);box.appendChild(details);
    const footer=document.createElement('div');footer.id='reviewActions53';
    const total=document.createElement('div');total.className='reviewTotal53';
    const label=document.createElement('span');label.textContent='Total TTC';
    const amount=document.createElement('strong');amount.id='reviewLiveTotal53';amount.textContent=window.money?.(window.totals?.().ttc||0)||'';
    total.append(label,amount);footer.append(total,box);
    document.querySelector('.step[data-step="4"]').appendChild(footer);
  }

  function themeMeta(){
    let meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
    meta.content='#ffffff';
  }

  function init(){
    addStyles();themeMeta();mountHeaderActions();mountActions();
    const title=document.querySelector('.step[data-step="1"] h1');if(title)title.textContent='Choisir le client';
    const lead=document.querySelector('.step[data-step="1"] .lead');if(lead)lead.textContent='Sélectionne ta société, puis le client.';
    document.querySelectorAll('.status,.ogcStatus').forEach(node=>node.setAttribute('aria-live','polite'));
  }

  window.__acjUxV30=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

