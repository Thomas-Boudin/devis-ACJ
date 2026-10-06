// Keep the active quote on this device, including work not yet added as a line.
(function(){
  const KEY='acj_devis_active_v42';
  const INPUTS=['client','tel','adresse','notes','aiChantierText','noteText','builderDesignation','builderHours','builderRate','builderFlat','builderMetric'];
  let suspended=true,timer=null,last='',restored=false;
  const byId=id=>document.getElementById(id);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function status(message,error=false){const box=byId('draftStatus42');if(box){box.textContent=message;box.style.color=error?'#b91c1c':'#64748b'}}
  function capture(){
    window.syncClient?.();window.syncNotes?.();
    const choice=window.ogustClientChoiceV21;
    const inputs={};for(const id of INPUTS){const input=byId(id);if(input)inputs[id]=input.value}
    return {version:42,state:clone(state),inputs,
      clientChoice:{mode:choice?.mode||'new',selected:choice?.company===state.company&&choice?.selected?clone(choice.selected):null},
      clientDraft:window.acjNotesClientDraft?.company===state.company?clone(window.acjNotesClientDraft):null,
      reopened:window.acjReopenedQuoteV33?.societe===state.company&&window.acjReopenedQuoteV33?.numero_devis===state.number?clone(window.acjReopenedQuoteV33):null,
      aiPending:window.acjAIDraftV42?.get?.()||null,
      picker:window.acjOgustPicker?.getDraft?.()||null};
  }
  function hasWork(d){return !!(d.state.client||d.state.tel||d.state.address||d.state.notes||d.state.lines?.length||d.state.activePreset||d.inputs.aiChantierText?.trim()||d.inputs.noteText?.trim())}
  function save(){
    clearTimeout(timer);timer=null;if(suspended)return;
    try{
      const draft=capture(),text=JSON.stringify(draft);if(text===last)return;
      if(!hasWork(draft)){localStorage.removeItem(KEY);last=text;status('');return}
      localStorage.setItem(KEY,text);last=text;status(restored?'Saisie reprise · enregistrée sur cet appareil':'Saisie enregistrée sur cet appareil');
    }catch{status('Enregistrement automatique impossible sur cet appareil.',true)}
  }
  function queue(){if(suspended)return;clearTimeout(timer);timer=setTimeout(save,300)}
  function valid(d){return d?.version===42&&d.state&&typeof d.state.number==='string'&&typeof d.state.client==='string'&&Array.isArray(d.state.lines)&&d.state.lines.length<500&&COMPANIES.includes(d.state.company)&&!!MODES[d.state.mode]&&d.state.lines.every(l=>l&&typeof l.id==='string'&&typeof l.designation==='string'&&Number.isFinite(Number(l.qty))&&Number.isFinite(Number(l.unitPriceTTC))&&Number.isFinite(Number(l.vat)))}
  function restore(){
    let draft;try{draft=JSON.parse(localStorage.getItem(KEY)||'null')}catch{return}
    if(!valid(draft))return;
    Object.assign(state,clone(draft.state));state.step=1;
    window.renderCompanies?.();window.renderModes?.();
    window.restoreOgustDraftClientV42?.(draft.clientChoice,state.company);
    window.acjNotesClientDraft=draft.clientDraft?.company===state.company?clone(draft.clientDraft):null;
    const reopened=draft.reopened;
    window.acjReopenedQuoteV33=reopened?.societe===state.company&&reopened?.numero_devis===state.number?clone(reopened):null;
    window.acjReopenedClientIdV33=String(window.acjReopenedQuoteV33?.id_customer||'');
    for(const id of INPUTS){if(typeof draft.inputs?.[id]==='string'&&byId(id))byId(id).value=draft.inputs[id]}
    if(byId('quoteNumberTop'))byId('quoteNumberTop').textContent=state.number;
    if(state.activePreset)window.renderServiceBuilder?.();
    // A tariff saved on-device must be reloaded and matched to the current catalogue.
    if(draft.picker)window.acjOgustPicker?.restoreDraft?.(draft.picker);
    for(const id of INPUTS){if(id.startsWith('builder')&&typeof draft.inputs?.[id]==='string'&&byId(id))byId(id).value=draft.inputs[id]}
    if(draft.aiPending)window.acjAIDraftV42?.restore?.(draft.aiPending);
    window.syncClient?.();window.syncNotes?.();window.renderQuoteLines?.();
    if(window.acjReopenedQuoteV33)window.dispatchEvent(new CustomEvent('acj:quote-reopened',{detail:{quote:window.acjReopenedQuoteV33.snapshot}}));
    const step=Number(draft.state.step);window.goStep?.([2,3,4].includes(step)?step:1);
    restored=true;status('Saisie reprise · enregistrée sur cet appareil');
  }
  async function init(){
    const box=document.createElement('div');box.id='draftStatus42';box.setAttribute('role','status');box.style.cssText='font-size:11px;text-align:center;padding:7px;color:#64748b';document.querySelector('.top')?.appendChild(box);
    await restore();suspended=false;
    for(const name of ['renderQuoteLines','goStep','setMode','setCompany','setHours','setBuilderMethod','applyImportedNotesClientV39']){
      const fn=window[name];if(typeof fn==='function')window[name]=function(){const out=fn.apply(this,arguments);queue();return out};
    }
    const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){
      clearTimeout(timer);suspended=true;
      try{const out=fresh.apply(this,arguments);for(const id of ['aiChantierText','noteText'])if(byId(id))byId(id).value='';window.acjReopenedQuoteV33=null;window.acjReopenedClientIdV33='';window.acjNotesClientDraft=null;localStorage.removeItem(KEY);last='';restored=false;status('');return out}
      finally{suspended=false}
    };
    document.addEventListener('input',queue);document.addEventListener('change',queue);document.addEventListener('click',queue);
    window.addEventListener('acj:company-changed',queue);window.addEventListener('acj:ogust-picker-changed',queue);window.addEventListener('acj:quote-reopened',queue);
    window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});
    window.acjDraftV42={save,get key(){return KEY}};
  }
  const start=()=>queueMicrotask(init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
