// Assistant ACJ v17 — estimation visuelle des dimensions + temps photo exploitable.
(function(){
  const AI_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/analyse-chantier';
  const MAX_PHOTOS=4;
  let lastAnalysis=null;
  let lastMeta=null;
  let suppliesAdded=false;
  let selectedPhotos=[];

  function addStyles(){
    if(document.getElementById('ai-v17-style')) return;
    const style=document.createElement('style');
    style.id='ai-v17-style';
    style.textContent=`
      .aiCard{border-color:#155e75;background:linear-gradient(180deg,rgba(8,47,73,.94),rgba(8,28,43,.96))}
      .aiTitleRow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.aiTitle{font-size:16px;font-weight:900}.aiBadge{font-size:10px;font-weight:850;padding:5px 8px;border-radius:999px;background:#0c4a6e;color:#bae6fd;border:1px solid #0e7490}
      .aiHelp{font-size:12px;color:#bae6fd;line-height:1.45;margin-bottom:12px}.aiActions{display:flex;gap:9px;align-items:center}.aiActions .btn{flex:1}.aiLoader{display:none;font-size:11px;color:#bae6fd}.aiLoader.show{display:block}
      .aiPhotoZone{margin:10px 0 12px;padding:10px;border:1px solid #17435a;border-radius:13px;background:rgba(3,20,31,.55)}.aiPhotoHelp{font-size:10px;color:#94cde2;line-height:1.4;margin-bottom:8px}.aiPhotoActions{display:flex;gap:8px}.aiPhotoActions .btn{flex:1}.aiPhotoCount{font-size:10px;color:#a9d9ea;margin-top:7px}.aiPhotoPreview{display:flex;gap:8px;overflow-x:auto;margin-top:9px;padding-bottom:2px}.aiPhotoThumb{position:relative;flex:0 0 82px;height:82px;border-radius:11px;overflow:hidden;border:1px solid #28627a;background:#071a28}.aiPhotoThumb img{width:100%;height:100%;object-fit:cover;display:block}.aiPhotoRemove{position:absolute;top:4px;right:4px;width:25px;height:25px;border:0;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font-weight:900;font-size:15px;line-height:25px;padding:0}.aiPhotoLabel{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.68);color:#fff;border-radius:6px;padding:2px 5px;font-size:9px}
      .aiResult{margin-top:12px;display:none}.aiResult.show{display:block}.aiResultCard{border:1px solid #28627a;background:#071a28;border-radius:14px;padding:12px;margin-top:9px}.aiResultTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.aiResultName{font-size:13px;font-weight:850}.aiResultMeta{font-size:11px;color:#a9d9ea;line-height:1.4;margin-top:4px}
      .aiEstimate{margin-top:9px;padding:10px 11px;border:1px solid #365314;background:#13210b;border-radius:11px;color:#d9f99d;font-size:11px;line-height:1.5}.aiEstimate strong{color:#ecfccb}.aiEstimateBasis{color:#bef264;margin-top:5px}.aiEstimateReliability{margin-top:3px;color:#d9f99d}.aiEstimateLow{border-color:#854d0e;background:#241b08;color:#fde68a}
      .aiVisual{margin-top:8px;padding:9px 10px;border:1px solid #1d4ed8;background:#0b1d3a;border-radius:11px;color:#bfdbfe;font-size:10px;line-height:1.45}.aiVisual strong{color:#dbeafe}.aiVisualMeasure{margin-top:8px;padding:9px 10px;border:1px solid #0e7490;background:#062b36;border-radius:11px;color:#bae6fd;font-size:10px;line-height:1.5}.aiVisualMeasure strong{color:#e0f2fe}.aiVisualMeasure .muted{color:#7dd3fc;margin-top:3px}
      .aiHistory{margin-top:8px;padding:9px 10px;border:1px solid #6d28d9;background:#1c1235;border-radius:11px;color:#ddd6fe;font-size:10px;line-height:1.45}.aiHistory strong{color:#ede9fe}.aiHistoryMeta{margin-top:3px;color:#c4b5fd}.aiHistoryStatus{font-size:10px;color:#9fb8c8;margin-top:9px;line-height:1.35}
      .aiMissing{font-size:10px;color:#fde68a;margin-top:6px}.aiConfidence{font-size:10px;color:#94a3b8;white-space:nowrap;text-align:right;line-height:1.35}.aiConfidence strong{font-size:13px;color:#cbd5e1}.aiSupplies{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid #17435a;margin-top:10px;padding-top:10px;font-size:12px}.aiError{margin-top:10px;padding:10px 11px;border-radius:11px;border:1px solid #7f1d1d;background:#2b1115;color:#fecaca;font-size:11px;display:none}.aiError.show{display:block}
      .aiBuilderNotice{margin:0 0 13px;padding:10px 11px;border-radius:12px;border:1px solid #365314;background:#13210b;color:#d9f99d;font-size:11px;line-height:1.5}
      @media(max-width:520px){.aiActions{flex-direction:column;align-items:stretch}.aiPhotoActions{flex-direction:column}.aiResultTop{gap:8px}.aiConfidence{min-width:76px}}
    `;
    document.head.appendChild(style);
  }

  function modeLabel(mode){return MODES[mode]?.label||mode}
  function presetFor(mode,preset){const list=MODES[mode]?.presets||[];return list.find(x=>x.id===preset)||list.find(x=>x.id.startsWith('autre_'))||list[0]}
  function frNum(v){return String(Number(v)||0).replace('.',',')}
  function quoteHours(v){const n=Number(v)||0;return n>0?Math.ceil(n*2)/2:0}
  function durationLabel(v){
    const n=Number(v)||0;if(n<=0)return '0 h';
    const total=Math.round(n*60),h=Math.floor(total/60),m=total%60;
    if(!m)return `${h} h`;
    if(!h)return `${m} min`;
    return `${h} h ${String(m).padStart(2,'0')}`;
  }

  function resultDetail(p){
    const parts=[];
    if(p.hours>0) parts.push(`${frNum(p.hours)} h indiquées`);
    if(p.flat_ttc>0) parts.push(`forfait ${money(p.flat_ttc)}`);
    if(p.metric>0&&p.metric_unit) parts.push(`${frNum(p.metric)} ${p.metric_unit}`);
    if(p.height_m>0) parts.push(`hauteur ${frNum(p.height_m)} m`);
    if(p.faces>0) parts.push(`${p.faces} face${p.faces===2?'s':''}`);
    if(p.top) parts.push('dessus');
    if(p.cut_type==='entretien') parts.push('taille d’entretien');
    if(p.cut_type==='rabattage') parts.push('rabattage');
    if(p.waste==='oui') parts.push('évacuation prévue');
    if(p.waste==='non') parts.push('sans évacuation');
    if(p.grass==='haute') parts.push('herbe haute');
    if(p.grass==='tres_haute') parts.push('herbe très haute');
    if(p.collection==='oui') parts.push('avec ramassage');
    if(p.collection==='non') parts.push('sans ramassage');
    if(p.extra) parts.push(p.extra);
    return parts.join(' · ')||'Informations générales reconnues';
  }

  function hasVisualMeasures(p){return Number(p.visual_metric_min)>0||Number(p.visual_height_min)>0}

  function visualMeasureHtml(p){
    const bits=[];
    const vmin=Number(p.visual_metric_min)||0,vmax=Number(p.visual_metric_max)||0,vunit=p.visual_metric_unit||'';
    const hmin=Number(p.visual_height_min)||0,hmax=Number(p.visual_height_max)||0;
    if(vmin>0&&vmax>0&&vunit){
      const label=vunit==='ml'?'Longueur visuelle':'Surface visuelle';
      bits.push(`${label} : environ ${frNum(vmin)} à ${frNum(vmax)} ${vunit}`);
    }
    if(hmin>0&&hmax>0) bits.push(`Hauteur visuelle : environ ${frNum(hmin)} à ${frNum(hmax)} m`);
    if(!bits.length) return '';
    const confidence=Math.round((Number(p.visual_measurement_confidence)||0)*100);
    return `<div class="aiVisualMeasure"><strong>Dimensions estimées sur photo</strong><br>${esc(bits.join(' · '))}<div class="muted">Confiance sur les dimensions : ${confidence} %. Ces valeurs servent au calcul mais ne sont pas considérées comme des mesures réelles.</div></div>`;
  }

  function estimateHtml(p){
    const raw=Number(p.estimated_hours_suggested)||0;
    if(p.hours>0||p.flat_ttc>0||raw<=0) return '';
    const advised=quoteHours(raw),min=Number(p.estimated_hours_min)||raw,max=Number(p.estimated_hours_max)||raw,confidence=Number(p.estimation_confidence)||0;
    const cls=confidence<.55?' aiEstimateLow':'';
    const source=hasVisualMeasures(p)&&Number(p.metric)<=0?' à partir des photos':'';
    return `<div class="aiEstimate${cls}"><strong>Temps conseillé${source} : ${esc(durationLabel(advised))}</strong><br>Fourchette estimée : ${esc(durationLabel(min))} – ${esc(durationLabel(max))}<div class="aiEstimateReliability">Fiabilité de l’estimation : <strong>${Math.round(confidence*100)} %</strong></div><div class="aiEstimateBasis">${esc(p.estimation_basis||'Estimation indicative ACJ')} · à valider</div></div>`;
  }

  function visualHtml(p){
    const text=String(p.visual_summary||'').trim();
    return text?`<div class="aiVisual"><strong>Observation photo</strong><br>${esc(text)}</div>`:'';
  }

  function historyHtml(p){
    if(!p.history_used||Number(p.history_similar_count)<2) return '';
    const count=Math.round(Number(p.history_similar_count)||0),avg=Number(p.history_avg_hours)||0,min=Number(p.history_min_hours)||0,max=Number(p.history_max_hours)||0;
    const bits=[`${count} intervention${count>1?'s':''} comparable${count>1?'s':''}`];
    if(avg>0) bits.push(`moyenne ${durationLabel(avg)}`);
    if(min>0&&max>0) bits.push(`plage ${durationLabel(min)} – ${durationLabel(max)}`);
    return `<div class="aiHistory"><strong>Historique Ogust réellement utilisé</strong><br>${esc(bits.join(' · '))}${p.history_note?`<div class="aiHistoryMeta">${esc(p.history_note)}</div>`:''}</div>`;
  }

  function historyStatusHtml(){
    const h=lastMeta?.ogust_history;
    if(!h) return '';
    const count=Math.round(Number(h.record_count)||0);
    const used=(lastAnalysis?.prestations||[]).some(p=>p.history_used&&Number(p.history_similar_count)>=2);
    if(h.available&&count>0&&used) return `<div class="aiHistoryStatus">Historique Ogust : ${count} interventions récentes analysées ; les cas comparables retenus sont indiqués ci-dessus.</div>`;
    if(h.available&&count>0) return `<div class="aiHistoryStatus">Historique Ogust : ${count} interventions récentes analysées · aucun cas suffisamment comparable n’a été retenu pour ce chantier.</div>`;
    if(h.available) return `<div class="aiHistoryStatus">Historique Ogust connecté, mais aucune intervention exploitable n’a été trouvée dans la période analysée.</div>`;
    return `<div class="aiHistoryStatus">Historique Ogust non disponible pour cette analyse : estimation basée sur les photos, les informations du chantier et les repères ACJ.</div>`;
  }

  function injectCard(){
    if(document.getElementById('aiChantierCard')) return;
    const step=document.querySelector('section[data-step="2"]'),lead=step?.querySelector('.lead');
    if(!step||!lead) return;
    const card=document.createElement('div');
    card.id='aiChantierCard';card.className='card aiCard';
    card.innerHTML=`
      <div class="aiTitleRow"><div class="aiTitle">Décrire le chantier</div><span class="aiBadge">Assistant ACJ</span></div>
      <div class="aiHelp">Décris le chantier et ajoute jusqu’à 4 photos. Sans mesure réelle, l’assistant estime visuellement une fourchette de dimensions puis s’en sert pour proposer un temps. Plus tu donnes de dimensions réelles, plus la fiabilité augmente.</div>
      <div class="field"><textarea id="aiChantierText" placeholder="Ex. haie à tailler, une face + dessus, évacuation… Tu peux aussi envoyer seulement des photos."></textarea></div>
      <div class="aiPhotoZone">
        <div class="aiPhotoHelp">Photos facultatives · maximum 4 · elles ne sont pas enregistrées dans le devis.</div>
        <div class="aiPhotoActions">
          <button class="btn" type="button" onclick="openAICamera()">Prendre une photo</button>
          <button class="btn" type="button" onclick="openAIGallery()">Ajouter des photos</button>
        </div>
        <input id="aiCameraInput" type="file" accept="image/*" capture="environment" hidden>
        <input id="aiGalleryInput" type="file" accept="image/*" multiple hidden>
        <div id="aiPhotoCount" class="aiPhotoCount">Aucune photo ajoutée</div>
        <div id="aiPhotoPreview" class="aiPhotoPreview"></div>
      </div>
      <div class="aiActions"><button id="aiAnalyseBtn" class="btn primary" type="button" onclick="analyseChantierAI()">Analyser le chantier</button><div id="aiLoader" class="aiLoader">Analyse du chantier, des dimensions visuelles et de l’historique…</div></div>
      <div id="aiError" class="aiError"></div><div id="aiResult" class="aiResult"></div>`;
    lead.insertAdjacentElement('afterend',card);
    document.getElementById('aiCameraInput')?.addEventListener('change',onPhotoFiles);
    document.getElementById('aiGalleryInput')?.addEventListener('change',onPhotoFiles);
  }

  function setError(message){const n=document.getElementById('aiError');if(!n)return;n.textContent=message||'';n.classList.toggle('show',!!message)}

  function renderPhotos(){
    const box=document.getElementById('aiPhotoPreview'),count=document.getElementById('aiPhotoCount');
    if(count) count.textContent=selectedPhotos.length?`${selectedPhotos.length} photo${selectedPhotos.length>1?'s':''} ajoutée${selectedPhotos.length>1?'s':''} sur ${MAX_PHOTOS}`:'Aucune photo ajoutée';
    if(!box) return;
    box.innerHTML=selectedPhotos.map((photo,i)=>`<div class="aiPhotoThumb"><img src="${photo.dataUrl}" alt="Photo ${i+1}"><button class="aiPhotoRemove" type="button" aria-label="Retirer la photo ${i+1}" onclick="removeAIPhoto(${i})">×</button><span class="aiPhotoLabel">Photo ${i+1}</span></div>`).join('');
  }

  window.openAICamera=function(){if(selectedPhotos.length>=MAX_PHOTOS){setError(`Maximum ${MAX_PHOTOS} photos.`);return}document.getElementById('aiCameraInput')?.click()};
  window.openAIGallery=function(){if(selectedPhotos.length>=MAX_PHOTOS){setError(`Maximum ${MAX_PHOTOS} photos.`);return}document.getElementById('aiGalleryInput')?.click()};
  window.removeAIPhoto=function(index){selectedPhotos.splice(index,1);renderPhotos();setError('')};

  async function imageFromFile(file){
    if('createImageBitmap' in window){
      try{
        const bitmap=await createImageBitmap(file);
        return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
      }catch(e){}
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('IMAGE_DECODE_FAILED'));img.src=url});
      return {source:img,width:img.naturalWidth||img.width,height:img.naturalHeight||img.height,close:()=>URL.revokeObjectURL(url)};
    }catch(e){URL.revokeObjectURL(url);throw e}
  }

  async function encodePhoto(file,maxSide=1100,quality=.68){
    const decoded=await imageFromFile(file);
    try{
      const scale=Math.min(1,maxSide/Math.max(decoded.width,decoded.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(decoded.width*scale));canvas.height=Math.max(1,Math.round(decoded.height*scale));
      const ctx=canvas.getContext('2d',{alpha:false});if(!ctx) throw new Error('CANVAS_FAILED');
      ctx.drawImage(decoded.source,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg',quality);
    }finally{decoded.close?.()}
  }

  async function compressPhoto(file){
    if(!file||!String(file.type||'').startsWith('image/')) throw new Error('PHOTO_TYPE');
    let dataUrl=await encodePhoto(file,1100,.68);
    if(dataUrl.length>700000) dataUrl=await encodePhoto(file,900,.58);
    if(dataUrl.length>900000) throw new Error('PHOTO_TOO_LARGE');
    return dataUrl;
  }

  async function onPhotoFiles(event){
    const input=event.currentTarget,files=[...(input.files||[])];input.value='';
    if(!files.length) return;
    setError('');
    const remaining=MAX_PHOTOS-selectedPhotos.length;
    if(remaining<=0){setError(`Maximum ${MAX_PHOTOS} photos.`);return}
    const chosen=files.slice(0,remaining);
    const btn=document.getElementById('aiAnalyseBtn');if(btn)btn.disabled=true;
    try{
      for(const file of chosen){
        const dataUrl=await compressPhoto(file);
        selectedPhotos.push({dataUrl,name:file.name||`Photo ${selectedPhotos.length+1}`});
        renderPhotos();
      }
      if(files.length>remaining) setError(`Seules les ${MAX_PHOTOS} premières photos ont été conservées.`);
    }catch(e){
      const message=e?.message==='PHOTO_TOO_LARGE'?'Une photo reste trop lourde après compression. Essaie une autre photo.':e?.message==='PHOTO_TYPE'?'Le fichier choisi n’est pas une image compatible.':'Impossible de préparer une des photos.';
      setError(message);
    }finally{if(btn)btn.disabled=false}
  }

  function renderResult(analysis){
    const box=document.getElementById('aiResult');if(!box)return;
    const prestations=analysis?.prestations||[];if(!prestations.length){box.className='aiResult';box.innerHTML='';return}
    const lines=prestations.map((p,i)=>{
      const preset=presetFor(p.mode,p.preset),missing=(p.missing_fields||[]).filter(Boolean),raw=Number(p.estimated_hours_suggested)||0,advised=quoteHours(raw),understanding=Math.round((Number(p.confidence)||0)*100);
      const buttonLabel=p.hours>0?'Préremplir avec les heures indiquées':advised>0?`Préremplir avec ${durationLabel(advised)}`:'Préremplir cette prestation';
      return `<div class="aiResultCard"><div class="aiResultTop"><div><div class="aiResultName">${esc(p.designation||preset?.label||'Prestation')}</div><div class="aiResultMeta">${esc(modeLabel(p.mode))} · ${esc(resultDetail(p))}</div>${visualHtml(p)}${visualMeasureHtml(p)}${estimateHtml(p)}${historyHtml(p)}${missing.length?`<div class="aiMissing">À compléter / vérifier : ${esc(missing.join(', '))}</div>`:''}</div><div class="aiConfidence">Chantier compris<br><strong>${understanding} %</strong></div></div><button class="btn small primary" style="width:100%;margin-top:9px" type="button" onclick="applyAIProposal(${i})">${esc(buttonLabel)}</button></div>`;
    }).join('');
    const supplies=Number(analysis.fournitures_ttc)||0;
    const suppliesHtml=supplies>0?`<div class="aiSupplies"><div><strong>Fournitures reconnues</strong><br><span style="color:#9fdcf6">${money(supplies)} TTC</span></div><button id="aiSuppliesBtn" class="btn small" type="button" onclick="addAISupplies()">Ajouter</button></div>`:'';
    box.innerHTML=`<div style="font-size:12px;font-weight:850;color:#dff6ff">Proposition</div>${lines}${suppliesHtml}${historyStatusHtml()}${analysis.notes?`<div class="tiny" style="margin-top:9px;color:#a9d9ea">${esc(analysis.notes)}</div>`:''}`;box.className='aiResult show';
  }

  window.analyseChantierAI=async function(){
    const text=String(document.getElementById('aiChantierText')?.value||'').trim();
    if(text.length<5&&selectedPhotos.length===0){setError('Décris le chantier ou ajoute au moins une photo avant de lancer l’analyse.');return}
    setError('');const btn=document.getElementById('aiAnalyseBtn'),loader=document.getElementById('aiLoader');if(btn)btn.disabled=true;loader?.classList.add('show');
    try{
      const payload={description:text,mode:state.mode,images:selectedPhotos.map(p=>p.dataUrl)};
      const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok){
        if(data?.error==='AI_NOT_CONFIGURED') throw new Error('L’assistant n’est pas configuré côté serveur.');
        if(data?.error==='TOO_MANY_IMAGES') throw new Error('Maximum 4 photos par analyse.');
        throw new Error('L’analyse n’a pas abouti. Réessaie.');
      }
      lastAnalysis=data.analysis;lastMeta=data.meta||null;suppliesAdded=false;renderResult(lastAnalysis);
    }catch(e){setError(e?.message||'Impossible de joindre l’assistant.')}finally{if(btn)btn.disabled=false;loader?.classList.remove('show')}
  };

  function setIf(id,value,allowEmpty=false){const n=document.getElementById(id);if(!n)return;if(allowEmpty||value!==''&&value!==0&&value!==false&&value!=null)n.value=value}

  function visualMeasureText(p){
    const bits=[];
    if(Number(p.visual_metric_min)>0&&Number(p.visual_metric_max)>0&&p.visual_metric_unit) bits.push(`${frNum(p.visual_metric_min)}–${frNum(p.visual_metric_max)} ${p.visual_metric_unit}`);
    if(Number(p.visual_height_min)>0&&Number(p.visual_height_max)>0) bits.push(`hauteur ${frNum(p.visual_height_min)}–${frNum(p.visual_height_max)} m`);
    return bits.join(' · ');
  }

  function showEstimateNotice(p,usedHours){
    if(!(Number(p.estimated_hours_suggested)>0)||Number(p.hours)>0)return;
    const card=document.querySelector('#serviceBuilder .builderCard');if(!card)return;card.querySelector('.aiBuilderNotice')?.remove();
    const notice=document.createElement('div');notice.className='aiBuilderNotice';
    const min=Number(p.estimated_hours_min)||usedHours,max=Number(p.estimated_hours_max)||usedHours,reliability=Math.round((Number(p.estimation_confidence)||0)*100);
    const visual=visualMeasureText(p);const visualLine=visual?`<br>Hypothèse photo utilisée : ${esc(visual)}. Les champs de dimensions restent vides jusqu’à mesure réelle.`:'';
    const history=p.history_used&&Number(p.history_similar_count)>=2?`<br>Historique Ogust : ${Math.round(Number(p.history_similar_count))} cas comparables${Number(p.history_avg_hours)>0?`, moyenne ${esc(durationLabel(p.history_avg_hours))}`:''}.`:'';
    notice.innerHTML=`<strong>Temps conseillé prérempli : ${esc(durationLabel(usedHours))}</strong><br>Fourchette estimée : ${esc(durationLabel(min))} – ${esc(durationLabel(max))}<br>Fiabilité de l’estimation : ${reliability} %.${visualLine}${history}<br>Tu peux modifier les heures avant d’ajouter la prestation.`;
    card.querySelector('.serviceHead')?.insertAdjacentElement('afterend',notice)
  }

  window.applyAIProposal=function(index){
    const p=lastAnalysis?.prestations?.[index];if(!p||!MODES[p.mode])return;const preset=presetFor(p.mode,p.preset);if(!preset)return;
    setMode(p.mode);state.activePreset=preset.id;state.builderMethod=p.pricing_method==='flat'?'flat':'hourly';renderPresets();renderServiceBuilder();
    if(preset.kind==='custom')setIf('builderDesignation',p.designation||preset.label,true);
    if(state.builderMethod==='flat')setIf('builderFlat',p.flat_ttc||'',true);else{const usedHours=Number(p.hours)>0?Number(p.hours):quoteHours(p.estimated_hours_suggested);setIf('builderHours',usedHours>0?usedHours:'',true);if(p.rate_ttc>0)setIf('builderRate',p.rate_ttc);showEstimateNotice(p,usedHours)}
    setIf('detailMetric',p.metric>0?p.metric:'',true);setIf('builderMetric',p.metric>0?p.metric:'',true);setIf('detailHeight',p.height_m>0?p.height_m:'',true);setIf('detailFaces',p.faces>0?String(p.faces):'',true);if(p.top)setIf('detailTop','oui',true);setIf('detailCutType',p.cut_type||'',true);setIf('detailWaste',p.waste||'',true);setIf('detailGrass',p.grass||'',true);setIf('detailCollection',p.collection||'',true);setIf('detailDensity',p.density||'',true);setIf('detailZone',p.zone||'',true);setIf('detailMethod',p.method||'',true);setIf('detailSupport',p.support||'',true);setIf('detailExtra',p.extra||'',true);document.getElementById('serviceBuilder')?.scrollIntoView({behavior:'smooth',block:'center'});
  };

  window.addAISupplies=function(){const amount=Number(lastAnalysis?.fournitures_ttc)||0;if(amount<=0||suppliesAdded)return;const activity=lastAnalysis?.prestations?.[0]?.mode||state.mode,m=MODES[activity]||MODES[state.mode];state.lines.push({id:uid(),type:'cost',designation:'Fournitures / consommables',meta:'Montant extrait de la description du chantier',activity,qty:1,unit:'forfait',unitPriceTTC:amount,vat:m.vat});suppliesAdded=true;renderQuoteLines();const btn=document.getElementById('aiSuppliesBtn');if(btn){btn.textContent='Ajouté';btn.disabled=true}};

  addStyles();injectCard();renderPhotos();
})();
