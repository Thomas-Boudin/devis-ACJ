// Devis ACJ v29.2 — authentification Google et jeton Bearer pour le proxy Ogust.
(function(){
  if(window.__acjAuthV292)return;

  const CLIENT_ID='93181159242-i64qf82vtrij5c4b7l5q18ctjj48l3so.apps.googleusercontent.com';
  const STORAGE_KEY='acj_auth_id_token_v29_2';
  const API_ORIGIN='https://acj-ogust-proxy.vercel.app';
  const AUTH_STATUS_URL=API_ORIGIN+'/api/ogust-devis';
  let token='';
  let profile=null;
  let reloadScheduled=false;
  let authRequired=false;
  let modePromise=null;

  function decodePart(value){
    try{
      const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
      const padded=raw+'='.repeat((4-raw.length%4)%4);
      return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(padded),c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    }catch{return null}
  }
  function claims(value){const parts=String(value||'').split('.');return parts.length===3?decodePart(parts[1]):null}
  function tokenValid(value){
    const p=claims(value);if(!p)return false;
    const aud=Array.isArray(p.aud)?p.aud:[p.aud];
    const exp=Number(p.exp||0);
    return aud.map(String).includes(CLIENT_ID)&&exp>(Date.now()/1000)+45;
  }
  function readStored(){
    try{const value=sessionStorage.getItem(STORAGE_KEY)||'';if(tokenValid(value))return value;sessionStorage.removeItem(STORAGE_KEY)}catch{}
    return '';
  }
  function store(value){try{sessionStorage.setItem(STORAGE_KEY,value)}catch{}}
  function clear(){token='';profile=null;try{sessionStorage.removeItem(STORAGE_KEY)}catch{}}
  function isApiTarget(input){
    try{
      const raw=typeof input==='string'||input instanceof URL?String(input):String(input?.url||'');
      const u=new URL(raw,location.href);
      return u.origin===API_ORIGIN&&u.pathname.startsWith('/api/');
    }catch{return false}
  }
  function authHeaders(input,init){
    const base=init?.headers||(input instanceof Request?input.headers:undefined);
    const headers=new Headers(base||{});
    if(token)headers.set('Authorization',`Bearer ${token}`);
    return headers;
  }
  function syntheticAuthRequired(){
    return new Response(JSON.stringify({ok:false,error:'AUTH_REQUIRED'}),{status:401,headers:{'Content-Type':'application/json'}});
  }
  function scheduleRelogin(){
    if(reloadScheduled)return;reloadScheduled=true;clear();
    setTimeout(()=>location.reload(),120);
  }

  const nativeFetch=window.fetch.bind(window);
  async function detectAuthMode(){
    if(modePromise)return modePromise;
    modePromise=(async()=>{
      try{
        const r=await nativeFetch(AUTH_STATUS_URL,{cache:'no-store'});
        const data=await r.json().catch(()=>null);
        authRequired=!!(r.ok&&data?.auth_required===true&&String(data?.auth_version||'')==='29.2');
      }catch{authRequired=false}
      return authRequired;
    })();
    return modePromise;
  }

  window.fetch=async function(input,init){
    if(!isApiTarget(input))return nativeFetch(input,init);
    const required=await detectAuthMode();
    if(!required)return nativeFetch(input,init);
    if(!tokenValid(token))return syntheticAuthRequired();
    const next={...(init||{}),headers:authHeaders(input,init)};
    let response;
    if(input instanceof Request)response=await nativeFetch(new Request(input,next));
    else response=await nativeFetch(input,next);
    if(response.status===401||response.status===403)scheduleRelogin();
    return response;
  };

  function addStyles(){
    if(document.getElementById('acj-auth-v29-2-style'))return;
    const s=document.createElement('style');s.id='acj-auth-v29-2-style';s.textContent=`
      .acjAuthGate{position:fixed;inset:0;z-index:5000;background:#102033;display:grid;place-items:center;padding:22px;color:#f5f9fc}.acjAuthCard{width:min(420px,100%);background:#172b40;border:1px solid #456784;border-radius:22px;padding:22px;box-shadow:0 28px 90px rgba(0,0,0,.48);text-align:center}.acjAuthLogo{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;margin:0 auto 14px;background:linear-gradient(135deg,#58c7f3,#0ea5e9);color:#062034;font-weight:950;font-size:18px}.acjAuthTitle{font-size:22px;font-weight:950}.acjAuthText{font-size:12px;color:#b6c7d8;line-height:1.55;margin:8px 0 18px}.acjAuthButton{min-height:44px;display:flex;justify-content:center}.acjAuthStatus{font-size:11px;color:#b6c7d8;line-height:1.45;margin-top:13px}.acjAuthRetry{margin-top:12px;border:1px solid #456784;background:#1a3349;color:#f5f9fc;border-radius:12px;padding:10px 13px;font-weight:800}.acjAuthSession{margin-top:12px;padding-top:11px;border-top:1px solid #304d68;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:#b6c7d8}.acjAuthLogout{border:1px solid #456784;background:#1a3349;color:#f5f9fc;border-radius:10px;padding:8px 10px;font-weight:800}
    `;document.head.appendChild(s);
  }
  function gate(status='Connexion Google requise pour accéder aux données Ogust.'){
    addStyles();document.getElementById('acjAuthGateV292')?.remove();
    const el=document.createElement('div');el.id='acjAuthGateV292';el.className='acjAuthGate';
    el.innerHTML=`<div class="acjAuthCard"><div class="acjAuthLogo">ACJ</div><div class="acjAuthTitle">Devis ACJ</div><div class="acjAuthText">L’accès aux clients et aux devis Ogust est protégé par un compte Google autorisé.</div><div id="acjGoogleButtonV292" class="acjAuthButton"></div><div id="acjAuthStatusV292" class="acjAuthStatus">${status}</div></div>`;
    document.body.appendChild(el);document.body.style.overflow='hidden';
  }
  function status(text){const el=document.getElementById('acjAuthStatusV292');if(el)el.textContent=text||''}
  function loginSuccess(response){
    const value=String(response?.credential||'');
    if(!tokenValid(value)){status('La connexion Google n’a pas renvoyé une session valide. Réessaie.');return}
    token=value;store(value);profile=claims(value)||null;
    status('Connexion validée. Ouverture de l’application…');
    setTimeout(()=>{document.getElementById('acjAuthGateV292')?.remove();document.body.style.overflow='';addSessionControl();window.dispatchEvent(new CustomEvent('acj:auth-ready',{detail:{email:String(profile?.email||'')}}));},120);
  }
  function renderGoogleButton(){
    const box=document.getElementById('acjGoogleButtonV292');if(!box||!window.google?.accounts?.id)return false;
    try{
      google.accounts.id.initialize({client_id:CLIENT_ID,callback:loginSuccess,auto_select:true,cancel_on_tap_outside:false});
      google.accounts.id.renderButton(box,{type:'standard',theme:'outline',size:'large',shape:'pill',text:'continue_with',width:300,locale:'fr'});
      google.accounts.id.prompt();
      status('Choisis le compte Google autorisé pour ACJ.');
      return true;
    }catch{status('Impossible d’initialiser la connexion Google.');return false}
  }
  function loadGoogle(){
    if(renderGoogleButton())return;
    const existing=document.querySelector('script[data-acj-google-auth]');
    if(existing){existing.addEventListener('load',renderGoogleButton,{once:true});return}
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.acjGoogleAuth='1';
    script.onload=()=>{if(!renderGoogleButton())status('La connexion Google n’est pas disponible. Réessaie.')};
    script.onerror=()=>{status('Google est inaccessible. Vérifie la connexion internet.');const card=document.querySelector('.acjAuthCard');if(card&&!card.querySelector('.acjAuthRetry')){const b=document.createElement('button');b.className='acjAuthRetry';b.textContent='Réessayer';b.onclick=()=>location.reload();card.appendChild(b)}};
    document.head.appendChild(script);
  }
  function addSessionControl(){
    if(document.getElementById('acjAuthSessionV292'))return;
    const settings=document.querySelector('.settings');if(!settings)return;
    const p=profile||{};const line=document.createElement('div');line.id='acjAuthSessionV292';line.className='acjAuthSession';
    const label=p.email?`Session Google : ${String(p.email)}`:'Session Google sécurisée';
    line.innerHTML=`<span>${label.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}</span><button type="button" class="acjAuthLogout">Déconnexion</button>`;
    line.querySelector('button').addEventListener('click',()=>{try{google?.accounts?.id?.disableAutoSelect()}catch{}clear();location.reload()});
    settings.appendChild(line);
  }
  function unlock(){
    document.getElementById('acjAuthGateV292')?.remove();document.body.style.overflow='';
    profile=claims(token)||null;
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addSessionControl,{once:true});else addSessionControl();
    window.dispatchEvent(new CustomEvent('acj:auth-ready',{detail:{email:String(profile?.email||'')}}));
  }
  async function init(){
    const required=await detectAuthMode();
    if(!required){window.dispatchEvent(new CustomEvent('acj:auth-ready',{detail:{legacy:true}}));return}
    token=readStored();
    if(token){unlock();return}
    gate();loadGoogle();
  }

  window.acjAuthV292={get authenticated(){return !authRequired||tokenValid(token)},logout(){clear();location.reload()}};
  window.__acjAuthV292=true;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
