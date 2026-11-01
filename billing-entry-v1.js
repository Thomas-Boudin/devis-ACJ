// Entry point into the read-only billing workspace; uses the existing ACJ session.
(function () {
  function install() {
    const header = document.querySelector('.top');
    if (!header || document.getElementById('billing-entry-v1')) return;
    const nav = document.createElement('div'); nav.id = 'billing-entry-v1';
    nav.style.cssText = 'display:flex;justify-content:flex-end;margin-top:10px';
    const link = document.createElement('a'); link.href = './facturation/'; link.textContent = 'Facturation';
    link.style.cssText = 'color:#9fdcf6;text-decoration:none;font:700 12px system-ui;padding:8px 11px;border:1px solid #30435f;border-radius:10px;min-height:36px';
    nav.append(link); header.append(nav);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
