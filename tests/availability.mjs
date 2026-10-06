// Availability UI integration. APIs are mocked; this test never books an intervention.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),deps=path.resolve(here,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'acj-dom-test.cjs'));
const {JSDOM}=require(path.join(deps,'jsdom/lib/api.js'));
const source=fs.readFileSync(path.resolve(here,'../availability-v32.js'),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
function slot(i,extra={}){return {date:`2030-01-${String(7+Math.floor(i/2)).padStart(2,'0')}`,start:i%2?'13:00':'09:00',end:i%2?'16:00':'12:00',intervenant:i%2?'Alex Jardin':'Camille Test',employee_key:'employee-'+i,id_intervenant:'ogust-'+i,source:i%2?'google':'ogust',employee_base_configured:true,client_base_configured:true,verification:{complete:true,planning_checked:true,absences_checked:true,employee_base_checked:true,client_base_checked:true,employee_profile_checked:true,travel_checked:false},...extra}}
const complete=slots=>({ok:true,count:slots.length,total_count:slots.length,checked_at:'2030-01-06T12:00:00.000Z',slots,sources:{ogust:{queried:true,available:true},google:{queried:true,available:true}},base_availability:{available:true},verification:{complete:true,warnings:[]}});
async function boot(){
  const dom=new JSDOM('<html><head></head><body><input id="client" value="Client Test"><input id="adresse" value="Rue du test"><section class="step" data-step="4"><div class="card">Devis</div><div class="card">Actions</div></section><div id="av31Panel"></div></body></html>',{url:'https://thomas-boudin.github.io/devis-ACJ/',runScripts:'outside-only'});
  const w=dom.window,calls=[];let data=complete(Array.from({length:16},(_,i)=>slot(i))),hold=null;
  w.state={company:'ACJ Services',number:'ACJ-TEST',mode:'jardin',client:'Client Test',address:'Rue du test',lines:[{type:'service',unit:'h',qty:3}]};
  w.ogustClientChoiceV21={company:'ACJ Services',selected:{id_customer:'client-42',label:'Client Test'}};
  w.AbortController=AbortController;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.goStep=()=>{};w.renderQuoteLines=()=>{};w.setMode=n=>w.state.mode=n;w.applyImportedNotesClientV39=()=>{};
  w.newQuote=()=>{w.state={company:w.state.company,number:'ACJ-NEW',mode:'jardin',client:'',address:'',lines:[]};w.document.getElementById('client').value='';w.document.getElementById('adresse').value='';w.ogustClientChoiceV21.selected=null};
  w.quotePayload=()=>({numero_devis:w.state.number,societe:w.state.company});
  w.fetch=async(url,init)=>{calls.push({url:new URL(url),init});if(hold)return hold.promise;return response(data)};
  w.eval(source);await wait(10);
  return {dom,w,doc:w.document,calls,setData(next){data=next},defer(){let resolve;const promise=new Promise(done=>resolve=done);hold={promise,resolve};return next=>{resolve(response(next));hold=null}}};
}
function event(app,id,value,name='change'){const node=app.doc.getElementById(id);node.value=String(value);node.dispatchEvent(new app.w.Event(name,{bubbles:true}));return node}
let a,b;
try{
  a=await boot();assert.equal(a.doc.getElementById('av31Panel').style.display,'none');assert.equal(a.doc.getElementById('av32Duration').value,'3');
  event(a,'av32From','2030-01-07');event(a,'av32Period','morning');await a.w.acjAvailabilityV32.search();
  const request=a.calls.at(-1).url;assert.equal(request.searchParams.get('duration_minutes'),'180');assert.equal(request.searchParams.get('id_customer'),'client-42');assert.equal(request.searchParams.get('period'),'morning');assert.equal(request.searchParams.get('max_results'),'80');
  assert.equal(a.doc.querySelectorAll('.av32Slot').length,3);assert.equal(a.doc.querySelectorAll('.av32DateGroup').length,3);assert.match(a.doc.getElementById('av32Status').textContent,/8 créneaux/);assert.ok([...a.doc.querySelectorAll('.av32When')].every(node=>node.textContent.endsWith('12:00')));event(a,'av32Period','any');await a.w.acjAvailabilityV32.search();
  while(a.doc.getElementById('av32More'))a.doc.getElementById('av32More').click();assert.equal(a.doc.querySelectorAll('.av32Slot').length,16,'All returned slots are accessible');
  event(a,'av32Employee','alex','input');assert.equal(a.doc.querySelectorAll('.av32Slot').length,3);while(a.doc.getElementById('av32More'))a.doc.getElementById('av32More').click();assert.equal(a.doc.querySelectorAll('.av32Slot').length,8,'Intervenant filter shows only matches');
  event(a,'av32Weekday','1');assert.equal(a.doc.querySelectorAll('.av32Slot').length,2,'Optional weekday filter is immediate');
  a.doc.querySelector('.av32Slot').click();assert.ok(a.w.acjAvailabilityV32.selected);assert.equal(a.w.state.availabilityProposal.needs_recheck,false);assert.match(a.doc.getElementById('av32Selected').textContent,/Aucune intervention n’est réservée/);assert.ok(a.w.quotePayload().availability_proposal);
  const remembered=a.w.acjAvailabilityV32.getDraft();b=await boot();assert.equal(b.w.acjAvailabilityV32.restore(remembered),true);assert.equal(b.w.acjAvailabilityV32.selected,null,'Restored proposal is not current checked availability');assert.equal(b.w.state.availabilityProposal.needs_recheck,true);assert.match(b.doc.getElementById('av32Selected').textContent,/à revérifier/);
  event(a,'av32Employee','','input');assert.equal(a.w.acjAvailabilityV32.selected,null);assert.equal(a.w.state.availabilityProposal,undefined);
  event(a,'av32Weekday','');a.doc.querySelector('.av32Slot').click();a.w.state.lines[0].qty=4;a.w.renderQuoteLines();assert.equal(a.doc.getElementById('av32Duration').value,'4','Changed line hours refresh duration automatically');assert.equal(a.w.acjAvailabilityV32.selected,null);assert.equal(a.doc.querySelectorAll('.av32Slot').length,0);
  event(a,'av32Duration','2','input');assert.equal(a.doc.getElementById('av32DurationReset').hidden,false);a.w.state.lines[0].qty=5;a.w.renderQuoteLines();assert.equal(a.doc.getElementById('av32Duration').value,'5','Later line edits replace obsolete custom duration');assert.equal(a.doc.getElementById('av32DurationReset').hidden,true);
  event(a,'av32Duration','2','input');a.doc.getElementById('av32DurationReset').click();assert.equal(a.doc.getElementById('av32Duration').value,'5');
  a.setData(complete([]));await a.w.acjAvailabilityV32.search();assert.equal(a.doc.querySelectorAll('.av32Slot').length,0);assert.match(a.doc.getElementById('av32Status').textContent,/Aucun créneau/);assert.ok(!a.doc.getElementById('av32Status').classList.contains('ok'),'Empty results never show success');a.w.goStep(4);assert.match(a.doc.getElementById('av32Status').textContent,/Aucun créneau/,'Navigating preserves the empty result explanation');
  const partial=complete([slot(0),slot(1,{verification:{complete:false}})]);partial.verification={complete:false,warnings:['GOOGLE_CALENDAR_UNAVAILABLE']};partial.sources.google.available=false;a.setData(partial);await a.w.acjAvailabilityV32.search();assert.equal(a.doc.querySelectorAll('.av32Slot').length,1,'Incomplete source slots are excluded');assert.ok(a.doc.getElementById('av32Status').classList.contains('warn'));assert.ok(!a.doc.getElementById('av32Status').classList.contains('ok'));a.doc.querySelector('.av32Slot').click();assert.equal(a.w.acjAvailabilityV32.selected.source,'ogust','Checked slots from another source can still be proposed');
  const unconfigured=complete([slot(0,{employee_base_configured:false,assumptions:['employee_hours_unconfigured']})]);a.setData(unconfigured);await a.w.acjAvailabilityV32.search();assert.ok(a.doc.getElementById('av32Status').classList.contains('warn'),'Unset base hours are an explicit assumption');assert.match(a.doc.getElementById('av32Status').textContent,/confirme le créneau/);
  a.setData({ok:false,error:'OGUST_AVAILABILITY_INCOMPLETE',slots:[]});await a.w.acjAvailabilityV32.search();assert.equal(a.doc.querySelectorAll('.av32Slot').length,0);assert.ok(a.doc.getElementById('av32Status').classList.contains('err'));assert.match(a.doc.getElementById('av32Status').textContent,/lecture complète/);
  // Changing context during an outstanding query cancels prior results and
  // ignores responses even when a fetch mock/browser cannot really abort them.
  const release=a.defer(),pending=a.w.acjAvailabilityV32.search();await wait(0);a.w.setMode('menage');release(complete([slot(0)]));await pending;assert.equal(a.doc.querySelectorAll('.av32Slot').length,0);assert.equal(a.w.acjAvailabilityV32.selected,null);assert.equal(a.doc.getElementById('av32Search').disabled,false);
  a.setData(complete([slot(0)]));await a.w.acjAvailabilityV32.search();a.doc.querySelector('.av32Slot').click();a.w.ogustClientChoiceV21.selected={id_customer:'other-client',label:'Other'};a.w.goStep(4);assert.equal(a.w.acjAvailabilityV32.selected,null);assert.equal(a.w.state.availabilityProposal,undefined);
  await a.w.acjAvailabilityV32.search();a.doc.querySelector('.av32Slot').click();a.w.state.company='ACJ Services Lens';a.w.ogustClientChoiceV21.company='ACJ Services Lens';a.w.dispatchEvent(new a.w.CustomEvent('acj:company-changed'));assert.equal(a.w.acjAvailabilityV32.selected,null);assert.equal(a.doc.querySelectorAll('.av32Slot').length,0);
  a.w.newQuote();assert.equal(a.doc.getElementById('av32Duration').value,'');assert.equal(a.w.state.availabilityProposal,undefined);assert.equal(a.w.acjAvailabilityV32.restore(remembered),false,'A proposal cannot cross client/company/quote contexts');
  assert.ok(a.calls.every(c=>!c.init?.method||c.init.method==='GET'),'No booking/write request exists');assert.equal(a.w.acjAvailabilityV32.rules.scheduled,'Google pour JB/Vincent/Yohann, Ogust pour les autres');
  console.log('Availability UI: grouped shortlist/all slots, day/name filters, duration refresh, context/stale guards, verified-only partial results, proposal draft requires recheck, and no booking writes OK');
}finally{await wait(10);a?.dom.window.close();b?.dom.window.close()}
