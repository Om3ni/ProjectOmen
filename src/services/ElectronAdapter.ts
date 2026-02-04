import type { PlatformAdapter, PickedFile } from './PlatformAdapter';

type ElectronBridge = {
  fs?: {
    readTextFile?: (filePath: string) => Promise<string>;
    writeTextFile?: (filePath: string, content: string) => Promise<boolean>;
  };
  dialog?: {
    openFile?: (options?: unknown) => Promise<{ canceled: boolean; filePaths?: string[] }>;
    saveFile?: (options?: unknown) => Promise<{ canceled: boolean; filePath?: string }>;
  };
  app?: {
    getSaveFolder?: () => Promise<string>;
  };
};

function getElectron(): ElectronBridge | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = typeof window !== 'undefined' ? ((window as any).electron as ElectronBridge | undefined) : undefined;
    return el ?? null;
  } catch {
    return null;
  }
}

function filenameFromPath(filePath: string): string {
  const normalized = String(filePath).replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

/**
 * Electron implementation of PlatformAdapter.
 * Uses Node.js fs module and Electron dialog APIs.
 * 
 * TODO: Implement when adding Electron support
 * 
 * Setup:
 * 1. npm install electron electron-builder
 * 2. Create electron/main.ts with preload exposing fs operations
 * 3. In main.tsx: import { ElectronAdapter } and setAdapter(new ElectronAdapter())
 */
export class ElectronAdapter implements PlatformAdapter {
  async readFile(filePath: string): Promise<string> {
    const el = getElectron();
    if (!el?.fs?.readTextFile) throw new Error('Electron bridge not available (fs.readTextFile).');
    return el.fs.readTextFile(String(filePath));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async writeFile(filename: string, content: string, _mimeType?: string): Promise<void> {
    const el = getElectron();
    if (!el?.dialog?.saveFile || !el?.fs?.writeTextFile) {
      throw new Error('Electron bridge not available (dialog.saveFile/fs.writeTextFile).');
    }

    // Get the dedicated save folder (Documents/Project Omen)
    let defaultPath = String(filename || 'RPR.txt');
    if (el?.app?.getSaveFolder) {
      try {
        const saveFolder = await el.app.getSaveFolder();
        // Use path separator appropriate for the platform
        const separator = saveFolder.includes('\\') ? '\\' : '/';
        defaultPath = saveFolder + separator + (filename || 'RPR.txt');
      } catch {
        // Fall back to just the filename if we can't get the save folder
      }
    }

    const result = await el.dialog.saveFile({
      title: 'Save File',
      defaultPath,
      filters: [
        { name: 'RPR Files', extensions: ['txt', 'rpr'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result || result.canceled || !result.filePath) return;
    await el.fs.writeTextFile(String(result.filePath), String(content));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async pickFile(_accept = '*/*'): Promise<PickedFile | null> {
    const el = getElectron();
    if (!el?.dialog?.openFile || !el?.fs?.readTextFile) {
      throw new Error('Electron bridge not available (dialog.openFile/fs.readTextFile).');
    }

    const result = await el.dialog.openFile({
      title: 'Open File',
      properties: ['openFile'],
      // Keep it simple: accept is not strictly enforced in Electron unless we map filters.
      // The caller still validates content by attempting to parse.
    });

    const firstPath = result?.filePaths?.[0];
    if (!result || result.canceled || !firstPath) return null;

    const content = await el.fs.readTextFile(String(firstPath));
    return {
      name: filenameFromPath(String(firstPath)),
      content,
    };
  }
}
