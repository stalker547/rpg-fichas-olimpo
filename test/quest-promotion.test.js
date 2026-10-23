const test=require('node:test');
const assert=require('node:assert/strict');

test('jogador pode salvar outra edição quando quest 20 com +7 vira perícia automaticamente',async()=>{
 const {isAuthorizedPromotion}=await import('../server/src/quest-promotion.js');
 const before={quests:[{id:'q1',name:'Artes marciais',value:20,bonus:7,current:2,goal:10}]};
 const after={quests:[],skills:[{id:'q1',name:'Artes marciais',value:20,bonus:7}]};
 assert.equal(isAuthorizedPromotion(before,after,after.skills[0]),true);
});

test('quest incompleta não autoriza criar perícia sem gastar pontos',async()=>{
 const {isAuthorizedPromotion}=await import('../server/src/quest-promotion.js');
 const before={quests:[{id:'q1',name:'Artes marciais',value:20,bonus:3,current:2,goal:10}]};
 const after={quests:[],skills:[{id:'q1',name:'Artes marciais',value:20,bonus:7}]};
 assert.equal(isAuthorizedPromotion(before,after,after.skills[0]),false);
});

test('perícia de quest continua exigindo que a quest saia da lista',async()=>{
 const {isAuthorizedPromotion}=await import('../server/src/quest-promotion.js');
 const quest={id:'q1',name:'Artes marciais',value:20,bonus:7,current:2,goal:10};
 assert.equal(isAuthorizedPromotion({quests:[quest]},{quests:[quest]}, {id:'q1',name:'Artes marciais',value:20,bonus:7}),false);
});
