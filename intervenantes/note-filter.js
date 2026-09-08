window.meaningfulOgustNote = function (value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const technical = new Set(['N', '0', 'FALSE', 'NON', 'NONE', 'NULL']);
  return technical.has(text.toUpperCase()) ? '' : text;
};
