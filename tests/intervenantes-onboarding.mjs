import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tokenKey='acj_intervenantes_google_token';
const pushIdKey='acj_intervenantes_push_id';
const pushEmployeeKey='acj_intervenantes_push_employee';

async function exercise(scenario){
  const deps=process.env.ACJ_DOM_TEST_DEPS||path.resolve(root,'../dom-test/node_modules');
  const require=createRequire(path.join(deps,'onboarding-test.cjs'));
  const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
  const {IDBFactory}=require('fake-indexeddb');
  const errors=[],calls=[];
  let actor='intervenante',activeToken='',permissions=0,subscription=null,googleInitializations=0;
  const sessionFor=role=>'acjs1.'+Buffer.from(JSON.stringify({email:role+'@example.test',role})).toString('base64url')+'.fixture-signature';
  const registration={pushManager:{
    async getSubscription(){return subscription;},
    async subscribe(){subscription={toJSON:()=>({endpoint:'https://fixture.invalid/push',keys:{p256dh:'fixture-public',auth:'fixture-auth'}})};return subscription;}
  }};
  class LocalScripts extends ResourceLoader{
    fetch(url){
      const parsed=new URL(url),prefix='/devis-ACJ/';
      if(parsed.origin!=='https://thomas-boudin.github.io'||!parsed.pathname.startsWith(prefix))return null;
      return Promise.resolve(fs.readFileSync(path.join(root,parsed.pathname.slice(prefix.length))));
    }
  }
  const vc=new VirtualConsole();
  vc.on('jsdomError',error=>errors.push(error.message));
  vc.on('error',(...items)=>errors.push(items.map(String).join(' ')));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'intervenantes/index.html'),'utf8'),{
    url:'https://thomas-boudin.github.io/devis-ACJ/intervenantes/',
    resources:new LocalScripts(),runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      Object.assign(w,{Response,Request,Headers,AbortController,AbortSignal,structuredClone,indexedDB:new IDBFactory()});
      w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
      // Let the old polling period expire before login, without slowing CI.
      const interval=w.setInterval.bind(w);
      w.setInterval=(callback,delay,...args)=>interval(callback,delay===500?1:delay,...args);
      const timeout=w.setTimeout.bind(w);
      w.setTimeout=(callback,delay,...args)=>timeout(callback,delay===4500?50:delay===9500?80:delay,...args);
      w.Notification=class{
        static permission='default';
        static async requestPermission(){permissions++;this.permission='granted';return this.permission;}
      };
      w.PushManager=class{};
      Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration)}});
      const google={accounts:{id:{initialize(){googleInitializations++;},renderButton(node){node.textContent='Continuer avec Google';},disableAutoSelect(){}}}};
      if(scenario==='intervenante')timeout(()=>{w.google=google;},20);
      else w.google=google;
      w.localStorage.setItem('acj_intervenantes_role','admin');
      w.localStorage.setItem('acj_intervenantes_employee','11');
      w.fetch=async(input,init={})=>{
        const url=new URL(String(input?.url||input)),action=url.searchParams.get('action'),method=init.method||'GET';
        const authorization=init.headers?.Authorization||'';
        const body=init.body?JSON.parse(init.body):null;
        calls.push({action,method,authorization,body});
        assert.equal(url.origin,'https://acj-ogust-proxy.vercel.app');
        let data={ok:true},status=200;
        if(action==='email_login_status'){
          assert.equal(method,'GET');assert.equal(authorization,'');data.available=true;
        }else if(action==='session'){
          assert.equal(method,'POST');
          assert.ok(authorization.startsWith('Bearer fixture-google-'));
          if(scenario==='denied'){status=403;data={ok:false,error:'AUTH_FORBIDDEN'};}
          else{
            actor=authorization.endsWith('admin')?'admin':'intervenante';
            activeToken=sessionFor(actor);
            data={ok:true,token:activeToken,role:actor,expires_in:3600};
          }
        }else if(action==='push_config'){
          assert.equal(method,'GET');data.public_key=Buffer.alloc(65,1).toString('base64url');
        }else{
          assert.equal(authorization,'Bearer '+activeToken,'Protected requests use the exchanged session, never the Google credential');
          if(action==='push_subscribe'){
            assert.equal(method,'POST');assert.equal(body.employee_id,'11');
            data={ok:true,push_id:'fixture-push-id',employee_name:'Intervenante A'};
          }else{
            assert.equal(method,'GET','Pointage and planning bootstrap perform no business writes');
            if(action==='role')data={ok:true,role:actor,email:actor+'@example.test',name:'Fixture'};
            if(action==='config'){
              if(scenario==='unlinked'){status=403;data={ok:false,error:'EMPLOYEE_ACCOUNT_NOT_LINKED'};}
              else data={ok:true,employees:actor==='admin'
                ?[{id_employee:'11',label:'Intervenante A'},{id_employee:'22',label:'Intervenante B'}]
                :[{id_employee:'11',label:'Intervenante A'}],...(actor==='intervenante'?{self_employee_id:'11'}:{})};
            }
            if(action==='planning')data={ok:true,services:[{
              id_service:'101',id_employee:url.searchParams.get('employee_id'),id_customer:'201',
              start_time:'09:00',end_time:'11:30',status:'A',type:'I',
              customer:{name:'Client test',address:'Adresse test',phone:''},product:{label:'Ménage'}
            }]};
            if(action==='pointage_day')data={ok:true,pointages:[],absences:[],active:null};
          }
        }
        return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
      };
    }
  });
  const w=dom.window,doc=w.document;
  async function until(predicate,label){
    for(let i=0;i<100;i++){if(predicate())return;await pause(15);}
    throw new Error(label);
  }
  try{
    await until(()=>doc.getElementById('acjNotificationEnable'),'The real page loads the activation button');
    await pause(120);
    assert.equal(googleInitializations,1,'The Google sign-in client is initialized only once');
    assert.equal(calls.filter(c=>c.action!=='email_login_status').length,0,'Signed-out visitors cause no authenticated or subscription requests');
    assert.equal(w.ACJ_INTERVENANTES_ROLE,'intervenante','A cached admin role cannot grant access');
    const desired=scenario==='admin-switch'?'admin':'intervenante';
    await w.googleLogin({credential:'fixture-google-'+desired});
    if(scenario==='denied'||scenario==='unlinked'){
      await pause(40);
      assert.equal(doc.getElementById('app').hidden,true);
      assert.equal(doc.getElementById('login').hidden,false);
      assert.equal(w.localStorage.getItem(tokenKey),null);
      assert.equal(w.sessionStorage.getItem(tokenKey),null);
      assert.match(doc.getElementById('loginStatus').textContent,scenario==='denied'?/adresse.*autorisée/:/fiche intervenante active/);
      assert.ok(!calls.some(c=>c.action==='planning'||c.action==='push_subscribe'));
    }else{
      await until(()=>!doc.getElementById('app').hidden&&w.ACJ_INTERVENANTES_ROLE===desired,'Login completes after the old polling window');
      assert.equal(w.localStorage.getItem(tokenKey),activeToken);
      assert.equal(w.sessionStorage.getItem(tokenKey),activeToken);
      const select=doc.getElementById('employee');
      assert.equal(select.value,'11');
      if(scenario==='admin-switch'){
        assert.equal(select.disabled,false);
        w.Notification.permission='granted';
        w.localStorage.setItem(pushIdKey,'previous-subscription');
        w.localStorage.setItem(pushEmployeeKey,'11');
        const before=calls.filter(c=>c.action==='push_subscribe').length;
        select.value='22';select.dispatchEvent(new w.Event('change',{bubbles:true}));
        await pause(60);
        assert.equal(calls.filter(c=>c.action==='push_subscribe').length,before,'Browsing another employee does not reassign the admin phone');
        doc.getElementById('logout').click();
        await pause(20);
        assert.equal(w.localStorage.getItem(tokenKey),null);
        assert.equal(w.sessionStorage.getItem(tokenKey),null);
        assert.equal(doc.getElementById('app').hidden,true);
        assert.equal(w.ACJ_INTERVENANTES_ROLE,'intervenante','Logout revokes the administrative UI');
        await w.googleLogin({credential:'fixture-google-intervenante'});
        await until(()=>!doc.getElementById('app').hidden&&w.ACJ_INTERVENANTES_ROLE==='intervenante','A second account receives its own access');
        assert.equal(select.value,'11');assert.equal(select.disabled,true);
        assert.equal(doc.querySelectorAll('.bottomNav .navItem')[1].hidden,true);
      }else{
        assert.equal(select.disabled,true,'An employee is locked to their own Ogust record');
        doc.getElementById('acjNotificationEnable').click();
        await until(()=>calls.some(c=>c.action==='push_subscribe'),'Phone activation reaches the protected subscription endpoint');
        await until(()=>doc.getElementById('acjNotificationStatus').textContent.includes('Notifications activées'),'Registration is confirmed');
        assert.equal(permissions,1);
        assert.equal(w.localStorage.getItem(pushEmployeeKey),'11');
      }
    }
    assert.deepEqual(errors,[],'Production modules run without browser errors');
    return{scenario,calls:calls.length};
  }finally{w.close();}
}
if(isMainThread){
  for(const scenario of ['intervenante','admin-switch','denied','unlinked']){
    const result=await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL(import.meta.url),{workerData:scenario});
      const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Onboarding blocked: '+scenario));},10000);
      worker.once('message',result=>{clearTimeout(timeout);worker.terminate();result.error?reject(new Error(result.error)):resolve(result);});
      worker.once('error',error=>{clearTimeout(timeout);reject(error);});
      worker.once('exit',code=>{clearTimeout(timeout);if(code)reject(new Error('Worker stopped: '+scenario));});
    });
    console.log('Intervenantes onboarding OK: '+result.scenario+' ('+result.calls+' mocked calls)');
  }
}else{
  exercise(workerData).then(result=>parentPort.postMessage(result),error=>parentPort.postMessage({error:error.stack||error.message}));
}

