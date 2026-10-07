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
function slot(day,start,name){const hour=Number(start.slice(0,2));return {date:day,start,end:`${String(hour+2).padStart(2,'0')}:00`,intervenant:name,employee_key:name,id_intervenant:name,source:'google',employee_base_configured:true,client_base_configured:true,verification:{complete:true,planning_complete:true,planning_checked:true,absences_checked:true,employee_profile_checked:true,employee_activity_checked:true,employment_checked:false,employee_base_checked:true,client_base_checked:true,client_planning_checked:true,travel_checked:false},assumptions:['travel_unchecked','employment_unchecked']}}
const proposed=[slot('2030-01-07','09:00','Jean-Baptiste'),slot('2030-01-07','09:00','Vincent'),slot('2030-01-07','09:00','Yohann'),slot('2030-01-07','13:00','Vincent'),slot('2030-01-08','09:00','Yohann'),slot('2030-01-09','09:00','Jean-Baptiste')];
class Scripts extends ResourceLoader{fetch(url){const u=new URL(url);if(u.origin==='https://thomas-boudin.github.io'&&u.pathname.startsWith('/devis-ACJ/')&&u.pathname.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,u.pathname.slice('/devis-ACJ/'.length))));return null}}
const errors=[],calls=[];const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));vc.on('error',(...items)=>errors.push(new Error(items.map(String).join(' '))));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://thomas-boudin.github.io/devis-ACJ/?v=49',resources:new Scripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.assign(w,{Response,Request,Headers,AbortController,TextEncoder,TextDecoder});w.scrollTo=()=>{};w.focus=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=()=>{};w.confirm=()=>false;
  w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(w.performance.now()),0);w.cancelAnimationFrame=id=>w.clearTimeout(id);w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.fetch=async(input,init={})=>{const u=new URL(String(input?.url||input)),body=typeof init.body==='string'?JSON.parse(init.body):null;calls.push({u,init,body});assert.ok(!['create','update'].includes(body?.action),'No business write is allowed in this test');
    if(u.pathname==='/api/ogust-devis')return response({ok:true,auth_required:false});
    if(u.pathname==='/api/ogust-history'&&u.searchParams.get('action')==='availability')return response({ok:true,slots:proposed,checked_at:new Date().toISOString(),total_count:proposed.length,count:proposed.length,sources:{google:{available:true,queried:true},ogust:{available:true,queried:true}},base_availability:{available:true},verification:{complete:false,planning_complete:true,warnings:[]}});
    if(u.pathname==='/api/ogust-history')return response(u.searchParams.get('rates')==='1'?{ok:true,rates}:{ok:true,prestations:rates.map(r=>({id:r.product,title:r.title})),records:[]});
    if(u.pathname==='/api/ogust-customer'&&body?.action==='search')return response({ok:true,customer_candidates:[customer]});
    return response({ok:true,records:[]});
  };
}});
function input(id,value,event='input'){const node=dom.window.document.getElementById(id);assert.ok(node,id);node.value=String(value);node.dispatchEvent(new dom.window.Event(event,{bubbles:true}));return node}
try{
  const w=dom.window;await until(()=>w.acjDraftV42&&w.__acjFastFlowV42&&w.acjOgustRates?.company==='ACJ Services','Production scripts initialized');await wait(100);
  input('ogcSearch','Client Planning');await until(()=>w.document.querySelector('#ogcResults .ogcResult'),'Client found');w.document.querySelector('#ogcResults .ogcResult').click();
  w.eval("state.lines=[{id:'hourly',type:'service',activity:'jardin',pricingMethod:'hourly',designation:'Taille',unit:'h',qty:2,unitPriceTTC:47,vat:20}];state.mode='bricol';renderQuoteLines();goStep(4)");
  assert.equal(w.document.getElementById('av32Duration').value,'2');input('av32From','2030-01-07','change');await w.acjAvailabilityV32.search();
  const request=calls.filter(c=>c.u.searchParams.get('action')==='availability').at(-1);assert.equal(request.u.searchParams.get('activity'),'jardin','Scheduling uses the actual labor, not the last trade tab');assert.equal(request.u.searchParams.get('id_customer'),'client-planning');
  const cards=[...w.document.querySelectorAll('.av32Slot')];assert.equal(cards.length,3);assert.equal(new Set(cards.map(c=>c.closest('.av32DateGroup').querySelector('.av32DayTitle').textContent+'|'+c.querySelector('.av32When').textContent)).size,3,'Shortlist contains distinct times despite three employees sharing the first time');
  assert.ok(cards.every(c=>/trajet/i.test(c.textContent)),'Travel condition is visible on every card');cards[0].click();assert.ok(w.acjAvailabilityV32.selected);assert.match(w.document.getElementById('av32Selected').textContent,/Aucune intervention n’est réservée/);
  w.eval("state.lines.push({id:'flat',type:'service',activity:'jardin',pricingMethod:'flat',designation:'Dessouchage',unit:'forfait',qty:1,unitPriceTTC:150,vat:20});renderQuoteLines()");
  assert.equal(w.acjAvailabilityV32.selected,null,'Adding a forfait invalidates the retained time');assert.equal(w.document.getElementById('av32Duration').value,'','Hourly plus forfait cannot silently undercount the job');
  const count=calls.filter(c=>c.u.searchParams.get('action')==='availability').length;await w.acjAvailabilityV32.search();assert.equal(calls.filter(c=>c.u.searchParams.get('action')==='availability').length,count,'Unknown elapsed duration requires input before reading calendars');
  input('av32Duration','2');await w.acjAvailabilityV32.search();assert.equal(w.document.querySelectorAll('.av32Slot').length,3,'Explicit onsite duration allows mixed pricing');
  assert.equal(errors.length,0,errors.map(error=>error.stack||error.message).join('\n'));
  console.log('Availability production DOM: actual trade, selected client, three distinct times, visible travel condition, forfait duration guard, context invalidation and explicit one-worker scheduling OK; APIs mocked, no booking writes');
}finally{await wait(10);dom.window.close()}
