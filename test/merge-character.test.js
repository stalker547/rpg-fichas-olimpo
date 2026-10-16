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
