function mergeAttributeHelp(settings, localHelp) {
  const existing = settings?.attributeHelp && typeof settings.attributeHelp === 'object' && !Array.isArray(settings.attributeHelp) ? settings.attributeHelp : {};
  const names = Array.isArray(settings?.attributeNames) && settings.attributeNames.length ? settings.attributeNames : Object.keys(localHelp || {});
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const localByName = new Map(Object.entries(localHelp || {}).map(([name, text]) => [normalize(name), text]));
  const merged = { ...existing };
  for (const name of names) {
    if (String(existing[name] || '').trim()) continue;
    const text = localByName.get(normalize(name));
    if (typeof text === 'string' && text.trim() && text.length <= 20000) merged[name] = text.trim();
  }
  return merged;
}

module.exports = { mergeAttributeHelp };
