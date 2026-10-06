import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const nodes=new Map();let sends=0,ready=false,step=4,status='';
const ctx={queueMicrotask,document:{readyState:'complete',getElementById:id=>nodes.get(id),createElement(){return{set id(id){nodes.set(id,this)},setAttribute(){},scrollIntoView(){}}}},acjAIReadiness(){return{ok:ready,unconfirmed:ready?[]:['l1']}},goStep(n){step=n},showStatus(id,msg){status=msg},sendToOgust(){sends++}};ctx.window=ctx;nodes.set('quoteLines',{insertAdjacentElement(){}});
vm.runInNewContext(fs.readFileSync('ai-policy-v18.js','utf8'),ctx);await new Promise(r=>setImmediate(r));ctx.sendToOgust();assert.equal(sends,0);assert.equal(step,2);assert.match(status,/Confirme/);assert.equal(nodes.get('aiReadiness42').textContent,status);
ready=true;nodes.get('aiReadiness42').remove=()=>nodes.delete('aiReadiness42');ctx.sendToOgust();assert.equal(sends,1);assert.equal(nodes.has('aiReadiness42'),false);
console.log('AI send guard: unconfirmed duration blocks API preparation; confirmation restores sending');
