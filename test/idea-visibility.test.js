const test=require('node:test');
const assert=require('node:assert/strict');

test('a mestre vê apenas ideias enviadas, aprovadas ou em desenvolvimento',async()=>{
 const {hidePlayerDrafts}=await import('../server/src/idea-visibility.js');
 const ideas=['Rascunho','Pedido para a mestre','Aprovada','Em desenvolvimento','Recusada'].map((status,index)=>({id:String(index),status}));
 const row={owner_user_id:'player',data:{ideas}};
 const master={id:'master',role:'primary_master'};
 assert.deepEqual(hidePlayerDrafts(row,master).data.ideas.map(idea=>idea.status),['Pedido para a mestre','Aprovada','Em desenvolvimento']);
 assert.equal(hidePlayerDrafts(row,{id:'player',role:'player'}),row);
 assert.equal(row.data.ideas.length,5);
});

test('salvar a ficha pela mestre preserva rascunhos e ideias recusadas do jogador',async()=>{
 const {hidePlayerDrafts,preservePlayerDrafts}=await import('../server/src/idea-visibility.js');
 const master={id:'master',role:'primary_master'};
 const stored={ideas:[{id:'draft',status:'Rascunho',name:'Segredo'},{id:'sent',status:'Pedido para a mestre',name:'Visível'},{id:'rejected',status:'Recusada',name:'Outra'}]};
 const received=hidePlayerDrafts({owner_user_id:'player',data:stored},master).data;
 received.ideas[0]={...received.ideas[0],name:'Editada'};
 const saved=preservePlayerDrafts(received,stored,master,'player');
 assert.deepEqual(saved.ideas.map(idea=>idea.name),['Editada','Segredo','Outra']);
 assert.equal(stored.ideas[0].name,'Segredo');
});
