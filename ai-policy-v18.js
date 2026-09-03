// Politique ACJ v18 — marge commerciale prudente pour les estimations fondées sur photo.
(function(){
  const AI_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/analyse-chantier';
  const nativeFetch=window.fetch.bind(window);

  function num(v){return Number(v)||0}
  function isVisualOnly(p){
    return num(p?.metric)<=0 && (num(p?.visual_metric_min)>0 || num(p?.visual_height_min)>0);
  }

  function applyPrudentPhotoPolicy(data){
    const prestations=data?.analysis?.prestations;
    if(!Array.isArray(prestations)) return data;

    prestations.forEach((p)=>{
      const confidence=num(p.estimation_confidence);
      const min=num(p.estimated_hours_min),max=num(p.estimated_hours_max),raw=num(p.estimated_hours_suggested);
      if(!isVisualOnly(p) || num(p.hours)>0 || num(p.flat_ttc)>0 || confidence<=0 || confidence>.55 || min<=0 || max<=0 || raw<=0 || max<min) return;

      // Pour un devis fondé principalement sur des photos et de faible fiabilité,
      // on retient au minimum 80 % de la fourchette vers sa borne haute.
      // ai-v17 arrondira ensuite le temps conseillé à la demi-heure supérieure.
      const prudentTarget=min + (max-min)*0.80;
      const adjusted=Math.min(max,Math.max(raw,prudentTarget));
      if(adjusted>raw+0.01){
        p.estimated_hours_suggested=adjusted;
        const basis=String(p.estimation_basis||'Estimation indicative ACJ').trim();
        if(!/marge prudente/i.test(basis)) p.estimation_basis=`${basis} · marge prudente devis photo`;
      }
    });
    return data;
  }

  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    const url=typeof input==='string'?input:String(input?.url||'');
    if(!url.startsWith(AI_ENDPOINT) || !response.ok) return response;

    try{
      const data=await response.clone().json();
      applyPrudentPhotoPolicy(data);
      const headers=new Headers(response.headers);
      headers.delete('content-length');
      return new Response(JSON.stringify(data),{
        status:response.status,
        statusText:response.statusText,
        headers
      });
    }catch(e){
      return response;
    }
  };
})();
