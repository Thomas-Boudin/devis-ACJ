// Explicit quotation corrections and completed-job feedback; no Ogust writes.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/analyse-chantier';
  const KEY='acj_devis_learning_v45',SAVED_KEY='acj_devis_saved_v6',LIMIT=100;
  const COMPANIES=['ACJ Services','ACJ Services Lens','Jet Services'];
  const WORDS=new Set('romarin saule crevette weigelia laurier arbuste arbres arbre pelouse gazon haie haies massif massifs allee allees terrasse cour paves mur cloture jardin tonte tailler taille enlever arrachage evacuation dechets entretien rabattage debroussaillage desherbage nettoyage vitres vitre repassage menage logement locaux bureau bureaux montage meuble meubles fixation maintenance'.split(' '));
  const ENUMS={cut_type:['entretien','rabattage'],waste:['oui','non'],grass:['entretien','haute','tres_haute'],collection:['oui','non'],density:['leger','dense','friche'],zone:['massifs','allees','cour','mixte'],method:['manuel','autre'],support:['terrasse','cour','paves','mur','autre']};
  let sending=false,notice=null,panelSignature='',panelContext='',panelRows=[];
  const byId=id=>document.getElementById(id),clone=value=>JSON.parse(JSON.stringify(value));
  const context=()=>({company:String(state.company||''),quote_ref:String(state.number||'')});
  const quoteKey=value=>JSON.stringify([value.company,value.quote_ref]);
  const hours=value=>Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=500?Number(value):null;
  const norm=value=>String(value||'').trim().toLowerCase();
  const words=value=>[...new Set(String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z]+/).filter(word=>WORDS.has(word)))].sort().slice(0,12);
  const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)?value:'';
  const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function features(value){
    const out={},source=value&&typeof value==='object'?value:{};
    if(Number.isFinite(Number(source.metric))&&Number(source.metric)>0&&Number(source.metric)<=1000000&&['ml','m2','m²'].includes(source.metric_unit)){out.metric=Number(source.metric);out.metric_unit=source.metric_unit==='m2'?'m²':source.metric_unit}
    if(Number.isFinite(Number(source.height_m))&&Number(source.height_m)>0&&Number(source.height_m)<=50)out.height_m=Number(source.height_m);
    if([1,2].includes(Number(source.faces)))out.faces=Number(source.faces);
    if(typeof source.top==='boolean')out.top=source.top;
    if(Number.isInteger(Number(source.workers))&&Number(source.workers)>=1&&Number(source.workers)<=50)out.workers=Number(source.workers);
    for(const [name,allowed] of Object.entries(ENUMS))if(allowed.includes(source[name]))out[name]=source[name];
    return out;
  }
  function clean(record){
    if(!record||record.confirmed!==true||typeof record.line_id!=='string'||!record.line_id||record.line_id.length>120||!MODES[record.mode]||!MODES[record.mode].presets.some(preset=>preset.id===record.preset)||!hours(record.retained_hours))return null;
    const preset=MODES[record.mode].presets.find(item=>item.id===record.preset);
    const label=String(preset.label||MODES[record.mode].label||'Prestation');
    const out={line_id:record.line_id,mode:record.mode,preset:record.preset,designation:[label,...words(`${label} ${record.designation||''}`)].join(' · ').slice(0,160),features:features(record.features),estimated_hours:hours(record.estimated_hours),retained_hours:hours(record.retained_hours),confirmed:true};
    if(id(record.ogust_rate_id))out.ogust_rate_id=id(record.ogust_rate_id);
    if(id(record.ogust_product_id))out.ogust_product_id=id(record.ogust_product_id);
    if(hours(record.actual_hours)&&record.actual_confirmed===true){out.actual_hours=hours(record.actual_hours);out.actual_confirmed=true}
    return out;
  }
  const jobSignature=record=>JSON.stringify([record.mode,record.preset,features(record.features),record.ogust_product_id||'',words(record.designation)]);
  const recordKey=(ctx,record)=>JSON.stringify([ctx.company,ctx.quote_ref,record.line_id,jobSignature(record)]);
  function inform(message,error=false,ctx=context()){notice={key:quoteKey(ctx),message,error};renderStatus()}
  function read(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(!saved)return [];
      if(saved.version!==45||!Array.isArray(saved.entries)||saved.entries.length>LIMIT)throw Error('BAD_OUTBOX');
      return saved.entries.map(entry=>{
        const record=clean(entry.record);
        if(!COMPANIES.includes(entry.company)||typeof entry.quote_ref!=='string'||!entry.quote_ref||entry.quote_ref.length>160||typeof entry.event_id!=='string'||!entry.event_id||entry.event_id.length>120||!record)throw Error('BAD_RECORD');
        return {company:entry.company,quote_ref:entry.quote_ref,event_id:entry.event_id,record,acked:entry.acked===true,updated_at:Number(entry.updated_at)||0,reason:entry.reason==='MEMORY_NOT_CONFIGURED'?'MEMORY_NOT_CONFIGURED':''};
      });
    }catch{inform('Mémoire locale illisible : les nouveaux retours ne sont pas enregistrés.',true);return null}
  }
  function write(entries,ctx=context()){
    try{localStorage.setItem(KEY,JSON.stringify({version:45,entries}));return true}
    catch{inform('Mémoire locale pleine ou indisponible : retour non enregistré.',true,ctx);return false}
  }
  function eligible(){
    for(const line of state.lines||[]){
      if(line.aiProvenance?.source!=='assistant')continue;
      const product=line.ogustProductCompany===state.company?String(line.ogustProductLevelId||''):'';
      if(typeof line.aiLearningProductId==='string'&&line.aiLearningProductId!==product){line.aiLearningInvalidated=true;delete line.aiActualHours;delete line.aiActualContext}
      else if(product&&line.aiLearningProductId===undefined)line.aiLearningProductId=product;
    }
    return (state.lines||[]).filter(line=>line.type==='service'&&['h','heure'].includes(norm(line.unit))&&line.pricingMethod!=='flat'&&hours(line.qty)&&line.aiProvenance?.source==='assistant'&&line.aiProvenance.durationConfirmed===true&&line.aiLearningInvalidated!==true&&MODES[line.aiProvenance.mode]&&MODES[line.aiProvenance.mode].presets.some(item=>item.id===line.aiProvenance.preset));
  }
  function snapshot(lines=eligible()){
    const ctx=context();if(!COMPANIES.includes(ctx.company)||!ctx.quote_ref||ctx.quote_ref.length>160)return null;
    const entries=read();if(!entries)return null;
    const records=lines.map(line=>{
      const record=recordForLine(line,ctx);if(!record)return null;
      const previous=entries.find(entry=>recordKey(entry,entry.record)===recordKey(ctx,record)),signature=jobSignature(record);
      if(hours(line.aiActualHours)&&line.aiActualContext===signature){record.actual_hours=hours(line.aiActualHours);record.actual_confirmed=true}
      else if(previous&&jobSignature(previous.record)===signature&&hours(previous.record.actual_hours)){record.actual_hours=previous.record.actual_hours;record.actual_confirmed=true}
      return record;
    }).filter(Boolean);
    return {...ctx,records};
  }
  function recordForLine(line,ctx=context()){
    const p=line.aiProvenance;if(!p)return null;
    const record={line_id:String(line.id||''),mode:p.mode,preset:p.preset,designation:words([line.designation,line.meta].join(' ')).join(' '),features:features(p.features),estimated_hours:hours(p.estimatedHours),retained_hours:hours(line.qty),confirmed:true};
    if(line.ogustProductCompany===ctx.company){if(line.ogustRateId)record.ogust_rate_id=String(line.ogustRateId);if(line.ogustProductLevelId)record.ogust_product_id=String(line.ogustProductLevelId)}
    return clean(record);
  }
  function recordForSavedLine(line,ctx){
    return recordForLine({id:line.line_id,designation:line.designation,meta:line.detail,qty:line.quantite,aiProvenance:line.ai_provenance,ogustRateId:line.ogust_rate_id,ogustProductLevelId:line.ogust_product_level_id,ogustProductCompany:ctx.company},ctx);
  }
  function persistActual(captured){
    function update(quote){
      if(!quote||String(quote.societe||'')!==captured.company||String(quote.numero_devis||'')!==captured.quote_ref)return false;
      let changed=false;
      for(const line of quote.lignes||[]){
        const record=captured.records.find(item=>item.line_id===line.line_id),saved=recordForSavedLine(line,captured);
        if(!record||!saved||jobSignature(record)!==jobSignature(saved))continue;
        line.ai_actual_hours=record.actual_hours;line.ai_actual_context=jobSignature(record);changed=true;
      }
      return changed;
    }
    const reopened=window.acjReopenedQuoteV33;
    if(reopened&&String(reopened.societe||'')===captured.company&&String(reopened.numero_devis||'')===captured.quote_ref)update(reopened.snapshot);
    try{
      const list=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');if(!Array.isArray(list))throw Error('BAD_HISTORY');
      let changed=false;for(const quote of list)if(update(quote))changed=true;
      if(changed)localStorage.setItem(SAVED_KEY,JSON.stringify(list));
      return true;
    }catch{inform('Temps réalisés conservés dans la mémoire locale en attente, mais la fiche historique n’a pas pu être mise à jour.',true,captured);return false}
  }
  function enqueue(snapshotValue){
    if(!snapshotValue?.records?.length)return true;
    const entries=read();if(!entries)return false;
    const incoming=snapshotValue.records.map(clean);if(incoming.some(record=>!record)){inform('Retour non enregistré : données de chantier incomplètes.',true,snapshotValue);return false}
    const changed=incoming.filter(record=>{
      const old=entries.find(entry=>recordKey(entry,entry.record)===recordKey(snapshotValue,record));
      return !old||JSON.stringify(old.record)!==JSON.stringify(record);
    });
    if(!changed.length){notice=null;render();schedule();return true}
    const next=entries.filter(entry=>!changed.some(record=>recordKey(entry,entry.record)===recordKey(snapshotValue,record)));
    while(next.length+changed.length>LIMIT){const acked=next.map((entry,index)=>({entry,index})).filter(item=>item.entry.acked).sort((a,b)=>a.entry.updated_at-b.entry.updated_at)[0];if(!acked){inform('Mémoire en attente pleine : ce retour n’a pas été enregistré. Synchronise les retours en attente avant de réessayer.',true,snapshotValue);return false}next.splice(acked.index,1)}
    const eventId=`${Date.now()}-${crypto.randomUUID()}`;
    for(let index=0;index<changed.length;index++)next.push({company:snapshotValue.company,quote_ref:snapshotValue.quote_ref,event_id:`${eventId}-chunk-${Math.floor(index/20)}`,record:changed[index],acked:false,updated_at:Date.now(),reason:''});
    if(!write(next,snapshotValue))return false;
    notice=null;render();schedule();return true;
  }
  function schedule(){setTimeout(()=>{void flush()},0)}
  async function flush(){
    if(sending||navigator.onLine===false)return false;
    sending=true;
    try{
      while(true){
        const account=context().company,entries=read();if(!entries)return false;
        const first=entries.find(entry=>entry.company===account&&!entry.acked);if(!first)return true;
        const group=entries.filter(entry=>entry.company===first.company&&entry.quote_ref===first.quote_ref&&entry.event_id===first.event_id&&!entry.acked).slice(0,20);
        const body={action:'memory_save',company:first.company,quote_ref:first.quote_ref,event_id:first.event_id,records:group.map(entry=>clean(entry.record))};
        let response,data;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
        try{response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});data=await response.json().catch(()=>null)}catch{render();return false}finally{clearTimeout(timeout)}
        const latest=read();if(!latest)return false;
        if(response.ok&&data?.ok&&data.configured===true&&Number(data.saved_count)>=group.length){
          for(const entry of latest)if(group.some(sent=>recordKey(sent,sent.record)===recordKey(entry,entry.record)&&sent.event_id===entry.event_id)){entry.acked=true;entry.reason=''}
          if(!write(latest,first))return false;notice=null;render();
        }else{
          if(data?.error==='MEMORY_NOT_CONFIGURED')for(const entry of latest)if(entry.event_id===first.event_id&&entry.company===first.company&&!entry.acked)entry.reason='MEMORY_NOT_CONFIGURED';
          write(latest,first);render();return false;
        }
        // Continue only the currently selected company; a late response never
        // turns another company's feedback into an acknowledged example.
        if(context().company!==account)return false;
      }
    }finally{sending=false}
  }
  function matchingEntries(){const entries=read();return (entries||[]).filter(entry=>quoteKey(entry)===quoteKey(context()))}
  function renderStatus(){
    const box=byId('learningStatus45');if(!box)return;
    if(notice?.key===quoteKey(context())){box.textContent=notice.message;box.style.color=notice.error?'#b91c1c':'#64748b';return}
    const entries=matchingEntries();
    if(notice?.key===quoteKey(context())){box.textContent=notice.message;box.style.color=notice.error?'#b91c1c':'#64748b';return}
    if(!entries.length){box.textContent='Les corrections validées seront mémorisées après « Enregistrer ».';box.style.color='#64748b';return}
    const pending=entries.filter(entry=>!entry.acked),ack=entries.filter(entry=>entry.acked),actual=ack.filter(entry=>hours(entry.record.actual_hours)).length;
    box.style.color='#64748b';
    if(pending.length)box.textContent=pending.some(entry=>entry.reason==='MEMORY_NOT_CONFIGURED')?'Retours conservés sur cet appareil · mémoire partagée non configurée.':`Retours conservés sur cet appareil · ${pending.length} synchronisation${pending.length>1?'s':''} en attente.`;
    else box.textContent=`Retours enregistrés sur le serveur : ${ack.length} temps retenu${ack.length>1?'s':''} pour le devis · ${actual} durée${actual>1?'s':''} réalisée${actual>1?'s':''} confirmée${actual>1?'s':''}.`;
  }
  function isReopened(){const reopened=window.acjReopenedQuoteV33;return reopened&&String(reopened.societe||'')===state.company&&String(reopened.numero_devis||'')===state.number}
  function actualFor(line,entries){
    const record=snapshot([line])?.records?.[0];if(!record)return '';
    if(hours(line.aiActualHours)&&line.aiActualContext===jobSignature(record))return line.aiActualHours;
    const old=entries.find(entry=>recordKey(entry,entry.record)===recordKey(context(),record));return old&&jobSignature(old.record)===jobSignature(record)?old.record.actual_hours||'':'';
  }
  function recordActual(values,expected=quoteKey(context())){
    if(expected!==quoteKey(context())||!isReopened()){inform('Le devis a changé. Rouvre son retour chantier avant de valider.',true);return false}
    const lines=eligible(),updates=[];
    for(const value of values||[]){
      const line=lines.find(item=>String(item.id)===String(value.line_id));if(!line){inform('Retour non enregistré : une prestation a changé.',true);return false}
      if(value.job_signature!==undefined&&value.job_signature!==jobSignature(recordForLine(line))){inform('La prestation a changé. Vérifie le nouveau retour chantier avant de valider.',true);return false}
      if(String(value.hours??'').trim()==='')continue;
      const actual=hours(value.hours);if(!actual){inform('Renseigne un temps réalisé supérieur à 0 et inférieur ou égal à 500 heures.',true);return false}
      updates.push({line,actual});
    }
    if(!updates.length){inform('Aucun temps réalisé renseigné. Une case vide signifie « inconnu ».');return false}
    const captured=snapshot(updates.map(update=>update.line));if(!captured)return false;
    for(const record of captured.records){record.actual_hours=updates.find(update=>String(update.line.id)===record.line_id).actual;record.actual_confirmed=true}
    if(!enqueue(captured))return false;
    for(const update of updates){const record=captured.records.find(item=>item.line_id===String(update.line.id));update.line.aiActualHours=update.actual;update.line.aiActualContext=jobSignature(record)}
    persistActual(captured);window.acjDraftV42?.save?.();render();return true;
  }
  function render(){
    const lines=eligible(),anchor=byId('reviewLines');if(!anchor)return;
    if(!lines.length){byId('learningStatus45')?.remove();byId('learningActual45')?.remove();panelSignature='';panelRows=[];return}
    let status=byId('learningStatus45');if(!status){status=document.createElement('div');status.id='learningStatus45';status.setAttribute('role','status');status.style.cssText='font-size:11px;line-height:1.45;margin-top:10px;color:#64748b';anchor.insertAdjacentElement('afterend',status)}
    renderStatus();
    if(!isReopened()){byId('learningActual45')?.remove();panelSignature='';panelRows=[];return}
    const ctx=quoteKey(context()),rows=lines.map(line=>({line,id:String(line.id),job:jobSignature(recordForLine(line))})),signature=JSON.stringify([ctx,rows.map(row=>[row.id,row.line.qty,row.line.aiActualHours||null,row.job])]);
    if(signature===panelSignature&&byId('learningActual45'))return;
    const draft=panelContext===ctx?panelRows.map((row,index)=>({id:row.id,job:row.job,value:byId(`learningHours45_${index}`)?.value})):[];byId('learningActual45')?.remove();
    const entries=read()||[],details=document.createElement('details');details.id='learningActual45';details.style.cssText='margin-top:12px';
    details.innerHTML=`<summary>Retour chantier</summary><div style="font-size:12px;color:#64748b;margin:10px 0">Après le chantier, renseigne les heures réalisées de main-d’œuvre. Additionne les heures des intervenants : 2 personnes × 2 h = 4 h. Une case vide reste inconnue. Le montant du devis et Ogust ne sont pas modifiés.</div>${rows.map((row,index)=>{const saved=draft.find(item=>item.id===row.id&&item.job===row.job)?.value;return `<div class="field"><label for="learningHours45_${index}">${html(row.line.designation||'Prestation')} · devis ${html(row.line.qty)} h<br>Heures réalisées (main-d’œuvre)</label><input id="learningHours45_${index}" type="number" min="0.01" max="500" step="0.01" inputmode="decimal" placeholder="Heures réalisées" value="${html(saved??actualFor(row.line,entries))}"></div>`}).join('')}<button id="learningSaveActual45" class="btn" type="button" style="width:100%">Enregistrer les temps réalisés</button>`;
    status.insertAdjacentElement('afterend',details);panelContext=ctx;panelSignature=signature;panelRows=rows;
    const controls=rows.map((row,index)=>({line_id:row.id,job_signature:row.job,input:byId(`learningHours45_${index}`)}));
    byId('learningSaveActual45')?.addEventListener('click',()=>recordActual(controls.map(row=>({line_id:row.line_id,job_signature:row.job_signature,hours:row.input?.value})),ctx));
  }
  function restoreLineIds(event){
    const saved=event?.detail?.quote;
    if(!saved||String(saved.societe||'')!==state.company||String(saved.numero_devis||'')!==state.number)return;
    const rows=(saved.lignes||[]).filter(line=>String(line.designation||'')&&Number(line.quantite)>0);
    for(let index=0;index<(state.lines||[]).length;index++){
      const line=state.lines[index],source=rows[index];if(!source)continue;
      if(typeof source.line_id==='string'&&source.line_id&&source.line_id.length<=120)line.id=source.line_id;
      if(hours(source.ai_actual_hours)&&typeof source.ai_actual_context==='string'){line.aiActualHours=hours(source.ai_actual_hours);line.aiActualContext=source.ai_actual_context}
      if(source.ai_learning_invalidated===true)line.aiLearningInvalidated=true;
      if(typeof source.ai_learning_product_id==='string')line.aiLearningProductId=source.ai_learning_product_id;
    }
    panelSignature='';render();
  }
  function init(){
    const payload=window.quotePayload;if(typeof payload==='function')window.quotePayload=function(){const out=payload.apply(this,arguments);eligible();(out?.lignes||[]).forEach((line,index)=>{const source=state.lines[index];if(!source)return;line.line_id=String(source.id);if(hours(source.aiActualHours)&&typeof source.aiActualContext==='string'){line.ai_actual_hours=hours(source.aiActualHours);line.ai_actual_context=source.aiActualContext}if(source.aiLearningInvalidated===true)line.ai_learning_invalidated=true;if(typeof source.aiLearningProductId==='string')line.ai_learning_product_id=source.aiLearningProductId});return out};
    const patch=window.patchLine;if(typeof patch==='function')window.patchLine=function(lineId,key,value){const line=state.lines.find(item=>item.id===lineId),before=line?words(line.designation):[];const out=patch.apply(this,arguments);if(line?.aiProvenance&&key==='designation'&&JSON.stringify(before)!==JSON.stringify(words(line.designation))){line.aiLearningInvalidated=true;delete line.aiActualHours;delete line.aiActualContext;render()}return out};
    const assign=window.acjOgustRates?.assign;if(typeof assign==='function')window.acjOgustRates.assign=function(line,rate){const tracked=typeof line.aiLearningProductId==='string',before=String(line.ogustProductLevelId||'');const out=assign.apply(this,arguments);if(line.aiProvenance){if(!tracked)line.aiLearningProductId=String(line.ogustProductLevelId||'');if(tracked&&before!==String(line.ogustProductLevelId||'')){line.aiLearningInvalidated=true;delete line.aiActualHours;delete line.aiActualContext;render()}}return out};
    const save=window.saveQuote;if(typeof save==='function')window.saveQuote=function(){const captured=snapshot();const out=save.apply(this,arguments);if(out?.then)return out.then(value=>{if(value!==false&&captured)enqueue(captured);return value});if(out!==false&&captured)enqueue(captured);return out};
    const review=window.renderReview;if(typeof review==='function')window.renderReview=function(){const out=review.apply(this,arguments);render();return out};
    const fresh=window.newQuote;if(typeof fresh==='function')window.newQuote=function(){const out=fresh.apply(this,arguments);panelSignature='';notice=null;render();return out};
    window.addEventListener('acj:quote-reopened',restoreLineIds);window.addEventListener('acj:company-changed',()=>{panelSignature='';notice=null;render();schedule()});window.addEventListener('online',schedule);
    render();schedule();
  }
  window.acjLearningV45={flush,recordActual,get key(){return KEY}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
