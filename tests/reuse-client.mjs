import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../ogust-write-v19.js',import.meta.url),'utf8');
const fixture={societe:'ACJ Services',numero_devis:'ACJ-FAST-TEST',client:{nom:'Alex Test'},lignes:[{designation:'Jardinage',quantite:4,unite:'h',prix_unitaire_ttc:47,tva_rate:20}],totaux:{ttc:188}};
const clone=x=>JSON.parse(JSON.stringify(x));
function harness({selected='42',choiceCompany='ACJ Services',choices=[{id_company:'C1',label:'Établissement principal'}],locked=true,candidates,fetchHook}={}){
  let quote=clone(fixture),status='',createCount=0,customerCount=0,markup='';
  const ids=new Map(),events={},calls=[],stored=new Map();
  function element(){return {value:'',checked:false,disabled:false,textContent:'',className:'',querySelectorAll(){return []},reportValidity(){return true},remove(){ids.delete(this.id)},focus(){this.focused=true},click(){this.clicked=true}}}
  const document={getElementById:id=>ids.get(id),querySelectorAll:()=>[],querySelector(){return ids.get('ogwRadio')||null},createElement:()=>element(),head:{appendChild(s){ids.set(s.id,s)}},body:{appendChild(overlay){
    ids.set(overlay.id,overlay);markup=overlay.innerHTML;
    for(const match of markup.matchAll(/<(input|select|button|div)[^>]*\bid="([^"]+)"[^>]*>/g)){
      const item=element();item.id=match[2];item.disabled=/\bdisabled\b/.test(match[0]);item.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'';
      if(match[1]==='select'){
        const tail=markup.slice(match.index+match[0].length).split('</select>')[0];
        item.value=tail.match(/<option[^>]*value="([^"]*)"[^>]*\bselected\b/)?.[1]||'';
      }
      ids.set(item.id,item);
    }
    const radio=markup.match(/<input[^>]*name="ogwCustomer"[^>]*value="([^"]+)"[^>]*checked/);if(radio){const item=element();item.value=radio[1];item.checked=true;ids.set('ogwRadio',item)}
  }}};
  const ctx={document,JSON,URL,crypto:{randomUUID:()=> 'test-uuid'},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},quotePayload:()=>clone(quote),currentOgustCompanyV28:()=>quote.societe,showStatus:(id,msg)=>status=msg,goStep:n=>ctx.step=n,saveQuote:()=>ctx.saved=true,addEventListener:(name,fn)=>events[name]=fn};
  ctx.window=ctx;ctx.ogustClientChoiceV21={mode:'existing',company:choiceCompany,selected:selected?{id_customer:selected,label:'Alex Test'}:null};
  ctx.fetch=async(url,init={})=>{
    const body=init.body?JSON.parse(init.body):{};calls.push({url,body});
    if(fetchHook){const out=await fetchHook(url,body,calls);if(out)return out}
    if(body.action==='prepare'){
      const cs=candidates||[{id_customer:body.id_customer||'42',label:'Alex Test',code:'CLI42',phone:'0700000000',city:'Lens'}];
      return {ok:true,json:async()=>({ok:true,customer_locked:locked&&!!body.id_customer,selected_customer_id:body.id_customer||'',customer_candidates:cs,company_choices:choices,preview:{...clone(quote),line_count:1,total_ttc:188},draft:{supported:true,label:'Brouillon'}})};
    }
    if(init.method==='GET')return {ok:true,json:async()=>({ok:true,mode:'particulier_only',config:{titles:[{value:'M',label:'Monsieur'}],payments:[{value:'V',label:'Virement'}],managers:[{value:'A',label:'ACJ'}],origins:[{value:'AU',label:'Autre'}]}})};
    if(url.includes('ogust-customer')){customerCount++;return {ok:true,json:async()=>({ok:true,id_customer:'NEW1',verified:true})}}
    createCount++;return {ok:true,json:async()=>({ok:true,created:true,id_quotation:'Q1',verified:true})};
  };
  vm.runInNewContext(source,ctx);
  return {ctx,ids,events,calls,stored,setQuote:q=>quote=q,get quote(){return quote},get markup(){return markup},get status(){return status},get creates(){return createCount},get customers(){return customerCount}};
}

// The selected client is looked up once by ID, displayed once and explicitly confirmed by the final button.
const fixed=harness();await fixed.ctx.sendToOgust();
assert.equal(fixed.calls[0].body.id_customer,'42');assert.equal(fixed.calls[0].body.company,'ACJ Services');assert.equal(fixed.creates,0);
assert.ok(!fixed.markup.includes('name="ogwCustomer"'));assert.ok(!fixed.markup.includes('ogwConfirmCheck'));
assert.match(fixed.markup,/Alex Test/);assert.match(fixed.markup,/188\.00 €/);assert.match(fixed.markup,/Créer le devis dans Ogust/);
assert.equal(fixed.ids.get('ogwCompany').value,'C1');assert.equal(fixed.ids.get('ogwCreateBtn').disabled,false);
await Promise.all([fixed.ctx.confirmOgustWrite(),fixed.ctx.confirmOgustWrite()]);
await fixed.ctx.confirmOgustWrite();assert.equal(fixed.creates,1);assert.equal(fixed.ctx.saved,true);
const sent=fixed.calls.find(c=>c.body.action==='create').body;assert.equal(sent.id_customer,'42');assert.equal(sent.id_company,'C1');assert.equal(sent.company,'ACJ Services');assert.equal(sent.confirm,true);

// A different tenant's customer must never be reused. Legacy discovery still requires its checkbox.
const legacy=harness({choiceCompany:'ACJ Services Lens'});await legacy.ctx.sendToOgust();
assert.equal(legacy.calls[0].body.id_customer,undefined);assert.match(legacy.markup,/ogwConfirmCheck/);
await legacy.ctx.confirmOgustWrite();assert.equal(legacy.creates,0);
legacy.ids.get('ogwConfirmCheck').checked=true;await legacy.ctx.confirmOgustWrite();assert.equal(legacy.creates,1);

// Reopened IDs are reusable only with the matching reference and tenant.
const reopened=harness({selected:null});reopened.ctx.acjReopenedQuoteV33={societe:'ACJ Services',numero_devis:fixture.numero_devis,id_customer:'77'};
await reopened.ctx.sendToOgust();assert.equal(reopened.calls[0].body.id_customer,'77');
const wrongRef=harness({selected:null});wrongRef.ctx.acjReopenedQuoteV33={societe:'ACJ Services',numero_devis:'OTHER',id_customer:'77'};
await wrongRef.ctx.sendToOgust();assert.equal(wrongRef.calls[0].body.id_customer,undefined);

// No fallback to homonyms is accepted when the server cannot confirm the explicit selection.
const mismatch=harness({locked:false});await mismatch.ctx.sendToOgust();assert.equal(mismatch.ids.has('ogwOverlay'),false);assert.match(mismatch.status,/client choisi/);

const edited=harness();await edited.ctx.sendToOgust();edited.setQuote({...clone(fixture),totaux:{ttc:235},lignes:[{...fixture.lignes[0],quantite:5}]});
await edited.ctx.confirmOgustWrite();assert.equal(edited.creates,0);

const uncertain=harness({selected:null,candidates:[],fetchHook:(url,body)=>url.includes('ogust-customer')&&body.action==='create'?Promise.reject(Error('Network interruption')):null});
await uncertain.ctx.sendToOgust();
for(const [key,value] of Object.entries({ogwNewTitle:'M',ogwNewLastName:'Test',ogwNewAddress:'1 rue Test',ogwNewZip:'59100',ogwNewCity:'Test',ogwNewPayment:'V',ogwNewManager:'A',ogwNewOrigin:'AU'}))uncertain.ids.get(key).value=value;
uncertain.ids.get('ogwConfirmCheck').checked=true;await uncertain.ctx.confirmOgustWrite();await uncertain.ctx.confirmOgustWrite();
assert.equal(uncertain.calls.filter(c=>c.url.includes('ogust-customer')&&c.body.action==='create').length,1);assert.equal(uncertain.ids.get('ogwCreateBtn').disabled,true);

// A stale response cannot open the creation dialog after a company change.
let finish;const stale=harness({fetchHook:(_url,body)=>body.action==='prepare'?new Promise(resolve=>finish=resolve):null});
const preparing=stale.ctx.sendToOgust();stale.setQuote({...clone(fixture),societe:'ACJ Services Lens'});stale.events['acj:company-changed']();
finish({ok:true,json:async()=>({ok:true})});await preparing;assert.equal(stale.ids.has('ogwOverlay'),false);

// Saved establishment preferences are scoped to company and ignored when not present in today's list.
const choices=[{id_company:'C1',label:'Principal'},{id_company:'C2',label:'Autre établissement'}];
const validPreference=harness({choices});validPreference.stored.set('acj_ogust_company_choice_v1',JSON.stringify({'ACJ Services':'C2'}));
await validPreference.ctx.sendToOgust();assert.equal(validPreference.ids.get('ogwCompany').value,'C2');
const invalidPreference=harness({choices});invalidPreference.stored.set('acj_ogust_company_choice_v1',JSON.stringify({'ACJ Services':'NOPE','ACJ Services Lens':'C2'}));
await invalidPreference.ctx.sendToOgust();assert.equal(invalidPreference.ids.get('ogwCompany').value,'');assert.equal(invalidPreference.ids.get('ogwCreateBtn').disabled,true);

// A new client still requires complete fields and its checkbox; retrying a failed quotation never recreates that client.
let failedQuotation=true;const fresh=harness({selected:null,candidates:[],fetchHook:(url,body)=>body.action==='create'&&url.includes('ogust-quotation')&&failedQuotation?(failedQuotation=false,{ok:false,json:async()=>({ok:false,error:'QUOTATION_RATE_NOT_FOUND'})}):null});
await fresh.ctx.sendToOgust();assert.ok(fresh.ids.has('ogwNewCustomerForm'));assert.ok(fresh.ids.has('ogwConfirmCheck'));
for(const [key,value] of Object.entries({ogwNewTitle:'M',ogwNewLastName:'Test',ogwNewAddress:'1 rue Test',ogwNewZip:'59100',ogwNewCity:'Test',ogwNewPayment:'V',ogwNewManager:'A',ogwNewOrigin:'AU'}))fresh.ids.get(key).value=value;
await fresh.ctx.confirmOgustWrite();assert.equal(fresh.customers,0);
fresh.ids.get('ogwConfirmCheck').checked=true;await fresh.ctx.confirmOgustWrite();assert.equal(fresh.customers,1);
await fresh.ctx.confirmOgustWrite();assert.equal(fresh.customers,1);assert.equal(fresh.calls.filter(c=>c.url.includes('ogust-quotation')&&c.body.action==='create').length,2);

fixed.ctx.changeOgustWriteClient();assert.equal(fixed.ctx.step,1);assert.equal(fixed.ids.has('ogwOverlay'),false);
console.log('Ogust client reuse: exact selection, one confirmation, tenant/reference isolation, stale responses, duplicate clicks and safe new-client retry OK');
