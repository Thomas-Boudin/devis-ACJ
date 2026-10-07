// Production DOM regression: quotation matches require a verified Ogust read.
// Every API is mocked. No customer or quotation is written to an external service.
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
const customer={id_customer:'mock-customer-47',label:'Alex Test',phone:'0700000000',email:'client-test@example.com',address:'8 rue du Test, 59134 Marquillies',zip:'59134',city:'Marquillies',code:'CLI-TEST47'};
const rates=[{id:'rate-garden',product:'prod-garden',title:"Jardinage à l'heure",unit:'H',vat:20,price:47}];
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,description){for(let i=0;i<120;i++){if(fn())return;await wait(20)}throw new Error(`Timed out: ${description}`)}
class LocalScripts extends ResourceLoader{
  fetch(url){const u=new URL(url);if(u.origin==='https://thomas-boudin.github.io'&&u.pathname.startsWith('/devis-ACJ/')&&u.pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,u.pathname.slice('/devis-ACJ/'.length))));return null}
}
async function boot(createResponses){
  const errors=[],calls=[],alerts=[];
  const pending=[...createResponses];
  const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));vc.on('error',(...items)=>errors.push(new Error(items.map(String).join(' '))));
  const dom=new JSDOM(html,{url:'https://thomas-boudin.github.io/devis-ACJ/?v=47',resources:new LocalScripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
    w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
    w.alert=message=>alerts.push(String(message));w.confirm=()=>false;
    w.fetch=async(input,init={})=>{
      const u=new URL(String(input?.url||input));const body=typeof init.body==='string'?JSON.parse(init.body):null;
      const call={path:u.pathname,method:String(init.method||'GET'),query:u.search,body};calls.push(call);
      if(call.path==='/api/ogust-devis')return response({ok:true,auth_required:false});
      if(call.path==='/api/ogust-history')return response(u.searchParams.get('rates')==='1'?{ok:true,rates}:{ok:true,prestations:rates.map(rate=>({id:rate.product,title:rate.title})),records:[]});
      if(call.path==='/api/ogust-customer'&&body?.action==='search')return response({ok:true,customer_candidates:[customer]});
      if(call.path==='/api/ogust-quotation'&&body?.action==='prepare')return response({ok:true,customer_locked:true,selected_customer_id:body.id_customer,customer_candidates:[customer],company_choices:[{id_company:'company-main',label:'Établissement principal'}],preview:{...body.quote,line_count:body.quote.lignes.length,total_ttc:body.quote.totaux.ttc},draft:{supported:true,label:'Brouillon'}});
      if(call.path==='/api/ogust-quotation'&&body?.action==='create'){
        assert.ok(pending.length,'Every creation response must be explicitly mocked');
        const fixture=pending.shift();return response(fixture.data,fixture.status||200);
      }
      return response({ok:true,slots:[],customers:[],quotations:[]});
    };
  }});
  const w=dom.window;await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length===1,'production scripts loaded');
  await wait(90);assert.equal(errors.length,0,errors.map(error=>error.stack||error.message).join('\n'));
  return {dom,w,doc:w.document,calls,alerts,errors};
}
const state=app=>app.w.eval('state');
const metadata=app=>JSON.parse(app.w.localStorage.getItem('acj_devis_history_meta_v29')||'{}');
const quoteMeta=app=>metadata(app)[`ACJ Services|${state(app).number}`]||{};
const result=app=>app.doc.getElementById('ogwResult');
const button=app=>app.doc.getElementById('ogwCreateBtn');
const createCalls=app=>app.calls.filter(call=>call.path==='/api/ogust-quotation'&&call.body?.action==='create');
function input(app,id,value){const field=app.doc.getElementById(id);assert.ok(field,`Input ${id} exists`);field.value=String(value);field.dispatchEvent(new app.w.Event('input',{bubbles:true}));return field}
async function prepare(app){
  input(app,'ogcSearch','Alex');await until(()=>app.doc.querySelector('#ogcResults .ogcResult'),'mock customer found');app.doc.querySelector('#ogcResults .ogcResult').click();
  assert.equal(app.w.ogustClientChoiceV21.selected.id_customer,customer.id_customer);app.w.goStep(2);
  const tariff=[...app.doc.querySelectorAll('#ogPickerResults41 button')].find(item=>item.querySelector('strong')?.textContent===rates[0].title);assert.ok(tariff,'Hourly tariff available');tariff.click();input(app,'builderHours',2);app.w.addBuiltService();
  assert.equal(state(app).lines.length,1);assert.equal(app.w.totals().ttc,94);app.w.goStep(4);
  await app.w.sendToOgust();await until(()=>button(app),'quotation confirmation ready');assert.equal(button(app).disabled,false);assert.equal(createCalls(app).length,0,'Preparing never writes');
}
function assertNoFalseLink(app,number,id){
  const meta=quoteMeta(app);assert.ok(!meta.ogust_id,'Unverified response cannot link history to an Ogust quotation');assert.ok(!meta.ogust_number,'Unverified response cannot set an official history number');
  assert.ok(!app.doc.getElementById('quoteNumberTop').textContent.includes(number),'Unverified number is not shown in the header');
  assert.ok(!app.w.buildPrintHTML().includes(number),'Unverified number is not used in the PDF');
  assert.ok(!JSON.stringify(metadata(app)).includes(id),'Unverified ID does not enter history metadata');
  assert.match(app.w.buildPrintHTML(),/BROUILLON · réf\./,'Quote remains a local draft');
}
const apps=[];
try{
  // Legacy or erroneous ok/already_exists responses cannot lock this modal or
  // silently link a random quotation. The exact same modal must remain retryable.
  for(const verification of ['missing',false,'missing-id']){
    const bogus={ok:true,already_exists:true,id_quotation:verification==='missing-id'?'':'wrong-quotation-47',ogust_number:'BOGUS47',ogust_status:'V',...(verification==='missing'?{}:{verified:verification==='missing-id'?true:verification})};
    const app=await boot([{data:bogus},{data:{ok:true,id_quotation:'created-quotation-47',ogust_number:'CREATED47',ogust_status:'B',verified:true}}]);apps.push(app);await prepare(app);
    await app.w.confirmOgustWrite();await wait(80);
    assert.match(result(app).textContent,/n’a pas été vérifiée/);assert.ok(result(app).classList.contains('ogwError'),'Unverified duplicate is an error');assert.equal(button(app).disabled,false,'Unverified duplicate permits retry');assert.match(button(app).textContent,/Réessayer/);assertNoFalseLink(app,'BOGUS47','wrong-quotation-47');
    await app.w.confirmOgustWrite();await until(()=>button(app).textContent==='Créé dans Ogust','retry accepted in the same modal');await wait(80);
    assert.equal(createCalls(app).length,2);assert.equal(button(app).disabled,true);assert.match(result(app).textContent,/créé et relu/);assert.match(result(app).textContent,/created-quotation-47/);
    assert.equal(quoteMeta(app).ogust_id,'created-quotation-47');assert.equal(quoteMeta(app).ogust_number,'CREATED47');assert.equal(quoteMeta(app).ogust_status,'B');assert.match(app.doc.getElementById('quoteNumberTop').textContent,/CREATED47/);assert.match(app.w.buildPrintHTML(),/N° CREATED47/);
    assert.equal(JSON.parse(app.w.localStorage.getItem('acj_devis_saved_v6')).length,1,'Successful retry records one local quote');
  }
  // A verified exact match is a successful reconciliation, never a second POST.
  const existing=await boot([{data:{ok:true,already_exists:true,id_quotation:'existing-quotation-47',ogust_number:'EXISTING47',ogust_status:'B',verified:true}}]);apps.push(existing);await prepare(existing);await existing.w.confirmOgustWrite();await wait(80);
  assert.ok(result(existing).classList.contains('ogwGood'));assert.match(result(existing).textContent,/existant relu et vérifié/);assert.match(result(existing).textContent,/EXISTING47/);assert.match(result(existing).textContent,/Aucune copie supplémentaire/);assert.equal(button(existing).textContent,'Déjà présent');assert.equal(button(existing).disabled,true);
  assert.equal(quoteMeta(existing).ogust_id,'existing-quotation-47');assert.equal(quoteMeta(existing).ogust_number,'EXISTING47');assert.equal(quoteMeta(existing).ogust_status,'B');assert.equal(quoteMeta(existing).ogust_status_label,'Brouillon');assert.match(existing.doc.getElementById('quoteNumberTop').textContent,/EXISTING47/);assert.match(existing.w.buildPrintHTML(),/N° EXISTING47/);
  assert.equal(JSON.parse(existing.w.localStorage.getItem('acj_devis_saved_v6')).length,1,'Verified duplicate preserves a local snapshot');await existing.w.confirmOgustWrite();assert.equal(createCalls(existing).length,1,'Confirmed duplicate cannot create a copy');
  // A reused reference with different contents is a conflict, not a success.
  // Deliberately adversarial fields ensure even fetch wrappers honor HTTP status.
  const conflict=await boot([{status:409,data:{ok:true,error:'QUOTATION_REFERENCE_CONFLICT',already_exists:true,id_quotation:'conflicting-quotation-47',ogust_number:'CONFLICT47',ogust_status:'V',verified:true}}]);apps.push(conflict);await prepare(conflict);await conflict.w.confirmOgustWrite();await wait(80);
  assert.ok(result(conflict).classList.contains('ogwError'));assert.match(result(conflict).textContent,/Un devis différent utilise déjà cette référence/);assert.match(result(conflict).textContent,/Aucun nouveau devis créé/);assert.equal(button(conflict).disabled,false);assert.match(button(conflict).textContent,/Réessayer/);assertNoFalseLink(conflict,'CONFLICT47','conflicting-quotation-47');assert.equal(createCalls(conflict).length,1);assert.ok(!conflict.doc.getElementById('finalStatus').classList.contains('ok'));
  for(const app of apps){assert.equal(app.errors.length,0,app.errors.map(error=>error.stack||error.message).join('\n'));assert.equal(app.calls.filter(call=>call.path==='/api/ogust-customer'&&call.body?.action==='create').length,0,'No customer creation requested')}
  console.log('Quotation duplicates: unverified matches rejected without history/PDF adoption; same-modal verified retry succeeds; verified exact duplicate retains number/status without a copy; HTTP 409 reference conflict is actionable. All production scripts and APIs fully mocked.');
}finally{await wait(100);for(const app of apps)app.dom.window.close()}
