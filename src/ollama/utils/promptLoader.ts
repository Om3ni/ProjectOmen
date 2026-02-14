/**
 * Cached prompt file loader.
 * Uses Electron IPC readAppResourceFile for both dev and prod.
 * Falls back to fetch() for Vite dev server (no Electron).
 */

type ElectronBridge = {
  fs?: {
    readAppResourceFile?: (relativePath: string) => Promise<string>;
  };
};

function getElectron(): ElectronBridge | null {
  try {
    const el = typeof window !== 'undefined'
      ? ((window as any).electron as ElectronBridge | undefined)
      : undefined;
    return el ?? null;
  } catch {
    return null;
  }
}

export class PromptLoader {
  private cache: Map<string, string> = new Map();

  /**
   * Load a file from the prompts directory.
   * @param relativePath - path relative to prompts/ (e.g., 'core_system.txt')
   * @returns file content, or empty string on failure
   */
  private async loadFile(relativePath: string): Promise<string> {
    const fullPath = `prompts/${relativePath}`;

    // Check cache first
    if (this.cache.has(fullPath)) {
      return this.cache.get(fullPath)!;
    }

    const electron = getElectron();
    let content = '';

    try {
      if (electron?.fs?.readAppResourceFile) {
        // Electron environment (dev or prod)
        content = await electron.fs.readAppResourceFile(fullPath);
      } else {
        // Vite dev server fallback
        const response = await fetch(`/${fullPath}`);
        if (response.ok) {
          content = await response.text();
        } else {
          console.warn(`[PromptLoader] Failed to fetch ${fullPath}: ${response.status}`);
        }
      }
    } catch (error) {
      console.warn(`[PromptLoader] Error loading ${fullPath}:`, error);
    }

    // Cache even if empty (prevents repeated failed loads)
    this.cache.set(fullPath, content);
    return content;
  }

  /**
   * Load prompts/core_system.txt
   * Returns empty string on failure (never throws).
   */
  async loadCore(): Promise<string> {
    return this.loadFile('core_system.txt');
  }

  /**
   * Load prompts/schema_truth.txt
   * Returns empty string on failure (never throws).
   */
  async loadSchemaTruth(): Promise<string> {
    return this.loadFile('schema_truth.txt');
  }

  /**
   * Load a specific addendum file.
   * @param tabName - e.g., 'abilities', 'perks', 'stats'
   * Resolves to: prompts/addenda/tab_help_{tabName}.txt
   * Returns null if file not found or empty.
   */
  async loadAddendum(tabName: string): Promise<string | null> {
    const content = await this.loadFile(`addenda/tab_help_${tabName}.txt`);
    return content.trim().length > 0 ? content : null;
  }

  /**
   * Clear the cache (for testing or hot-reload).
   */
  clearCache(): void {
    this.cache.clear();
  }
}
