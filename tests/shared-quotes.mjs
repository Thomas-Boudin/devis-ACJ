// Two isolated browsers run production UI. Auth, Ogust and private storage are synthetic.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules'),require=createRequire(path.join(deps,'sync-test.cjs')),{JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const clone=x=>JSON.parse(JSON.stringify(x)),canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const rate={id:'clean-rate',product:'clean-product',title:'Entretien du logement',unit:'H',vat:10,price:32};
const quote={version:6,societe:'ACJ Services',numero_devis:'ACJ-SHARED-TEST',date:new Date().toISOString().slice(0,10),mode:'menage',client:{nom:'Client fictif',telephone:'0600000000',adresse:'Adresse fictive',email:'client@example.test',id_customer:'client-1'},lignes:[{line_id:'shared-line',designation:rate.title,detail:'2 h',type:'service',activite:'menage',methode_chiffrage:'hourly',quantite:2,unite:'h',prix_unitaire_ttc:32,tva_rate:10,ogust_rate_id:rate.id,ogust_product_level_id:rate.product,ogust_unit:'H'}],totaux:{ht:58.18,tva:5.82,ttc:64},notes:''};
const key=q=>`${q.societe}|${q.numero_devis}`,quoteKey=key(quote),server=new Map(),calls=[],errors=[],apps=[];let offline=false,holdA=false,releaseA;
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='UI'){for(let i=0;i<300;i++){if(fn())return;await wait(20)}throw Error(`${label} timed out`)}
class Scripts extends ResourceLoader{fetch(url){const u=new URL(url);return u.pathname.endsWith('.js')?Promise.resolve(fs.readFileSync(path.join(root,u.pathname.replace(/^\/devis-ACJ\//,'')))):null}}
async function boot(name,initial={}){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...x)=>errors.push(Error(x.join(' '))));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,Blob,File});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>true;w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
    const claims={aud:'93181159242-i64qf82vtrij5c4b7l5q18ctjj48l3so.apps.googleusercontent.com',exp:Math.floor(Date.now()/1000)+3600,email:'synthetic@example.test'};w.sessionStorage.setItem('acj_auth_id_token_v29_2','fixture.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.fixture');
    for(const [k,v] of Object.entries(initial))w.localStorage.setItem(k,JSON.stringify(v));
    w.fetch=async(input,init={})=>{
      const u=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;calls.push({device:name,u,body});
      if(u.pathname==='/api/ogust-devis')return response({ok:true,auth_required:true,auth_version:'29.2'});
      if(u.pathname==='/api/ogust-history')return response({ok:true,rates:[rate],prestations:[{id:rate.product,title:rate.title}],records:[]});
      if(body?.action==='shared_list'){
        assert.ok(new Headers(init.headers).get('Authorization')?.startsWith('Bearer fixture.'));if(offline)return response({ok:false,error:'SHARED_STORAGE_UNAVAILABLE'},503);
        const records=[...server.values()].filter(r=>r.quote.societe===body.company),changed=records.filter(r=>body.known?.[r.quote.numero_devis]!==r.version);return response({ok:true,records:clone(changed.slice(0,12)),catalogue:records.map(r=>({ref:r.quote.numero_devis,version:r.version,updated_at:r.updated_at})),more:changed.length>12});
      }
      if(body?.action==='shared_put'){
        if(offline)return response({ok:false,error:'SHARED_STORAGE_UNAVAILABLE'},503);
        if(name==='A'&&holdA)await new Promise(resolve=>{releaseA=resolve});
        const k=key(body.record.quote),existing=server.get(k);assert.equal(body.record.quote.societe,body.company);assert.ok(!body.record.meta.email_delivery_pending);
        const bare=r=>{const c=clone(r);delete c.version;delete c.updated_at;return c};
        if(existing&&canonical(bare(existing))===canonical(body.record))return response({ok:true,version:existing.version,record:clone(existing)});
        if((existing?.version||null)!==body.base_version)return response({ok:false,error:'SHARED_CONFLICT',remote:clone(existing)},409);
        const version=randomUUID(),record={...clone(body.record),version,updated_at:new Date().toISOString()};server.set(k,record);return response({ok:true,version,record:clone(record)});
      }
      if(body?.action==='shared_import')return response({ok:true,record:{quote:{...clone(quote),numero_devis:'ACJ-OLD-IMPORT'},meta:{ogust_id:'old-import',ogust_number:'DEV-OLD',ogust_status:'E',ogust_snapshot:{...clone(quote),numero_devis:'ACJ-OLD-IMPORT'}}}});
      if(body?.action==='update')return response({ok:true,updated:true,id_quotation:body.id_quotation,ogust_status:'B',ogust_number:'DEV-SHARED'});
      if(body?.action==='recover_legacy')throw Error('Synthetic quote already has a verified baseline');
      if(body)throw Error('Unexpected mutation '+body.action);
      if(u.searchParams.get('action')==='history')return response({ok:true,quotations:u.searchParams.has('ids')?u.searchParams.get('ids').split(',').map(id=>({id_quotation:id,number:'DEV-SHARED',status:'B',status_label:'Brouillon'})):[{id_quotation:'old-import',number:'DEV-OLD',status:'E',status_label:'Envoyé'}]});
      return response({ok:true,quotations:[],slots:[]});
    };
  }});
  const app={dom,w:dom.window,doc:dom.window.document,state:()=>dom.window.eval('state')};apps.push(app);await until(()=>app.w.acjSharedQuotes72?.enabled&&app.w.acjDraftV42&&app.w.acjOgustRates?.rates.length,'Authenticated shared boot');await wait(70);return app;
}
const metadata=q=>({ogust_id:'quote-1',ogust_number:'DEV-SHARED',ogust_status:'B',ogust_status_label:'Brouillon',ogust_snapshot:q});
async function open(app){await app.w.openSavedQuoteV59(quote.societe,quote.numero_devis,'edit');await until(()=>app.state().number===quote.numero_devis&&app.state().step===2,'Open shared draft')}
function qty(app,n){const field=app.doc.querySelector('input[aria-label="Quantité"]');assert.ok(field);field.value=String(n);field.dispatchEvent(new app.w.Event('input',{bubbles:true}));field.dispatchEvent(new app.w.Event('change',{bubbles:true}));app.w.acjDraftV42.save()}
try{
  const a=await boot('A',{'acj_devis_saved_v6':[quote],'acj_devis_history_meta_v29':{[quoteKey]:metadata(quote)}});await a.w.acjSharedQuotes72.sync();assert.ok(server.has(quoteKey));assert.ok(a.w.localStorage.getItem('acj_devis_before_shared_v72'),'Existing local quotes have a migration backup');
  const b=await boot('B');await b.w.acjSharedQuotes72.sync();assert.equal(JSON.parse(b.w.localStorage.getItem('acj_devis_saved_v6'))[0].numero_devis,quote.numero_devis,'A clean second device discovers the same saved quote');
  a.w.newQuote();b.w.newQuote();assert.notEqual(a.state().number,b.state().number,'Fresh local refs are unique across devices');
  await open(a);qty(a,3);holdA=true;const pending=a.w.acjSharedQuotes72.push(quoteKey);await until(()=>releaseA,'Held first writer');
  await open(b);qty(b,4);await b.w.acjSharedQuotes72.push(quoteKey);assert.equal(server.get(quoteKey).quote.lignes[0].quantite,4);holdA=false;releaseA();await pending;
  assert.equal(a.state().lines[0].qty,3,'A concurrent edit is preserved locally');assert.ok(a.doc.getElementById('sharedConflict72'));assert.equal(server.get(quoteKey).quote.lignes[0].quantite,4,'A stale writer cannot overwrite another device');
  const before=calls.filter(c=>c.body?.action==='update').length;const blocked=await a.w.fetch('https://acj-ogust-proxy.vercel.app/api/ogust-quotation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',quote:a.w.quotePayload(),company:quote.societe})});assert.equal(blocked.status,409);assert.equal(calls.filter(c=>c.body?.action==='update').length,before,'A known shared conflict cannot enter an Ogust mutation');
  a.w.acjSharedQuotes72.resolve(quoteKey);[...a.doc.querySelectorAll('#sharedResolve72 button')].find(x=>x.textContent.includes('nouveau brouillon')).click();await until(()=>a.state().number!==quote.numero_devis,'Keep local as a separate draft');const copyRef=a.state().number;await until(()=>server.has(quote.societe+'|'+copyRef),'Durable conflict copy');assert.equal(server.get(quoteKey).quote.lignes[0].quantite,4);assert.equal(server.get(quote.societe+'|'+copyRef).quote.lignes[0].quantite,3);assert.equal(server.get(quote.societe+'|'+copyRef).meta.ogust_id,undefined,'A new draft cannot retain the old quote binding');
  assert.ok(JSON.parse(a.w.localStorage.getItem('acj_devis_conflict_copies_v72')).length);
  const c=await boot('C');await c.w.acjSharedQuotes72.sync();assert.ok(JSON.parse(c.w.localStorage.getItem('acj_devis_saved_v6')).some(q=>q.numero_devis===copyRef),'A third device sees both versions after resolution');
  // The local copy survives network failure and is sent when connectivity returns.
  await c.w.openSavedQuoteV59(quote.societe,copyRef,'edit');qty(c,5);offline=true;assert.equal(await c.w.acjSharedQuotes72.push(quote.societe+'|'+copyRef),false);assert.equal(c.state().lines[0].qty,5);assert.equal(server.get(quote.societe+'|'+copyRef).quote.lignes[0].quantite,3);offline=false;await c.w.acjSharedQuotes72.push(quote.societe+'|'+copyRef);assert.equal(server.get(quote.societe+'|'+copyRef).quote.lignes[0].quantite,5);
  // Preserve work typed into a builder but not added to the quote.
  c.w.acjWorkspace58.open('catalogue');c.doc.querySelector('#ogPickerResults41 button').click();const builder=c.doc.getElementById('builderHours');builder.value='5.5';builder.dispatchEvent(new c.w.Event('input',{bubbles:true}));c.w.acjDraftV42.save();await c.w.acjSharedQuotes72.push(quote.societe+'|'+copyRef);
  const d=await boot('D');await d.w.acjSharedQuotes72.sync();await d.w.openSavedQuoteV59(quote.societe,copyRef,'edit');assert.equal(d.doc.getElementById('builderHours').value,'5.5','The unfinished builder is restored on another device');assert.equal(d.state().lines[0].qty,5);
  // Read old app quotes from Ogust without creating or changing an Ogust document.
  d.w.openQuoteHistoryV29();[...d.doc.querySelectorAll('.sharedHistory72 button')].find(x=>x.textContent==='Retrouver dans Ogust').click();await until(()=>d.doc.querySelector('#sharedDiscover72 .sharedDiscoverList72 button'),'Old quote list');d.doc.querySelector('#sharedDiscover72 .sharedDiscoverList72 button').click();await until(()=>server.has('ACJ Services|ACJ-OLD-IMPORT'),'Read-only old quote import');assert.equal(calls.filter(c=>c.body?.action==='shared_import').length,1);
  assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
  console.log('Shared UI: isolated authorized devices, legacy migration/backup, unique refs, concurrent conflict and blocked Ogust write, preserved separate copy, offline retry, unfinished builder recovery and read-only Ogust discovery/import.');
}finally{for(const app of apps)app.w.close()}
