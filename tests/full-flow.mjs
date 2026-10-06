// Complete production-script integration with a local DOM and fully mocked APIs.
// Install jsdom separately, then set ACJ_DOM_TEST_DEPS to its node_modules path.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const deps=path.resolve(here,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'acj-dom-test.cjs'));
const {JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const customer={id_customer:'known-42',label:'Alex Test',phone:'0700000000',email:'client-test@example.com',address:'8 rue du Test, 59134 Marquillies',zip:'59134',city:'Marquillies',code:'CLI42'};
const rates=[{id:'rate-garden',product:'prod-garden',title:"Jardinage à l'heure",unit:'H',vat:20,price:47},{id:'rate-clean',product:'prod-clean',title:'Entretien régulier du logement',unit:'H',vat:10,price:32}];
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,description){for(let i=0;i<120;i++){if(fn())return;await wait(20)}throw new Error(`Timed out: ${description}`)}
class LocalScripts extends ResourceLoader{
  fetch(url){const u=new URL(url);if(u.origin==='https://thomas-boudin.github.io'&&u.pathname.startsWith('/devis-ACJ/')&&u.pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,u.pathname.slice('/devis-ACJ/'.length))));return null}
}
async function boot(saved={},options={}){
  const errors=[],calls=[],alerts=[],recognitions=[];let aiResponse=null,aiHold=null;
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...items)=>errors.push(new Error(items.map(String).join(' '))));
  const dom=new JSDOM(html,{url:'https://thomas-boudin.github.io/devis-ACJ/?v=45',resources:new LocalScripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
    w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
    w.alert=message=>alerts.push(String(message));w.confirm=()=>false;
    if(options.voice)w.SpeechRecognition=class {
      constructor(){this.live=false;this.stops=0;this.aborts=0;recognitions.push(this)}
      start(){this.live=true;this.onstart?.()}
      stop(){this.live=false;this.stops++;this.onend?.()}
      abort(){this.live=false;this.aborts++;this.onend?.()}
      result(text,isFinal=false,index=0){const result=[{transcript:text,confidence:.9}];result.isFinal=isFinal;result.item=i=>result[i];const results=[result];results.item=i=>results[i];this.onresult?.({resultIndex:index,results})}
    };
    for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
    w.fetch=async(input,init={})=>{
      const u=new URL(String(input?.url||input));const body=typeof init.body==='string'?JSON.parse(init.body):null;
      const call={path:u.pathname,method:String(init.method||'GET'),query:u.search,body};calls.push(call);
      if(call.path==='/api/ogust-devis')return response({ok:true,auth_required:false});
      if(call.path==='/api/ogust-history')return response(u.searchParams.get('rates')==='1'?{ok:true,rates}:{ok:true,prestations:rates.map(r=>({id:r.product,title:r.title})),records:[]});
      if(call.path==='/api/ogust-customer'&&body?.action==='search')return response({ok:true,customer_candidates:[customer]});
      if(call.path==='/api/ogust-quotation'&&body?.action==='prepare')return response({ok:true,customer_locked:true,selected_customer_id:body.id_customer,customer_candidates:[customer],company_choices:[{id_company:'company-main',label:'Établissement principal'}],preview:{...body.quote,line_count:body.quote.lignes.length,total_ttc:body.quote.totaux.ttc},draft:{supported:true,label:'Brouillon'}});
      if(call.path==='/api/ogust-quotation'&&body?.action==='create')return response({ok:true,id_quotation:'test-only-quote',ogust_number:'TEST42',ogust_status:'B',verified:true});
      if(call.path==='/api/analyse-chantier'){
        if(body?.action==='memory_save')return response({ok:true,configured:true,saved_count:body.records.length,duplicate_count:0,decision_count:body.records.length,actual_count:body.records.filter(record=>record.actual_confirmed).length});
        if(aiHold)return aiHold.promise;
        assert.ok(aiResponse,'AI fixture must be explicitly selected');return response({ok:true,analysis:aiResponse,meta:{}});
      }
      return response({ok:true,slots:[],customers:[],quotations:[]});
    };
  }});
  const w=dom.window;await until(()=>w.acjDraftV42&&w.acjAIDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length===2,'all production modules loaded');
  await wait(90);assert.equal(errors.length,0,errors.map(e=>e.stack||e.message).join('\n'));
  return {dom,w,doc:w.document,calls,alerts,errors,recognitions,setAnalysis(a){aiResponse=a},holdAnalysis(){let resolve;const promise=new Promise(done=>resolve=done);aiHold={promise,resolve};return data=>{resolve(response({ok:true,analysis:data,meta:{}}));aiHold=null}},snapshot(){return Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const key=w.localStorage.key(i);return[key,w.localStorage.getItem(key)]}))}};
}
const fixture=fields=>({prestations:[{mode:'jardin',preset:'autre_jardin',designation:'Travaux de jardinage',pricing_method:'hourly',hours:0,flat_ttc:0,metric:0,rate_ttc:47,missing_fields:[],estimated_hours_suggested:2,estimated_hours_min:1.5,estimated_hours_max:3,estimation_basis:'Temps de travail indicatif',...fields}],fournitures_ttc:0,notes:''});
const getState=w=>w.eval('state');
function input(app,id,value){const el=app.doc.getElementById(id);assert.ok(el,`Input ${id} exists`);el.value=String(value);el.dispatchEvent(new app.w.Event('input',{bubbles:true}));return el}
async function knownClient(app){input(app,'ogcSearch','Alex');await until(()=>app.doc.querySelector('#ogcResults .ogcResult'),'known client search');app.doc.querySelector('#ogcResults .ogcResult').click();assert.equal(app.w.ogustClientChoiceV21.selected.id_customer,customer.id_customer);app.w.goStep(2);assert.equal(getState(app.w).step,2)}
function pickGarden(app){const button=[...app.doc.querySelectorAll('#ogPickerResults41 button')].find(b=>b.querySelector('strong')?.textContent===rates[0].title);assert.ok(button,'Hourly garden service in catalogue');button.click();assert.equal(app.doc.getElementById('builderRate').value,'47');assert.equal(app.doc.querySelector('#serviceBuilder .methodGrid'),null)}
let a,b,c;
try{
  a=await boot();assert.equal(a.doc.querySelectorAll('.fastProgress42 button').length,3);
  assert.deepEqual([...a.doc.querySelectorAll('.fastProgress42 button')].map(b=>b.lastElementChild.textContent),['Client','Devis','Vérifier']);
  a.w.goStep(3);assert.equal(getState(a.w).step,1,'Known client selection still guards entry');
  await knownClient(a);
  assert.equal(a.doc.getElementById('quoteLines').closest('.step').dataset.step,'2');
  assert.equal(a.doc.getElementById('modeChoices').closest('details'),null);
  assert.equal(a.doc.getElementById('presetChoices').closest('details').id,'fastDetailed42');
  assert.equal(a.doc.getElementById('notesImportCard').closest('.step').dataset.step,'2');
  pickGarden(a);input(a,'builderHours',3);input(a,'builderRate',55);a.w.addBuiltService();
  const line=getState(a.w).lines[0];assert.equal(line.qty,3);assert.equal(line.unitPriceTTC,55);assert.equal(line.ogustRateId,'rate-garden');assert.equal(line.ogustProductLevelId,'prod-garden');assert.equal(a.w.totals().ttc,165);
  assert.match(a.doc.getElementById('fastLiveTotal42').textContent,/165/);
  a.doc.getElementById('fastVerify42').click();assert.equal(getState(a.w).step,4);
  await a.w.sendToOgust();await until(()=>a.doc.getElementById('ogwCreateBtn'),'known customer preparation');
  const prepared=a.calls.find(c=>c.path==='/api/ogust-quotation'&&c.body?.action==='prepare');
  assert.equal(prepared.body.id_customer,customer.id_customer);assert.equal(prepared.body.quote.totaux.ttc,165);assert.equal(prepared.body.quote.lignes[0].ogust_rate_id,'rate-garden');
  assert.equal(a.doc.querySelector('input[name="ogwCustomer"]'),null,'No repeated client choice');assert.equal(a.doc.getElementById('ogwConfirmCheck'),null,'Known verified customer uses the final action for confirmation');assert.equal(a.doc.getElementById('ogwCreateBtn').disabled,false);
  assert.equal(a.calls.filter(c=>c.body?.action==='create').length,0,'Preparing does not create');a.w.closeOgustWriteModal();a.w.goStep(3);assert.equal(getState(a.w).step,2);
  input(a,'aiChantierText','Jardinage : tailler le saule et enlever le romarin.');input(a,'noteText','Ancienne note à importer');
  pickGarden(a);input(a,'builderHours',2.5);input(a,'builderRate',61);input(a,'builderDesignation','Jardinage du fond');a.w.acjDraftV42.save();
  const quoteNumber=getState(a.w).number,saved=a.snapshot();const draft=JSON.parse(saved[a.w.acjDraftV42.key]);
  assert.equal(draft.clientChoice.selected.id_customer,customer.id_customer);assert.equal(draft.picker.selected.rateId,'rate-garden');assert.equal(draft.inputs.builderRate,'61');
  await wait(80);a.dom.window.close();a=null;
  b=await boot(saved);await until(()=>b.w.acjOgustPicker.getDraft().selected?.rateId==='rate-garden','saved builder tariff matched current catalogue');
  assert.equal(getState(b.w).step,2);assert.equal(getState(b.w).number,quoteNumber);assert.equal(b.w.ogustClientChoiceV21.selected.id_customer,customer.id_customer);assert.equal(getState(b.w).lines.length,1);assert.equal(b.w.totals().ttc,165);
  assert.equal(b.doc.getElementById('aiChantierText').value,'Jardinage : tailler le saule et enlever le romarin.');assert.equal(b.doc.getElementById('noteText').value,'Ancienne note à importer');assert.equal(b.doc.getElementById('builderHours').value,'2.5');assert.equal(b.doc.getElementById('builderRate').value,'61');assert.equal(b.doc.getElementById('builderDesignation').value,'Jardinage du fond');
  // An AI estimate is reviewable but cannot be added until explicitly accepted.
  b.setAnalysis(fixture({}));await b.w.analyseChantierAI();b.w.applyAIProposal(0);const before=getState(b.w).lines.length;
  assert.equal(b.doc.getElementById('builderHours').value,'2');assert.ok(b.doc.getElementById('aiDurationConfirm'));
  b.w.addBuiltService();assert.equal(getState(b.w).lines.length,before);assert.match(b.doc.getElementById('aiError').textContent,/Confirme/);
  // Closing/reloading during review must not turn an unconfirmed suggestion
  // into a regular hourly line by merely persisting its prefilled value.
  b.w.acjDraftV42.save();const pendingSnapshot=b.snapshot();
  assert.ok(JSON.parse(pendingSnapshot[b.w.acjDraftV42.key]).aiPending,'AI pending context is stored with the draft');
  await wait(80);b.dom.window.close();b=null;b=await boot(pendingSnapshot);
  await until(()=>b.doc.getElementById('aiDurationConfirm'),'unconfirmed AI proposal restored');
  assert.equal(b.doc.getElementById('builderHours').value,'2');assert.equal(b.doc.getElementById('aiDurationConfirm').checked,false);assert.equal(getState(b.w).lines.length,before);
  b.w.addBuiltService();assert.equal(getState(b.w).lines.length,before,'Reload cannot bypass the AI duration review');assert.match(b.doc.getElementById('aiError').textContent,/Confirme/);
  b.doc.getElementById('aiDurationConfirm').checked=true;b.w.addBuiltService();assert.equal(getState(b.w).lines.length,before+1);assert.equal(getState(b.w).lines.at(-1).aiProvenance.status,'estimation_confirmee');assert.equal(getState(b.w).lines.at(-1).aiProvenance.durationConfirmed,true);
  b.w.goStep(4);b.w.saveQuote();await until(()=>JSON.parse(b.w.localStorage.getItem(b.w.acjLearningV45.key)||'{"entries":[]}').entries.some(entry=>entry.acked),'confirmed AI correction remotely acknowledged');
  const memoryCall=b.calls.find(call=>call.body?.action==='memory_save');assert.equal(memoryCall.body.records.length,1,'Manual tariff line is excluded from AI feedback');assert.equal(memoryCall.body.records[0].retained_hours,2);assert.equal(memoryCall.body.records[0].estimated_hours,2);assert.equal(memoryCall.body.records[0].actual_hours,undefined,'Retained hours never become an actual duration');assert.ok(!JSON.stringify(memoryCall.body).includes(customer.phone));assert.ok(!JSON.stringify(memoryCall.body).includes(customer.email));
  const learnedPayload=b.w.quotePayload();assert.equal(learnedPayload.lignes.at(-1).line_id,getState(b.w).lines.at(-1).id);b.w.goStep(2);
  // Missing/visual quantities do not become fabricated hours or measurements.
  input(b,'aiChantierText','Tailler la haie, dimensions à mesurer.');b.setAnalysis(fixture({preset:'haie',designation:'Taille de haie',missing_fields:['Longueur','Hauteur'],visual_metric_min:10,visual_metric_max:20,visual_metric_unit:'ml'}));await b.w.analyseChantierAI();b.w.applyAIProposal(0);
  assert.equal(b.doc.getElementById('builderHours').value,'');if(b.doc.getElementById('detailMetric'))assert.equal(b.doc.getElementById('detailMetric').value,'');const count=getState(b.w).lines.length;b.w.addBuiltService();assert.equal(getState(b.w).lines.length,count);assert.match(b.alerts.at(-1),/heures/);
  // A delayed AI response from another text cannot populate the current quote.
  input(b,'aiChantierText','Ancien chantier de jardinage');const release=b.holdAnalysis();const pending=b.w.analyseChantierAI();await until(()=>b.calls.some(c=>c.path==='/api/analyse-chantier'&&c.body?.description==='Ancien chantier de jardinage'),'AI request pending');input(b,'aiChantierText','Nouveau chantier différent');release(fixture({}));await pending;assert.equal(b.doc.getElementById('aiResult').textContent,'');assert.equal(getState(b.w).lines.length,count);
  b.w.acjDraftV42.save();assert.ok(b.w.localStorage.getItem(b.w.acjDraftV42.key));b.w.newQuote();await wait(350);assert.equal(b.w.localStorage.getItem(b.w.acjDraftV42.key),null);assert.equal(getState(b.w).lines.length,0);assert.equal(getState(b.w).step,1);assert.equal(b.doc.getElementById('aiChantierText').value,'');assert.equal(b.w.ogustClientChoiceV21.selected,null);
  assert.equal(b.errors.length,0,b.errors.map(e=>e.stack||e.message).join('\n'));assert.equal(b.calls.filter(c=>c.body?.action==='create').length,0);
  // Integrated dictation uses the same notes textarea and existing AI action.
  // Interim speech stays in a separate preview, outside the persisted draft.
  c=await boot({}, {voice:true});await knownClient(c);
  await until(()=>c.doc.getElementById('voiceToggle43'),'voice control mounted');
  const voiceButton=()=>c.doc.getElementById('voiceToggle43');
  const latestRecognition=()=>c.recognitions.at(-1);
  input(c,'aiChantierText','Travaux chez le client.');c.w.acjDraftV42.save();
  assert.match(voiceButton().textContent,/Dicter/);voiceButton().click();
  const voice=latestRecognition();assert.ok(voice.live);assert.equal(voice.lang,'fr-FR');
  voice.result('texte provisoire à ne pas enregistrer',false);
  assert.match(c.doc.getElementById('voicePreview43').textContent,/texte provisoire/);
  assert.equal(c.doc.getElementById('aiChantierText').value,'Travaux chez le client.');
  c.w.acjDraftV42.save();assert.ok(!c.w.localStorage.getItem(c.w.acjDraftV42.key).includes('texte provisoire'),'Interim speech never enters the draft');
  voice.result('Jardinage 3 heures à 55 euros par heure.',true);
  const dictated=c.doc.getElementById('aiChantierText').value;
  assert.ok(dictated.startsWith('Travaux chez le client.'));assert.ok(dictated.includes('Jardinage 3 heures à 55 euros par heure.'));assert.ok(!dictated.includes('texte provisoire'));
  assert.equal(c.calls.filter(call=>call.path==='/api/analyse-chantier').length,0,'Dictation alone never starts the AI');assert.equal(getState(c.w).lines.length,0,'Dictation does not create priced lines');
  voiceButton().click();assert.ok(!voice.live);c.w.acjDraftV42.save();const voiceDraft=c.snapshot();
  await wait(80);c.dom.window.close();c=null;c=await boot(voiceDraft,{voice:true});
  assert.equal(c.doc.getElementById('aiChantierText').value,dictated,'Confirmed dictation survives draft reload');assert.equal(getState(c.w).step,2);
  c.setAnalysis(fixture({hours:3,estimated_hours_suggested:0}));await c.w.analyseChantierAI();
  assert.equal(c.calls.find(call=>call.path==='/api/analyse-chantier').body.description,dictated,'Existing analyse action receives the dictated notes');
  // Navigation, manual edits and company/new-quote changes stop the recognizer.
  // Delayed browser events cannot append to a context that has already changed.
  voiceButton().click();const navigationVoice=latestRecognition();c.w.goStep(1);assert.ok(!navigationVoice.live);const beforeLate=c.doc.getElementById('aiChantierText').value;navigationVoice.result('paroles après navigation',true);assert.equal(c.doc.getElementById('aiChantierText').value,beforeLate);
  c.w.goStep(2);voiceButton().click();const manualVoice=latestRecognition();input(c,'aiChantierText','Saisie manuelle prioritaire.');assert.ok(!manualVoice.live);manualVoice.result('écrasement tardif',true);assert.equal(c.doc.getElementById('aiChantierText').value,'Saisie manuelle prioritaire.');
  voiceButton().click();const companyVoice=latestRecognition();c.w.setCompany('ACJ Services Lens');assert.ok(!companyVoice.live);const companyNotes=c.doc.getElementById('aiChantierText').value;companyVoice.result('mauvaise société',true);assert.equal(c.doc.getElementById('aiChantierText').value,companyNotes);
  await knownClient(c);voiceButton().click();const resetVoice=latestRecognition();c.w.newQuote();assert.ok(!resetVoice.live);resetVoice.result('ancien devis',true);assert.equal(c.doc.getElementById('aiChantierText').value,'');await wait(350);assert.equal(c.w.localStorage.getItem(c.w.acjDraftV42.key),null);
  assert.equal(c.calls.filter(call=>call.body?.action==='create').length,0);assert.equal(c.errors.length,0,c.errors.map(error=>error.stack||error.message).join('\n'));
  console.log('Full flow with all production scripts: known client → hourly tariff → 165 € → exact-ID prepare; 3-step workspace, draft reload/builder and unconfirmed AI review, AI confirmation/missing values/stale response, dictation final/interim/reload/manual-context protection, new-quote reset. APIs fully mocked; no actual writes.');
}finally{await wait(100);a?.dom.window.close();b?.dom.window.close();c?.dom.window.close()}
