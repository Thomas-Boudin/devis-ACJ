// Devis ACJ v24 — synchronisation légère des prestations principales avec Ogust.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-history?catalog=1';
  const LS='acj_ogust_prestations_v24';
  const TTL=24*60*60*1000;
  let catalog=[];
  let loaded=false;

  const MAP={
    jardin:{
      tonte:{hourly:{title:"Tonte de Pelouse à l'heure",rename:true},auto:{title:"Tonte de Pelouse à l'heure",rename:true},flat:{title:'Tonte de Pelouse',rename:true}},
      haie:{hourly:{title:"Taille de Haies à l'Heure",rename:true},auto:{title:"Taille de Haies à l'Heure",rename:true},flat:{title:'Taille de Haies',rename:true}},
      debroussaillage:{hourly:{title:"Debrousaillage à l'heure",rename:true},auto:{title:"Debrousaillage à l'heure",rename:true},flat:{title:'Debrousaillage',rename:true}},
      desherbage:{hourly:{title:'désherbage manuel',rename:true},flat:{title:'désherbage manuel',rename:true}}
    },
    menage:{
      entretien:{hourly:{title:'Entretien régulier du logement',rename:true},flat:{title:'Forfait Entretien ménager',rename:true}},
      grand_menage:{flat:{title:'Forfait Gros Ménage',rename:true}},
      vitres:{hourly:{title:'Nettoyage de vitres',rename:true},flat:{title:'Nettoyage de vitres',rename:true}},
      repassage:{hourly:{title:"Repassage à l'heure",rename:true},flat:{title:'Repassage',rename:true}}
    },
    bricol:{
      bricolage:{hourly:{title:'Petit bricolage',rename:true},flat:{title:'Forfait Bricolage',rename:true}},
      montage:{hourly:{title:'Petit bricolage',rename:false},flat:{title:'Forfait Bricolage',rename:false}},
      fixation:{hourly:{title:'Petit bricolage',rename:false},flat:{title:'Forfait Bricolage',rename:false}},
      maintenance:{hourly:{title:'Petit bricolage',rename:false},flat:{title:'Forfait Bricolage',rename:false}}
    },
    nettoyagePro:{
      locaux:{hourly:{title:'MENAGE PRO',rename:false},flat:{title:'Forfait Entretien des locaux',rename:true}},
      vitrerie_pro:{hourly:{title:'Nettoyage de vitres',rename:true},flat:{title:'Nettoyage de vitres',rename:true}}
    }
  };
  const COST_MAP={
    fournitures:{title:'fourniture et matériel',rename:true},
    deplacement:{title:'Frais de déplacements',rename:true}
  };

  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function escHtml(v){
    if(typeof window.esc==='function')return window.esc(v);
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function findTitle(title){
    const key=norm(title);if(!key)return null;
    const exact=catalog.filter(x=>norm(x?.title)===key);
    if(exact.length===1)return exact[0];
    const used=exact.filter(x=>x?.used_in_recent_quotes);
    if(used.length===1)return used[0];
    return null;
  }
  function specFor(mode,preset,method){
    const byPreset=MAP?.[mode]?.[preset];if(!byPreset)return null;
    return byPreset[method]||byPreset.hourly||byPreset.flat||null;
  }
  function matchFor(mode,preset,method){
    const spec=specFor(mode,preset,method);if(!spec)return null;
    const product=findTitle(spec.title);if(!product)return null;
    return {...product,rename:!!spec.rename};
  }
  function costMatch(type){
    const spec=COST_MAP[type];if(!spec)return null;
    const product=findTitle(spec.title);if(!product)return null;
    return {...product,rename:!!spec.rename};
  }
  function attach(line,match,originalDesignation=''){
    if(!line||!match)return;
    line.ogustProductLevelId=String(match.id||'');
    line.ogustProductLevelTitle=String(match.title||'');
    if(match.rename&&match.title)line.designation=match.title;
    if(!match.rename&&originalDesignation&&line.meta&&!line.meta.includes('Ogust')){
      line.meta=`${line.meta} · Ogust : ${match.title}`;
    }
  }

  function addStyles(){
    if(document.getElementById('ogps-v24-style'))return;
    const s=document.createElement('style');s.id='ogps-v24-style';
    s.textContent='.ogpsBadge{margin:-4px 0 12px;padding:8px 10px;border:1px solid #166534;background:#0b2818;border-radius:11px;color:#bbf7d0;font-size:10px;line-height:1.35}.ogpsBadge strong{color:#dcfce7}.ogpsDim{border-color:#334155;background:#0b1523;color:#94a3b8}';
    document.head.appendChild(s);
  }
  function enhanceBuilder(){
    const b=document.getElementById('serviceBuilder');if(!b||!b.classList.contains('show'))return;
    b.querySelector('.ogpsBadge')?.remove();
    const match=matchFor(state.mode,state.activePreset,state.builderMethod);
    if(!loaded&&!catalog.length)return;
    const card=b.querySelector('.builderCard');if(!card)return;
    const badge=document.createElement('div');
    badge.className=`ogpsBadge${match?'':' ogpsDim'}`;
    badge.innerHTML=match?`Lié à Ogust : <strong>${escHtml(match.title)}</strong>`:'Aucune correspondance Ogust automatique pour cette prestation : le libellé ACJ sera conservé.';
    const head=card.querySelector('.serviceHead');
    if(head)head.insertAdjacentElement('afterend',badge);
  }

  function loadCache(){
    try{
      const saved=JSON.parse(localStorage.getItem(LS)||'null');
      if(saved?.prestations?.length){catalog=saved.prestations;loaded=true;return Date.now()-Number(saved.at||0)<TTL}
    }catch(e){}
    return false;
  }
  async function refreshCatalog(){
    try{
      const r=await fetch(ENDPOINT,{cache:'no-store'});const data=await r.json().catch(()=>null);
      if(!r.ok||!data?.ok||!Array.isArray(data.prestations))return;
      catalog=data.prestations;loaded=true;
      localStorage.setItem(LS,JSON.stringify({at:Date.now(),prestations:catalog}));
      enhanceBuilder();
    }catch(e){}
  }

  function wrapBuilder(){
    if(window.__acjPrestationBuilderV24||typeof window.renderServiceBuilder!=='function')return;
    const original=window.renderServiceBuilder;
    window.renderServiceBuilder=function(){const out=original.apply(this,arguments);enhanceBuilder();return out};
    window.__acjPrestationBuilderV24=true;
  }
  function wrapAddService(){
    if(window.__acjPrestationAddV24||typeof window.addBuiltService!=='function')return;
    const original=window.addBuiltService;
    window.addBuiltService=function(){
      const mode=state.mode,preset=state.activePreset,method=state.builderMethod;
      const match=matchFor(mode,preset,method);const before=state.lines.length;
      const localLabel=findPreset(preset)?.label||'';
      const out=original.apply(this,arguments);
      if(state.lines.length>before&&match){
        const line=state.lines[state.lines.length-1];attach(line,match,localLabel);renderQuoteLines();
      }
      return out;
    };
    window.__acjPrestationAddV24=true;
  }
  function wrapQuickCosts(){
    if(window.__acjPrestationCostV24||typeof window.addQuickCost!=='function')return;
    const original=window.addQuickCost;
    window.addQuickCost=function(type){
      const match=costMatch(type),before=state.lines.length;
      const out=original.apply(this,arguments);
      if(state.lines.length>before&&match){attach(state.lines[state.lines.length-1],match,state.lines[state.lines.length-1]?.designation||'');renderQuoteLines()}
      return out;
    };
    window.__acjPrestationCostV24=true;
  }
  function wrapPayload(){
    if(window.__acjPrestationPayloadV24||typeof window.quotePayload!=='function')return;
    const original=window.quotePayload;
    window.quotePayload=function(){
      const payload=original.apply(this,arguments);
      (payload?.lignes||[]).forEach((line,i)=>{
        const source=state.lines?.[i];
        if(source?.ogustProductLevelId){
          line.ogust_product_level_id=String(source.ogustProductLevelId);
          line.ogust_product_level_title=String(source.ogustProductLevelTitle||'');
        }
      });
      return payload;
    };
    window.__acjPrestationPayloadV24=true;
  }
  function wrapNewQuote(){
    if(window.__acjPrestationNewQuoteV24||typeof window.newQuote!=='function')return;
    const original=window.newQuote;
    window.newQuote=function(){const out=original.apply(this,arguments);enhanceBuilder();return out};
    window.__acjPrestationNewQuoteV24=true;
  }

  function init(){
    addStyles();
    const fresh=loadCache();
    wrapBuilder();wrapAddService();wrapQuickCosts();wrapPayload();wrapNewQuote();
    if(!fresh)refreshCatalog();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
