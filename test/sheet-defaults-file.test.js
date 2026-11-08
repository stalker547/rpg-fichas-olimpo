const test=require('node:test');
const assert=require('node:assert/strict');
const {makeSheetDefaultsFile,normalizeSheetDefaults}=require('../sheet-defaults-file');

test('ficha padrão exportada pode ser importada sem carregar personagens',()=>{
 const exported=makeSheetDefaultsFile({attributes:10,newSkills:10,gods:{Afrodite:40,Hefestos:40,Nix:30}});
 assert.deepEqual(normalizeSheetDefaults(JSON.parse(JSON.stringify(exported))),{attributes:10,newSkills:10,gods:{Afrodite:40,Hefestos:40,Nix:30}});
 assert.deepEqual(Object.keys(exported).sort(),['attributes','format','gods','newSkills','version']);
});

test('importação rejeita formato incorreto e divindades repetidas',()=>{
 assert.throws(()=>normalizeSheetDefaults({format:'rpg-receptaculos',version:1,attributes:10,newSkills:10,gods:{}}),/inválido/);
 assert.throws(()=>normalizeSheetDefaults({format:'rpg-ficha-padrao',version:1,attributes:10,newSkills:10,gods:{Afrodite:40,afrodite:30}}),/repetidas/);
});
