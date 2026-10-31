// Production scripts, synthetic quotes and mocked APIs. No real quote or email writes.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'history-test.cjs')),{JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const customer={id_customer:'client-main',label:'Client de test',address:'Adresse de test'};
const rate={id:'clean-rate',product:'clean-product',title:'Entretien régulier du logement',unit:'H',vat:10,price:32};
const quote={version:6,societe:'ACJ Services',numero_devis:'ACJ-HISTORY-TEST',date:'2026-10-31',mode:'menage',client:{nom:customer.label,telephone:'',adresse:customer.address,id_customer:customer.id_customer},lignes:[{line_id:'history-line',designation:'Entretien du logement',detail:'4 h',type:'service',activite:'menage',methode_chiffrage:'hourly',quantite:4,unite:'h',prix_unitaire_ttc:32,tva_rate:10,ogust_rate_id:rate.id,ogust_product_level_id:rate.product,ogust_unit:'H'}],totaux:{ht:116.36,tva:11.64,ttc:128},notes:''};
const key=`${quote.societe}|${quote.numero_devis}`;
const second={...quote,societe:'ACJ Services Lens',numero_devis:'LENS-HISTORY-TEST',client:{...quote.client,nom:'Client Lens',id_customer:'client-lens'}};
const unknown={...quote,numero_devis:'UNKNOWN-CLIENT',client:{nom:'Client à retrouver',adresse:'Adresse de test'}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await wait(20)}throw Error('History UI timed out')}
class Scripts extends ResourceLoader{fetch(url){if(new URL(url).pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,path.basename(new URL(url).pathname))));return null}}
const errors=[],calls=[];let failUpdate=false,locked=false,remoteLocked=false,releaseSearch=null,holdUpdate=false,releaseUpdate=null;
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...x)=>errors.push(Error(x.join(' '))));
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>false;
  w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.localStorage.setItem('acj_devis_saved_v6',JSON.stringify([quote,second,unknown]));
  w.localStorage.setItem('acj_devis_history_meta_v29',JSON.stringify({[key]:{ogust_id:'quote-42',ogust_number:'DEV-1042',ogust_status:'B',ogust_snapshot:quote}}));
  w.fetch=async(input,init={})=>{const url=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;calls.push({url,body});
    assert.notEqual(body?.action,'create','History must not create a duplicate quote');assert.ok(!/send|email/.test(body?.action||''),'No mail may be sent');
    if(url.pathname==='/api/ogust-devis')return response({ok:true,auth_required:false});
    if(url.pathname==='/api/ogust-history')return response({ok:true,rates:[rate],prestations:[{id:rate.product,title:rate.title}],records:[]});
    if(url.pathname==='/api/ogust-customer')return new Promise(resolve=>{releaseSearch=()=>resolve(response({ok:true,customer_candidates:[{...customer,label:unknown.client.nom,id_customer:'stale-client'}]}))});
    if(body?.action==='update'){
      assert.equal(body.id_quotation,'quote-42');assert.equal(body.company,quote.societe);assert.equal(body.id_customer,customer.id_customer);
      if(remoteLocked)return response({ok:false,error:'REMOTE_STATUS_LOCKED',remote_verified:true,id_quotation:'quote-42',ogust_status:remoteLocked,ogust_status_label:remoteLocked==='C'?'Accepté':remoteLocked},409);
      if(holdUpdate)return new Promise(resolve=>{releaseUpdate=()=>resolve(response({ok:true,updated:true,id_quotation:'quote-42',ogust_number:'DEV-1042',ogust_status:'B',ogust_status_label:'Brouillon'}))});
      if(failUpdate)return response({ok:false,error:'REMOTE_QUOTE_CHANGED'},409);
      assert.equal(body.original_quote.lignes[0].quantite,4,'The baseline survives local autosave and reopening');assert.equal(body.quote.lignes[0].quantite,3);
      return response({ok:true,updated:true,id_quotation:'quote-42',ogust_number:'DEV-1042',ogust_status:'B',ogust_status_label:'Brouillon'});
    }
    return response({ok:true,quotations:url.searchParams.has('ids')?[{id_quotation:'quote-42',number:'DEV-1042',status:locked?'C':'B',status_label:locked?'Accepté':'Brouillon'}]:[],slots:[]});
  };
}});
const w=dom.window,doc=w.document,state=()=>w.eval('state'),meta=()=>JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29'))[key];
const card=()=>[...doc.querySelectorAll('.histCard')].find(x=>x.textContent.includes('DEV-1042'));
const inputQty=value=>{const input=doc.querySelector('input[aria-label="Quantité"]');input.value=String(value);input.dispatchEvent(new w.Event('input',{bubbles:true}));input.dispatchEvent(new w.Event('change',{bubbles:true}))};
try{
  await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length);await wait(90);
  w.openQuoteHistoryV29();card().querySelector('.histViewBtn').click();await until(()=>state().number===quote.numero_devis&&doc.getElementById('quoteUpdateBtnV34'));
  assert.equal(state().step,4);assert.equal(w.totals().ttc,128);assert.equal(calls.filter(x=>x.body?.action==='update').length,0,'Viewing never writes');
  assert.equal(doc.querySelector('#ogustAlt64').href,'https://my.ogust.app/');assert.ok(doc.getElementById('ogustDelivery59').textContent.includes('DEV-1042'));assert.ok(doc.getElementById('emailLaunch62').closest('#reviewActions53'),'Email is accessible in the review footer');
  assert.ok(doc.getElementById('quoteNumberTop').textContent.includes('DEV-1042'));assert.ok(w.buildPrintHTML().includes('N° DEV-1042'),'Reopened PDFs retain the official number');
  w.openQuoteHistoryV29();card().querySelector('.histEditBtn').click();await until(()=>state().step===2);assert.equal(w.ogustClientChoiceV21.selected.id_customer,customer.id_customer);
  inputQty(3);w.acjDraftV42.save();assert.equal(w.totals().ttc,96);assert.equal(meta().ogust_snapshot.lignes[0].quantite,4);
  w.newQuote();assert.equal(doc.getElementById('quoteUpdateV34'),null);assert.equal(doc.getElementById('ogustDelivery59'),null);
  w.openQuoteHistoryV29();card().querySelector('.histEditBtn').click();await until(()=>state().step===2);assert.equal(state().lines[0].qty,3,'Unsynced edits remain consultable');
  w.goStep(4);assert.equal(doc.querySelector('#ogustAlt64'),null,'Save the changed version before opening the send flow');doc.getElementById('quoteUpdateBtnV34').click();try{await until(()=>doc.getElementById('quoteUpdateResultV34')?.classList.contains('ok'))}catch(error){throw Error(`${error.message}: ${doc.getElementById('quoteUpdateResultV34')?.textContent}; ${JSON.stringify(calls.filter(x=>x.body?.action==='update').map(x=>x.body))}`)}await wait(90);
  assert.equal(doc.querySelector('#ogustAlt64')?.href,'https://my.ogust.app/','The saved version can be sent from Ogust');
  assert.equal(calls.filter(x=>x.body?.action==='update').length,1);assert.equal(meta().ogust_id,'quote-42');assert.equal(meta().ogust_number,'DEV-1042');assert.equal(meta().ogust_snapshot.lignes[0].quantite,3);assert.ok(doc.getElementById('quoteUpdateResultV34').classList.contains('ok'),'Success remains visible');
  failUpdate=true;w.goStep(2);inputQty(2);w.goStep(4);doc.getElementById('quoteUpdateBtnV34').click();await until(()=>doc.getElementById('quoteUpdateResultV34')?.textContent.includes('Rien n’a été écrasé'));
  assert.equal(meta().ogust_snapshot.lignes[0].quantite,3,'A conflict keeps the last synced baseline');assert.equal(state().lines[0].qty,2);
  failUpdate=false;for(const code of ['C','P']){remoteLocked=code;doc.getElementById('quoteUpdateBtnV34').click();await until(()=>meta().ogust_status===code);assert.equal(doc.getElementById('quoteUpdateBtnV34').disabled,true,'The verified remote status controls editing');assert.equal(doc.getElementById('emailLaunch62').disabled,true);assert.ok(doc.getElementById('reviewStatus64').textContent.includes(code==='C'?'Accepté':code));assert.ok(doc.getElementById('quoteUpdateResultV34').textContent.includes('Ogust indique'));const all=JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29'));all[key].ogust_status='B';all[key].ogust_status_label='Brouillon';w.localStorage.setItem('acj_devis_history_meta_v29',JSON.stringify(all));w.acjQuotationUpdateV34.render()}remoteLocked=false;
  failUpdate=false;holdUpdate=true;doc.getElementById('quoteUpdateBtnV34').click();await until(()=>releaseUpdate);w.newQuote();w.setCompany('ACJ Services Lens');const freshRef=state().number;releaseUpdate();await wait(120);
  assert.equal(state().number,freshRef);assert.equal(state().company,'ACJ Services Lens');assert.ok(!doc.getElementById('quoteNumberTop').textContent.includes('DEV-1042'),'A late update cannot relabel a new quote');
  assert.ok(!JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29'))[`ACJ Services Lens|${freshRef}`]?.ogust_id,'A late response cannot link another company’s draft');
  locked=true;w.openQuoteHistoryV29();await until(()=>card()?.querySelector('.histEditBtn').disabled);assert.equal(card().querySelector('.histViewBtn').disabled,false);
  await w.openSavedQuoteV59(quote.societe,quote.numero_devis,'edit');await wait(40);assert.equal(state().step,4);assert.equal(doc.getElementById('quoteUpdateBtnV34').disabled,true,'Accepted quotes remain read-only');
  const pending=w.openSavedQuoteV59(unknown.societe,unknown.numero_devis,'view');await until(()=>releaseSearch);
  await w.openSavedQuoteV59(second.societe,second.numero_devis,'edit');releaseSearch();await pending;
  assert.equal(state().company,second.societe);assert.equal(w.ogustClientChoiceV21.selected.id_customer,'client-lens','Late client lookup cannot replace another company’s client');
  assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
  console.log('History: direct view/edit, preserved local changes and synced baseline, same-ID update, conflict/locked guards, tenant-safe reopen, native Ogust handoff; no real writes or emails.');
}finally{dom.window.close()}
