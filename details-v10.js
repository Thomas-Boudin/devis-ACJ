// Détails métier jardinage v10 — complète les lignes du devis sans changer le mode de chiffrage.
(function(){
  function value(id){const n=document.getElementById(id);return n?String(n.value||'').trim():''}
  function metricValue(){return value('builderMetric')||value('detailMetric')}
  function yesNoLabel(v,yes,no){return v==='oui'?yes:(v==='non'?no:'')}

  function detailFields(p){
    if(state.mode!=='jardin'||!p) return '';
    const metricExists=!!document.getElementById('builderMetric');
    const metricField=(label,unit)=>metricExists
      ? `<div class="hint">La quantité saisie pour l’estimation (${esc(unit)}) sera reprise automatiquement dans le détail client.</div>`
      : `<div class="field"><label>${esc(label)} (${esc(unit)}) — optionnel</label><input id="detailMetric" type="number" min="0" step="0.1" placeholder="0"></div>`;
    const extra=`<div class="field"><label>Précision complémentaire — optionnel</label><input id="detailExtra" placeholder="Ex. accès difficile, haie mitoyenne…"></div>`;

    if(p.id==='haie') return `
      <div class="methodTitle" style="margin-top:12px">Détails de la prestation</div>
      ${metricField('Longueur','ml')}
      <div class="grid2">
        <div class="field"><label>Hauteur approximative (m)</label><input id="detailHeight" type="number" min="0" step="0.1" placeholder="Ex. 2,2"></div>
        <div class="field"><label>Faces à tailler</label><select id="detailFaces"><option value="">Non précisé</option><option value="1">1 face</option><option value="2">2 faces</option></select></div>
        <div class="field"><label>Dessus</label><select id="detailTop"><option value="">Non précisé</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
        <div class="field"><label>Type de taille</label><select id="detailCutType"><option value="">Non précisé</option><option value="entretien">Taille d’entretien</option><option value="rabattage">Rabattage</option></select></div>
      </div>
      <div class="field"><label>Évacuation des déchets verts</label><select id="detailWaste"><option value="">Non précisé</option><option value="oui">Prévue</option><option value="non">Non prévue</option></select></div>
      ${extra}`;

    if(p.id==='tonte') return `
      <div class="methodTitle" style="margin-top:12px">Détails de la prestation</div>
      ${metricField('Surface','m²')}
      <div class="grid2">
        <div class="field"><label>État de l’herbe</label><select id="detailGrass"><option value="">Non précisé</option><option value="entretien">Entretien courant</option><option value="haute">Herbe haute</option><option value="tres_haute">Herbe très haute</option></select></div>
        <div class="field"><label>Ramassage</label><select id="detailCollection"><option value="">Non précisé</option><option value="oui">Avec ramassage</option><option value="non">Sans ramassage</option></select></div>
      </div>${extra}`;

    if(p.id==='debroussaillage') return `
      <div class="methodTitle" style="margin-top:12px">Détails de la prestation</div>
      ${metricField('Surface','m²')}
      <div class="grid2">
        <div class="field"><label>État du terrain</label><select id="detailDensity"><option value="">Non précisé</option><option value="leger">Végétation légère</option><option value="dense">Végétation dense</option><option value="friche">Friche / très dense</option></select></div>
        <div class="field"><label>Évacuation</label><select id="detailWaste"><option value="">Non précisé</option><option value="oui">Prévue</option><option value="non">Non prévue</option></select></div>
      </div>${extra}`;

    if(p.id==='desherbage') return `
      <div class="methodTitle" style="margin-top:12px">Détails de la prestation</div>
      <div class="grid2">
        <div class="field"><label>Zone</label><select id="detailZone"><option value="">Non précisé</option><option value="massifs">Massifs</option><option value="allees">Allées</option><option value="cour">Cour / pavés</option><option value="mixte">Plusieurs zones</option></select></div>
        <div class="field"><label>Surface approximative (m²)</label><input id="detailMetric" type="number" min="0" step="0.1" placeholder="0"></div>
      </div>
      <div class="field"><label>Méthode</label><select id="detailMethod"><option value="manuel">Désherbage manuel</option><option value="autre">Autre méthode</option></select></div>${extra}`;

    if(p.id==='nettoyage_hp') return `
      <div class="methodTitle" style="margin-top:12px">Détails de la prestation</div>
      <div class="grid2">
        <div class="field"><label>Surface approximative (m²)</label><input id="detailMetric" type="number" min="0" step="0.1" placeholder="0"></div>
        <div class="field"><label>Support</label><select id="detailSupport"><option value="">Non précisé</option><option value="terrasse">Terrasse</option><option value="cour">Cour</option><option value="paves">Pavés</option><option value="mur">Mur / façade</option><option value="autre">Autre support</option></select></div>
      </div>${extra}`;

    return '';
  }

  function collectDetails(presetId){
    const parts=[];
    const metric=metricValue();
    if(presetId==='haie'){
      if(metric) parts.push(`${metric} ml`);
      const h=value('detailHeight'); if(h) parts.push(`hauteur env. ${h.replace('.',',')} m`);
      const faces=value('detailFaces'),top=value('detailTop');
      if(faces&&top==='oui') parts.push(`${faces} face${faces==='2'?'s':''} + dessus`);
      else if(faces) parts.push(`${faces} face${faces==='2'?'s':''}`);
      else if(top==='oui') parts.push('dessus');
      const cut=value('detailCutType'); if(cut==='entretien') parts.push('taille d’entretien'); if(cut==='rabattage') parts.push('rabattage');
      const waste=value('detailWaste'); const w=yesNoLabel(waste,'évacuation des déchets prévue','évacuation des déchets non prévue'); if(w) parts.push(w);
    }
    if(presetId==='tonte'){
      if(metric) parts.push(`${metric} m²`);
      const grass=value('detailGrass'); if(grass==='entretien') parts.push('entretien courant'); if(grass==='haute') parts.push('herbe haute'); if(grass==='tres_haute') parts.push('herbe très haute');
      const coll=value('detailCollection'); if(coll==='oui') parts.push('avec ramassage'); if(coll==='non') parts.push('sans ramassage');
    }
    if(presetId==='debroussaillage'){
      if(metric) parts.push(`${metric} m²`);
      const d=value('detailDensity'); if(d==='leger') parts.push('végétation légère'); if(d==='dense') parts.push('végétation dense'); if(d==='friche') parts.push('friche / végétation très dense');
      const waste=value('detailWaste'); const w=yesNoLabel(waste,'évacuation prévue','évacuation non prévue'); if(w) parts.push(w);
    }
    if(presetId==='desherbage'){
      if(metric) parts.push(`${metric} m²`);
      const z=value('detailZone'); const zl={massifs:'massifs',allees:'allées',cour:'cour / pavés',mixte:'plusieurs zones'}[z]; if(zl) parts.push(zl);
      const method=value('detailMethod'); if(method==='manuel') parts.push('désherbage manuel'); if(method==='autre') parts.push('méthode spécifique');
    }
    if(presetId==='nettoyage_hp'){
      if(metric) parts.push(`${metric} m²`);
      const s=value('detailSupport'); const sl={terrasse:'terrasse',cour:'cour',paves:'pavés',mur:'mur / façade',autre:'autre support'}[s]; if(sl) parts.push(sl);
    }
    const extra=value('detailExtra'); if(extra) parts.push(extra);
    return parts;
  }

  const originalRenderServiceBuilder=renderServiceBuilder;
  renderServiceBuilder=function(){
    originalRenderServiceBuilder();
    const p=findPreset(state.activePreset);
    const html=detailFields(p);
    if(!html) return;
    const card=document.querySelector('#serviceBuilder .builderCard');
    const addButton=card?.querySelector('button.btn.primary');
    if(!card||!addButton) return;
    const box=document.createElement('div');
    box.id='gardeningDetailsV10';
    box.innerHTML=html;
    card.insertBefore(box,addButton);
  };

  const originalAddBuiltService=addBuiltService;
  addBuiltService=function(){
    const presetId=state.activePreset;
    const isGarden=state.mode==='jardin';
    const before=state.lines.length;
    const details=isGarden&&presetId?collectDetails(presetId):[];
    originalAddBuiltService();
    if(state.lines.length<=before||!details.length) return;
    const line=state.lines[state.lines.length-1];
    if(!line||line.type!=='service') return;
    const pricing=line.meta?String(line.meta):'';
    line.meta=[...details,pricing].filter(Boolean).join(' · ');
    renderQuoteLines();
  };
})();
