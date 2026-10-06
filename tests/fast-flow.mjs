import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// A small DOM fixture exercises the actual module without a network or Ogust.
// It keeps node identities/listeners so moving the existing editors is tested.
class Element {
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.listeners={};this._text='';this.value='';
    const tokens=new Set();this.classList={add:(...v)=>v.forEach(x=>tokens.add(x)),remove:(...v)=>v.forEach(x=>tokens.delete(x)),contains:v=>tokens.has(v),toggle:(v,on)=>{const yes=on??!tokens.has(v);yes?tokens.add(v):tokens.delete(v);return yes},toString:()=>[...tokens].join(' ')};
  }
  set id(v){this.attributes.id=v}get id(){return this.attributes.id||''}
  set className(v){this.classList.remove(...this.classList.toString().split(' '));this.classList.add(...v.split(' ').filter(Boolean))}get className(){return this.classList.toString()}
  set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v)}
  getAttribute(k){return this.attributes[k]??null}
  appendChild(node){if(node.parentElement){const a=node.parentElement.children;a.splice(a.indexOf(node),1)}node.parentElement=this;this.children.push(node);return node}
  append(...nodes){nodes.forEach(x=>this.appendChild(x))}
  prepend(node){this.appendChild(node);this.children.pop();this.children.unshift(node)}
  insertAdjacentElement(position,node){const owner=this.parentElement;assert.ok(owner);owner.appendChild(node);owner.children.pop();const i=owner.children.indexOf(this);owner.children.splice(i+(position==='afterend'?1:0),0,node)}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  click(){if(!this.disabled)(this.listeners.click||[]).forEach(fn=>fn({target:this}))}
  matches(selector){return selector.split(',').some(raw=>{
    const s=raw.trim(),tag=s.match(/^[a-z0-9]+/i)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;
    for(const [,cls] of s.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(cls))return false;
    for(const [,name,val] of s.matchAll(/\[([^=]+)="([^"]*)"\]/g))if(this.getAttribute(name)!==val)return false;
    if(s.startsWith('#')&&this.id!==s.slice(1))return false;
    return true;
  })}
  closest(s){let n=this;while(n){if(n.matches(s))return n;n=n.parentElement}return null}
  querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)])}
  querySelector(s){return this.querySelectorAll(s)[0]||null}
}
const element=(tag,attrs={},text='')=>{const n=new Element(tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);n.textContent=text;return n};
const body=new Element('body'),head=new Element('head'),top=element('header',{class:'top'}),brand=element('div'),oldLabel=element('span',{id:'stepLabel'}),progress=element('div',{class:'progress'});
brand.append(oldLabel);for(let i=1;i<=4;i++)progress.append(element('span',{id:'p'+i}));top.append(brand,progress);body.append(top);
const sections=new Map();
for(let i=1;i<=4;i++){
  const section=element('section',{class:'step'+(i===1?' active':''),'data-step':String(i)});
  section.append(element('div',{class:'eyebrow'}),element('h1',{},'Old title'),element('p',{class:'lead'},'Old copy'));
  const actions=element('div',{class:'actions'});section.append(actions);sections.set(i,section);body.append(section);
}
const importedNotes=element('div',{id:'notesImportCard',class:'card'}),noteText=element('textarea',{id:'noteText'});importedNotes.append(noteText);sections.get(1).append(importedNotes);
const clientButton=element('button',{onclick:'goStep(2)'},'Choisir');sections.get(1).querySelector('.actions').append(clientButton);
const modeCard=element('div',{class:'card'}),modeChoices=element('div',{id:'modeChoices'});modeCard.append(modeChoices);sections.get(2).prepend(modeCard);
const serviceCard=element('div',{class:'card'}),presets=element('div',{id:'presetChoices'}),picker=element('div',{id:'ogPicker41'}),builder=element('div',{id:'serviceBuilder'});
serviceCard.append(element('div',{class:'cardTitle'},'Prestation'),picker,presets,builder);sections.get(2).append(serviceCard,element('div',{class:'notice'},'Old help'));
const lineCard=element('div',{class:'card'}),quoteLines=element('div',{id:'quoteLines'}),summary=element('div',{class:'summary'}),settingsCard=element('details');
quoteLines.append(element('div',{class:'empty'},'Reviens à l’étape 2'));lineCard.append(quoteLines);sections.get(3).append(lineCard,summary,settingsCard);
const km=element('input',{id:'kmRate'}),waste=element('input',{id:'wasteRate'});settingsCard.append(km,waste);
const finalBack=element('button',{onclick:'goStep(3)'},'Retour au chiffrage');sections.get(4).querySelector('.actions').append(finalBack);
let builderClicks=0;builder.addEventListener('click',()=>builderClicks++);
const docEvents=new Map();const observers=[];
const document={readyState:'loading',body,head,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>docEvents.set(name,fn),getElementById:id=>[head,body].flatMap(n=>n.querySelectorAll('#'+id))[0]||null,querySelector(s){
  if(s==='.top>.progress')return progress;
  if(s==='.step[data-step="1"] button[onclick="goStep(2)"]')return clientButton;
  return body.querySelector(s);
}};
let renders=0,creates=0;const navigation=[];
const state={step:1,client:'',lines:[]};
const ctx={window:null,document,state,settings:{kmRate:.7,wasteRate:25},queueMicrotask,Intl,MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(node){this.node=node}},totals:()=>({ttc:state.lines.reduce((a,l)=>a+l.qty*l.unitPriceTTC,0)}),money:n=>`${n.toFixed(2)} €`,renderQuoteLines(){renders++;ctx.renderTotals()},renderTotals(){},goStep(n){
  navigation.push(n);if(n===2&&state.step===1&&!state.client)return;if(n===4&&!state.lines.length)return;
  state.step=n;for(const [id,s] of sections)s.classList.toggle('active',id===n);
},sendToOgust(){creates++}};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(fs.readFileSync('fast-flow-v42.js','utf8'),ctx);
assert.equal(document.getElementById('fastPricing42'),null,'Waits for preceding DOMContentLoaded modules');
docEvents.get('DOMContentLoaded')();await new Promise(resolve=>queueMicrotask(resolve));
assert.equal(ctx.__acjFastFlowV42,true);
assert.equal(quoteLines.closest('.step'),sections.get(2),'Same quote editor is on the unified workspace');
assert.equal(summary.parentElement.id,'fastPricing42');assert.equal(km.closest('.step'),sections.get(2));
assert.equal(builder.closest('.step'),sections.get(2));builder.click();assert.equal(builderClicks,1,'Moving nodes preserves event listeners');
assert.equal(picker.closest('details'),null,'Search stays visible');assert.equal(builder.closest('details'),null,'Chosen Ogust quantities stay visible');
assert.equal(presets.closest('details').id,'fastDetailed42');assert.equal(modeChoices.closest('details'),null,'Mode is visible so the Ogust search can filter the selected trade');
assert.equal(modeChoices.closest('.step'),sections.get(2));assert.ok(sections.get(2).children.indexOf(modeCard)<sections.get(2).children.indexOf(serviceCard),'Trade choice precedes Ogust search');
assert.equal(importedNotes.closest('.step'),sections.get(2),'Note import moves out of Client');assert.equal(importedNotes.closest('details').id,'fastNotesImport42');assert.equal(noteText,document.getElementById('noteText'),'Original import input and handlers are retained');
assert.notEqual(document.getElementById('fastDetailed42').getAttribute('open'),'','Old detailed choices are initially collapsed');
const nav=body.querySelector('.fastProgress42');assert.equal(nav.children.length,3);assert.equal(nav.children[2].children[1].textContent,'Vérifier');
assert.equal(nav.children[1].disabled,true);assert.equal(document.getElementById('fastVerify42').disabled,true);
ctx.goStep(3);assert.equal(navigation.at(-1),2);assert.equal(state.step,1,'Retains the client validation guard');
state.client='Laurent Hau';ctx.goStep(3);assert.equal(state.step,2);assert.ok(renders>0);assert.equal(km.value,.7);assert.equal(waste.value,25);
state.lines.push({qty:4,unitPriceTTC:47,vat:20});ctx.renderQuoteLines();
assert.equal(document.getElementById('fastLiveTotal42').textContent,'188.00 €');assert.equal(document.getElementById('fastVerify42').disabled,false);
document.getElementById('fastVerify42').click();assert.equal(state.step,4);assert.equal(nav.children[2].getAttribute('aria-current'),'step');assert.equal(nav.children[2].children[0].textContent,'3');
ctx.goStep(3);assert.equal(state.step,2,'Legacy return/edit and rate errors return to the same quote workspace');
assert.equal(state.lines[0].unitPriceTTC,47);assert.equal(state.lines[0].qty,4);assert.equal(creates,0,'Navigation never creates a quotation');
const notice=element('div',{class:'histDuplicateNotice'},'Copied quote');sections.get(3).append(notice);observers.find(x=>x.node===sections.get(3)).fn();assert.equal(notice.closest('.step'),sections.get(2),'Late historical notices follow the moved editor');
assert.equal(finalBack.textContent,'Modifier le devis');assert.equal(clientButton.textContent,'Préparer le devis');
// Modules that still polish their own hidden headers/progress cannot overwrite
// the visible v42 controls. The IDs they reference remain present.
oldLabel.textContent='Chiffrage';progress.children[1].textContent='Chantier';sections.get(2).querySelector('h1').textContent='Chantier';ctx.renderTotals();
assert.equal(document.getElementById('fastStepLabel42').textContent,'Devis');assert.equal(sections.get(2).querySelector('.fastHeader42').children[0].textContent,'Devis');
console.log('Fast flow: 3 visible steps, client validation, same editor/listeners, live total, legacy routes, late history notices, and no Ogust writes OK');
