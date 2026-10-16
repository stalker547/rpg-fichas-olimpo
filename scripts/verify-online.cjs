const {app,net}=require('electron');
const assert=require('node:assert/strict');
const {OnlineClient}=require('../online-client');
app.whenReady().then(async()=>{
 try{
  const client=new OnlineClient({fetch:(...args)=>net.fetch(...args)});
  const data=await client.login({username:process.env.OLIMPO_TEST_USER,password:process.env.OLIMPO_TEST_PASSWORD});
  assert.ok(data.online);assert.ok(data.characters.length>=8);
  console.log(JSON.stringify({publicLogin:true,characters:data.characters.length,role:data.sessionUser.role}));
  for(const c of data.characters.filter(c=>c.name==='Teste temporário de sincronização'))await client.request('/characters/'+c.id,'DELETE');
  const {WebSocket}=require('../server/node_modules/ws');
  const socket=new WebSocket(client.baseUrl.replace(/^http/,'ws')+'/events?token='+client.token);
  const events=[];const connected=new Promise((resolve,reject)=>{socket.on('message',bytes=>{const event=JSON.parse(bytes);events.push(event);if(event.type==='connected')resolve()});socket.on('error',reject);setTimeout(()=>reject(new Error('WebSocket não conectou')),15000).unref()});
  await connected;
  let created,testPlayer,playerSocket;
  try{
   created=await client.save({name:'Teste temporário de sincronização',profile:{},abilities:[],ideas:[],creations:[],history:[]});
   const changed=await client.save({id:created.id,_remoteVersion:created.version,name:created.name,profile:{},notes:'Sincronização validada',abilities:[],ideas:[],creations:[],history:[]});
   await assert.rejects(()=>client.save({id:created.id,_remoteVersion:created.version,name:created.name,profile:{}}),error=>error.status===409);
   const read=await client.request('/characters/'+created.id);assert.equal(read.data.notes,'Sincronização validada');assert.equal(read.version,changed.version);
   await new Promise(resolve=>setTimeout(resolve,300));assert.ok(events.some(e=>e.type==='character.updated'&&e.characterId===created.id));
   console.log(JSON.stringify({publicSave:true,publicRead:true,websocketEvent:true,staleVersionRejected:true}));
   const password=require('node:crypto').randomBytes(18).toString('hex');
   testPlayer=await client.createUser({name:'Teste de atualização automática',username:'sync-test-'+Date.now(),password,role:'player'});
   await client.assign(created.id,testPlayer.id);
   const player=new OnlineClient({fetch:(...args)=>net.fetch(...args)});const playerData=await player.login({username:testPlayer.username,password});
   assert.ok(playerData.characters.some(c=>c.id===created.id));assert.ok(playerData.characters.every(c=>c.ownerUserId===testPlayer.id));
   playerSocket=new WebSocket(player.baseUrl.replace(/^http/,'ws')+'/events?token='+player.token);
   const playerEvents=[];await new Promise((resolve,reject)=>{playerSocket.on('message',bytes=>{const event=JSON.parse(bytes);playerEvents.push(event);if(event.type==='connected')resolve()});playerSocket.on('error',reject);setTimeout(()=>reject(new Error('Jogador não conectou')),15000).unref()});
   const fresh=await client.request('/characters/'+created.id);
   await client.save({...fresh.data,id:fresh.id,_remoteVersion:fresh.version,notes:'Mestre atualizou e jogador recebeu'});
   await new Promise(resolve=>setTimeout(resolve,400));assert.ok(playerEvents.some(e=>e.type==='character.updated'&&e.characterId===created.id));
   const latest=await player.load();assert.equal(latest.characters.find(c=>c.id===created.id).notes,'Mestre atualizou e jogador recebeu');
   console.log(JSON.stringify({playerReceivedMasterUpdate:true,playerOnlySeesAssignedCharacters:true}));
   const baseline=await client.request('/characters/'+created.id);
   const progressed=await client.request('/characters/'+created.id,'PUT',{version:baseline.version,data:{...baseline.data,ideas:[{id:'test-idea',name:'Teste de criação',status:'Em desenvolvimento'}],creations:[{ideaId:'test-idea',name:'Teste de criação',current:0,requirement:40}],abilities:[{name:'Mochila de teste',level:1,useCurrent:25,useGoal:25}]}});
   assert.equal(progressed.data.creations.length,0);assert.equal(progressed.data.ideas[0].creationCompleted,true);assert.equal(progressed.data.abilities[0].level,2);assert.equal(progressed.data.abilities[0].useCurrent,0);
   const next=await client.request('/characters/'+created.id,'PUT',{version:progressed.version,data:{...progressed.data,creations:[{name:'Próximo aprendizado',current:40,requirement:40}]}});
   assert.equal(next.data.creations.length,1);
   console.log(JSON.stringify({apiReleasesCompletedCreation:true,apiAutomaticLevelTwo:true,nextLearningAllowed:true}));
   const playerBeforeDelete=await player.request('/characters/'+created.id);
   const deleted=await player.request('/characters/'+created.id,'PUT',{version:playerBeforeDelete.version,data:{...playerBeforeDelete.data,ideas:[],abilities:[],creations:[]}});
   const deletedRead=await player.request('/characters/'+created.id);assert.equal(deletedRead.data.ideas.length,0);assert.equal(deletedRead.data.abilities.length,0);
   const grant=await client.request('/characters/'+created.id,'PUT',{version:deleted.version,data:{...deleted.data,attributes:{Força:10},skills:[{name:'Teste',value:9}],pointPools:{attributes:2,skills:4}}});
   const spent=await player.request('/characters/'+created.id,'PUT',{version:grant.version,data:{...grant.data,attributes:{Força:11},skills:[{name:'Teste',value:11}],pointPools:{attributes:1,skills:1}}});
   assert.equal(spent.data.pointPools.skills,1);
   console.log(JSON.stringify({playerDeletedIdeasAndAbilities:true,playerSavedSpentPoints:true}));
   const backpack=await player.request('/characters/'+created.id,'PUT',{version:spent.version,data:{...spent.data,profile:{...spent.data.profile,coins:80},backpack:{petFood:12,travelMeals:3,specialPetFood:4,jobs:[{name:'Caçador',value:'25'}],items:['Barraca']},inventory:'Anotação do jogador'}});
   const backpackRead=await player.request('/characters/'+created.id);assert.equal(backpackRead.data.profile.coins,80);assert.deepEqual(backpackRead.data.backpack,backpack.data.backpack);assert.equal(backpackRead.data.inventory,'Anotação do jogador');console.log(JSON.stringify({playerBackpackSavedOnline:true}));
   const recognized=await client.request('/characters/'+created.id,'PUT',{version:backpackRead.version,data:{...backpackRead.data,profile:{...backpackRead.data.profile,recognized:'Sim'}}});
   await assert.rejects(()=>player.request('/characters/'+created.id,'PUT',{version:recognized.version,data:{...recognized.data,profile:{...recognized.data.profile,recognized:'Não'}}}),e=>e.status===403);
   await assert.rejects(()=>client.request('/characters/'+created.id,'PUT',{version:recognized.version,data:{...recognized.data,profile:{...recognized.data.profile,recognized:'Talvez'}}}),e=>e.status===400);
   console.log(JSON.stringify({recognizedMasterOnly:true,recognizedYesNoOnly:true}));
  }finally{playerSocket?.close();if(created)await client.request('/characters/'+created.id,'DELETE');if(testPlayer)await client.request('/users/'+testPlayer.id,'DELETE');socket.close()}
  app.exit(0);
 }catch(error){console.error(error.message);app.exit(1)}
});
