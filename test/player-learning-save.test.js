const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const server=fs.readFileSync(path.join(__dirname,'../server/src/server.js'),'utf8');
const source=server.slice(server.indexOf('function protectedPlayerChange('),server.indexOf('function scoreChanges('));
const sandbox={
 same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
 get:(object,key)=>key.split('.').reduce((value,part)=>value?.[part],object),
 consumedEffectBonus:()=>0,
 RpgRules:{capacities:()=>({})}
};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const check=(before,after)=>sandbox.protectedPlayerChange({pointPools:{},skills:[],quests:[],gods:{},...before},{pointPools:{},skills:[],quests:[],gods:{},...after});

test('jogador pode concluir um aprendizado e manter outro sem alterar a configuração',()=>{
 const before={learning:[{id:'a',name:'Controle',current:9,goal:10},{id:'b',name:'Audição',current:3,goal:10}]};
 const after={learning:[{id:'b',name:'Audição',current:3,goal:10}],skills:[{id:'new',name:'Controle',value:1}]};
 assert.equal(check(before,after),undefined);
});

test('jogador pode iniciar uma perícia temporária sem confundi-la com outra em aprendizado',()=>{
 const before={learning:[{id:'a',name:'Controle',current:3,goal:10}]};
 const after={learning:[{id:'new',name:'Botânica',current:2,goal:10},{id:'a',name:'Controle',current:3,goal:10}]};
 assert.equal(check(before,after),undefined);
});

test('jogador não pode renomear, mudar a meta ou excluir um aprendizado incompleto',()=>{
 const before={learning:[{id:'a',name:'Controle',current:3,goal:10}]};
 assert.equal(check(before,{learning:[{id:'a',name:'Grego',current:3,goal:10}]}),'a configuração de aprendizado');
 assert.equal(check(before,{learning:[{id:'a',name:'Controle',current:3,goal:5}]}),'a configuração de aprendizado');
 assert.equal(check(before,{learning:[]}), 'a configuração de aprendizado');
});
