const { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const { spawn } = require('child_process');
const http = require('http');
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

// ---------------------------------------------------------------------------
// Bundled Ollama process management
// ---------------------------------------------------------------------------
const OLLAMA_PORT = 11435; // Non-default to avoid conflict with user-installed Ollama
const OLLAMA_HOST = `127.0.0.1:${OLLAMA_PORT}`;
const OLLAMA_URL = `http://${OLLAMA_HOST}`;

let ollamaProcess = null;
let ollamaRunning = false;

function getOllamaExePath() {
  // In packaged app: process.resourcesPath points to resources/
  // In dev: fall back to resources/ollama-win/ in repo root
  const candidates = [
    path.join(process.resourcesPath || '', 'ollama', 'ollama.exe'),
    // Backward-compatible: some builds may ship as resources/ollama-win
    path.join(process.resourcesPath || '', 'ollama-win', 'ollama.exe'),
    path.join(__dirname, '..', 'resources', 'ollama-win', 'ollama.exe'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

// Custom models path can be set via IPC from settings
let customModelsDir = null;

// Test if a directory is writable by trying to create a test file
function isDirectoryWritable(dirPath) {
  try {
    const testFile = path.join(dirPath, '.write-test-' + Date.now());
    fs.writeFileSync(testFile, 'test', 'utf8');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    log.warn('[ollama] directory not writable:', dirPath, e.message);
    return false;
  }
}

// Get the drive letter from a path (e.g., "C:" from "C:\Users\...")
function getDriveLetter(filePath) {
  const match = filePath.match(/^([A-Z]:)/i);
  return match ? match[1].toUpperCase() : null;
}

function getOllamaModelsDir() {
  // CRITICAL: User requirement - NO C: DRIVE DEFAULTS
  // Priority: custom path > app's drive > Documents (if not C:) > userData (last resort)
  
  // 1. Custom path set by user
  if (customModelsDir) {
    try {
      if (!fs.existsSync(customModelsDir)) {
        fs.mkdirSync(customModelsDir, { recursive: true });
      }
      if (isDirectoryWritable(customModelsDir)) {
        log.info('[ollama] using custom models dir:', customModelsDir);
        return customModelsDir;
      }
      log.warn('[ollama] custom models dir not writable, falling back');
    } catch (e) {
      log.warn('[ollama] custom models dir failed, falling back', e);
    }
  }

  // 2. Try to use the same drive as the app executable
  try {
    const exePath = app.getPath('exe');
    const exeDrive = getDriveLetter(exePath);
    log.info('[ollama] app is running from drive:', exeDrive);
    
    if (exeDrive && exeDrive !== 'C:') {
      // Use <drive>:\ProjectOmen\ollama-models
      const modelsDir = path.join(exeDrive, '\\', 'ProjectOmen', 'ollama-models');
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }
      if (isDirectoryWritable(modelsDir)) {
        log.info('[ollama] using models dir on app drive:', modelsDir);
        return modelsDir;
      }
      log.warn('[ollama] app drive models dir not writable, falling back');
    }
  } catch (e) {
    log.warn('[ollama] failed to create models dir on app drive', e);
  }

  // 3. Try Documents folder if it's NOT on C: drive
  try {
    const documentsPath = app.getPath('documents');
    const docsDrive = getDriveLetter(documentsPath);
    
    if (docsDrive && docsDrive !== 'C:') {
      const modelsDir = path.join(documentsPath, 'Project Omen', 'ollama-models');
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }
      if (isDirectoryWritable(modelsDir)) {
        log.info('[ollama] using models dir in Documents (non-C:):', modelsDir);
        return modelsDir;
      }
      log.warn('[ollama] Documents models dir not writable, falling back');
    } else {
      log.info('[ollama] Documents is on C: drive, skipping');
    }
  } catch (e) {
    log.warn('[ollama] failed to create Documents models dir', e);
  }

  // 4. Try any available non-C: drive
  try {
    const drives = ['D:', 'E:', 'F:', 'G:', 'H:'];
    for (const drive of drives) {
      try {
        const testDir = path.join(drive, '\\', 'ProjectOmen');
        if (fs.existsSync(testDir) || fs.existsSync(drive + '\\')) {
          const modelsDir = path.join(drive, '\\', 'ProjectOmen', 'ollama-models');
          if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
          }
          if (isDirectoryWritable(modelsDir)) {
            log.info('[ollama] using models dir on available drive:', modelsDir);
            return modelsDir;
          }
        }
      } catch {
        // Drive not accessible, try next
      }
    }
  } catch (e) {
    log.warn('[ollama] failed to find writable non-C: drive', e);
  }

  // 5. Absolute last resort: userData (C: drive)
  // Only if all other options failed
  const userDataPath = app.getPath('userData');
  const fallbackDir = path.join(userDataPath, 'ollama-models');
  log.warn('[ollama] WARNING: All non-C: drive options failed, using userData as last resort:', fallbackDir);
  log.warn('[ollama] Consider manually setting a models directory on a different drive');
  try {
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
  } catch (e) {
    log.error('[ollama] critical: cannot create any models directory', e);
  }
  return fallbackDir;
}

function startOllama() {
  const exePath = getOllamaExePath();
  if (!exePath) {
    log.info('[ollama] binary not found, skipping bundled Ollama');
    return;
  }

  if (ollamaProcess) {
    log.info('[ollama] already running');
    return;
  }

  const modelsDir = getOllamaModelsDir();
  log.info('[ollama] starting bundled Ollama', { exePath, modelsDir, host: OLLAMA_HOST });

  try {
    ollamaProcess = spawn(exePath, ['serve'], {
      env: {
        ...process.env,
        OLLAMA_HOST: OLLAMA_HOST,
        OLLAMA_MODELS: modelsDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    ollamaProcess.stdout.on('data', (data) => {
      log.info('[ollama:stdout]', data.toString().trim());
    });

    ollamaProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) log.info('[ollama:stderr]', msg);
    });

    ollamaProcess.on('error', (err) => {
      log.error('[ollama] process error', err);
      ollamaRunning = false;
      ollamaProcess = null;
    });

    ollamaProcess.on('exit', (code, signal) => {
      log.info('[ollama] process exited', { code, signal });
      ollamaRunning = false;
      ollamaProcess = null;
    });

    // Wait briefly then check if it's responsive
    setTimeout(async () => {
      try {
        const ok = await ollamaHealthCheck();
        ollamaRunning = ok;
        log.info('[ollama] health check:', ok ? 'running' : 'not responding');
      } catch {
        ollamaRunning = false;
      }
    }, 2000);
  } catch (err) {
    log.error('[ollama] failed to start', err);
    ollamaProcess = null;
  }
}

function stopOllama() {
  if (ollamaProcess) {
    log.info('[ollama] stopping bundled Ollama');
    return new Promise((resolve) => {
      const pid = ollamaProcess.pid;
      ollamaProcess.once('exit', () => {
        log.info('[ollama] process stopped (pid:', pid, ')');
        ollamaProcess = null;
        ollamaRunning = false;
        resolve();
      });
      
      try {
        // On Windows, use taskkill for forceful termination
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          exec(`taskkill /pid ${pid} /T /F`, (error) => {
            if (error) {
              log.warn('[ollama] taskkill error', error);
            }
          });
        } else {
          ollamaProcess.kill('SIGTERM');
        }
      } catch (e) {
        log.warn('[ollama] kill error', e);
        ollamaProcess = null;
        ollamaRunning = false;
        resolve();
      }
      
      // Force resolve after 3 seconds if process doesn't exit
      setTimeout(() => {
        if (ollamaProcess) {
          log.warn('[ollama] force cleanup after timeout');
          ollamaProcess = null;
          ollamaRunning = false;
        }
        resolve();
      }, 3000);
    });
  }
  return Promise.resolve();
}

function ollamaHealthCheck() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_URL}/api/version`, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

function ollamaFetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, OLLAMA_URL);
    const bodyBuffer = options.body ? Buffer.from(options.body) : null;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      // Preserve query string if present
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(bodyBuffer ? { 'Content-Length': bodyBuffer.length } : {}),
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
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

  ipcMain.handle('fs:listFiles', async (_event, dirPath) => {
    const p = coercePath(dirPath);
    try {
      // Create directory if it doesn't exist
      await fs.promises.mkdir(p, { recursive: true });
      const files = await fs.promises.readdir(p);
      return files;
    } catch (error) {
      log.error('Failed to list files:', error);
      return [];
    }
  });

  ipcMain.handle('fs:deleteFile', async (_event, filePath) => {
    const p = coercePath(filePath);
    try {
      await fs.promises.unlink(p);
      return true;
    } catch (error) {
      log.error('Failed to delete file:', error);
      return false;
    }
  });

  // Read file from app resources (resolves relative to app root in dev, resources/ in prod)
  ipcMain.handle('fs:readAppResourceFile', async (_event, relativePath) => {
    // Try resources folder first (production extraResources location)
    // Then fall back to app.asar location (development)
    const resourcesPath = process.resourcesPath || '';
    const appRoot = app.getAppPath();
    
    const paths = [
      path.join(resourcesPath, relativePath),  // Production: resources/docs/WHRpR.txt
      path.join(appRoot, relativePath),        // Dev: workspace/docs/WHRpR.txt
    ];
    
    for (const fullPath of paths) {
      try {
        log.info(`[main] Trying to read: ${fullPath}`);
        const buf = await fs.promises.readFile(fullPath, 'utf8');
        log.info(`[main] ✓ Successfully read ${relativePath} from ${fullPath}`);
        return String(buf);
      } catch (error) {
        log.warn(`[main] Failed path: ${fullPath}`);
        continue;
      }
    }
    
    log.error(`[main] Could not find ${relativePath} in any location`);
    throw new Error(`File not found: ${relativePath}`);
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

  // Get a writable app root directory
  // Dev: repo root (app.getAppPath())
  // Prod: resources/ folder next to app.asar (writable, persists across updates)
  ipcMain.handle('app:getAppRoot', async () => {
    const appPath = app.getAppPath();
    if (appPath.includes('app.asar')) {
      return process.resourcesPath;
    }
    return appPath;
  });

  // -----------------------------------------------------------------------
  // Bundled Ollama IPC handlers
  // -----------------------------------------------------------------------
  ipcMain.handle('ollama:status', async () => {
    const hasBinary = !!getOllamaExePath();
    const healthy = await ollamaHealthCheck();
    ollamaRunning = healthy;
    log.info('[ollama] status check:', { available: hasBinary, running: healthy });
    return {
      available: hasBinary,
      running: healthy,
      endpoint: OLLAMA_URL,
      port: OLLAMA_PORT,
    };
  });

  ipcMain.handle('ollama:start', async () => {
    log.info('[ollama] start requested');
    startOllama();
    // Give it a moment to start
    await new Promise((r) => setTimeout(r, 2500));
    const healthy = await ollamaHealthCheck();
    ollamaRunning = healthy;
    log.info('[ollama] start result:', healthy ? 'running' : 'failed');
    return { running: healthy, endpoint: OLLAMA_URL };
  });

  ipcMain.handle('ollama:stop', async () => {
    await stopOllama();
    return { running: false };
  });

  ipcMain.handle('ollama:listModels', async () => {
    try {
      log.info('[ollama] listing models');
      const data = await ollamaFetch('/api/tags');
      const models = (data.models || []).map((m) => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
      }));
      log.info('[ollama] found', models.length, 'models');
      return { success: true, models };
    } catch (err) {
      log.error('[ollama] list models failed:', err.message);
      return { success: false, error: err.message, models: [] };
    }
  });

  ipcMain.handle('ollama:pullModel', async (event, modelName) => {
    const modelsDir = getOllamaModelsDir();
    log.info('[ollama] starting model pull:', modelName, 'to directory:', modelsDir);
    
    try {
      const url = new URL('/api/pull', OLLAMA_URL);
      const reqOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };

      return new Promise((resolve, reject) => {
        const req = http.request(reqOptions, (res) => {
          log.info('[ollama] pull response status:', res.statusCode);
          
          // Handle non-200 status codes
          if (res.statusCode !== 200) {
            let errorBody = '';
            res.on('data', (chunk) => { errorBody += chunk.toString(); });
            res.on('end', () => {
              const errorMsg = `HTTP ${res.statusCode}: ${errorBody || res.statusText}`;
              log.error('[ollama] pull failed with status', res.statusCode, errorBody);
              reject(new Error(errorMsg));
            });
            return;
          }

          let lastStatus = '';
          let buffer = '';  // Buffer for partial NDJSON lines
          let progressCount = 0;
          let hasError = false;

          res.on('data', (chunk) => {
            buffer += chunk.toString();
            // Split on newlines and process complete lines
            const parts = buffer.split('\n');
            // Keep the last part (might be incomplete)
            buffer = parts.pop() || '';

            for (const line of parts) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const progress = JSON.parse(trimmed);
                lastStatus = progress.status || '';
                progressCount++;
                
                // Log progress periodically (every 50 updates) to avoid spam
                if (progressCount % 50 === 0 || progress.status === 'success') {
                  log.info('[ollama] pull progress:', modelName, progress.status, 
                    progress.completed ? `${progress.completed}/${progress.total}` : '');
                }
                
                // Check for error in progress
                if (progress.error) {
                  log.error('[ollama] pull error in progress:', progress.error);
                  log.error('[ollama] models directory:', modelsDir);
                  hasError = true;
                  
                  // Enrich error message with context
                  let errorMsg = progress.error;
                  if (errorMsg.includes('file does not exist') || errorMsg.includes('permission denied')) {
                    errorMsg += `\n\nModels directory: ${modelsDir}\nPlease check folder permissions or change the models directory in Ollama settings.`;
                  }
                  reject(new Error(errorMsg));
                  return;
                }
                
                const isDone = progress.status === 'success';
                // Send progress to renderer
                const win = BrowserWindow.fromWebContents(event.sender);
                if (win && !win.isDestroyed()) {
                  win.webContents.send('ollama:pullProgress', {
                    model: modelName,
                    status: progress.status || '',
                    total: progress.total || 0,
                    completed: progress.completed || 0,
                    done: isDone,
                  });
                }
              } catch (e) {
                log.error('[ollama] failed to parse pull progress line:', trimmed.substring(0, 100), e.message);
                // Don't fail the entire pull for a single parse error, but make it visible
              }
            }
          });
          
          res.on('end', () => {
            if (hasError) return; // Already rejected
            
            // Process any remaining buffered data
            if (buffer.trim()) {
              try {
                const progress = JSON.parse(buffer.trim());
                lastStatus = progress.status || lastStatus;
                
                if (progress.error) {
                  log.error('[ollama] pull error in final buffer:', progress.error);
                  log.error('[ollama] models directory:', modelsDir);
                  
                  let errorMsg = progress.error;
                  if (errorMsg.includes('file does not exist') || errorMsg.includes('permission denied')) {
                    errorMsg += `\n\nModels directory: ${modelsDir}\nPlease check folder permissions or change the models directory in Ollama settings.`;
                  }
                  reject(new Error(errorMsg));
                  return;
                }
                
                const win = BrowserWindow.fromWebContents(event.sender);
                if (win && !win.isDestroyed()) {
                  win.webContents.send('ollama:pullProgress', {
                    model: modelName,
                    status: progress.status || '',
                    total: progress.total || 0,
                    completed: progress.completed || 0,
                    done: progress.status === 'success',
                  });
                }
              } catch (e) {
                log.warn('[ollama] failed to parse final buffer:', e.message);
              }
            }
            
            log.info('[ollama] pull completed:', modelName, 'final status:', lastStatus);
            
            // Always send a final done event
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && !win.isDestroyed()) {
              win.webContents.send('ollama:pullProgress', {
                model: modelName,
                status: lastStatus || 'Complete',
                total: 0,
                completed: 0,
                done: true,
              });
            }
            resolve({ success: true, status: lastStatus });
          });
        });
        
        req.on('error', (err) => {
          log.error('[ollama] pull request error:', modelName, err.message, err.code);
          log.error('[ollama] models directory:', modelsDir);
          reject(err);
        });
        
        req.setTimeout(600000, () => {
          log.error('[ollama] pull timeout after 10 minutes:', modelName);
          log.error('[ollama] models directory:', modelsDir);
          req.destroy();
          reject(new Error('Pull timeout (10 min)'));
        });
        
        const payload = JSON.stringify({ name: modelName, stream: true });
        log.info('[ollama] sending pull request:', payload);
        req.write(payload);
        req.end();
      });
    } catch (err) {
      log.error('[ollama] pull exception:', modelName, err.message);
      log.error('[ollama] models directory:', modelsDir);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ollama:deleteModel', async (_event, modelName) => {
    try {
      log.info('[ollama] deleting model:', modelName);
      await ollamaFetch('/api/delete', {
        method: 'DELETE',
        body: JSON.stringify({ name: modelName }),
      });
      log.info('[ollama] model deleted successfully:', modelName);
      return { success: true };
    } catch (err) {
      log.error('[ollama] delete model failed:', modelName, err.message);
      return { success: false, error: err.message };
    }
  });

  // Models directory management
  ipcMain.handle('ollama:getModelsDir', async () => {
    return { path: getOllamaModelsDir() };
  });

  ipcMain.handle('ollama:setModelsDir', async (_event, newPath) => {
    try {
      log.info('[ollama] setting models dir to:', newPath);
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      customModelsDir = newPath;
      log.info('[ollama] models dir set successfully');
      
      // Restart Ollama so it picks up the new models path
      if (ollamaRunning) {
        log.info('[ollama] restarting to apply new models dir');
        await stopOllama();
        await new Promise((r) => setTimeout(r, 1000)); // Wait for cleanup
        startOllama();
        await new Promise((r) => setTimeout(r, 4000)); // Wait longer for startup
        
        // Verify it's running with new path
        const healthy = await ollamaHealthCheck();
        if (healthy) {
          log.info('[ollama] successfully restarted with new models dir');
        } else {
          log.error('[ollama] failed to restart after models dir change');
        }
      }
      return { success: true, path: newPath };
    } catch (err) {
      log.error('[ollama] set models dir failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ollama:browseModelsDir', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Models Directory',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: getOllamaModelsDir(),
      });
      if (result.canceled || !result.filePaths.length) {
        return { canceled: true };
      }
      const selectedPath = result.filePaths[0];
      customModelsDir = selectedPath;
      log.info('[ollama] models dir browsed to', selectedPath);
      
      // Restart Ollama so it picks up the new models path
      if (ollamaRunning) {
        log.info('[ollama] restarting after browse');
        await stopOllama();
        await new Promise((r) => setTimeout(r, 1000)); // Wait for cleanup
        startOllama();
        await new Promise((r) => setTimeout(r, 4000)); // Wait longer for startup
        
        // Verify it's running
        const healthy = await ollamaHealthCheck();
        log.info('[ollama] restart after browse:', healthy ? 'success' : 'failed');
      }
      return { canceled: false, path: selectedPath };
    } catch (err) {
      log.error('[ollama] browse models dir error:', err.message);
      return { canceled: true, error: err.message };
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
        { label: 'Formula Calculator…', click: () => sendCommand('tools:formula') },
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

  // Add keyboard shortcut handling directly in the window for more reliable DevTools access
  win.webContents.on('before-input-event', (event, input) => {
    // F12 toggles DevTools
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    // Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (macOS) toggles DevTools
    if (input.type === 'keyDown' && input.key === 'I' && 
        ((input.control && input.shift) || (input.meta && input.alt))) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

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
    // TEMPORARY: Auto-open DevTools for debugging
    win.webContents.openDevTools();
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

  // Start bundled Ollama AFTER window is created so startup errors can't prevent the UI
  try {
    startOllama();
  } catch (e) {
    log.error('[ollama] startup failed (non-fatal)', e);
  }

  // Always allow DevTools in the desktop app (including packaged EXEs).
  // The menu bar is auto-hidden, so provide reliable shortcuts.
  try {
    const toggle = () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.toggleDevTools();
      }
    };
    globalShortcut.register('F12', toggle);
    globalShortcut.register('CommandOrControl+Shift+I', toggle);
  } catch (e) {
    log.warn('[main] failed to register devtools shortcuts', e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let isQuitting = false;

app.on('before-quit', async (event) => {
  if (!isQuitting && ollamaProcess) {
    event.preventDefault();
    isQuitting = true;
    
    log.info('[main] app closing, cleaning up Ollama...');
    
    try {
      await stopOllama();
      log.info('[main] Ollama cleanup complete');
    } catch (err) {
      log.error('[main] Ollama cleanup error', err);
    }
    
    try {
      globalShortcut.unregisterAll();
    } catch {
      // ignore
    }
    
    // Now actually quit
    app.quit();
  }
});

app.on('will-quit', (event) => {
  // Additional cleanup if before-quit didn't fire (shouldn't happen, but safety)
  if (ollamaProcess) {
    log.warn('[main] will-quit: Ollama still running, forcing cleanup');
    event.preventDefault();
    
    stopOllama()
      .then(() => {
        log.info('[main] will-quit cleanup complete');
        app.quit();
      })
      .catch((err) => {
        log.error('[main] will-quit cleanup error', err);
        app.quit();
      });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
