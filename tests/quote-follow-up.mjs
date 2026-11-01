// Production UI and PDF generator; all contacts, API replies and shares are synthetic.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),deps=path.resolve(import.meta.dirname,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'follow-up-test.cjs')),{JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const rate={id:'clean-rate',product:'clean-product',title:'Entretien du logement',unit:'H',vat:10,price:32};
const make=(i,company='ACJ Services')=>({version:6,societe:company,numero_devis:`LOCAL-${company==='ACJ Services'?'ACJ':'LENS'}-${i}`,date:'2026-10-01',mode:'menage',client:{nom:`Client ${company} ${i}`,telephone:'0600000000',adresse:'Adresse fictive',email:'client@example.test',id_customer:`customer-${i}`},lignes:[{line_id:`line-${i}`,designation:rate.title,detail:'2 h',type:'service',activite:'menage',methode_chiffrage:'hourly',quantite:2,unite:'h',prix_unitaire_ttc:32,tva_rate:10,ogust_rate_id:rate.id,ogust_product_level_id:rate.product,ogust_unit:'H'}],totaux:{ht:58.18,tva:5.82,ttc:64},notes:''});
const key=q=>`${q.societe}|${q.numero_devis}`,ago=days=>new Date(Date.now()-days*86400000).toISOString();
const quotes=Array.from({length:20},(_,i)=>make(i)),lens=make(0,'ACJ Services Lens'),local=make('local');quotes.push(lens,local);
const initial={},remote=new Map(),firstSent=ago(8);
for(const [i,q] of quotes.entries()){
  if(q===local)continue;
  const id=q===lens?'shared':i===0?'shared':`quote-${i}`,status=i===13?'B':i===14?'V':i===15?'T':i===16?'S':'E';
  initial[key(q)]={ogust_id:id,ogust_number:`DEV-${q===lens?'LENS':i}`,ogust_status:status,ogust_snapshot:q,...(i===0?{email_sent_confirmed_at:firstSent}:i<12?{email_sent_confirmed_at:ago(i+10)}:{})};
  remote.set(`${q.societe}|${id}`,{id_quotation:id,number:initial[key(q)].ogust_number,status:i===12?'C':i===17?'OK':status});
}
const calls=[],shares=[],errors=[];let failed=false,held=false,releaseHistory,cancel=true,markFails=false,remoteDelivery='E';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<220;i++){if(fn())return;await wait(20)}throw Error('Follow-up UI timed out')}
class Scripts extends ResourceLoader{fetch(url){const u=new URL(url);return u.pathname.endsWith('.js')?Promise.resolve(fs.readFileSync(path.join(root,u.pathname.replace(/^\/devis-ACJ\//,'')))):null}}
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',(...x)=>errors.push(Error(x.join(' '))));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder,Blob,File});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>true;
  w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.localStorage.setItem('acj_devis_saved_v6',JSON.stringify(quotes));w.localStorage.setItem('acj_devis_history_meta_v29',JSON.stringify(initial));
  Object.defineProperty(w.navigator,'canShare',{value:()=>true});Object.defineProperty(w.navigator,'share',{value:async data=>{shares.push(data);if(cancel)throw new w.DOMException('cancel','AbortError')}});Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async()=>{}}});
  w.fetch=async(input,init={})=>{
    const url=new URL(String(input?.url||input)),body=init.body?JSON.parse(init.body):null;calls.push({url,body});
    if(url.pathname==='/api/ogust-devis')return response({ok:true,auth_required:false});
    if(url.pathname==='/api/ogust-history')return response({ok:true,rates:[rate],prestations:[{id:rate.product,title:rate.title}],records:[]});
    if(url.searchParams.get('action')==='history'){
      const company=url.searchParams.get('company'),ids=url.searchParams.get('ids').split(',');assert.ok(ids.length<=12);
      const result=()=>failed?response({ok:false},502):response({ok:true,quotations:ids.map(id=>remote.get(`${company}|${id}`)).filter(Boolean)});
      if(held)return new Promise(resolve=>{releaseHistory=()=>resolve(result())});return result();
    }
    if(body?.action==='prepare_delivery')return response({ok:true,id_quotation:body.id_quotation,ogust_number:initial[key(quotes[0])].ogust_number,ogust_status:remoteDelivery,ogust_status_label:remoteDelivery==='E'?'Envoyé':'Brouillon',recipient_email:'ogust@example.test',...(remoteDelivery==='B'?{needs_validation:true}:{prepared:true})});
    if(body?.action==='mark_sent'){
      assert.equal(body.confirm_sent,true);assert.equal(body.company,quotes[0].societe);assert.equal(body.id_quotation,'shared');
      return markFails?response({ok:false,error:'SENT_STATUS_NOT_CONFIRMED'},502):response({ok:true,verified:true,id_quotation:'shared',ogust_status:'E',ogust_status_label:'Envoyé',ogust_number:'DEV-0'});
    }
    assert.ok(!body,`Unexpected write ${body?.action}`);return response({ok:true,quotations:[],slots:[]});
  };
}});
const w=dom.window,doc=w.document,metas=()=>JSON.parse(w.localStorage.getItem('acj_devis_history_meta_v29')),meta=()=>metas()[key(quotes[0])];
const tab=view=>doc.querySelector(`[data-history-view="${view}"]`),card=q=>[...doc.querySelectorAll('.histCard')].find(x=>x.querySelector('.histMeta').textContent.includes(initial[key(q)]?.ogust_number||q.numero_devis));
const syncDone=()=>doc.getElementById('historyRefresh71')&&!doc.getElementById('historyRefresh71').disabled;
doc.addEventListener('click',event=>{if(event.target.closest('a[href^="mailto:"],a[download]'))event.preventDefault()});
async function history(){w.openQuoteHistoryV29();await until(syncDone)}
try{
  await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.rates.length);await wait(80);await history();
  assert.equal(tab('follow').getAttribute('aria-pressed'),'true');assert.equal(meta().ogust_status,'E');
  assert.equal(metas()[key(quotes[12])].ogust_status,'C','Status refresh covers the second batch, beyond twelve quotes');assert.equal(card(quotes[12]),undefined,'Accepted quotes leave follow-up');
  assert.ok(card(quotes[0]).querySelector('.histContact71').textContent.includes('il y a 8 jours'));
  assert.ok(card(quotes[18]).querySelector('.histContact71').textContent.includes('Date d’envoi non renseignée'),'The quote creation date is never invented as an email date');
  assert.equal(card(quotes[17]).querySelector('.histRemindBtn').disabled,true,'Transport OK cannot confirm the quotation status');
  assert.equal(calls.filter(c=>c.body).length,0,'Opening follow-up only reads Ogust');
  const requested=calls.filter(c=>c.url.searchParams.get('action')==='history');assert.equal(requested.filter(c=>c.url.searchParams.get('company')==='ACJ Services').length,2);assert.ok(requested.some(c=>c.url.searchParams.get('company')===lens.societe));
  tab('draft').click();assert.ok(card(local));assert.ok(card(quotes[13]));assert.equal(card(quotes[0]),undefined);
  tab('all').click();assert.ok(card(quotes[12]));assert.equal(card(quotes[12]).querySelector('.histEditBtn').disabled,true);assert.equal(card(quotes[12]).querySelector('.histRemindBtn'),null);
  // All addons must use the same filtered order: deleting a Lens card must not remove the first ACJ card.
  const company=doc.getElementById('historyCompany');company.value=lens.societe;company.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(doc.querySelectorAll('.histCard').length,1);doc.querySelector('.histDeleteBtn').click();
  assert.ok(!JSON.parse(w.localStorage.getItem('acj_devis_saved_v6')).some(q=>key(q)===key(lens)));assert.ok(JSON.parse(w.localStorage.getItem('acj_devis_saved_v6')).some(q=>key(q)===key(quotes[0])));
  await history();doc.getElementById('historySearch').value='DEV-0';doc.getElementById('historySearch').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(doc.querySelectorAll('.histCard').length,1);
  card(quotes[0]).querySelector('.histRemindBtn').click();await until(()=>doc.getElementById('emailShare62'));
  assert.equal(w.quotePayload().numero_devis,quotes[0].numero_devis,'Filtered reminder opens the exact saved quotation');assert.equal(doc.querySelector('.emailHead62 h2').textContent,'Relancer le devis');
  const mail=new URL(doc.getElementById('emailMailto62').href);assert.ok(mail.searchParams.get('subject').startsWith('Relance'));assert.ok(mail.searchParams.get('body').includes('Avez-vous pu en prendre connaissance ?'));assert.equal(doc.getElementById('emailRecipient62').value,'ogust@example.test');
  doc.getElementById('emailShare62').click();await until(()=>doc.querySelector('.emailMessage62').textContent.includes('annulé'));assert.equal(meta().email_last_reminded_at,undefined);assert.equal(doc.getElementById('emailConfirm62').hidden,true);
  cancel=false;doc.getElementById('emailShare62').click();await until(()=>!doc.getElementById('emailConfirm62').hidden);assert.equal(meta().email_last_reminded_at,undefined,'A native handoff does not record a relance');assert.equal(meta().email_delivery_pending.kind,'reminder');
  assert.equal(shares.at(-1).files[0].name,'Devis-DEV-0.pdf');assert.equal(new TextDecoder().decode(new Uint8Array(await shares.at(-1).files[0].arrayBuffer()).slice(0,5)),'%PDF-');assert.equal(shares.at(-1).text,mail.searchParams.get('body').replace(/\r\n/g,'\n'));
  w.acjEmailDelivery62.close();doc.getElementById('emailLaunch62').click();await until(()=>doc.getElementById('emailConfirm62'));assert.equal(doc.getElementById('emailConfirm62').hidden,false,'A pending reminder resumes as a reminder');assert.equal(doc.getElementById('emailConfirm62').textContent,'J’ai envoyé la relance');
  markFails=true;doc.getElementById('emailConfirm62').click();await until(()=>doc.querySelector('.emailMessage62').classList.contains('err'));assert.equal(meta().email_last_reminded_at,undefined,'Failed readback cannot record a confirmed reminder');
  markFails=false;doc.getElementById('emailConfirm62').click();doc.getElementById('emailConfirm62').click();await until(()=>meta().email_last_reminded_at);assert.equal(meta().email_reminder_count,1);assert.equal(meta().email_sent_confirmed_at,firstSent);assert.equal(meta().email_first_sent_confirmed_at,firstSent);assert.equal(meta().ogust_status,'E');assert.equal(calls.filter(c=>c.body?.action==='mark_sent').length,2,'One failure and one success, no duplicate confirmation');
  w.acjEmailDelivery62.close();await history();assert.ok(card(quotes[0]).querySelector('.histContact71').textContent.includes('Relancé aujourd’hui'));assert.equal(w.acjHistory71.displayed().at(-1).numero_devis,quotes[0].numero_devis,'A reminder moves the quote after contacts waiting longer');
  remoteDelivery='B';card(quotes[0]).querySelector('.histRemindBtn').click();await until(()=>doc.querySelector('.emailMessage62')?.classList.contains('err'));assert.equal(doc.getElementById('emailShare62'),null);assert.equal(doc.getElementById('emailValidate67'),null,'A reminder never validates a quote that returned to draft');assert.equal(meta().email_reminder_count,1);w.acjEmailDelivery62.close();
  failed=true;await history();assert.ok(doc.getElementById('historySync').textContent.includes('restent à vérifier'));assert.ok([...doc.querySelectorAll('.histRemindBtn')].every(b=>b.disabled),'Unavailable Ogust cannot expose an unverified follow-up action');
  failed=false;doc.getElementById('historyRefresh71').click();await until(syncDone);assert.equal(card(quotes[0]).querySelector('.histRemindBtn').disabled,false);
  // A detached history cannot write status responses over a newly confirmed local record.
  held=true;doc.getElementById('historyRefresh71').click();await until(()=>releaseHistory);doc.getElementById('historyCloseBtn').click();const before=JSON.stringify(metas());releaseHistory();await wait(50);assert.equal(JSON.stringify(metas()),before);held=false;
  assert.ok(calls.filter(c=>c.body).every(c=>['prepare_delivery','mark_sent'].includes(c.body.action)),'No quote creation, modification or automatic sending');assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
  console.log('Follow-up: scoped filters and addon identity, all status batches, accepted/unknown/offline guards, exact reminder/PDF, cancellation/resume/explicit confirmation, original send date, duplicate/late guards; synthetic APIs only.');
}finally{w.close()}
