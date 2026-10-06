(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/analyse-chantier';
  let image='',analysis=null,generation=0,busy=false;
  const fields=[['title','Civilité'],['last_name','Nom'],['first_name','Prénom'],['mobile_phone','Téléphone mobile'],['landline','Téléphone fixe'],['email','Email'],['address','Adresse'],['zip','Code postal'],['city','Ville']];
  const company=()=>typeof window.currentOgustCompanyV28==='function'?window.currentOgustCompanyV28():'ACJ Services';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id);
  function status(text){el('noteStatus').textContent=text}
  function invalidate(){generation++;analysis=null;if(el('notePreview'))el('notePreview').innerHTML=''}
  async function prepareImage(file){
    if(!file||!file.type.startsWith('image/'))throw Error('Choisis une image.');
    if(file.size>20*1024*1024)throw Error('Image trop volumineuse (20 Mo maximum).');
    const url=URL.createObjectURL(file);
    try{const decoded=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Image illisible.'));img.src=url});
      const scale=Math.min(1,2000/Math.max(decoded.width,decoded.height)),canvas=document.createElement('canvas');canvas.width=Math.round(decoded.width*scale);canvas.height=Math.round(decoded.height*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(decoded,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/jpeg',.9);if(data.length>3_000_000)throw Error('Capture trop volumineuse. Recadre la note.');return data;
    }finally{URL.revokeObjectURL(url)}
  }
  function renderPreview(){
    const a=analysis,client=a.client;
    el('notePreview').innerHTML=`<div class="noteReview"><strong>Vérifier les informations extraites</strong><div class="grid2">${fields.map(([key,label])=>`<div class="field"><label>${label}</label><input id="noteField_${key}" value="${esc(client[key])}" ${key==='email'?'type="email"':key.includes('phone')||key==='landline'?'type="tel"':''} placeholder="Non indiqué"></div>`).join('')}</div><div class="field"><label>Travaux à préparer · modifiables</label><textarea id="noteTasks">${esc(a.tasks.map(t=>t.description).join('\n'))}</textarea></div>${a.tasks.some(t=>t.uncertain)?'<div class="noteWarning">Certaines reformulations sont à confirmer. Compare-les au texte source.</div>':''}${a.uncertainties.length?`<div class="noteWarning"><strong>À préciser</strong><ul>${a.uncertainties.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}<details><summary>Texte source et correspondances</summary><pre class="noteSource">${esc(a.transcription)}</pre>${a.tasks.map(t=>`<p>${esc(t.source)} → ${esc(t.description)}${t.uncertain?' · à confirmer':''}</p>`).join('')}</details><label class="noteCheck"><input id="noteApplyClient" type="checkbox" ${!el('client').value.trim()?'checked':''}>Remplacer les coordonnées du devis par cette fiche</label><label class="noteCheck"><input id="noteAppendTasks" type="checkbox" checked>Ajouter les travaux aux notes du devis et à la description du chantier</label><button id="noteApply" class="btn primary" type="button">Appliquer les informations vérifiées</button><div class="hint">Les champs absents restent vides. Aucun client ni devis n’est créé dans Ogust par cet import.</div></div>`;
    el('noteApply').addEventListener('click',apply);
  }
  async function analyse(){
    if(busy)return;
    const text=el('noteText').value.trim();if(!text&&!image){status('Colle une note ou ajoute une capture.');return}
    if(text.length>12000){status('Note trop longue (12 000 caractères maximum).');return}
    invalidate();const seq=generation,account=company();busy=true;el('noteAnalyse').disabled=true;status('Lecture des coordonnées et des travaux…');
    try{
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'import_notes',text,image,company:account})});
      const data=await response.json().catch(()=>null);
      if(seq!==generation||account!==company())return;
      if(!response.ok||!data?.ok)throw Error(data?.error==='AI_NOT_CONFIGURED'?'L’assistant IA n’est pas configuré sur le serveur.':'La note n’a pas pu être analysée. Réessaie.');
      analysis=data.analysis;renderPreview();status('Extraction prête. Vérifie puis applique les informations.');
    }catch(error){if(seq===generation)status(error.message||'Analyse impossible.')}
    finally{busy=false;el('noteAnalyse').disabled=false}
  }
  function apply(){
    if(!analysis)return;
    if(!el('noteField_email').reportValidity())return;
    const client=Object.fromEntries(fields.map(([key])=>[key,el('noteField_'+key).value.trim()]));
    if(el('noteApplyClient').checked){if(!client.last_name){status('Renseigne le nom avant de remplacer la fiche client.');return}window.applyImportedNotesClientV39(client)}
    if(el('noteAppendTasks').checked){
      const tasks=el('noteTasks').value.trim();
      if(tasks){const notes=el('notes');notes.value=[notes.value.trim(),tasks].filter(Boolean).join('\n\n');if(typeof syncNotes==='function')syncNotes();const chantier=el('aiChantierText');if(chantier){chantier.value=[chantier.value.trim(),tasks].filter(Boolean).join('\n\n');chantier.dispatchEvent(new Event('input',{bubbles:true}))}}
    }
    if(el('noteAppendTasks').checked&&analysis.mode&&typeof setMode==='function'&&!state.lines.length)setMode(analysis.mode);
    el('noteApply').disabled=true;status('Informations appliquées. Complète l’adresse si nécessaire, puis chiffre les travaux à l’étape Chantier.');
  }
  function init(){
    const anchor=el('ogcClientCard');if(!anchor)return;
    const style=document.createElement('style');style.textContent='.noteReview{margin-top:12px}.noteReview .field{margin-top:10px}.noteWarning{padding:10px;border:1px solid #f59e0b;border-radius:10px;background:#fffbeb;color:#92400e;font-size:12px;margin:10px 0}.noteCheck{display:flex;align-items:flex-start;gap:8px;font-size:12px;margin:12px 0}.noteCheck input{width:auto;min-height:0;margin-top:2px}.noteSource{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;font-size:12px}.noteReview details p{padding:0 10px;font-size:12px}';document.head.appendChild(style);
    const card=document.createElement('div');card.className='card';card.id='notesImportCard';card.innerHTML=`<div class="cardTitle">Remplir depuis mes notes</div><div class="hint">Colle le texte de Samsung Notes ou ajoute une capture. L’assistant prépare les coordonnées et les travaux pour vérification.</div><div class="field"><textarea id="noteText" rows="5" placeholder="Colle ici tes notes de visite…"></textarea></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="noteImageBtn" class="btn" type="button">Ajouter une capture</button><button id="noteRemoveImage" class="btn" type="button" hidden>Retirer la capture</button><button id="noteAnalyse" class="btn primary" type="button">Lire mes notes</button></div><input id="noteImageFile" type="file" accept="image/*" hidden><div id="noteImageName" class="hint"></div><div id="noteStatus" class="hint" role="status" aria-live="polite"></div><div id="notePreview"></div>`;anchor.insertAdjacentElement('beforebegin',card);
    el('noteImageBtn').addEventListener('click',()=>el('noteImageFile').click());el('noteText').addEventListener('input',invalidate);
    el('noteImageFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;invalidate();const seq=generation;image='';el('noteAnalyse').disabled=true;status('Préparation de la capture…');try{const prepared=await prepareImage(file);if(seq!==generation)return;image=prepared;el('noteImageName').textContent=file.name;el('noteRemoveImage').hidden=false;status('Capture prête.')}catch(error){if(seq===generation)status(error.message)}finally{el('noteAnalyse').disabled=busy;e.target.value=''}});
    el('noteRemoveImage').addEventListener('click',()=>{invalidate();image='';el('noteImageName').textContent='';el('noteRemoveImage').hidden=true;status('')});el('noteAnalyse').addEventListener('click',analyse);
    function reset(){invalidate();image='';window.acjNotesClientDraft=null;el('noteText').value='';el('noteImageName').textContent='';el('noteRemoveImage').hidden=true;status('')}
    window.addEventListener('acj:company-changed',reset);
    const original=window.newQuote;window.newQuote=function(){reset();return original.apply(this,arguments)};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
