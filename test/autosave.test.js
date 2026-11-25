const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function saveHarness(saveCharacter){
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const dirtyStart=source.indexOf('function markDirty('),dirtyEnd=source.indexOf('\nfunction toast(',dirtyStart);
 const saveStart=source.indexOf('async function save('),saveEnd=source.indexOf('\nfunction exportText(',saveStart);
 const state={textContent:'',classList:{add(){},remove(){}}},button={textContent:'Salvar alterações',disabled:false};
 const timers=new Map(),pendingChanges=[];let nextTimer=0;
 const sandbox={db:{characters:[{id:'hero',name:'Antes',_remoteVersion:1}],settings:{solosByUser:{u1:0}}},draft:{id:'hero',name:'Antes',_remoteVersion:1},currentId:'hero',dirty:false,pendingNote:'',editRevision:0,saveInFlight:null,savedSharedSolos:0,
  $:selector=>selector==='#save-state'?state:selector==='#save'?button:null,
  setTimeout:callback=>{timers.set(++nextTimer,callback);return nextTimer},clearTimeout:id=>timers.delete(id),
  window:{rpg:{saveCharacter,setPendingChanges:pending=>pendingChanges.push(pending)}},
  clone:value=>JSON.parse(JSON.stringify(value)),n:value=>Number(value)||0,
  current(){return sandbox.db.characters.find(item=>item.id===sandbox.currentId)},
  solosOwnerId(){return 'u1'},sharedSolos(){return 0},setSharedSolos(value){sandbox.db.settings.solosByUser.u1=value},
  playerSheetLocked(){return false},render(){},renderSidebar(){},showNewPointGrantToast(){},toast(){},syncSheetLock(){},
  Date};
 vm.createContext(sandbox);vm.runInContext(source.slice(dirtyStart,dirtyEnd)+source.slice(saveStart,saveEnd),sandbox);
 return {sandbox,state,button,timers,pendingChanges};
}

test('edição fica pendente até clicar em salvar',async()=>{
 let calls=0;const {sandbox,state,timers,pendingChanges}=saveHarness(async character=>{calls++;return {db:{characters:[{...character,_remoteVersion:2}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]}});
 sandbox.draft.name='Depois';sandbox.markDirty('Nome alterado');
 assert.equal(calls,0);assert.equal(timers.size,0);assert.match(state.textContent,/clique em Salvar alterações/);
 assert.equal(await sandbox.save(),true);assert.equal(calls,1);assert.equal(sandbox.dirty,false);assert.deepEqual(pendingChanges,[true,false]);
});

test('edição durante o envio permanece pendente para o próximo salvamento manual',async()=>{
 let finishFirst;let calls=0;
 const {sandbox}=saveHarness(character=>{calls++;if(calls===1)return new Promise(resolve=>{finishFirst=()=>resolve({db:{characters:[{...character,_remoteVersion:2}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]})});return Promise.resolve({db:{characters:[{...character,_remoteVersion:3}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]})});
 sandbox.markDirty();const first=sandbox.save();sandbox.draft.name='Mais recente';sandbox.markDirty();finishFirst();await first;
 assert.equal(calls,1);assert.equal(sandbox.dirty,true);assert.equal(sandbox.draft.name,'Mais recente');
 await sandbox.save();assert.equal(calls,2);assert.equal(sandbox.dirty,false);
});

test('falha mantém a edição e não tenta novamente sozinha',async()=>{
 let calls=0;const {sandbox,state,timers,button}=saveHarness(async()=>{calls++;throw new Error('Sem conexão')});
 sandbox.draft.name='Não perder';sandbox.markDirty();assert.equal(await sandbox.save(),false);
 assert.equal(calls,1);assert.equal(sandbox.dirty,true);assert.equal(sandbox.draft.name,'Não perder');assert.match(state.textContent,/Falha ao salvar/);assert.equal(button.disabled,false);assert.equal(timers.size,0);
});
