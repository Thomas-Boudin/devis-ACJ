// Assistant chantier — propositions contextualisées et estimations vérifiées.
(function(){
  const AI_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/analyse-chantier';
  const MAX_PHOTOS=10,MAX_PHOTO_CHARS=350000,MAX_BODY_BYTES=3600000;
  let lastAnalysis=null;
  let lastMeta=null;
  let suppliesAdded=false;
  let selectedPhotos=[];
  let generation=0,photoRevision=0,lastContext=null,pendingProposal=null,activeRequest=null,photoImport=null,applying=false;

  function context(){return {generation,company:String(state.company||''),quote:String(state.number||''),mode:state.mode,text:String(document.getElementById('aiChantierText')?.value||'').trim(),photos:photoRevision}}
  function sameContext(a,b=context()){return !!a&&['generation','company','quote','mode','text','photos'].every(key=>a[key]===b[key])}
  function setBusy(busy){const button=document.getElementById('aiAnalyseBtn');if(button)button.disabled=busy||!!photoImport;document.getElementById('aiLoader')?.classList.toggle('show',busy);for(const id of ['aiCameraBtn','aiGalleryBtn','aiCameraInput','aiGalleryInput']){const input=document.getElementById(id);if(input)input.disabled=!!photoImport}}
  function invalidate(reset=false){
    if(pendingProposal){const builder=document.getElementById('serviceBuilder');if(builder){builder.innerHTML='';builder.className='builder'}state.activePreset=null}
    generation++;activeRequest?.abort();activeRequest=null;photoImport=null;lastAnalysis=null;lastMeta=null;lastContext=null;pendingProposal=null;suppliesAdded=false;
    const result=document.getElementById('aiResult');if(result){result.className='aiResult';result.innerHTML=''}
    document.querySelector('#serviceBuilder .aiBuilderNotice')?.remove();setBusy(false);setError('');
    if(reset){selectedPhotos=[];photoRevision++;const text=document.getElementById('aiChantierText');if(text)text.value=''}renderPhotos();
  }
  function validAnalysis(){if(sameContext(lastContext))return true;invalidate();setError('Le chantier a changé. Relance la préparation avant d’utiliser cette proposition.');return false}
  function missingFields(p){return [...new Set((Array.isArray(p.missing_fields)?p.missing_fields:[]).map(value=>String(value).trim()).filter(Boolean))]}
  function statedHours(p){
    const hours=Number(p.hours)||0;if(hours<=0)return 0;
    const text=lastContext?.text||'';
    return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:h\b|heures?\b)/gi)].some(match=>Math.abs(Number(match[1].replace(',','.'))-hours)<.001)?hours:0;
  }
  function statedMoney(value){const amount=Number(value)||0;return amount>0&&[...(lastContext?.text||'').matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?\b|eur\b)/gi)].some(match=>Math.abs(Number(match[1].replace(',','.'))-amount)<.001)}
  function statedRate(value){const amount=Number(value)||0;return amount>0&&[...(lastContext?.text||'').matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?\b|eur\b)\s*(?:\/\s*h\b|par\s+heure\b|l['’]heure\b)/gi)].some(match=>Math.abs(Number(match[1].replace(',','.'))-amount)<.001)}
  function statedMeasure(value,unit){
    const amount=Number(value)||0;if(amount<=0)return 0;
    const units=['m2','m²'].includes(unit)?'m(?:²|2)|mètres?\\s+carrés?':unit==='ml'?'ml|m(?:ètres?)?(?![²2])':'m(?:ètres?)?(?![²2])';
    const regex=new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:${units})(?![a-z])`,'gi');
    return [...(lastContext?.text||'').matchAll(regex)].some(match=>Math.abs(Number(match[1].replace(',','.'))-amount)<.001)?amount:0;
  }
  function suggestedHours(p){return quoteHours(statedHours(p)?0:Number(p.estimated_hours_suggested)||Number(p.hours)||0)}

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
    if(statedHours(p)>0) parts.push(`${frNum(p.hours)} h saisies`);
    if(p.flat_ttc>0&&statedMoney(p.flat_ttc)) parts.push(`forfait saisi ${money(p.flat_ttc)}`);
    if(statedMeasure(p.metric,p.metric_unit)>0&&p.metric_unit) parts.push(`${frNum(p.metric)} ${p.metric_unit} saisis`);
    if(statedMeasure(p.height_m,'m')>0) parts.push(`hauteur saisie ${frNum(p.height_m)} m`);
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
    return `<div class="aiVisualMeasure"><strong>Estimation à confirmer sur place</strong><br>${esc(bits.join(' · '))}<div class="muted">Une photo ne donne pas une mesure réelle. Ces hypothèses ne remplissent pas les champs de dimensions.</div></div>`;
  }

  function estimateHtml(p){
    const raw=suggestedHours(p);
    if(statedHours(p)>0||(p.flat_ttc>0&&statedMoney(p.flat_ttc))||raw<=0) return '';
    const advised=raw,min=Number(p.estimated_hours_min)||raw,max=Number(p.estimated_hours_max)||raw;
    const cls=missingFields(p).length?' aiEstimateLow':'';
    const source=hasVisualMeasures(p)&&Number(p.metric)<=0?' à partir des photos':'';
    return `<div class="aiEstimate${cls}"><strong>Estimation à confirmer${source} : ${esc(durationLabel(advised))}</strong><br>Fourchette indicative : ${esc(durationLabel(min))} – ${esc(durationLabel(max))}<div class="aiEstimateBasis">${esc(p.estimation_basis||'Hypothèse proposée par l’assistant')} · ${missingFields(p).length?'renseigne une durée pour chiffrer':'confirme ou corrige le temps avant de chiffrer'}</div></div>`;
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
      <div class="aiHelp">Écris ou dicte les travaux ici, avec les quantités connues. L’assistant prépare des propositions à vérifier. Les photos aident à décrire le chantier ; leurs dimensions et durées restent des estimations à confirmer.</div>
      <div class="field"><textarea id="aiChantierText" maxlength="2500" placeholder="Ex. haie à tailler, une face + dessus, évacuation… Tu peux aussi envoyer seulement des photos."></textarea></div>
      <div class="aiPhotoZone">
        <div class="aiPhotoHelp">Photos facultatives · maximum ${MAX_PHOTOS} · compression automatique · elles ne sont pas enregistrées dans le devis.</div>
        <div class="aiPhotoActions">
          <button id="aiCameraBtn" class="btn" type="button" onclick="openAICamera()">Prendre une photo</button>
          <button id="aiGalleryBtn" class="btn" type="button" onclick="openAIGallery()">Ajouter des photos</button>
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
    document.getElementById('aiChantierText')?.addEventListener('input',()=>invalidate());
  }

  function setError(message){const n=document.getElementById('aiError');if(!n)return;n.textContent=message||'';n.classList.toggle('show',!!message)}

  function renderPhotos(){
    const box=document.getElementById('aiPhotoPreview'),count=document.getElementById('aiPhotoCount');
    if(count) count.textContent=photoImport?`Préparation de ${photoImport.count} photo${photoImport.count>1?'s':''}…`:selectedPhotos.length?`${selectedPhotos.length} photo${selectedPhotos.length>1?'s':''} ajoutée${selectedPhotos.length>1?'s':''} sur ${MAX_PHOTOS}`:'Aucune photo ajoutée';
    if(!box) return;
    box.innerHTML=selectedPhotos.map((photo,i)=>`<div class="aiPhotoThumb"><img src="${photo.dataUrl}" alt="Photo ${i+1}"><button class="aiPhotoRemove" type="button" aria-label="Retirer la photo ${i+1}" onclick="removeAIPhoto(${i})">×</button><span class="aiPhotoLabel">Photo ${i+1}</span></div>`).join('');
  }

  function canChoosePhotos(){if(photoImport){setError('Attends la préparation des photos avant d’en ajouter d’autres.');return false}if(selectedPhotos.length>=MAX_PHOTOS){setError(`Maximum ${MAX_PHOTOS} photos. Retire une photo pour en ajouter une autre.`);return false}return true}
  window.openAICamera=function(){if(canChoosePhotos())document.getElementById('aiCameraInput')?.click()};
  window.openAIGallery=function(){if(canChoosePhotos())document.getElementById('aiGalleryInput')?.click()};
  window.removeAIPhoto=function(index){invalidate();selectedPhotos.splice(index,1);photoRevision++;renderPhotos()};

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

  function encodePhoto(decoded,maxSide,quality){
    const scale=Math.min(1,maxSide/Math.max(decoded.width,decoded.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(decoded.width*scale));canvas.height=Math.max(1,Math.round(decoded.height*scale));
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx) throw new Error('CANVAS_FAILED');
    ctx.drawImage(decoded.source,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',quality);
  }

  async function compressPhoto(file,captured){
    if(!file||!String(file.type||'').startsWith('image/')) throw new Error('PHOTO_TYPE');
    const decoded=await imageFromFile(file);
    try{
      for(const [maxSide,quality] of [[1100,.72],[1100,.62],[1100,.52],[1100,.44],[900,.62],[900,.50],[768,.58],[768,.48],[768,.40]]){
        if(!sameContext(captured))throw new Error('PHOTO_CANCELLED');
        const dataUrl=encodePhoto(decoded,maxSide,quality);
        if(dataUrl.startsWith('data:image/jpeg;base64,')&&dataUrl.length<=MAX_PHOTO_CHARS)return dataUrl;
      }
      throw new Error('PHOTO_TOO_LARGE');
    }finally{decoded.close?.()}
  }

  async function onPhotoFiles(event){
    const input=event.currentTarget,files=[...(input.files||[])];input.value='';
    if(!files.length) return;
    if(photoImport){setError('Cette sélection n’a pas été ajoutée. Attends la préparation des photos avant de réessayer.');return}
    const remaining=MAX_PHOTOS-selectedPhotos.length;
    if(remaining<=0){setError(`Maximum ${MAX_PHOTOS} photos.`);return}
    if(files.length>remaining){setError(`Cette sélection n’a pas été ajoutée : il reste ${remaining} place${remaining>1?'s':''}. Choisis au maximum ${remaining} photo${remaining>1?'s':''}.`);return}
    invalidate();const captured=context(),batch={count:files.length};photoImport=batch;setBusy(false);renderPhotos();
    const prepared=[];
    try{
      for(const file of files){
        const dataUrl=await compressPhoto(file,captured);
        if(!sameContext(captured))return;
        prepared.push({dataUrl,name:file.name||`Photo ${selectedPhotos.length+prepared.length+1}`});
      }
      if(!sameContext(captured)||photoImport!==batch)return;
      selectedPhotos.push(...prepared);photoRevision++;setError('');
    }catch(e){
      if(!sameContext(captured))return;
      const message=e?.message==='PHOTO_TOO_LARGE'?'Une photo reste trop lourde après compression. Essaie une autre photo.':e?.message==='PHOTO_TYPE'?'Le fichier choisi n’est pas une image compatible.':'Impossible de préparer une des photos.';
      setError(`Cette sélection n’a pas été ajoutée. ${message}`);
    }finally{if(photoImport===batch){photoImport=null;renderPhotos();setBusy(!!activeRequest)}}
  }

  function renderResult(analysis){
    const box=document.getElementById('aiResult');if(!box)return;
    const prestations=analysis?.prestations||[];if(!prestations.length){box.className='aiResult';box.innerHTML='';return}
    const lines=prestations.map((p,i)=>{
      const preset=presetFor(p.mode,p.preset),missing=missingFields(p),hours=statedHours(p),advised=suggestedHours(p);
      const buttonLabel=hours>0?'Préparer avec les heures saisies':missing.length?'Compléter cette prestation':advised>0?'Vérifier cette estimation':'Préparer cette prestation';
      const status=hours>0||(p.flat_ttc>0&&statedMoney(p.flat_ttc))?'Saisi':'Estimation à confirmer';
      return `<div class="aiResultCard"><div class="aiResultTop"><div><div class="aiResultName">${esc(p.designation||preset?.label||'Prestation')}</div><div class="aiResultMeta">${esc(modeLabel(p.mode))} · ${esc(resultDetail(p))}</div>${visualHtml(p)}${visualMeasureHtml(p)}${estimateHtml(p)}${historyHtml(p)}${missing.length?`<div class="aiMissing">À compléter / vérifier : ${esc(missing.join(', '))}</div>`:''}</div><div class="aiConfidence">${esc(status)}</div></div><button class="btn small primary" style="width:100%;margin-top:9px" type="button" onclick="applyAIProposal(${i})">${esc(buttonLabel)}</button></div>`;
    }).join('');
    const supplies=Number(analysis.fournitures_ttc)||0;
    const suppliesHtml=supplies>0&&statedMoney(supplies)?`<div class="aiSupplies"><div><strong>Fournitures · montant à vérifier</strong><br><span style="color:#9fdcf6">${money(supplies)} TTC</span></div><button id="aiSuppliesBtn" class="btn small" type="button" onclick="addAISupplies()">Ajouter</button></div>`:'';
    box.innerHTML=`<div style="font-size:12px;font-weight:850;color:#dff6ff">Proposition</div>${lines}${suppliesHtml}${historyStatusHtml()}${analysis.notes?`<div class="tiny" style="margin-top:9px;color:#a9d9ea">${esc(analysis.notes)}</div>`:''}`;box.className='aiResult show';
  }

  window.analyseChantierAI=async function(){
    if(photoImport){setError('Attends la préparation des photos avant de lancer l’analyse.');return}
    const text=String(document.getElementById('aiChantierText')?.value||'').trim();
    if(text.length>2500){setError('La description est trop longue. Limite-la à 2 500 caractères avant l’analyse.');return}
    if(text.length<5&&selectedPhotos.length===0){setError('Décris le chantier ou ajoute au moins une photo avant de lancer l’analyse.');return}
    invalidate();const captured=context();const controller=new AbortController();activeRequest=controller;setBusy(true);
    try{
      const payload={description:text,mode:captured.mode,company:captured.company,images:selectedPhotos.map(p=>p.dataUrl)};
      const body=JSON.stringify(payload),bytes=typeof TextEncoder==='function'?new TextEncoder().encode(body).byteLength:unescape(encodeURIComponent(body)).length;
      if(bytes>MAX_BODY_BYTES)throw new Error('Le texte et les photos sont trop volumineux. Réduis le texte ou retire une photo avant l’analyse.');
      const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal});
      const data=await response.json().catch(()=>null);
      if(!sameContext(captured))return;
      if(!response.ok||!data?.ok){
        if(data?.error==='AI_NOT_CONFIGURED') throw new Error('L’assistant n’est pas configuré côté serveur.');
        if(data?.error==='TOO_MANY_IMAGES') throw new Error(`Maximum ${MAX_PHOTOS} photos par analyse.`);
        if(data?.error==='INVALID_IMAGES') throw new Error('Une photo n’est pas compatible. Retire-la et ajoute une autre image.');
        if(data?.error==='IMAGE_TOO_LARGE') throw new Error('Une photo reste trop volumineuse. Retire-la et ajoute une autre image.');
        if(data?.error==='PAYLOAD_TOO_LARGE') throw new Error('Le texte et les photos sont trop volumineux. Réduis le texte ou retire une photo avant l’analyse.');
        if(data?.error==='DESCRIPTION_TOO_LONG') throw new Error('La description est trop longue. Limite-la à 2 500 caractères avant l’analyse.');
        throw new Error('L’analyse n’a pas abouti. Réessaie.');
      }
      lastAnalysis=data.analysis;lastMeta=data.meta||null;lastContext=captured;suppliesAdded=false;renderResult(lastAnalysis);
    }catch(e){if(sameContext(captured)&&e?.name!=='AbortError')setError(e?.message||'Impossible de joindre l’assistant.')}finally{if(sameContext(captured)){activeRequest=null;setBusy(false)}}
  };

  function setIf(id,value,allowEmpty=false){const n=document.getElementById(id);if(!n)return;if(allowEmpty||value!==''&&value!==0&&value!==false&&value!=null)n.value=value}

  function visualMeasureText(p){
    const bits=[];
    if(Number(p.visual_metric_min)>0&&Number(p.visual_metric_max)>0&&p.visual_metric_unit) bits.push(`${frNum(p.visual_metric_min)}–${frNum(p.visual_metric_max)} ${p.visual_metric_unit}`);
    if(Number(p.visual_height_min)>0&&Number(p.visual_height_max)>0) bits.push(`hauteur ${frNum(p.visual_height_min)}–${frNum(p.visual_height_max)} m`);
    return bits.join(' · ');
  }

  function showEstimateNotice(p,usedHours){
    const card=document.querySelector('#serviceBuilder .builderCard');if(!card)return;card.querySelector('.aiBuilderNotice')?.remove();
    const notice=document.createElement('div');notice.className='aiBuilderNotice';
    const estimate=suggestedHours(p),min=Number(p.estimated_hours_min)||estimate,max=Number(p.estimated_hours_max)||estimate;
    const visual=visualMeasureText(p);const visualLine=visual?`<br>Hypothèse photo utilisée : ${esc(visual)}. Les champs de dimensions restent vides jusqu’à mesure réelle.`:'';
    const history=p.history_used&&Number(p.history_similar_count)>=2?`<br>Historique Ogust : ${Math.round(Number(p.history_similar_count))} cas comparables${Number(p.history_avg_hours)>0?`, moyenne ${esc(durationLabel(p.history_avg_hours))}`:''}.`:'';
    const missing=missingFields(p),estimated=state.builderMethod!=='flat'&&!statedHours(p);
    const label=estimated?'Estimation à confirmer':state.builderMethod==='flat'&&!statedMoney(p.flat_ttc)?'Montant à renseigner':'Saisi · à vérifier';
    const time=estimated&&estimate>0?`<br>Fourchette indicative : ${esc(durationLabel(min))} – ${esc(durationLabel(max))}`:'';
    const warning=missing.length?`<br>À vérifier : ${esc(missing.join(', '))}.`:'';
    const confirmation=estimated&&usedHours>0?'<label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><input id="aiDurationConfirm" type="checkbox">Je confirme cette durée pour chiffrer le chantier.</label>':estimated?'<br>Renseigne le temps retenu dans « Nombre d’heures ».':'';
    notice.innerHTML=`<strong>${label}</strong>${time}${visualLine}${history}${warning}${confirmation}`;
    card.querySelector('.serviceHead')?.insertAdjacentElement('afterend',notice)
  }

  window.applyAIProposal=function(index){
    if(!validAnalysis())return;
    const p=lastAnalysis?.prestations?.[index];if(!p||!MODES[p.mode])return;const preset=presetFor(p.mode,p.preset);if(!preset)return;
    applying=true;try{setMode(p.mode)}finally{applying=false}lastContext.mode=state.mode;
    state.activePreset=preset.id;state.builderMethod=p.pricing_method==='flat'?'flat':'hourly';renderPresets();renderServiceBuilder();
    if(preset.kind==='custom')setIf('builderDesignation',p.designation||preset.label,true);
    const missing=missingFields(p),hours=statedHours(p),estimated=!hours&&state.builderMethod!=='flat',usedHours=hours||(!missing.length&&!hasVisualMeasures(p)?suggestedHours(p):0);
    pendingProposal={context:{...lastContext},preset:preset.id,mode:p.mode,method:state.builderMethod,proposal:p,estimated,prefilledHours:estimated?usedHours:0,photoCount:selectedPhotos.length};
    if(state.builderMethod==='flat')setIf('builderFlat',statedMoney(p.flat_ttc)?p.flat_ttc:'',true);else{setIf('builderHours',usedHours>0?usedHours:'',true);if(statedRate(p.rate_ttc))setIf('builderRate',p.rate_ttc)}showEstimateNotice(p,usedHours);
    const metric=statedMeasure(p.metric,p.metric_unit),height=statedMeasure(p.height_m,'m');
    setIf('detailMetric',metric||'',true);setIf('builderMetric',metric||'',true);setIf('detailHeight',height||'',true);setIf('detailFaces',p.faces>0?String(p.faces):'',true);if(p.top)setIf('detailTop','oui',true);setIf('detailCutType',p.cut_type||'',true);setIf('detailWaste',p.waste||'',true);setIf('detailGrass',p.grass||'',true);setIf('detailCollection',p.collection||'',true);setIf('detailDensity',p.density||'',true);setIf('detailZone',p.zone||'',true);setIf('detailMethod',p.method||'',true);setIf('detailSupport',p.support||'',true);setIf('detailExtra',p.extra||'',true);document.getElementById('serviceBuilder')?.scrollIntoView({behavior:'smooth',block:'center'});
  };

  window.addAISupplies=function(){if(!validAnalysis())return;const amount=Number(lastAnalysis?.fournitures_ttc)||0;if(amount<=0||suppliesAdded)return;if(!statedMoney(amount)){setError('Le montant des fournitures n’est pas indiqué dans les notes. Renseigne-le dans le chiffrage.');return}const activity=lastAnalysis?.prestations?.[0]?.mode||state.mode,m=MODES[activity]||MODES[state.mode];state.lines.push({id:uid(),type:'cost',designation:'Fournitures / consommables',meta:'Montant extrait des notes · à vérifier',activity,qty:1,unit:'forfait',unitPriceTTC:amount,vat:m.vat,aiProvenance:{source:'notes',description:lastContext.text,photoCount:selectedPhotos.length,status:'saisi',durationConfirmed:true},aiPendingFields:[]});suppliesAdded=true;renderQuoteLines();const btn=document.getElementById('aiSuppliesBtn');if(btn){btn.textContent='Ajouté';btn.disabled=true}};

  function provenanceFor(pending){
    const p=pending.proposal;
    return {source:'assistant',description:pending.context.text,photoCount:pending.photoCount??selectedPhotos.length,status:pending.estimated?'estimation_confirmee':'saisi_verifie',durationConfirmed:true,estimatedHours:suggestedHours(p),basis:String(p.estimation_basis||''),visualHypotheses:visualMeasureText(p),missingFields:missingFields(p)};
  }
  window.acjAIDraftV42={
    get(){
      const pending=pendingProposal;
      if(!pending||!sameContext(pending.context)||pending.mode!==state.mode||pending.preset!==state.activePreset||pending.method!==state.builderMethod)return null;
      return JSON.parse(JSON.stringify({proposal:pending.proposal,company:pending.context.company,number:pending.context.quote,mode:pending.mode,preset:pending.preset,method:pending.method,text:pending.context.text,photoCount:pending.photoCount??selectedPhotos.length,prefilledHours:pending.prefilledHours,estimated:pending.estimated}));
    },
    restore(draft){
      if(!draft||typeof draft!=='object'||!draft.proposal||typeof draft.proposal!=='object')return false;
      if(String(draft.company||'')!==String(state.company||'')||String(draft.number||'')!==String(state.number||'')||draft.mode!==state.mode||draft.preset!==state.activePreset||draft.method!==state.builderMethod||String(draft.text||'').trim()!==context().text)return false;
      const preset=MODES[state.mode]?.presets.find(item=>item.id===draft.preset);
      if(!preset||!['hourly','flat','auto'].includes(draft.method)||draft.proposal.mode!==draft.mode)return false;
      lastContext=context();lastAnalysis=null;lastMeta=null;
      const proposal=JSON.parse(JSON.stringify(draft.proposal)),estimated=!statedHours(proposal)&&draft.method!=='flat';
      pendingProposal={context:{...lastContext},preset:draft.preset,mode:draft.mode,method:draft.method,proposal,estimated,prefilledHours:estimated?Math.max(0,Number(draft.prefilledHours)||0):0,photoCount:Math.min(MAX_PHOTOS,Math.max(0,Number(draft.photoCount)||0))};
      showEstimateNotice(proposal,pendingProposal.prefilledHours);
      const checkbox=document.getElementById('aiDurationConfirm');if(checkbox)checkbox.checked=false;
      return true;
    }
  };
  window.acjAIReadiness=function(){
    const lines=state.lines||[];
    return {ok:!lines.some(line=>line.aiProvenance?.durationConfirmed===false),unconfirmed:lines.filter(line=>line.aiProvenance?.durationConfirmed===false).map(line=>line.id),missing:lines.filter(line=>line.aiPendingFields?.length).map(line=>({id:line.id,designation:line.designation,fields:[...line.aiPendingFields]}))};
  };
  function wrap(){
    const builder=window.renderServiceBuilder;
    if(typeof builder==='function')window.renderServiceBuilder=function(){
      const pending=pendingProposal,active=pending&&sameContext(pending.context)&&pending.mode===state.mode&&pending.preset===state.activePreset&&pending.method===state.builderMethod;
      const ids=['builderHours','builderFlat','builderRate','builderDesignation','builderMetric','detailMetric','detailHeight','detailFaces','detailTop','detailCutType','detailWaste','detailGrass','detailCollection','detailDensity','detailZone','detailMethod','detailSupport','detailExtra'];
      const saved=active?ids.map(id=>[id,document.getElementById(id)?.value]).filter(([,value])=>value!==undefined):[];
      const confirmed=document.getElementById('aiDurationConfirm')?.checked,out=builder.apply(this,arguments);
      if(active){for(const [id,value] of saved)setIf(id,value,true);showEstimateNotice(pending.proposal,pending.prefilledHours);const checkbox=document.getElementById('aiDurationConfirm');if(checkbox)checkbox.checked=!!confirmed}
      return out;
    };
    const add=window.addBuiltService;
    if(typeof add==='function')window.addBuiltService=function(){
      const pending=pendingProposal;
      if(pending){
        if(!sameContext(pending.context)){invalidate();setError('Le chantier a changé. Prépare à nouveau cette prestation.');return}
        if(pending.mode!==state.mode||pending.preset!==state.activePreset||pending.method!==state.builderMethod){pendingProposal=null}
        else if(pending.estimated&&pending.prefilledHours>0&&!document.getElementById('aiDurationConfirm')?.checked){setError('Confirme ou corrige la durée proposée avant d’ajouter cette prestation.');document.getElementById('aiDurationConfirm')?.focus();return}
      }
      const applied=pendingProposal,before=state.lines.length,out=add.apply(this,arguments);
      if(applied&&state.lines.length>before){
        const line=state.lines[state.lines.length-1];line.aiProvenance=provenanceFor(applied);line.aiPendingFields=missingFields(applied.proposal);pendingProposal=null;setError('');renderQuoteLines();
      }
      return out;
    };
    const payload=window.quotePayload;
    if(typeof payload==='function')window.quotePayload=function(){const out=payload.apply(this,arguments);(out?.lignes||[]).forEach((line,index)=>{const source=state.lines[index];if(source?.aiProvenance)line.ai_provenance=JSON.parse(JSON.stringify(source.aiProvenance));if(source?.aiPendingFields?.length)line.ai_pending_fields=[...source.aiPendingFields]});return out};
    const fresh=window.newQuote;
    if(typeof fresh==='function')window.newQuote=function(){invalidate(true);return fresh.apply(this,arguments)};
    const mode=window.setMode;
    if(typeof mode==='function')window.setMode=function(value){if(!applying&&value!==state.mode)invalidate();return mode.apply(this,arguments)};
    const choose=window.choosePreset;
    if(typeof choose==='function')window.choosePreset=function(){pendingProposal=null;document.querySelector('#serviceBuilder .aiBuilderNotice')?.remove();return choose.apply(this,arguments)};
    const method=window.setBuilderMethod;
    if(typeof method==='function')window.setBuilderMethod=function(){pendingProposal=null;return method.apply(this,arguments)};
    window.addEventListener('acj:company-changed',()=>invalidate(true));
  }

  addStyles();injectCard();renderPhotos();wrap();
})();
