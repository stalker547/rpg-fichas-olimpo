const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeAttributeHelp } = require('../attribute-help-migration');

test('imports missing attribute information without replacing online text or character data', () => {
  const settings = { attributeNames: ['Força', 'Destreza'], attributeHelp: { Destreza: 'Texto online' }, otherSetting: 7 };
  const local = { Força: 'Texto local de força', Destreza: 'Texto local de destreza' };
  const merged = mergeAttributeHelp(settings, local);
  assert.deepEqual(merged, { Força: 'Texto local de força', Destreza: 'Texto online' });
  assert.deepEqual(settings, { attributeNames: ['Força', 'Destreza'], attributeHelp: { Destreza: 'Texto online' }, otherSetting: 7 });
});
