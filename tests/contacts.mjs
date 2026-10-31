// Entire production bundle, synthetic directory pages and mocked service calls.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'contacts-test.cjs')),{JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const customer={id_customer:'quote-client',label:'Client du devis',address:'Adresse du devis'};
const rate={id:'clean-rate',product:'clean-product',title:'Entretien régulier du logement',unit:'H',vat:10,price:32};
const row={id:'directory-1',kind:'customers',label:'Camille Annuaire',mobile:'06 12 34 56 78',landline:'03 20 00 00 00',email:'camille@example.test',address:'8 rue de Test, 59000 Lille'};
const draft={version:42,state:{step:2,number:'CONTACTS-TEST',company:'ACJ Services',client:customer.label,tel:'',address:customer.address,mode:'menage',activePreset:null,builderMethod:'hourly',notes:'',lines:[{id:'quote-line',designation:'Ménage',type:'service',activity:'menage',qty:4,unit:'h',unitPriceTTC:32,vat:10,ogustRateId:rate.id,ogustProductLevelId:rate.product,ogustProductCompany:'ACJ Services'}]},inputs:{client:customer.label,tel:'',adresse:customer.address,notes:''},clientChoice:{mode:'existing',selected:customer}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));async function until(fn){for(let i=0;i<180;i++){if(fn())return;await wait(20)}throw Error('Contacts UI timed out')}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
class Scripts extends ResourceLoader{fetch(url){if(new URL(url).pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,path.basename(new URL(url).pathname))));return null}}
const errors=[],reads=[],copied=[];let releaseOld=null,fail=false,mismatch=false;
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...x)=>errors.push(Error(x.join(' '))));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};
  w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copied.push(value)}});w.localStorage.setItem('acj_devis_active_v42',JSON.stringify(draft));
  w.fetch=async(input,init={})=>{const url=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;assert.ok(!['create','update','send'].includes(body?.action),'Directory cannot write a business record or send mail');
    if(url.searchParams.get('action')==='directory'){
      assert.equal(init.method||'GET','GET');assert.equal(init.cache,'no-store');const company=url.searchParams.get('company'),kind=url.searchParams.get('kind'),page=Number(url.searchParams.get('page')),query=url.searchParams.get('query');reads.push({company,kind,page,query});
      if(query==='slow'&&company==='ACJ Services')return new Promise(resolve=>{releaseOld=()=>resolve(response({ok:true,company,contacts:[{...row,label:'STALE CONTACT'}],has_more:false}))});
      if(fail)return response({ok:false,error:'CONTACT_READ_FAILED'},502);
      const contacts=company==='ACJ Services Lens'?[{...row,id:'lens-only',kind,label:'Contact Lens'}]:kind==='employees'?[{...row,id:'employee-only',kind,label:'Intervenante annuaire'}]:kind==='contacts'?[{...row,id:'interlocutor-only',kind,label:'Interlocuteur annuaire'}]:page===1?[row]:[row,{...row,id:'directory-2',label:'Second contact'}, {...row,id:'safe-html',label:'<img src=x onerror=alert(1)>',email:'bad\r\n@example.test',mobile:'javascript:alert(1)',landline:'',address:''}];
      return response({ok:true,company:mismatch?'Wrong company':company,contacts,page,has_more:kind==='customers'&&company==='ACJ Services'&&page===1,next_page:page===1?2:null});
    }
    return response(url.pathname==='/api/ogust-devis'?{ok:true,auth_required:false}:url.pathname==='/api/ogust-history'?{ok:true,rates:[rate],prestations:[{id:rate.product,title:rate.title}],records:[]}:{ok:true,quotations:[],slots:[]});
  };
}});
const w=dom.window,doc=w.document,state=()=>w.eval('state');
function change(id,value){const input=doc.getElementById(id);input.value=value;input.dispatchEvent(new w.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))}
try{
  await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length);await wait(100);const original=JSON.stringify(state());
  doc.getElementById('appMenuToggle57').click();doc.getElementById('contactsLaunch60').click();await until(()=>doc.querySelectorAll('.contactCard60').length===1);
  assert.equal(doc.getElementById('appMenu57').hidden,true);assert.equal(doc.activeElement,doc.getElementById('contactsSearch60'));
  assert.equal(doc.querySelector('.contactCoordinates60 a').getAttribute('href'),'tel:0612345678');assert.equal(doc.querySelector('a[href^="mailto:"]').getAttribute('href'),'mailto:camille%40example.test');
  doc.querySelector('.contactCopy60').click();await until(()=>copied.length);assert.ok(copied[0].includes(row.address));assert.ok(copied[0].includes(row.email));
  doc.querySelector('.contactsFoot60 button').click();await until(()=>doc.querySelectorAll('.contactCard60').length===3);assert.equal(doc.querySelectorAll('.contactCard60 img').length,0,'Contact text is not HTML');assert.ok(![...doc.querySelectorAll('.contactCard60 a')].some(a=>a.href.startsWith('javascript:')));
  change('contactsKind60','employees');await until(()=>doc.getElementById('contactsList60').textContent.includes('Intervenante annuaire'));
  change('contactsKind60','contacts');await until(()=>doc.getElementById('contactsList60').textContent.includes('Interlocuteur annuaire'));
  const beforeShort=reads.length;change('contactsSearch60','a');await wait(350);assert.equal(reads.length,beforeShort);assert.ok(doc.getElementById('contactsStatus60').textContent.includes('2 caractères'));
  change('contactsSearch60','slow');await until(()=>releaseOld);change('contactsCompany60','ACJ Services Lens');await until(()=>doc.getElementById('contactsList60').textContent.includes('Contact Lens'));releaseOld();await wait(50);assert.ok(!doc.getElementById('contactsList60').textContent.includes('STALE CONTACT'));
  const beforeUnsupported=reads.length;change('contactsCompany60','Jet Services');assert.equal(doc.querySelectorAll('.contactCard60').length,0);await wait(50);assert.equal(reads.length,beforeUnsupported,'Jet cannot silently use another company account');
  fail=true;change('contactsSearch60','');change('contactsCompany60','ACJ Services');await until(()=>!doc.querySelector('.contactsFoot60 button:last-child').hidden);fail=false;doc.querySelector('.contactsFoot60 button:last-child').click();await until(()=>doc.querySelectorAll('.contactCard60').length===1);
  mismatch=true;change('contactsCompany60','ACJ Services Lens');await until(()=>!doc.querySelector('.contactsFoot60 button:last-child').hidden);assert.equal(doc.querySelectorAll('.contactCard60').length,0,'An incorrectly scoped response is never displayed');
  doc.getElementById('contactsOverlay60').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(doc.getElementById('contactsOverlay60'),null);assert.equal(doc.activeElement,doc.getElementById('appMenuToggle57'));
  assert.equal(JSON.stringify(state()),original,'Directory browsing/filtering cannot mutate the active quote');await wait(350);assert.ok(!Object.values(w.localStorage).join(' ').includes('Intervenante annuaire'),'Contact data is not stored with the quote');
  assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
  console.log('Contacts: menu/focus, coordinates/copy, paging/dedup, safe links/text, all categories, retry, company/query races and unsupported account guard; quote unchanged and no real calls/emails/writes.');
}finally{dom.window.close()}
