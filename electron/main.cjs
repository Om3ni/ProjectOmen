const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const log = require('electron-log');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'info';

process.on('uncaughtException', (err) => {
  log.error('[main] uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  log.error('[main] unhandledRejection', reason);
});

// Ensure Windows taskbar grouping/icon resolution uses the same AppUserModelID
// as electron-builder's `build.appId`.
if (process.platform === 'win32') {
  try {
    app.setAppUserModelId('com.omen.projectomen');
  } catch (e) {
    log.warn('[main] failed to set AppUserModelId', e);
  }
}

function getAppIconPath() {
  // We package `build/icon.ico` via electron-builder `files: ["build/**"]`.
  // In dev, `app.getAppPath()` is the repo root; in prod it's `.../resources/app.asar`.
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return undefined;
}

function registerIpcHandlers() {
  const coercePath = (maybeUrlOrPath) => {
    const raw = String(maybeUrlOrPath ?? '');
    if (!raw) return raw;

    // Accept proper file URLs like file:///C:/... or file://...
    if (raw.startsWith('file://')) {
      try {
        return fileURLToPath(raw);
      } catch (e) {
        log.warn('[main] failed to convert file URL to path', raw, e);
        return raw;
      }
    }

    // Handle common malformed Windows-ish strings like "file:\\C:\\..." or "file:\C:\..."
    if (raw.toLowerCase().startsWith('file:')) {
      try {
        const trimmed = raw.slice('file:'.length);
        // Strip leading slashes/backslashes.
        const withoutPrefix = trimmed.replace(/^[\\/]+/, '');
        return withoutPrefix;
      } catch {
        return raw;
      }
    }

    return raw;
  };

  ipcMain.handle('fs:readTextFile', async (_event, filePath) => {
    const p = coercePath(filePath);
    const buf = await fs.promises.readFile(p, 'utf8');
    return String(buf);
  });

  ipcMain.handle('fs:writeTextFile', async (_event, filePath, content) => {
    const p = coercePath(filePath);
    await fs.promises.writeFile(p, String(content), 'utf8');
    return true;
  });

  ipcMain.handle('dialog:openFile', async (_event, options) => {
    const result = await dialog.showOpenDialog(options || {});
    return result;
  });

  ipcMain.handle('dialog:saveFile', async (_event, options) => {
    const result = await dialog.showSaveDialog(options || {});
    return result;
  });

  ipcMain.handle('debug:openDevTools', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.webContents.openDevTools({ mode: 'detach' });
    return true;
  });

  ipcMain.handle('debug:getLogPath', async () => {
    return log.transports.file.getFile().path;
  });

  ipcMain.handle('debug:openLogFolder', async () => {
    const logPath = log.transports.file.getFile().path;
    // showItemInFolder works even if the file doesn't exist yet
    shell.showItemInFolder(logPath);
    return true;
  });

  ipcMain.on('debug:log', (_event, payload) => {
    try {
      const msg = payload && typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
      log.info('[renderer]', msg);
    } catch (e) {
      log.info('[renderer]', String(payload));
      log.warn('[renderer] failed to stringify payload', e);
    }
  });

  // Get the dedicated save folder (Documents/Project Omen), creating it if needed
  ipcMain.handle('app:getSaveFolder', async () => {
    try {
      const documentsPath = app.getPath('documents');
      const saveFolder = path.join(documentsPath, 'Project Omen');

      // Create folder if it doesn't exist
      if (!fs.existsSync(saveFolder)) {
        fs.mkdirSync(saveFolder, { recursive: true });
      }

      return saveFolder;
    } catch (e) {
      log.error('[main] getSaveFolder failed', e);
      // Fallback to documents if folder creation fails
      return app.getPath('documents');
    }
  });

  // Child window management
  let rawEditorWindow = null;
  let rawEditorData = null;

  let characterSheetWindow = null;
  let characterSheetData = null;

  ipcMain.handle('window:openRawEditor', async (_event, payload) => {
    try {
      rawEditorData = payload;

      if (rawEditorWindow && !rawEditorWindow.isDestroyed()) {
        rawEditorWindow.focus();
        rawEditorWindow.webContents.send('raw:init', rawEditorData);
        return { success: true, reused: true };
      }

      rawEditorWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Raw Editor - Project Omen',
        autoHideMenuBar: true,
        resizable: true,
        movable: true,
        icon: getAppIconPath(),
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });

      rawEditorWindow.on('closed', () => {
        rawEditorWindow = null;
        rawEditorData = null;
      });

      const urlParam = encodeURIComponent(JSON.stringify({ mode: 'raw-editor' }));
      if (!app.isPackaged) {
        rawEditorWindow.loadURL(`${DEV_SERVER_URL}?raw-editor=1`);
      } else {
        rawEditorWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
          query: { 'raw-editor': '1' },
        });
      }

      rawEditorWindow.webContents.once('did-finish-load', () => {
        rawEditorWindow.webContents.send('raw:init', rawEditorData);
      });

      return { success: true, reused: false };
    } catch (e) {
      log.error('[main] window:openRawEditor failed', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('window:openCharacterSheet', async (_event, payload) => {
    try {
      characterSheetData = payload;

      if (characterSheetWindow && !characterSheetWindow.isDestroyed()) {
        characterSheetWindow.focus();
        characterSheetWindow.webContents.send('sheet:init', characterSheetData);
        return { success: true, reused: true };
      }

      characterSheetWindow = new BrowserWindow({
        width: 800,
        height: 900,
        title: 'Character Sheet - Project Omen',
        autoHideMenuBar: true,
        resizable: true,
        movable: true,
        icon: getAppIconPath(),
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });

      characterSheetWindow.on('closed', () => {
        characterSheetWindow = null;
        characterSheetData = null;
      });

      if (!app.isPackaged) {
        characterSheetWindow.loadURL(`${DEV_SERVER_URL}?sheet=1`);
      } else {
        characterSheetWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
          query: { sheet: '1' },
        });
      }

      characterSheetWindow.webContents.once('did-finish-load', () => {
        characterSheetWindow.webContents.send('sheet:init', characterSheetData);
      });

      return { success: true, reused: false };
    } catch (e) {
      log.error('[main] window:openCharacterSheet failed', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('window:getCharacterSheetData', async () => {
    return characterSheetData;
  });

  ipcMain.on('sheet:close', () => {
    if (characterSheetWindow && !characterSheetWindow.isDestroyed()) {
      characterSheetWindow.close();
    }
  });

  ipcMain.on('sheet:update', (_event, payload) => {
    try {
      characterSheetData = payload;
      if (characterSheetWindow && !characterSheetWindow.isDestroyed()) {
        characterSheetWindow.webContents.send('sheet:init', characterSheetData);
      }
    } catch (e) {
      log.warn('[main] sheet:update failed', e);
    }
  });

  ipcMain.handle('window:getRawEditorData', async () => {
    return rawEditorData;
  });

  ipcMain.on('raw:apply', (_event, payload) => {
    // Forward apply result to main window
    const allWindows = BrowserWindow.getAllWindows();
    const mainWin = allWindows.find(w => w !== rawEditorWindow && !w.isDestroyed());
    if (mainWin) {
      mainWin.webContents.send('raw:applied', payload);
    }
    if (rawEditorWindow && !rawEditorWindow.isDestroyed()) {
      rawEditorWindow.close();
    }
  });

  ipcMain.on('raw:close', () => {
    if (rawEditorWindow && !rawEditorWindow.isDestroyed()) {
      rawEditorWindow.close();
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Project Omen',
    autoHideMenuBar: false,
    resizable: true,
    movable: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Native menu bar (Windows/Linux) with app actions.
  // On macOS, Electron uses the top system menu.
  const sendCommand = (command) => {
    try {
      win.webContents.send('menu:command', { command });
    } catch (e) {
      log.warn('[main] failed to send menu command', command, e);
    }
  };

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendCommand('file:new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendCommand('file:open') },
        { type: 'separator' },
        { label: 'Save (export schema-data.json)…', accelerator: 'CmdOrCtrl+S', click: () => sendCommand('file:save') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => sendCommand('file:settings') },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close' }
          : { role: 'quit' },
      ].filter(Boolean),
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Import from Raw…', click: () => sendCommand('tools:raw:all') },
        { label: 'Select Raw Category…', click: () => sendCommand('tools:raw:category') },
        { type: 'separator' },
        { label: 'Character Sheet…', click: () => sendCommand('tools:sheet') },
        { label: 'Chat Panel', accelerator: 'CmdOrCtrl+Shift+C', click: () => sendCommand('tools:chat') },
        { type: 'separator' },
        { label: 'Backup to Discord…', click: () => sendCommand('tools:discord-backup') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Project Omen', click: () => sendCommand('help:about') },
        { label: 'Integration Setup Guide', click: () => sendCommand('help:setup') },
        { type: 'separator' },
        { label: 'Open Logs Folder', click: async () => {
            try {
              const logPath = log.transports.file.getFile().path;
              shell.showItemInFolder(logPath);
            } catch (e) {
              log.warn('[main] open logs folder failed', e);
            }
          }
        },
      ],
    },
  ];

  try {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch (e) {
    log.warn('[main] failed to set application menu', e);
  }

  // Zoom helpers (Ctrl+Plus/Minus/0 and Ctrl+Wheel)
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 5;
  const ZOOM_STEP = 0.1;

  const setZoom = (factor) => {
    const next = clamp(Number(factor) || 1, ZOOM_MIN, ZOOM_MAX);
    win.webContents.setZoomFactor(next);
    return next;
  };

  const adjustZoom = (delta) => {
    const current = win.webContents.getZoomFactor();
    return setZoom(current + delta);
  };

  try {
    win.webContents.setVisualZoomLevelLimits(1, 5);
  } catch (e) {
    log.warn('[main] failed to set visual zoom limits', e);
  }

  win.webContents.on('before-input-event', (event, input) => {
    const ctrlOrCmd = Boolean(input.control || input.meta);
    if (!ctrlOrCmd) return;

    // Keyboard zoom
    if (input.type === 'keyDown') {
      const key = String(input.key || '');
      if (key === '+' || key === '=' || key === 'Add' || key === 'NumpadAdd') {
        event.preventDefault();
        adjustZoom(ZOOM_STEP);
        return;
      }
      if (key === '-' || key === 'Subtract' || key === 'NumpadSubtract') {
        event.preventDefault();
        adjustZoom(-ZOOM_STEP);
        return;
      }
      if (key === '0' || key === 'Numpad0') {
        event.preventDefault();
        setZoom(1);
        return;
      }
      return;
    }

    // Mouse wheel zoom (Ctrl+Wheel)
    if (input.type === 'mouseWheel') {
      const dy = Number(input.deltaY || 0);
      if (!Number.isFinite(dy) || dy === 0) return;
      event.preventDefault();
      adjustZoom(dy < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }
  });

  if (!app.isPackaged) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // dist/ is produced by Vite build
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // NOTE: Avoid calling app.setName() here.
  // Doing so after startup can trigger Chromium attempting to migrate cache/userData
  // between directories (and that can fail with Access Denied on Windows).
  // If we ever need to change the user-facing name, do it before 'ready' or via
  // electron-builder metadata (productName).

  try {
    // Force at least one log line early so the logs folder/file is created.
    log.info('[main] ready', {
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      userData: app.getPath('userData'),
      exe: process.execPath,
      cwd: process.cwd(),
    });
  } catch (e) {
    // ignore
  }
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
