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
test('mestre e jogador podem adicionar receptáculos diferentes sem perder nenhum',()=>{
 const base={receptacles:[{id:'antigo',slot:1,name:'Antigo',equipped:false}]};
 const local={receptacles:[...base.receptacles,{id:'jogador',slot:2,name:'Do jogador',equipped:false}]};
 const remote={receptacles:[...base.receptacles,{id:'mestre',slot:2,name:'Da mestre',equipped:false}]};
 const result=mergeCharacter(base,local,remote);
 assert.deepEqual(result.receptacles.map(item=>item.id),['antigo','mestre','jogador']);
 assert.equal(new Set(result.receptacles.map(item=>item.slot)).size,3);
});
test('edições diferentes no mesmo receptáculo são combinadas',()=>{
 const base={receptacles:[{id:'anel',slot:1,name:'Anel',equipped:false}]};
 const local={receptacles:[{...base.receptacles[0],equipped:true}]};
 const remote={receptacles:[{...base.receptacles[0],name:'Anel divino'}]};
 assert.deepEqual(mergeCharacter(base,local,remote).receptacles,[{id:'anel',slot:1,name:'Anel divino',equipped:true}]);
});
test('remoção e adição simultâneas de receptáculos diferentes são preservadas',()=>{
 const base={receptacles:[{id:'antigo',slot:1,name:'Antigo'}]};
 const result=mergeCharacter(base,{receptacles:[]},{receptacles:[...base.receptacles,{id:'novo',slot:2,name:'Novo'}]});
 assert.deepEqual(result.receptacles.map(item=>item.id),['novo']);
});
test('edições incompatíveis no mesmo receptáculo continuam protegidas',()=>{
 const base={receptacles:[{id:'anel',slot:1,name:'Anel'}]};
 assert.throws(()=>mergeCharacter(base,{receptacles:[{...base.receptacles[0],name:'Anel azul'}]},{receptacles:[{...base.receptacles[0],name:'Anel vermelho'}]}),/também alterou receptacles\[anel\]\.name/);
});
test('perícias diferentes editadas pela mestre e pelo jogador são preservadas',()=>{
 const base={skills:[{id:'a',name:'Caça',value:2},{id:'b',name:'Botânica',value:3}]};
 const local={skills:[{...base.skills[0],value:4},base.skills[1]]};
 const remote={skills:[base.skills[0],{...base.skills[1],value:5}]};
 assert.deepEqual(mergeCharacter(base,local,remote).skills.map(skill=>skill.value),[4,5]);
});
test('habilidades antigas sem id mesclam edições em linhas diferentes',()=>{
 const base={abilities:[{name:'Voo',useCurrent:1},{name:'Escudo',useCurrent:2}]};
 const local={abilities:[{...base.abilities[0],useCurrent:3},base.abilities[1]]};
 const remote={abilities:[base.abilities[0],{...base.abilities[1],useCurrent:4}]};
 assert.deepEqual(mergeCharacter(base,local,remote).abilities.map(ability=>ability.useCurrent),[3,4]);
});
test('habilidades antigas sem id preservam remoção e edição em itens diferentes',()=>{
 const base={abilities:[{name:'Voo',useCurrent:1},{name:'Escudo',useCurrent:2}]};
 const local={abilities:[base.abilities[1]]};
 const remote={abilities:[base.abilities[0],{...base.abilities[1],useCurrent:4}]};
 assert.deepEqual(mergeCharacter(base,local,remote).abilities,[{name:'Escudo',useCurrent:4}]);
});
test('perícia antiga sem id pode ser adicionada enquanto outra avança',()=>{
 const base={skills:[{name:'Caça',value:2}]};
 const local={skills:[...base.skills,{name:'Botânica',value:1}]};
 const remote={skills:[{name:'Caça',value:3}]};
 assert.deepEqual(mergeCharacter(base,local,remote).skills,[{name:'Caça',value:3},{name:'Botânica',value:1}]);
});
test('itens do inventário em espaços diferentes são preservados',()=>{
 const base={backpack:{items:['','','']}};
 const local={backpack:{items:['Espada','','']}};
 const remote={backpack:{items:['','','Poção']}};
 assert.deepEqual(mergeCharacter(base,local,remote).backpack.items,['Espada','','Poção']);
});
test('novas ideias e habilidades sem id são somadas quando criadas em sessões diferentes',()=>{
 const base={ideas:[],abilities:[]};
 const local={ideas:[{id:'j',name:'Ideia J'}],abilities:[{name:'Voo'}]};
 const remote={ideas:[{id:'m',name:'Ideia M'}],abilities:[{name:'Escudo'}]};
 const result=mergeCharacter(base,local,remote);
 assert.deepEqual(result.ideas.map(item=>item.id),['m','j']);
 assert.deepEqual(result.abilities.map(item=>item.name),['Escudo','Voo']);
});
test('duas edições diferentes no mesmo campo continuam sem sobrescrever uma à outra',()=>{
 const base={profile:{healthCurrent:100}};
 assert.throws(()=>mergeCharacter(base,{profile:{healthCurrent:80}},{profile:{healthCurrent:90}}),/também alterou profile.healthCurrent/);
});
