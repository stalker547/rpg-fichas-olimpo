const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {startSkillQuests}=require('../src/progression');

test('quest promotion keeps only explicitly selected skills checked',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const start=source.indexOf('function restoreRollSelection(');
 const end=source.indexOf('\nfunction ',start+1);
 const draft={skills:[
  {name:'Poder divino',value:18},
  {name:'Controle',value:10},
  {name:'Luta corporal',value:2}
 ],quests:[],learning:[],abilities:[],creations:[]};
 const sandbox={draft,rollSkills:new Set(['skill:poderdivino','skill:controle']),rollProgressType:'skill',Set};
 sandbox.skillNameKey=name=>String(name).toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
 sandbox.availableRollItems=()=>[
  ...draft.skills.map((item,index)=>({key:`skill:${index}`,name:item.name})),
  ...draft.quests.map((item,index)=>({key:`quest:${index}`,name:item.name}))
 ];
 vm.createContext(sandbox);
 const keyStart=source.indexOf('function rollSelectionKey(');
 vm.runInContext(source.slice(keyStart,end),sandbox);
 const selected=sandbox.availableRollItems().filter(item=>sandbox.rollSkills.has(sandbox.rollSelectionKey(item)));
 startSkillQuests(draft);
 sandbox.restoreRollSelection(selected);
 const checked=sandbox.availableRollItems().filter(item=>sandbox.rollSkills.has(sandbox.rollSelectionKey(item))).map(item=>item.name).sort();
 assert.deepEqual(checked,['Controle','Poder divino']);
 assert.equal(draft.quests.some(item=>item.name==='Controle'),true);
});

test('server reordering after save cannot move a selected quest to another skill',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const start=source.indexOf('function rollSelectionKey('),end=source.indexOf('\nfunction ',source.indexOf('function restoreRollSelection(',start)+1);
 const sandbox={skillNameKey:name=>String(name).toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,''),Set};
 vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);
 const selected=new Set([sandbox.rollSelectionKey({key:'quest:1',name:'Artes marciais',quest:true})]);
 const reordered=[{key:'skill:0',name:'Armas curtas'},{key:'quest:0',name:'Artes marciais',quest:true}];
 assert.deepEqual(reordered.filter(item=>selected.has(sandbox.rollSelectionKey(item))).map(item=>item.name),['Artes marciais']);
});
