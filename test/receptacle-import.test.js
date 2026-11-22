const test=require('node:test');
const assert=require('node:assert/strict');
const {parse,merge,exportCatalog}=require('../src/receptacle-import.js');

test('importação acrescenta modelos sem substituir os existentes',()=>{
 const file=JSON.stringify({format:'rpg-receptaculos',version:1,folders:[{category:'Divino',name:'Afinidade',models:[{name:'Amuleto de Nix',effects:[{type:'god',target:'Nix',bonus:10}]},{name:'Amuleto de Hades',effects:[{type:'god',target:'Hades',bonus:10}]}]}]});
 const source={folders:[{id:'old',parent:'Divino',name:'Afinidade'}],items:[{id:'old-item',folderId:'old',name:'Amuleto de Nix',effects:[{attribute:'Nix',targetType:'god',bonus:8}]}]};
 let id=0;const result=merge(source,parse(file),[],()=>`new-${++id}`);
 assert.equal(result.addedFolders,0);assert.equal(result.addedModels,1);assert.equal(result.skippedModels,1);
 assert.equal(result.catalog.items[0].effects[0].bonus,8);
 assert.equal(result.catalog.items[1].name,'Amuleto de Hades');
 assert.equal(source.items.length,1);
});

test('importação rejeita bônus e tipo de efeito inválidos',()=>{
 const file=JSON.stringify({format:'rpg-receptaculos',version:1,folders:[{category:'Raro',name:'Teste',models:[{name:'Ruim',effects:[{type:'attribute',target:'Força',bonus:'infinito'}]}]}]});
 assert.throws(()=>parse(file),/Efeito inválido/);
});

test('catálogo exportado no local pode ser importado sem apagar modelos online',()=>{
 const file=exportCatalog([{id:'rarity-5',title:'Sem nome de deus',parent:'Divino',items:[{name:'Destreza',effects:[{targetType:'attribute',attribute:'Destreza',bonus:5}]}]}]);
 const folders=parse(JSON.stringify(file));let id=0;
 const result=merge({folders:[],items:[{id:'old',folderId:'other',name:'Modelo antigo',effects:[]}]},folders,[],()=>`id-${++id}`);
 assert.equal(result.addedFolders,1);assert.equal(result.addedModels,1);
 assert.equal(result.catalog.items[0].name,'Modelo antigo');
 assert.equal(result.catalog.items[1].effects[0].bonus,5);
});
