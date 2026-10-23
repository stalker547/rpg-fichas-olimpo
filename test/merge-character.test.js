const test=require('node:test');const assert=require('node:assert/strict');const {mergeCharacter}=require('../merge-character');
test('deleting an ability merges safely with master changes in another field',()=>{
 const base={abilities:[{name:'A'}],notes:'',_remoteVersion:1};
 const result=mergeCharacter(base,{...base,abilities:[]},{...base,notes:'Mestre editou',_remoteVersion:2});
 assert.equal(result.abilities.length,0);assert.equal(result.notes,'Mestre editou');assert.equal(result._remoteVersion,2);
});
test('deleting an idea is preserved when unrelated properties change online',()=>{
 const base={ideas:[{id:'a'}],profile:{xp:1}};
 const result=mergeCharacter(base,{...base,ideas:[]},{...base,profile:{xp:2}});
 assert.deepEqual(result.ideas,[]);assert.equal(result.profile.xp,2);
});
test('simultaneous edits to the same list are rejected instead of overwriting data',()=>{
 const base={abilities:[{name:'A'}]};assert.throws(()=>mergeCharacter(base,{abilities:[]},{abilities:[{name:'A',level:2}]}),/também alterou abilities/);
});
test('player save keeps remote master capacity without creating a conflict',()=>{
 const base={receptacleCapacity:{chain:5,box:5},backpack:{items:['']}};
 const local={receptacleCapacity:{chain:5,box:20},backpack:{items:['Espada']}};
 const remote={receptacleCapacity:{chain:15,box:5},backpack:{items:['']}};
 const result=mergeCharacter(base,local,remote,{preferRemote:['receptacleCapacity']});
 assert.deepEqual(result.receptacleCapacity,{chain:15,box:5});assert.deepEqual(result.backpack.items,['Espada']);
});
test('a player edit keeps point notices added by the master while editing',()=>{
 const base={notes:'',pointGrantNotices:[],_remoteVersion:1};
 const local={...base,notes:'Nova anotação'};
 const remote={...base,pointGrantNotices:[{id:'grant-1',kind:'skills',amount:2}],_remoteVersion:2};
 const result=mergeCharacter(base,local,remote);
 assert.equal(result.notes,'Nova anotação');assert.deepEqual(result.pointGrantNotices,remote.pointGrantNotices);
});
test('after a roll, pending text and unrelated remote edits merge without overwriting either',()=>{
 const base={extraInfo:'Antes',profile:{xp:1},skills:[{name:'Controle',value:10}],quests:[],_remoteVersion:3};
 const remote={...base,extraInfo:'Texto da mestre',profile:{xp:2},skills:[],quests:[{name:'Controle',value:10,current:1,goal:10}],_remoteVersion:4};
 const local={...base,extraInfo:'Texto da mestre\n\n--- Outra edição preservada ---\n\nTexto do jogador',skills:remote.skills,quests:remote.quests};
 const result=mergeCharacter(base,local,remote);
 assert.equal(result.profile.xp,2);
 assert.deepEqual(result.quests,remote.quests);
 assert.match(result.extraInfo,/Texto da mestre/);
 assert.match(result.extraInfo,/Texto do jogador/);
 assert.equal(result._remoteVersion,4);
});
