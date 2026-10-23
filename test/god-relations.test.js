const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const start=source.indexOf('function godReceptacleReferences('),end=source.indexOf('function openAddGodDialog(',start);
const sandbox={Object,normalizeName:value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),receptacleEffects:item=>item.effects||[{attribute:item.attribute,targetType:item.targetType}]};
vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);

test('renomear divindade mantém afinidade e efeitos do receptáculo',()=>{
 const character={gods:{Artemis:40},receptacles:[{attribute:'Artemis',targetType:'god',effects:[{attribute:'Artemis',targetType:'god',bonus:5}]}]};
 assert.equal(sandbox.renameGodRelation(character,'Artemis','Ártemis'),true);
 assert.equal(character.gods['Ártemis'],40);assert.equal(Object.hasOwn(character.gods,'Artemis'),false);
 assert.equal(character.receptacles[0].attribute,'Ártemis');assert.equal(character.receptacles[0].effects[0].attribute,'Ártemis');
});

test('renomear não substitui outra divindade existente',()=>{
 const character={gods:{Ares:40,Artemis:25}};
 assert.throws(()=>sandbox.renameGodRelation(character,'Ares','Artemis'),/Já existe/);
 assert.equal(character.gods.Ares,40);assert.equal(character.gods.Artemis,25);
});

test('remover divindade não apaga um efeito vinculado por acidente',()=>{
 const character={gods:{Ares:40},receptacles:[{effects:[{attribute:'Ares',targetType:'god',bonus:5}]}]};
 assert.throws(()=>sandbox.removeGodRelation(character,'Ares'),/receptáculo/);
 assert.equal(character.gods.Ares,40);
});

test('remover divindade sem vínculos exclui apenas a relação',()=>{
 const character={gods:{Ares:40,Hestia:100},receptacles:[]};
 assert.equal(sandbox.removeGodRelation(character,'Ares'),true);
 assert.equal(Object.hasOwn(character.gods,'Ares'),false);assert.equal(character.gods.Hestia,100);
});
