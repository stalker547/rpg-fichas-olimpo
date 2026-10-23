const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function autosaveHarness(saveCharacter){
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const dirtyStart=source.indexOf('function queueAutoSave('),dirtyEnd=source.indexOf('\nfunction toast(',dirtyStart);
 const saveStart=source.indexOf('async function save('),saveEnd=source.indexOf('\nfunction exportText(',saveStart);
 const state={textContent:'',classList:{add(){},remove(){}}},button={textContent:'Salvar alterações',disabled:false};
 const timers=new Map();let nextTimer=0;
 const sandbox={db:{characters:[{id:'hero',name:'Antes',_remoteVersion:1}],settings:{solosByUser:{u1:0}}},draft:{id:'hero',name:'Antes',_remoteVersion:1},currentId:'hero',dirty:false,pendingNote:'',editRevision:0,autoSaveTimer:null,saveInFlight:null,autoSaveErrorNotified:false,savedSharedSolos:0,
  $:selector=>selector==='#save-state'?state:selector==='#save'?button:null,
  setTimeout:callback=>{timers.set(++nextTimer,callback);return nextTimer},clearTimeout:id=>timers.delete(id),
  window:{rpg:{saveCharacter}},
  clone:value=>JSON.parse(JSON.stringify(value)),n:value=>Number(value)||0,
  current(){return sandbox.db.characters.find(item=>item.id===sandbox.currentId)},
  solosOwnerId(){return 'u1'},sharedSolos(){return 0},setSharedSolos(value){sandbox.db.settings.solosByUser.u1=value},
  playerSheetLocked(){return false},render(){},renderSidebar(){},showNewPointGrantToast(){},toast(){},syncSheetLock(){},
  Date};
 vm.createContext(sandbox);vm.runInContext(source.slice(dirtyStart,dirtyEnd)+source.slice(saveStart,saveEnd),sandbox);
 return {sandbox,state,button,timers};
}

test('edição agenda salvamento e sucesso limpa o estado sem cobrir o formulário',async()=>{
 let saved;const {sandbox,timers}=autosaveHarness(async character=>{saved=character;return {db:{characters:[{...character,_remoteVersion:2}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]}});
 sandbox.draft.name='Depois';sandbox.markDirty('Nome alterado');
 assert.equal(timers.size,1);assert.equal(sandbox.dirty,true);
 await sandbox.save({automatic:true});
 assert.equal(saved.name,'Depois');assert.equal(sandbox.dirty,false);assert.equal(sandbox.draft._remoteVersion,2);
 const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
 assert.equal(html.includes('id="dirty-bar"'),false);
});

test('edição feita durante o envio não é apagada pelo primeiro salvamento',async()=>{
 let finishFirst;let calls=0;
 const {sandbox}=autosaveHarness(character=>{calls++;if(calls===1)return new Promise(resolve=>{finishFirst=()=>resolve({db:{characters:[{...character,_remoteVersion:2}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]})});return Promise.resolve({db:{characters:[{...character,_remoteVersion:3}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]})});
 sandbox.markDirty();const first=sandbox.save({automatic:true});
 sandbox.draft.name='Mais recente';sandbox.markDirty();finishFirst();await first;
 assert.equal(sandbox.dirty,true);assert.equal(sandbox.draft.name,'Mais recente');assert.equal(sandbox.draft._remoteVersion,2);
 await sandbox.save({automatic:true});assert.equal(sandbox.dirty,false);assert.equal(calls,2);
});

test('falha online mantém alterações pendentes',async()=>{
 const {sandbox,state,timers}=autosaveHarness(async()=>{throw new Error('Sem conexão')});
 sandbox.draft.name='Não perder';sandbox.markDirty();
 assert.equal(await sandbox.save({automatic:true}),false);
 assert.equal(sandbox.dirty,true);assert.equal(sandbox.draft.name,'Não perder');assert.match(state.textContent,/nova tentativa/);
 assert.equal(timers.size,1);
});

test('salvamento volta a tentar após a conexão retornar',async()=>{
 let calls=0;
 const {sandbox,timers}=autosaveHarness(async character=>{
  if(++calls===1)throw new Error('Sem conexão');
  return {db:{characters:[{...character,_remoteVersion:2}],settings:{solosByUser:{u1:0}}},characterId:'hero',changes:[]};
 });
 sandbox.draft.name='Persistido';sandbox.markDirty();
 assert.equal(await sandbox.save({automatic:true}),false);
 const retry=[...timers.values()][0];timers.clear();retry();
 await sandbox.saveInFlight;
 assert.equal(calls,2);assert.equal(sandbox.dirty,false);assert.equal(sandbox.draft.name,'Persistido');
});
