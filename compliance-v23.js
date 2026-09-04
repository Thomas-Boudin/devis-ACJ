// Devis ACJ v23 — email des nouveaux clients et numéro officiel attribué par Ogust.
(function(){
  let officialNumber='';
  let officialId='';

  function htmlEsc(v){
    if(typeof window.esc==='function')return window.esc(v);
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function emailValue(){return (document.getElementById('email')?.value||'').trim()}

  function injectEmailField(){
    if(document.getElementById('email'))return;
    const tel=document.getElementById('tel')?.closest('.field');
    if(!tel)return;
    const field=document.createElement('div');
    field.className='field';
    field.innerHTML='<label>Adresse mail</label><input id="email" type="email" autocomplete="email" placeholder="client@exemple.fr">';
    tel.insertAdjacentElement('afterend',field);
  }

  function wrapQuotePayload(){
    if(window.__acjQuotePayloadV23Wrapped||typeof window.quotePayload!=='function')return;
    const original=window.quotePayload;
    window.quotePayload=function(){
      const payload=original.apply(this,arguments);
      if(payload?.client)payload.client.email=emailValue();
      return payload;
    };
    window.__acjQuotePayloadV23Wrapped=true;
  }

  function internalRef(){
    try{return window.quotePayload?.()?.numero_devis||''}catch{return''}
  }

  function ensureNotice(){
    let notice=document.getElementById('ogustNumberNotice');
    if(notice)return notice;
    const actions=document.querySelector('.finalActions');
    if(!actions)return null;
    notice=document.createElement('div');
    notice.id='ogustNumberNotice';
    notice.className='notice';
    notice.style.margin='0 0 12px';
    actions.insertAdjacentElement('beforebegin',notice);
    return notice;
  }

  function makeNewQuoteVisible(){
    const btn=[...document.querySelectorAll('.finalActions button')].find(b=>/nouveau devis/i.test(b.textContent||''));
    if(btn){btn.classList.add('primary');btn.textContent='Nouveau devis'}
  }

  function refreshSummary(){
    const summary=document.getElementById('clientSummary');
    if(!summary)return;
    const spans=summary.querySelectorAll('span');
    const last=spans[spans.length-1];
    if(!last)return;
    if(!last.dataset.acjBase)last.dataset.acjBase=last.textContent||'';
    if(officialNumber){
      const company=(last.dataset.acjBase||'').split(' · ')[0]||'';
      last.textContent=`${company} · N° Ogust ${officialNumber}`;
    }else{
      last.textContent=last.dataset.acjBase||last.textContent;
    }
  }

  function refreshNumberUI(){
    const ref=internalRef();
    const top=document.getElementById('quoteNumberTop');
    if(top)top.textContent=officialNumber?`N° ${officialNumber}`:(ref?`Réf. ${ref}`:'—');
    const notice=ensureNotice();
    if(notice){
      if(officialNumber){
        notice.innerHTML=`Numéro officiel attribué par Ogust : <strong>${htmlEsc(officialNumber)}</strong>${officialId?` · ID ${htmlEsc(officialId)}`:''}. Les PDF générés maintenant utilisent ce numéro.`;
      }else{
        notice.innerHTML=`La référence <strong>${htmlEsc(ref||'ACJ')}</strong> est interne à l’application. Le <strong>numéro officiel du devis</strong> sera celui attribué par Ogust lors de la création. Un PDF généré avant cette étape est marqué « Brouillon ».`;
      }
    }
    refreshSummary();
    makeNewQuoteVisible();
  }

  window.applyOgustQuotationNumber=function(number,id){
    const n=String(number||'').trim();
    if(!n)return;
    officialNumber=n;
    officialId=String(id||'').trim();
    refreshNumberUI();
  };

  function wrapBuildPrint(){
    if(window.__acjBuildPrintV23Wrapped||typeof window.buildPrintHTML!=='function')return;
    const original=window.buildPrintHTML;
    window.buildPrintHTML=function(){
      let html=original.apply(this,arguments);
      const ref=internalRef();
      const label=officialNumber?`N° ${htmlEsc(officialNumber)}`:`BROUILLON · réf. ${htmlEsc(ref||'ACJ')}`;
      html=html.replace(/<div class="printDocNo">N° [^<]*<\/div>/,`<div class="printDocNo">${label}</div>`);
      return html;
    };
    window.__acjBuildPrintV23Wrapped=true;
  }

  function wrapRenderReview(){
    if(window.__acjRenderReviewV23Wrapped||typeof window.renderReview!=='function')return;
    const original=window.renderReview;
    window.renderReview=function(){const out=original.apply(this,arguments);refreshNumberUI();return out};
    window.__acjRenderReviewV23Wrapped=true;
  }

  function wrapNewQuote(){
    if(window.__acjNewQuoteV23Wrapped||typeof window.newQuote!=='function')return;
    const original=window.newQuote;
    window.newQuote=function(){
      const out=original.apply(this,arguments);
      officialNumber='';officialId='';
      const email=document.getElementById('email');if(email)email.value='';
      const summary=document.getElementById('clientSummary');summary?.querySelectorAll('span').forEach(x=>delete x.dataset.acjBase);
      refreshNumberUI();
      return out;
    };
    window.__acjNewQuoteV23Wrapped=true;
  }

  function watchNewCustomerModal(){
    const fill=()=>{
      const input=document.getElementById('ogwNewEmail');
      if(!input||input.dataset.acjV23Filled)return;
      const email=emailValue();
      if(email&&!input.value){input.value=email;input.dispatchEvent(new Event('input',{bubbles:true}))}
      input.dataset.acjV23Filled='1';
    };
    const observer=new MutationObserver(fill);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    fill();
  }

  function wrapFetch(){
    if(window.__acjFetchV23Wrapped||typeof window.fetch!=='function')return;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      const response=await nativeFetch(input,init);
      try{
        const url=typeof input==='string'?input:(input?.url||'');
        const method=String(init?.method||input?.method||'GET').toUpperCase();
        if(method==='POST'&&url.includes('/api/ogust-quotation')){
          response.clone().json().then(data=>{
            if(data?.ok&&data?.ogust_number)window.applyOgustQuotationNumber(data.ogust_number,data.id_quotation);
          }).catch(()=>{});
        }
      }catch(e){}
      return response;
    };
    window.__acjFetchV23Wrapped=true;
  }

  function init(){
    injectEmailField();
    wrapQuotePayload();
    wrapBuildPrint();
    wrapRenderReview();
    wrapNewQuote();
    wrapFetch();
    watchNewCustomerModal();
    refreshNumberUI();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
