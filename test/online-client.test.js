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
test('login usa outra conexão quando a rede do Electron falha',async()=>{
 let fallbackCalls=0;
 const client=new OnlineClient({fetch:async()=>{throw Object.assign(new Error('Falha do Electron'),{code:23})},fallbackFetch:async(url)=>{
  fallbackCalls++;
  const route=new URL(url).pathname;
  const data=route==='/auth/login'?{token:'token',user:{id:'player',role:'player'}}:route==='/campaigns'?[{id:'campaign',kind:'real'}]:route.endsWith('/characters')?[]:{};
  return {ok:true,text:async()=>JSON.stringify(data)};
 }});
 const loaded=await client.login({username:'player',password:'test'});
 assert.equal(loaded.sessionUser.id,'player');
 assert.equal(fallbackCalls,4);
});
test('writes are not blindly retried after an uncertain network failure',async()=>{
 let attempts=0,fallbackCalls=0;const client=new OnlineClient({fetch:async()=>{attempts++;throw Object.assign(new Error('changed'),{code:'ERR_NETWORK_CHANGED'})},fallbackFetch:async()=>{fallbackCalls++}});
 await assert.rejects(()=>client.request('/characters/a','PUT',{}),/ERR_NETWORK_CHANGED/);assert.equal(attempts,1);assert.equal(fallbackCalls,0);
});
test('appearance presets save, overwrite, load and delete on the signed-in account',async()=>{
 const calls=[];const client=new OnlineClient({fetch:async(url,options)=>{calls.push([new URL(url).pathname,options.method]);return {ok:true,text:async()=>JSON.stringify({id:'user',role:'player',appearance:{presets:[]}})}}});
 await client.saveAppearancePreset('Noite');
 await client.overwriteAppearancePreset('preset-id');
 await client.applyAppearancePreset('preset-id');
 await client.deleteAppearancePreset('preset-id');
 assert.deepEqual(calls,[['/me/appearance-presets','POST'],['/me/appearance-presets/preset-id','PUT'],['/me/appearance-presets/preset-id/apply','POST'],['/me/appearance-presets/preset-id','DELETE']]);
});
test('perícia particular é cadastrada pela rota da ficha, não nas configurações da campanha',async()=>{
 let route,body;
 const client=new OnlineClient({fetch:async(url,options)=>{route=new URL(url).pathname;body=JSON.parse(options.body);return {ok:true,text:async()=>'{"id":"hero","version":2}'}}});
 await client.addPersonalSkill('hero',{name:'Perícia particular',category:'Outras',description:''});
 assert.equal(route,'/characters/hero/personal-skills');
 assert.equal(body.name,'Perícia particular');
});
