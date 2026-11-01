const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('a aba da mestre não mostra rascunhos, mesmo quando a ficha está no banco local',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const helpers=source.slice(source.indexOf('function masterCanSeeIdea'),source.indexOf('function renderIdeas(){'));
 const render=source.slice(source.indexOf('function renderIdeasApproval()'),source.indexOf('\nfunction openIdeaPreview'));
 const draft={ideas:[
  {id:'hidden',name:'Segredo',status:'Rascunho',type:'active'},
  {id:'sent',name:'Enviada',status:'Pedido para a mestre',type:'active'},
  {id:'approved',name:'Aprovada',status:'Aprovada',type:'passive'},
  {id:'developing',name:'Desenvolvendo',status:'Em desenvolvimento',type:'active'},
  {id:'rejected',name:'Recusada',status:'Recusada',type:'active'}
 ]};
 const context={draft,isMaster:()=>true,section:()=>'',abilityTypeLabel:type=>type,ideaCreation:()=>null,n:value=>Number(value)||0,esc:value=>String(value||''),ideaStatusClass:()=>'',expandedIdeas:new Set(),empty:()=>''};
 vm.createContext(context);
 vm.runInContext(`${helpers}\n${render}\nthis.output=renderIdeasApproval()`,context);
 assert.match(context.output,/Enviada/);
 assert.match(context.output,/Aprovada/);
 assert.match(context.output,/Desenvolvendo/);
 assert.doesNotMatch(context.output,/Segredo|Recusada/);
 assert.match(context.output,/data-toggle-idea="1"/);
 assert.equal(draft.ideas.length,5);
});
