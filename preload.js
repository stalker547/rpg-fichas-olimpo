const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rpg', {
  confirmDelete: () => ipcRenderer.invoke('ui:confirm-delete'),
  onOnlineChange: callback => { const listener=()=>callback();ipcRenderer.on('online:changed',listener);return ()=>ipcRenderer.removeListener('online:changed',listener); },
  authStatus: () => ipcRenderer.invoke('auth:status'),
  setupAdmin: data => ipcRenderer.invoke('auth:setup', data),
  login: data => ipcRenderer.invoke('auth:login', data),
  logout: () => ipcRenderer.invoke('auth:logout'),
  changePassword: data => ipcRenderer.invoke('auth:change-password', data),
  updateAppearance: appearance => ipcRenderer.invoke('auth:update-appearance', appearance),
  chooseBackground: () => ipcRenderer.invoke('auth:choose-background'),
  removeBackground: () => ipcRenderer.invoke('auth:remove-background'),
  createUser: data => ipcRenderer.invoke('auth:create-user', data),
  assignCharacter: (characterId, ownerUserId) => ipcRenderer.invoke('auth:assign-character', characterId, ownerUserId),
  deleteUser: userId => ipcRenderer.invoke('auth:delete-user', userId),
  load: () => ipcRenderer.invoke('db:load'),
  updateAttributes: names => ipcRenderer.invoke('db:update-attributes', names),
  saveCharacter: (character, settings) => ipcRenderer.invoke('db:save-character', character, settings),
  deleteCharacter: id => ipcRenderer.invoke('db:delete-character', id),
  saveNpc: npc => ipcRenderer.invoke('db:save-npc', npc),
  deleteNpc: id => ipcRenderer.invoke('db:delete-npc', id),
  chooseImages: characterId => ipcRenderer.invoke('media:choose', characterId),
  readAbilityImage: characterId => ipcRenderer.invoke('ocr:abilities', characterId),
  imageDataUrl: filePath => ipcRenderer.invoke('media:data-url', filePath),
  exportText: (character, text, fileName) => ipcRenderer.invoke('file:export-text', character, text, fileName),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder')
});
