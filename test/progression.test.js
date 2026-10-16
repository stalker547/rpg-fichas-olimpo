const test=require('node:test');const assert=require('node:assert/strict');
const {applyProgression}=require('../src/progression');
test('zero remaining releases the slot but keeps the idea for manual finalization',()=>{
 const c={creations:[{ideaId:'a',name:'Rastro',requirement:40,current:0}],ideas:[{id:'a',name:'Rastro',status:'Em desenvolvimento'}],abilities:[]};
 applyProgression(c);assert.equal(c.creations.length,0);assert.equal(c.ideas.length,1);assert.equal(c.ideas[0].creationCompleted,true);assert.equal(c.abilities.length,0);
 assert.equal(applyProgression(c),false);
});
test('manual legacy creation becomes a completed idea without losing its name',()=>{
 const c={creations:[{name:'Rastro',requirement:40,current:0}]};applyProgression(c);
 assert.equal(c.ideas[0].name,'Rastro');assert.equal(c.ideas[0].completedCreation.requirement,40);
});
test('evolution automatically increases level once and starts the next cycle',()=>{
 const c={abilities:[{name:'Mochila infinita',level:1,useCurrent:25,useGoal:25}]};
 applyProgression(c);assert.equal(c.abilities[0].level,2);assert.equal(c.abilities[0].useCurrent,0);assert.equal(applyProgression(c),false);
});
test('incomplete and uninitialized progress remains unchanged',()=>{
 const c={creations:[{current:0,requirement:0},{current:1,requirement:40}],abilities:[{level:1,useCurrent:24,useGoal:25}]};
 assert.equal(applyProgression(c),false);assert.equal(c.creations.length,2);assert.equal(c.abilities[0].level,1);
});

test('quest concluída volta para perícias com um nível a mais',()=>{
 const c={skills:[],quests:[{id:'training',name:'Treinamento',value:10,bonus:0,current:10,goal:10}],creations:[],ideas:[],abilities:[]};
 assert.equal(applyProgression(c),true);assert.equal(c.quests.length,0);assert.equal(c.skills.length,1);assert.equal(c.skills[0].name,'Treinamento');assert.equal(c.skills[0].value,11);
 assert.equal(applyProgression(c),false);assert.equal(c.skills[0].value,11);
});
