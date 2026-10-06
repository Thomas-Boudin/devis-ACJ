import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('ai-v17.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
  const nodes=new Map(),events=new Map(),requests=[];let notice=null;
  class Element{
    constructor(tag){this.tag=tag;this.listeners={};this.value='';this.checked=false;this.textContent='';this.classList={add(){},remove(){},toggle(){}}}
    set id(value){this._id=value;nodes.set(value,this)}get id(){return this._id}
    set innerHTML(value){this._html=value;for(const match of value.matchAll(/id="([^"]+)"/g)){const element=new Element('input');element.id=match[1]}}
    get innerHTML(){return this._html||''}
    appendChild(){}addEventListener(name,fn){this.listeners[name]=fn}scrollIntoView(){}focus(){this.focused=true}
    querySelector(query){if(query==='.aiBuilderNotice')return notice;if(query==='.serviceHead')return {insertAdjacentElement(position,value){notice=value}};return null}
    insertAdjacentElement(){}remove(){if(notice===this)notice=null;nodes.delete('aiDurationConfirm')}
  }
  const head=new Element('head'),lead=new Element('p'),step={querySelector:()=>lead};
  for(const id of ['serviceBuilder','aiPhotoCount']){const element=new Element('div');element.id=id}
  let card=null;
  const ctx={AbortController,state:{company:'ACJ Services',number:'ACJ-2026-001',mode:'jardin',lines:[],activePreset:null,builderMethod:'hourly'},MODES:{jardin:{label:'Jardinage',rate:47,vat:20,presets:[{id:'haie',kind:'surface',label:'Haie'},{id:'autre_jardin',kind:'custom',label:'Autre'}]},menage:{label:'Ménage',rate:32,vat:10,presets:[{id:'autre_menage',kind:'custom',label:'Autre'}]}},document:{head,createElement(tag){const e=new Element(tag);if(tag==='canvas'){e.getContext=()=>({drawImage(){}});e.toDataURL=()=> 'data:image/jpeg;base64,AA=='}return e},getElementById:id=>nodes.get(id),querySelector(query){if(query==='section[data-step="2"]')return step;if(query==='#serviceBuilder .builderCard')return card;if(query==='#serviceBuilder .aiBuilderNotice')return notice;return null}},esc:value=>String(value),money:value=>`${value} €`,uid:()=>`line-${ctx.state.lines.length}`,fetch(url,init){return new Promise(resolve=>requests.push({url,init,resolve}))},setMode(mode){ctx.state.mode=mode;ctx.state.activePreset=null;card=null},choosePreset(preset){ctx.state.activePreset=preset;ctx.renderServiceBuilder()},setBuilderMethod(method){ctx.state.builderMethod=method;ctx.renderServiceBuilder()},renderPresets(){},renderQuoteLines(){},renderServiceBuilder(){
    notice=null;nodes.delete('aiDurationConfirm');card=new Element('div');
    for(const id of ['builderHours','builderRate','builderFlat','builderDesignation','builderMetric','detailMetric','detailHeight','detailFaces','detailTop','detailCutType','detailWaste','detailGrass','detailCollection','detailDensity','detailZone','detailMethod','detailSupport','detailExtra']){const element=new Element('input');element.id=id;element.value=id==='builderHours'?'1':id==='builderRate'?'47':''}
  },addBuiltService(){if(!ctx.state.activePreset)return;const qty=Number(nodes.get('builderHours').value);if(!(qty>0))return;ctx.state.lines.push({id:ctx.uid(),type:'service',qty,unit:'h',unitPriceTTC:Number(nodes.get('builderRate').value)});ctx.state.activePreset=null;card=null;notice=null;nodes.delete('aiDurationConfirm')},quotePayload(){return {lignes:ctx.state.lines.map(line=>({designation:line.designation,quantite:line.qty}))}},newQuote(){ctx.state={...ctx.state,number:'ACJ-2026-002',lines:[],activePreset:null};card=null;return 'new'},addEventListener(name,fn){events.set(name,fn)},createImageBitmap:async()=>({width:100,height:100,close(){}})};ctx.window=ctx;
  vm.runInNewContext(source,ctx);
  const text=nodes.get('aiChantierText');
  function respond(request,proposal,extras={}){request.resolve({ok:true,json:async()=>({ok:true,analysis:{prestations:[{mode:'jardin',preset:'autre_jardin',designation:'Entretien',pricing_method:'hourly',hours:0,estimated_hours_suggested:0,missing_fields:[],...proposal}],...extras}})})}
  async function analyse(textValue,proposal){text.value=textValue;const run=ctx.analyseChantierAI();respond(requests.at(-1),proposal);await run}
  return {ctx,nodes,events,requests,text,respond,analyse};
}
{
  const t=setup();t.text.value='Jardinage 4 h';const run=t.ctx.analyseChantierAI();t.text.value='Jardinage 2 h';t.text.listeners.input();t.respond(t.requests[0],{hours:4});await run;
  assert.equal(t.nodes.get('aiResult').innerHTML,'');t.ctx.applyAIProposal(0);assert.equal(t.ctx.state.activePreset,null);
}
for(const change of ['company','mode','quote']){
  const t=setup();t.text.value='Jardinage 4 h';const run=t.ctx.analyseChantierAI();
  if(change==='company'){t.ctx.state.company='ACJ Services Lens';t.events.get('acj:company-changed')()}
  if(change==='mode')t.ctx.setMode('menage');if(change==='quote')t.ctx.newQuote();
  t.respond(t.requests[0],{hours:4});await run;assert.equal(t.nodes.get('aiResult').innerHTML,'');
  if(change!=='mode')assert.equal(t.text.value,'');
}
{
  const t=setup();t.text.value='Ancien chantier';const older=t.ctx.analyseChantierAI();t.text.value='Jardinage 4 h';const newer=t.ctx.analyseChantierAI();
  t.respond(t.requests[1],{hours:4});await newer;t.respond(t.requests[0],{hours:9});await older;t.ctx.applyAIProposal(0);assert.equal(t.nodes.get('builderHours').value,4);
  assert.equal(JSON.parse(t.requests[1].init.body).company,'ACJ Services');assert.equal(t.nodes.get('aiResult').innerHTML.includes('Saisi'),true);
}
{
  const t=setup();await t.analyse('Tailler les arbustes', {estimated_hours_suggested:1.75,estimated_hours_min:1,estimated_hours_max:3,estimation_confidence:.99,confidence:.99});
  assert.equal(t.nodes.get('aiResult').innerHTML.includes('99 %'),false);t.ctx.applyAIProposal(0);assert.equal(t.nodes.get('builderHours').value,2);
  t.ctx.addBuiltService();assert.equal(t.ctx.state.lines.length,0);assert.match(t.nodes.get('aiError').textContent,/Confirme/);
  t.nodes.get('aiDurationConfirm').checked=true;t.ctx.renderServiceBuilder();assert.equal(t.nodes.get('builderHours').value,2);assert.equal(t.nodes.get('aiDurationConfirm').checked,true);
  t.ctx.addBuiltService();assert.equal(t.ctx.state.lines.length,1);assert.equal(t.ctx.state.lines[0].aiProvenance.durationConfirmed,true);assert.equal(t.ctx.state.lines[0].aiProvenance.status,'estimation_confirmee');
  const payload=t.ctx.quotePayload();assert.equal(payload.lignes[0].ai_provenance.description,'Tailler les arbustes');assert.equal(t.ctx.acjAIReadiness().ok,true);
}
{
  const t=setup();await t.analyse('Haie à tailler', {estimated_hours_suggested:4,missing_fields:['Longueur','Hauteur'],metric:20,metric_unit:'ml',height_m:2,rate_ttc:99});t.ctx.applyAIProposal(0);
  assert.equal(t.nodes.get('builderHours').value,'');assert.equal(t.nodes.get('detailMetric').value,'');assert.equal(t.nodes.get('detailHeight').value,'');assert.equal(t.nodes.get('builderRate').value,'47');
  t.ctx.addBuiltService();assert.equal(t.ctx.state.lines.length,0);t.nodes.get('builderHours').value='3';t.ctx.addBuiltService();assert.equal(t.ctx.state.lines[0].qty,3);assert.equal(t.ctx.state.lines[0].aiPendingFields.join(','),'Longueur,Hauteur');assert.equal(t.ctx.acjAIReadiness().missing.length,1);
  assert.equal(t.ctx.quotePayload().lignes[0].ai_pending_fields.join(','),'Longueur,Hauteur');
  t.ctx.state.lines[0].aiProvenance.durationConfirmed=false;assert.equal(t.ctx.acjAIReadiness().ok,false);
}
{
  const t=setup();await t.analyse('Jardinage 4 h à 47 €/h, haie 20 ml de hauteur 2 m', {hours:4,rate_ttc:47,metric:20,metric_unit:'ml',height_m:2,missing_fields:['Largeur']});t.ctx.applyAIProposal(0);
  assert.equal(t.nodes.get('builderHours').value,4);assert.equal(t.nodes.get('builderRate').value,47);assert.equal(t.nodes.get('detailMetric').value,20);assert.equal(t.nodes.get('detailHeight').value,2);assert.equal(t.nodes.has('aiDurationConfirm'),false);t.ctx.addBuiltService();assert.equal(t.ctx.state.lines.length,1);
}
{
  const t=setup();const input=t.nodes.get('aiCameraInput');input.files=[{name:'jardin.jpg',type:'image/jpeg'}];await input.listeners.change({currentTarget:input});assert.match(t.nodes.get('aiPhotoCount').textContent,/1 photo/);
  const run=t.ctx.analyseChantierAI();t.respond(t.requests.at(-1),{hours:8,estimated_hours_suggested:8,metric:80,metric_unit:'m²',height_m:2,visual_metric_min:60,visual_metric_max:100,visual_metric_unit:'m²'});await run;t.ctx.applyAIProposal(0);
  assert.equal(t.nodes.get('builderHours').value,'');assert.equal(t.nodes.get('detailMetric').value,'');assert.equal(t.nodes.get('detailHeight').value,'');
  t.ctx.newQuote();assert.equal(t.text.value,'');assert.equal(t.nodes.get('aiPhotoCount').textContent,'Aucune photo ajoutée');assert.equal(t.nodes.get('aiResult').innerHTML,'');
}
{
  const t=setup();await t.analyse('Tailler les arbustes',{estimated_hours_suggested:2});t.ctx.applyAIProposal(0);t.text.value='Nouveau chantier';t.text.listeners.input();assert.equal(t.ctx.state.activePreset,null);t.ctx.addBuiltService();assert.equal(t.ctx.state.lines.length,0);
}
console.log('AI reliability: stale text/company/mode/quote/photos, duplicate requests, duration confirmation, explicit values and persisted provenance OK');
{
  const original=setup();original.text.value='Tailler les arbustes';const camera=original.nodes.get('aiCameraInput');camera.files=[{name:'chantier.jpg',type:'image/jpeg'}];await camera.listeners.change({currentTarget:camera});
  await original.analyse('Tailler les arbustes',{estimated_hours_suggested:2.5,missing_fields:[]});original.ctx.applyAIProposal(0);original.nodes.get('aiDurationConfirm').checked=true;
  const saved=JSON.parse(JSON.stringify(original.ctx.acjAIDraftV42.get()));assert.equal(saved.photoCount,1);assert.equal(saved.prefilledHours,2.5);
  const resumed=setup();resumed.text.value=saved.text;resumed.ctx.state.activePreset=saved.preset;resumed.ctx.state.builderMethod=saved.method;resumed.ctx.renderServiceBuilder();resumed.nodes.get('builderHours').value='2.5';
  assert.equal(resumed.ctx.acjAIDraftV42.restore({...saved,company:'ACJ Services Lens'}),false);assert.equal(resumed.ctx.acjAIDraftV42.restore({...saved,text:'Une autre visite'}),false);
  assert.equal(resumed.ctx.acjAIDraftV42.restore(saved),true);assert.equal(resumed.nodes.get('aiDurationConfirm').checked,false);assert.equal(resumed.nodes.get('aiPhotoCount').textContent,'Aucune photo ajoutée');
  resumed.ctx.addBuiltService();assert.equal(resumed.ctx.state.lines.length,0);resumed.ctx.renderServiceBuilder();assert.equal(resumed.nodes.get('builderHours').value,'2.5');assert.equal(resumed.nodes.get('aiDurationConfirm').checked,false);
  resumed.nodes.get('aiDurationConfirm').checked=true;resumed.ctx.addBuiltService();assert.equal(resumed.ctx.state.lines.length,1);assert.equal(resumed.ctx.state.lines[0].aiProvenance.photoCount,1);assert.equal(resumed.ctx.state.lines[0].aiProvenance.description,'Tailler les arbustes');assert.equal(resumed.ctx.state.lines[0].aiProvenance.durationConfirmed,true);
}
console.log('AI draft reload: matching quote only, estimated duration re-confirmed, provenance kept without storing images OK');
{
  const t=setup();let finishBitmap;t.ctx.createImageBitmap=()=>new Promise(resolve=>{finishBitmap=resolve});const camera=t.nodes.get('aiCameraInput');camera.files=[{name:'ancien.jpg',type:'image/jpeg'}];const decoding=camera.listeners.change({currentTarget:camera});t.ctx.newQuote();finishBitmap({width:100,height:100,close(){}});await decoding;assert.equal(t.nodes.get('aiPhotoCount').textContent,'Aucune photo ajoutée');
}
{
  const t=setup(),camera=t.nodes.get('aiCameraInput');camera.files=[{name:'chantier.jpg',type:'image/jpeg'}];await camera.listeners.change({currentTarget:camera});t.text.value='Haie à tailler';const run=t.ctx.analyseChantierAI();t.ctx.removeAIPhoto(0);t.respond(t.requests.at(-1),{estimated_hours_suggested:3});await run;assert.equal(t.nodes.get('aiResult').innerHTML,'');
}
{
  const t=setup();await t.analyse('Tailler les arbustes',{estimated_hours_suggested:2});t.ctx.applyAIProposal(0);t.nodes.get('aiDurationConfirm').checked=true;t.text.value='Texte modifié par un autre module';t.ctx.addBuiltService();assert.equal(t.ctx.state.lines.length,0);assert.equal(t.ctx.state.activePreset,null);
}
console.log('AI races: photo decoding/reset, photo removal in flight, programmatic text changes reject obsolete proposals OK');
