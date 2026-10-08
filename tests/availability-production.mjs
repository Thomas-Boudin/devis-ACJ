// Scheduling in the complete production DOM. Every API is mocked; no booking.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const deps=path.resolve(here,process.env.ACJ_DOM_TEST_DEPS||'../../dom-test/node_modules');
const require=createRequire(path.join(deps,'acj-dom-test.cjs'));
const {JSDOM,ResourceLoader,VirtualConsole}=require(path.join(deps,'jsdom/lib/api.js'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(let i=0;i<150;i++){if(check())return;await wait(20)}throw new Error(message)}
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
const customer={id_customer:'client-planning',label:'Client Planning',phone:'0700000000',address:'Rue du test',zip:'59134',city:'Marquillies'};
const rates=[{id:'garden-h20',product:'garden',title:"Jardinage à l'heure",unit:'H',vat:20,price:47}];
const employees=[{id_employee:'jb-id',name:'Jean-Baptiste',source:'google',activity_checked:true},{id_employee:'vincent-id',name:'Vincent',source:'google',activity_checked:true},{id_employee:'yohann-id',name:'Yohann',source:'google',activity_checked:true}];
const cleaningEmployee={id_employee:'cleaning-id',name:'Aline Test',source:'ogust',activity_checked:false};
const verification={complete:true,planning_complete:true,feasibility_complete:false,planning_checked:true,absences_checked:true,employee_profile_checked:true,employee_activity_checked:true,employment_checked:false,agency_checked:false,employee_base_checked:true,client_base_checked:true,client_planning_checked:true,travel_checked:false};
// Hand-built expectations: 16 labor hours = 8 productive hours per person with
// two people, or two eight-hour days with one person. Lunch never counts.
function plan(labor,persons,offset){
  const crew=employees.slice(0,persons),segments=[];let remaining=Math.ceil(labor/persons),day=7+offset;
  const time=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
  while(remaining){let today=Math.min(480,remaining);for(const start of [480,780]){const minutes=Math.min(240,today);if(!minutes)break;segments.push({date:`2030-01-${String(day).padStart(2,'0')}`,start:time(start),end:time(start+minutes),onsite_minutes:minutes,labor_minutes:minutes*persons,employee_ids:crew.map(e=>e.id_employee),employee_base_configured:true,client_base_configured:true,verification,assumptions:['travel_unchecked','employment_unchecked','agency_unchecked']});today-=minutes;remaining-=minutes}day++}
  const onsite=segments.reduce((sum,s)=>sum+s.onsite_minutes,0);
  return {id:`plan-${persons}-${offset}`,persons,crew,segments,requested_labor_minutes:labor,planned_labor_minutes:onsite*persons,onsite_minutes:onsite,daily_minutes:480,round_up_labor_minutes:onsite*persons-labor,day_count:new Set(segments.map(s=>s.date)).size,segment_count:segments.length,complete:true,verification,assumptions:['travel_unchecked','employment_unchecked','agency_unchecked']};
}
class Scripts extends ResourceLoader{fetch(url){const u=new URL(url);if(u.origin==='https://thomas-boudin.github.io'&&u.pathname.startsWith('/devis-ACJ/')&&u.pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,u.pathname.slice('/devis-ACJ/'.length))));return null}}
const errors=[],calls=[];let corrupt=false;const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));vc.on('error',(...items)=>errors.push(new Error(items.map(String).join(' '))));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/?v=50',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});w.scrollTo=()=>{};w.focus=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>false;
  w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.fetch=async(input,init={})=>{const u=new URL(String(input?.url||input)),body=typeof init.body==='string'?JSON.parse(init.body):null;calls.push({u,init,body});assert.ok(!['create','update'].includes(body?.action),'No business write is allowed in this test');
    if(u.pathname==='/api/ogust-devis')return response({ok:true,auth_required:false});
    if(u.pathname==='/api/ogust-history'&&u.searchParams.get('action')==='availability'){
      const labor=Number(u.searchParams.get('labor_minutes')),persons=Number(u.searchParams.get('persons')),plans=[0,2,4].map(offset=>plan(labor,persons,offset));
      if(corrupt)plans[0].segments.pop();
      const cleaning=u.searchParams.get('activity')==='menage',selected=JSON.parse(u.searchParams.get('employee_ids')||'[]');
      if(cleaning&&!selected.length)for(let i=0;i<plans.length;i++){plans[i].crew=[employees[i]];for(const segment of plans[i].segments)segment.employee_ids=[employees[i].id_employee]}
      if(cleaning&&selected.includes(cleaningEmployee.id_employee))for(const proposal of plans){proposal.crew=[cleaningEmployee];for(const segment of proposal.segments)segment.employee_ids=[cleaningEmployee.id_employee]}
      return response({ok:true,planning_mode:'job',plans,labor_minutes:labor,persons,daily_minutes:480,checked_at:new Date().toISOString(),count:plans.length,employee_options:[...employees,cleaningEmployee],sources:{google:{available:true,queried:!cleaning},ogust:{available:true,queried:true}},verification:{...verification,warnings:[]}});
    }
    if(u.pathname==='/api/ogust-history')return response(u.searchParams.get('rates')==='1'?{ok:true,rates}:{ok:true,prestations:rates.map(r=>({id:r.product,title:r.title})),records:[]});
    if(u.pathname==='/api/ogust-customer'&&body?.action==='search')return response({ok:true,customer_candidates:[customer]});
    return response({ok:true,records:[]});
  };
}});
function input(id,value,event='input'){const node=dom.window.document.getElementById(id);assert.ok(node,id);node.value=String(value);node.dispatchEvent(new dom.window.Event(event,{bubbles:true}));return node}
function check(id,value){const node=dom.window.document.getElementById(id);assert.ok(node,id);node.checked=value;node.dispatchEvent(new dom.window.Event('change',{bubbles:true}));return node}
const searches=()=>calls.filter(c=>c.u.searchParams.get('action')==='availability');
try{
  const w=dom.window;await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.company==='ACJ Services','Production scripts initialized');await wait(100);
  input('ogcSearch','Client Planning');await until(()=>w.document.querySelector('#ogcResults .ogcResult'),'Client found');w.document.querySelector('#ogcResults .ogcResult').click();
  w.eval("state.lines=[{id:'hourly',type:'service',activity:'jardin',pricingMethod:'hourly',designation:'Taille',unit:'h',qty:16,unitPriceTTC:47,vat:20}];state.mode='bricol';renderQuoteLines();goStep(4)");
  assert.equal(w.document.getElementById('av32Duration').value,'16','Large hourly jobs prefill total labor');input('av32From','2030-01-07','change');input('av32Persons','2','change');
  const before=searches().length;await w.acjAvailabilityV32.search();assert.equal(searches().length,before,'Parallel work requires explicit confirmation before calendar reads');
  check('av32ParallelConfirm',true);await w.acjAvailabilityV32.search();
  let request=searches().at(-1);assert.equal(request.u.searchParams.get('planning_mode'),'job');assert.equal(request.u.searchParams.get('labor_minutes'),'960');assert.equal(request.u.searchParams.get('persons'),'2');assert.equal(request.u.searchParams.get('parallel_confirmed'),'1');assert.equal(request.u.searchParams.get('activity'),'jardin','Scheduling uses the actual labor, not the last trade tab');assert.equal(request.u.searchParams.get('id_customer'),'client-planning');
  let cards=[...w.document.querySelectorAll('.av32Plan')];assert.equal(cards.length,3);assert.ok(cards.every(c=>/Jean-Baptiste/.test(c.textContent)&&/Vincent/.test(c.textContent)&&/trajet/i.test(c.textContent)),'Named crew and travel condition are visible on every full plan');cards[0].querySelector('.av32Slot').click();
  const selected=w.acjAvailabilityV32.selected;assert.ok(selected);assert.equal(selected.planned_labor_minutes,960);assert.equal(selected.onsite_minutes,480);assert.equal(selected.day_count,1);assert.equal(selected.segments.length,2);assert.deepEqual(Array.from(selected.segments,s=>`${s.start}–${s.end}`),['08:00–12:00','13:00–17:00']);assert.match(w.document.getElementById('av32Selected').textContent,/Aucune intervention n’est réservée/);
  assert.equal(w.eval('state.lines[0].qty*state.lines[0].unitPriceTTC'),752,'Crew size never changes the invoice');
  w.acjDraftV42.save();const saved=JSON.parse(w.localStorage.getItem(w.acjDraftV42.key));assert.equal(saved.availability.version,3);assert.equal(saved.availability.proposal.plan.planned_labor_minutes,960);w.acjAvailabilityV32.restore(saved.availability);assert.equal(w.acjAvailabilityV32.selected,null,'Restored plans require a fresh calendar check');assert.match(w.document.getElementById('av32Selected').textContent,/revérifier/);
  input('av32Persons','1','change');await w.acjAvailabilityV32.search();cards=[...w.document.querySelectorAll('.av32Plan')];assert.equal(cards.length,3);cards[0].querySelector('.av32Slot').click();assert.equal(w.acjAvailabilityV32.selected.day_count,2);assert.equal(w.acjAvailabilityV32.selected.onsite_minutes,960);assert.equal(w.eval('state.lines[0].qty*state.lines[0].unitPriceTTC'),752);
  corrupt=true;await w.acjAvailabilityV32.search();assert.equal(w.document.querySelectorAll('.av32Plan').length,2,'A truncated plan cannot be presented as full coverage');corrupt=false;
  w.eval("state.lines.push({id:'flat',type:'service',activity:'jardin',pricingMethod:'flat',designation:'Dessouchage',unit:'forfait',qty:1,unitPriceTTC:150,vat:20});renderQuoteLines()");
  assert.equal(w.acjAvailabilityV32.selected,null,'Adding a forfait invalidates the retained plan');assert.equal(w.document.getElementById('av32Duration').value,'','Hourly plus forfait cannot silently undercount the job');
  const count=searches().length;await w.acjAvailabilityV32.search();assert.equal(searches().length,count,'Unknown labor duration requires input before reading calendars');
  input('av32Duration','2');await w.acjAvailabilityV32.search();assert.equal(w.document.querySelectorAll('.av32Plan').length,3,'Explicit total labor duration allows mixed pricing');
  w.eval("state.lines=[{id:'cleaning',type:'service',activity:'menage',pricingMethod:'hourly',designation:'Ménage',unit:'h',qty:2,unitPriceTTC:32,vat:10}];renderQuoteLines()");
  await w.acjAvailabilityV32.search();
  assert.equal(w.document.querySelectorAll('.av32Plan').length,0,'An older server response cannot propose garden staff for household cleaning');
  assert.deepEqual([...w.document.querySelectorAll('#av32EmployeeOptions input')].map(input=>input.dataset.employeeId),[cleaningEmployee.id_employee],'JB, Vincent and Yohann are absent from cleaning preferences');
  assert.match(w.document.getElementById('av32Intro').textContent,/JB, Vincent et Yohann sont exclus/);
  for(const member of employees){
    const oldCleaning=w.acjAvailabilityV32.getDraft();oldCleaning.preferences.employee_ids=[member.id_employee];const stale=plan(120,1,0);stale.crew=[member];for(const segment of stale.segments)segment.employee_ids=[member.id_employee];
    oldCleaning.proposal={context:oldCleaning.context,preferences:oldCleaning.preferences,plan:stale,checked_at:new Date().toISOString()};
    assert.equal(w.acjAvailabilityV32.restore(oldCleaning),false,`A saved cleaning plan containing ${member.name} is rejected`);
    assert.equal(w.eval('state.availabilityProposal'),undefined);assert.equal(w.document.getElementById('av32Selected').textContent,'');
  }
  await w.acjAvailabilityV32.search();
  const choice=w.document.querySelector('#av32EmployeeOptions input');choice.checked=true;choice.dispatchEvent(new w.Event('change',{bubbles:true}));
  await w.acjAvailabilityV32.search();
  assert.equal(w.document.querySelectorAll('.av32Plan').length,3,'An explicitly selected cleaning worker remains available');
  assert.ok([...w.document.querySelectorAll('.av32Plan')].every(card=>/Aline Test/.test(card.textContent)&&!/Jean.Baptiste|Vincent|Yohann/.test(card.textContent)));
  assert.equal(searches().at(-1).u.searchParams.get('employee_ids'),'["cleaning-id"]');
  assert.equal(errors.length,0,errors.map(error=>error.stack||error.message).join('\n'));
  console.log('Availability production DOM: 16-hour job with two people or two days, parallel confirmation, full coverage, invoice unchanged, draft v3 recheck and forfait guard OK; APIs mocked, no booking writes');
}finally{await wait(10);dom.window.close()}

