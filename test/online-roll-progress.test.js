const test=require('node:test');
const assert=require('node:assert/strict');

const load=()=>import('../server/src/roll-progress.js');
const roll=(extra={})=>({id:'roll-1',outcome:'success',progressType:'skill',items:[],effects:[],...extra});

test('rolagem conclui quest 10 e preserva outras informações',async()=>{
 const {applyRollProgress}=await load();
 const latest={extraInfo:'Texto da outra sessão',quests:[{id:'q1',name:'Controle',value:10,current:9,goal:10}],skills:[],rollHistory:[]};
 const result=applyRollProgress(latest,roll({items:[{name:'Controle',kind:'quest'}]}));
 assert.equal(result.data.extraInfo,latest.extraInfo);
 assert.equal(result.data.quests.length,0);
 assert.equal(result.data.skills[0].value,10);
 assert.equal(result.data.skills[0].bonus,3);
 assert.equal(result.data.rollHistory.length,1);
 assert.equal(latest.quests[0].current,9);
});
test('rolagem finaliza quest antiga sem meta gravada',async()=>{
 const {applyRollProgress}=await load();
 const latest={quests:[{name:'Controle',value:10,current:9}],skills:[],rollHistory:[]};
 const result=applyRollProgress(latest,roll({items:[{name:'Controle',kind:'quest'}]}));
 assert.equal(result.data.quests.length,0);
 assert.equal(result.data.skills[0].value,10);
 assert.equal(result.data.skills[0].bonus,3);
});

test('rolagem que conclui aprendizado cria perícia de nível 1',async()=>{
 const {applyRollProgress}=await load();
 const result=applyRollProgress({learning:[{id:'l1',name:'Botânica',current:9,goal:10}],skills:[],quests:[]},roll({items:[{name:'Botânica',kind:'learning'}]}));
 assert.equal(result.data.learning.length,0);
 assert.equal(result.data.skills[0].value,1);
});

test('repetir a mesma rolagem não conta progresso duas vezes',async()=>{
 const {applyRollProgress}=await load();
 const first=applyRollProgress({skills:[{id:'s1',name:'Caça',value:1}],quests:[]},roll({items:[{name:'Caça',kind:'skill'}]}));
 const second=applyRollProgress(first.data,roll({items:[{name:'Caça',kind:'skill'}]}));
 assert.equal(second.duplicate,true);
 assert.equal(second.data.skills[0].value,3);
 assert.equal(second.data.rollHistory.length,1);
});

test('rolagem usa a ficha recente sem conflito com texto',async()=>{
 const {applyRollProgress}=await load();
 const latest={extraInfo:'Texto novo',skills:[{id:'s1',name:'Caça',value:3}],quests:[],rollHistory:[]};
 const result=applyRollProgress(latest,roll({items:[{name:'Caça',kind:'skill'}]}));
 assert.equal(result.data.extraInfo,'Texto novo');
 assert.equal(result.data.skills[0].value,5);
});

test('rolagem continua evolução após corrigir quest antiga com bônus +7',async()=>{
 const {applyRollProgress}=await load();
 const latest={skills:[],quests:[{id:'q1',name:'Controle',value:20,bonus:7,current:3,goal:10}],rollHistory:[]};
 const first=applyRollProgress(latest,roll({items:[{name:'Controle',kind:'skill'}]}));
 assert.equal(first.data.quests.length,0);
 assert.equal(first.data.skills[0].value,20);
 assert.equal(first.data.skills[0].successCount,1);
 const second=applyRollProgress(first.data,roll({id:'roll-2',items:[{name:'Controle',kind:'skill'}]}));
 assert.equal(second.data.skills[0].value,21);
 assert.equal(second.data.skills[0].bonus,7);
});

test('rolagem completa quest 20 e libera perícia 20 com bônus +7',async()=>{
 const {applyRollProgress}=await load();
 const current={skills:[],quests:[{id:'q20',name:'Poder divino',value:20,bonus:3,current:9,goal:10,successCount:1}],rollHistory:[]};
 const result=applyRollProgress(current,roll({items:[{name:'Poder divino',kind:'quest'}]}));
 assert.equal(result.data.quests.length,0);
 assert.equal(result.data.skills[0].value,20);
 assert.equal(result.data.skills[0].bonus,7);
});

test('rolagem marcada como perícia avança quest iniciada no servidor',async()=>{
 const {applyRollProgress}=await load();
 const current={skills:[{name:'Controle',value:10,bonus:0}],quests:[],rollHistory:[]};
 const result=applyRollProgress(current,roll({items:[{name:'Controle',kind:'skill'}]}));
 assert.equal(result.data.skills.length,0);
 assert.equal(result.data.quests[0].current,1);
 assert.equal(result.data.rollHistory.length,1);
});

test('rolagem marcada como quest continua perícia concluída em outra sessão',async()=>{
 const {applyRollProgress}=await load();
 const current={skills:[{name:'Controle',value:10,bonus:3,completedQuestTier:10}],quests:[],rollHistory:[]};
 const result=applyRollProgress(current,roll({items:[{name:'Controle',kind:'quest'}]}));
 assert.equal(result.data.quests.length,0);
 assert.equal(result.data.skills[0].value,11);
 assert.equal(result.data.rollHistory.length,1);
});

test('rolagem de perícia ainda em aprendizado usa o progresso atual',async()=>{
 const {applyRollProgress}=await load();
 const current={skills:[],quests:[],learning:[{name:'Botânica',current:8,goal:10}],rollHistory:[]};
 const result=applyRollProgress(current,roll({items:[{name:'Botânica',kind:'temporary'}]}));
 assert.equal(result.data.learning.length,0);
 assert.equal(result.data.skills[0].value,1);
 assert.equal(result.data.rollHistory.length,1);
});
