// Devis ACJ v28.1 — fournitures / matériel en quantité (unité Ogust Q), pas en forfait.
(function(){
  if(window.__acjCostsV281||typeof window.addQuickCost!=='function')return;
  const original=window.addQuickCost;
  window.addQuickCost=function(type){
    const before=state.lines.length;
    const out=original.apply(this,arguments);
    if(type==='fournitures'&&state.lines.length>before){
      const line=state.lines[state.lines.length-1];
      if(line){
        line.unit='quantité';
        line.qty=Number(line.qty)>0?Number(line.qty):1;
        line.meta='Fournitures / matériel';
        if(typeof renderQuoteLines==='function')renderQuoteLines();
      }
    }
    return out;
  };
  window.__acjCostsV281=true;
})();
