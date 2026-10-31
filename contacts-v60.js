// Read-only Ogust directory. Opening or filtering it never changes the quote.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';
  const COMPANIES=['ACJ Services','ACJ Services Lens','Jet Services'];
  const KINDS={customers:'Clients',employees:'Intervenants',contacts:'Interlocuteurs'};
  let overlay=null,companyInput,kindInput,searchInput,list,status,more,retry,controller,timer,picker,toggle,detail,hint,selected=null,sequence=0,nextPage=1,retryPage=1,contacts=[];
  const text=value=>typeof value==='string'||typeof value==='number'?String(value):'';
  function styles(){
    const style=document.createElement('style');style.id='contacts-style60';style.textContent=`
      #contactsOverlay60{position:fixed;inset:0;z-index:1600;background:rgba(15,35,54,.35);display:flex;align-items:center;justify-content:center;padding:12px}
      .contactsDialog60{width:min(680px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;overflow:hidden;background:#f7fafc;border:1px solid #d7e3ed;border-radius:20px;box-shadow:0 20px 60px rgba(20,45,68,.2);padding:16px;color:#183149}
      .contactsHead60{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.contactsHead60 h2{font-size:21px;margin:0}.contactsClose60{width:44px;height:44px;flex-shrink:0;border:1px solid #d7e3ed;border-radius:12px;background:#fff;color:#466079;font-size:22px}
      .contactsFilters60{display:grid;grid-template-columns:1.35fr 1fr;gap:9px;margin-bottom:10px}.contactsFilters60 label{font-size:11px;margin:0 0 5px}.contactsFilters60 select{padding:10px;font-size:12px;min-height:44px!important;width:100%}
      #contactsSearch60{width:100%;font-size:16px;margin-bottom:10px;min-height:48px!important}#contactsStatus60{font-size:12px;line-height:1.45;color:#647b90;margin:0 0 10px}
      #contactsList60{overflow:auto;overscroll-behavior:contain;min-height:0;display:grid;gap:10px;padding:2px 2px 5px}
      #contactsToggle61{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:50px;border:1px solid #bcdbea;border-radius:13px;background:#fff;color:#24516f;padding:12px;text-align:left;font-size:14px;font-weight:750;margin-bottom:10px}
      #contactsToggle61 span{overflow-wrap:anywhere}#contactsToggle61 svg{width:18px;height:18px;flex-shrink:0}#contactsToggle61[aria-expanded="true"] svg{transform:rotate(180deg)}
      #contactsPicker61{display:flex;flex-direction:column;min-height:0;overflow:hidden}#contactsPicker61[hidden],#contactsSelected61[hidden],#contactsHint61[hidden]{display:none!important}
      #contactsList60{max-height:45dvh;gap:5px;align-content:start}#contactsSelected61{overflow:auto;min-height:0;padding:2px}
      .contactOption61{width:100%;min-height:44px;padding:11px 12px;border:1px solid #dce6ee;border-radius:10px;background:#fff;color:#183149;font-size:14px;font-weight:650;text-align:left;overflow-wrap:anywhere}.contactOption61:hover{background:#edf8ff;border-color:#bcdbea}
      #contactsHint61{font-size:12px;line-height:1.5;color:#718197;margin:2px 0 4px}
      .contactCard60{border:1px solid #dce6ee;border-radius:15px;background:#fff;padding:13px;overflow-wrap:anywhere}.contactCard60 h3{font-size:15px;margin:0 0 9px;color:#183149}.contactCoordinates60{display:grid;gap:8px;font-size:13px;line-height:1.45}.contactCoordinates60 a{color:#0b6fae;text-decoration:none;min-height:32px;display:flex;align-items:center}.contactAddress60{color:#526d83;white-space:pre-line}.contactEmpty60{font-size:12px;color:#718197}
      .contactCopy60{margin-top:10px;min-height:38px;border:1px solid #d5e0e9;border-radius:10px;background:#f8fbfd;color:#315069;font-size:11px;font-weight:750;padding:8px 11px}.contactsFoot60{display:flex;gap:8px;padding-top:10px}.contactsFoot60 .btn{width:100%;min-height:44px!important;font-size:12px!important}.contactsFoot60 [hidden]{display:none!important}
      .contactActions61{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.contactAction61{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;border:1px solid #c8e3ee;border-radius:12px;background:#edf8ff;color:#0b6fae;font-size:13px;font-weight:750;text-decoration:none}.contactAction61 svg{width:21px;height:21px;flex-shrink:0}.contactAction61[disabled]{opacity:.55;background:#edf2f6;color:#8394a5}.contactCopy60{width:100%}.contactCard60 h3:focus{outline:none}
      #contactsOverlay60 button:focus-visible,#contactsOverlay60 a:focus-visible{outline:2px solid #0b78c9;outline-offset:2px}
      @media(max-width:420px){#contactsOverlay60{padding:8px}.contactsDialog60{padding:13px;max-height:calc(100dvh - 16px);border-radius:18px}.contactsFilters60{grid-template-columns:1fr 1fr;gap:7px}}
      @media print{#contactsOverlay60{display:none!important}}
    `;document.head.appendChild(style);
  }
  function abort(){clearTimeout(timer);controller?.abort();controller=null;sequence++}
  function close(){abort();overlay?.remove();overlay=null;contacts=[];selected=null;document.getElementById('appMenuToggle57')?.focus()}
  function coordinate(host,label,value,href){if(!value)return;const row=document.createElement(href?'a':'div');row.textContent=`${label} : ${value}`;if(href)row.href=href;host.appendChild(row)}
  function phoneLink(value){const number=text(value).replace(/[^+\d]/g,'');return /^\+?\d{6,15}$/.test(number)?`tel:${number}`:''}
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',name==='phone'?'M7 3H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3l-4-2-2 2c-3-1.5-5.5-4-7-7l2-2-2-4z':name==='waze'?'M21 3 15 21 11 13 3 9 21 3Z':'m6 9 6 6 6-6');svg.appendChild(path);return svg}
  function setPicker(open,restoreFocus=false){
    picker.hidden=!open;toggle.setAttribute('aria-expanded',String(open));detail.hidden=open||!selected;hint.hidden=open||!!selected;
    if(open){searchInput.focus();if(!contacts.length)load(1);else{status.textContent=`${contacts.length} contact${contacts.length>1?'s':''} disponible${contacts.length>1?'s':''}.`;more.hidden=!nextPage;retry.hidden=true}}else{abort();list.setAttribute('aria-busy','false');if(restoreFocus)toggle.focus()}
  }
  function renderSelected(){
    detail.replaceChildren();detail.hidden=!selected||!picker.hidden;toggle.querySelector('span').textContent=selected?text(selected.label):'Choisir un contact';toggle.setAttribute('aria-label',selected?`Changer de contact : ${text(selected.label)}`:'Choisir un contact');hint.hidden=!!selected||!picker.hidden;
    if(!selected)return;const contact=selected;
    const card=document.createElement('article');card.className='contactCard60';
    const heading=document.createElement('h3');heading.textContent=text(contact.label)||'Contact sans nom';heading.tabIndex=-1;
    const coordinates=document.createElement('div');coordinates.className='contactCoordinates60';
    const seenPhones=new Set();for(const [key,label] of [['mobile','Mobile'],['landline','Fixe'],['work_phone','Professionnel']]){const value=text(contact[key]);if(value&&!seenPhones.has(value)){seenPhones.add(value);coordinate(coordinates,label,value,phoneLink(value))}}
    const email=text(contact.email);coordinate(coordinates,'E-mail',email,/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(email)?`mailto:${encodeURIComponent(email)}`:'');
    const address=text(contact.address).trim();if(address){const row=document.createElement('div');row.className='contactAddress60';row.textContent=`Adresse : ${address}`;coordinates.appendChild(row)}
    card.append(heading,coordinates);
    if(!coordinates.children.length){const empty=document.createElement('div');empty.className='contactEmpty60';empty.textContent='Coordonnées non renseignées dans Ogust.';card.appendChild(empty)}
    const actions=document.createElement('div');actions.className='contactActions61';
    function action(label,kind,href,aria){const node=document.createElement(href?'a':'button');node.className='contactAction61';if(href)node.href=href;else{node.type='button';node.disabled=true}node.setAttribute('aria-label',aria);node.append(icon(kind),document.createTextNode(label));actions.appendChild(node);return node}
    const phone=[contact.mobile,contact.landline,contact.work_phone].map(phoneLink).find(Boolean);
    action('Appeler','phone',phone,phone?`Appeler ${text(contact.label)}`:'Téléphone non renseigné');
    const waze=action('Waze','waze',address?`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`:'',address?`Itinéraire Waze vers ${text(contact.label)}`:'Adresse non renseignée');if(address){waze.target='_blank';waze.rel='noopener noreferrer'}
    card.appendChild(actions);
    if(coordinates.children.length){const copy=document.createElement('button');copy.type='button';copy.className='contactCopy60';copy.textContent='Copier les coordonnées';copy.setAttribute('aria-label',`Copier les coordonnées de ${text(contact.label)}`);copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText([text(contact.label),...Array.from(coordinates.children,node=>node.textContent)].join('\n'));copy.textContent='Coordonnées copiées'}catch{copy.textContent='Copie indisponible'}});card.appendChild(copy)}
    detail.appendChild(card);detail.scrollTop=0;
  }
  function render(keepScroll=false){
    const scrollTop=keepScroll?list.scrollTop:0;list.replaceChildren();
    for(const contact of contacts){
      const option=document.createElement('button');option.type='button';option.className='contactOption61';option.textContent=text(contact.label)||'Contact sans nom';option.addEventListener('click',()=>{selected=contact;renderSelected();setPicker(false);detail.querySelector('h3')?.focus({preventScroll:true})});list.appendChild(option);
    }
    list.scrollTop=scrollTop;
  }
  async function load(page=1){
    if(!overlay)return;controller?.abort();controller=new AbortController();const signal=controller.signal,seq=++sequence;
    const company=companyInput.value,kind=kindInput.value,query=searchInput.value.trim();retry.hidden=true;more.hidden=true;
    if(page===1){contacts=[];render();nextPage=1}
    if(company==='Jet Services'){status.textContent='Le compte Ogust de Jet Services n’est pas relié à cet annuaire.';return}
    if(query.length===1){status.textContent='Saisis au moins 2 caractères pour rechercher.';return}
    status.textContent=page===1?'Chargement des contacts…':'Chargement des contacts suivants…';list.setAttribute('aria-busy','true');
    try{
      const url=new URL(ENDPOINT);for(const [key,value] of Object.entries({action:'directory',company,kind,query,page}))url.searchParams.set(key,String(value));
      const response=await fetch(url.href,{cache:'no-store',signal}),data=await response.json().catch(()=>null);
      if(!overlay||seq!==sequence)return;
      if(!response.ok||!data?.ok||data.company!==company||!Array.isArray(data.contacts))throw Error(data?.error||'CONTACT_READ_FAILED');
      const seen=new Set(contacts.map(contact=>`${contact.kind}|${contact.id}`));
      for(const contact of data.contacts){if(!contact||contact.kind!==kind||!text(contact.id))continue;const key=`${contact.kind}|${contact.id}`;if(!seen.has(key)){seen.add(key);contacts.push(contact)}}
      contacts.sort((a,b)=>text(a.label).localeCompare(text(b.label),'fr'));render(page>1);
      nextPage=data.has_more&&Number.isInteger(data.next_page)&&data.next_page>page?data.next_page:null;more.hidden=!nextPage;
      status.textContent=contacts.length?`${contacts.length} contact${contacts.length>1?'s':''} affiché${contacts.length>1?'s':''}.`:(nextPage?'Aucun résultat sur cette page. Charge la suite ou précise la recherche.':'Aucun contact trouvé.');
    }catch(error){if(!overlay||seq!==sequence||error?.name==='AbortError')return;status.textContent=error?.message==='AUTH_REQUIRED'?'Connecte-toi pour consulter les contacts Ogust.':'Les contacts Ogust n’ont pas pu être chargés. Réessaie.';retryPage=page;retry.hidden=false}
    finally{if(overlay&&seq===sequence)list.setAttribute('aria-busy','false')}
  }
  function reset(debounce=false,clearSelected=false){abort();contacts=[];nextPage=1;render();more.hidden=true;retry.hidden=true;list.setAttribute('aria-busy','false');if(clearSelected){selected=null;renderSelected()}if(picker.hidden)return;if(debounce){status.textContent='Recherche…';timer=setTimeout(()=>load(1),280)}else load(1)}
  function open(){
    if(overlay){toggle.focus();return}
    overlay=document.createElement('div');overlay.id='contactsOverlay60';
    const dialog=document.createElement('section');dialog.className='contactsDialog60';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Contacts Ogust');
    const head=document.createElement('div');head.className='contactsHead60';const title=document.createElement('h2');title.textContent='Contacts Ogust';const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='contactsClose60';closeButton.textContent='×';closeButton.setAttribute('aria-label','Fermer les contacts');closeButton.addEventListener('click',close);head.append(title,closeButton);
    const filters=document.createElement('div');filters.className='contactsFilters60';
    function select(labelText,id,options){const field=document.createElement('div'),label=document.createElement('label'),input=document.createElement('select');label.textContent=labelText;label.htmlFor=id;input.id=id;for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;input.appendChild(option)}field.append(label,input);filters.appendChild(field);input.addEventListener('change',()=>reset(false,true));return input}
    companyInput=select('Société','contactsCompany60',COMPANIES.map(company=>[company,company]));kindInput=select('Catégorie','contactsKind60',Object.entries(KINDS));
    const current=typeof state!=='undefined'?state.company:'';companyInput.value=COMPANIES.includes(current)?current:'ACJ Services';
    searchInput=document.createElement('input');searchInput.id='contactsSearch60';searchInput.type='search';searchInput.placeholder='Nom, téléphone ou e-mail';searchInput.autocomplete='off';searchInput.maxLength=80;searchInput.setAttribute('aria-label','Rechercher un contact Ogust');searchInput.addEventListener('input',()=>reset(true));
    status=document.createElement('div');status.id='contactsStatus60';status.setAttribute('role','status');
    list=document.createElement('div');list.id='contactsList60';
    const foot=document.createElement('div');foot.className='contactsFoot60';more=document.createElement('button');more.type='button';more.className='btn';more.textContent='Charger la suite';more.hidden=true;more.addEventListener('click',()=>{if(nextPage)load(nextPage)});retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Réessayer';retry.hidden=true;retry.addEventListener('click',()=>load(retryPage));foot.append(more,retry);
    picker=document.createElement('div');picker.id='contactsPicker61';picker.hidden=true;picker.append(searchInput,status,list,foot);
    toggle=document.createElement('button');toggle.id='contactsToggle61';toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',picker.id);const label=document.createElement('span');label.textContent='Choisir un contact';toggle.append(label,icon('chevron'));toggle.addEventListener('click',()=>setPicker(picker.hidden,true));
    detail=document.createElement('div');detail.id='contactsSelected61';detail.hidden=true;
    hint=document.createElement('p');hint.id='contactsHint61';hint.textContent='Choisis un contact pour voir ses coordonnées.';
    dialog.append(head,filters,toggle,picker,hint,detail);overlay.appendChild(dialog);document.body.appendChild(overlay);overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!picker.hidden)setPicker(false,true);else close()}else if(event.key==='Tab'){const controls=Array.from(dialog.querySelectorAll('button,input,select,a[href]')).filter(node=>!node.disabled&&node.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}});
    toggle.setAttribute('aria-label','Choisir un contact');toggle.focus();
  }
  function init(){const menu=document.getElementById('appMenu57');if(!menu||document.getElementById('contactsLaunch60'))return;styles();const button=document.createElement('button');button.id='contactsLaunch60';button.type='button';button.className='appMenuItem57';button.textContent='Contacts Ogust';button.addEventListener('click',open);const version=document.getElementById('acjVersion');if(version?.parentElement===menu)version.insertAdjacentElement('beforebegin',button);else menu.appendChild(button)}
  window.acjContacts60={open,close};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
