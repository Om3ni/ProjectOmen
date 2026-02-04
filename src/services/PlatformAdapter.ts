/**
 * Platform abstraction layer for file I/O operations.
 * 
 * Implementations:
 * - BrowserAdapter: fetch + download (current web behavior)
 * - ElectronAdapter: Node fs + dialog (future)
 * - CapacitorAdapter: Filesystem plugin (future)
 */

export interface PickedFile {
  name: string;
  content: string;
}

export interface PlatformAdapter {
  /**
   * Read a file from the given path/URL.
   * In browser: fetch from public folder
   * In Electron: fs.readFile
   * In Capacitor: Filesystem.readFile
   */
  readFile(path: string): Promise<string>;

  /**
   * Write/save a file with the given content.
   * In browser: triggers download
   * In Electron: fs.writeFile with dialog
   * In Capacitor: Filesystem.writeFile
   */
  writeFile(filename: string, content: string, mimeType?: string): Promise<void>;

  /**
   * Open a file picker dialog and return the selected file's content.
   * Returns null if user cancels.
   */
  pickFile(accept?: string): Promise<PickedFile | null>;
}

// Current adapter instance - can be swapped at runtime
let currentAdapter: PlatformAdapter | null = null;

export function setAdapter(adapter: PlatformAdapter): void {
  currentAdapter = adapter;
}

export function getAdapter(): PlatformAdapter {
  if (!currentAdapter) {
    throw new Error('PlatformAdapter not initialized. Call setAdapter() first.');
  }
  return currentAdapter;
}
