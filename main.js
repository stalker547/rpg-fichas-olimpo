const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, clipboard, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readAbilityTable } = require('./ocr-table');
const { SqliteStorage } = require('./storage');

const APP_ROOT = __dirname;
const EXEC_ROOT = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(app.getPath('exe')) : APP_ROOT);
const DATA_ROOT = path.join(EXEC_ROOT, app.isPackaged ? 'RPG Fichas - Dados' : 'data');
const LEGACY_DB_FILE = path.join(DATA_ROOT, 'fichas.json');
const SQLITE_FILE = path.join(DATA_ROOT, 'rpg-fichas.db');
const MEDIA_ROOT = path.join(DATA_ROOT, 'midia');
const storage = new SqliteStorage(SQLITE_FILE, LEGACY_DB_FILE, path.join(APP_ROOT, 'assets', 'initial-data.json'));
const sessions = new Map();
// O modo local existe apenas durante o desenvolvimento pelo TESTAR.bat.
// Builds instaladas sempre usam a VPS, mesmo que recebam --local por engano.
const LOCAL_MODE = !app.isPackaged && process.argv.includes('--local');
let manualUpdateRequested = false, manualUpdateErrorReported = false;

function credentialsFile(){return path.join(app.getPath('userData'),'remembered-login.json')}
function loadRememberedCredentials(){
 try{const saved=JSON.parse(fs.readFileSync(credentialsFile(),'utf8'));if(!saved.username||!saved.password||!safeStorage.isEncryptionAvailable())return {username:saved.username||'',password:'',remember:false};return {username:saved.username,password:safeStorage.decryptString(Buffer.from(saved.password,'base64')),remember:true}}catch{return {username:'',password:'',remember:false}}
}
function saveRememberedCredentials(data){
 const file=credentialsFile();if(!data?.remember){try{fs.unlinkSync(file)}catch{}return true}
 if(!safeStorage.isEncryptionAvailable())throw new Error('O armazenamento seguro de senhas não está disponível neste Windows.');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({username:String(data.username||'').trim(),password:safeStorage.encryptString(String(data.password||'')).toString('base64')}),'utf8');return true;
}

function normalizeUsername(value) { return String(value || '').trim().toLocaleLowerCase('pt-BR'); }
function passwordRecord(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash:crypto.scryptSync(String(password), salt, 64).toString('hex') };
}
function passwordMatches(password, user) {
  try {
    const actual=Buffer.from(crypto.scryptSync(String(password), user.passwordSalt, 64).toString('hex'),'hex');
    const expected=Buffer.from(user.passwordHash,'hex');
    return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
  } catch { return false; }
}
function publicUser(user) { return { id:user.id, name:user.name, username:user.username, role:user.role, appearance:user.appearance||{} }; }
function sessionUser(event, db, requireAdmin=false) {
  const id=sessions.get(event.sender.id),user=(db.settings.authUsers||[]).find(item=>item.id===id);
  if(!user) throw new Error('Sessão expirada. Entre novamente.');
  if(requireAdmin&&user.role!=='admin') throw new Error('Apenas a mestre pode realizar esta ação.');
  return user;
}
function visibleDb(db,user) {
  const settings={...db.settings};delete settings.authUsers;
  settings.solosByUser=user.role==='admin'?{...(db.settings.solosByUser||{})}:{[user.id]:Number(db.settings.solosByUser?.[user.id])||0};
  delete settings.solos;
  const characters=user.role==='admin'?(db.characters||[]):(db.characters||[]).filter(character=>character.ownerUserId===user.id&&!character.archived);
  const npcs=user.role==='admin'?(db.npcs||[]):[];
  return { settings, characters, npcs, sessionUser:publicUser(user), users:user.role==='admin'?(db.settings.authUsers||[]).map(publicUser):[] };
}
function ownedCharacterForKey(db,user,key) {
  const value=String(key||''),characters=user.role==='admin'?(db.characters||[]):(db.characters||[]).filter(character=>character.ownerUserId===user.id);
  return characters.find(character=>value===character.id||value.startsWith(`${character.id}-`));
}

function mediaFolderFor(entityId) {
  if (String(entityId).startsWith('npc-')) return path.join(MEDIA_ROOT, 'NPCs');
  if (String(entityId).startsWith('player-info-')) return path.join(MEDIA_ROOT, 'Players');
  return path.join(MEDIA_ROOT, safeName(entityId));
}

function mergeMediaFolder(source, destination) {
  const moves=[];
  const sourceResolved = path.resolve(source), mediaResolved = path.resolve(MEDIA_ROOT);
  if (!sourceResolved.startsWith(`${mediaResolved}${path.sep}`) || !fs.statSync(source).isDirectory()) return moves;
  fs.mkdirSync(destination, { recursive:true });
  for (const entry of fs.readdirSync(source, { withFileTypes:true })) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isFile()) {const actual=fs.existsSync(to)?path.join(destination,`${Date.now()}-${entry.name}`):to;fs.renameSync(from,actual);moves.push([from,actual]);}
  }
  if (!fs.readdirSync(source).length) fs.rmdirSync(source);
  return moves;
}

function organizeMediaFolders() {
  const moves = [];
  fs.mkdirSync(path.join(MEDIA_ROOT, 'NPCs'), { recursive:true });
  fs.mkdirSync(path.join(MEDIA_ROOT, 'Players'), { recursive:true });
  for (const entry of fs.readdirSync(MEDIA_ROOT, { withFileTypes:true })) {
    if (!entry.isDirectory()) continue;
    const source = path.join(MEDIA_ROOT, entry.name);
    if (/^npc-\d+/i.test(entry.name)) { const destination=path.join(MEDIA_ROOT, 'NPCs', entry.name);moves.push(...mergeMediaFolder(source,destination)); }
    if (/^player-info-\d+/i.test(entry.name)) { const destination=path.join(MEDIA_ROOT, 'Players', entry.name);moves.push(...mergeMediaFolder(source,destination)); }
  }
  for (const category of ['NPCs','Players']) {
    const categoryFolder=path.join(MEDIA_ROOT,category);
    for (const entry of fs.readdirSync(categoryFolder,{withFileTypes:true})) {
      if (!entry.isDirectory()) continue;
      const source=path.join(categoryFolder,entry.name);
      moves.push(...mergeMediaFolder(source,categoryFolder));
    }
  }
  return moves;
}

function replaceMovedMediaPaths(value, moves) {
  if (Array.isArray(value)) return value.map(item => replaceMovedMediaPaths(item, moves));
  if (value && typeof value === 'object') { for (const key of Object.keys(value)) value[key]=replaceMovedMediaPaths(value[key],moves);return value; }
  if (typeof value === 'string') { let result=value;for (const [from,to] of moves) if (result===from || result.startsWith(`${from}${path.sep}`)) result=`${to}${result.slice(from.length)}`;return result; }
  return value;
}

function ensureData() {
  fs.mkdirSync(MEDIA_ROOT, { recursive: true });
  storage.init();
  const moves=organizeMediaFolders();
  if(moves.length){const data=replaceMovedMediaPaths(storage.readAll(),moves);storage.writeAll(data);}
}

function readDb() {
  ensureData();
  const db = storage.readAll();
  let cleaned = false;
  db.settings ||= {};
  if (!db.settings.solosByUser || typeof db.settings.solosByUser!=='object' || Array.isArray(db.settings.solosByUser)) {
    const legacySolos=Number(db.settings.solos)||0,firstOwner=(db.characters||[]).find(character=>character.ownerUserId)?.ownerUserId;
    db.settings.solosByUser=firstOwner?{[firstOwner]:legacySolos}:{};
    cleaned=true;
  }
  const defaultAttributes=['Força','Destreza','Carisma','Resistência','Inteligência','Sorte'];
  if(!Array.isArray(db.settings.attributeNames)||!db.settings.attributeNames.length){db.settings.attributeNames=defaultAttributes;cleaned=true;}
  for (const character of db.characters || []) {
    if(typeof character.archived!=='boolean'){character.archived=false;cleaned=true;}
    character.profile ||= {};
    if (!Number.isFinite(Number(character.profile.healthMax)) || Number(character.profile.healthMax)<1) { character.profile.healthMax=100; cleaned=true; }
    if (!Number.isFinite(Number(character.profile.healthCurrent))) { character.profile.healthCurrent=character.profile.healthMax; cleaned=true; }
    if (Number(character.profile.healthCurrent)<0 || Number(character.profile.healthCurrent)>Number(character.profile.healthMax)) { character.profile.healthCurrent=Math.max(0,Math.min(Number(character.profile.healthMax),Number(character.profile.healthCurrent))); cleaned=true; }
    character.attributes ||= {};
    if(Object.prototype.hasOwnProperty.call(character.attributes,'Velocidade')&&!Object.prototype.hasOwnProperty.call(character.attributes,'Carisma')){character.attributes.Carisma=character.attributes.Velocidade;delete character.attributes.Velocidade;cleaned=true;}
    for(const attribute of db.settings.attributeNames)if(!Object.prototype.hasOwnProperty.call(character.attributes,attribute)){character.attributes[attribute]=1;cleaned=true;}
    if (!character.pointPools) { character.pointPools = { attributes:0, skills:0 }; cleaned = true; }
    if (!Number.isFinite(Number(character.pointPools.attributes))) { character.pointPools.attributes = 0; cleaned = true; }
    if (!Number.isFinite(Number(character.pointPools.skills))) { character.pointPools.skills = 0; cleaned = true; }
    if (!Array.isArray(character.abilities)) { character.abilities = []; cleaned = true; }
    if (!Array.isArray(character.rollHistory)) { character.rollHistory = []; cleaned = true; }
    if (!Array.isArray(character.quests)) { character.quests = []; cleaned = true; }
    for (const quest of character.quests) {
      if(!Number.isFinite(Number(quest.failureCount))){quest.failureCount=0;cleaned=true;}
      if(!Number.isFinite(Number(quest.failuresPerProgress))){quest.failuresPerProgress=0;cleaned=true;}
      const normalizedQuestName=String(quest.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
      if(normalizedQuestName==='poderdivino'&&Number(quest.value)===0){quest.value=20;quest.bonus=3;cleaned=true;}
      if(!Number.isFinite(Number(quest.bonus))){quest.bonus=Number(quest.value)>=11&&Number(quest.value)<=20?3:0;cleaned=true;}
      const expectedAction=Number(quest.value)>=20?'use':(quest.action||'use');
      if(quest.action!==expectedAction){quest.action=expectedAction;cleaned=true;}
    }
    for (const ability of character.abilities) {
      if (ability.type === 'normal') { ability.type = 'active'; cleaned = true; }
      else if (!['passive','active','ultimate'].includes(ability.type)) { ability.type = 'active'; cleaned = true; }
      if (!Number.isFinite(Number(ability.useCurrent))) { ability.useCurrent = 0; cleaned = true; }
      if (!Number.isFinite(Number(ability.useGoal)) || Number(ability.useGoal) < 1) { ability.useGoal = 25; cleaned = true; }
    }
    if (!Array.isArray(character.creations)) { character.creations = []; cleaned = true; }
    for (const creation of character.creations) {
      if (creation.progressMode !== 'countdown') {
        if ((Number(creation.current) || 0) === 0 && (Number(creation.requirement) || 0) > 0) creation.current = Number(creation.requirement);
        creation.progressMode = 'countdown'; creation.initialized = true; cleaned = true;
      }
    }
    if (!character.backpack) { character.backpack = { petFood:0, specialPetFood:0, travelMeals:0, premiumTravelMeals:0, jobs:[], items:Array(10).fill('') }; cleaned = true; }
    if (!Array.isArray(character.receptacles)) {
      character.receptacles = [];
      for (const line of String(character.inventory || '').split(/\r?\n/)) {
        const match=line.match(/^\s*(\d+)\s*[-–]\s*([^+\-\n]+?)\s*([+-]\s*\d+)\s*$/i);
        if (!match) continue;
        const rawAttribute=match[2].trim(),normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),attribute=Object.keys(character.attributes).find(key=>normalize(key)===normalize(rawAttribute)),god=Object.keys(character.gods||{}).find(key=>normalize(key)===normalize(rawAttribute)),target=attribute||god||rawAttribute;
        character.receptacles.push({id:crypto.randomUUID(),slot:Number(match[1]),name:god?`Receptáculo de ${god}`:`Receptáculo ${match[1]}`,attribute:target,targetType:god?'god':'attribute',bonus:Number(match[3].replace(/\s/g,''))||0,equipped:true});
      }
      if (character.receptacles.length) character.inventory=String(character.inventory||'').split(/\r?\n/).filter(line=>!/^\s*\d+\s*[-–]\s*[^+\-\n]+?\s*[+-]\s*\d+\s*$/i.test(line)&&!/^\s*\d+\s*-?\s*$/.test(line)).join('\n').trim();
      cleaned = true;
    }
    for (const item of character.receptacles) {
      const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),god=Object.keys(character.gods||{}).find(key=>normalize(key)===normalize(item.attribute)||normalize(item.name).includes(normalize(key)));
      const targetType=god?'god':'attribute';
      if(item.targetType!==targetType){item.targetType=targetType;cleaned=true;}
      if(god&&item.attribute!==god){item.attribute=god;cleaned=true;}
      if(god&&/^Receptáculo \d+$/i.test(item.name||'')){item.name=`Receptáculo de ${god}`;cleaned=true;}
      if(!Array.isArray(item.effects)||!item.effects.length){item.effects=[{attribute:item.attribute||db.settings.attributeNames[0],targetType:item.targetType||'attribute',bonus:Number(item.bonus)||0}];cleaned=true;}
      for(const effect of item.effects){if(effect.attribute==='Velocidade'){effect.attribute='Carisma';cleaned=true;}}
    }
    if (!Array.isArray(character.milestones)) { character.milestones = []; cleaned = true; }
    if (!Array.isArray(character.companions)) { character.companions = []; cleaned = true; }
    for (const companion of character.companions) {
      if (typeof companion.relatedAttribute !== 'string') { companion.relatedAttribute = ''; cleaned = true; }
      if (!Array.isArray(companion.trainings)) { companion.trainings = []; cleaned = true; }
      for (const training of companion.trainings) if (typeof training.completionDate !== 'string') { training.completionDate = ''; cleaned = true; }
      if (!Array.isArray(companion.forms)) { companion.forms = []; cleaned = true; }
    }
    character.backpack.jobs ||= [];
    character.backpack.items ||= Array(10).fill('');
    if (!Number.isFinite(Number(character.backpack.specialPetFood))) { character.backpack.specialPetFood = 0; cleaned = true; }
    if (!Number.isFinite(Number(character.backpack.premiumTravelMeals))) { character.backpack.premiumTravelMeals = 0; cleaned = true; }
    while (character.backpack.items.length < 10) character.backpack.items.push('');
    if (String(character.name).toLocaleLowerCase('pt-BR') === 'thales' && !character.creationSeeded) {
      if (!character.creations.length) character.creations.push({ type:'Aprendizado', name:'Rastro marcado', current:40, requirement:40, progressMode:'countdown', initialized:true });
      character.creationSeeded = true; cleaned = true;
    }
    if (String(character.name).toLocaleLowerCase('pt-BR') === 'thales' && !character.backpackSeeded) {
      character.profile.coins = 3;
      character.backpack.petFood = 7;
      character.backpack.travelMeals = 0;
      if (!character.backpack.jobs.length) character.backpack.jobs.push({ name:'Ajudante na forja', value:'' });
      character.backpackSeeded = true; cleaned = true;
    }
    if (String(character.name).toLocaleLowerCase('pt-BR') === 'thales' && !character.occupationSeeded) {
      if (!character.profile.occupation) character.profile.occupation = 'Ajudante na forja';
      character.occupationSeeded = true; cleaned = true;
    }
    if (String(character.name).toLocaleLowerCase('pt-BR') === 'thales' && !character.toxinGoalSeeded) {
      if (!character.milestones.some(goal => goal.name === 'Resistência a Toxinas')) character.milestones.push({
        id:'resistencia-toxinas', name:'Resistência a Toxinas', startDate:'2026-08-17', status:'Em preparação', conclusionDate:'',
        requirements:[
          { name:'Veneno', current:6, target:11, linked:true }, { name:'Medicina', current:0, target:11, linked:true },
          { name:'Grego', current:2, target:11, linked:true }, { name:'Inteligência', current:0, target:11, linked:true },
          { name:'Resistência', current:0, target:11, linked:true }
        ], notes:''
      });
      character.toxinGoalSeeded = true; cleaned = true;
    }
    for (const idea of character.ideas || []) {
      if (idea.status === 'Enviada') { idea.status = 'Pedido para a mestre'; cleaned = true; }
      if (idea.type === 'normal') { idea.type = 'active'; cleaned = true; }
      else if (!['passive','active','ultimate'].includes(idea.type)) { idea.type = 'active'; cleaned = true; }
    }
    for (const key of Object.keys(character.attributes)) {
      const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (normalized === 'bonus divino') {
        if (!Number(character.profile?.divineBonus) && Number(character.attributes[key])) character.profile.divineBonus = Number(character.attributes[key]);
        delete character.attributes[key]; cleaned = true;
      }
      if (normalized === 'moedas') { delete character.attributes[key]; cleaned = true; }
    }
  }
  const users=db.settings.authUsers||[],admin=users.find(user=>user.role==='admin');
  if(admin) for(const character of db.characters||[]) if(!character.ownerUserId){character.ownerUserId=admin.id;cleaned=true;}
  if (cleaned) storage.writeAll(db);
  return db;
}

function writeDb(db) {
  ensureData();
  storage.writeAll(db);
}

function flatten(value, prefix = '', result = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, result));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (!['history', 'updatedAt', 'changeNote', 'changeSource', 'id', 'path', 'addedAt', 'companions', 'gallery', 'portrait', 'portraitSettings'].includes(key)) flatten(item, prefix ? `${prefix}.${key}` : key, result);
    });
  } else result[prefix] = value;
  return result;
}

function changesBetween(before, after) {
  const a = flatten(before || {});
  const b = flatten(after || {});
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter(k => a[k] !== b[k]).map(k => ({ field: k, before: a[k] ?? '', after: b[k] ?? '' }));
}

function safeName(name) {
  return String(name || 'arquivo').replace(/[<>:"/\\|?*]/g, '_');
}

function unpackedPath(relativePath) {
  return app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', relativePath) : path.join(APP_ROOT, relativePath);
}

function parseAbilityTsv(tsv) {
  const words = String(tsv || '').split(/\r?\n/).slice(1).map(line => {
    const c = line.split('\t');
    return { level:Number(c[0]), block:c[2], par:c[3], line:c[4], left:Number(c[6]), top:Number(c[7]), width:Number(c[8]), height:Number(c[9]), conf:Number(c[10]), text:(c.slice(11).join('\t') || '').trim() };
  }).filter(w => w.level === 5 && w.text && w.conf > 15);
  if (!words.length) return [];
  const fullWidth = Math.max(...words.map(w => w.left + w.width));
  const lineGroups = new Map();
  words.filter(w => w.left < fullWidth * .22).forEach(w => {
    const key = `${w.block}-${w.par}-${w.line}`;
    if (!lineGroups.has(key)) lineGroups.set(key, []);
    lineGroups.get(key).push(w);
  });
  const names = [...lineGroups.values()].map(ws => ({
    name: ws.sort((a,b) => a.left-b.left).map(w => w.text).join(' ').trim(),
    y: ws.reduce((sum,w) => sum+w.top+w.height/2, 0) / ws.length
  })).filter(x => x.name && !/^(hab|habilidade|efeito|nível|nivel)$/i.test(x.name)).sort((a,b) => a.y-b.y);
  if (!names.length) return [];
  const starts = names.map((x,i) => i === 0 ? -Infinity : (names[i-1].y+x.y)/2);
  const ends = names.map((x,i) => i === names.length-1 ? Infinity : (x.y+names[i+1].y)/2);
  return names.map((row,i) => {
    const inside = w => w.top+w.height/2 >= starts[i] && w.top+w.height/2 < ends[i];
    const effectLines = new Map();
    words.filter(w => inside(w) && w.left >= fullWidth*.18 && w.left < fullWidth*.91).forEach(w => {
      const key = `${w.block}-${w.par}-${w.line}`;
      if (!effectLines.has(key)) effectLines.set(key, []);
      effectLines.get(key).push(w);
    });
    const effect = [...effectLines.values()].sort((a,b) => Math.min(...a.map(w=>w.top))-Math.min(...b.map(w=>w.top))).map(ws => ws.sort((a,b)=>a.left-b.left).map(w=>w.text).join(' ')).join(' ').replace(/\s+/g,' ').trim();
    const levelWord = words.filter(w => inside(w) && w.left >= fullWidth*.88 && /^\d+$/.test(w.text)).sort((a,b)=>b.conf-a.conf)[0];
    return { name:row.name, effect, level:levelWord ? Number(levelWord.text) : 1 };
  }).filter(x => x.name && x.effect);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#111813',
    title: LOCAL_MODE ? 'RPG Fichas — Modo local' : 'RPG Fichas',
    icon: path.join(APP_ROOT, 'assets', 'app-icon.ico'),
    webPreferences: { preload: path.join(APP_ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(APP_ROOT, 'src', 'index.html'));
  return win;
}

function startAutoUpdater(win) {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = false;
  autoUpdater.on('update-available',()=>{if(!manualUpdateRequested)autoUpdater.downloadUpdate().catch(error=>console.error('Falha ao baixar atualização:',error.message))});
  autoUpdater.on('download-progress', progress => {if(manualUpdateRequested&&!win.isDestroyed())win.webContents.send('app:update-status',{stage:'downloading',percent:Math.max(0,Math.min(100,Math.round(progress.percent||0))),bytesPerSecond:Number(progress.bytesPerSecond)||0,transferred:Number(progress.transferred)||0,total:Number(progress.total)||0})});
  autoUpdater.on('update-downloaded', async info => {
    if(manualUpdateRequested){manualUpdateRequested=false;if(!win.isDestroyed())win.webContents.send('app:update-status',{stage:'installing',percent:100});setTimeout(()=>autoUpdater.quitAndInstall(true,true),900);return}
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Atualização pronta',
      message: `A versão ${info.version} do RPG Fichas já foi baixada.`,
      detail: 'Reinicie agora para instalar. Suas fichas e imagens não serão apagadas.',
      buttons: ['Reiniciar e atualizar', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (result.response === 0) autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.on('error', error => {console.error('Falha ao procurar atualização:', error.message);if(manualUpdateRequested&&!manualUpdateErrorReported&&!win.isDestroyed()){manualUpdateErrorReported=true;win.webContents.send('app:update-status',{stage:'error',message:'O download perdeu a conexão. Tente novamente.'})}manualUpdateRequested=false});
  const check = () => autoUpdater.checkForUpdates().catch(error => console.error('Falha ao consultar atualização:', error.message));
  setTimeout(check, 10000);
  setInterval(check, 30 * 60 * 1000);
}

app.whenReady().then(() => {
  ensureData();
  const win=createWindow();
  startAutoUpdater(win);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => storage.close());

ipcMain.handle('app:check-updates',async event=>{if(!app.isPackaged){setTimeout(()=>{app.relaunch({args:process.argv.slice(1)});app.exit(0)},900);return {status:'restarting',message:'Reabrindo o aplicativo local...'}}try{manualUpdateRequested=true;manualUpdateErrorReported=false;event.sender.send('app:update-status',{stage:'connecting',percent:0});const result=await autoUpdater.checkForUpdates(),version=result?.updateInfo?.version;if(!version||version===app.getVersion()){manualUpdateRequested=false;return {status:'current',message:'Você já está usando a versão mais recente.'}}autoUpdater.downloadUpdate().catch(error=>{if(!manualUpdateErrorReported&&!event.sender.isDestroyed()){manualUpdateErrorReported=true;event.sender.send('app:update-status',{stage:'error',message:'Não foi possível concluir o download. Tente novamente.'})}manualUpdateRequested=false;console.error('Falha ao baixar atualização:',error.message)});return {status:'downloading',version,message:`Baixando a versão ${version}. Quando terminar, o aplicativo instalará e abrirá novamente sozinho.`}}catch(error){manualUpdateRequested=false;throw new Error(`Não foi possível verificar atualizações: ${error.message}`)}});
ipcMain.handle('auth:remembered-login',()=>loadRememberedCredentials());
ipcMain.handle('auth:save-remembered-login',(event,data)=>saveRememberedCredentials(data));

ipcMain.handle('auth:status', () => ({ hasUsers:(readDb().settings.authUsers||[]).length>0, online:false, local:true }));
ipcMain.handle('auth:setup', (event, data) => {
  const db=readDb();if((db.settings.authUsers||[]).length)throw new Error('A conta da mestre já foi criada.');
  const username=normalizeUsername(data.username),password=String(data.password||'');
  if(username.length<3)throw new Error('O usuário precisa ter pelo menos 3 caracteres.');
  if(password.length<4)throw new Error('A senha precisa ter pelo menos 4 caracteres.');
  const record=passwordRecord(password),user={id:crypto.randomUUID(),name:String(data.name||'Mestre').trim()||'Mestre',username,role:'admin',passwordSalt:record.salt,passwordHash:record.hash,createdAt:new Date().toISOString()};
  db.settings.authUsers=[user];for(const character of db.characters||[])character.ownerUserId=user.id;writeDb(db);sessions.set(event.sender.id,user.id);return visibleDb(db,user);
});
ipcMain.handle('auth:login', (event, data) => {
  const db=readDb(),username=normalizeUsername(data.username),user=(db.settings.authUsers||[]).find(item=>item.username===username);
  if(!user||!passwordMatches(data.password,user))throw new Error('Usuário ou senha incorretos.');
  sessions.set(event.sender.id,user.id);return visibleDb(db,user);
});
ipcMain.handle('auth:logout', event => { sessions.delete(event.sender.id);return true; });
ipcMain.handle('auth:change-password', (event, data) => {const db=readDb(),user=sessionUser(event,db),current=String(data?.currentPassword||''),next=String(data?.newPassword||'');if(!passwordMatches(current,user))throw new Error('A senha atual está incorreta.');if(next.length<4)throw new Error('A nova senha precisa ter pelo menos 4 caracteres.');const record=passwordRecord(next);user.passwordSalt=record.salt;user.passwordHash=record.hash;writeDb(db);return true;});
ipcMain.handle('auth:update-appearance', (event, appearance) => {
  const db=readDb(),user=sessionUser(event,db),colors=['bg','bg2','panel','panel2','sidebar','input','line','accent','accent2','text','muted','gold','danger','toast','toastError','dirtyBar'],next={...(user.appearance||{})};
  for(const key of colors){const value=String(appearance?.[key]||'');if(!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Cor de aparência inválida.');next[key]=value;}
  next.gradientEnabled=Boolean(appearance?.gradientEnabled);next.gradientAngle=['45deg','90deg','135deg','180deg'].includes(appearance?.gradientAngle)?appearance.gradientAngle:'135deg';
  user.appearance=next;writeDb(db);return publicUser(user);
});
ipcMain.handle('auth:choose-background', async event => {
  const db=readDb(),user=sessionUser(event,db),chosen=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Imagem de fundo',extensions:['png','jpg','jpeg','webp','gif']}]});
  if(chosen.canceled)return null;
  const source=chosen.filePaths[0],ext=path.extname(source),folder=path.join(MEDIA_ROOT,'Aparencia',safeName(user.id));fs.mkdirSync(folder,{recursive:true});
  const destination=path.join(folder,`fundo-${Date.now()}${ext}`);fs.copyFileSync(source,destination);user.appearance={...(user.appearance||{}),backgroundPath:destination};writeDb(db);return publicUser(user);
});
ipcMain.handle('auth:remove-background', event => {const db=readDb(),user=sessionUser(event,db);user.appearance={...(user.appearance||{}),backgroundPath:''};writeDb(db);return publicUser(user);});
ipcMain.handle('auth:create-user', (event, data) => {
  const db=readDb();sessionUser(event,db,true);db.settings.authUsers ||= [];
  const username=normalizeUsername(data.username),password=String(data.password||''),role=data.role==='admin'?'admin':'player';
  if(username.length<3)throw new Error('O usuário precisa ter pelo menos 3 caracteres.');
  if(password.length<4)throw new Error('A senha precisa ter pelo menos 4 caracteres.');
  if(db.settings.authUsers.some(user=>user.username===username))throw new Error('Esse nome de usuário já existe.');
  const record=passwordRecord(password),id=crypto.randomUUID();db.settings.authUsers.push({id,name:String(data.name||username).trim(),username,role,passwordSalt:record.salt,passwordHash:record.hash,createdAt:new Date().toISOString()});db.settings.solosByUser||={};db.settings.solosByUser[id]=0;writeDb(db);return visibleDb(db,sessionUser(event,db,true));
});
ipcMain.handle('auth:assign-character', (event, characterId, ownerUserId) => {
  const db=readDb(),admin=sessionUser(event,db,true),character=db.characters.find(item=>item.id===characterId),owner=(db.settings.authUsers||[]).find(user=>user.id===ownerUserId);
  if(!character)throw new Error('Ficha não encontrada.');if(!owner)throw new Error('Usuário não encontrado.');character.ownerUserId=owner.id;character.updatedAt=new Date().toISOString();writeDb(db);return visibleDb(db,admin);
});
ipcMain.handle('auth:delete-user', (event, userId) => {
  const db=readDb(),admin=sessionUser(event,db,true);if(userId===admin.id)throw new Error('A conta da mestre conectada não pode ser excluída.');
  db.settings.authUsers=(db.settings.authUsers||[]).filter(user=>user.id!==userId);for(const character of db.characters||[])if(character.ownerUserId===userId)character.ownerUserId=admin.id;if(db.settings.solosByUser)delete db.settings.solosByUser[userId];writeDb(db);return visibleDb(db,admin);
});
ipcMain.handle('db:load', event => {const db=readDb(),user=sessionUser(event,db);return visibleDb(db,user);});
ipcMain.handle('db:update-attributes', (event, names) => {
  const db=readDb(),admin=sessionUser(event,db,true),before=Array.isArray(db.settings.attributeNames)?db.settings.attributeNames:[];
  const next=(Array.isArray(names)?names:[]).map(value=>String(value||'').trim()).filter(Boolean);
  if(!next.length)throw new Error('Cadastre pelo menos um atributo.');
  if(new Set(next.map(normalizeUsername)).size!==next.length)throw new Error('Não pode haver atributos com o mesmo nome.');
  for(const character of db.characters||[]){
    const old=character.attributes||{},updated={};
    next.forEach((name,index)=>{const oldName=before[index];updated[name]=Object.prototype.hasOwnProperty.call(old,oldName)?Number(old[oldName])||1:Object.prototype.hasOwnProperty.call(old,name)?Number(old[name])||1:1});
    character.attributes=updated;
    for(const item of character.receptacles||[])for(const effect of item.effects||[])if(effect.targetType!=='god'){const effectIndex=before.findIndex(name=>normalizeUsername(name)===normalizeUsername(effect.attribute));if(effectIndex>=0&&next[effectIndex])effect.attribute=next[effectIndex];}
    character.updatedAt=new Date().toISOString();
  }
  db.settings.attributeNames=next;writeDb(db);return visibleDb(db,admin);
});
ipcMain.handle('db:update-skill-catalog', (event, skills) => {
  const db=readDb();sessionUser(event,db,true);
  const next=(Array.isArray(skills)?skills:[]).map(skill=>({name:String(skill.name||'').trim(),category:String(skill.category||'Outras').trim()||'Outras',description:String(skill.description||'').trim()})).filter(skill=>skill.name);
  if(new Set(next.map(skill=>normalizeUsername(skill.name))).size!==next.length)throw new Error('Não pode haver perícias repetidas.');
  db.settings.customSkillCatalog=next;writeDb(db);return visibleDb(db,sessionUser(event,db,true));
});
ipcMain.handle('db:save-character', (event, character, settings) => {
  const db = readDb();
  const user=sessionUser(event,db);
  const index = db.characters.findIndex(c => c.id === character.id);
  const before = index >= 0 ? db.characters[index] : null;
  if((character.creations||[]).length>Math.max(1,(before?.creations||[]).length))throw new Error('Só é possível aprender uma habilidade por vez. Finalize o aprendizado atual.');
  if(before&&user.role!=='admin'&&before.ownerUserId!==user.id)throw new Error('Você não tem permissão para editar esta ficha.');
  if(user.role!=='admin'&&Boolean(character.archived)!==Boolean(before?.archived))throw new Error('Apenas a mestre pode engavetar ou restaurar fichas.');
  character.ownerUserId=user.role==='admin'?(character.ownerUserId||user.id):user.id;
  const solosOwnerId=character.ownerUserId||user.id;
  db.settings.solosByUser||={};
  const solosBefore = Number(db.settings.solosByUser[solosOwnerId]) || 0;
  const changeNote = character.changeNote || 'Alteração manual';
  const changeSource = character.changeSource || 'manual';
  delete character.changeNote;
  delete character.changeSource;
  const changes = changesBetween(before, character);
  const solosAfter=settings?Number(settings.solosByUser?.[solosOwnerId])||0:solosBefore;
  if (solosAfter !== solosBefore) changes.push({ field:'shared.solos', before:solosBefore, after:solosAfter });
  db.settings.solosByUser[solosOwnerId]=solosAfter;
  character.updatedAt = new Date().toISOString();
  character.history = before?.history || [];
  if (changes.length) character.history.unshift({ id: crypto.randomUUID(), at: character.updatedAt, note: changeNote, source:changeSource, changes, userId:user.id, userName:user.name, userRole:user.role });
  if (index >= 0) db.characters[index] = character; else db.characters.push(character);
  writeDb(db);
  return { db:visibleDb(db,user), changes };
});
ipcMain.handle('db:delete-character', (event, id) => {
  const db = readDb();
  const user=sessionUser(event,db),character=db.characters.find(item=>item.id===id);if(!character)return visibleDb(db,user);if(user.role!=='admin')throw new Error('Somente a mestre pode excluir esta ficha.');
  db.characters = db.characters.filter(c => c.id !== id);
  writeDb(db);
  return visibleDb(db,user);
});
ipcMain.handle('db:save-npc', (event, npc) => {
  const db = readDb();
  const user=sessionUser(event,db,true);
  db.npcs ||= [];
  const index = db.npcs.findIndex(item => item.id === npc.id);
  npc.entityType = 'npc';
  npc.updatedAt = new Date().toISOString();
  if (index >= 0) db.npcs[index] = npc; else db.npcs.push(npc);
  writeDb(db);
  return visibleDb(db,user);
});
ipcMain.handle('db:delete-npc', (event, id) => {
  const db = readDb();
  const user=sessionUser(event,db,true);
  db.npcs = (db.npcs || []).filter(item => item.id !== id);
  writeDb(db);
  return visibleDb(db,user);
});
ipcMain.handle('media:choose', async (event, characterId) => {
  const db=readDb(),user=sessionUser(event,db);if(!ownedCharacterForKey(db,user,characterId)&&user.role!=='admin')throw new Error('Você não pode adicionar imagens a esta ficha.');
  const chosen = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
  if (chosen.canceled) return [];
  const folder = mediaFolderFor(characterId);
  fs.mkdirSync(folder, { recursive: true });
  return chosen.filePaths.map(source => {
    const ext = path.extname(source);
    const grouped=String(characterId).startsWith('npc-')||String(characterId).startsWith('player-info-');
    const prefix=grouped?`${safeName(characterId)}-`:'';
    const dest = path.join(folder, `${prefix}${Date.now()}-${safeName(path.basename(source, ext))}${ext}`);
    fs.copyFileSync(source, dest);
    return { id: crypto.randomUUID(), name: path.basename(source), path: dest, addedAt: new Date().toISOString() };
  });
});
ipcMain.handle('media:data-url', (event, filePath) => {
  try {
    const db=readDb(),user=sessionUser(event,db),resolved=path.resolve(filePath),mediaResolved=path.resolve(MEDIA_ROOT);if(!resolved.startsWith(`${mediaResolved}${path.sep}`))return '';
    if(user.role!=='admin'){const relative=path.relative(mediaResolved,resolved),folder=relative.split(path.sep)[0],characterAllowed=(db.characters||[]).filter(character=>character.ownerUserId===user.id).some(character=>folder.startsWith(safeName(character.id))),appearanceAllowed=path.resolve(user.appearance?.backgroundPath||'')===resolved;if(!characterAllowed&&!appearanceAllowed)return '';}
    const ext = path.extname(filePath).slice(1).toLowerCase().replace('jpg', 'jpeg');
    return `data:image/${ext};base64,${fs.readFileSync(filePath).toString('base64')}`;
  } catch { return ''; }
});
ipcMain.handle('media:copy-image', (event, filePath) => {
  const db=readDb(),user=sessionUser(event,db),resolved=path.resolve(filePath),mediaResolved=path.resolve(MEDIA_ROOT);
  if(!resolved.startsWith(`${mediaResolved}${path.sep}`))throw new Error('Esta imagem não pertence à pasta do aplicativo.');
  if(user.role!=='admin'){
    const relative=path.relative(mediaResolved,resolved),folder=relative.split(path.sep)[0];
    const allowed=(db.characters||[]).filter(character=>character.ownerUserId===user.id).some(character=>folder.startsWith(safeName(character.id)));
    if(!allowed)throw new Error('Você não pode copiar imagens desta ficha.');
  }
  const image=nativeImage.createFromPath(resolved);if(image.isEmpty())throw new Error('Não foi possível ler esta imagem.');
  clipboard.writeImage(image);return true;
});
ipcMain.handle('ocr:abilities', async (event, characterId) => {
  const db=readDb(),user=sessionUser(event,db);if(!ownedCharacterForKey(db,user,characterId))throw new Error('Você não pode alterar esta ficha.');
  const chosen = await dialog.showOpenDialog({ properties:['openFile'], filters:[{ name:'Imagem da tabela', extensions:['png','jpg','jpeg','webp','bmp'] }] });
  if (chosen.canceled) return { canceled:true, abilities:[] };
  const ocrOptions = {
    langPath: unpackedPath(path.join('assets','ocr')),
    gzip: false,
    cachePath: path.join(DATA_ROOT, 'ocr-cache'),
    workerPath: unpackedPath(path.join('node_modules','tesseract.js','src','worker-script','node','index.js'))
  };
  try {
    const abilities = await readAbilityTable(chosen.filePaths[0], ocrOptions);
    const source = chosen.filePaths[0];
    const folder = path.join(MEDIA_ROOT, safeName(characterId));
    fs.mkdirSync(folder, { recursive:true });
    const ext = path.extname(source);
    const dest = path.join(folder, `${Date.now()}-tabela-habilidades${ext}`);
    fs.copyFileSync(source, dest);
    return { canceled:false, filePath:source, abilities, media:{ id:crypto.randomUUID(), name:`Tabela de habilidades${ext}`, path:dest, addedAt:new Date().toISOString() } };
  } catch(error) { throw error; }
});
ipcMain.handle('file:export-text', async (event, character, text, fileName) => {
  const db=readDb(),user=sessionUser(event,db),saved=(db.characters||[]).find(item=>item.id===character.id);if(!saved||(user.role!=='admin'&&saved.ownerUserId!==user.id))throw new Error('Você não pode exportar esta ficha.');
  const suggestedName=fileName?`${safeName(fileName)}.txt`:`${safeName(character.name)} - ficha.txt`;
  const result = await dialog.showSaveDialog({ defaultPath:suggestedName, filters: [{ name: 'Texto', extensions: ['txt'] }] });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, text, 'utf8');
  return true;
});
ipcMain.handle('data:open-folder', event => {const db=readDb();sessionUser(event,db,true);return shell.openPath(DATA_ROOT)});
if(!LOCAL_MODE)require('./online-main')({ipcMain,net:require('electron').net,dialog,shell,clipboard,nativeImage,DATA_ROOT,MEDIA_ROOT,changesBetween,readAbilityTable,unpackedPath});
ipcMain.handle('ui:confirm-delete',async event=>{const result=await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'question',title:'Excluir item',message:'Tem certeza que deseja excluir este item?',buttons:['Cancelar','Excluir'],defaultId:0,cancelId:0,noLink:true});return result.response===1});
