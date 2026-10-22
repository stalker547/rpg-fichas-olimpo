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
 const sandbox={draft,rollSkills:new Set(['skill:0','skill:1']),rollProgressType:'skill',Set};
 sandbox.skillNameKey=name=>String(name).toLocaleLowerCase('pt-BR');
 sandbox.availableRollItems=()=>[
  ...draft.skills.map((item,index)=>({key:`skill:${index}`,name:item.name})),
  ...draft.quests.map((item,index)=>({key:`quest:${index}`,name:item.name}))
 ];
 vm.createContext(sandbox);
 vm.runInContext(source.slice(start,end),sandbox);
 const selected=sandbox.availableRollItems().filter(item=>sandbox.rollSkills.has(item.key));
 startSkillQuests(draft);
 sandbox.restoreRollSelection(selected);
 const checked=sandbox.availableRollItems().filter(item=>sandbox.rollSkills.has(item.key)).map(item=>item.name).sort();
 assert.deepEqual(checked,['Controle','Poder divino']);
 assert.equal(draft.quests.some(item=>item.name==='Controle'),true);
});
