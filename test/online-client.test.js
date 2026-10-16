const test=require('node:test');
const assert=require('node:assert/strict');
const {OnlineClient}=require('../online-client');
test('online login reads campaign, remote versions and assigned owner',async()=>{
 const paths=[];const responses={
  '/auth/login':{token:'token',user:{id:'master',role:'primary_master'}},'/campaigns':[{id:'campaign',kind:'real'}],
  '/campaigns/campaign/characters':[{id:'character',name:'Nome online',owner_user_id:'player',version:9,data:{name:'Nome antigo'}}],
  '/campaigns/campaign/characters?archived=true':[], '/campaigns/campaign/settings':{attributeNames:['Força']},'/users':[{id:'player',role:'player',active:true}]
 };
 const client=new OnlineClient({fetch:async url=>{const key=new URL(url).pathname+new URL(url).search;paths.push(key);return {ok:true,text:async()=>JSON.stringify(responses[key])}}});
 const data=await client.login({username:'master',password:'test'});
 assert.equal(data.sessionUser.role,'admin');assert.equal(data.characters[0]._remoteVersion,9);assert.equal(data.characters[0].ownerUserId,'player');assert.equal(data.characters[0].name,'Nome online');assert.ok(paths.includes('/campaigns/campaign/characters'));
});
test('save sends original version and removes client metadata',async()=>{
 let sent;const client=new OnlineClient({fetch:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,text:async()=>JSON.stringify({id:'a',version:3})}}});
 await client.save({id:'a',name:'A',changeSource:'txt-import',_remoteVersion:2,_remoteCampaignId:'c'});
 assert.equal(sent.version,2);assert.equal(sent.data._remoteVersion,undefined);assert.equal(sent.source,'txt-import');assert.equal(sent.data.changeSource,'txt-import');
});
test('network failure never falls back to the local database',async()=>{
 const client=new OnlineClient({fetch:async()=>{throw new Error('offline')}});
 await assert.rejects(()=>client.login({}),/conectar ao servidor online/);
});
test('temporary read failure is retried',async()=>{
 let attempts=0;const client=new OnlineClient({fetch:async()=>{attempts++;if(attempts===1)throw Object.assign(new Error('changed'),{code:'ERR_NETWORK_CHANGED'});return {ok:true,text:async()=>'{"ok":true}'}}});
 assert.equal((await client.request('/health')).ok,true);assert.equal(attempts,2);
});
test('writes are not blindly retried after an uncertain network failure',async()=>{
 let attempts=0;const client=new OnlineClient({fetch:async()=>{attempts++;throw Object.assign(new Error('changed'),{code:'ERR_NETWORK_CHANGED'})}});
 await assert.rejects(()=>client.request('/characters/a','PUT',{}),/ERR_NETWORK_CHANGED/);assert.equal(attempts,1);
});
