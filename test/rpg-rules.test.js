const test=require('node:test');const assert=require('node:assert/strict');const rules=require('../src/rpg-rules');
test('point costs are calculated per purchased level, including band crossings',()=>{
 assert.equal(rules.skillPointCost(9,10),1);assert.equal(rules.skillPointCost(10,11),2);assert.equal(rules.skillPointCost(19,21),5);assert.equal(rules.skillPointCost(29,30),3);assert.throws(()=>rules.skillPointCost(30,31),/somente|só/);
});
test('skills below 10 gain two on success and one on failure',()=>{const a={value:5},b={value:5};assert.equal(rules.advanceSkill(a,true),2);assert.equal(rules.advanceSkill(b,false),1)});
test('each skill band uses the required success and failure counts',()=>{
 for(const [level,successes,failures]of [[10,1,2],[20,2,3],[30,3,4],[40,4,5]])for(const [success,count]of [[true,successes],[false,failures]]){const s={value:level};for(let i=1;i<count;i++)assert.equal(rules.advanceSkill(s,success),0);assert.equal(rules.advanceSkill(s,success),1);assert.equal(s.value,level+1)}
 assert.equal(rules.advanceSkill({value:50},true),0);
});
test('quest 10 gains two on success and one on failure; later quests use counters',()=>{
 const level10Success={value:10,current:0,goal:10};assert.equal(rules.advanceQuest(level10Success,true),2);assert.equal(level10Success.current,2);
 const level10Failure={value:10,current:0,goal:10};assert.equal(rules.advanceQuest(level10Failure,false),1);assert.equal(level10Failure.current,1);
 for(const [value,required] of [[20,1],[30,2]]){const quest={value,current:0,goal:10};for(let i=1;i<required;i++)assert.equal(rules.advanceQuest(quest,true),0);assert.equal(rules.advanceQuest(quest,true),1);assert.equal(quest.current,1);assert.equal(quest.successCount,0)}
 for(const [value,required] of [[40,3],[50,4]]){const quest={value,current:0,goal:10};assert.equal(rules.advanceQuest(quest,true),0);for(let i=1;i<required;i++)assert.equal(rules.advanceQuest(quest,true,true),0);assert.equal(rules.advanceQuest(quest,true,true),1)}
});
test('quest accumulates failures automatically without visible configuration',()=>{
 for(const [value,required] of [[20,2],[30,3],[40,4],[50,5]]){const quest={value,current:0,goal:10,failuresPerProgress:0};for(let i=1;i<required;i++)assert.equal(rules.advanceQuest(quest,false,true),0);assert.equal(rules.advanceQuest(quest,false,true),1);assert.equal(quest.current,1);assert.equal(quest.failureCount,0)}
});
test('quest success and failure counters remain independent',()=>{
 const quest={value:30,current:0,goal:10};
 assert.equal(rules.advanceQuest(quest,true),0);assert.equal(quest.successCount,1);
 assert.equal(rules.advanceQuest(quest,false),0);assert.equal(rules.advanceQuest(quest,false),0);assert.equal(quest.failureCount,2);
 assert.equal(rules.advanceQuest(quest,true),1);assert.equal(quest.successCount,0);assert.equal(quest.failureCount,2);assert.equal(quest.current,1);
 assert.equal(rules.advanceQuest(quest,false),1);assert.equal(quest.failureCount,0);assert.equal(quest.current,2);
});
test('equipment respects capacity without limiting attribute totals',()=>{
 const c={attributes:{Força:99},receptacleCapacity:{chain:5,box:5},receptacles:[{equipped:true,effects:[{attribute:'Força',targetType:'attribute',bonus:25}]}]};assert.equal(rules.validateEquipment(c),'');
 c.receptacles=Array.from({length:6},()=>({equipped:true}));assert.match(rules.validateEquipment(c),/corrente/);
 c.receptacles=[...Array.from({length:5},()=>({equipped:true})),...Array.from({length:8},()=>({containerType:'custom',equipped:true}))];assert.equal(rules.validateEquipment(c),'');
 c.receptacles=[...Array.from({length:5},()=>({equipped:false})),...Array.from({length:8},()=>({containerType:'custom',equipped:false}))];assert.equal(rules.validateEquipment(c),'');
});
test('equipped receptacle adds bonus only to its matching skill',()=>{
 const c={receptacles:[{equipped:true,effects:[{attribute:'Audição',targetType:'skill',bonus:5}]},{equipped:false,effects:[{attribute:'Visão',targetType:'skill',bonus:5}]}]};
 assert.equal(rules.skillBonus(c,'Audição'),5);assert.equal(rules.skillBonus(c,'audição'),5);assert.equal(rules.skillBonus(c,'Visão'),0);assert.equal(rules.skillBonus(c,'Olfato'),0);
});
test('new skill requires and spends exactly three points',()=>{
 const c={skills:[],pointPools:{skills:2}};assert.throws(()=>rules.addPaidSkill(c,'test'),/3 pontos/);assert.equal(c.skills.length,0);assert.equal(c.pointPools.skills,2);
 c.pointPools.skills=3;rules.addPaidSkill(c,'test');assert.equal(c.skills[0].value,1);assert.equal(c.skills[0].id,'test');assert.equal(c.pointPools.skills,0);
});
test('increase button charges each skill band and cannot purchase above 30',()=>{
 for(const [level,cost]of [[9,1],[10,2],[20,3]]){const c={skills:[{value:level}],pointPools:{skills:cost}};assert.equal(rules.purchaseSkillLevel(c,0),cost);assert.equal(c.skills[0].value,level+1);assert.equal(c.pointPools.skills,0)}
 const c={skills:[{value:30}],pointPools:{skills:50}};assert.throws(()=>rules.purchaseSkillLevel(c,0));assert.equal(c.skills[0].value,30);assert.equal(c.pointPools.skills,50);
});
test('attribute increase is blocked at zero points regardless of master role',()=>{
 const c={attributes:{Força:3},pointPools:{attributes:0},role:'admin'};assert.throws(()=>rules.purchaseAttribute(c,'Força',4),/pontos/);assert.equal(c.attributes.Força,3);assert.equal(c.pointPools.attributes,0);
 c.pointPools.attributes=1;rules.purchaseAttribute(c,'Força',4);assert.equal(c.attributes.Força,4);assert.equal(c.pointPools.attributes,0);assert.throws(()=>rules.purchaseAttribute(c,'Força',5));
});
