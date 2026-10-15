import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const deps=process.env.ACJ_DOM_TEST_DEPS||path.resolve('../dom-test/node_modules');
const require=createRequire(path.join(deps,'pointage-test.cjs'));
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const indexedDB=new IDBFactory();
const script=fs.readFileSync(new URL('../intervenantes/pointage-local.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../intervenantes/index.html',import.meta.url),'utf8').replace(/<script[^>]+src=[\s\S]*?<\/script>/g,'');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const samplePhoto='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,...Array(32).fill(0),255,217]).toString('base64');
let clock=Date.parse('2026-10-07T09:00:00Z'),offline=false,away=false,loseNext=false,rejectPost=false,legacyReceipt=false,failSync=false,pausedSync=null;const sent=[],syncCalls=[],arrivals=new Map(),finishes=new Map();
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date(clock));
const makeState=id=>{const start=arrivals.get(id),stop=finishes.get(id);return {service_id:id,employee_id:'11',scheduled_date:today(),status:stop?'completed':'active',started_at:start.occurred_at,ended_at:stop?.occurred_at,start_event_id:start.event_id,stop_event_id:stop?.event_id,start_photo:!!start.photo,end_photo:!!stop?.photo,ogust_synced:!legacyReceipt,ogust_destination:legacyReceipt?null:'ordre_de_mission',validated:false,duration_minutes:stop?2:null,scheduled_start:today().replace(/-/g,'')+'0800',scheduled_end:today().replace(/-/g,'')+'1800'};};
function setup(email='employee@example.test',role='intervenante',withPlanning=true){
  const errors=[];
  const dom=new JSDOM(html,{url:'https://thomas-boudin.github.io/devis-ACJ/intervenantes/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.indexedDB=indexedDB;w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.meaningfulOgustNote=value=>String(value||'');
    w.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
    Object.defineProperty(w.navigator,'onLine',{get:()=>!offline});
    Object.assign(w.URL,{createObjectURL:()=> 'blob:test-photo',revokeObjectURL(){}});
    w.Image=class{width=4000;height=3000;set src(value){setTimeout(()=>this.onload(),0);}};
    w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=>samplePhoto;
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
    w.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};
    w.fetch=async(input,init={})=>{const url=new URL(String(input)),action=url.searchParams.get('action');if(offline)throw Error('offline');assert.ok(init.headers.Authorization.startsWith('Bearer acjs1.'));
      if(action==='pointage_day')return new Response(JSON.stringify({ok:true,pointages:[...arrivals.keys()].map(makeState),absences:away?[{start_date:today().replace(/-/g,'')+'0000',end_date:today().replace(/-/g,'')+'2359'}]:[],active:null}));
      if(action==='pointage'){const payload=JSON.parse(init.body);sent.push(payload);if(rejectPost)return new Response(JSON.stringify({ok:false,error:'POINTAGE_EMPLOYEE_ABSENT'}),{status:409});(payload.type==='start'?arrivals:finishes).set(payload.service_id,payload);if(loseNext){loseNext=false;throw Error('response lost');}legacyReceipt=false;return new Response(JSON.stringify({ok:true,state:makeState(payload.service_id)}));}
      if(action==='pointage_sync'){const payload=JSON.parse(init.body);assert.equal(init.method,'POST');assert.deepEqual(Object.keys(payload).sort(),['confirm','employee_id','scheduled_date','service_id']);assert.equal(payload.confirm,true);syncCalls.push(payload);if(failSync)return new Response(JSON.stringify({ok:false,error:'POINTAGE_OGUST_NOT_CONFIRMED'}),{status:503});const state={...makeState(payload.service_id),ogust_synced:true,ogust_destination:'ordre_de_mission'};if(pausedSync)await pausedSync;legacyReceipt=false;return new Response(JSON.stringify({ok:true,state}));}
      if(action==='pointage_validate'){const body=JSON.parse(init.body);assert.equal(body.confirm,true);sent.push({type:'validate',...body});return new Response(JSON.stringify({ok:true,state:{...makeState(body.service_id),validated:true}}));}
      if(action==='pointage_photo')return new Response(Buffer.from(samplePhoto.split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});
      return new Response(JSON.stringify({ok:true}));
    };
    w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  }});
  // This suite mounts an already-authenticated pointage screen; onboarding is tested separately.
  const w=dom.window;const token='acjs1.'+Buffer.from(JSON.stringify({email})).toString('base64url')+'.fixture';w.sessionStorage.setItem('acj_intervenantes_google_token',token);w.document.getElementById('employee').innerHTML='<option value="11">Intervenante test</option>';w.document.getElementById('app').hidden=false;w.ACJ_INTERVENANTES_ROLE=role;w.loadPlanning=()=>{};
  w.eval(script);
  const render=()=>w.render(withPlanning?[{id_service:'101',id_employee:'11',status:'A',start_date:today().replace(/-/g,'')+'0800',end_date:today().replace(/-/g,'')+'1800',start_time:'08:00',end_time:'18:00',customer:{name:'Client test'},product:{label:'Ménage'}}]:[]);render();
  return {dom,w,errors,render};
}
async function settle(condition,description){for(let n=0;n<100;n++){if(condition())return;await pause(20);}throw Error('Timeout: '+description);}
async function readStore(name){const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('acj_intervenantes_pointage_v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});return new Promise(resolve=>{const r=database.transaction(name).objectStore(name).getAll();r.onsuccess=()=>{database.close();resolve(r.result);};});}
function selectPhoto(w,type='image/jpeg'){const input=w.document.querySelector('dialog input[type=file]');Object.defineProperty(input,'files',{configurable:true,value:[new w.File(['fixture'],'photo.jpg',{type})]});input.dispatchEvent(new w.Event('change'));}
async function takePhotoAndConfirm(w){const d=w.document.querySelector('dialog'),input=d.querySelector('input[type=file]');assert.equal(input.getAttribute('capture'),'environment');assert.equal(input.required,true);assert.match(d.querySelector('label').textContent,/obligatoire/);assert.equal(d.querySelector('.confirm').disabled,true,'Start and end both require a prepared photo');selectPhoto(w);await settle(()=>!d.querySelector('.confirm').disabled,'photo compression');d.querySelector('.confirm').click();await settle(()=>!w.document.querySelector('dialog'),'capture persisted');}

let session=setup();await settle(()=>!session.w.document.querySelector('.pointage').disabled,'first day');
offline=true;session.w.document.querySelector('.pointage').click();
{
  const d=session.w.document.querySelector('dialog'),confirm=d.querySelector('.confirm');
  assert.equal(confirm.disabled,true);confirm.click();assert.equal(d.isConnected,true,'A photo-less click cannot start the service');
  await confirm.onclick();assert.match(d.querySelector('.error').textContent,/Prenez une photo/);
  assert.equal((await readStore('events')).length,0);assert.equal(sent.length,0,'A photo-less start is never queued or transmitted');
  selectPhoto(session.w);await settle(()=>!confirm.disabled,'valid preview before replacing it');
  selectPhoto(session.w,'application/pdf');await settle(()=>d.querySelector('.error').textContent.includes('ne peut pas être lue'),'invalid replacement photo');
  assert.equal(confirm.disabled,true);assert.equal(d.querySelector('img').hidden,true,'A failed replacement cannot reuse the previous photo');
  await confirm.onclick();assert.equal((await readStore('events')).length,0);
}
await takePhotoAndConfirm(session.w);
assert.match(session.w.document.querySelector('.pointageDescription').textContent,/en attente d’envoi/);assert.equal(sent.length,0);
let events=await readStore('events');assert.equal(events.length,1);assert.equal(events[0].photo,samplePhoto);assert.equal(events[0].type,'start');
clock+=120000;session.w.document.querySelector('.pointage').click();await takePhotoAndConfirm(session.w);events=await readStore('events');assert.equal(events.length,2);assert.equal(events[1].photo,samplePhoto);assert.equal(session.w.document.querySelector('.pointage').disabled,true,'A completed service cannot be restarted');
assert.deepEqual(session.errors,[]);session.dom.window.close();

offline=false;loseNext=true;session=setup();await settle(()=>sent.length===1,'retry after reload');assert.equal((await readStore('events')).length,2,'Lost response keeps both events');assert.match(session.w.document.querySelector('.pointageDescription').textContent,/en attente d’envoi/);
session.w.document.querySelector('.pointageTools button:last-child').click();await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('Ordre de mission'),'confirmed visible end');
assert.equal((await readStore('events')).length,0);assert.deepEqual(sent.map(e=>e.type),['start','start','stop']);assert.equal(sent[0].event_id,sent[1].event_id,'Retries use the same idempotency key');
session.w.document.querySelector('.pointageTools button').click();await settle(()=>session.w.document.querySelector('dialog img'),'private photo fetched');session.w.document.querySelector('dialog .cancel').click();assert.deepEqual(session.errors,[]);session.dom.window.close();

session=setup('admin@example.test','admin');await settle(()=>session.w.document.querySelector('.pointageValidate'),'admin review action');session.w.document.querySelector('.pointageValidate').click();const before=sent.length;session.w.document.querySelector('dialog .cancel').click();assert.equal(sent.length,before,'Cancel never changes Ogust billing');session.w.document.querySelector('.pointageValidate').click();session.w.document.querySelector('dialog .confirm').click();await settle(()=>!session.w.document.querySelector('dialog'),'manager validation');assert.equal(sent.at(-1).type,'validate');assert.match(session.w.document.querySelector('.pointageDescription').textContent,/Heures validées/);assert.deepEqual(session.errors,[]);session.dom.window.close();

{
  const originalStop=finishes.get('101');finishes.delete('101');legacyReceipt=true;let release;pausedSync=new Promise(resolve=>{release=resolve;});const prior=syncCalls.length;
  session=setup('parallel-finish@example.test');await settle(()=>syncCalls.length===prior+1&&!session.w.document.querySelector('.pointage').disabled,'arrival resync in flight');session.w.document.querySelector('.pointage').click();await takePhotoAndConfirm(session.w);await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('Ordre de mission')&&session.w.document.querySelector('.pointage').textContent.includes('TERMINÉE'),'finish confirmed before old arrival response');const latestStop=finishes.get('101');release();pausedSync=null;await pause(120);
  assert.match(session.w.document.querySelector('.pointage').textContent,/TERMINÉE/);assert.equal((await readStore('states')).find(s=>s.owner==='parallel-finish@example.test').stop_event_id,latestStop.event_id,'A delayed arrival response cannot erase a newer finish');assert.deepEqual(session.errors,[]);session.dom.window.close();finishes.set('101',originalStop);
}
legacyReceipt=true;const beforeMigration=sent.length,priorMigrationCalls=syncCalls.length;session=setup('migration@example.test','admin');await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('Ordre de mission'),'legacy pointages copied to visible Ogust note');assert.equal(syncCalls.length,priorMigrationCalls+1);assert.equal(sent.length,beforeMigration,'Migration never creates a new clock or validates billed hours');session.render();await pause(120);assert.equal(syncCalls.length,priorMigrationCalls+1,'Refresh does not duplicate a confirmed copy');assert.deepEqual(session.errors,[]);session.dom.window.close();
legacyReceipt=true;failSync=true;session=setup('migration-failure@example.test','admin');await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('n’a pas été confirmé'),'unconfirmed copy shown honestly');assert.equal(session.w.document.querySelector('.pointageValidate'),null,'No billing validation before the visible copy is confirmed');failSync=false;session.w.document.querySelector('.pointageSync').click();await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('Ordre de mission'),'explicit migration retry');assert.equal(sent.length,beforeMigration);assert.deepEqual(session.errors,[]);session.dom.window.close();
{
  const beforeHistory=sent.length;session=setup('history@example.test','admin',false);
  await settle(()=>session.w.document.querySelector('#pointageHistory .pointageDescription')?.textContent.includes('Ordre de mission'),'recorded pointage remains visible without a planned service');
  const doc=session.w.document;assert.equal(doc.querySelector('#list .empty').hidden,true);assert.match(doc.querySelector('#pointageHistory h3').textContent,/08:00 à 18:00/);assert.equal(doc.querySelectorAll('#pointageHistory .pointageTools button').length,2,'Both existing photos remain available');assert.equal(doc.querySelector('.pointage'),null,'Missing planned service cannot be started or stopped');assert.equal(doc.querySelector('.pointageValidate'),null,'No billing action for a service missing from the current planning');
  doc.querySelector('#pointageHistory .pointageTools button').click();await settle(()=>doc.querySelector('dialog img'),'private historical photo fetched');doc.querySelector('dialog .cancel').click();assert.equal(sent.length,beforeHistory,'Viewing history does not create a clock or validate hours');
  session.render();await pause(80);assert.equal(doc.querySelectorAll('#pointageHistory').length,1,'Repeated refresh does not duplicate history');
  doc.getElementById('employee').innerHTML='<option value="22">Autre intervenante</option>';session.render();await pause(80);assert.equal(doc.getElementById('pointageHistory'),null,'Do not display the previous employee’s pointages');assert.equal(doc.querySelector('#list .empty').hidden,false);
  assert.deepEqual(session.errors,[]);session.dom.window.close();
}
arrivals.clear();finishes.clear();away=true;session=setup('another@example.test');await settle(()=>session.w.document.querySelector('.pointageDescription')?.textContent.includes('Absente'),'absence displayed');assert.equal(session.w.document.querySelector('.pointage').disabled,true);assert.deepEqual(session.errors,[]);session.dom.window.close();
away=false;rejectPost=true;session=setup('offline-absence@example.test');await settle(()=>!session.w.document.querySelector('.pointage').disabled,'eligible before absence update');session.w.document.querySelector('.pointage').click();await takePhotoAndConfirm(session.w);await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('Envoi bloqué'),'permanent rejection distinguished from network retry');assert.equal(session.w.document.querySelector('.pointage').disabled,true);const retained=(await readStore('events')).filter(e=>e.owner==='offline-absence@example.test');assert.equal(retained.length,1);assert.equal(retained[0].blocked,true);assert.equal(retained[0].photo,samplePhoto,'Rejected clock and photo remain recoverable');rejectPost=false;session.w.document.querySelector('.pointageTools button:last-child').click();await settle(()=>session.w.document.querySelector('.pointageDescription').textContent.includes('Début transmis'),'explicit retry after manager resolves absence');assert.equal((await readStore('events')).filter(e=>e.owner==='offline-absence@example.test').length,0);assert.deepEqual(session.errors,[]);session.dom.window.close();
console.log('Intervenantes pointage UI: OK (mandatory start/end photos, invalid-photo rejection, offline persistence, reload, idempotent retry, private photos, manager review, absences)');

