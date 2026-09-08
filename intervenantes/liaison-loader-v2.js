(() => {
  function boot() {
    const items = [...document.querySelectorAll('.bottomNav .navItem')];
    if (items[2]) items[2].disabled = false;

    const existing = [...document.scripts].some((script) => /(?:^|\/)liaison-local\.js(?:$|\?)/.test(script.src));
    if (existing) return;

    const script = document.createElement('script');
    script.src = './liaison-local.js?v=20260908-2';
    script.dataset.acjLiaisonLoader = '2';
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
