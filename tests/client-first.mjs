// New-client integration against every production script. All APIs are mocked.
// Install jsdom separately or set ACJ_DOM_TEST_DEPS to its node_modules path.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const deps=path.resolve(here,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'acj-client-test.cjs'));
const {JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const config={titles:[{value:'M',label:'Monsieur'}],payments:[{value:'V',label:'Virement'}],managers:[{value:'A',label:'ACJ'}],origins:[{value:'AU',label:'Autre'}],origin_other:'AU',types:[{value:'C',label:'Client'}],sectors:[{value:'S',label:'Lens'}]};
const rates=[{id:'rate-garden',product:'prod-garden',title:"Jardinage à l'heure",unit:'H',vat:20,price:47},{id:'rate-clean',product:'prod-clean',title:'Entretien régulier du logement',unit:'H',vat:10,price:32}];
const fields={ogcNewTitle:'M',ogcNewLastName:'Test',ogcNewFirstName:'Alex',ogcNewPhone:'0700000000',ogcNewLandline:'0321000000',ogcNewEmail:'client-test@example.com',ogcNewAddress:'8 rue du Test',ogcNewZip:'59134',ogcNewCity:'Marquillies',ogcNewType:'C',ogcNewOrigin:'AU',ogcNewSector:'S',ogcNewPayment:'V',ogcNewManager:'A'};
const customer={id_customer:'new-client-46',label:'Alex Test',phone:fields.ogcNewPhone,email:fields.ogcNewEmail,address:`${fields.ogcNewAddress}, ${fields.ogcNewZip} ${fields.ogcNewCity}`,zip:fields.ogcNewZip,city:fields.ogcNewCity,code:'CLI46'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,description){for(let i=0;i<150;i++){if(fn())return;await wait(20)}throw new Error(`Timed out: ${description}`)}
const state=app=>app.w.eval('state');
const createCalls=app=>app.calls.filter(call=>call.body?.action==='create');
const customerCreates=app=>createCalls(app).filter(call=>call.path==='/api/ogust-customer');
const quoteCreates=app=>createCalls(app).filter(call=>call.path==='/api/ogust-quotation');

class LocalScripts extends ResourceLoader{
  fetch(url){const u=new URL(url);if(u.origin==='https://thomas-boudin.github.io'&&u.pathname.startsWith('/devis-ACJ/')&&u.pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,u.pathname.slice('/devis-ACJ/'.length))));return null}
}
async function boot(saved={},options={}){
  const errors=[],calls=[],alerts=[],configPending=[];let holdConfig=!!options.holdConfig,failedQuotation=false;
  const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));vc.on('error',(...items)=>errors.push(new Error(items.map(String).join(' '))));
  const dom=new JSDOM(html,{url:'https://thomas-boudin.github.io/devis-ACJ/?v=46',resources:new LocalScripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
    w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.alert=message=>alerts.push(String(message));w.confirm=()=>true;
    for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
    w.fetch=async(input,init={})=>{
      const u=new URL(String(input?.url||input)),body=typeof init.body==='string'?JSON.parse(init.body):null;
      const call={path:u.pathname,method:String(init.method||'GET'),query:u.search,body};calls.push(call);
      if(call.path==='/api/ogust-devis')return response({ok:true,auth_required:false});
      if(call.path==='/api/ogust-history')return response(u.searchParams.get('rates')==='1'?{ok:true,rates}:{ok:true,prestations:rates.map(rate=>({id:rate.product,title:rate.title})),records:[]});
      if(call.path==='/api/ogust-customer'&&call.method==='GET'){
        if(holdConfig)return new Promise(resolve=>configPending.push(resolve));
        return response({ok:true,mode:'particulier_only',config});
      }
      if(call.path==='/api/ogust-customer'&&body?.action==='search')return response({ok:true,customer_candidates:[]});
      if(call.path==='/api/ogust-customer'&&body?.action==='create'){
        if(options.failCustomerNetwork)throw new Error('Mock network interruption after submission');
        return response({ok:true,id_customer:customer.id_customer,verified:true,customer});
      }
      if(call.path==='/api/ogust-quotation'&&body?.action==='prepare')return response({ok:true,customer_locked:!!body.id_customer,selected_customer_id:body.id_customer||'',customer_candidates:body.id_customer?[customer]:[],company_choices:[{id_company:'company-main',label:'Établissement principal'}],new_customer_config:config,preview:{...body.quote,line_count:body.quote.lignes.length,total_ttc:body.quote.totaux.ttc},draft:{supported:true,label:'Brouillon'}});
      if(call.path==='/api/ogust-quotation'&&body?.action==='create'){
        if(options.failFirstQuotation&&!failedQuotation){failedQuotation=true;return response({ok:false,error:'QUOTATION_RATE_NOT_FOUND'},400)}
        return response({ok:true,id_quotation:'mock-quote-46',ogust_number:'TEST46',ogust_status:'B',verified:true});
      }
      if(call.path==='/api/analyse-chantier'&&body?.action==='memory_save')return response({ok:true,configured:true,saved_count:body.records.length});
      if(body?.action==='create'||body?.action==='update')throw new Error(`Unexpected mutation ${call.path}`);
      return response({ok:true,slots:[],customers:[],quotations:[],records:[]});
    };
  }});
  const w=dom.window;
  await until(()=>w.acjClientFormV46&&w.acjDraftV42&&w.acjAIDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length===rates.length,'all production modules loaded');
  await wait(60);assert.equal(errors.length,0,errors.map(error=>error.stack||error.message).join('\n'));
  return {dom,w,doc:w.document,calls,alerts,errors,releaseConfig(){holdConfig=false;for(const resolve of configPending.splice(0))resolve(response({ok:true,mode:'particulier_only',config}))},snapshot(){return Object.fromEntries(Array.from({length:w.localStorage.length},(_,index)=>{const key=w.localStorage.key(index);return [key,w.localStorage.getItem(key)]}))}};
}
function input(app,id,value){const element=app.doc.getElementById(id);assert.ok(element,`Input ${id} exists`);element.value=String(value);element.dispatchEvent(new app.w.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));return element}
function newMode(app){const button=app.doc.getElementById('ogcNewBtn');assert.ok(button);button.click();assert.ok(app.doc.getElementById('ogcNewCustomerForm'),'New-client form mounts synchronously');assert.equal(app.doc.getElementById('ogcNewCustomerForm').closest('.step')?.dataset.step,'1');for(const id of Object.keys(fields))assert.ok(app.doc.getElementById(id),`${id} is available at the first step`);assert.equal(app.doc.getElementById('ogwOverlay'),null)}
async function configured(app){await until(()=>app.doc.getElementById('ogcNewTitle')?.querySelector('option[value="M"]')&&app.doc.getElementById('ogcNewPayment')?.querySelector('option[value="V"]')&&app.doc.getElementById('ogcNewManager')?.querySelector('option[value="A"]'),'company configuration loaded')}
async function fill(app){await configured(app);for(const [id,value] of Object.entries(fields))input(app,id,value)}
function confirmInline(app){const checkbox=app.doc.getElementById('ogcConfirmClient46')||app.doc.querySelector('#ogcNewCustomerForm input[type="checkbox"]');assert.ok(checkbox,'Inline creation has explicit confirmation');checkbox.checked=true;checkbox.dispatchEvent(new app.w.Event('change',{bubbles:true}))}
function pickLine(app){app.w.goStep(2);assert.equal(state(app).step,2);const button=[...app.doc.querySelectorAll('#ogPickerResults41 button')].find(item=>item.querySelector('strong')?.textContent===rates[0].title);assert.ok(button,'Hourly gardening tariff loaded');button.click();input(app,'builderHours',3);app.w.addBuiltService();assert.equal(state(app).lines.length,1);assert.equal(app.w.totals().ttc,141);app.w.goStep(4);assert.equal(state(app).step,4)}
function expectedCustomerPayload(payload){assert.equal(payload.title,'M');assert.equal(payload.last_name,'Test');assert.equal(payload.first_name,'Alex');assert.equal(payload.mobile_phone,fields.ogcNewPhone);assert.equal(payload.landline,fields.ogcNewLandline);assert.equal(payload.email,fields.ogcNewEmail);assert.equal(payload.type,'C');assert.equal(payload.origin,'AU');assert.equal(payload.sector,'S');assert.equal(payload.method_of_payment,'V');assert.equal(payload.manager,'A');assert.deepEqual(payload.address,{line:fields.ogcNewAddress,zip:fields.ogcNewZip,city:fields.ogcNewCity});assert.ok(payload.external_ref,'Creation has a stable reference')}
const apps=[];
try{
  // The complete form appears before its configuration response; typing wins.
  const early=await boot({}, {holdConfig:true});apps.push(early);newMode(early);
  input(early,'ogcNewLastName','Nom saisi rapidement');assert.equal(createCalls(early).length,0);
  early.releaseConfig();await configured(early);assert.equal(early.doc.getElementById('ogcNewLastName').value,'Nom saisi rapidement','A late configuration response cannot reset typed identity');
  await fill(early);assert.match(early.doc.getElementById('client').value,/Alex/);assert.match(early.doc.getElementById('client').value,/Test/);assert.equal(early.doc.getElementById('tel').value,fields.ogcNewPhone);assert.match(early.doc.getElementById('adresse').value,/59134/);
  assert.equal(typeof early.w.acjClientFormV46.getDraft,'function');assert.equal(typeof early.w.acjClientFormV46.restore,'function');assert.ok(JSON.stringify(early.w.acjClientFormV46.getDraft()).includes(fields.ogcNewEmail));assert.equal(createCalls(early).length,0,'Filling the new-client form never creates records');

  // Even an email-only draft survives reload with no name or created client.
  const partial=await boot();apps.push(partial);newMode(partial);await configured(partial);input(partial,'ogcNewEmail','partial@example.com');partial.w.acjDraftV42.save();const stored=partial.snapshot();assert.ok(stored[partial.w.acjDraftV42.key],'A partial contact is meaningful work');assert.ok(stored[partial.w.acjDraftV42.key].includes('partial@example.com'));
  const reloaded=await boot(stored);apps.push(reloaded);await until(()=>reloaded.doc.getElementById('ogcNewEmail')?.value==='partial@example.com','email-only client draft restored');await configured(reloaded);assert.equal(reloaded.doc.getElementById('ogcNewLastName').value,'');assert.equal(reloaded.w.ogustClientChoiceV21.mode,'new');assert.equal(createCalls(reloaded).length,0);

  // Import fills the same visible form and does not create clients or quotes.
  const notes=await boot();apps.push(notes);notes.w.applyImportedNotesClientV39({title:'Monsieur',last_name:'Test',first_name:'Alex',mobile_phone:fields.ogcNewPhone,landline:fields.ogcNewLandline,email:fields.ogcNewEmail,address:fields.ogcNewAddress,zip:fields.ogcNewZip,city:fields.ogcNewCity});
  await configured(notes);assert.equal(notes.doc.getElementById('ogcNewLastName').value,'Test');assert.equal(notes.doc.getElementById('ogcNewFirstName').value,'Alex');assert.equal(notes.doc.getElementById('ogcNewPhone').value,fields.ogcNewPhone);assert.equal(notes.doc.getElementById('ogcNewLandline').value,fields.ogcNewLandline);assert.equal(notes.doc.getElementById('ogcNewEmail').value,fields.ogcNewEmail);assert.equal(notes.doc.getElementById('ogcNewAddress').value,fields.ogcNewAddress);assert.equal(notes.doc.getElementById('ogcNewZip').value,fields.ogcNewZip);assert.equal(notes.doc.getElementById('ogcNewCity').value,fields.ogcNewCity);assert.equal(notes.doc.getElementById('ogcNewTitle').value,'M');assert.equal(state(notes).lines.length,0);assert.equal(createCalls(notes).length,0);

  // A deferred client creation uses the first-step fields, with no second form.
  const final=await boot({}, {failFirstQuotation:true});apps.push(final);newMode(final);await fill(final);pickLine(final);await final.w.sendToOgust();await until(()=>final.doc.getElementById('ogwCreateBtn'),'new-client quotation summary');
  assert.equal(final.doc.getElementById('ogwNewCustomerForm'),null,'The final modal contains a summary, not another editable client form');assert.equal(final.doc.getElementById('ogwNewLastName'),null);assert.match(final.doc.getElementById('ogwOverlay').textContent,/Test/);assert.match(final.doc.getElementById('ogwOverlay').textContent,/Marquillies/);assert.equal(createCalls(final).length,0,'Preparation remains read-only');
  const check=final.doc.getElementById('ogwConfirmCheck');assert.ok(check,'New-client creation still needs explicit confirmation');check.checked=true;check.dispatchEvent(new final.w.Event('change',{bubbles:true}));assert.equal(final.doc.getElementById('ogwCreateBtn').disabled,false);
  await final.w.confirmOgustWrite();assert.equal(customerCreates(final).length,1);assert.equal(quoteCreates(final).length,1);const firstCustomer=customerCreates(final)[0].body;assert.equal(firstCustomer.company,'ACJ Services');assert.equal(firstCustomer.confirm,true);expectedCustomerPayload(firstCustomer.customer);
  await final.w.confirmOgustWrite();assert.equal(customerCreates(final).length,1,'Retrying only the quotation must never recreate the customer');assert.equal(quoteCreates(final).length,2);assert.ok(quoteCreates(final).every(call=>call.body.id_customer===customer.id_customer));assert.ok(quoteCreates(final).every(call=>call.body.id_company==='company-main'));

  // Inline creation selects the verified customer and duplicate clicks are inert.
  const inline=await boot();apps.push(inline);newMode(inline);await fill(inline);confirmInline(inline);const button=inline.doc.getElementById('ogcCreateClient46');assert.ok(button);assert.equal(button.disabled,false);button.click();button.click();await until(()=>inline.w.ogustClientChoiceV21.selected?.id_customer===customer.id_customer,'inline client created and selected');
  assert.equal(customerCreates(inline).length,1);assert.equal(quoteCreates(inline).length,0);expectedCustomerPayload(customerCreates(inline)[0].body.customer);assert.equal(inline.w.ogustClientChoiceV21.mode,'existing');assert.equal(inline.w.ogustClientChoiceV21.company,'ACJ Services');

  // An uncertain write remains blocked after reload rather than acquiring a new token.
  const uncertain=await boot({}, {failCustomerNetwork:true});apps.push(uncertain);newMode(uncertain);await fill(uncertain);confirmInline(uncertain);uncertain.doc.getElementById('ogcCreateClient46').click();
  await until(()=>uncertain.w.acjClientFormV46.getDraft()?.creation_status==='uncertain','uncertain customer write recorded');const attempted=customerCreates(uncertain)[0].body.customer.external_ref;assert.ok(attempted);assert.equal(uncertain.doc.getElementById('ogcCreateClient46').disabled,true);uncertain.doc.getElementById('ogcCreateClient46').click();assert.equal(customerCreates(uncertain).length,1);
  uncertain.w.acjDraftV42.save();const uncertainReload=await boot(uncertain.snapshot());apps.push(uncertainReload);await configured(uncertainReload);assert.equal(uncertainReload.w.acjClientFormV46.getDraft().reference,attempted);assert.equal(uncertainReload.w.acjClientFormV46.getDraft().creation_status,'uncertain');confirmInline(uncertainReload);assert.equal(uncertainReload.doc.getElementById('ogcCreateClient46').disabled,true);uncertainReload.doc.getElementById('ogcCreateClient46').click();assert.equal(customerCreates(uncertainReload).length,0);
  pickLine(uncertainReload);await uncertainReload.w.sendToOgust();assert.equal(uncertainReload.doc.getElementById('ogwOverlay'),null,'A deferred quote cannot bypass an uncertain client write');assert.equal(customerCreates(uncertainReload).length,0);assert.equal(quoteCreates(uncertainReload).length,0);
  for(const app of apps)assert.equal(app.errors.length,0,app.errors.map(error=>error.stack||error.message).join('\n'));
  console.log('Client-first production DOM: complete step-one form, late-config edits, partial draft/reload, notes import, summary-only final creation, same-ID quotation retry, one-shot inline creation and durable uncertain-write guard OK; APIs fully mocked.');
}finally{for(const app of apps)app.dom.window.close()}
