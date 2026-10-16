const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('dados iniciais possuem Silas e Thales válidos', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'initial-data.json'), 'utf8'));
  assert.ok(data.characters.some(c => c.name === 'Silas'));
  assert.ok(data.characters.some(c => c.name === 'Thales'));
  for (const character of data.characters) {
    assert.ok(character.id && character.name);
    assert.ok(Array.isArray(character.abilities));
    assert.ok(Array.isArray(character.history));
  }
});
