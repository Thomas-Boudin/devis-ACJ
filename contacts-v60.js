// Read-only Ogust directory. Opening or filtering it never changes the quote.
(function(){
  const ENDPOINT='https://acj-ogust-proxy.vercel.app/api/ogust-customer';
  const COMPANIES=['ACJ Services','ACJ Services Lens','Jet Services'];
  const KINDS={customers:'Clients',employees:'Intervenants',contacts:'Interlocuteurs'};
  let overlay=null,companyInput,kindInput,searchInput,list,status,more,retry,controller,timer,sequence=0,nextPage=1,retryPage=1,contacts=[];
  const text=value=>typeof value==='string'||typeof value==='number'?String(value):'';
  function styles(){
    const style=document.createElement('style');style.id='contacts-style60';style.textContent=`
      #contactsOverlay60{position:fixed;inset:0;z-index:1600;background:rgba(15,35,54,.35);display:flex;align-items:center;justify-content:center;padding:12px}
      .contactsDialog60{width:min(680px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;overflow:hidden;background:#f7fafc;border:1px solid #d7e3ed;border-radius:20px;box-shadow:0 20px 60px rgba(20,45,68,.2);padding:16px;color:#183149}
      .contactsHead60{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.contactsHead60 h2{font-size:21px;margin:0}.contactsClose60{width:44px;height:44px;flex-shrink:0;border:1px solid #d7e3ed;border-radius:12px;background:#fff;color:#466079;font-size:22px}
      .contactsFilters60{display:grid;grid-template-columns:1.35fr 1fr;gap:9px;margin-bottom:10px}.contactsFilters60 label{font-size:11px;margin:0 0 5px}.contactsFilters60 select{padding:10px;font-size:12px;min-height:44px!important;width:100%}
      #contactsSearch60{width:100%;font-size:16px;margin-bottom:10px;min-height:48px!important}#contactsStatus60{font-size:12px;line-height:1.45;color:#647b90;margin:0 0 10px}
      #contactsList60{overflow:auto;overscroll-behavior:contain;min-height:0;display:grid;gap:10px;padding:2px 2px 5px}
      .contactCard60{border:1px solid #dce6ee;border-radius:15px;background:#fff;padding:13px;overflow-wrap:anywhere}.contactCard60 h3{font-size:15px;margin:0 0 9px;color:#183149}.contactCoordinates60{display:grid;gap:8px;font-size:13px;line-height:1.45}.contactCoordinates60 a{color:#0b6fae;text-decoration:none;min-height:32px;display:flex;align-items:center}.contactAddress60{color:#526d83;white-space:pre-line}.contactEmpty60{font-size:12px;color:#718197}
      .contactCopy60{margin-top:10px;min-height:38px;border:1px solid #d5e0e9;border-radius:10px;background:#f8fbfd;color:#315069;font-size:11px;font-weight:750;padding:8px 11px}.contactsFoot60{display:flex;gap:8px;padding-top:10px}.contactsFoot60 .btn{width:100%;min-height:44px!important;font-size:12px!important}.contactsFoot60 [hidden]{display:none!important}
      #contactsOverlay60 button:focus-visible,#contactsOverlay60 a:focus-visible{outline:2px solid #0b78c9;outline-offset:2px}
      @media(max-width:420px){#contactsOverlay60{padding:8px}.contactsDialog60{padding:13px;max-height:calc(100dvh - 16px);border-radius:18px}.contactsFilters60{grid-template-columns:1fr 1fr;gap:7px}}
      @media print{#contactsOverlay60{display:none!important}}
    `;document.head.appendChild(style);
  }
  function abort(){clearTimeout(timer);controller?.abort();controller=null;sequence++}
  function close(){abort();overlay?.remove();overlay=null;contacts=[];document.getElementById('appMenuToggle57')?.focus()}
  function coordinate(host,label,value,href){if(!value)return;const row=document.createElement(href?'a':'div');row.textContent=`${label} : ${value}`;if(href)row.href=href;host.appendChild(row)}
  function phoneLink(value){const number=text(value).replace(/[^+\d]/g,'');return /^\+?\d{6,15}$/.test(number)?`tel:${number}`:''}
  function render(){
    list.replaceChildren();
    for(const contact of contacts){
      const card=document.createElement('article');card.className='contactCard60';
      const heading=document.createElement('h3');heading.textContent=text(contact.label)||'Contact sans nom';
      const coordinates=document.createElement('div');coordinates.className='contactCoordinates60';
      const seenPhones=new Set();for(const [key,label] of [['mobile','Mobile'],['landline','Fixe'],['work_phone','Professionnel']]){const value=text(contact[key]);if(value&&!seenPhones.has(value)){seenPhones.add(value);coordinate(coordinates,label,value,phoneLink(value))}}
      const email=text(contact.email);coordinate(coordinates,'E-mail',email,/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(email)?`mailto:${encodeURIComponent(email)}`:'');
      if(contact.address){const address=document.createElement('div');address.className='contactAddress60';address.textContent=`Adresse : ${text(contact.address)}`;coordinates.appendChild(address)}
      card.append(heading,coordinates);
      if(!coordinates.children.length){const empty=document.createElement('div');empty.className='contactEmpty60';empty.textContent='Coordonnées non renseignées dans Ogust.';card.appendChild(empty)}
      else{const copy=document.createElement('button');copy.type='button';copy.className='contactCopy60';copy.textContent='Copier les coordonnées';copy.setAttribute('aria-label',`Copier les coordonnées de ${text(contact.label)}`);copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText([text(contact.label),...Array.from(coordinates.children,node=>node.textContent)].join('\n'));copy.textContent='Coordonnées copiées'}catch{copy.textContent='Copie indisponible'}});card.appendChild(copy)}
      list.appendChild(card);
    }
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
      contacts.sort((a,b)=>text(a.label).localeCompare(text(b.label),'fr'));render();
      nextPage=data.has_more&&Number.isInteger(data.next_page)&&data.next_page>page?data.next_page:null;more.hidden=!nextPage;
      status.textContent=contacts.length?`${contacts.length} contact${contacts.length>1?'s':''} affiché${contacts.length>1?'s':''}.`:(nextPage?'Aucun résultat sur cette page. Charge la suite ou précise la recherche.':'Aucun contact trouvé.');
    }catch(error){if(!overlay||seq!==sequence||error?.name==='AbortError')return;status.textContent=error?.message==='AUTH_REQUIRED'?'Connecte-toi pour consulter les contacts Ogust.':'Les contacts Ogust n’ont pas pu être chargés. Réessaie.';retryPage=page;retry.hidden=false}
    finally{if(overlay&&seq===sequence)list.setAttribute('aria-busy','false')}
  }
  function reset(debounce=false){abort();contacts=[];render();more.hidden=true;retry.hidden=true;list.setAttribute('aria-busy','false');if(debounce){status.textContent='Recherche…';timer=setTimeout(()=>load(1),280)}else load(1)}
  function open(){
    if(overlay){searchInput.focus();return}
    overlay=document.createElement('div');overlay.id='contactsOverlay60';
    const dialog=document.createElement('section');dialog.className='contactsDialog60';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Contacts Ogust');
    const head=document.createElement('div');head.className='contactsHead60';const title=document.createElement('h2');title.textContent='Contacts Ogust';const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='contactsClose60';closeButton.textContent='×';closeButton.setAttribute('aria-label','Fermer les contacts');closeButton.addEventListener('click',close);head.append(title,closeButton);
    const filters=document.createElement('div');filters.className='contactsFilters60';
    function select(labelText,id,options){const field=document.createElement('div'),label=document.createElement('label'),input=document.createElement('select');label.textContent=labelText;label.htmlFor=id;input.id=id;for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;input.appendChild(option)}field.append(label,input);filters.appendChild(field);input.addEventListener('change',()=>reset());return input}
    companyInput=select('Société','contactsCompany60',COMPANIES.map(company=>[company,company]));kindInput=select('Contacts','contactsKind60',Object.entries(KINDS));
    const current=typeof state!=='undefined'?state.company:'';companyInput.value=COMPANIES.includes(current)?current:'ACJ Services';
    searchInput=document.createElement('input');searchInput.id='contactsSearch60';searchInput.type='search';searchInput.placeholder='Nom, téléphone ou e-mail';searchInput.autocomplete='off';searchInput.maxLength=80;searchInput.setAttribute('aria-label','Rechercher un contact Ogust');searchInput.addEventListener('input',()=>reset(true));
    status=document.createElement('div');status.id='contactsStatus60';status.setAttribute('role','status');
    list=document.createElement('div');list.id='contactsList60';
    const foot=document.createElement('div');foot.className='contactsFoot60';more=document.createElement('button');more.type='button';more.className='btn';more.textContent='Charger la suite';more.hidden=true;more.addEventListener('click',()=>{if(nextPage)load(nextPage)});retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Réessayer';retry.hidden=true;retry.addEventListener('click',()=>load(retryPage));foot.append(more,retry);
    dialog.append(head,filters,searchInput,status,list,foot);overlay.appendChild(dialog);document.body.appendChild(overlay);overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}else if(event.key==='Tab'){const controls=Array.from(dialog.querySelectorAll('button,input,select,a[href]')).filter(node=>!node.disabled&&node.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}});
    searchInput.focus();load(1);
  }
  function init(){const menu=document.getElementById('appMenu57');if(!menu||document.getElementById('contactsLaunch60'))return;styles();const button=document.createElement('button');button.id='contactsLaunch60';button.type='button';button.className='appMenuItem57';button.textContent='Contacts Ogust';button.addEventListener('click',open);const version=document.getElementById('acjVersion');if(version?.parentElement===menu)version.insertAdjacentElement('beforebegin',button);else menu.appendChild(button)}
  window.acjContacts60={open,close};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
