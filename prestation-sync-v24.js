// Devis ACJ v24/v28 — synchronisation légère des prestations avec le bon compte Ogust.
(function(){
  const BASE_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-history';
  const LS_PREFIX='acj_ogust_prestations_v28_';
  const TTL=24*60*60*1000;
  let catalog=[];
  let loaded=false;
  let catalogCompany='';

  const MAP_ACJ={
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

  // Le catalogue Lens est plus compact : on rattache uniquement les correspondances sûres.
  const MAP_LENS={
    jardin:{
      tonte:{hourly:{title:"Jardinage à l'heure",rename:false},auto:{title:"Jardinage à l'heure",rename:false},flat:{title:'Forfait Jardinage',rename:false}},
      haie:{hourly:{title:"Jardinage à l'heure",rename:false},auto:{title:"Jardinage à l'heure",rename:false},flat:{title:'Forfait Jardinage',rename:false}},
      debroussaillage:{hourly:{title:"Jardinage à l'heure",rename:false},auto:{title:"Jardinage à l'heure",rename:false},flat:{title:'Forfait Jardinage',rename:false}},
      desherbage:{hourly:{title:"Jardinage à l'heure",rename:false},flat:{title:'Forfait Jardinage',rename:false}}
    },
    menage:{
      entretien:{hourly:{title:'Entretien régulier du logement',rename:true}},
      grand_menage:{flat:{title:'Forfait gros nettoyage',rename:true}}
    },
    bricol:{
      bricolage:{hourly:{title:'Petit Bricolage',rename:true},flat:{title:'Petit Bricolage',rename:false}},
      montage:{hourly:{title:'Petit Bricolage',rename:false},flat:{title:'Petit Bricolage',rename:false}},
      fixation:{hourly:{title:'Petit Bricolage',rename:false},flat:{title:'Petit Bricolage',rename:false}},
      maintenance:{hourly:{title:'Petit Bricolage',rename:false},flat:{title:'Petit Bricolage',rename:false}}
    },
    nettoyagePro:{
      locaux:{hourly:{title:'Ménage professionnel',rename:false},flat:{title:'Entretien des locaux',rename:false}}
    }
  };

  const COST_ACJ={
    fournitures:{title:'fourniture et matériel',rename:true},
    deplacement:{title:'Frais de déplacements',rename:true}
  };
  const COST_LENS={
    fournitures:{title:'Fourniture/Matériel',rename:true}
  };

  function companyName(){try{return String(state?.company||'ACJ Services')}catch{return 'ACJ Services'}}
  function isLens(company=companyName()){return company==='ACJ Services Lens'}
  function sourceMap(){return isLens()?MAP_LENS:MAP_ACJ}
  function costMap(){return isLens()?COST_LENS:COST_ACJ}
  function cacheKey(company=companyName()){return `${LS_PREFIX}${norm(company)||'acj'}`}
  function endpoint(company=companyName()){return `${BASE_ENDPOINT}?catalog=1&company=${encodeURIComponent(company)}`}
  function ogustLabel(){return isLens()?'Ogust Lens':'Ogust'}
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
    const byPreset=sourceMap()?.[mode]?.[preset];if(!byPreset)return null;
    return byPreset[method]||byPreset.hourly||byPreset.flat||null;
  }
  function matchFor(mode,preset,method){
    const spec=specFor(mode,preset,method);if(!spec)return null;
    const product=findTitle(spec.title);if(!product)return null;
    return {...product,rename:!!spec.rename};
  }
  function costMatch(type){
    const spec=costMap()[type];if(!spec)return null;
    const product=findTitle(spec.title);if(!product)return null;
    return {...product,rename:!!spec.rename};
  }
  function attach(line,match,originalDesignation=''){
    if(!line||!match)return;
    line.ogustProductLevelId=String(match.id||'');
    line.ogustProductLevelTitle=String(match.title||'');
    line.ogustProductCompany=companyName();
    if(match.rename&&match.title)line.designation=match.title;
    if(!match.rename&&originalDesignation&&line.meta&&!line.meta.includes('Ogust')){
      line.meta=`${line.meta} · ${ogustLabel()} : ${match.title}`;
    }
  }
  function clearCrossCompanyMetadata(){
    for(const line of state?.lines||[]){
      delete line.ogustProductLevelId;delete line.ogustProductLevelTitle;delete line.ogustProductCompany;
      if(typeof line.meta==='string')line.meta=line.meta.replace(/ · Ogust(?: Lens)? : [^·]+$/,'').trim();
    }
    if(typeof renderQuoteLines==='function')renderQuoteLines();
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
    badge.innerHTML=match?`Lié à ${ogustLabel()} : <strong>${escHtml(match.title)}</strong>`:`Aucune correspondance ${ogustLabel()} automatique pour cette prestation : le libellé ACJ sera conservé.`;
    const head=card.querySelector('.serviceHead');
    if(head)head.insertAdjacentElement('afterend',badge);
  }

  function loadCache(company=companyName()){
    try{
      const saved=JSON.parse(localStorage.getItem(cacheKey(company))||'null');
      if(saved?.prestations?.length&&saved?.company===company){catalog=saved.prestations;loaded=true;catalogCompany=company;return Date.now()-Number(saved.at||0)<TTL}
    }catch(e){}
    return false;
  }
  async function refreshCatalog(){
    const company=companyName();
    try{
      const r=await fetch(endpoint(company),{cache:'no-store'});const data=await r.json().catch(()=>null);
      if(company!==companyName())return;
      if(!r.ok||!data?.ok||!Array.isArray(data.prestations))return;
      catalog=data.prestations;loaded=true;catalogCompany=company;
      localStorage.setItem(cacheKey(company),JSON.stringify({at:Date.now(),company,prestations:catalog}));
      enhanceBuilder();
    }catch(e){}
  }
  function reloadForCompany(){
    catalog=[];loaded=false;catalogCompany='';clearCrossCompanyMetadata();
    const fresh=loadCache();if(!fresh)refreshCatalog();else enhanceBuilder();
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
        if(source?.ogustProductLevelId&&source?.ogustProductCompany===state.company){
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
    window.addEventListener('acj:company-changed',reloadForCompany);
    if(!fresh)refreshCatalog();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
