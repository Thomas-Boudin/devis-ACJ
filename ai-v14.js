// Assistant ACJ v14 — description libre + estimation de temps proposée si aucune durée n'est fournie.
(function(){
  const AI_ENDPOINT='https://acj-ogust-proxy.vercel.app/api/analyse-chantier';
  let lastAnalysis=null;
  let suppliesAdded=false;

  function addStyles(){
    if(document.getElementById('ai-v14-style')) return;
    const style=document.createElement('style');
    style.id='ai-v14-style';
    style.textContent=`
      .aiCard{border-color:#155e75;background:linear-gradient(180deg,rgba(8,47,73,.94),rgba(8,28,43,.96))}
      .aiTitleRow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.aiTitle{font-size:16px;font-weight:900}.aiBadge{font-size:10px;font-weight:850;padding:5px 8px;border-radius:999px;background:#0c4a6e;color:#bae6fd;border:1px solid #0e7490}
      .aiHelp{font-size:12px;color:#bae6fd;line-height:1.45;margin-bottom:12px}.aiActions{display:flex;gap:9px;align-items:center}.aiActions .btn{flex:1}.aiLoader{display:none;font-size:11px;color:#bae6fd}.aiLoader.show{display:block}
      .aiResult{margin-top:12px;display:none}.aiResult.show{display:block}.aiResultCard{border:1px solid #28627a;background:#071a28;border-radius:14px;padding:12px;margin-top:9px}.aiResultTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.aiResultName{font-size:13px;font-weight:850}.aiResultMeta{font-size:11px;color:#a9d9ea;line-height:1.4;margin-top:4px}
      .aiEstimate{margin-top:9px;padding:9px 10px;border:1px solid #365314;background:#13210b;border-radius:11px;color:#d9f99d;font-size:11px;line-height:1.45}.aiEstimate strong{color:#ecfccb}.aiEstimateBasis{color:#bef264;margin-top:3px}.aiEstimateLow{border-color:#854d0e;background:#241b08;color:#fde68a}
      .aiMissing{font-size:10px;color:#fde68a;margin-top:6px}.aiConfidence{font-size:10px;color:#94a3b8;white-space:nowrap}.aiSupplies{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid #17435a;margin-top:10px;padding-top:10px;font-size:12px}.aiError{margin-top:10px;padding:10px 11px;border-radius:11px;border:1px solid #7f1d1d;background:#2b1115;color:#fecaca;font-size:11px;display:none}.aiError.show{display:block}
      .aiBuilderNotice{margin:0 0 13px;padding:10px 11px;border-radius:12px;border:1px solid #365314;background:#13210b;color:#d9f99d;font-size:11px;line-height:1.45}
      @media(max-width:520px){.aiActions{flex-direction:column;align-items:stretch}.aiResultTop{gap:6px}}
    `;
    document.head.appendChild(style);
  }

  function modeLabel(mode){return MODES[mode]?.label||mode}
  function presetFor(mode,preset){const list=MODES[mode]?.presets||[];return list.find(x=>x.id===preset)||list.find(x=>x.id.startsWith('autre_'))||list[0]}
  function frNum(v){return String(Number(v)||0).replace('.',',')}

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

  function estimateHtml(p){
    const suggested=Number(p.estimated_hours_suggested)||0;
    if(p.hours>0||p.flat_ttc>0||suggested<=0) return '';
    const min=Number(p.estimated_hours_min)||suggested,max=Number(p.estimated_hours_max)||suggested,confidence=Number(p.estimation_confidence)||0;
    const cls=confidence<.55?' aiEstimateLow':'';
    return `<div class="aiEstimate${cls}"><strong>Temps proposé : ${frNum(suggested)} h</strong> · fourchette ${frNum(min)}–${frNum(max)} h<div class="aiEstimateBasis">${esc(p.estimation_basis||'Estimation indicative ACJ')} · à valider</div></div>`;
  }

  function injectCard(){
    if(document.getElementById('aiChantierCard')) return;
    const step=document.querySelector('section[data-step="2"]'),lead=step?.querySelector('.lead');
    if(!step||!lead) return;
    const card=document.createElement('div');
    card.id='aiChantierCard';card.className='card aiCard';
    card.innerHTML=`<div class="aiTitleRow"><div class="aiTitle">Décrire le chantier</div><span class="aiBadge">Assistant ACJ</span></div><div class="aiHelp">Décris le chantier naturellement. Si tu ne donnes pas le temps, l’assistant propose une fourchette et un nombre d’heures à retenir. Rien n’est ajouté sans ta validation.</div><div class="field"><textarea id="aiChantierText" placeholder="Ex. 30 ml de haie, 2 m de haut, une face + dessus, taille d’entretien, évacuation…"></textarea></div><div class="aiActions"><button id="aiAnalyseBtn" class="btn primary" type="button" onclick="analyseChantierAI()">Analyser le chantier</button><div id="aiLoader" class="aiLoader">Analyse en cours…</div></div><div id="aiError" class="aiError"></div><div id="aiResult" class="aiResult"></div>`;
    lead.insertAdjacentElement('afterend',card);
  }

  function setError(message){const n=document.getElementById('aiError');if(!n)return;n.textContent=message||'';n.classList.toggle('show',!!message)}

  function renderResult(analysis){
    const box=document.getElementById('aiResult');if(!box)return;
    const prestations=analysis?.prestations||[];if(!prestations.length){box.className='aiResult';box.innerHTML='';return}
    const lines=prestations.map((p,i)=>{
      const preset=presetFor(p.mode,p.preset),missing=(p.missing_fields||[]).filter(Boolean),suggested=Number(p.estimated_hours_suggested)||0;
      const buttonLabel=p.hours>0?'Préremplir avec les heures indiquées':suggested>0?`Préremplir avec ${frNum(suggested)} h proposées`:'Préremplir cette prestation';
      return `<div class="aiResultCard"><div class="aiResultTop"><div><div class="aiResultName">${esc(p.designation||preset?.label||'Prestation')}</div><div class="aiResultMeta">${esc(modeLabel(p.mode))} · ${esc(resultDetail(p))}</div>${estimateHtml(p)}${missing.length?`<div class="aiMissing">À compléter / vérifier : ${esc(missing.join(', '))}</div>`:''}</div><div class="aiConfidence">${Math.round((p.confidence||0)*100)} %</div></div><button class="btn small primary" style="width:100%;margin-top:9px" type="button" onclick="applyAIProposal(${i})">${esc(buttonLabel)}</button></div>`;
    }).join('');
    const supplies=Number(analysis.fournitures_ttc)||0;
    const suppliesHtml=supplies>0?`<div class="aiSupplies"><div><strong>Fournitures reconnues</strong><br><span style="color:#9fdcf6">${money(supplies)} TTC</span></div><button id="aiSuppliesBtn" class="btn small" type="button" onclick="addAISupplies()">Ajouter</button></div>`:'';
    box.innerHTML=`<div style="font-size:12px;font-weight:850;color:#dff6ff">Proposition</div>${lines}${suppliesHtml}${analysis.notes?`<div class="tiny" style="margin-top:9px;color:#a9d9ea">${esc(analysis.notes)}</div>`:''}`;box.className='aiResult show';
  }

  window.analyseChantierAI=async function(){
    const text=String(document.getElementById('aiChantierText')?.value||'').trim();if(text.length<5){setError('Décris un peu le chantier avant de lancer l’analyse.');return}
    setError('');const btn=document.getElementById('aiAnalyseBtn'),loader=document.getElementById('aiLoader');if(btn)btn.disabled=true;loader?.classList.add('show');
    try{const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:text,mode:state.mode})});const data=await response.json().catch(()=>null);if(!response.ok||!data?.ok)throw new Error(data?.error==='AI_NOT_CONFIGURED'?'L’assistant n’est pas configuré côté serveur.':'L’analyse n’a pas abouti. Réessaie.');lastAnalysis=data.analysis;suppliesAdded=false;renderResult(lastAnalysis)}catch(e){setError(e?.message||'Impossible de joindre l’assistant.')}finally{if(btn)btn.disabled=false;loader?.classList.remove('show')}
  };

  function setIf(id,value,allowEmpty=false){const n=document.getElementById(id);if(!n)return;if(allowEmpty||value!==''&&value!==0&&value!==false&&value!=null)n.value=value}
  function showEstimateNotice(p,usedHours){if(!(Number(p.estimated_hours_suggested)>0)||Number(p.hours)>0)return;const card=document.querySelector('#serviceBuilder .builderCard');if(!card)return;card.querySelector('.aiBuilderNotice')?.remove();const notice=document.createElement('div');notice.className='aiBuilderNotice';const min=Number(p.estimated_hours_min)||usedHours,max=Number(p.estimated_hours_max)||usedHours;notice.innerHTML=`<strong>Estimation ACJ préremplie : ${esc(frNum(usedHours))} h</strong><br>Fourchette proposée : ${esc(frNum(min))}–${esc(frNum(max))} h. Tu peux modifier les heures avant d’ajouter la prestation.`;card.querySelector('.serviceHead')?.insertAdjacentElement('afterend',notice)}

  window.applyAIProposal=function(index){
    const p=lastAnalysis?.prestations?.[index];if(!p||!MODES[p.mode])return;const preset=presetFor(p.mode,p.preset);if(!preset)return;
    setMode(p.mode);state.activePreset=preset.id;state.builderMethod=p.pricing_method==='flat'?'flat':'hourly';renderPresets();renderServiceBuilder();
    if(preset.kind==='custom')setIf('builderDesignation',p.designation||preset.label,true);
    if(state.builderMethod==='flat')setIf('builderFlat',p.flat_ttc||'',true);else{const usedHours=Number(p.hours)>0?Number(p.hours):(Number(p.estimated_hours_suggested)||0);setIf('builderHours',usedHours>0?usedHours:'',true);if(p.rate_ttc>0)setIf('builderRate',p.rate_ttc);showEstimateNotice(p,usedHours)}
    setIf('detailMetric',p.metric>0?p.metric:'',true);setIf('builderMetric',p.metric>0?p.metric:'',true);setIf('detailHeight',p.height_m>0?p.height_m:'',true);setIf('detailFaces',p.faces>0?String(p.faces):'',true);if(p.top)setIf('detailTop','oui',true);setIf('detailCutType',p.cut_type||'',true);setIf('detailWaste',p.waste||'',true);setIf('detailGrass',p.grass||'',true);setIf('detailCollection',p.collection||'',true);setIf('detailDensity',p.density||'',true);setIf('detailZone',p.zone||'',true);setIf('detailMethod',p.method||'',true);setIf('detailSupport',p.support||'',true);setIf('detailExtra',p.extra||'',true);document.getElementById('serviceBuilder')?.scrollIntoView({behavior:'smooth',block:'center'});
  };

  window.addAISupplies=function(){const amount=Number(lastAnalysis?.fournitures_ttc)||0;if(amount<=0||suppliesAdded)return;const activity=lastAnalysis?.prestations?.[0]?.mode||state.mode,m=MODES[activity]||MODES[state.mode];state.lines.push({id:uid(),type:'cost',designation:'Fournitures / consommables',meta:'Montant extrait de la description du chantier',activity,qty:1,unit:'forfait',unitPriceTTC:amount,vat:m.vat});suppliesAdded=true;renderQuoteLines();const btn=document.getElementById('aiSuppliesBtn');if(btn){btn.textContent='Ajouté';btn.disabled=true}};

  addStyles();injectCard();
})();
