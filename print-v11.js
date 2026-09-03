// Impression PDF v11 — impression depuis un DOM temporaire blanc, identique pour tous les métiers.
(function(){
  const PRINT_CSS = `
    @page{size:A4;margin:8mm 10mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0!important;padding:0!important;background:#fff!important;color:#172033!important;font:11px/1.35 Arial,sans-serif!important}
    .printWrap{background:#fff!important;color:#172033!important;width:100%;margin:0;padding:0;overflow:visible}
    .printHeader{display:grid;grid-template-columns:1fr 145px;gap:18px;align-items:start;padding-bottom:9px;border-bottom:3px solid #0ea5e9;break-inside:avoid;page-break-inside:avoid}
    .printBrand{display:flex;gap:11px;align-items:flex-start}.printLogo{width:88px;height:auto;object-fit:contain}.printCompanyName{font-size:16px;font-weight:800;margin:1px 0 3px}.printCompanySub{font-size:10px;color:#64748b}.printDoc{text-align:right}.printTitle{font-size:27px;font-weight:900;letter-spacing:.05em;color:#0f172a;margin:0 0 5px}.printDocNo{font-size:12px;font-weight:800}.printDate{font-size:10px;color:#64748b;margin-top:3px}
    .printPartyGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;break-inside:avoid;page-break-inside:avoid}.printParty{border:1px solid #dbe3ee;border-radius:10px;padding:9px 11px;min-height:60px;background:#f8fafc}.printLabel{font-size:8.5px;text-transform:uppercase;letter-spacing:.09em;color:#64748b;font-weight:800;margin-bottom:4px}.printParty strong{font-size:12px;color:#0f172a}
    .printSectionTitle{font-size:12px;font-weight:900;margin:11px 0 5px;color:#0f172a}.printTable{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dbe3ee;border-radius:10px;overflow:hidden}.printTable th{background:#eef4f8;color:#334155;font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;padding:6px;text-align:left;border-bottom:1px solid #dbe3ee}.printTable td{padding:7px 6px;border-bottom:1px solid #e7edf4;vertical-align:top;font-size:10px}.printTable tr:last-child td{border-bottom:0}.printTable .right{text-align:right;white-space:nowrap}.printLineTitle{font-weight:800;font-size:11px;color:#0f172a}.printLineDetail{font-size:9px;color:#64748b;margin-top:2px}
    .printAfterTable{display:grid;grid-template-columns:1fr 220px;gap:11px;align-items:start;margin-top:8px;break-inside:avoid;page-break-inside:avoid}.printNotes{border-left:3px solid #cbd5e1;padding:5px 0 5px 8px;color:#475569;font-size:9.5px;min-height:0}.printTotals{border:1px solid #dbe3ee;border-radius:10px;padding:7px 10px;background:#fff}.printTotalsRow{display:flex;justify-content:space-between;gap:12px;padding:3px 0;color:#475569}.printTotalsRow.vat{font-size:9px}.printTotalsRow.grand{margin-top:3px;padding-top:6px;border-top:2px solid #0f172a;font-size:16px;font-weight:900;color:#0f172a}
    .printSapCalc{margin-top:8px;border:1px solid #93c5fd;background:#eff6ff!important;border-radius:10px;padding:7px 10px;color:#1e3a8a;break-inside:avoid;page-break-inside:avoid}.printSapCalcTitle{font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:900;margin-bottom:3px}.printSapCalcRow{display:flex;justify-content:space-between;gap:14px;padding:2px 0;font-size:9.5px}.printSapCalcRow.credit{font-weight:800;color:#166534}.printSapCalcRow.after{margin-top:3px;padding-top:5px;border-top:1px solid #93c5fd;font-size:13.5px;font-weight:900;color:#0f172a}.printSapCalcNote{font-size:7.7px;line-height:1.25;color:#475569;margin-top:4px}
    .printAgreement{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:9px;padding-top:7px;border-top:1px solid #dbe3ee;break-inside:avoid;page-break-inside:avoid}.printAgreementBox{min-height:52px;border:1px solid #dbe3ee;border-radius:9px;padding:7px 9px}.printAgreementTitle{font-size:9.5px;font-weight:800;color:#334155;margin-bottom:5px}.printAgreementHint{font-size:8.5px;color:#94a3b8}.printFooter{position:static!important;margin-top:8px;border-top:1px solid #dbe3ee;padding-top:6px;font-size:7.8px;color:#64748b;line-height:1.35;break-inside:avoid;page-break-inside:avoid}.printFooter strong{color:#334155}
    #sapCreditScreen,.sapScreenBox,.app,.top,main>section{display:none!important}
  `;

  function waitForImages(root){
    const images=Array.from(root.querySelectorAll('img'));
    if(!images.length) return Promise.resolve();
    return Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve}))).then(()=>undefined);
  }

  window.printPDF=function(){
    const printable=buildPrintHTML();
    const body=document.body;
    const head=document.head;
    const savedNodes=document.createDocumentFragment();
    while(body.firstChild) savedNodes.appendChild(body.firstChild);

    const oldHtmlStyle=document.documentElement.getAttribute('style');
    const oldBodyStyle=body.getAttribute('style');
    const oldTitle=document.title;

    const style=document.createElement('style');
    style.id='acjPrintStyleV11';
    style.textContent=PRINT_CSS;
    head.appendChild(style);

    const stage=document.createElement('div');
    stage.id='acjPrintStageV11';
    stage.innerHTML=printable;
    body.appendChild(stage);
    document.documentElement.style.background='#fff';
    body.style.background='#fff';
    body.style.color='#172033';
    document.title=`Devis ${state.number||''}`;

    let restored=false;
    const restore=()=>{
      if(restored) return;
      restored=true;
      while(body.firstChild) body.removeChild(body.firstChild);
      body.appendChild(savedNodes);
      style.remove();
      if(oldHtmlStyle===null) document.documentElement.removeAttribute('style'); else document.documentElement.setAttribute('style',oldHtmlStyle);
      if(oldBodyStyle===null) body.removeAttribute('style'); else body.setAttribute('style',oldBodyStyle);
      document.title=oldTitle;
      window.removeEventListener('afterprint',restore);
    };

    window.addEventListener('afterprint',restore,{once:true});
    waitForImages(stage).then(()=>new Promise(r=>setTimeout(r,120))).then(()=>{
      window.focus();
      window.print();
      setTimeout(restore,1500);
    }).catch(()=>{
      window.focus();
      window.print();
      setTimeout(restore,1500);
    });
  };
})();
