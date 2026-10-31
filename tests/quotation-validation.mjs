// Complete production UI with a synthetic unnumbered Ogust draft. No live calls.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'validation-test.cjs')),{JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const rate={id:'r1',product:'p1',title:'Entretien du logement',unit:'H',vat:10,price:32};
const quote={version:6,societe:'ACJ Services',numero_devis:'ACJ-VALIDATION-TEST',date:'2026-10-31',mode:'menage',client:{nom:'Client de démonstration',telephone:'',adresse:'Adresse fictive',id_customer:'c1',email:'client@example.test'},lignes:[{line_id:'line-1',designation:rate.title,detail:'2 h',type:'service',activite:'menage',methode_chiffrage:'hourly',quantite:2,unite:'h',prix_unitaire_ttc:32,tva_rate:10,ogust_rate_id:'r1',ogust_product_level_id:'p1',ogust_unit:'H'}],totaux:{ht:58.18,tva:5.82,ttc:64},notes:''};
const key=`${quote.societe}|${quote.numero_devis}`,clone=x=>JSON.parse(JSON.stringify(x)),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<180;i++){if(fn())return;await wait(15)}throw Error('Validation UI timed out')}
let stage='B',number='',missingNumber=false,failValidate=false,holdValidate=false,releaseValidate=null,pdfLoads=0;
const calls=[],errors=[],downloads=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...x)=>errors.push(Error(x.join(' '))));
class Scripts extends ResourceLoader{fetch(url){const pathname=new URL(url).pathname;if(pathname.endsWith('.js')){if(pathname.includes('/vendor/'))pdfLoads++;return Promise.resolve(fs.readFileSync(path.join(root,pathname.replace(/^\/devis-ACJ\//,''))))}return null}}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function header(extra={}){return{ok:true,id_quotation:'q1',ogust_status:stage,ogust_status_label:{B:'Brouillon',V:'Validé',E:'Envoyé'}[stage],ogust_number:number,...extra}}
function prepared(){if(stage==='B')return header({prepared:false,needs_validation:true});if(!number)return header({prepared:false,needs_number:true});return header({prepared:true,recipient_email:'verified@example.test'})}
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,Blob,File});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>false;
  w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.URL.createObjectURL=file=>{downloads.push(file);return 'blob:synthetic-validation-pdf'};w.URL.revokeObjectURL=()=>{};
  w.localStorage.setItem('acj_devis_saved_v6',JSON.stringify([quote]));w.localStorage.setItem('acj_devis_history_meta_v29',JSON.stringify({[key]:{ogust_id:'q1',ogust_status:'B',ogust_snapshot:quote}}));
  w.fetch=async(input,init={})=>{
    const url=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;calls.push({url,body});
    if(url.pathname==='/api/ogust-devis')return response({ok:true,auth_required:false});
    if(url.pathname==='/api/ogust-history')return response({ok:true,rates:[rate],prestations:[{id:'p1',title:rate.title}],records:[]});
    if(body?.action){assert.equal(body.id_quotation,'q1');assert.equal(body.company,quote.societe);assert.equal(body.id_customer,'c1');assert.equal(body.quote.numero_devis,quote.numero_devis);assert.equal(body.quote.lignes[0].quantite,2)}
    if(body?.action==='prepare_delivery'){assert.equal(body.confirm_validate,undefined);assert.equal(body.confirm_sent,undefined);return response(prepared())}
    if(body?.action==='validate_for_delivery'){
      assert.equal(body.confirm_validate,true);assert.equal(body.confirm_sent,undefined);
      const finish=()=>{if(failValidate)return response({ok:false,error:'VALIDATION_NOT_CONFIRMED'},502);stage='V';number=missingNumber?'':'DEV-0067';return response({...prepared(),validation_verified:true})};
      if(holdValidate)return new Promise(resolve=>{releaseValidate=()=>resolve(finish())});return finish();
    }
    if(body?.action==='mark_sent'){assert.equal(body.confirm_sent,true);assert.equal(stage,'V');stage='E';return response(header({verified:true}))}
    if(body)throw Error('No create, edit, mail or unrelated writes are allowed');return response({ok:true,quotations:[],slots:[]});
  };
}});
const w=dom.window,doc=w.document,state=()=>w.eval('state'),meta=()=>JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29'))[key],validationCalls=()=>calls.filter(x=>x.body?.action==='validate_for_delivery'),sentCalls=()=>calls.filter(x=>x.body?.action==='mark_sent');
doc.addEventListener('click',event=>{if(event.target.closest('a[href^="mailto:"],a[download]'))event.preventDefault()});
async function reopen(){await w.openSavedQuoteV59(quote.societe,quote.numero_devis,'view');await until(()=>doc.getElementById('emailLaunch62'));doc.getElementById('emailLaunch62').click();await until(()=>doc.getElementById('emailValidate67')||doc.getElementById('emailRecipient62'))}
function resetDraft(){stage='B';number='';missingNumber=false;failValidate=false;holdValidate=false;releaseValidate=null;const all=JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29'));all[key]={ogust_id:'q1',ogust_status:'B',ogust_snapshot:clone(quote)};w.localStorage.setItem('acj_devis_history_meta_v29',JSON.stringify(all));w.localStorage.setItem('acj_devis_saved_v6',JSON.stringify([quote]))}
try{
  await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length);await wait(60);await reopen();
  assert.equal(meta().ogust_status,'B');assert.equal(meta().ogust_number||'','');assert.equal(validationCalls().length,0);assert.equal(sentCalls().length,0);assert.equal(pdfLoads,0,'An unvalidated draft cannot generate the final numbered PDF');assert.equal(doc.getElementById('emailMailto62'),null);
  holdValidate=true;doc.getElementById('emailValidate67').click();doc.getElementById('emailValidate67').click();await until(()=>releaseValidate);assert.equal(validationCalls().length,1,'Double validation click produces one request');assert.equal(doc.getElementById('emailValidate67').disabled,true);releaseValidate();await until(()=>doc.getElementById('emailRecipient62'));
  assert.equal(meta().ogust_status,'V');assert.equal(meta().ogust_number,'DEV-0067');assert.equal(state().number,quote.numero_devis,'The local key stays stable');assert.equal(meta().ogust_id,'q1');assert.equal(doc.getElementById('quoteUpdateBtnV34').disabled,true,'Validation protects content editing');assert.equal(doc.getElementById('emailLaunch62').disabled,false,'Validated quotes can be sent');assert.equal(sentCalls().length,0);
  const mail=new URL(doc.getElementById('emailMailto62').href);assert.equal(decodeURIComponent(mail.pathname),'verified@example.test');assert.ok(mail.searchParams.get('subject').includes('DEV-0067'));assert.ok(!mail.searchParams.get('subject').includes(quote.numero_devis));doc.getElementById('emailMailto62').click();assert.equal(downloads.at(-1).name,'Devis-DEV-0067.pdf');assert.equal(meta().ogust_status,'V','Opening a mailbox is not proof of sending');
  doc.getElementById('emailConfirm62').click();await until(()=>meta().ogust_status==='E');assert.equal(sentCalls().length,1);assert.equal(validationCalls().length,1);w.acjEmailDelivery62.close();
  resetDraft();missingNumber=true;await reopen();const before=validationCalls().length;doc.getElementById('emailValidate67').click();await until(()=>doc.getElementById('emailRetry67')&&!doc.getElementById('emailValidate67'));assert.equal(meta().ogust_status,'V');assert.equal(doc.getElementById('emailMailto62'),null);assert.equal(meta().ogust_number||'','');number='DEV-ARRIVED';doc.getElementById('emailRetry67').click();await until(()=>doc.getElementById('emailRecipient62'));assert.equal(meta().ogust_number,'DEV-ARRIVED');assert.equal(validationCalls().length,before+1,'Number retry does not repeat validation');w.acjEmailDelivery62.close();
  resetDraft();failValidate=true;await reopen();doc.getElementById('emailValidate67').click();await until(()=>doc.querySelector('.emailMessage62')?.classList.contains('err'));assert.equal(meta().ogust_status,'B');assert.equal(doc.getElementById('emailMailto62'),null);const failures=validationCalls().length;doc.getElementById('emailRetry67').click();await until(()=>!doc.getElementById('emailValidate67').disabled);assert.equal(validationCalls().length,failures,'Retrying preparation never replays a failed validation');w.acjEmailDelivery62.close();
  resetDraft();holdValidate=true;await reopen();doc.getElementById('emailValidate67').click();await until(()=>releaseValidate);w.newQuote();w.setCompany('ACJ Services Lens');const fresh=state().number;releaseValidate();await until(()=>meta().ogust_status==='V');assert.equal(state().company,'ACJ Services Lens');assert.equal(state().number,fresh);assert.equal(doc.getElementById('emailOverlay62'),null);assert.ok(!doc.getElementById('quoteNumberTop').textContent.includes('DEV-0067'));
  assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
  console.log('Validation UI: unnumbered draft waits for explicit single validation; verified V/official PDF/recipient/body, separate sent confirmation, missing-number read retry, failure and late-company isolation. Synthetic APIs only.');
}finally{w.close()}
