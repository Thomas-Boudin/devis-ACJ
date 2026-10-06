import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('ai-v17.js','utf8');
const prefix='data:image/jpeg;base64,';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const photo=(name,profile=()=>200000)=>({name,type:'image/jpeg',profile,width:2400,height:1800});
function setup(options={}){
  const nodes=new Map(),events=new Map(),calls=[],decodes=[],encodes=[],closed=[];
  class Element{
    constructor(tag){this.tag=tag;this.listeners={};this.value='';this.disabled=false;this.clicked=0;this.classList={add(){},remove(){},toggle(){}}}
    set id(value){this._id=value;nodes.set(value,this)}get id(){return this._id}
    set innerHTML(value){this._html=value;for(const match of value.matchAll(/id="([^"]+)"/g)){const element=new Element('input');element.id=match[1]}}
    get innerHTML(){return this._html||''}
    addEventListener(name,fn){this.listeners[name]=fn}appendChild(){}insertAdjacentElement(){}click(){this.clicked++}remove(){}querySelector(){return null}
  }
  const lead=new Element('p');
  const ctx={AbortController,state:{company:'ACJ Services',number:'ACJ-2026-001',mode:'jardin',lines:[],activePreset:null,builderMethod:'hourly'},MODES:{jardin:{rate:47,vat:20,presets:[{id:'autre_jardin',kind:'custom'}]},menage:{rate:32,vat:10,presets:[{id:'autre_menage',kind:'custom'}]}},document:{head:new Element('head'),getElementById:id=>nodes.get(id),querySelector:query=>query==='section[data-step="2"]'?{querySelector:()=>lead}:null,createElement(tag){const element=new Element(tag);if(tag==='canvas'){
    element.getContext=()=>({drawImage(source){element.source=source}});
    element.toDataURL=(type,quality)=>{const bytes=element.source.file.profile(element.width,element.height,quality);encodes.push({name:element.source.file.name,width:element.width,height:element.height,quality,length:bytes,type});return prefix+'A'.repeat(Math.max(4,bytes-prefix.length))};
  }return element}},createImageBitmap:async file=>{decodes.push(file.name);const bitmap=options.decode?await options.decode(file,decodes.length):{width:file.width,height:file.height};return {...bitmap,file,close(){closed.push(file.name)}}},fetch:async(url,init)=>{calls.push({url,init});return {ok:!options.serverError,json:async()=>options.serverError?{ok:false,error:options.serverError}:{ok:true,analysis:{prestations:[]}}}},esc:value=>String(value),money:value=>String(value),renderPresets(){},renderQuoteLines(){},newQuote(){ctx.state={...ctx.state,number:'ACJ-2026-002',lines:[],activePreset:null}},setMode(mode){ctx.state.mode=mode;ctx.state.activePreset=null},addEventListener(name,fn){events.set(name,fn)}};
  if(options.textEncoder)ctx.TextEncoder=TextEncoder;
  ctx.window=ctx;vm.runInNewContext(code,ctx);
  const input=nodes.get('aiGalleryInput');
  async function select(files){input.files=files;return input.listeners.change({currentTarget:input})}
  return {ctx,nodes,events,calls,decodes,encodes,closed,select};
}
{
  const t=setup(),files=Array.from({length:10},(_,i)=>photo(`photo-${i+1}.jpg`,(width,height,quality)=>quality>.62?490000:349999));
  await t.select(files);assert.equal(t.decodes.length,10);assert.equal(t.closed.length,10);assert.match(t.nodes.get('aiPhotoCount').textContent,/10 photos ajoutées sur 10/);assert.equal((t.nodes.get('aiPhotoPreview').innerHTML.match(/aiPhotoThumb/g)||[]).length,10);
  for(const file of files){const attempts=t.encodes.filter(entry=>entry.name===file.name);assert.equal(attempts.length,2);assert.equal(attempts[1].width,1100);assert.equal(attempts[1].length,349999);assert.ok(attempts[1].quality<attempts[0].quality)}
  t.nodes.get('aiChantierText').value='庭'.repeat(2500);await t.ctx.analyseChantierAI();assert.equal(t.calls.length,1);const sent=t.calls[0].init.body,payload=JSON.parse(sent);assert.equal(payload.images.length,10);assert.ok(payload.images.every(value=>value.length<=350000));assert.ok(Buffer.byteLength(sent,'utf8')<=3600000);assert.equal(payload.description.length,2500);
  await t.select([photo('onzieme.jpg')]);assert.equal(t.decodes.length,10);assert.match(t.nodes.get('aiError').textContent,/Maximum 10/);t.ctx.openAIGallery();assert.equal(t.nodes.get('aiGalleryInput').clicked,0);
  await t.ctx.analyseChantierAI();assert.equal(JSON.parse(t.calls.at(-1).init.body).images.length,10);
}
{
  const t=setup();await t.select(Array.from({length:11},(_,i)=>photo(`${i}.jpg`)));assert.equal(t.decodes.length,0);assert.equal(t.nodes.get('aiPhotoCount').textContent,'Aucune photo ajoutée');assert.match(t.nodes.get('aiError').textContent,/sélection n’a pas été ajoutée.*10 photos/);
  await t.select([photo('premiere.jpg')]);await t.select(Array.from({length:10},(_,i)=>photo(`extra-${i}.jpg`)));assert.equal(t.decodes.length,1);assert.match(t.nodes.get('aiPhotoCount').textContent,/1 photo ajoutée sur 10/);assert.match(t.nodes.get('aiError').textContent,/reste 9 places/);
}
{
  const t=setup();await t.select([photo('dense.jpg',(width,height,quality)=>width<=768&&quality<=.40?349999:470000)]);const attempts=t.encodes.filter(entry=>entry.name==='dense.jpg');assert.equal(attempts.length,9);assert.equal(attempts.at(-1).width,768);assert.equal(attempts.at(-1).quality,.40);assert.equal(t.closed.length,1);assert.match(t.nodes.get('aiPhotoCount').textContent,/1 photo/);
  await t.select([photo('bonne.jpg'),photo('trop-dense.jpg',()=>350001)]);assert.match(t.nodes.get('aiError').textContent,/sélection n’a pas été ajoutée.*trop lourde/);assert.match(t.nodes.get('aiPhotoCount').textContent,/1 photo ajoutée/);assert.equal(t.closed.length,3);await t.ctx.analyseChantierAI();assert.equal(JSON.parse(t.calls[0].init.body).images.length,1);
}
{
  const t=setup();await t.select([photo('ancienne.jpg')]);await t.select([photo('valide.jpg'),{name:'texte.txt',type:'text/plain'}]);assert.match(t.nodes.get('aiError').textContent,/sélection n’a pas été ajoutée.*pas une image/);assert.match(t.nodes.get('aiPhotoCount').textContent,/1 photo ajoutée/);
}
for(const textEncoder of [false,true]){
  const t=setup({textEncoder});await t.select(Array.from({length:10},(_,i)=>photo(`${i}.jpg`,()=>350000)));t.nodes.get('aiChantierText').value='庭'.repeat(2500);t.ctx.state.company='庭'.repeat(40000);await t.ctx.analyseChantierAI();assert.equal(t.calls.length,0);assert.match(t.nodes.get('aiError').textContent,/trop volumineux/);assert.equal(t.nodes.get('aiAnalyseBtn').disabled,false);
  t.ctx.state.company='ACJ Services';t.nodes.get('aiChantierText').value='x'.repeat(2501);await t.ctx.analyseChantierAI();assert.equal(t.calls.length,0);assert.match(t.nodes.get('aiError').textContent,/2 500 caractères/);
}
{
  let release;const t=setup({decode:(file,order)=>order===2?new Promise(resolve=>{release=resolve}):{width:file.width,height:file.height}});const batch=t.select([photo('une.jpg'),photo('deux.jpg')]);await tick();assert.equal(t.decodes.length,2);assert.match(t.nodes.get('aiPhotoCount').textContent,/Préparation de 2 photos/);assert.equal(t.nodes.get('aiPhotoPreview').innerHTML,'');assert.equal(t.nodes.get('aiAnalyseBtn').disabled,true);assert.equal(t.nodes.get('aiCameraBtn').disabled,true);
  await t.ctx.analyseChantierAI();assert.equal(t.calls.length,0);assert.match(t.nodes.get('aiError').textContent,/Attends la préparation/);await t.select([photo('concurrente.jpg')]);assert.equal(t.decodes.length,2);assert.match(t.nodes.get('aiError').textContent,/sélection n’a pas été ajoutée/);t.ctx.openAICamera();assert.equal(t.nodes.get('aiCameraInput').clicked,0);
  release({width:2400,height:1800});await batch;assert.match(t.nodes.get('aiPhotoCount').textContent,/2 photos ajoutées/);assert.match(t.nodes.get('aiError').textContent,/sélection n’a pas été ajoutée/);assert.equal(t.nodes.get('aiAnalyseBtn').disabled,false);await t.ctx.analyseChantierAI();assert.equal(JSON.parse(t.calls[0].init.body).images.length,2);assert.equal(t.nodes.get('aiPhotoPreview').innerHTML.includes('Photo 3'),false);
}
for(const action of ['quote','company','mode','text','remove']){
  let release;const t=setup({decode:(file,order)=>order===2?new Promise(resolve=>{release=resolve}):{width:file.width,height:file.height}});await t.select([photo('existante.jpg')]);const batch=t.select([photo('retardee.jpg')]);await tick();
  if(action==='quote')t.ctx.newQuote();if(action==='company'){t.ctx.state.company='ACJ Services Lens';t.events.get('acj:company-changed')()}if(action==='mode')t.ctx.setMode('menage');if(action==='text'){t.nodes.get('aiChantierText').value='Chantier modifié';t.nodes.get('aiChantierText').listeners.input()}if(action==='remove')t.ctx.removeAIPhoto(0);
  assert.equal(t.nodes.get('aiAnalyseBtn').disabled,false);assert.equal(t.nodes.get('aiGalleryBtn').disabled,false);assert.equal(t.nodes.get('aiPhotoCount').textContent.includes('Préparation'),false);release({width:2400,height:1800});await batch;assert.equal(t.nodes.get('aiPhotoPreview').innerHTML.includes('Photo 2'),false);assert.equal(t.nodes.get('aiAnalyseBtn').disabled,false);const expected=['quote','company','remove'].includes(action)?'Aucune photo ajoutée':/1 photo ajoutée/;if(typeof expected==='string')assert.equal(t.nodes.get('aiPhotoCount').textContent,expected);else assert.match(t.nodes.get('aiPhotoCount').textContent,expected);
}
{
  let release;const t=setup({decode:(file,order)=>order===1?new Promise(resolve=>{release=resolve}):{width:file.width,height:file.height}});const obsolete=t.select([photo('obsolete.jpg')]);await tick();t.ctx.newQuote();await t.select([photo('nouvelle.jpg')]);release({width:2400,height:1800});await obsolete;assert.match(t.nodes.get('aiPhotoCount').textContent,/1 photo ajoutée/);assert.equal(t.encodes.some(entry=>entry.name==='obsolete.jpg'),false);await t.ctx.analyseChantierAI();assert.equal(JSON.parse(t.calls[0].init.body).images.length,1);
}
for(const [error,message] of [['TOO_MANY_IMAGES',/Maximum 10/],['INVALID_IMAGES',/pas compatible/],['IMAGE_TOO_LARGE',/trop volumineuse/],['PAYLOAD_TOO_LARGE',/trop volumineux/],['DESCRIPTION_TOO_LONG',/2 500 caractères/]]){
  const t=setup({serverError:error});t.nodes.get('aiChantierText').value='Jardinage 4 heures';await t.ctx.analyseChantierAI();assert.match(t.nodes.get('aiError').textContent,message);
}
console.log('Photos: ten retained/sent within UTF-8 budget; explicit excess/errors; progressive 1100→768 JPEG; atomic/concurrent batches and stale decode cancellation OK');
