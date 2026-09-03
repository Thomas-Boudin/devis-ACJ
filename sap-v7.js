// PDF / affichage SAP v8 — crédit d'impôt sur la main-d'œuvre éligible et impression propre.
(function(){
  function sapEligibleLabor(p){
    const company=COMPANY_PRINT[p.societe];
    if(!company?.sap) return 0;
    return p.lignes.reduce((sum,l)=>{
      const eligible=l.type==='service' && ['jardin','menage','bricol'].includes(l.activite);
      return sum + (eligible ? num(l.total_ttc) : 0);
    },0);
  }

  function sapEstimate(p){
    const labor=sapEligibleLabor(p);
    if(labor<=0) return null;
    const credit=labor*.50;
    const excluded=Math.max(0,num(p.totaux.ttc)-labor);
    return {labor,credit,excluded,after:Math.max(0,num(p.totaux.ttc)-credit)};
  }

  function addSapStyles(){
    if(document.getElementById('sap-v7-style')) return;
    const style=document.createElement('style');
    style.id='sap-v7-style';
    style.textContent=`
      .sapScreenBox{margin-top:12px;border:1px solid #164e63;background:#082332;border-radius:14px;padding:13px;color:#cffafe}
      .sapScreenBox .sapScreenTitle{font-size:12px;font-weight:900;margin-bottom:8px;color:#e0f2fe}
      .sapScreenRow{display:flex;justify-content:space-between;gap:12px;padding:4px 0;font-size:12px}
      .sapScreenRow.credit{color:#86efac;font-weight:800}
      .sapScreenRow.after{font-size:16px;font-weight:950;border-top:1px solid #155e75;margin-top:6px;padding-top:9px;color:#fff}
      .sapScreenNote{font-size:10px;color:#9fdcf6;line-height:1.4;margin-top:7px}
      @media print{
        @page{size:A4;margin:8mm 10mm}
        html,body,#printArea,.printWrap{background:#fff!important}
        #sapCreditScreen,.sapScreenBox{display:none!important}
        .printWrap{min-height:0!important;padding-bottom:0!important;font-size:11px!important;line-height:1.35!important;overflow:visible!important}
        .printHeader{padding-bottom:10px!important}
        .printLogo{width:90px!important}
        .printTitle{font-size:27px!important}
        .printPartyGrid{margin-top:10px!important}
        .printParty{min-height:64px!important;padding:10px 12px!important}
        .printSectionTitle{margin:12px 0 6px!important}
        .printTable th{padding:7px 7px!important}
        .printTable td{padding:8px 7px!important}
        .printAfterTable{margin-top:9px!important;gap:12px!important;grid-template-columns:1fr 225px!important}
        .printNotes{min-height:0!important;padding:6px 0 6px 9px!important}
        .printTotals{padding:8px 11px!important}
        .printTotalsRow.grand{font-size:16px!important;padding-top:7px!important;margin-top:4px!important}
        .printSapCalc{margin-top:9px;border:1px solid #93c5fd;background:#eff6ff!important;border-radius:10px;padding:8px 11px;color:#1e3a8a;break-inside:avoid;page-break-inside:avoid}
        .printSapCalcTitle{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:900;margin-bottom:4px}
        .printSapCalcRow{display:flex;justify-content:space-between;gap:16px;padding:2px 0;font-size:10px}
        .printSapCalcRow.credit{font-weight:800;color:#166534}
        .printSapCalcRow.after{margin-top:4px;padding-top:6px;border-top:1px solid #93c5fd;font-size:14px;font-weight:900;color:#0f172a}
        .printSapCalcNote{font-size:8px;line-height:1.3;color:#475569;margin-top:5px}
        .printAgreement{margin-top:11px!important;padding-top:9px!important;gap:16px!important;break-inside:avoid;page-break-inside:avoid}
        .printAgreementBox{min-height:58px!important;padding:8px 10px!important}
        .printFooter{position:static!important;left:auto!important;right:auto!important;bottom:auto!important;margin-top:10px!important;padding-top:7px!important;font-size:8.5px!important;break-inside:avoid;page-break-inside:avoid}
      }
    `;
    document.head.appendChild(style);
  }

  function screenSapBox(){
    const p=quotePayload();
    const s=sapEstimate(p);
    const step4=document.querySelector('section[data-step="4"]');
    if(!step4) return;
    let box=document.getElementById('sapCreditScreen');
    if(!s){ if(box) box.remove(); return; }
    if(!box){
      box=document.createElement('div');
      box.id='sapCreditScreen';
      box.className='sapScreenBox';
      const prestationCard=step4.querySelectorAll('.card')[1];
      prestationCard?.appendChild(box);
    }
    box.innerHTML=`
      <div class="sapScreenTitle">Estimation crédit d’impôt</div>
      <div class="sapScreenRow"><span>Main-d’œuvre éligible</span><strong>${money(s.labor)}</strong></div>
      ${s.excluded>0?`<div class="sapScreenRow"><span>Fournitures / frais hors main-d’œuvre</span><strong>${money(s.excluded)}</strong></div>`:''}
      <div class="sapScreenRow credit"><span>Crédit d’impôt estimé (50 %)</span><strong>− ${money(s.credit)}</strong></div>
      <div class="sapScreenRow after"><span>Coût estimé après crédit</span><strong>${money(s.after)}</strong></div>
      <div class="sapScreenNote">Le crédit d’impôt est calculé uniquement sur les lignes de main-d’œuvre éligible. Fournitures et autres frais sont exclus. Estimation sous réserve des conditions et plafonds légaux.</div>`;
  }

  const originalRenderReview=renderReview;
  renderReview=function(){
    originalRenderReview();
    screenSapBox();
  };

  buildPrintHTML=function(){
    const p=quotePayload();
    const date=new Date().toLocaleDateString('fr-FR');
    const company=COMPANY_PRINT[p.societe]||{subtitle:'',sap:false};
    const vatRows=vatBreakdown(state.lines).map(v=>`<div class="printTotalsRow vat"><span>TVA ${v.rate.toLocaleString('fr-FR')} %</span><span>${money(v.amount)}</span></div>`).join('');
    const s=sapEstimate(p);
    const sapCalc=s?`<div class="printSapCalc">
      <div class="printSapCalcTitle">Crédit d’impôt — estimation</div>
      <div class="printSapCalcRow"><span>Main-d’œuvre éligible</span><strong>${money(s.labor)}</strong></div>
      ${s.excluded>0?`<div class="printSapCalcRow"><span>Fournitures / frais hors main-d’œuvre</span><strong>${money(s.excluded)}</strong></div>`:''}
      <div class="printSapCalcRow credit"><span>Crédit d’impôt estimé (50 % de la main-d’œuvre)</span><strong>− ${money(s.credit)}</strong></div>
      <div class="printSapCalcRow after"><span>Coût estimé après crédit d’impôt</span><strong>${money(s.after)}</strong></div>
      <div class="printSapCalcNote">Cette estimation ne modifie pas le montant TTC facturé, sauf utilisation d’un dispositif d’avance immédiate. Elle porte uniquement sur les prestations de main-d’œuvre éligibles ; fournitures, consommables et autres frais hors main-d’œuvre sont exclus. Sous réserve des conditions et plafonds légaux applicables.</div>
    </div>`:'';
    const note=p.notes?`<div class="printNotes"><strong>Note :</strong><br>${esc(p.notes)}</div>`:`<div class="printNotes">Les conditions particulières de réalisation peuvent être précisées avant acceptation du devis.</div>`;
    const rows=p.lignes.map(l=>`<tr><td><div class="printLineTitle">${esc(l.designation)}</div>${l.detail?`<div class="printLineDetail">${esc(l.detail)}</div>`:''}</td><td>${l.quantite}</td><td>${esc(l.unite)}</td><td class="right">${money(l.prix_unitaire_ttc)}</td><td class="right"><strong>${money(l.total_ttc)}</strong></td></tr>`).join('');
    return `<div class="printWrap">
      <div class="printHeader">
        <div class="printBrand"><img class="printLogo" src="icon-512.png" alt="${esc(p.societe)}"><div><div class="printCompanyName">${esc(p.societe)}</div><div class="printCompanySub">${esc(company.subtitle||'')}</div><div class="printCompanySub">Services à domicile et prestations d’entretien</div></div></div>
        <div class="printDoc"><div class="printTitle">DEVIS</div><div class="printDocNo">N° ${esc(p.numero_devis)}</div><div class="printDate">Émis le ${esc(date)}</div><div class="printDate">Validité : 30 jours</div></div>
      </div>
      <div class="printPartyGrid">
        <div class="printParty"><div class="printLabel">Client</div><strong>${esc(p.client.nom||'—')}</strong><br>${esc(p.client.telephone||'')}</div>
        <div class="printParty"><div class="printLabel">Adresse d’intervention</div><strong>${esc(p.client.adresse||'—')}</strong></div>
      </div>
      <div class="printSectionTitle">Détail des prestations</div>
      <table class="printTable"><thead><tr><th>Désignation</th><th>Qté</th><th>Unité</th><th class="right">PU TTC</th><th class="right">Total TTC</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="printAfterTable"><div>${note}</div><div class="printTotals"><div class="printTotalsRow"><span>Total HT</span><strong>${money(p.totaux.ht)}</strong></div>${vatRows}<div class="printTotalsRow grand"><span>Total TTC</span><span>${money(p.totaux.ttc)}</span></div></div></div>
      ${sapCalc}
      <div class="printAgreement"><div class="printAgreementBox"><div class="printAgreementTitle">Bon pour accord</div><div class="printAgreementHint">Date : ____ / ____ / ______<br><br>Mention « Bon pour accord »</div></div><div class="printAgreementBox"><div class="printAgreementTitle">Signature du client</div></div></div>
      <div class="printFooter"><strong>${esc(p.societe)}</strong> · Devis valable 30 jours. Paiement à l’issue de la prestation sauf accord contraire.<br>L’acceptation du devis vaut accord sur les prestations et montants indiqués.</div>
    </div>`;
  };

  addSapStyles();
  if(state.step===4) screenSapBox();
})();
