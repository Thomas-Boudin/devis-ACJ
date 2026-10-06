import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes={};this.listeners={};this.style={};this.dataset={};this.value='';this.disabled=false;this._text='';this.classList={add(){},remove(){},toggle(){}}}
  set id(v){this.attributes.id=String(v)}get id(){return this.attributes.id||''}
  set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
  setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]??null}
  appendChild(child){if(child.parentElement){const items=child.parentElement.children;items.splice(items.indexOf(child),1)}child.parentElement=this;this.children.push(child);return child}
  append(...children){children.forEach(x=>this.appendChild(x))}
  prepend(child){this.appendChild(child);this.children.pop();this.children.unshift(child)}
  insertAdjacentElement(position,child){if(position==='afterbegin'){this.prepend(child);return}if(position==='beforeend'){this.append(child);return}const owner=this.parentElement;assert.ok(owner);owner.appendChild(child);owner.children.pop();const i=owner.children.indexOf(this);owner.children.splice(i+(position==='afterend'?1:0),0,child)}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
  removeEventListener(name,fn){this.listeners[name]=(this.listeners[name]||[]).filter(x=>x!==fn)}
  dispatchEvent(event){event.target=this;(this.listeners[event.type]||[]).forEach(fn=>fn(event));if(event.bubbles)this.document?.dispatchEvent(event);return true}
  click(){if(!this.disabled)this.dispatchEvent({type:'click',target:this,bubbles:true,preventDefault(){}})}
  focus(){this.focused=true}
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector==='.step')return this.attributes.class==='step';return this.tagName===selector.toUpperCase()}
  closest(selector){let node=this;while(node){if(node.matches(selector))return node;node=node.parentElement}return null}
  querySelectorAll(selector){return this.children.flatMap(x=>[...(x.matches(selector)?[x]:[]),...x.querySelectorAll(selector)])}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
}
function result(text,final=false){const row=[{transcript:text,confidence:.9}];row.isFinal=final;row.item=i=>row[i];return row}
function recognitionEvent(rows,index=0){const list=rows.map(([text,final])=>result(text,final));list.item=i=>list[i];return {results:list,resultIndex:index}}
function environment({support=true,webkit=false,startError=false,secure=true}={}){
  const events={},docEvents={},recognizers=[],state={company:'ACJ Services',number:'ACJ-VOICE',step:2},head=new Element('head'),body=new Element('body'),section=new Element('section'),card=new Element('div'),text=new Element('textarea');
  section.setAttribute('class','step');section.setAttribute('data-step','2');card.id='aiChantierCard';text.id='aiChantierText';card.append(text);section.append(card);body.append(section);
  let inputEvents=0,analyses=0,writes=0,nextTimer=0;const timers=new Map();
  const document={readyState:'complete',hidden:false,visibilityState:'visible',head,body,createElement(tag){const el=new Element(tag);el.document=document;return el},getElementById(id){return head.querySelector('#'+id)||body.querySelector('#'+id)},querySelector(selector){return body.querySelector(selector)},addEventListener(name,fn){(docEvents[name]??=[]).push(fn)},dispatchEvent(event){(docEvents[event.type]||[]).forEach(fn=>fn(event));if(event.bubbles)(events[event.type]||[]).forEach(fn=>fn(event));return true}};
  text.document=document;text.addEventListener('input',()=>inputEvents++);
  class MockRecognition{
    constructor(){this.starts=0;this.stops=0;this.aborts=0;recognizers.push(this)}
    start(){this.starts++;if(startError)throw Error('Microphone unavailable')}
    stop(){this.stops++}
    abort(){this.aborts++}
    emit(name,payload={}){this['on'+name]?.(payload)}
  }
  const ctx={window:null,document,state,queueMicrotask,setTimeout,clearTimeout,Event:class{constructor(type,options={}){this.type=type;this.bubbles=!!options.bubbles}},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},currentOgustCompanyV28:()=>state.company,addEventListener(name,fn){(events[name]??=[]).push(fn)},dispatchEvent(event){(events[event.type]||[]).forEach(fn=>fn(event));return true},goStep(n){state.step=n},setCompany(n){state.company=n},setMode(n){state.mode=n},newQuote(){state.number='ACJ-NEW';state.step=1;text.value=''},analyseChantierAI(){analyses++},analyseChantier(){analyses++},analyzeChantier(){analyses++},fetch(){writes++;throw Error('Voice must never use a network API')},navigator:{userAgent:'test'}};
  ctx.isSecureContext=secure;ctx.setTimeout=fn=>{const id=++nextTimer;timers.set(id,fn);return id};ctx.clearTimeout=id=>timers.delete(id);
  ctx.window=ctx;if(support)ctx[webkit?'webkitSpeechRecognition':'SpeechRecognition']=MockRecognition;
  const source=fs.readFileSync(new URL('../voice-v43.js',import.meta.url),'utf8');vm.runInNewContext(source,ctx);
  return {ctx,state,text,recognizers,document,runTimers(){const tasks=[...timers.values()];timers.clear();tasks.forEach(fn=>fn())},emit(name,payload={}){ctx.dispatchEvent({type:name,...payload})},emitDocument(name){document.dispatchEvent({type:name})},get button(){return document.getElementById('voiceToggle43')},get status(){return document.getElementById('voiceStatus43')?.textContent||''},get preview(){return document.getElementById('voicePreview43')?.textContent||''},get inputs(){return inputEvents},get analyses(){return analyses},get writes(){return writes}};
}
const settle=()=>new Promise(resolve=>queueMicrotask(resolve));

const live=environment();await settle();assert.ok(live.button);assert.match(live.button.textContent,/Dicter/);live.text.value='Notes déjà saisies.';
live.button.click();assert.equal(live.recognizers.length,1);const rec=live.recognizers[0];assert.equal(rec.starts,1);assert.equal(rec.lang,'fr-FR');assert.equal(rec.continuous,true);assert.equal(rec.interimResults,true);
rec.emit('start');assert.match(live.button.textContent,/Arrêter/);
rec.emit('result',recognitionEvent([['Tailler le saule',false]]));assert.equal(live.text.value,'Notes déjà saisies.');assert.match(live.preview,/Tailler le saule/);
rec.emit('result',recognitionEvent([['Tailler le saule.',true],['Enlever',false]]));assert.match(live.text.value,/Notes déjà saisies\./);assert.match(live.text.value,/Tailler le saule\./);assert.match(live.preview,/Enlever/);
const firstFinal=live.text.value;rec.emit('result',recognitionEvent([['Tailler le saule.',true],['Enlever',false]]));assert.equal(live.text.value,firstFinal,'The same finalized index is not appended again');
rec.emit('result',recognitionEvent([['Tailler le saule.',true],['Enlever le romarin.',true]],1));assert.match(live.text.value,/Enlever le romarin\./);assert.equal(live.text.value.split('Tailler le saule.').length,2);assert.ok(live.inputs>=2,'Final recognition bubbles input for AI invalidation and draft saving');

// stop() allows its last finalized result; it does not automatically restart.
live.button.click();assert.equal(rec.stops,1);const beforeEnd=live.recognizers.length;live.button.click();assert.equal(live.recognizers.length,beforeEnd,'A stopping session must end before a new session starts');
rec.emit('result',recognitionEvent([['Tailler le saule.',true],['Enlever le romarin.',true],['Quatre heures.',true]],2));assert.match(live.text.value,/Quatre heures\./);
rec.emit('end');assert.equal(rec.starts,1);assert.match(live.button.textContent,/Dicter/);assert.equal(live.preview,'');
live.button.click();assert.equal(live.recognizers.length,2);const second=live.recognizers[1];second.emit('start');
second.emit('result',recognitionEvent([['Sans évacuation.',true]]));assert.match(live.text.value,/Sans évacuation\./);

// Manual editing wins over late recognizer callbacks, and confirmed text remains intact.
const lateResult=second.onresult;live.text.value+=' Correction manuelle.';live.text.dispatchEvent({type:'input',bubbles:true,isTrusted:true});assert.equal(second.aborts,1);
const manuallyEdited=live.text.value;lateResult?.(recognitionEvent([['Texte obsolète.',true]]));assert.equal(live.text.value,manuallyEdited);
second.emit('end');assert.equal(live.writes,0);assert.equal(live.analyses,0);

for(const [reason,change] of [
  ['company',env=>{env.state.company='ACJ Services Lens';env.emit('acj:company-changed',{detail:{company:env.state.company}})}],
  ['reference',env=>{env.state.number='NEW-REF';env.recognizers[0].emit('result',recognitionEvent([['Ancien devis.',true]]))}],
  ['newQuote',env=>env.ctx.newQuote()],
  ['mode',env=>env.ctx.setMode('menage')],
  ['navigation',env=>env.ctx.goStep(1)],
  ['pagehide',env=>env.emit('pagehide')],
  ['hidden',env=>{env.document.hidden=true;env.document.visibilityState='hidden';env.emitDocument('visibilitychange')}]
]){
  const env=environment({webkit:true});await settle();env.text.value='Saisie conservée.';env.button.click();const r=env.recognizers[0];r.emit('start');const late=r.onresult;change(env);
  assert.equal(r.aborts,1,`${reason} aborts the recognizer`);const preserved=env.text.value;late?.(recognitionEvent([['Ancien résultat.',true]]));assert.equal(env.text.value,preserved,`${reason} rejects callbacks of the old session`);assert.equal(env.writes,0);assert.equal(env.analyses,0);
}

const fallback=environment({support:false});await settle();assert.equal(fallback.button.textContent,'Dicter avec le clavier');fallback.button.click();assert.equal(fallback.text.focused,true);assert.match(fallback.status,/clavier|micro/i);assert.equal(fallback.recognizers.length,0);
const insecure=environment({secure:false});await settle();assert.equal(insecure.button.textContent,'Dicter avec le clavier');insecure.button.click();assert.equal(insecure.recognizers.length,0);
for(const [code,message] of [['not-allowed',/micro|autorisa|permission/i],['network',/réseau|connexion|clavier/i],['no-speech',/parole|entendu|recommen/i]]){
  const env=environment();await settle();env.button.click();const r=env.recognizers[0];r.emit('error',{error:code});assert.match(env.status,message,`Actionable error for ${code}`);r.emit('end');assert.equal(r.starts,1);assert.equal(env.recognizers.length,1,'Errors never auto-restart recognition');assert.equal(env.writes,0);
}
const empty=environment();await settle();empty.button.click();empty.recognizers[0].emit('end');assert.match(empty.status,/Aucune parole|aucun texte|rien.*reconnu/i);
const failure=environment({startError:true});await settle();failure.button.click();assert.ok(failure.status.length>10);assert.equal(failure.writes,0);
const analyse=environment();await settle();analyse.button.click();const analyseRec=analyse.recognizers[0];analyseRec.emit('start');
analyse.ctx.analyseChantierAI();assert.equal(analyseRec.stops,1);assert.equal(analyse.analyses,0,'Analysis waits for the pending final speech result');
analyseRec.emit('result',recognitionEvent([['Jardinage quatre heures.',true]]));analyseRec.emit('end');assert.equal(analyse.analyses,0,'Finishing voice never starts an analysis');
analyse.ctx.analyseChantierAI();assert.equal(analyse.analyses,1,'The next explicit analysis action runs normally');assert.equal(analyse.writes,0);
const timedOut=environment();await settle();timedOut.text.value='Notes conservées.';timedOut.button.click();const timedRec=timedOut.recognizers[0],late=timedRec.onresult;timedRec.emit('start');timedOut.button.click();timedOut.runTimers();
assert.equal(timedRec.aborts,1);assert.equal(timedOut.button.disabled,false);assert.equal(timedOut.text.value,'Notes conservées.');late?.(recognitionEvent([['Ancienne transcription.',true]]));assert.equal(timedOut.text.value,'Notes conservées.');
console.log('Voice: French recognition, interim preview, exact final append, stop/final flush, generation guards, manual edits, lifecycle aborts, keyboard fallback and no automatic analysis/Ogust writes OK');
