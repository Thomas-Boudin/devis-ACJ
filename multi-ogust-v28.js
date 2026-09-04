// Devis ACJ v28 — transmet la société sélectionnée à toutes les routes serveur concernées.
(function(){
  if(window.__acjMultiOgustFetchV28)return;
  const nativeFetch=window.fetch.bind(window);
  const ROUTES=['/api/ogust-customer','/api/ogust-quotation','/api/ogust-history','/api/analyse-chantier'];

  function companyName(){try{return String(state?.company||'ACJ Services')}catch{return 'ACJ Services'}}
  function isTarget(url){try{return ROUTES.some(path=>new URL(url,location.href).pathname===path)}catch{return false}}
  function withCompanyUrl(url){
    try{
      const u=new URL(url,location.href);if(!u.searchParams.has('company'))u.searchParams.set('company',companyName());return u.toString();
    }catch{return url}
  }
  function withCompanyBody(body){
    if(typeof body!=='string'||!body.trim().startsWith('{'))return body;
    try{const data=JSON.parse(body);if(data&&typeof data==='object'&&!Array.isArray(data)&&!data.company)data.company=companyName();return JSON.stringify(data)}catch{return body}
  }

  window.fetch=function(input,init){
    const rawUrl=typeof input==='string'||input instanceof URL?String(input):input?.url;
    if(!rawUrl||!isTarget(rawUrl))return nativeFetch(input,init);
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    const next={...(init||{})};
    let url=rawUrl;
    if(method==='GET'||method==='HEAD')url=withCompanyUrl(url);
    else if(typeof next.body==='string')next.body=withCompanyBody(next.body);
    return nativeFetch(url,next);
  };
  window.__acjMultiOgustFetchV28=true;
  window.currentOgustCompanyV28=companyName;
})();
