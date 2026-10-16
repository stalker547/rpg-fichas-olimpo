const fs=require('node:fs');
const path=require('node:path');
const {OnlineClient}=require('./online-client');
const {mergeCharacter}=require('./merge-character');
module.exports=function installOnline({ipcMain,net,dialog,shell,DATA_ROOT,MEDIA_ROOT,changesBetween,readAbilityTable,unpackedPath}){
 const sessions=new Map();
 const mimeOf=file=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[path.extname(file).toLowerCase()];
 const session=event=>{const s=sessions.get(event.sender.id);if(!s)throw new Error('Sessão expirada. Entre novamente.');return s};
 const handle=(name,fn)=>{ipcMain.removeHandler(name);ipcMain.handle(name,fn)};
 const notify=s=>{if(!s.sender.isDestroyed())s.sender.send('online:changed')};
 function stop(s){if(!s)return;s.closed=true;clearInterval(s.timer);clearTimeout(s.reconnect);s.socket?.close()}
 function connect(s){
  if(s.closed)return;
  if(typeof globalThis.WebSocket!=='function')return;
  const url=s.client.baseUrl.replace(/^http/,'ws')+`/events?token=${encodeURIComponent(s.client.token)}`;
  const socket=s.socket=new WebSocket(url);
  socket.onmessage=event=>{try{const data=JSON.parse(event.data);if(data.type!=='connected')notify(s)}catch{}};
  socket.onerror=()=>socket.close();socket.onclose=()=>{if(!s.closed)s.reconnect=setTimeout(()=>connect(s),5000)};
 }
 async function load(s){const data=await s.client.load();data.sessionUser.appearance=s.appearance||{};s.snapshot=data;s.versions||=new Map();for(const c of data.characters)s.versions.set(`${c.id}:${c._remoteVersion}`,structuredClone(c));while(s.versions.size>100)s.versions.delete(s.versions.keys().next().value);return data}
 handle('auth:status',()=>({hasUsers:true,online:true}));
 handle('auth:setup',()=>{throw new Error('A instalação online já está configurada. Entre com sua conta da campanha.')});
 handle('auth:login',async(event,data)=>{
  stop(sessions.get(event.sender.id));sessions.delete(event.sender.id);
  const client=new OnlineClient({fetch:(...args)=>net.fetch(...args)});await client.login(data);
  const preferenceFile=path.join(DATA_ROOT,`appearance-${client.user.id}.json`);let appearance={};try{appearance=JSON.parse(fs.readFileSync(preferenceFile,'utf8'))}catch{}
  const s={client,sender:event.sender,preferenceFile,appearance};sessions.set(event.sender.id,s);
  event.sender.once('destroyed',()=>{stop(s);sessions.delete(event.sender.id)});
  connect(s);
  s.timer=setInterval(async()=>{if(s.polling||s.closed)return;s.polling=true;try{const latest=await client.load();const signature=JSON.stringify([latest.characters,latest.settings,latest.users]);if(s.signature&&signature!==s.signature)notify(s);s.signature=signature}catch(error){if(!s.sender.isDestroyed())s.sender.send('online:status',{connected:false,message:error.message})}finally{s.polling=false}},5000);
  s.timer.unref();return load(s);
 });
 handle('auth:logout',event=>{stop(sessions.get(event.sender.id));sessions.delete(event.sender.id);return true});
 handle('auth:change-password',(event,data)=>session(event).client.request('/me/password','PUT',data));
 function saveAppearance(s){fs.mkdirSync(DATA_ROOT,{recursive:true});fs.writeFileSync(s.preferenceFile,JSON.stringify(s.appearance));return {...s.client.user,appearance:s.appearance}}
 handle('auth:update-appearance',(event,data)=>{const s=session(event);for(const key of ['bg','panel','sidebar','accent','text','muted'])if(!/^#[0-9a-f]{6}$/i.test(data?.[key]||''))throw new Error('Cor inválida.');s.appearance={...s.appearance,...data};return saveAppearance(s)});
 handle('auth:choose-background',async event=>{const s=session(event),chosen=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Imagem',extensions:['png','jpg','jpeg','webp','gif']}]});if(chosen.canceled)return null;const source=chosen.filePaths[0],destination=path.join(MEDIA_ROOT,`background-${s.client.user.id}${path.extname(source)}`);fs.mkdirSync(MEDIA_ROOT,{recursive:true});fs.copyFileSync(source,destination);s.appearance={...s.appearance,backgroundPath:destination};return saveAppearance(s)});
 handle('auth:remove-background',event=>{const s=session(event);s.appearance={...s.appearance,backgroundPath:''};return saveAppearance(s)});
 handle('db:load',event=>load(session(event)));
 handle('auth:create-user',async(event,data)=>{const s=session(event);await s.client.createUser(data);return load(s)});
 handle('auth:assign-character',async(event,id,owner)=>{const s=session(event);await s.client.assign(id,owner);return load(s)});
 handle('auth:delete-user',async(event,id)=>{const s=session(event);await s.client.request(`/users/${id}`,'DELETE');return load(s)});
 async function uploadPaths(s,id,value){
  if(!value||typeof value!=='object')return;
  for(const [key,item]of Object.entries(value)){
   if(key==='path'&&typeof item==='string'&&!item.startsWith('/media/')){
    const resolved=path.resolve(item);if(!resolved.startsWith(path.resolve(MEDIA_ROOT)+path.sep)||!fs.existsSync(resolved))continue;
    const mime=mimeOf(resolved);if(mime)value[key]=await s.client.upload(id,fs.readFileSync(resolved),path.basename(resolved),mime);
   }else if(item&&typeof item==='object')await uploadPaths(s,id,item);
  }
 }
 handle('db:save-character',async(event,input,settings)=>{
  const s=session(event);let character=structuredClone(input);
  fs.mkdirSync(DATA_ROOT,{recursive:true});
  const pendingFile=path.join(DATA_ROOT,`pending-online-${s.client.user.id}-${String(character.id).replace(/[^a-zA-Z0-9_-]/g,'_')}.json`);
  fs.writeFileSync(pendingFile,JSON.stringify({savedAt:new Date().toISOString(),character,settings}),'utf8');
  let before=s.versions?.get(`${character.id}:${character._remoteVersion}`)||s.snapshot?.characters.find(c=>c.id===character.id);
  if(character._remoteVersion&&before){const latest=(await s.client.load()).characters.find(c=>c.id===character.id);if(!latest)throw new Error('A ficha foi removida ou você não tem mais acesso.');if(latest._remoteVersion!==character._remoteVersion){character=mergeCharacter(before,character,latest);before=latest}}
  const changes=changesBetween(before,character);
  character.history=structuredClone(character.history||before?.history||[]);if(changes.length)character.history.unshift({id:require('node:crypto').randomUUID(),at:new Date().toISOString(),note:character.changeNote||'Alteração manual',changes,userName:s.client.user.name,userId:s.client.user.id,userRole:s.client.user.role});
  if(character._remoteVersion)await uploadPaths(s,character.id,character);
  const row=await s.client.save(character);
  if(!character._remoteVersion){character.id=row.id;character._remoteVersion=row.version;await uploadPaths(s,row.id,character);await s.client.save(character)}
  if(s.client.user.role==='admin'&&settings&&JSON.stringify(settings)!==JSON.stringify(s.snapshot?.settings))await s.client.settings(settings);
  if(s.client.user.role==='player'&&settings){const id=s.client.user.id,amount=Number(settings.solosByUser?.[id])||0;if(amount!==(Number(s.snapshot?.settings?.solosByUser?.[id])||0))await s.client.request(`/campaigns/${s.client.campaign.id}/solos`,'PATCH',{amount})}
  const db=await load(s);fs.unlinkSync(pendingFile);return {db,changes,characterId:row.id};
 });
 handle('db:delete-character',async(event,id)=>{const s=session(event);await s.client.request(`/characters/${id}`,'DELETE');return load(s)});
 handle('db:update-attributes',async(event,names)=>{
  const s=session(event);if(s.client.user.role!=='admin')throw new Error('Somente a mestre pode alterar atributos.');
  const next=names.map(v=>String(v).trim()).filter(Boolean);if(!next.length||new Set(next.map(v=>v.toLowerCase())).size!==next.length)throw new Error('Informe atributos sem nomes repetidos.');
  const db=await load(s),previous=db.settings.attributeNames||[];
  for(const character of db.characters){const old=character.attributes||{};character.attributes=Object.fromEntries(next.map((name,index)=>[name,Number(old[previous[index]]??old[name])||1]));await s.client.save(character)}
  await s.client.settings({...db.settings,attributeNames:next});return load(s);
 });
 for(const [channel,remove]of [['db:save-npc',false],['db:delete-npc',true]])handle(channel,async(event,value)=>{const s=session(event),db=await load(s);const npcs=db.npcs.filter(npc=>npc.id!==(remove?value:value.id));if(!remove)npcs.push(value);await s.client.settings({...db.settings,npcs});return load(s)});
 handle('media:choose',async(event,key)=>{const s=session(event),character=s.snapshot.characters.find(c=>key===c.id||key.startsWith(c.id+'-'));if(!character)throw new Error('Salve a ficha antes de adicionar imagens.');const chosen=await dialog.showOpenDialog({properties:['openFile','multiSelections'],filters:[{name:'Imagens',extensions:['png','jpg','jpeg','webp','gif']}]});if(chosen.canceled)return [];return Promise.all(chosen.filePaths.map(async file=>({id:require('node:crypto').randomUUID(),name:path.basename(file),path:await s.client.upload(character.id,fs.readFileSync(file),path.basename(file),mimeOf(file)),addedAt:new Date().toISOString()})))});
 handle('media:data-url',async(event,file)=>{const s=session(event);if(/^\/media\/[a-f0-9-]+$/i.test(file)){const response=await net.fetch(s.client.baseUrl+file,{headers:{Authorization:`Bearer ${s.client.token}`}});if(!response.ok)return '';return `data:${response.headers.get('content-type')};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`}const resolved=path.resolve(file);if(resolved!==s.appearance?.backgroundPath&&!resolved.startsWith(path.resolve(MEDIA_ROOT)+path.sep))return '';try{return `data:${mimeOf(file)||'image/png'};base64,${fs.readFileSync(resolved).toString('base64')}`}catch{return ''}});
 handle('ocr:abilities',async(event,id)=>{const s=session(event);if(!s.snapshot.characters.some(c=>c.id===id))throw new Error('Ficha indisponível.');const chosen=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Tabela',extensions:['png','jpg','jpeg','webp','bmp']}]});if(chosen.canceled)return {canceled:true,abilities:[]};const source=chosen.filePaths[0],abilities=await readAbilityTable(source,{langPath:unpackedPath(path.join('assets','ocr')),gzip:false,cachePath:path.join(DATA_ROOT,'ocr-cache'),workerPath:unpackedPath(path.join('node_modules','tesseract.js','src','worker-script','node','index.js'))});const mime=mimeOf(source);return {canceled:false,filePath:source,abilities,media:mime?{id:require('node:crypto').randomUUID(),name:path.basename(source),path:await s.client.upload(id,fs.readFileSync(source),path.basename(source),mime),addedAt:new Date().toISOString()}:undefined}});
 handle('file:export-text',async(event,character,text,name)=>{const s=session(event);if(!s.snapshot.characters.some(c=>c.id===character.id))throw new Error('Ficha indisponível.');const result=await dialog.showSaveDialog({defaultPath:`${String(name||character.name).replace(/[<>:"/\\|?*]/g,'_')}.txt`,filters:[{name:'Texto',extensions:['txt']}]});if(result.canceled)return false;fs.writeFileSync(result.filePath,text,'utf8');return true});
 handle('data:open-folder',event=>{session(event);return shell.openPath(DATA_ROOT)});
};
