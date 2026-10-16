const {app,net}=require('electron');
const assert=require('node:assert/strict');
const {OnlineClient}=require('../online-client');
app.whenReady().then(async()=>{
 try{
  const client=new OnlineClient({fetch:(...args)=>net.fetch(...args)});
  const db=await client.login({username:process.env.OLIMPO_TEST_USER,password:process.env.OLIMPO_TEST_PASSWORD});
  const matches=db.characters.filter(c=>c.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='joao');
  assert.equal(matches.length,1,'Não foi possível identificar uma única ficha João.');
  const character=matches[0],owner=db.users.find(u=>u.id===character.ownerUserId);
  assert.ok(owner?.username==='stalker'||owner?.id===db.sessionUser.id,'O personagem pertence a outra conta; nenhuma alteração foi feita.');
  const original=await client.request('/characters/'+character.id);
  await client.assign(character.id,db.sessionUser.id);
  const updated=await client.request('/characters/'+character.id);
  assert.equal(updated.owner_user_id,db.sessionUser.id);
  assert.deepEqual(updated.data,original.data);
  console.log(JSON.stringify({character:character.name,previousOwner:owner.name,currentOwner:db.sessionUser.name,characterDataPreserved:true}));app.exit(0);
 }catch(error){console.error(error.message);app.exit(1)}
});
