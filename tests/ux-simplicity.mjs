// Exercise the shipped scripts, including idle rendering and restored drafts.
// All service calls are simulated; no business record leaves this test.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'ux-test.cjs'));
const {JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const customer={id_customer:'ux-client',label:'Client de test',address:'Adresse de test'};
const rate={id:'clean-rate',product:'clean-product',title:'Entretien régulier du logement',unit:'H',vat:10,price:32};
const line={id:'ux-line',designation:'Ménage hebdomadaire',type:'service',activity:'menage',qty:4,unit:'h',unitPriceTTC:32,vat:10,pricingMethod:'hourly',ogustRateId:rate.id,ogustProductLevelId:rate.product,ogustProductCompany:'ACJ Services'};
const draft={version:42,state:{step:2,number:'ACJ-UX-TEST',company:'ACJ Services',client:customer.label,tel:'',address:customer.address,mode:'menage',activePreset:null,builderMethod:'hourly',notes:'',lines:[line]},inputs:{client:customer.label,tel:'',adresse:customer.address,notes:'',aiChantierText:'Texte de chantier conservé.'},clientChoice:{mode:'existing',selected:customer}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<120;i++){if(check())return;await wait(20)}throw Error('UI initialization timed out')}
class Scripts extends ResourceLoader{
  fetch(url){const pathname=new URL(url).pathname;if(pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,path.basename(pathname))));return null}
}
const errors=[],calls=[];
const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));vc.on('error',(...args)=>errors.push(Error(args.join(' '))));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});
  w.localStorage.setItem('acj_devis_active_v42',JSON.stringify(draft));
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};
  w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
  w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.fetch=async(input,init={})=>{
    const url=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;calls.push({path:url.pathname,body});
    assert.notEqual(body?.action,'create','UX work must not create a business record');
    const data=url.pathname==='/api/ogust-devis'?{ok:true,auth_required:false}:url.pathname==='/api/ogust-history'?{ok:true,rates:[rate],prestations:[{id:rate.product,title:rate.title}],records:[]}:{ok:true,slots:[],customers:[],quotations:[]};
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
}});
const w=dom.window,doc=w.document,state=()=>w.eval('state');
try{
  await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length);
  await wait(120);
  assert.equal(errors.length,0,errors.map(error=>error.stack).join('\n'));
  assert.equal(doc.querySelectorAll('.fastProgress42 button').length,3);
  assert.ok(![...doc.scripts].some(script=>/ux-v2[67]|navigation-v22|availability-v31/.test(script.src)),'Obsolete presentation/planning modules are not loaded');
  assert.equal(doc.getElementById('aiPhotoSummary53').closest('details').open,false,'Photos are optional and collapsed');
  const advanced=()=>doc.querySelector('.lineDetails53');
  assert.equal(advanced().open,false,'The common edit shows only quantity and TTC price');
  for(const name of ['Quantité','Prix unitaire TTC'])assert.equal(doc.querySelector(`input[aria-label="${name}"]`).closest('details'),null);
  assert.equal(doc.querySelector('.ogRateSelect40').closest('details'),advanced());
  const quantity=doc.querySelector('input[aria-label="Quantité"]');quantity.value='5';quantity.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.totals().ttc,160,'The total updates while typing, before blur');
  assert.match(doc.getElementById('fastLiveTotal42').textContent,/160/);assert.equal(quantity.isConnected,true,'Typing retains the input node and caret');
  quantity.value='4';quantity.dispatchEvent(new w.Event('input',{bubbles:true}));
  const price=doc.querySelector('input[aria-label="Prix unitaire TTC"]');price.value='33';price.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.totals().ttc,132);assert.equal(price.isConnected,true);
  price.value='32';price.dispatchEvent(new w.Event('input',{bubbles:true}));
  advanced().open=true;
  const designation=doc.querySelector('.lineEdit textarea');designation.value='Nettoyer la cuisine\nNettoyer les vitres';designation.dispatchEvent(new w.Event('input',{bubbles:true}));designation.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(advanced().open,true,'Editing retains the open disclosure');
  assert.equal(state().lines[0].designation,'Nettoyer la cuisine\nNettoyer les vitres');
  assert.equal(doc.getElementById('aiChantierText').value,'Texte de chantier conservé.');
  Object.assign(state().lines[0],{ogustRateId:'retired',ogustProductLevelId:'retired'});advanced().open=false;
  w.goStep(4);await w.sendToOgust();
  assert.equal(state().step,2);assert.equal(advanced().open,true,'A blocking rate opens the exact hidden editor');
  assert.equal(doc.activeElement,doc.querySelector('.ogRateSelect40'));
  const select=doc.querySelector('.ogRateSelect40');select.value=rate.id;select.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.totals().ttc,128);assert.equal(state().lines[0].qty,4);assert.equal(state().lines[0].unitPriceTTC,32);
  assert.equal(doc.getElementById('ogRateStatus40'),null);
  w.goStep(4);
  assert.match(doc.getElementById('reviewLiveTotal53').textContent,/128/);
  assert.equal(doc.getElementById('av32Panel').tagName,'DETAILS');assert.equal(doc.getElementById('av32Panel').open,false);
  assert.ok(doc.querySelector('#reviewActions53 button[onclick="sendToOgust()"]'),'The final action stays in the review footer');
  assert.equal(doc.querySelector('.secondaryActions53').open,false);
  assert.ok(doc.querySelector('.secondaryActions53 button[onclick="printPDF()"]'),'PDF remains available');
  await wait(380);let mutations=0;
  const observer=new w.MutationObserver(records=>mutations+=records.length);observer.observe(doc.body,{childList:true,subtree:true,attributes:true});
  await wait(250);observer.disconnect();
  assert.ok(mutations<10,`Idle UI must settle instead of continuously rewriting the DOM (${mutations} mutations)`);
  assert.equal(errors.length,0,errors.map(error=>error.stack).join('\n'));
  assert.equal(calls.filter(call=>call.body?.action==='create').length,0);
  console.log(`Simplified UX: draft/editing preserved; optional photos/details/planning; final footer and rate-error focus; ${mutations} idle DOM mutations in 250 ms; no real writes.`);
}finally{dom.window.close()}
