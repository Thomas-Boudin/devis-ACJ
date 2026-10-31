// Production UI, old local metadata and synthetic Ogust responses only.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'legacy-test.cjs')),{JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const clone=x=>JSON.parse(JSON.stringify(x)),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await wait(15)}throw Error('Legacy UI timed out')}
class Scripts extends ResourceLoader{fetch(url){if(new URL(url).pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,path.basename(new URL(url).pathname))));return null}}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const remote={version:6,societe:'ACJ Services',numero_devis:'ACJ-LEGACY-TEST',date:'2026-10-31',mode:'menage',client:{nom:'Client de démonstration',telephone:'',adresse:'Adresse fictive',id_customer:'exact-customer'},lignes:[{line_id:'old-line',designation:'Entretien du logement',detail:'4 h',type:'service',activite:'menage',methode_chiffrage:'hourly',quantite:4,unite:'h',prix_unitaire_ttc:32,tva_rate:10,ogust_unit:'H'}],totaux:{ht:116.36,tva:11.64,ttc:128},notes:''};
const key=`${remote.societe}|${remote.numero_devis}`;
async function fixture({qty=4,hold=false,fail=false,status='B',linkedRate=false}={}){
  const local=clone(remote);delete local.client.id_customer;delete local.lignes[0].ogust_unit;local.lignes[0].quantite=qty;
  const original=clone(remote);if(linkedRate){original.lignes[0].ogust_rate_id='retired-rate';original.lignes[0].ogust_product_level_id='original-service'}
  const calls=[],errors=[];let release=null,failed=fail;
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...x)=>errors.push(Error(x.join(' '))));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>false;
    w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
    w.localStorage.setItem('acj_devis_saved_v6',JSON.stringify([local]));w.localStorage.setItem('acj_devis_history_meta_v29',JSON.stringify({[key]:{ogust_id:'old-quote',ogust_number:'DEV-ANCIEN',ogust_status:'OK'}}));
    w.fetch=async(input,init={})=>{
      const url=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;calls.push({url,body});
      if(url.pathname==='/api/ogust-devis')return response({ok:true,auth_required:false});
      if(url.pathname==='/api/ogust-history')return response({ok:true,rates:[],prestations:[],records:[]});
      if(url.pathname==='/api/ogust-customer')throw Error('A linked old quote must recover the exact customer, never search by name');
      if(body?.action==='recover_legacy'){
        assert.equal(body.company,remote.societe);assert.equal(body.id_quotation,'old-quote');assert.equal(body.quote,undefined,'Read-only recovery cannot enter the quote-saved interceptor');
        const result=()=>{if(failed){failed=false;return response({ok:false,error:'LEGACY_RECOVERY_FAILED'},409)}return response({ok:true,recovered:{id_quotation:'old-quote',id_customer:'exact-customer',ogust_number:'DEV-ANCIEN',ogust_status:status,ogust_status_label:status==='C'?'Accepté':'Brouillon',snapshot:clone(original)}})};
        if(hold)return new Promise(resolve=>{release=()=>resolve(result())});return result();
      }
      if(body?.action==='update'){
        assert.equal(body.company,remote.societe);assert.equal(body.id_quotation,'old-quote');assert.equal(body.id_customer,'exact-customer');assert.equal(body.original_quote.lignes[0].quantite,4);assert.equal(body.quote.lignes[0].quantite,qty);
        assert.ok(!String(body.quote.lignes[0].ogust_rate_id||'').startsWith('existing-v66:'),'UI option IDs are never sent as real catalogue IDs');
        if(linkedRate)assert.equal(body.quote.lignes[0].ogust_rate_id,'retired-rate','An old association survives an empty active catalogue');
        return response({ok:true,updated:true,id_quotation:'old-quote',ogust_number:'DEV-ANCIEN',ogust_status:'B',ogust_status_label:'Brouillon'});
      }
      if(body)throw Error('No quote creation, status change or email is allowed in this test');
      return response({ok:true,quotations:[],slots:[]});
    };
  }});
  const w=dom.window,doc=w.document,state=()=>w.eval('state'),meta=()=>JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29'))[key];
  await until(()=>w.acjDraftV42&&w.__acjFastFlowV42);await wait(70);
  return{dom,w,doc,calls,errors,state,meta,get release(){return release},open:()=>w.openSavedQuoteV59(remote.societe,remote.numero_devis,'view')};
}
for(const linkedRate of [false,true]){
  const f=await fixture({linkedRate});try{
    await f.open();await until(()=>!f.doc.getElementById('emailLaunch62')?.disabled);
    assert.equal(f.meta().ogust_status,'B','The actual quotation status replaces the old API OK status');assert.equal(f.meta().ogust_snapshot.lignes[0].quantite,4);assert.equal(f.w.ogustClientChoiceV21.selected.id_customer,'exact-customer');
    assert.equal(f.calls.filter(x=>x.body?.action==='update').length,0,'Consulting and recovering never saves remotely');assert.ok(f.doc.getElementById('quoteNumberTop').textContent.includes('DEV-ANCIEN'));assert.ok(f.w.buildPrintHTML().includes('DEV-ANCIEN'));
    f.w.renderQuoteLines();assert.ok(f.doc.querySelector('.ogRateHint40').textContent.includes('Prestation conservée'));
    assert.equal(f.errors.length,0,f.errors.map(e=>e.stack).join('\n'));
  }finally{f.dom.window.close()}
}
{
  const f=await fixture({qty:2});try{
    await f.open();assert.equal(f.state().lines[0].qty,2,'Recovery preserves unsaved local edits');assert.equal(f.meta().ogust_snapshot.lignes[0].quantite,4,'The recovered baseline is the real remote version');assert.equal(f.doc.getElementById('emailLaunch62').disabled,true,'An unsaved edit cannot be sent');
    f.doc.getElementById('quoteUpdateBtnV34').click();await until(()=>f.doc.getElementById('quoteUpdateResultV34')?.classList.contains('ok')&&f.calls.some(x=>x.body?.action==='update'));await until(()=>!f.doc.getElementById('emailLaunch62').disabled);
    assert.equal(f.meta().ogust_id,'old-quote');assert.equal(f.meta().ogust_snapshot.lignes[0].quantite,2);assert.equal(f.calls.filter(x=>x.body?.action==='update').length,1);
    assert.equal(f.errors.length,0,f.errors.map(e=>e.stack).join('\n'));
  }finally{f.dom.window.close()}
}
{
  const f=await fixture({fail:true});try{
    await f.open();assert.equal(f.meta().ogust_snapshot,undefined,'A failed read cannot fabricate a verified snapshot');f.w.acjDraftV42.save();f.w.openQuoteHistoryV29();assert.equal(f.meta().ogust_snapshot,undefined,'Local autosave cannot create a remote baseline');f.doc.getElementById('historyCloseBtn').click();
    f.doc.getElementById('quoteUpdateBtnV34').click();await until(()=>f.calls.some(x=>x.body?.action==='update'));await until(()=>!f.doc.getElementById('emailLaunch62').disabled);assert.equal(f.meta().ogust_status,'B');
  }finally{f.dom.window.close()}
}
{
  const f=await fixture({status:'C'});try{await f.open();assert.equal(f.doc.getElementById('quoteUpdateBtnV34').disabled,true);assert.equal(f.doc.getElementById('emailLaunch62').disabled,true);assert.equal(f.calls.filter(x=>x.body?.action==='update').length,0)}finally{f.dom.window.close()}
}
{
  const f=await fixture({hold:true});try{const pending=f.open();await until(()=>f.release);f.w.newQuote();f.w.setCompany('ACJ Services Lens');const number=f.state().number;f.release();await pending;assert.equal(f.state().company,'ACJ Services Lens');assert.equal(f.state().number,number);assert.equal(f.w.ogustClientChoiceV21?.selected,null);assert.equal(f.meta().ogust_snapshot,undefined,'A late recovery cannot link or relabel another draft')}finally{f.dom.window.close()}
}
console.log('Old quotes: read-only exact-ID recovery, missing customer/snapshot and API OK status, pre-catalogue and inactive associations, preserved local edits then same-ID save/send activation, retry, accepted locks and late tenant-safe response; synthetic data only.');
