import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const source=fs.readFileSync('learning-v45.js','utf8');
const KEY='acj_devis_learning_v45',SAVED='acj_devis_saved_v6';
const copy=value=>JSON.parse(JSON.stringify(value));
const line=(id='line-1',extra={})=>({id,type:'service',designation:'Taille de haie chez Laurent',meta:'15 ml · contact privé laur.hau@free.fr 0783012768',pricingMethod:'hourly',activity:'jardin',qty:3,unit:'h',unitPriceTTC:47,vat:20,ogustRateId:'rate-1',ogustProductLevelId:'product-1',ogustProductCompany:'ACJ Services',aiProvenance:{source:'assistant',durationConfirmed:true,mode:'jardin',preset:'haie',estimatedHours:5,features:{metric:15,metric_unit:'ml',height_m:2,faces:2,waste:'oui',secret:'client@example.com'},description:'Notes privées client',photoCount:10},...extra});

function setup(options={}){
  const storage=options.storage||new Map(),nodes=new Map(),events=new Map(),requests=[],timers=[];
  let failedKey='',saveResult,saveFailure=false,fetcher=async()=>({ok:true,json:async()=>({ok:true,configured:true,saved_count:20})}),draftSaves=0;
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.style={};this.value='';this.textContent=''}
    set id(value){this._id=value;nodes.set(value,this)}get id(){return this._id}
    set innerHTML(value){this._html=value;for(const match of value.matchAll(/<(?:input|button)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const child=new Element(match[0].startsWith('<input')?'input':'button');child.id=match[1];child.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'';this.children.push(child)}}
    get innerHTML(){return this._html||''}
    setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn}
    insertAdjacentElement(position,node){this.children.push(node)}
    remove(){for(const child of this.children)child.remove();if(nodes.get(this.id)===this)nodes.delete(this.id)}
  }
  const anchor=new Element('div');anchor.id='reviewLines';
  const ctx={AbortController,crypto:{randomUUID},state:{company:'ACJ Services',number:'ACJ-2026-001',mode:'jardin',notes:'Notes privées à ne pas transférer',lines:options.lines||[line()]},MODES:{jardin:{label:'Jardinage',presets:[{id:'haie',label:'Taille de haie'},{id:'tonte',label:'Tonte'},{id:'autre_jardin',label:'Autre jardinage'}]},menage:{label:'Ménage',presets:[{id:'entretien',label:'Entretien régulier'}]}},document:{readyState:'complete',getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),addEventListener(name,fn){events.set(name,fn)}},localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(key===failedKey)throw Error('QUOTA');storage.set(key,value)}},navigator:{onLine:false},setTimeout(fn,delay){timers.push({fn,delay});return timers.length},clearTimeout(timer){if(timers[timer-1])timers[timer-1].cleared=true},fetch:async(url,init)=>{const request={url,body:JSON.parse(init.body),init};requests.push(request);return fetcher(request)},addEventListener(name,fn){events.set(name,fn)},renderReview(){},patchLine(id,key,value){const item=ctx.state.lines.find(row=>row.id===id);if(item)item[key]=value},acjOgustRates:{assign(item,rate){item.ogustProductLevelId=rate.product;item.ogustRateId=rate.id;item.ogustProductCompany=ctx.state.company}},acjDraftV42:{save(){draftSaves++}},quotePayload(){return {societe:ctx.state.company,numero_devis:ctx.state.number,client:{nom:'Laurent Privé',email:'client@example.com'},notes:ctx.state.notes,totaux:{ttc:ctx.state.lines.reduce((sum,item)=>sum+item.qty*item.unitPriceTTC,0)},lignes:ctx.state.lines.map(item=>({designation:item.designation,detail:item.meta,quantite:item.qty,unite:item.unit,methode_chiffrage:item.pricingMethod,type:item.type,prix_unitaire_ttc:item.unitPriceTTC,ogust_rate_id:item.ogustRateId,ogust_product_level_id:item.ogustProductLevelId,ai_provenance:copy(item.aiProvenance)}))}},saveQuote(){if(saveFailure)throw Error('SAVE_FAILED');if(saveResult===false)return false;const payload=ctx.quotePayload();const saved=JSON.parse(ctx.localStorage.getItem(SAVED)||'[]');saved.unshift(payload);ctx.localStorage.setItem(SAVED,JSON.stringify(saved));return saveResult},newQuote(){ctx.state={...ctx.state,number:'ACJ-2026-002',lines:[]}}};ctx.window=ctx;
  vm.runInNewContext(source,ctx);
  const entries=()=>JSON.parse(storage.get(KEY)||'{"entries":[]}').entries;
  function reopen(payload=ctx.quotePayload()){ctx.acjReopenedQuoteV33={societe:ctx.state.company,numero_devis:ctx.state.number,snapshot:payload};events.get('acj:quote-reopened')({detail:{quote:payload}})}
  return {ctx,nodes,storage,events,requests,timers,entries,reopen,status:()=>nodes.get('learningStatus45')?.textContent||'',fetchWith(fn){fetcher=fn},failStorage(key){failedKey=key},failSave(value=true){saveFailure=value},saveReturns(value){saveResult=value},draftSaves:()=>draftSaves};
}

{
  const t=setup();assert.equal(t.entries().length,0);t.ctx.acjDraftV42.save();assert.equal(t.entries().length,0);
  t.ctx.saveQuote();assert.equal(t.entries().length,1);const record=t.entries()[0].record;
  assert.equal(record.retained_hours,3);assert.equal(record.estimated_hours,5);assert.equal(record.features.metric,15);assert.equal(record.features.secret,undefined);
  assert.equal(t.ctx.quotePayload().lignes[0].line_id,'line-1');assert.match(t.status(),/cet appareil.*en attente/);
  assert.doesNotMatch(JSON.stringify(t.entries()),/Laurent|laur\.hau|078301|Notes privées|photo|example\.com/);
  t.ctx.navigator.onLine=true;await t.ctx.acjLearningV45.flush();assert.equal(t.entries()[0].acked,true);assert.match(t.status(),/sur le serveur/);
  assert.equal(t.requests[0].body.action,'memory_save');assert.equal(t.requests[0].body.records.length,1);
  assert.match(t.requests[0].body.event_id,/^\d{13}-[0-9a-f-]{36}-chunk-0$/);
  t.ctx.saveQuote();assert.equal(t.entries().length,1);assert.equal(t.entries()[0].acked,true);
}
for(const failure of ['throws','false','quota']){
  const t=setup();if(failure==='throws')t.failSave();if(failure==='false')t.saveReturns(false);if(failure==='quota')t.failStorage(SAVED);
  if(failure==='false')t.ctx.saveQuote();else assert.throws(()=>t.ctx.saveQuote());assert.equal(t.entries().length,0);
}
{
  const t=setup({lines:[line('custom',{designation:'Enlever romarin et laurier · laur.hau@free.fr',meta:'0783012768',aiProvenance:{...line().aiProvenance,preset:'autre_jardin'}})]});t.ctx.saveQuote();const r=t.entries()[0].record;
  assert.match(r.designation,/romarin/);assert.match(r.designation,/laurier/);assert.doesNotMatch(r.designation,/free|078301|laur\.hau/);
}
{
  const t=setup();t.ctx.saveQuote();const event=t.entries()[0].event_id;t.ctx.navigator.onLine=true;
  t.fetchWith(async()=>({ok:false,json:async()=>({error:'MEMORY_NOT_CONFIGURED',configured:false})}));assert.equal(await t.ctx.acjLearningV45.flush(),false);
  assert.equal(t.entries()[0].acked,false);assert.match(t.status(),/cet appareil.*non configurée/);
  const reloaded=setup({storage:t.storage});reloaded.ctx.navigator.onLine=true;await reloaded.ctx.acjLearningV45.flush();assert.equal(reloaded.requests[0].body.event_id,event);assert.equal(reloaded.entries()[0].acked,true);
}
{
  const t=setup();t.ctx.saveQuote();t.ctx.navigator.onLine=true;t.fetchWith(async()=>({ok:true,json:async()=>({ok:true,configured:false,saved_count:1})}));await t.ctx.acjLearningV45.flush();assert.equal(t.entries()[0].acked,false);
  t.fetchWith(async()=>{throw Error('OFFLINE')});await t.ctx.acjLearningV45.flush();assert.equal(t.entries()[0].acked,false);
}
{
  const t=setup();t.ctx.saveQuote();t.ctx.navigator.onLine=true;
  t.fetchWith(request=>new Promise((resolve,reject)=>request.init.signal.addEventListener('abort',()=>reject(Error('ABORTED')))));
  const first=t.ctx.acjLearningV45.flush(),timeout=t.timers.find(timer=>timer.delay===15000&&!timer.cleared);assert.ok(timeout);timeout.fn();
  assert.equal(await first,false);assert.equal(t.entries()[0].acked,false);assert.equal(timeout.cleared,true);
  t.fetchWith(async request=>({ok:true,json:async()=>({ok:true,configured:true,saved_count:request.body.records.length})}));await t.ctx.acjLearningV45.flush();
  assert.equal(t.requests.length,2);assert.equal(t.requests[0].body.event_id,t.requests[1].body.event_id);assert.equal(t.entries()[0].acked,true);
}
{
  const t=setup();t.ctx.saveQuote();const payload=t.ctx.quotePayload();t.reopen(payload);
  assert.match(t.nodes.get('learningActual45').innerHTML,/2 personnes × 2 h = 4 h/);
  assert.equal(t.ctx.acjLearningV45.recordActual([{line_id:'line-1',hours:''}]),false);assert.equal(t.entries()[0].record.actual_hours,undefined);
  assert.equal(t.ctx.acjLearningV45.recordActual([{line_id:'line-1',hours:501}]),false);
  assert.equal(t.ctx.acjLearningV45.recordActual([{line_id:'line-1',hours:2}]),true);
  assert.equal(t.ctx.state.lines[0].qty,3);assert.equal(t.ctx.state.lines[0].unitPriceTTC,47);assert.equal(t.ctx.quotePayload().totaux.ttc,141);
  assert.equal(t.entries()[0].record.actual_hours,2);assert.equal(t.entries()[0].record.actual_confirmed,true);assert.equal(payload.lignes[0].ai_actual_hours,2);
  assert.equal(JSON.parse(t.storage.get(SAVED))[0].lignes[0].ai_actual_hours,2);assert.equal(t.draftSaves(),1);
  const signature=t.ctx.state.lines[0].aiActualContext;t.ctx.saveQuote();assert.equal(t.entries()[0].record.actual_hours,2);assert.equal(t.ctx.state.lines[0].aiActualContext,signature);
  // A historical quote preserves its real time even after acknowledged memory is evicted.
  const saved=JSON.parse(t.storage.get(SAVED))[0];t.storage.delete(KEY);const recovered=setup({storage:t.storage,lines:[line()]});recovered.reopen(saved);
  assert.equal(recovered.ctx.state.lines[0].aiActualHours,2);assert.equal(recovered.nodes.get('learningHours45_0').value,'2');
}
{
  const t=setup({lines:[line('a'),line('b')]});t.reopen();t.nodes.get('learningHours45_0').value='6';t.nodes.get('learningHours45_1').value='2';
  t.ctx.state.lines.splice(0,1);t.ctx.renderReview();assert.equal(t.nodes.get('learningHours45_0').value,'2');
  t.nodes.get('learningSaveActual45').listeners.click();assert.equal(t.ctx.state.lines[0].aiActualHours,2);assert.equal(t.entries()[0].record.line_id,'b');
}
{
  const t=setup({lines:[line('a'),line('b')]});t.reopen();t.nodes.get('learningHours45_0').value='6';t.nodes.get('learningHours45_1').value='2';
  t.ctx.state.lines.reverse();t.ctx.renderReview();assert.equal(t.nodes.get('learningHours45_0').value,'2');assert.equal(t.nodes.get('learningHours45_1').value,'6');
  const stale=t.nodes.get('learningSaveActual45').listeners.click;t.ctx.state.lines[0].aiProvenance.features.metric=30;t.ctx.renderReview();assert.equal(t.nodes.get('learningHours45_0').value,'');
  stale();assert.equal(t.entries().length,0);assert.match(t.status(),/prestation a changé/);
}
{
  const t=setup();t.reopen();t.ctx.acjLearningV45.recordActual([{line_id:'line-1',hours:2}]);const old=t.entries()[0];
  t.ctx.state.lines[0].aiProvenance.features.metric=25;t.ctx.saveQuote();assert.equal(t.entries().length,2);
  assert.equal(t.entries().find(entry=>entry.record.features.metric===15).record.actual_hours,2);
  assert.equal(t.entries().find(entry=>entry.record.features.metric===25).record.actual_hours,undefined);
  assert.equal(t.entries().find(entry=>entry.record.features.metric===15).event_id,old.event_id);
}
{
  const t=setup();t.reopen();t.nodes.get('learningHours45_0').value='6';const stale=t.nodes.get('learningSaveActual45').listeners.click;
  t.ctx.newQuote();stale();assert.equal(t.entries().length,0);assert.equal(t.nodes.has('learningActual45'),false);
}
{
  const t=setup();t.ctx.saveQuote();t.ctx.navigator.onLine=true;let respond;
  t.fetchWith(()=>new Promise(resolve=>{respond=resolve}));const flushing=t.ctx.acjLearningV45.flush();
  t.ctx.state.company='ACJ Services Lens';t.ctx.state.lines=[line('lens',{ogustProductCompany:'ACJ Services Lens'})];t.events.get('acj:company-changed')();t.ctx.saveQuote();
  respond({ok:true,json:async()=>({ok:true,configured:true,saved_count:1})});await flushing;
  assert.equal(t.entries().find(entry=>entry.company==='ACJ Services').acked,true);assert.equal(t.entries().find(entry=>entry.company==='ACJ Services Lens').acked,false);
  assert.equal(t.requests.length,1);assert.match(t.status(),/en attente/);
}
{
  const t=setup();t.ctx.patchLine('line-1','qty',4);t.ctx.patchLine('line-1','unitPriceTTC',55);t.ctx.saveQuote();assert.equal(t.entries()[0].record.retained_hours,4);
  t.ctx.patchLine('line-1','designation','Tonte du gazon');assert.equal(t.ctx.state.lines[0].aiLearningInvalidated,true);t.ctx.saveQuote();assert.equal(t.entries().length,1);
  const another=setup();another.ctx.acjOgustRates.assign(another.ctx.state.lines[0],{id:'rate-2',product:'product-2'});another.ctx.saveQuote();assert.equal(another.entries().length,0);
  const lexical=setup();lexical.ctx.state.lines[0].ogustProductLevelId='product-2';lexical.ctx.saveQuote();assert.equal(lexical.entries().length,0);assert.equal(lexical.ctx.state.lines[0].aiLearningInvalidated,true);
  const initial=setup({lines:[]});initial.ctx.state.lines.push(line());initial.ctx.acjOgustRates.assign(initial.ctx.state.lines[0],{id:'chosen-rate',product:'chosen-product'});initial.ctx.saveQuote();assert.equal(initial.entries()[0].record.ogust_product_id,'chosen-product');
}
{
  const t=setup({lines:[line('clean',{designation:'Ménage',meta:'',activity:'menage',aiProvenance:{...line().aiProvenance,mode:'menage',preset:'entretien',features:{}}})]});t.reopen();t.ctx.acjLearningV45.recordActual([{line_id:'clean',hours:2}]);const first=t.entries()[0];
  t.ctx.saveQuote();assert.equal(t.entries().length,1);assert.equal(t.entries()[0].record.actual_hours,2);assert.equal(t.entries()[0].event_id,first.event_id);
}
{
  const t=setup({lines:Array.from({length:25},(_,index)=>line(`line-${index}`))});t.ctx.saveQuote();assert.equal(t.entries().length,25);t.ctx.navigator.onLine=true;
  t.fetchWith(async request=>({ok:true,json:async()=>({ok:true,configured:true,saved_count:request.body.records.length})}));await t.ctx.acjLearningV45.flush();
  assert.deepEqual(t.requests.map(request=>request.body.records.length),[20,5]);assert.equal(new Set(t.requests.map(request=>request.body.event_id)).size,2);assert.equal(t.entries().every(entry=>entry.acked),true);
}
{
  const t=setup({lines:Array.from({length:100},(_,index)=>line(`line-${index}`))});t.ctx.saveQuote();assert.equal(t.entries().length,100);
  t.ctx.state.lines=[line('overflow')];t.ctx.saveQuote();assert.equal(t.entries().length,100);assert.equal(t.entries().some(entry=>entry.record.line_id==='overflow'),false);assert.match(t.status(),/pleine.*n’a pas été enregistré/);
}
{
  const t=setup();t.failStorage(KEY);t.ctx.saveQuote();assert.equal(t.entries().length,0);assert.match(t.status(),/locale pleine ou indisponible/);
  const hist=setup();hist.ctx.saveQuote();hist.reopen();hist.failStorage(SAVED);assert.equal(hist.ctx.acjLearningV45.recordActual([{line_id:'line-1',hours:2}]),true);
  assert.equal(hist.entries()[0].record.actual_hours,2);assert.equal(JSON.parse(hist.storage.get(SAVED))[0].lignes[0].ai_actual_hours,undefined);assert.match(hist.status(),/historique n’a pas pu/);
}
{
  const t=setup();t.ctx.saveQuote();const saved=copy(t.ctx.quotePayload());t.reopen(saved);t.ctx.state.lines[0].aiProvenance.features.metric=25;
  assert.equal(t.ctx.acjLearningV45.recordActual([{line_id:'line-1',hours:2}]),true);assert.equal(saved.lignes[0].ai_actual_hours,undefined);
  assert.equal(JSON.parse(t.storage.get(SAVED))[0].lignes[0].ai_actual_hours,undefined);
}
console.log('Learning feedback: explicit successful saves, private-data filtering, durable pending queue, idempotent chunks, context-safe real hours and scoped history persistence OK');
