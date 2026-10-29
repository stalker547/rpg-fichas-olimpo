const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const start=source.indexOf('function groupedPointGrants(');
const end=source.indexOf('\nfunction refreshPointGrantNotifications(',start);
const context={n:value=>Number(value)||0};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);

test('avisos do mesmo personagem somam os pontos por tipo em uma única entrada',()=>{
 const thales={id:'thales',name:'Thales'},ravi={id:'ravi',name:'Ravi'};
 const entries=[
  {character:thales,notice:{id:'a',kind:'skills',amount:3,by:'Jhenny',at:'2026-10-28T17:52:58Z'}},
  {character:thales,notice:{id:'b',kind:'skills',amount:2,by:'Jhenny',at:'2026-10-28T17:52:41Z'}},
  {character:ravi,notice:{id:'c',kind:'newSkills',amount:1,by:'Jhenny',at:'2026-10-28T17:52:40Z'}},
  {character:thales,notice:{id:'d',kind:'attributes',amount:2,by:'Jhenny',at:'2026-10-28T17:52:39Z'}}
 ];
 const groups=context.groupedPointGrants(entries,new Set(['a']));
 assert.equal(groups.length,2);
 assert.equal(groups[0].character.id,'thales');
 assert.equal(groups[0].totals.skills,5);
 assert.equal(groups[0].totals.attributes,2);
 assert.equal(groups[0].notices.length,3);
 assert.equal(groups[0].unread,true);
 assert.match(context.pointGrantGroupDescription(groups[0]),/5 pontos de perícia.*2 pontos de atributo|2 pontos de atributo.*5 pontos de perícia/);
 assert.equal(groups[1].totals.newSkills,1);
});

test('remover um aviso oculta a notificação sem alterar os pontos da ficha',()=>{
 const character={id:'thales',name:'Thales',pointPools:{skills:5,attributes:2},pointGrantNotices:[{id:'a',kind:'skills',amount:3,at:'2026-10-28T17:52:58Z'},{id:'b',kind:'skills',amount:2,at:'2026-10-28T17:52:41Z'}]};
 const values=new Map();
 const sandbox={db:{sessionUser:{id:'player'},characters:[character]},isMaster:()=>false,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}};
 vm.createContext(sandbox);
 const hiddenStart=source.indexOf('function hiddenPointGrantStorageKey(');
 const hiddenEnd=source.indexOf('\nfunction pointGrantDescription(',hiddenStart);
 vm.runInContext(source.slice(hiddenStart,hiddenEnd),sandbox);
 assert.equal(sandbox.allPointGrants().length,2);
 values.set(sandbox.hiddenPointGrantStorageKey(),JSON.stringify(['a','b']));
 assert.equal(sandbox.allPointGrants().length,0);
 assert.equal(character.pointPools.skills,5);
 assert.equal(character.pointPools.attributes,2);
 assert.equal(character.pointGrantNotices.length,2);
});
