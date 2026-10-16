const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function context(character){
 const handlers={};const sandbox={document:{addEventListener:(type,fn)=>handlers[type]=fn},crypto:{randomUUID:()=> 'new-id'}};
 vm.createContext(sandbox);
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8').split('function portraitCss')[0];
 vm.runInContext(source,sandbox);
 vm.runInContext(`draft=${JSON.stringify(character)};db={sessionUser:{role:'player'}};function markDirty(){}function render(){}function toast(){}`,sandbox);
 return {run:code=>vm.runInContext(code,sandbox),handlers};
}
test('completed legacy creation releases finalization and transfers the idea',()=>{
 const c=context({ideas:[{id:'idea',name:'Rastro marcado',status:'Aprovada',type:'passive',effect:'Rastreia'}],creations:[{name:'Rastro marcado',requirement:40,current:0}],abilities:[]});
 assert.match(c.run('ideaStatusOptions(draft.ideas[0])'),/Finalizada/);
 c.handlers.change({target:{matches:selector=>selector==='[data-idea-status]',dataset:{ideaStatus:'0'},value:'Finalizada'},stopImmediatePropagation(){}});
 assert.equal(c.run('draft.abilities[0].name'),'Rastro marcado');
 assert.equal(c.run('draft.abilities[0].type'),'passive');
 assert.equal(c.run('draft.ideas.length+draft.creations.length'),0);
});
test('incomplete progress does not release finalization',()=>{
 const c=context({ideas:[{id:'a',name:'A',status:'Em desenvolvimento'}],creations:[{ideaId:'a',requirement:40,current:1}]});
 assert.doesNotMatch(c.run('ideaStatusOptions(draft.ideas[0])'),/Finalizada/);
});
test('an idea can be finalized after its completed creation left the active list',()=>{
 const c=context({ideas:[{id:'a',name:'A',status:'Em desenvolvimento',creationCompleted:true,completedCreation:{current:0,requirement:40}}],creations:[],abilities:[]});
 assert.match(c.run('ideaStatusOptions(draft.ideas[0])'),/Finalizada/);
 c.handlers.change({target:{matches:selector=>selector==='[data-idea-status]',dataset:{ideaStatus:'0'},value:'Finalizada'},stopImmediatePropagation(){}});
 assert.equal(c.run('draft.abilities.length'),1);assert.equal(c.run('draft.ideas.length'),0);
});
test('a completed learning slot is available before finalization',()=>{
 const c=context({ideas:[{id:'a',name:'A',status:'Aprovada'}],creations:[{name:'B',requirement:40,current:0}]});
 assert.equal(c.run('learningOccupied(draft.ideas[0])'),false);
});
test('developing idea without a creation does not occupy the slot and can be selected',()=>{
 const c=context({ideas:[{id:'a',name:'Rastro marcado',status:'Em desenvolvimento',initialRequirement:40}],creations:[]});
 assert.equal(c.run('learningOccupied(null)'),false);assert.equal(c.run('availableLearningIdeas().length'),1);
 c.run('startIdeaLearning(draft.ideas[0])');assert.equal(c.run('draft.creations[0].ideaId'),'a');assert.equal(c.run('draft.creations[0].current'),40);
});
test('multiple developing ideas can wait but only one can be learned at a time',()=>{
 const c=context({ideas:[{id:'a',status:'Em desenvolvimento',initialRequirement:40},{id:'b',status:'Em desenvolvimento',initialRequirement:25}],creations:[]});
 c.run('startIdeaLearning(draft.ideas[0])');assert.throws(()=>c.run('startIdeaLearning(draft.ideas[1])'),/criação atual/);
 assert.equal(c.run('draft.creations.length'),1);
});
test('deleting an idea also removes its linked creation so it cannot reappear',()=>{
 const c=context({ideas:[{id:'a',name:'A'}],creations:[{ideaId:'a',name:'A',requirement:40,current:0}],abilities:[]});
 c.run("removeCharacterItem('ideas',0)");assert.equal(c.run('draft.ideas.length'),0);assert.equal(c.run('draft.creations.length'),0);
});
test('deleting an ability removes it from the ability list',()=>{
 const c=context({abilities:[{name:'A'}],ideas:[],creations:[]});c.run("removeCharacterItem('abilities',0)");assert.equal(c.run('draft.abilities.length'),0);
});
