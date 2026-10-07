// Complete production DOM: multiline designations and explicit per-line tariffs.
// APIs are mocked; no customer, quotation or other business record is created.
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
const customer={id_customer:'mock-client-48',label:'Alex Test',phone:'0700000000',email:'client-test@example.com',address:'8 rue du Test, 59134 Marquillies',zip:'59134',city:'Marquillies',code:'CLI-TEST48'};
const rates=[
  {id:'garden-h20',product:'garden',title:"Jardinage à l'heure",unit:'H',vat:20,price:47},
  {id:'fournitures-q10',product:'fournitures',title:'Fournitures / matériel',unit:'Q',vat:10,price:15},
  {id:'fournitures-q20',product:'fournitures',title:'Fournitures / matériel',unit:'Q',vat:20,price:18},
  {id:'clean-h10',product:'clean',title:'Entretien régulier du logement',unit:'H',vat:10,price:32},
  {id:'garden-f20',product:'garden-flat',title:'Forfait jardinage',unit:'F',vat:20,price:150},
  {id:'travel-k20',product:'travel',title:'Déplacements',unit:'K',vat:20,price:.7},
  {id:'unsupported',product:'unsupported',title:'Tarif sans unité reconnue',unit:'X',vat:20,price:12}
];
const lensRates=[
  {id:'garden-h20-lens',product:'garden-lens',title:"Jardinage à l'heure Lens",unit:'H',vat:20,price:50},
  {id:'fournitures-q20-lens',product:'fournitures-lens',title:'Fournitures / matériel Lens',unit:'Q',vat:20,price:30}
];
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,description){for(let i=0;i<140;i++){if(fn())return;await wait(20)}throw new Error(`Timed out: ${description}`)}
class LocalScripts extends ResourceLoader{
  fetch(url){const u=new URL(url);if(u.origin==='https://thomas-boudin.github.io'&&u.pathname.startsWith('/devis-ACJ/')&&u.pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,u.pathname.slice('/devis-ACJ/'.length))));return null}
}
async function boot(saved={}){
  const errors=[],calls=[],alerts=[],prints=[],pendingLens=[];let holdLens=false;
  const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));vc.on('error',(...items)=>errors.push(new Error(items.map(String).join(' '))));
  const dom=new JSDOM(html,{url:'https://thomas-boudin.github.io/devis-ACJ/?v=48',resources:new LocalScripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});
    w.scrollTo=()=>{};w.focus=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
    w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
    w.alert=message=>alerts.push(String(message));w.confirm=()=>false;
    w.print=()=>{const titles=[...w.document.querySelectorAll('#acjPrintStageV11 .printLineTitle')];prints.push(titles.map(title=>({text:title.textContent,whiteSpace:w.getComputedStyle(title).whiteSpace})));w.dispatchEvent(new w.Event('afterprint'))};
    for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
    w.fetch=async(input,init={})=>{
      const u=new URL(String(input?.url||input)),body=typeof init.body==='string'?JSON.parse(init.body):null;
      const call={path:u.pathname,method:String(init.method||'GET'),query:u.search,body};calls.push(call);
      if(call.path==='/api/ogust-devis')return response({ok:true,auth_required:false});
      if(call.path==='/api/ogust-history'){
        const company=u.searchParams.get('company'),catalog=company==='ACJ Services Lens'?lensRates:rates;
        if(u.searchParams.get('rates')==='1'&&company==='ACJ Services Lens'&&holdLens)return new Promise(resolve=>pendingLens.push(()=>resolve(response({ok:true,rates:catalog}))));
        return response(u.searchParams.get('rates')==='1'?{ok:true,rates:catalog}:{ok:true,prestations:catalog.map(rate=>({id:rate.product,title:rate.title})),records:[]});
      }
      if(call.path==='/api/ogust-customer'&&body?.action==='search')return response({ok:true,customer_candidates:[customer]});
      if(call.path==='/api/ogust-quotation'&&body?.action==='prepare')return response({ok:true,customer_locked:true,selected_customer_id:body.id_customer,customer_candidates:[customer],company_choices:[{id_company:'company-test',label:'Établissement principal'}],preview:{...body.quote,line_count:body.quote.lignes.length,total_ttc:body.quote.totaux.ttc},draft:{supported:true,label:'Brouillon'}});
      assert.notEqual(body?.action,'create','This regression never requests a business write');
      return response({ok:true,slots:[],customers:[],quotations:[]});
    };
  }});
  const w=dom.window;await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.company==='ACJ Services','production scripts and account catalogue loaded');
  await wait(90);assert.equal(errors.length,0,errors.map(error=>error.stack||error.message).join('\n'));
  return {dom,w,doc:w.document,calls,alerts,errors,prints,holdLens(){holdLens=true},releaseLens(){holdLens=false;for(const release of pendingLens.splice(0))release()},snapshot(){return Object.fromEntries(Array.from({length:w.localStorage.length},(_,index)=>{const key=w.localStorage.key(index);return [key,w.localStorage.getItem(key)]}))}};
}
const state=app=>app.w.eval('state');
const card=(app,index)=>app.doc.querySelectorAll('#quoteLines .quoteLine')[index];
const select=(app,index)=>card(app,index)?.querySelector('.ogRateSelect40');
const search=(app,index)=>card(app,index)?.querySelector('.ogRateSearch40');
function edit(app,field,value,event='input'){assert.ok(field,'Editable field exists');field.value=String(value);field.dispatchEvent(new app.w.Event(event,{bubbles:true}));return field}
function input(app,id,value){return edit(app,app.doc.getElementById(id),value)}
async function knownClient(app){input(app,'ogcSearch','Alex');await until(()=>app.doc.querySelector('#ogcResults .ogcResult'),'customer found');app.doc.querySelector('#ogcResults .ogcResult').click();app.w.goStep(2);assert.equal(state(app).step,2)}
function pick(app,title,vat){const option=[...app.doc.querySelectorAll('#ogPickerResults41 button')].find(button=>button.querySelector('strong')?.textContent===title&&(vat===undefined||button.querySelector('small')?.textContent.includes(`TVA ${vat} %`)));assert.ok(option,`Catalogue tariff ${title} TVA ${vat??'any'} exists`);option.click()}
function choose(app,index,rateId){const field=select(app,index);assert.ok([...field.options].some(option=>option.value===rateId),`Explicit line choice ${rateId} is offered`);edit(app,field,rateId,'change')}
function assertPreservedCost(app,title){const line=state(app).lines[1];assert.equal(line.type,'cost','Changing a tariff never converts a supply cost into eligible labor');assert.equal(line.qty,3);assert.equal(line.unitPriceTTC,24,'Negotiated TTC unit price is preserved');assert.equal(line.designation,title,'Tariff selection never replaces the written designation');assert.equal(app.w.lineAmounts(line).ttc,72)}
let a,b,c;
try{
  const builderTitle='Tailler les arbustes\nEnlever les branches\nConserver le romarin';
  const editedTitle='Tailler le saule crevette\nRamasser & évacuer les branches\nNe pas couper le romarin';
  const costTitle='Fourniture de terreau\n3 sacs pour les massifs';
  a=await boot();await knownClient(a);pick(a,"Jardinage à l'heure");
  assert.equal(a.doc.getElementById('builderDesignation').tagName,'TEXTAREA','Builder has an immediately editable multiline designation');input(a,'builderDesignation',builderTitle);input(a,'builderHours',2);input(a,'builderRate',47);a.w.acjDraftV42.save();
  const unadded=a.snapshot();assert.equal(JSON.parse(unadded[a.w.acjDraftV42.key]).inputs.builderDesignation,builderTitle);await wait(120);a.dom.window.close();a=null;
  b=await boot(unadded);await until(()=>b.doc.getElementById('builderDesignation')?.value===builderTitle,'Unadded multiline builder restored');assert.equal(b.doc.getElementById('builderDesignation').tagName,'TEXTAREA');b.w.addBuiltService();
  assert.equal(state(b).lines[0].designation,builderTitle);assert.equal(card(b,0).querySelector('.lineEdit textarea').value,builderTitle);
  const lineText=card(b,0).querySelector('.lineEdit textarea');edit(b,lineText,editedTitle);assert.equal(state(b).lines[0].designation,editedTitle,'Typing updates state before blur');assert.ok(lineText.isConnected,'Typing does not replace the textarea or lose the caret');edit(b,lineText,editedTitle,'change');assert.equal(state(b).lines[0].designation,editedTitle);assert.equal(card(b,0).querySelector('.quoteTitle').textContent,editedTitle);assert.equal(b.w.getComputedStyle(card(b,0).querySelector('.quoteTitle')).whiteSpace,'pre-wrap');assert.equal(b.w.quotePayload().lignes[0].designation,editedTitle);
  pick(b,'Fournitures / matériel',10);input(b,'builderDesignation',costTitle);input(b,'builderHours',3);input(b,'builderRate',24);b.w.addBuiltService();
  assert.equal(state(b).lines[1].ogustRateId,'fournitures-q10');assert.equal(state(b).lines[1].vat,10);assertPreservedCost(b,costTitle);assert.ok(Math.abs(b.w.lineAmounts(state(b).lines[1]).ht-72/1.1)<.0001);
  assert.ok(select(b,1),'Each line offers an explicit searchable Ogust tariff');assert.equal(search(b,1).type,'search');edit(b,search(b,1),'');const lineSelect=select(b,1);
  for(const rateId of ['fournitures-q20','garden-h20','clean-h10','garden-f20','travel-k20'])assert.ok([...lineSelect.options].some(option=>option.value===rateId),`All valid account tariffs include ${rateId}, even with a different unit/TVA/activity`);
  assert.ok(![...lineSelect.options].some(option=>option.value==='unsupported'),'Unsupported unit is not a selectable tariff');
  edit(b,search(b,1),'FOURNITURE matériel');assert.ok([...select(b,1).options].some(option=>option.value==='fournitures-q20'),'Search finds accented/plural supply tariff');assert.ok(![...select(b,1).options].some(option=>option.value==='clean-h10'),'Search filters unrelated tariffs');
  choose(b,1,'fournitures-q20');assertPreservedCost(b,costTitle);assert.equal(state(b).lines[1].unit,'unité');assert.equal(state(b).lines[1].pricingMethod,'quantity');assert.equal(state(b).lines[1].vat,20);assert.equal(b.w.lineAmounts(state(b).lines[1]).ht,60);assert.equal(b.w.lineAmounts(state(b).lines[1]).tva,12);assert.equal(b.w.totals().ttc,166);
  let payload=b.w.quotePayload();assert.equal(payload.lignes[1].ogust_rate_id,'fournitures-q20');assert.equal(payload.lignes[1].ogust_product_level_id,'fournitures');assert.equal(payload.lignes[1].ogust_unit,'Q');assert.equal(payload.lignes[1].tva_rate,20);assert.equal(payload.lignes[1].total_ht,60);assert.equal(payload.lignes[1].prix_unitaire_ttc,24);assert.equal(payload.lignes[1].designation,costTitle);
  b.w.goStep(4);assert.equal(b.doc.querySelector('#reviewLines .name').textContent,editedTitle);assert.equal(b.w.getComputedStyle(b.doc.querySelector('#reviewLines .name')).whiteSpace,'pre-wrap');assert.match(b.doc.querySelector('#sapCreditScreen .credit strong').textContent,/47,00/,'Credit only covers the 94 € labor line');assert.match(b.doc.querySelector('#sapCreditScreen .sapScreenRow:nth-child(3) strong').textContent,/72,00/,'Supplies remain excluded');
  const printable=b.doc.createElement('div');printable.innerHTML=b.w.buildPrintHTML();assert.equal(printable.querySelector('.printLineTitle').textContent,editedTitle);assert.equal(printable.querySelectorAll('.printLineTitle')[1].textContent,costTitle);
  b.w.printPDF();await until(()=>b.doc.getElementById('acjPrintStageV11'),'Actual print stage mounted');for(const image of b.doc.querySelectorAll('#acjPrintStageV11 img'))image.dispatchEvent(new b.w.Event('load'));await until(()=>b.prints.length===1,'Print scene captured');assert.equal(b.prints[0][0].text,editedTitle);assert.equal(b.prints[0][0].whiteSpace,'pre-wrap','Actual print CSS preserves visible newlines');assert.equal(b.prints[0][1].text,costTitle);assert.equal(b.prints[0][1].whiteSpace,'pre-wrap');
  b.w.goStep(2);edit(b,search(b,1),'');
  for(const [rateId,unit,method] of [['garden-h20','h','hourly'],['garden-f20','forfait','flat'],['travel-k20','km','quantity'],['fournitures-q20','unité','quantity']]){choose(b,1,rateId);assertPreservedCost(b,costTitle);assert.equal(state(b).lines[1].unit,unit);assert.equal(state(b).lines[1].pricingMethod,method);assert.equal(state(b).lines[1].vat,20)}
  b.w.acjDraftV42.save();const saved=b.snapshot();assert.equal(JSON.parse(saved[b.w.acjDraftV42.key]).state.lines[0].designation,editedTitle);await wait(120);b.dom.window.close();b=null;
  c=await boot(saved);assert.equal(state(c).lines[0].designation,editedTitle);assert.equal(card(c,0).querySelector('.lineEdit textarea').value,editedTitle);assertPreservedCost(c,costTitle);assert.equal(state(c).lines[1].ogustRateId,'fournitures-q20');assert.equal(state(c).lines[1].vat,20);
  // Existing-account options cannot remain usable while a different company loads.
  const staleSelect=select(c,1);c.holdLens();c.w.setCompany('ACJ Services Lens');assert.equal(c.w.acjOgustRates.rates.length,0);assert.ok(![...select(c,1).options].some(option=>option.value==='fournitures-q20'));payload=c.w.quotePayload();assert.ok(!payload.lignes[1].ogust_rate_id);assert.ok(!payload.lignes[1].ogust_product_level_id);assertPreservedCost(c,costTitle);
  c.releaseLens();await until(()=>c.w.acjOgustRates.company==='ACJ Services Lens','Lens catalogue loaded');assert.ok([...select(c,1).options].some(option=>option.value==='fournitures-q20-lens'));assert.ok(![...select(c,1).options].some(option=>option.value==='fournitures-q20'));
  edit(c,staleSelect,'fournitures-q20','change');assert.ok(!state(c).lines[1].ogustRateId,'Detached selector from another account cannot reassign the line');assertPreservedCost(c,costTitle);
  choose(c,0,'garden-h20-lens');choose(c,1,'fournitures-q20-lens');assertPreservedCost(c,costTitle);assert.equal(state(c).lines[1].ogustProductCompany,'ACJ Services Lens');payload=c.w.quotePayload();assert.equal(payload.societe,'ACJ Services Lens');assert.equal(payload.lignes[1].ogust_rate_id,'fournitures-q20-lens');assert.equal(payload.lignes[1].ogust_product_level_id,'fournitures-lens');assert.equal(payload.lignes[1].total_ht,60);
  await knownClient(c);c.w.goStep(4);await c.w.sendToOgust();await until(()=>c.doc.getElementById('ogwCreateBtn'),'Exact quote prepare received');const prepared=c.calls.find(call=>call.body?.action==='prepare');assert.equal(prepared.body.company,'ACJ Services Lens');assert.equal(prepared.body.quote.lignes[0].designation,editedTitle);assert.equal(prepared.body.quote.lignes[1].designation,costTitle);assert.equal(prepared.body.quote.lignes[1].ogust_rate_id,'fournitures-q20-lens');assert.equal(prepared.body.quote.lignes[1].tva_rate,20);assert.equal(prepared.body.quote.totaux.ttc,166);
  assert.equal(c.calls.filter(call=>call.body?.action==='create').length,0);assert.equal(c.errors.length,0,c.errors.map(error=>error.stack||error.message).join('\n'));
  console.log('Line editing: multiline builder/line/draft/review/actual print preserved; searchable full-account tariffs move supply Q10→Q20 with negotiated TTC/quantity/title unchanged, correct HT/TVA/unit/method and cost-only CI treatment; delayed company switch and detached selector cannot retain an ACJ tariff. APIs mocked, no business writes.');
}finally{await wait(100);a?.dom.window.close();b?.dom.window.close();c?.dom.window.close()}
