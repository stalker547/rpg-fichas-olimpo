const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

function closeHarness() {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf('function createWindow()');
  const end = source.indexOf('\nfunction startAutoUpdater(', start);
  const ipcMain = new EventEmitter();
  let answer = 0, prompts = 0;
  class Window extends EventEmitter {
    constructor() {
      super();
      this.webContents = { send: (channel, requestId) => { this.saveRequest = { channel, requestId }; } };
      this.closed = false;
    }
    setMenuBarVisibility() {}
    loadFile() {}
    isDestroyed() { return this.closed; }
    close() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      this.emit('close', event);
      if (!event.defaultPrevented) {
        this.closed = true;
        this.emit('closed');
      }
      return event.defaultPrevented;
    }
  }
  const context = {
    BrowserWindow: Window,
    ipcMain,
    dialog: { showMessageBox: async () => { prompts++; return { response: answer }; } },
    path,
    crypto,
    setTimeout,
    clearTimeout,
    APP_ROOT: '.',
    LOCAL_MODE: true,
    console
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.createWindow = createWindow;`, context);
  return { win: context.createWindow(), ipcMain, choose(value) { answer = value; }, prompts() { return prompts; } };
}

async function finishSave(harness, saved) {
  const { win, ipcMain } = harness;
  assert.equal(win.saveRequest?.channel, 'app:save-before-close');
  if (saved) ipcMain.emit('app:pending-changes', { sender: win.webContents }, false);
  ipcMain.emit('app:save-before-close-result', { sender: win.webContents }, win.saveRequest.requestId, saved);
  await new Promise(resolve => setImmediate(resolve));
}

test('a janela fecha normalmente quando a ficha está salva', () => {
  const { win } = closeHarness();
  assert.equal(win.close(), false);
  assert.equal(win.closed, true);
});

test('alterações pendentes são salvas automaticamente antes de fechar', async () => {
  const harness = closeHarness();
  const { win, ipcMain } = harness;
  ipcMain.emit('app:pending-changes', { sender: win.webContents }, true);
  assert.equal(win.close(), true);
  await finishSave(harness, true);
  assert.equal(win.closed, true);
  assert.equal(harness.prompts(), 0);
});

test('falha ao salvar mostra escolha e permite voltar à ficha', async () => {
  const harness = closeHarness();
  const { win, ipcMain } = harness;
  ipcMain.emit('app:pending-changes', { sender: win.webContents }, true);
  assert.equal(win.close(), true);
  await finishSave(harness, false);
  assert.equal(harness.prompts(), 1);
  assert.equal(win.closed, false);
  ipcMain.emit('app:pending-changes', { sender: win.webContents }, false);
  assert.equal(win.close(), false);
  assert.equal(win.closed, true);
});

test('o usuário consegue fechar mesmo quando o salvamento falhou', async () => {
  const harness = closeHarness();
  const { win, ipcMain, choose } = harness;
  ipcMain.emit('app:pending-changes', { sender: win.webContents }, true);
  choose(1);
  assert.equal(win.close(), true);
  await finishSave(harness, false);
  assert.equal(win.closed, true);
});
