(() => {
  function enableLiaison() {
    const items = [...document.querySelectorAll('.bottomNav .navItem')];
    if (items[2]) items[2].disabled = false;
    const existing = [...document.scripts].some((script) => /(?:^|\/)liaison-local\.js(?:$|\?)/.test(script.src));
    if (!existing) {
      const script = document.createElement('script');
      script.src = './liaison-local.js?v=20260908-3';
      document.body.appendChild(script);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enableLiaison, { once: true });
  else enableLiaison();
})();
