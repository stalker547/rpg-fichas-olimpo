const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('rolagem online salva sem enviar texto pendente e preserva ambas as edições',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const start=source.indexOf('async function registerOnlineRoll('),end=source.indexOf('\nfunction registerRollResult(',start);
 let sent,queued=0,rendered=0;
 const sandbox={rollSubmissionInFlight:false,pendingOnlineRoll:null,currentId:'hero',rollProgressType:'skill',dirty:true,
  db:{characters:[{id:'hero',extraInfo:'Texto anterior',_remoteVersion:3}]},
  draft:{id:'hero',extraInfo:'Texto do jogador',skills:[],quests:[],learning:[],creations:[],abilities:[],rollHistory:[],_remoteVersion:3},
  window:{rpg:{registerRoll:async(id,record)=>{sent={id,record};return {db:{characters:[{id:'hero',extraInfo:'Texto da mestre',skills:[{name:'Caça',value:10}],quests:[],learning:[],creations:[],abilities:[],rollHistory:[{id:record.id}],_remoteVersion:4}]},advanced:['Caça +1'],failures:[]}}}},
  n:value=>Number(value)||0,clone:value=>JSON.parse(JSON.stringify(value)),restoreRollSelection(){},queueAutoSave(){queued++},render(){rendered++},clean(){throw new Error('Edição pendente foi descartada')},toast(){},Date,Math};
 vm.createContext(sandbox);
 await vm.runInContext(source.slice(start,end)+'\nregisterOnlineRoll({selected:[],effects:[],formula:"1d100",attribute:"",attributeValue:0,successTarget:50,modifier:0},"success")',sandbox);
 assert.equal(sent.id,'hero');
 assert.equal(sent.record.extraInfo,undefined);
 assert.match(sandbox.draft.extraInfo,/Texto da mestre/);
 assert.match(sandbox.draft.extraInfo,/Texto do jogador/);
 assert.equal(sandbox.draft.skills[0].value,10);
 assert.equal(sandbox.draft._remoteVersion,3);
 assert.equal(queued,1);
 assert.equal(rendered,1);
});

test('quest finalizada pela rolagem do jogador sai da quest e aparece como perícia',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const start=source.indexOf('async function registerOnlineRoll('),end=source.indexOf('\nfunction registerRollResult(',start);
 const quest={name:'Controle',value:10,current:9,goal:10};
 const saved={id:'hero',skills:[{name:'Controle',value:10,bonus:3}],quests:[],learning:[],creations:[],abilities:[],rollHistory:[{id:'roll-final'}],_remoteVersion:5};
 const sandbox={rollSubmissionInFlight:false,pendingOnlineRoll:null,currentId:'hero',rollProgressType:'skill',dirty:false,
  db:{characters:[{id:'hero',skills:[],quests:[quest]}]},
  draft:{id:'hero',skills:[],quests:[quest]},
  window:{rpg:{registerRoll:async()=>({db:{characters:[saved]},advanced:['Controle +1'],failures:[]})}},
  n:value=>Number(value)||0,clone:value=>JSON.parse(JSON.stringify(value)),restoreRollSelection(){},render(){},clean(){sandbox.dirty=false},toast(){},Date,Math};
 vm.createContext(sandbox);
 await vm.runInContext(source.slice(start,end)+'\nregisterOnlineRoll({selected:[{name:"Controle",quest:true}],effects:[],formula:"1d100",attribute:"",attributeValue:0,successTarget:50,modifier:0},"success")',sandbox);
 assert.equal(sandbox.draft.quests.length,0);
 assert.equal(sandbox.draft.skills[0].value,10);
 assert.equal(sandbox.draft.skills[0].bonus,3);
});

test('tentar novamente após resposta perdida não duplica o progresso',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const start=source.indexOf('async function registerOnlineRoll('),end=source.indexOf('\nfunction registerRollResult(',start);
 const sent=[];
 const saved={id:'hero',skills:[{name:'Caça',value:3}],quests:[],learning:[],creations:[],abilities:[],rollHistory:[],_remoteVersion:2};
 const sandbox={rollSubmissionInFlight:false,pendingOnlineRoll:null,currentId:'hero',rollProgressType:'skill',dirty:false,
  db:{characters:[{id:'hero',skills:[{name:'Caça',value:1}],_remoteVersion:1}]},draft:{id:'hero',skills:[{name:'Caça',value:1}],_remoteVersion:1},
  window:{rpg:{registerRoll:async(_id,record)=>{sent.push(record.id);if(sent.length===1)throw new Error('Resposta perdida');return {db:{characters:[saved]},advanced:[],failures:[],duplicate:true}}}},
  n:value=>Number(value)||0,clone:value=>JSON.parse(JSON.stringify(value)),restoreRollSelection(){},render(){},clean(){},toast(){},Date,Math};
 vm.createContext(sandbox);
 vm.runInContext(source.slice(start,end),sandbox);
 const action='registerOnlineRoll({selected:[{name:"Caça"}],effects:[],formula:"1d100",attribute:"",attributeValue:0,successTarget:50,modifier:0},"success")';
 await vm.runInContext(action,sandbox);
 await vm.runInContext(action,sandbox);
 assert.equal(sent.length,2);
 assert.equal(sent[0],sent[1]);
 assert.equal(sandbox.pendingOnlineRoll,null);
});
