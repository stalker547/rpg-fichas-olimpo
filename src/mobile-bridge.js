(function(){
 if(window.rpg||!window.Capacitor?.isNativePlatform?.())return;
 document.body.classList.add('mobile-platform');
 const rememberLabel=document.querySelector('#remember-login-field span');if(rememberLabel)rememberLabel.textContent='Lembrar usuário e senha neste celular';
 const loginPassword=document.querySelector('#login-password');
 if(loginPassword){
  loginPassword.autocomplete='new-password';
  loginPassword.setAttribute('autocorrect','off');
  loginPassword.setAttribute('autocapitalize','none');
  loginPassword.setAttribute('spellcheck','false');
  loginPassword.setAttribute('name','rpg-login-password');
  let typedPassword='';
  loginPassword.addEventListener('beforeinput',event=>{loginPassword.dataset.inputType=event.inputType||''});
  loginPassword.addEventListener('input',event=>{
   const inputType=event.inputType||loginPassword.dataset.inputType||'';
   const deleting=inputType.startsWith('delete');
   if(!loginPassword.value&&typedPassword&&!deleting&&document.activeElement===loginPassword){
    loginPassword.value=typedPassword;
    loginPassword.setSelectionRange(typedPassword.length,typedPassword.length);
    return;
   }
   typedPassword=loginPassword.value;
  });
  loginPassword.addEventListener('focus',()=>{typedPassword=loginPassword.value});
 }
 const API='https://olimpo.astratoons.com';
 const RELEASES='https://api.github.com/repos/stalker547/rpg-fichas-olimpo/releases/latest';
 const plugins=window.Capacitor.Plugins||{};
 const pastePassword=document.querySelector('#paste-login-password');
 if(pastePassword){
  pastePassword.classList.remove('hidden');
  pastePassword.addEventListener('click',async()=>{
   try{
    const result=plugins.Clipboard?.read?await plugins.Clipboard.read():{value:await navigator.clipboard.readText()};
    loginPassword.value=result.value||'';
    loginPassword.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:result.value||''}));
    loginPassword.focus();
    loginPassword.setSelectionRange(loginPassword.value.length,loginPassword.value.length);
   }catch{alert('Não foi possível ler o texto copiado. Toque e segure no campo para usar o menu Colar.')}
  });
 }
 let token='',user=null,campaign=null,snapshot=null,eventSocket=null,eventRetry=null;
 const updateListeners=new Set(),onlineListeners=new Set();
 const connectEvents=()=>{
  if(!token||!campaign||eventSocket||typeof WebSocket!=='function')return;
  let socket;try{socket=eventSocket=new WebSocket(`${API.replace(/^http/,'ws')}/events?token=${encodeURIComponent(token)}`)}catch{return}
  socket.onmessage=event=>{try{if(JSON.parse(event.data).type!=='connected')for(const listener of onlineListeners)listener()}catch{}};
  socket.onclose=()=>{if(eventSocket===socket)eventSocket=null;if(token&&!eventRetry)eventRetry=setTimeout(()=>{eventRetry=null;connectEvents()},5000)};
  socket.onerror=()=>socket.close();
 };
 const mapUser=value=>({...value,role:value.role==='primary_master'?'admin':value.role});
 const request=async(route,method='GET',body)=>{
  const headers=token?{Authorization:`Bearer ${token}`}:{},options={method,headers};
  if(body!==undefined){headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
  let response;try{response=await fetch(API+route,options)}catch{throw new Error('Não foi possível conectar à VPS. Verifique sua internet.')}
  let data;try{data=await response.json()}catch{throw new Error('A VPS retornou uma resposta inválida.')}
  if(!response.ok){const error=new Error(data.error||'Não foi possível concluir a operação.');error.status=response.status;throw error}return data;
 };
 const load=async()=>{
  if(!token||!campaign)throw new Error('Sessão expirada. Entre novamente.');
  const admin=user.role==='admin',id=campaign.id;
  const [active,archived,settings,users]=await Promise.all([request(`/campaigns/${id}/characters`),admin?request(`/campaigns/${id}/characters?archived=true`):[],request(`/campaigns/${id}/settings`),admin?request('/users'):[]]);
  snapshot={characters:[...active,...archived].map(row=>{const character={...row.data,id:row.id,name:row.name,ownerUserId:row.owner_user_id,archived:Boolean(row.archived_at),updatedAt:row.updated_at,_remoteVersion:row.version,_remoteCampaignId:row.campaign_id};window.RpgProgression?.applyProgression(character);return character}),settings,npcs:admin?(settings.npcs||[]):[],users:users.filter(item=>item.active).map(mapUser),sessionUser:user,online:true};return structuredClone(snapshot);
 };
 const findUpdate=async()=>{const release=await fetch(RELEASES).then(response=>response.json()),apk=(release.assets||[]).find(asset=>asset.name.toLowerCase().endsWith('.apk')),info=plugins.App?.getInfo?await plugins.App.getInfo():{version:'0'};return apk&&newer(release.tag_name,info.version)?{release,apk}:null};
 const openUpdate=async update=>{await (plugins.Browser?.open?plugins.Browser.open({url:update.apk.browser_download_url}):Promise.resolve(window.open(update.apk.browser_download_url,'_blank')))};
 const automaticUpdateCheck=()=>setTimeout(async()=>{try{const update=await findUpdate();if(update&&confirm(`A versão ${update.release.tag_name} está disponível. Deseja baixar e instalar agora?`))await openUpdate(update)}catch{}},2500);
 const login=async credentials=>{const result=await request('/auth/login','POST',credentials);token=result.token;user=mapUser(result.user);const campaigns=await request('/campaigns');campaign=campaigns.find(item=>item.kind==='real')||campaigns[0];if(!campaign)throw new Error('Sua conta ainda não foi adicionada a uma campanha.');const data=await load();connectEvents();automaticUpdateCheck();return data};
 const save=async character=>{const data=structuredClone(character);delete data._remoteVersion;delete data._remoteCampaignId;window.RpgProgression?.applyProgression(data);let row;if(character._remoteVersion)row=await request(`/characters/${character.id}`,'PUT',{version:character._remoteVersion,data,source:character.changeSource});else row=await request(`/campaigns/${campaign.id}/characters`,'POST',{data,ownerUserId:character.ownerUserId});if(Boolean(character.archived)!==Boolean(row.archived_at))await request(`/characters/${row.id}/archive`,'PATCH',{archived:Boolean(character.archived)});return row};
 const pickFiles=({multiple=false,accept='image/*'}={})=>new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept=accept;input.multiple=multiple;input.onchange=()=>resolve([...input.files]);input.oncancel=()=>resolve([]);input.click()});
 const upload=async(characterId,file)=>{const response=await fetch(`${API}/characters/${characterId}/media`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Mime-Type':file.type},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar a imagem.');return {id:crypto.randomUUID(),name:file.name,path:`/media/${data.id}`,addedAt:new Date().toISOString()}};
 const downloadBlob=async(path)=>{const response=await fetch(API+path,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('Não foi possível baixar a imagem.');return response.blob()};
 const blobDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
 const downloadFile=(name,content,type='text/plain')=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([content],{type}));link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);return true};
 const versionParts=value=>String(value||'0').replace(/^v/,'').split('.').map(Number);
 const newer=(candidate,current)=>{const a=versionParts(candidate),b=versionParts(current);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0)}return false};
 window.rpg={
  confirmDelete:async()=>confirm('Tem certeza de que deseja excluir este item?'),
  onOnlineChange:callback=>{onlineListeners.add(callback);return()=>onlineListeners.delete(callback)},
  authStatus:async()=>({hasUsers:true,online:true,mobile:true}),
  setupAdmin:async()=>{throw new Error('A instalação online já está configurada.')},
  login,
  loadRememberedLogin:async()=>{try{return JSON.parse(localStorage.getItem('rpg-remembered-login'))||{username:'',password:'',remember:false}}catch{return {username:'',password:'',remember:false}}},
  saveRememberedLogin:async data=>{if(data.remember)localStorage.setItem('rpg-remembered-login',JSON.stringify(data));else localStorage.removeItem('rpg-remembered-login');return true},
  logout:async()=>{token='';user=campaign=snapshot=null;clearTimeout(eventRetry);eventRetry=null;eventSocket?.close();eventSocket=null;return true},
  changePassword:data=>request('/me/password','PUT',data),
  updateAppearance:async appearance=>{user=mapUser(await request('/me/appearance','PUT',appearance));return user},
  chooseBackground:async()=>{const [file]=await pickFiles();if(!file)return null;const response=await fetch(`${API}/me/background`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-Mime-Type':file.type},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar a imagem.');user=mapUser(data);return user},
  removeBackground:async()=>{user=mapUser(await request('/me/background','DELETE'));return user},
  createUser:async data=>{if(data.role==='admin')throw new Error('A campanha possui uma Mestre Principal.');const created=await request('/users','POST',data);await request(`/campaigns/${campaign.id}/members`,'POST',{userId:created.id});return load()},
  assignCharacter:async(id,owner)=>{await request(`/characters/${id}/owner`,'PATCH',{ownerUserId:owner});return load()},
  deleteUser:async id=>{await request(`/users/${id}`,'DELETE');return load()},
  load,
  updateAttributes:async names=>{const current=await load(),previous=current.settings.attributeNames||[];for(const character of current.characters){const old=character.attributes||{};character.attributes=Object.fromEntries(names.map((name,index)=>[name,Number(old[previous[index]]??old[name])||1]));await save(character)}await request(`/campaigns/${campaign.id}/settings`,'PUT',{...current.settings,attributeNames:names});return load()},
  updateSkillCatalog:async skills=>{const current=await load();await request(`/campaigns/${campaign.id}/settings`,'PUT',{...current.settings,customSkillCatalog:skills});return load()},
  saveCharacter:async(character,settings)=>{const row=await save(character);if(user.role==='admin'&&settings)await request(`/campaigns/${campaign.id}/settings`,'PUT',settings);if(user.role==='player'&&settings)await request(`/campaigns/${campaign.id}/solos`,'PATCH',{amount:Number(settings.solosByUser?.[user.id])||0});const db=await load();return {db,changes:[],characterId:row.id}},
  deleteCharacter:async id=>{await request(`/characters/${id}`,'DELETE');return load()},
  exportBackup:async()=>{const backup=await request(`/campaigns/${campaign.id}/backup`);return downloadFile(`Backup RPG Fichas ${new Date().toISOString().slice(0,10)}.rpgbackup`,JSON.stringify(backup),'application/json')},
  restoreBackup:async()=>{const [file]=await pickFiles({accept:'.rpgbackup,.json'});if(!file)return null;await request(`/campaigns/${campaign.id}/restore`,'POST',JSON.parse(await file.text()));return load()},
  saveNpc:async npc=>{const current=await load(),npcs=current.npcs.filter(item=>item.id!==npc.id);npcs.push(npc);await request(`/campaigns/${campaign.id}/settings`,'PUT',{...current.settings,npcs});return load()},
  deleteNpc:async id=>{const current=await load(),npcs=current.npcs.filter(item=>item.id!==id);await request(`/campaigns/${campaign.id}/settings`,'PUT',{...current.settings,npcs});return load()},
  chooseImages:async key=>{const character=snapshot?.characters.find(item=>key===item.id||key.startsWith(item.id+'-'));if(!character)throw new Error('Salve a ficha antes de adicionar imagens.');const [file]=await pickFiles();return file?[await upload(character.id,file)]:[]},
  imageDataUrl:async path=>path?.startsWith('/media/')||path==='/me/background'?blobDataUrl(await downloadBlob(path)):path||'',
  copyImage:async path=>{const blob=await downloadBlob(path);if(!navigator.clipboard?.write||!window.ClipboardItem)throw new Error('Seu Android não permite copiar imagens diretamente. Use compartilhar.');await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);return true},
  readAbilityImage:async()=>{throw new Error('O OCR será adicionado em uma próxima versão do APK.')},
  exportText:async(character,text,name)=>{const title=name||character.name||'Ficha RPG';if(plugins.Share?.share){await plugins.Share.share({title,text,dialogTitle:'Exportar ficha'});return true}return downloadFile(`${title}.txt`,text)},
  openDataFolder:async()=>false,
  checkForUpdates:async()=>{const update=await findUpdate();if(!update)return {status:'current',message:'Você já está usando a versão mais recente.'};await openUpdate(update);return {status:'downloading',message:'Baixe o APK e confirme a instalação da atualização.'}},
  onUpdateStatus:callback=>{updateListeners.add(callback);return()=>updateListeners.delete(callback)}
 };
})();
