window.meaningfulOgustNote = function (value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const technical = new Set(['N', '0', 'FALSE', 'NON', 'NONE', 'NULL']);
  return technical.has(text.toUpperCase()) ? '' : text;
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('script[data-acj-pointage-local]')) return;
  const script = document.createElement('script');
  script.src = './pointage-local.js';
  script.dataset.acjPointageLocal = '1';
  document.body.appendChild(script);
});
