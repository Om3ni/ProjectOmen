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
    listFiles: (dirPath) => ipcRenderer.invoke('fs:listFiles', dirPath),
    deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
    readAppResourceFile: (relativePath) => ipcRenderer.invoke('fs:readAppResourceFile', relativePath),
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
    getAppRoot: () => ipcRenderer.invoke('app:getAppRoot'),
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

  // Bundled Ollama management
  ollamaLocal: {
    getStatus: () => ipcRenderer.invoke('ollama:status'),
    start: () => ipcRenderer.invoke('ollama:start'),
    stop: () => ipcRenderer.invoke('ollama:stop'),
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    pullModel: (modelName) => ipcRenderer.invoke('ollama:pullModel', modelName),
    deleteModel: (modelName) => ipcRenderer.invoke('ollama:deleteModel', modelName),
    getModelsDir: () => ipcRenderer.invoke('ollama:getModelsDir'),
    setModelsDir: (newPath) => ipcRenderer.invoke('ollama:setModelsDir', newPath),
    browseModelsDir: () => ipcRenderer.invoke('ollama:browseModelsDir'),
    onPullProgress: (listener) => {
      const wrapped = (_event, data) => {
        try {
          listener(data);
        } catch {
          // ignore
        }
      };
      ipcRenderer.on('ollama:pullProgress', wrapped);
      return () => ipcRenderer.removeListener('ollama:pullProgress', wrapped);
    },
  },

  sheetWindow: {
    open: (payload) => ipcRenderer.invoke('window:openCharacterSheet', payload),
    getData: () => ipcRenderer.invoke('window:getCharacterSheetData'),
    update: (payload) => ipcRenderer.send('sheet:update', payload),
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
