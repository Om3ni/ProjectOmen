const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Generic IPC
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),

  // Typed-ish helpers used by the app
  fs: {
    readTextFile: (filePath) => ipcRenderer.invoke('fs:readTextFile', filePath),
    writeTextFile: (filePath, content) => ipcRenderer.invoke('fs:writeTextFile', filePath, content),
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  },
  debug: {
    openDevTools: () => ipcRenderer.invoke('debug:openDevTools'),
    getLogPath: () => ipcRenderer.invoke('debug:getLogPath'),
    openLogFolder: () => ipcRenderer.invoke('debug:openLogFolder'),
    log: (payload) => ipcRenderer.send('debug:log', payload),
  },

  app: {
    getSaveFolder: () => ipcRenderer.invoke('app:getSaveFolder'),
  },

  // Native menu integration
  menu: {
    onCommand: (listener) => {
      const wrapped = (_event, payload) => {
        try {
          listener(payload);
        } catch {
          // ignore
        }
      };
      ipcRenderer.on('menu:command', wrapped);
      return () => ipcRenderer.removeListener('menu:command', wrapped);
    },
  },

  // Raw editor window management
  rawWindow: {
    open: (payload) => ipcRenderer.invoke('window:openRawEditor', payload),
    getData: () => ipcRenderer.invoke('window:getRawEditorData'),
    onInit: (listener) => {
      const wrapped = (_event, data) => {
        try {
          listener(data);
        } catch {
          // ignore
        }
      };
      ipcRenderer.on('raw:init', wrapped);
      return () => ipcRenderer.removeListener('raw:init', wrapped);
    },
    apply: (payload) => ipcRenderer.send('raw:apply', payload),
    close: () => ipcRenderer.send('raw:close'),
    onApplied: (listener) => {
      const wrapped = (_event, data) => {
        try {
          listener(data);
        } catch {
          // ignore
        }
      };
      ipcRenderer.on('raw:applied', wrapped);
      return () => ipcRenderer.removeListener('raw:applied', wrapped);
    },
  },

  sheetWindow: {
    open: (payload) => ipcRenderer.invoke('window:openCharacterSheet', payload),
    getData: () => ipcRenderer.invoke('window:getCharacterSheetData'),
    onInit: (listener) => {
      const wrapped = (_event, data) => {
        try {
          listener(data);
        } catch {
          // ignore
        }
      };
      ipcRenderer.on('sheet:init', wrapped);
      return () => ipcRenderer.removeListener('sheet:init', wrapped);
    },
    close: () => ipcRenderer.send('sheet:close'),
  },
});
