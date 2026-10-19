const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {OnlineClient}=require('./online-client');
const {mergeCharacter}=require('./merge-character');
module.exports=function installOnline({ipcMain,net,dialog,shell,clipboard,nativeImage,DATA_ROOT,MEDIA_ROOT,changesBetween,readAbilityTable,unpackedPath}){
 const sessions=new Map();
 const mimeOf=file=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[path.extname(file).toLowerCase()];
 const session=event=>{const s=sessions.get(event.sender.id);if(!s)throw new Error('Sessão expirada. Entre novamente.');return s};
 const handle=(name,fn)=>{ipcMain.removeHandler(name);ipcMain.handle(name,fn)};
 const notify=s=>{if(!s.sender.isDestroyed())s.sender.send('online:changed')};
 const localPresets=s=>{try{const value=JSON.parse(fs.readFileSync(s.presetsFile,'utf8'));return Array.isArray(value)?value:[]}catch{return []}};
 const writeLocalPresets=(s,presets)=>{fs.mkdirSync(DATA_ROOT,{recursive:true});fs.writeFileSync(s.presetsFile,JSON.stringify(presets),'utf8')};
 const withLocalPresets=(s,appearance)=>{const remote=appearance||{},presets=Array.isArray(remote.presets)?remote.presets:[],seen=new Set(presets.map(preset=>preset.id));return {...remote,presets:[...presets,...localPresets(s).filter(preset=>!seen.has(preset.id))]}};
 const presetImagePath=(s,id,mime)=>path.join(DATA_ROOT,'appearance-presets',`${s.client.user.id}-${id}${({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif' })[mime]||''}`);
 async function saveLocalPreset(s,name){const label=String(name||'').trim(),appearance=s.appearance||{},presets=localPresets(s);if(!label||label.length>60)throw new Error('O nome do estilo deve ter até 60 caracteres.');if((appearance.presets||[]).length>=12)throw new Error('Limite de 12 estilos salvos por conta.');if((appearance.presets||[]).some(preset=>String(preset.name).toLocaleLowerCase('pt-BR')===label.toLocaleLowerCase('pt-BR')))throw new Error('Já existe um estilo com esse nome.');const id=crypto.randomUUID(),style=Object.fromEntries(['bg','bg2','panel','panel2','sidebar','input','line','accent','accent2','text','muted','gold','danger','toast','toastError','dirtyBar','gradientEnabled','gradientAngle'].filter(key=>appearance[key]!==undefined).map(key=>[key,appearance[key]])),preset={id,name:label,style,local:true,backgroundMime:null};if(appearance.backgroundPath){const response=await net.fetch(`${s.client.baseUrl}/me/background`,{headers:{Authorization:`Bearer ${s.client.token}`}});if(response.ok){const mime=response.headers.get('content-type')?.split(';')[0];if(mime&&path.extname(presetImagePath(s,id,mime))){const file=presetImagePath(s,id,mime);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));preset.backgroundMime=mime}}}writeLocalPresets(s,[...presets,preset]);return saveAppearance(s)}
 async function applyLocalPreset(s,id){const preset=localPresets(s).find(item=>item.id===id);if(!preset)throw new Error('Estilo não encontrado.');await s.client.updateAppearance(preset.style);if(preset.backgroundMime){const file=presetImagePath(s,id,preset.backgroundMime);if(!fs.existsSync(file))throw new Error('A imagem salva neste estilo não foi encontrada.');await s.client.uploadBackground(fs.readFileSync(file),preset.backgroundMime)}else await s.client.removeBackground();return saveAppearance(s)}
 function deleteLocalPreset(s,id){const presets=localPresets(s),preset=presets.find(item=>item.id===id);if(!preset)throw new Error('Estilo não encontrado.');writeLocalPresets(s,presets.filter(item=>item.id!==id));if(preset.backgroundMime){const file=presetImagePath(s,id,preset.backgroundMime);try{fs.unlinkSync(file)}catch{}}return saveAppearance(s)}
 function stop(s){if(!s)return;s.closed=true;clearInterval(s.timer);clearTimeout(s.reconnect);s.socket?.close()}
 function connect(s){
  if(s.closed)return;
  if(typeof globalThis.WebSocket!=='function')return;
  const url=s.client.baseUrl.replace(/^http/,'ws')+`/events?token=${encodeURIComponent(s.client.token)}`;
  const socket=s.socket=new WebSocket(url);
  const reconnect=()=>{if(s.closed||s.reconnect)return;s.reconnect=setTimeout(()=>{s.reconnect=null;connect(s)},5000);s.reconnect.unref?.()};
  socket.onmessage=event=>{try{const data=JSON.parse(event.data);if(data.type!=='connected')notify(s)}catch{}};
  socket.onerror=reconnect;socket.onclose=()=>{if(s.socket===socket)s.socket=null;reconnect()};
 }
 async function load(s){const data=await s.client.load(),remote=s.client.user.appearance||{};s.appearance=withLocalPresets(s,Object.keys(remote).length?remote:s.appearance||{});data.sessionUser.appearance=s.appearance;s.snapshot=data;s.versions||=new Map();for(const c of data.characters)s.versions.set(`${c.id}:${c._remoteVersion}`,structuredClone(c));while(s.versions.size>100)s.versions.delete(s.versions.keys().next().value);return data}
 handle('auth:status',()=>({hasUsers:true,online:true}));
 handle('auth:setup',()=>{throw new Error('A instalação online já está configurada. Entre com sua conta da campanha.')});
 handle('auth:login',async(event,data)=>{
  stop(sessions.get(event.sender.id));sessions.delete(event.sender.id);
  const client=new OnlineClient({fetch:(...args)=>net.fetch(...args)});await client.login(data);
  const preferenceFile=path.join(DATA_ROOT,`appearance-${client.user.id}.json`);let appearance={};try{appearance=JSON.parse(fs.readFileSync(preferenceFile,'utf8'))}catch{}
  if(Object.keys(client.user.appearance||{}).length)appearance=client.user.appearance;const s={client,sender:event.sender,preferenceFile,presetsFile:path.join(DATA_ROOT,`appearance-presets-${client.user.id}.json`),appearance};sessions.set(event.sender.id,s);
  event.sender.once('destroyed',()=>{stop(s);sessions.delete(event.sender.id)});
  connect(s);
  s.timer=setInterval(async()=>{if(s.polling||s.closed)return;s.polling=true;try{const latest=await client.load();const signature=JSON.stringify([latest.characters,latest.settings,latest.users]);if(s.signature&&signature!==s.signature)notify(s);s.signature=signature}catch(error){if(!s.sender.isDestroyed())s.sender.send('online:status',{connected:false,message:error.message})}finally{s.polling=false}},5000);
  s.timer.unref();return load(s);
 });
 handle('auth:logout',event=>{stop(sessions.get(event.sender.id));sessions.delete(event.sender.id);return true});
 handle('auth:change-password',(event,data)=>session(event).client.request('/me/password','PUT',data));
 function saveAppearance(s,user=s.client.user){s.appearance=withLocalPresets(s,user.appearance||{});fs.mkdirSync(DATA_ROOT,{recursive:true});fs.writeFileSync(s.preferenceFile,JSON.stringify(s.appearance));return {...user,appearance:s.appearance}}
 handle('auth:update-appearance',async(event,data)=>{const s=session(event),user=await s.client.updateAppearance(data);user.appearance={...data,...(user.appearance||{})};return saveAppearance(s,user)});
 handle('auth:save-appearance-preset',async(event,name)=>{const s=session(event);try{return saveAppearance(s,await s.client.saveAppearancePreset(name))}catch(error){if(error.status!==404)throw error;return saveLocalPreset(s,name)}});
 handle('auth:apply-appearance-preset',async(event,id)=>{const s=session(event);const local=localPresets(s).some(item=>item.id===id);if(local)return applyLocalPreset(s,id);return saveAppearance(s,await s.client.applyAppearancePreset(id))});
 handle('auth:delete-appearance-preset',async(event,id)=>{const s=session(event);const local=localPresets(s).some(item=>item.id===id);if(local)return deleteLocalPreset(s,id);return saveAppearance(s,await s.client.deleteAppearancePreset(id))});
 handle('auth:cached-appearance',event=>{const s=session(event);try{return JSON.parse(fs.readFileSync(s.preferenceFile,'utf8'))}catch{return null}});
 handle('clipboard:read-text',event=>{session(event);return clipboard.readText()});
 handle('auth:choose-background',async event=>{const s=session(event),chosen=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Imagem',extensions:['png','jpg','jpeg','webp','gif']}]});if(chosen.canceled)return null;const source=chosen.filePaths[0],mime=mimeOf(source);if(!mime)throw new Error('Formato de imagem não permitido.');const user=await s.client.uploadBackground(fs.readFileSync(source),mime);return saveAppearance(s,user)});
 handle('auth:remove-background',async event=>{const s=session(event),user=await s.client.removeBackground();return saveAppearance(s,user)});
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
  if(character._remoteVersion&&before){const latest=(await s.client.load()).characters.find(c=>c.id===character.id);if(!latest)throw new Error('A ficha foi removida ou você não tem mais acesso.');if(latest._remoteVersion!==character._remoteVersion){character=mergeCharacter(before,character,latest,{preferRemote:s.client.user.role==='player'?['receptacleCapacity']:[]});before=latest}}
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
 handle('db:export-backup',async event=>{const s=session(event);if(s.client.user.role!=='admin')throw new Error('Somente a mestre pode criar backups.');const backup=await s.client.backup(),result=await dialog.showSaveDialog({defaultPath:`Backup RPG Fichas ${new Date().toISOString().slice(0,10)}.rpgbackup`,filters:[{name:'Backup RPG Fichas',extensions:['rpgbackup']}]});if(result.canceled)return false;fs.writeFileSync(result.filePath,JSON.stringify(backup),'utf8');return true});
 handle('db:restore-backup',async event=>{const s=session(event);if(s.client.user.role!=='admin')throw new Error('Somente a mestre pode restaurar backups.');const chosen=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Backup RPG Fichas',extensions:['rpgbackup','json']}]});if(chosen.canceled)return null;let backup;try{backup=JSON.parse(fs.readFileSync(chosen.filePaths[0],'utf8'))}catch{throw new Error('O arquivo escolhido não é um backup válido.')}await s.client.restore(backup);return load(s)});
 handle('db:update-attributes',async(event,names)=>{
  const s=session(event);if(s.client.user.role!=='admin')throw new Error('Somente a mestre pode alterar atributos.');
  const next=names.map(v=>String(v).trim()).filter(Boolean);if(!next.length||new Set(next.map(v=>v.toLowerCase())).size!==next.length)throw new Error('Informe atributos sem nomes repetidos.');
  const db=await load(s),previous=db.settings.attributeNames||[];
  for(const character of db.characters){const old=character.attributes||{};character.attributes=Object.fromEntries(next.map((name,index)=>[name,Number(old[previous[index]]??old[name])||1]));await s.client.save(character)}
  await s.client.settings({...db.settings,attributeNames:next});return load(s);
 });
 handle('db:update-skill-catalog',async(event,skills)=>{
  const s=session(event);if(s.client.user.role!=='admin')throw new Error('Somente a mestre pode cadastrar perícias.');
  const next=(Array.isArray(skills)?skills:[]).map(skill=>({name:String(skill.name||'').trim(),category:String(skill.category||'Outras').trim()||'Outras',description:String(skill.description||'').trim()})).filter(skill=>skill.name);
  const db=await load(s),baseNames=new Set((db.settings.customSkillCatalog||[]).map(skill=>String(skill.name||'').toLowerCase()));if(new Set(next.map(skill=>skill.name.toLowerCase())).size!==next.length)throw new Error('Não pode haver perícias repetidas.');
  await s.client.settings({...db.settings,customSkillCatalog:next});return load(s);
 });
 handle('db:update-tables',async(event,tables)=>{
  const s=session(event);if(s.client.user.role!=='admin')throw new Error('Somente a mestre pode organizar mesas.');
  const next=(Array.isArray(tables)?tables:[]).map(table=>({id:String(table.id||'').trim(),name:String(table.name||'').trim()}));
  if(next.length>100||next.some(table=>!table.id||!table.name||table.name.length>80)||new Set(next.map(table=>table.name.toLocaleLowerCase('pt-BR'))).size!==next.length||new Set(next.map(table=>table.id)).size!==next.length)throw new Error('Informe nomes de mesas válidos e sem repetição.');
  const db=await load(s);await s.client.settings({...db.settings,tables:next});return load(s);
 });
 for(const [channel,remove]of [['db:save-npc',false],['db:delete-npc',true]])handle(channel,async(event,value)=>{const s=session(event),db=await load(s);const npcs=db.npcs.filter(npc=>npc.id!==(remove?value:value.id));if(!remove)npcs.push(value);await s.client.settings({...db.settings,npcs});return load(s)});
 handle('media:choose',async(event,key)=>{const s=session(event),character=s.snapshot.characters.find(c=>key===c.id||key.startsWith(c.id+'-'));if(!character)throw new Error('Salve a ficha antes de adicionar imagens.');const chosen=await dialog.showOpenDialog({properties:['openFile','multiSelections'],filters:[{name:'Imagens',extensions:['png','jpg','jpeg','webp','gif']}]});if(chosen.canceled)return [];return Promise.all(chosen.filePaths.map(async file=>({id:require('node:crypto').randomUUID(),name:path.basename(file),path:await s.client.upload(character.id,fs.readFileSync(file),path.basename(file),mimeOf(file)),addedAt:new Date().toISOString()})))});
 handle('media:data-url',async(event,file)=>{const s=session(event);if(file==='/me/background'||/^\/media\/[a-f0-9-]+$/i.test(file)){const response=await net.fetch(s.client.baseUrl+file,{headers:{Authorization:`Bearer ${s.client.token}`}});if(!response.ok)return '';return `data:${response.headers.get('content-type')};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`}const resolved=path.resolve(file);if(resolved!==s.appearance?.backgroundPath&&!resolved.startsWith(path.resolve(MEDIA_ROOT)+path.sep))return '';try{return `data:${mimeOf(file)||'image/png'};base64,${fs.readFileSync(resolved).toString('base64')}`}catch{return ''}});
 handle('media:copy-image',async(event,file)=>{const s=session(event);let buffer;if(/^\/media\/[a-f0-9-]+$/i.test(file)){const response=await net.fetch(s.client.baseUrl+file,{headers:{Authorization:`Bearer ${s.client.token}`}});if(!response.ok)throw new Error('Não foi possível baixar esta imagem.');buffer=Buffer.from(await response.arrayBuffer())}else{const resolved=path.resolve(file);if(!resolved.startsWith(path.resolve(MEDIA_ROOT)+path.sep))throw new Error('Esta imagem não pertence ao aplicativo.');buffer=fs.readFileSync(resolved)}const image=nativeImage.createFromBuffer(buffer);if(image.isEmpty())throw new Error('Não foi possível ler esta imagem.');clipboard.writeImage(image);return true});
 handle('ocr:abilities',async(event,id)=>{const s=session(event);if(!s.snapshot.characters.some(c=>c.id===id))throw new Error('Ficha indisponível.');const chosen=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Tabela',extensions:['png','jpg','jpeg','webp','bmp']}]});if(chosen.canceled)return {canceled:true,abilities:[]};const source=chosen.filePaths[0],abilities=await readAbilityTable(source,{langPath:unpackedPath(path.join('assets','ocr')),gzip:false,cachePath:path.join(DATA_ROOT,'ocr-cache'),workerPath:unpackedPath(path.join('node_modules','tesseract.js','src','worker-script','node','index.js'))});const mime=mimeOf(source);return {canceled:false,filePath:source,abilities,media:mime?{id:require('node:crypto').randomUUID(),name:path.basename(source),path:await s.client.upload(id,fs.readFileSync(source),path.basename(source),mime),addedAt:new Date().toISOString()}:undefined}});
 handle('file:export-text',async(event,character,text,name)=>{const s=session(event);if(!s.snapshot.characters.some(c=>c.id===character.id))throw new Error('Ficha indisponível.');const result=await dialog.showSaveDialog({defaultPath:`${String(name||character.name).replace(/[<>:"/\\|?*]/g,'_')}.txt`,filters:[{name:'Texto',extensions:['txt']}]});if(result.canceled)return false;fs.writeFileSync(result.filePath,text,'utf8');return true});
 handle('data:open-folder',event=>{session(event);return shell.openPath(DATA_ROOT)});
};
