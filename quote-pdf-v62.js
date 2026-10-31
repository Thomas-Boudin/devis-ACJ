// Builds a shareable, searchable PDF from the same quote markup as printing.
(function(){
  const clean=value=>String(value||'').replace(/[\u00a0\u202f]/g,' ').replace(/[\u2010-\u2015]/g,'-').replace(/\s+/g,' ').trim();
  let logo='';
  let loading=null;
  function load(){if(window.jspdf?.jsPDF&&window.acjPdfFonts62)return Promise.resolve();if(loading)return loading;const asset=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Le générateur PDF n’a pas pu être chargé. Réessaie.'))};document.head.appendChild(script)});loading=Promise.all([window.jspdf?.jsPDF?null:asset('./vendor/jspdf-4.2.1.umd.min.js?v=70'),window.acjPdfFonts62?null:asset('./vendor/acj-pdf-fonts-v62.js?v=70')]).catch(error=>{loading=null;throw error});return loading}
  const image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;canvas.getContext('2d').drawImage(image,0,0,192,192);logo=canvas.toDataURL('image/png')}catch{}};image.src='./icon-192.png';
  function create(markup,number){
    if(!window.jspdf?.jsPDF||!window.acjPdfFonts62)throw Error('PDF_UNAVAILABLE');
    const root=new DOMParser().parseFromString(markup,'text/html');
    const get=selector=>clean(root.querySelector(selector)?.textContent);
    if(!number||!root.querySelector('.printTable tbody tr'))throw Error('PDF_QUOTE_REQUIRED');
    const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
    for(const style of ['normal','bold']){const file=`ACJ-Sans-${style}.ttf`;doc.addFileToVFS(file,window.acjPdfFonts62[style]);doc.addFont(file,'ACJSans',style)}
    const company=get('.printCompanyName'),legal=get('.printFooter');let y=0;
    doc.setProperties({title:`Devis ${number}`,subject:`Devis ${company}`,creator:'Devis ACJ'});
    function text(value,x,at,size=10,bold=false,options={}){doc.setFont('ACJSans',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(28,48,65);doc.text(clean(value),x,at,options)}
    function wrap(value,width,size=10,bold=false){doc.setFont('ACJSans',bold?'bold':'normal');doc.setFontSize(size);return doc.splitTextToSize(clean(value),width)}
    function header(){
      if(logo){try{doc.addImage(logo,'PNG',14,13,20,20)}catch{}}
      const x=logo?38:14;wrap(company,100,15,true).forEach((line,index)=>text(line,x,20+index*6,15,true));
      text('DEVIS',196,19,20,true,{align:'right'});text(`N° ${number}`,196,26,10,true,{align:'right'});
      text(get('.printDate'),196,33,8,false,{align:'right'});
      text('Validité : 30 jours',196,38,8,false,{align:'right'});
      let subY=34;root.querySelectorAll('.printCompanySub').forEach(node=>{wrap(node.textContent,104,8).forEach(line=>{text(line,x,subY,8);subY+=4})});
      y=Math.max(45,subY+4);doc.setDrawColor(14,165,233);doc.setLineWidth(.8);doc.line(14,y-3,196,y-3);
    }
    function ensure(height){if(y+height>270){doc.addPage();header()}}
    function paragraph(value,size=9,bold=false,width=182){const parts=wrap(value,width,size,bold);for(const part of parts){ensure(5);text(part,14,y,size,bold);y+=4.5}y+=2}
    function tableHeader(){ensure(11);doc.setFillColor(235,244,249);doc.rect(14,y,182,9,'F');for(const [label,x,align] of [['Désignation',17,'left'],['Qté / unité',132,'right'],['PU TTC',163,'right'],['Total TTC',193,'right']])text(label,x,y+6,8,true,{align});y+=11}
    header();
    const parties=[...root.querySelectorAll('.printParty')].map(node=>({label:clean(node.querySelector('.printLabel')?.textContent),body:clean([...node.childNodes].filter(n=>!n.classList?.contains('printLabel')).map(n=>n.textContent).join(' '))}));
    const partyLines=parties.map(p=>wrap(p.body,80,9));const partyHeight=Math.max(20,...partyLines.map(lines=>lines.length*4.5+12));ensure(partyHeight+7);
    parties.slice(0,2).forEach((party,index)=>{const x=14+index*93;doc.setDrawColor(214,226,235);doc.setFillColor(248,251,253);doc.roundedRect(x,y,89,partyHeight,2,2,'FD');text(party.label,x+4,y+6,8,true);partyLines[index].forEach((line,i)=>text(line,x+4,y+12+i*4.5,9))});y+=partyHeight+9;
    tableHeader();
    for(const row of root.querySelectorAll('.printTable tbody tr')){
      const cells=[...row.children],title=wrap(cells[0]?.querySelector('.printLineTitle')?.textContent||cells[0]?.textContent,91,9,true),detail=wrap(cells[0]?.querySelector('.printLineDetail')?.textContent||'',91,8),height=Math.max(14,8+(title.length+detail.length)*4);
      if(y+height>270){doc.addPage();header();tableHeader()}
      let top=y+5;for(const line of title){text(line,17,top,9,true);top+=4}for(const line of detail){text(line,17,top,8);top+=4}
      text(`${clean(cells[1]?.textContent)} ${clean(cells[2]?.textContent)}`,132,y+5,9,false,{align:'right'});text(cells[3]?.textContent,163,y+5,9,false,{align:'right'});text(cells[4]?.textContent,193,y+5,9,true,{align:'right'});
      doc.setDrawColor(225,234,241);doc.setLineWidth(.2);doc.line(14,y+height,196,y+height);y+=height+2;
    }
    y+=5;paragraph(get('.printNotes'),8);
    const totals=[...root.querySelectorAll('.printTotalsRow')];ensure(totals.length*7+6);
    for(const row of totals){const big=row.classList.contains('grand');if(big){doc.setDrawColor(14,165,233);doc.line(117,y-2,196,y-2)}text(row.children[0]?.textContent,119,y+3,big?12:9,big);text(row.children[1]?.textContent,193,y+3,big?12:9,true,{align:'right'});y+=big?10:7}
    if(root.querySelector('.printSapCalc')){const rows=[...root.querySelectorAll('.printSapCalcRow')],note=get('.printSapCalcNote');const height=14+rows.reduce((sum,row)=>sum+wrap([...row.children].map(node=>node.textContent).join(' : '),182,9,row.classList.contains('after')).length*4.5+2,0)+wrap(note,182,7).length*4.5;ensure(height);y+=5;paragraph(get('.printSapCalcTitle'),10,true);for(const row of rows)paragraph([...row.children].map(node=>node.textContent).join(' : '),9,row.classList.contains('after'));paragraph(note,7)}
    ensure(36);y+=4;for(const [label,x] of [['Bon pour accord',14],['Signature du client',107]]){doc.setDrawColor(210,222,231);doc.roundedRect(x,y,89,26,2,2);text(label,x+4,y+6,9,true);if(x===14){text('Date : ____ / ____ / ______',x+4,y+13,8);text('Mention « Bon pour accord »',x+4,y+20,8)}}
    const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setDrawColor(214,226,235);doc.line(14,278,196,278);wrap(legal,182,7).slice(0,3).forEach((line,index)=>text(line,14,282+index*3,7));text(`${number} · ${page} / ${pages}`,196,294,7,false,{align:'right'})}
    return new File([doc.output('blob')],`Devis-${String(number).replace(/[^A-Za-z0-9._-]/g,'-').slice(0,80)}.pdf`,{type:'application/pdf'});
  }
  window.acjQuotePdf62={create,load};
})();
