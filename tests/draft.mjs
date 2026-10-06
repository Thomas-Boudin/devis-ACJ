import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync('draft-v42.js','utf8');
function environment(stored=null){
 const storage=new Map(stored?Object.entries(stored):[]),events={},nodes=new Map();
 const ids=['client','tel','adresse','notes','aiChantierText','noteText','builderDesignation','builderHours','builderRate','builderFlat','builderMetric','quoteNumberTop'];
 for(const id of ids)nodes.set(id,{value:'',textContent:''});
 const state={step:2,number:'ACJ-TEST-1',company:'ACJ Services',client:'',tel:'',address:'',mode:'jardin',activePreset:null,builderMethod:'hourly',lines:[],notes:''};
 let selected=null,choiceMode='new',savesFail=false;
 const ctx={state,COMPANIES:['ACJ Services','ACJ Services Lens'],MODES:{jardin:{}},JSON,Number,setTimeout,clearTimeout,queueMicrotask,
 document:{readyState:'complete',getElementById:id=>nodes.get(id),createElement(){return{style:{},setAttribute(){},set id(id){nodes.set(id,this)}}},querySelector(){return{appendChild(){}}},addEventListener(name,fn){events[name]=fn}},
 localStorage:{getItem:key=>storage.get(key)||null,setItem(key,v){if(savesFail)throw Error('quota');storage.set(key,v)},removeItem:key=>storage.delete(key)},
 addEventListener(name,fn){events[name]=fn},dispatchEvent(){},CustomEvent:class{constructor(name,args){this.type=name;this.detail=args?.detail}},
 syncClient(){state.client=nodes.get('client').value;state.tel=nodes.get('tel').value;state.address=nodes.get('adresse').value},syncNotes(){state.notes=nodes.get('notes').value},
 get ogustClientChoiceV21(){return{mode:choiceMode,selected,company:state.company}},restoreOgustDraftClientV42(choice){choiceMode=choice.mode;selected=choice.selected},
 renderCompanies(){},renderModes(){},renderServiceBuilder(){},renderQuoteLines(){},goStep(n){state.step=n===3?2:n},setMode(){},setCompany(n){state.company=n;selected=null},setHours(){},setBuilderMethod(){},
 newQuote(){Object.assign(state,{number:'ACJ-TEST-2',step:1,client:'',tel:'',address:'',lines:[],notes:'',activePreset:null});for(const id of ['client','tel','adresse','notes'])nodes.get(id).value='';selected=null},
 acjOgustPicker:{getDraft(){return{company:state.company,rateId:'rate1'}},restoreDraft(d){ctx.restoredPicker=d}}};ctx.window=ctx;
 vm.runInNewContext(code,ctx);
 return {ctx,state,nodes,storage,events,select(c){selected=c;choiceMode='existing'},fail(){savesFail=true}};
}
const settle=()=>new Promise(r=>setImmediate(r));
const a=environment();await settle();a.select({id_customer:'exact1',label:'Alex Test'});a.nodes.get('client').value='Alex Test';a.nodes.get('aiChantierText').value='Tailler saule';a.nodes.get('builderDesignation').value='Travaux à finir';a.nodes.get('builderHours').value='3';
a.state.lines=[{id:'line1',designation:'Taille',qty:3,unit:'h',unitPriceTTC:55,vat:20,ogustRateId:'rate1',ogustProductCompany:'ACJ Services',aiProvenance:{durationConfirmed:true,description:'Tailler saule'}}];
a.ctx.acjDraftV42.save();const key=a.ctx.acjDraftV42.key;const saved=JSON.parse(a.storage.get(key));assert.equal(saved.clientChoice.selected.id_customer,'exact1');assert.equal(saved.state.lines[0].aiProvenance.description,'Tailler saule');
const b=environment(Object.fromEntries(a.storage));await settle();assert.equal(b.state.step,2);assert.equal(b.state.number,'ACJ-TEST-1');assert.equal(b.ctx.ogustClientChoiceV21.selected.id_customer,'exact1');assert.equal(b.state.lines[0].unitPriceTTC,55);assert.equal(b.nodes.get('aiChantierText').value,'Tailler saule');assert.equal(b.nodes.get('builderHours').value,'3');assert.equal(b.ctx.restoredPicker.rateId,'rate1');
b.ctx.setCompany('ACJ Services Lens');b.ctx.acjDraftV42.save();assert.equal(JSON.parse(b.storage.get(key)).clientChoice.selected,null);
b.ctx.newQuote();b.ctx.acjDraftV42.save();assert.equal(b.storage.has(key),false);assert.equal(b.nodes.get('aiChantierText').value,'');assert.equal(b.state.lines.length,0);
const corrupt=environment({[key]:'{bad'});await settle();assert.equal(corrupt.state.number,'ACJ-TEST-1');
a.fail();a.nodes.get('client').value='Edited';a.ctx.acjDraftV42.save();assert.match(a.nodes.get('draftStatus42').textContent,/impossible/);
console.log('Draft: reload preserves selected client, lines/provenance, notes, unadded builder; company isolation, reset, invalid storage and quota handled');
