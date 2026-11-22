const test=require('node:test');
const assert=require('node:assert/strict');
const {playerMaySaveReceptacles}=require('../server/src/receptacle-access.cjs');

const model={name:'Destreza',effects:[{attribute:'Destreza',targetType:'attribute',bonus:5}]};
const catalog={builtinGroups:[{id:'rarity-5',items:[model]}],items:[]};

test('jogador pode acrescentar um modelo salvo no catálogo',()=>{
 const item={id:'item-1',name:'Receptáculo de Destreza',slot:1,effects:model.effects,equipped:false};
 assert.equal(playerMaySaveReceptacles([], [item],catalog),true);
});

test('jogador não pode editar, apagar ou criar um modelo manual',()=>{
 const item={id:'item-1',name:'Receptáculo de Destreza',slot:1,effects:model.effects,equipped:false};
 assert.equal(playerMaySaveReceptacles([item],[{...item,effects:[{...model.effects[0],bonus:50}]}],catalog),false);
 assert.equal(playerMaySaveReceptacles([item],[],catalog),false);
 assert.equal(playerMaySaveReceptacles([], [{...item,name:'Inventado'}],catalog),false);
});

test('jogador pode equipar, desequipar e trocar a posição do receptáculo',()=>{
 const item={id:'item-1',name:'Receptáculo de Destreza',slot:1,effects:model.effects,equipped:false};
 assert.equal(playerMaySaveReceptacles([item],[{...item,equipped:true,slot:3}],catalog),true);
 assert.equal(playerMaySaveReceptacles([{...item,equipped:true,slot:3}],[item],catalog),true);
});

test('jogador pode consumir um receptáculo equipado de afinidade',()=>{
 const item={id:'god-1',name:'Dionísio',equipped:true,effects:[{attribute:'Dionísio',targetType:'god',bonus:10}]};
 const other={id:'other-1',name:'Outro',equipped:false,effects:model.effects};
 assert.equal(playerMaySaveReceptacles([item,other],[other],catalog,{consume:true}),true);
 assert.equal(playerMaySaveReceptacles([item,other],[other],catalog),false);
});

test('jogador não pode consumir item guardado nem apagar dois itens',()=>{
 const item={id:'god-1',name:'Dionísio',equipped:false,effects:[{attribute:'Dionísio',targetType:'god',bonus:10}]};
 const other={id:'other-1',name:'Outro',equipped:true,effects:model.effects};
 assert.equal(playerMaySaveReceptacles([item],[],catalog,{consume:true}),false);
 assert.equal(playerMaySaveReceptacles([{...item,equipped:true},other],[],catalog,{consume:true}),false);
});
