import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const nodes=new Map(),selectors=new Map(),domEvents={};
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.value='';this.textContent='';this.removed=false;this.parentElement=null}
  set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
  append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x)}}
  replaceChildren(){this.children=[];this.textContent=''}
  setAttribute(){}insertAdjacentElement(where,node){this.inserted={where,node}}
  scrollIntoView(){this.scrolled=true}
  querySelector(query){return query==='label'?this.label:null}
  remove(){this.removed=true}
}
for(const id of ['presetChoices','serviceBuilder']){const e=new Element('div');e.id=id}
const rates=[
  {id:'hour',product:'garden',title:"Jardinage à l'heure",unit:'H',vat:20,price:47},
  {id:'flat',product:'flat',title:'Forfait Jardin',unit:'F',vat:20,price:90},
  {id:'unit',product:'unit',title:'Option Jardi',unit:'Q',vat:20,price:1.2},
  {id:'km',product:'travel',title:'Frais de déplacements',unit:'K',vat:20,price:.7},
  {id:'clean',product:'clean',title:'Entretien régulier du logement',unit:'H',vat:10,price:32},
  {id:'pro',product:'pro',title:'Ménage professionnel',unit:'H',vat:20,price:32},
  {id:'bricol',product:'bricol',title:'Petit Bricolage',unit:'H',vat:10,price:52},
  {id:'generic',product:'generic',title:'Nettoyage de vitres',unit:'H',vat:20,price:35},
];
const state={mode:'jardin',company:'ACJ Services',activePreset:null,builderMethod:'hourly',lines:[]};let renders=0;const events={},dispatched=[];
function field(id,value,label){const e=new Element('input');e.id=id;e.value=value;const parent=new Element('div');parent.label=new Element('label');parent.label.textContent=label;parent.append(e);return e}
const ctx={state,MODES:Object.fromEntries(['jardin','menage','bricol','nettoyagePro'].map(mode=>[mode,{presets:[{id:'autre_'+mode,kind:'custom'}]}])),CustomEvent:class{constructor(type){this.type=type}},
  document:{readyState:'complete',createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id),querySelector:selector=>selector==='#ogPicker41 input'?nodes.get('ogPicker41')?.children.find(x=>x.tag==='input'):selectors.get(selector),addEventListener:(name,fn)=>{domEvents[name]=fn}},
  acjOgustRates:{rates,load:async()=>true,assign(l,r){Object.assign(l,{ogustRateId:r.id,ogustProductLevelId:r.product,ogustProductCompany:state.company})}},
  choosePreset(id){state.activePreset=id;state.builderMethod='hourly';ctx.renderServiceBuilder()},
  renderServiceBuilder(){
    for(const id of ['builderDesignation','builderRate','builderFlat','builderHours'])nodes.delete(id);
    field('builderDesignation','','Désignation');
    if(state.builderMethod==='flat')field('builderFlat','','Montant forfaitaire TTC');
    else{field('builderRate','47','Tarif TTC / h');field('builderHours','1',"Nombre d’heures")}
    for(const name of ['quickHours','methodTitle','methodGrid','ogpsBadge'])selectors.set('#serviceBuilder .'+name,new Element('div'));
  },
  addBuiltService(){const flat=state.builderMethod==='flat',qty=flat?1:Number(nodes.get('builderHours').value);if(qty<=0)return;state.lines.push({qty,unit:flat?'forfait':'h',unitPriceTTC:Number(nodes.get(flat?'builderFlat':'builderRate').value),vat:10,type:'service',activity:state.mode,meta:flat?'Forfait':`${qty} h de main-d’œuvre`,pricingMethod:state.builderMethod});state.activePreset=null;for(const id of ['builderDesignation','builderRate','builderFlat','builderHours'])nodes.delete(id)},
  renderQuoteLines(){renders++},setMode(mode){state.mode=mode;state.activePreset=null},newQuote(){state.activePreset=null;state.lines=[]},goStep(){},
  addEventListener(name,fn){events[name]=fn},dispatchEvent(event){dispatched.push(event.type)},
};ctx.window=ctx;
vm.runInNewContext(fs.readFileSync('ogust-picker-v41.js','utf8'),ctx);await new Promise(r=>setImmediate(r));
const box=nodes.get('ogPicker41'),input=box.children.find(x=>x.tag==='input');
function search(query){input.value=query;input.oninput();return nodes.get('ogPickerResults41').children}
function select(query){const buttons=search(query);assert.equal(buttons.length,1,query);buttons[0].onclick()}
function label(id){return nodes.get(id).parentElement.label.textContent}
assert.equal(nodes.get('serviceBuilder').inserted.node,box,'Picker anchors to the visible builder, not the collapsed presets');
assert.equal(search('logement').length,0,'Domestic cleaning is excluded in gardening');
assert.equal(search('professionnel').length,0,'Professional cleaning is excluded in gardening');
assert.equal(search('bricolage').length,0);
assert.equal(search('vitres').length,1,'Ambiguous services remain searchable');
assert.equal(search('déplacement').length,1,'Generic costs remain searchable');
select('jard heure');assert.equal(nodes.get('builderRate').value,'47');
nodes.get('builderHours').value='3';nodes.get('builderRate').value='55';nodes.get('builderDesignation').value='Taille du saule et nettoyage';
ctx.renderServiceBuilder();assert.equal(nodes.get('builderHours').value,'3');assert.equal(nodes.get('builderRate').value,'55');assert.equal(nodes.get('builderDesignation').value,'Taille du saule et nettoyage');
ctx.addBuiltService();let line=state.lines.at(-1);assert.equal(line.qty,3);assert.equal(line.unitPriceTTC,55);assert.equal(line.designation,'Taille du saule et nettoyage');assert.equal(line.vat,20);assert.equal(line.ogustRateId,'hour');
select('forfait');assert.equal(state.builderMethod,'flat');assert.equal(nodes.get('builderFlat').value,'90');nodes.get('builderFlat').value='125';ctx.renderServiceBuilder();assert.equal(nodes.get('builderFlat').value,'125');ctx.addBuiltService();line=state.lines.at(-1);assert.equal(line.unit,'forfait');assert.equal(line.unitPriceTTC,125);assert.equal(line.ogustRateId,'flat');
select('option');assert.equal(label('builderHours'),'Quantité (unité)');assert.equal(label('builderRate'),'Tarif TTC / unité');assert.equal(nodes.get('builderHours').step,'1');assert.equal(selectors.get('#serviceBuilder .quickHours').removed,true);assert.equal(selectors.get('#serviceBuilder .methodGrid').removed,true);nodes.get('builderHours').value='2';ctx.addBuiltService();line=state.lines.at(-1);assert.equal(line.unit,'unité');assert.equal(line.meta,'2 unité');assert.equal(line.pricingMethod,'quantity');assert.equal(line.ogustRateId,'unit');
select('déplacement');assert.equal(label('builderHours'),'Quantité (km)');assert.equal(label('builderRate'),'Tarif TTC / km');nodes.get('builderHours').value='12.5';ctx.addBuiltService();line=state.lines.at(-1);assert.equal(line.unit,'km');assert.equal(line.meta,'12.5 km');assert.equal(line.type,'cost');assert.equal(line.activity,'jardin');assert.equal(line.unitPriceTTC,.7);
ctx.setMode('menage');await new Promise(r=>setImmediate(r));assert.equal(search('jardin').length,0);assert.equal(search('professionnel').length,0);select('logement');assert.equal(nodes.get('builderRate').value,'32');assert.equal(state.mode,'menage');
ctx.setMode('nettoyagePro');await new Promise(r=>setImmediate(r));assert.equal(search('logement').length,0);select('professionnel');assert.equal(state.mode,'nettoyagePro');
ctx.setMode('jardin');await new Promise(r=>setImmediate(r));select('jard heure');nodes.get('builderHours').value='2.5';nodes.get('builderRate').value='49';nodes.get('builderDesignation').value='Visite Laurent';
const draft=JSON.parse(JSON.stringify(ctx.acjOgustPicker.getDraft()));assert.equal(draft.selected.rateId,'hour');assert.equal(draft.company,'ACJ Services');assert.equal(draft.search,'jard heure');
ctx.newQuote();assert.equal(await ctx.acjOgustPicker.restoreDraft(draft),true);assert.equal(nodes.get('builderHours').value,'2.5');assert.equal(nodes.get('builderRate').value,'49');assert.equal(nodes.get('builderDesignation').value,'Visite Laurent');assert.equal(input.value,'jard heure');
assert.equal(await ctx.acjOgustPicker.restoreDraft({...draft,selected:{...draft.selected,product:'wrong-account-product'}}),false,'Do not restore an unverified catalogue reference');
state.company='ACJ Services Lens';events['acj:company-changed']();assert.equal(await ctx.acjOgustPicker.restoreDraft(draft),false,'No draft crosses Ogust accounts');ctx.addBuiltService();assert.equal(state.lines.at(-1).ogustRateId,undefined);
// Pending restoration cannot overwrite either a company switch or fresh edits.
state.company='ACJ Services';events['acj:company-changed']();let resolveLoad;ctx.acjOgustRates.load=()=>new Promise(resolve=>{resolveLoad=resolve});let pending=ctx.acjOgustPicker.restoreDraft(draft);const resolveRestore=resolveLoad;state.company='ACJ Services Lens';events['acj:company-changed']();resolveRestore(true);assert.equal(await pending,false);
state.company='ACJ Services';events['acj:company-changed']();pending=ctx.acjOgustPicker.restoreDraft(draft);field('builderHours','6',"Nombre d’heures");domEvents.input({target:nodes.get('builderHours')});resolveLoad(true);assert.equal(await pending,false);assert.equal(nodes.get('builderHours').value,'6');
ctx.acjOgustRates.load=async()=>true;ctx.choosePreset('autre_jardin');nodes.get('builderDesignation').value='Travail libre';nodes.get('builderHours').value='7';const genericDraft=JSON.parse(JSON.stringify(ctx.acjOgustPicker.getDraft()));assert.equal(genericDraft.selected,null);ctx.newQuote();assert.equal(await ctx.acjOgustPicker.restoreDraft(genericDraft),true);assert.equal(nodes.get('builderHours').value,'7');assert.equal(nodes.get('builderDesignation').value,'Travail libre');
assert.ok(dispatched.includes('acj:ogust-picker-changed'));assert.ok(renders>=4);
console.log('Ogust picker: retained edits, actual unit labels/details, trade filtering, generic costs and account-safe verified drafts OK');
