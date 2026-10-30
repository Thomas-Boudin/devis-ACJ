// ACJ v42 — one quote workspace, retaining the existing calculation and Ogust APIs.
(function(){
  if(window.__acjFastFlowV42)return;
  const steps=[{id:1,label:'Client'},{id:2,label:'Devis'},{id:4,label:'Vérifier'}];
  const getState=()=>typeof state!=='undefined'?state:(window.state||{});
  const byId=id=>document.getElementById(id);
  let pricing,step3,buttons=[],lastStep=0,lastSummary='',composer,method='catalogue',optionsPanel,optionsButton;

  function styles(){
    const style=document.createElement('style');style.id='fast-flow-v42-style';
    style.textContent=`
      body.acjFastFlow42 .top>.progress,body.acjFastFlow42 #stepLabel{display:none!important}
      body.acjFastFlow42 .step[data-step="3"]{display:none!important}
      body.acjFastFlow42 .fastLegacyHeader42,body.acjFastFlow42 .fastLegacyActions42{display:none!important}
      .fastProgress42{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px;position:relative}
      .fastProgress42:before{content:'';position:absolute;left:16%;right:16%;top:14px;height:2px;background:#dbe6ef}
      .fastProgress42 button{appearance:none;border:0;background:transparent;color:#718197;padding:0;min-height:46px;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;font-weight:750;font-size:10px}
      .fastProgress42 button:disabled{background:transparent!important;border:0!important;color:#718197!important;cursor:default}
      .fastProgress42 .fastStepNo42{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;font-size:11px;background:#eef3f7;border:1px solid #d7e2eb;box-shadow:0 0 0 4px #fff}
      .fastProgress42 button[data-current="true"]{color:#0d5e9e}
      .fastProgress42 button[data-current="true"] .fastStepNo42{background:#0b78c9;border-color:#0b78c9;color:#fff}
      .fastProgress42 button[data-done="true"] .fastStepNo42{background:#e1f6ef;border-color:#a7ddc6;color:#17784a}
      #fastStepLabel42{display:block;color:#718197;font-size:11px;margin-top:2px}
      .fastHeader42 h2{color:#10233c;font-size:27px;font-weight:900;letter-spacing:-.035em;line-height:1.1;margin:4px 0 7px}
      .fastHeader42 p{color:#718197;font-size:14px;line-height:1.45;margin:0 0 17px}
      #fastDetailed42{margin:12px 0 14px}#fastDetailed42>.fastDetailedBody42{padding:0 12px 12px}
      #fastDetailed42 .card{box-shadow:none!important;margin-bottom:10px!important}
      #fastDetailed42 .notice{margin:0}
      #fastNotesImport42{margin:0 0 14px}#fastNotesImport42>#notesImportCard{margin:0!important;border:0!important;box-shadow:none!important}
      #fastPricing42{margin-top:16px}#fastPricing42>.summary{margin-bottom:12px}
      #fastActions42{display:grid;grid-template-columns:1fr;gap:8px;align-items:center}
      #fastActions42 .fastLiveTotal42{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;color:#547087;font-size:12px;padding:0 3px 3px}
      #fastLiveTotal42{font-size:20px;color:#0b6fae;font-weight:900}
      #fastActions42 .btn{width:100%;min-height:48px!important}
      #addService58{margin:12px 0 16px;border:1px solid #bcdbea;background:#fff;border-radius:16px}
      #addService58>summary{min-height:52px;display:flex;align-items:center;justify-content:center;padding:14px;color:#0b6fae;font-size:14px;list-style:none}
      #addService58>summary::-webkit-details-marker{display:none}
      #addService58:not([open])>summary{background:#edf8ff;color:#0b6fae!important}
      #addService58[open]>summary{border-bottom:1px solid #e3edf4;margin-bottom:0}
      .addServiceBody58{padding:12px}.addServiceMethods58{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;background:#eef4f8;border-radius:12px;margin-bottom:14px}
      .addServiceMethods58 button{border:0;border-radius:9px;min-height:44px;padding:8px 5px;background:transparent;color:#647b90;font-size:12px;font-weight:750}
      .addServiceMethods58 button[aria-pressed="true"]{background:#fff;color:#0b6fae;box-shadow:0 2px 6px rgba(25,55,86,.07)}
      .addServiceMethods58 button:focus-visible,#addService58>summary:focus-visible{outline:2px solid #0b78c9;outline-offset:2px}
      .addServicePanel58[hidden]{display:none!important}
      #addService58 .catalogueCard58,#addService58 #aiChantierCard{padding:0!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important}
      #addService58 .catalogueCard58>.cardTitle,#addService58 #ogPicker41>.cardTitle,#addService58 #ogPicker41>.hint,#addService58 #aiChantierCard>summary{display:none!important}
      #addService58 #serviceBuilder{margin-top:12px}#addService58 .addedMini{display:none}
      #workspaceOptions58[hidden],#workspaceOptionsButton58[hidden]{display:none!important}
      #workspaceOptionsButton58{border-top:1px solid #e6edf3;margin-top:5px;border-radius:0 0 10px 10px;font-size:12px;font-weight:650}
      #workspaceOptions58{position:fixed;inset:0;z-index:1500;background:rgba(15,35,54,.35);display:flex;align-items:center;justify-content:center;padding:12px}
      .workspaceOptionsCard58{width:min(600px,100%);max-height:85dvh;overflow:auto;background:#f7fafc;border:1px solid #dce6ee;border-radius:20px;padding:16px;box-shadow:0 20px 60px rgba(20,45,68,.2)}
      .workspaceOptionsHead58{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.workspaceOptionsHead58 h2{font-size:18px;margin:0}.workspaceOptionsHead58 button{min-width:44px;min-height:44px;border:1px solid #d5e0e9;border-radius:12px;background:#fff;color:#315069;font-size:22px}
      .workspaceOptionsCard58 .fastTaxDetails53{margin-bottom:14px!important}
      #workspaceStatus58{font-size:12px;color:#246744;min-height:0}#workspaceStatus58:not(:empty){margin:8px 2px}
      .step[data-step="2"]{padding-bottom:110px}
      .step[data-step="2"].active #fastActions42{position:fixed!important;bottom:calc(6px + env(safe-area-inset-bottom))!important;left:50%;transform:translateX(-50%);width:min(728px,calc(100% - 24px));margin:0!important;padding:10px!important;border:1px solid #d7e3ed;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(25,55,86,.12);z-index:30}
      @media(max-width:640px){#fastStepLabel42{display:none}#fastActions42{position:sticky!important;bottom:calc(6px + env(safe-area-inset-bottom))!important}.fastHeader42 h2{font-size:25px}}
      @media print{.fastProgress42,#fastStepLabel42,#fastActions42,#addService58,#workspaceOptions58{display:none!important}}
    `;
    document.head.appendChild(style);document.body.classList.add('acjFastFlow42');
  }

  function makeHeader(section,title,description){
    // Retain the original h1/lead: older UX observers still use those nodes.
    for(const node of Array.from(section.children)){
      if(node.matches('h1,.lead,.eyebrow'))node.classList.add('fastLegacyHeader42');
    }
    const box=document.createElement('div');box.className='fastHeader42';
    const heading=document.createElement('h2');heading.textContent=title;
    const lead=document.createElement('p');lead.textContent=description;
    box.append(heading,lead);section.prepend(box);
  }

  function movePricing(){
    if(!pricing||!step3)return;
    for(const node of Array.from(step3.children)){
      if(node.matches('h1,.lead,.eyebrow,.actions'))continue;
      pricing.appendChild(node);
    }
  }

  function selectMethod(value,focus=false){
    method=value==='description'?'description':'catalogue';
    const catalogue=byId('cataloguePanel58'),description=byId('descriptionPanel58');
    if(catalogue)catalogue.hidden=method!=='catalogue';if(description)description.hidden=method!=='description';
    for(const button of byId('addServiceMethods58')?.children||[])button.setAttribute('aria-pressed',String(button.dataset.method===method));
    const assistant=byId('aiChantierCard');if(assistant)assistant.open=true;
    if(focus)(method==='catalogue'?document.querySelector('#ogPicker41 input'):byId('aiChantierText'))?.focus();
  }

  function closeOptions(restoreFocus=true){if(optionsPanel){optionsPanel.hidden=true;if(restoreFocus)byId('appMenuToggle57')?.focus()}}

  function makeComposer(step2){
    const builder=byId('serviceBuilder'),catalogue=builder?.closest('.card'),assistant=byId('aiChantierCard');
    composer=document.createElement('details');composer.id='addService58';
    const summary=document.createElement('summary');summary.textContent='+ Ajouter une prestation';
    const body=document.createElement('div');body.className='addServiceBody58';
    const methods=document.createElement('div');methods.id='addServiceMethods58';methods.className='addServiceMethods58';methods.setAttribute('role','group');methods.setAttribute('aria-label','Mode d’ajout');
    for(const [key,label] of [['catalogue','Catalogue Ogust'],['description','Décrire les travaux']]){const button=document.createElement('button');button.type='button';button.dataset.method=key;button.textContent=label;button.addEventListener('click',()=>selectMethod(key,true));methods.appendChild(button)}
    const catalogPanel=document.createElement('div');catalogPanel.id='cataloguePanel58';catalogPanel.className='addServicePanel58';
    const description=document.createElement('div');description.id='descriptionPanel58';description.className='addServicePanel58';
    if(catalogue){catalogue.classList.add('catalogueCard58');catalogPanel.appendChild(catalogue)}
    if(assistant)description.appendChild(assistant);
    const notes=byId('fastNotesImport42');if(notes)description.appendChild(notes);
    body.append(methods,catalogPanel,description);if(builder)body.appendChild(builder);
    composer.append(summary,body);pricing.insertAdjacentElement('afterend',composer);
    summary.addEventListener('click',event=>{event.preventDefault();composer.open=!composer.open;if(composer.open){const status=byId('workspaceStatus58');if(status)status.textContent='';selectMethod(method,true)}});
    const status=document.createElement('div');status.id='workspaceStatus58';status.setAttribute('role','status');composer.insertAdjacentElement('afterend',status);
    selectMethod('catalogue');

    optionsPanel=document.createElement('div');optionsPanel.id='workspaceOptions58';optionsPanel.hidden=true;
    const card=document.createElement('section');card.className='workspaceOptionsCard58';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','Options de chiffrage');
    const head=document.createElement('div');head.className='workspaceOptionsHead58';const title=document.createElement('h2');title.textContent='Options de chiffrage';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fermer les options');close.addEventListener('click',()=>closeOptions());head.append(title,close);card.appendChild(head);
    for(const node of [pricing.querySelector('.fastTaxDetails53'),byId('modeChoices')?.closest('.card'),byId('fastDetailed42')])if(node)card.appendChild(node);
    optionsPanel.appendChild(card);document.body.appendChild(optionsPanel);
    optionsPanel.addEventListener('click',event=>{if(event.target===optionsPanel)closeOptions()});
    optionsPanel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeOptions()}
      if(event.key==='Tab'){const controls=Array.from(card.querySelectorAll('button,input,select,textarea,summary')).filter(node=>!node.disabled&&node.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
    });
    const menu=byId('appMenu57');if(menu){optionsButton=document.createElement('button');optionsButton.id='workspaceOptionsButton58';optionsButton.type='button';optionsButton.className='appMenuItem57';optionsButton.textContent='Options de chiffrage';optionsButton.addEventListener('click',()=>{optionsPanel.hidden=false;close.focus()});const version=byId('acjVersion');if(version?.parentElement===menu)version.insertAdjacentElement('beforebegin',optionsButton);else menu.appendChild(optionsButton)}
    window.acjWorkspace58={open(value='catalogue'){composer.open=true;selectMethod(value,true)},close(){composer.open=false},get isOpen(){return composer.open},getDraft(){return{open:composer.open,method}},restore(draft){if(draft&&typeof draft.open==='boolean'){composer.open=draft.open;selectMethod(draft.method)}}};
  }

  function mergeWorkspace(){
    const step2=document.querySelector('.step[data-step="2"]');
    step3=document.querySelector('.step[data-step="3"]');
    const final=document.querySelector('.step[data-step="4"]');
    if(!step2||!step3||!final)return false;
    makeHeader(step2,'Devis','Décris les travaux ou choisis une prestation Ogust. Le devis et son total se construisent ici.');
    makeHeader(final,'Vérifier le devis','Contrôle le client, les prestations et le total avant de créer le devis dans Ogust.');
    for(const section of [step2,step3])for(const node of Array.from(section.children)){
      if(node.matches('.actions'))node.classList.add('fastLegacyActions42');
    }
    step3.setAttribute('aria-hidden','true');

    // Only the old preset choices are collapsed; the live Ogust picker and its
    // quantity/price builder retain their nodes, IDs and registered listeners.
    const presets=byId('presetChoices'),mode=byId('modeChoices');
    const importedNotes=byId('notesImportCard');
    if(importedNotes){
      const details=document.createElement('details');details.id='fastNotesImport42';
      const summary=document.createElement('summary');summary.textContent='Importer une note';
      details.append(summary,importedNotes);
      const ai=byId('aiChantierCard');
      if(ai?.closest('.step')===step2)ai.insertAdjacentElement('afterend',details);
      else{const header=step2.querySelector('.fastHeader42');header.insertAdjacentElement('afterend',details)}
    }
    if(presets){
      const serviceCard=presets.closest('.card');
      const details=document.createElement('details');details.id='fastDetailed42';
      const summary=document.createElement('summary');summary.textContent='Saisie détaillée';
      const body=document.createElement('div');body.className='fastDetailedBody42';
      details.append(summary,body);
      const modeCard=mode?.closest('.card');
      if(modeCard&&serviceCard){
        const heading=modeCard.querySelector('.cardTitle');if(heading)heading.textContent='Métier';
        serviceCard.insertAdjacentElement('beforebegin',modeCard);
      }
      const card=document.createElement('div');card.className='card';
      const title=document.createElement('div');title.className='cardTitle';title.textContent='Calculer avec les repères ACJ';
      card.append(title,presets);body.appendChild(card);
      const notice=Array.from(step2.children).find(node=>node.matches('.notice'));if(notice)body.appendChild(notice);
      if(serviceCard){
        const heading=serviceCard.querySelector('.cardTitle');if(heading)heading.textContent='Prestations';
        serviceCard.insertAdjacentElement('afterend',details);
      }else step2.appendChild(details);
    }
    pricing=document.createElement('div');pricing.id='fastPricing42';step2.appendChild(pricing);movePricing();
    const tax=Array.from(pricing.children).find(node=>node.matches('.summary'));
    if(tax){const details=document.createElement('details');details.className='fastTaxDetails53';const title=document.createElement('summary');title.textContent='Détail HT et TVA';tax.insertAdjacentElement('beforebegin',details);details.append(title,tax)}
    const header=step2.querySelector('.fastHeader42');header.insertAdjacentElement('afterend',pricing);makeComposer(step2);
    const actions=document.createElement('div');actions.id='fastActions42';actions.className='actions uxStepActions';
    const total=document.createElement('div');total.className='fastLiveTotal42';
    const caption=document.createElement('span');caption.textContent='Total TTC';
    const amount=document.createElement('strong');amount.id='fastLiveTotal42';amount.textContent='0,00 €';
    total.append(caption,amount);
    const next=document.createElement('button');next.type='button';next.className='btn primary';next.id='fastVerify42';next.textContent='Vérifier le devis';next.addEventListener('click',()=>window.goStep(4));
    actions.append(total,next);step2.appendChild(actions);
    const finalBack=Array.from(final.querySelectorAll('button')).find(node=>/goStep\(3\)/.test(node.getAttribute('onclick')||''));
    if(finalBack)finalBack.textContent='Modifier le devis';
    const clientNext=document.querySelector('.step[data-step="1"] button[onclick="goStep(2)"]');if(clientNext)clientNext.textContent='Préparer le devis';
    // Historical duplication and future calculation modules may append notices
    // to step 3 after navigation. Move those too, without a body-wide observer.
    const observer=new MutationObserver(movePricing);observer.observe(step3,{childList:true});
    return true;
  }

  function makeProgress(){
    const legacy=document.querySelector('.top>.progress');if(!legacy)return;
    legacy.setAttribute('aria-hidden','true');
    const nav=document.createElement('nav');nav.className='fastProgress42';nav.setAttribute('aria-label','Étapes du devis');
    buttons=steps.map(step=>{
      const button=document.createElement('button');button.type='button';button.dataset.step=String(step.id);
      const no=document.createElement('span');no.className='fastStepNo42';
      const name=document.createElement('span');name.textContent=step.label;
      button.append(no,name);button.addEventListener('click',()=>window.goStep(step.id));nav.appendChild(button);return button;
    });
    legacy.insertAdjacentElement('afterend',nav);
    const label=byId('stepLabel');if(label){const own=document.createElement('span');own.id='fastStepLabel42';label.insertAdjacentElement('afterend',own)}
  }

  function refresh(){
    const current=Number(document.querySelector('.step.active')?.dataset.step||getState().step||1);
    const index=steps.findIndex(step=>step.id===current);
    if(current!==lastStep){
      lastStep=current;
      buttons.forEach((button,i)=>{
        button.disabled=i>index;button.dataset.current=String(i===index);button.dataset.done=String(i<index);
        button.setAttribute('aria-current',i===index?'step':'false');
        button.querySelector('.fastStepNo42').textContent=i<index?'✓':String(i+1);
        button.setAttribute('aria-label',`Étape ${i+1} : ${steps[i].label}${i===index?', étape actuelle':''}`);
      });
      const label=byId('fastStepLabel42');if(label)label.textContent=steps[index]?.label||'Devis';
    }
    const s=getState();if(optionsButton)optionsButton.hidden=current!==2;
    const total=typeof window.totals==='function'?window.totals().ttc:0;
    const summary=typeof window.money==='function'?window.money(total):new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(total)||0);
    if(lastSummary!==summary){lastSummary=summary;const node=byId('fastLiveTotal42');if(node)node.textContent=summary}
    const review=byId('reviewLiveTotal53');if(review&&review.textContent!==summary)review.textContent=summary;
    const next=byId('fastVerify42');if(next)next.disabled=!(s.lines?.length);
    const empty=byId('quoteLines')?.querySelector('.empty');
    if(empty&&empty.textContent!=='Le devis est vide. Ajoute ta première prestation.')empty.textContent='Le devis est vide. Ajoute ta première prestation.';
  }

  function wrapFunctions(){
    const original=window.goStep;
    if(typeof original==='function')window.goStep=function(step){
      const args=Array.from(arguments);args[0]=Number(step)===3?2:step;
      const result=original.apply(this,args);
      if(Number(getState().step)===2){
        window.renderQuoteLines?.();
        const km=byId('kmRate'),waste=byId('wasteRate');
        if(typeof settings!=='undefined'){if(km)km.value=settings.kmRate;if(waste)waste.value=settings.wasteRate}
      }
      refresh();return result;
    };
    for(const name of ['renderTotals','renderQuoteLines']){
      const fn=window[name];if(typeof fn==='function')window[name]=function(){const result=fn.apply(this,arguments);refresh();return result};
    }
    const builder=window.renderServiceBuilder;if(typeof builder==='function')window.renderServiceBuilder=function(){const result=builder.apply(this,arguments);if(getState().activePreset){composer.open=true;closeOptions(false)}return result};
    const add=window.addBuiltService;if(typeof add==='function')window.addBuiltService=function(){const before=getState().lines?.length||0,result=add.apply(this,arguments);if((getState().lines?.length||0)>before){composer.open=false;const status=byId('workspaceStatus58');if(status)status.textContent='Prestation ajoutée au devis.';composer.querySelector('summary')?.focus();byId('quoteLines')?.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'})}return result};
    const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){const result=fresh.apply(this,arguments);composer.open=false;selectMethod('catalogue');closeOptions(false);const status=byId('workspaceStatus58');if(status)status.textContent='';return result};
  }

  function init(){
    if(window.__acjFastFlowV42)return;
    if(!mergeWorkspace())return;
    window.__acjFastFlowV42=true;styles();makeProgress();wrapFunctions();refresh();
    if(Number(getState().step)===3)window.goStep(2);
  }
  // Wait until all DOMContentLoaded modules have mounted their cards/wrappers.
  const start=()=>queueMicrotask(init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

