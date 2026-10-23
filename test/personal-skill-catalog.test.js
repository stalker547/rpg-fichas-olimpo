const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('perícia particular aparece apenas nas rolagens da ficha atual',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const catalog=source.slice(source.indexOf('const skillCatalog=['),source.indexOf('const imageDataCache='));
 const skills=source.slice(source.indexOf('function availableRollSkills(){'),source.indexOf('function availableRollAbilities(){'));
 const sandbox={db:{settings:{customSkillCatalog:[{name:'Global',category:'Outras'}]}},draft:{skills:[],quests:[],learning:[],personalSkillCatalog:[{name:'Só do Thales',category:'Outras'}]},n:value=>Number(value)||0,rollSkillBonus:()=>0,skillNameKey:value=>String(value||'').toLocaleLowerCase('pt-BR').replace(/\s/g,'')};
 vm.createContext(sandbox);vm.runInContext(catalog+skills,sandbox);
 assert.ok(sandbox.availableRollSkills().some(skill=>skill.name==='Só do Thales'&&skill.temporary));
 sandbox.draft={skills:[],quests:[],learning:[],personalSkillCatalog:[]};
 assert.equal(sandbox.availableRollSkills().some(skill=>skill.name==='Só do Thales'),false);
 assert.ok(sandbox.availableRollSkills().some(skill=>skill.name==='Global'));
});
