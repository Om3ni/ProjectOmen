/**
 * File system functions — Give Sigil read access to docs/ reference files
 * and read/write access to a memory file in its save folder.
 *
 * docs/  = RPR reference systems (WHRpR.txt, SHRpR.txt, etc.)
 * memory = Sigil's persistent notes (sigil-memory.md in save folder)
 */

import type { FunctionHandler, OllamaFunction } from '../types';

const MEMORY_FILE = 'sigil-memory.md';

type ElectronBridge = {
  fs?: {
    readTextFile?: (filePath: string) => Promise<string>;
    writeTextFile?: (filePath: string, content: string) => Promise<boolean>;
    listFiles?: (dirPath: string) => Promise<string[]>;
    readAppResourceFile?: (relativePath: string) => Promise<string>;
  };
  app?: {
    getSaveFolder?: () => Promise<string>;
    getAppRoot?: () => Promise<string>;
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

// ─── docs/ file access ───────────────────────────────────────────────

/**
 * List all files in the docs/ directory
 */
export const listDocsFiles: FunctionHandler = async (_args, _context) => {
  try {
    const el = getElectron();

    if (el?.fs?.readAppResourceFile) {
      // Probe known files using readAppResourceFile (resolves dev + prod paths)
      const knownFiles = [
        'docs/WHRpR.txt',
        'docs/SHRpR.txt',
        'docs/CXRpR.txt',
        'docs/Beutxlearning.txt',
        'docs/testrpr.txt',
        'docs/mutatorautomationrpr.txt',
        'docs/A_AllTables.txt',
        'docs/A_SequenceIDReference.txt',
        'docs/a_Spelldef.txt',
        'docs/RPR_SYSTEM_GUIDE.md',
      ];

      // Check which ones actually exist by trying to read the first few bytes
      const available: string[] = [];
      for (const f of knownFiles) {
        try {
          if (el.fs.readAppResourceFile) {
            await el.fs.readAppResourceFile(f);
            available.push(f.replace('docs/', ''));
          }
        } catch {
          // File doesn't exist in this location
        }
      }

      if (available.length > 0) {
        return {
          success: true,
          data: {
            files: available,
            hint: 'Use readDocsFile with a filename to read any of these files. Large files may be truncated — use the offset parameter to paginate.',
          },
        };
      }
    }

    return {
      success: false,
      error: 'File system access not available (requires Electron)',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Read a file from the docs/ directory
 */
export const readDocsFile: FunctionHandler = async (args, _context) => {
  try {
    const { filename, offset, limit } = args;
    if (!filename) {
      return { success: false, error: 'filename is required' };
    }

    const el = getElectron();
    if (!el?.fs?.readAppResourceFile) {
      return { success: false, error: 'File system access not available (requires Electron)' };
    }

    // Security: prevent path traversal
    const clean = String(filename).replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const relativePath = clean.startsWith('docs/') ? clean : `docs/${clean}`;

    const content = await el.fs.readAppResourceFile(relativePath);

    // Apply pagination if requested
    const lines = content.split('\n');
    const startLine = Math.max(0, Number(offset) || 0);
    const maxLines = Math.min(Math.max(1, Number(limit) || 200), 500);
    const slice = lines.slice(startLine, startLine + maxLines);

    return {
      success: true,
      data: {
        filename: clean,
        totalLines: lines.length,
        offset: startLine,
        linesReturned: slice.length,
        hasMore: startLine + maxLines < lines.length,
        content: slice.join('\n'),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// ─── Baseline (Tier A) memory ─────────────────────────────────────────

const BASELINE_FILE = 'docs/sigil-baseline.md';

/**
 * Read the shipped baseline contract (Tier A — read-only).
 * Loaded from app resources, never user-writable.
 */
export const readBaseline: FunctionHandler = async (_args, _context) => {
  try {
    const el = getElectron();
    if (!el?.fs?.readAppResourceFile) {
      return { success: false, error: 'File system access not available (requires Electron)' };
    }

    const content = await el.fs.readAppResourceFile(BASELINE_FILE);
    return {
      success: true,
      data: { content },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// ─── Memory file access ──────────────────────────────────────────────

async function getMemoryPath(): Promise<string> {
  const el = getElectron();
  // Use getSaveFolder (per-user, writable) not getAppRoot (install root, may be read-only)
  if (el?.app?.getSaveFolder) {
    const saveFolder = await el.app.getSaveFolder();
    const sep = saveFolder.includes('\\') ? '\\' : '/';
    return `${saveFolder}${sep}${MEMORY_FILE}`;
  }
  return MEMORY_FILE;
}

/**
 * Read Sigil's persistent memory file
 */
export const readMemory: FunctionHandler = async (_args, _context) => {
  try {
    const el = getElectron();
    if (!el?.fs?.readTextFile) {
      return { success: false, error: 'File system access not available (requires Electron)' };
    }

    const memPath = await getMemoryPath();

    try {
      const content = await el.fs.readTextFile(memPath);
      return {
        success: true,
        data: {
          path: memPath,
          content,
        },
      };
    } catch {
      return {
        success: true,
        data: {
          path: memPath,
          content: null,
          hint: 'No memory file exists yet. Use writeMemory to create one.',
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Write/update Sigil's persistent memory file
 */
export const writeMemory: FunctionHandler = async (args, _context) => {
  try {
    const { content } = args;
    if (content === undefined || content === null) {
      return { success: false, error: 'content is required' };
    }

    const el = getElectron();
    if (!el?.fs?.writeTextFile) {
      return { success: false, error: 'File system access not available (requires Electron)' };
    }

    const memPath = await getMemoryPath();
    const ok = await el.fs.writeTextFile(memPath, String(content));

    if (!ok) {
      return { success: false, error: 'Write failed' };
    }

    return {
      success: true,
      data: {
        path: memPath,
        bytesWritten: String(content).length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// ─── Function definitions ────────────────────────────────────────────

export const fileSystemFunctionDefinitions: OllamaFunction[] = [
  {
    name: 'listDocsFiles',
    description: 'List available reference files in the docs/ folder. These are RPR system files (WHRpR.txt, SHRpR.txt, etc.) and reference documentation (A_AllTables.txt, RPR_SYSTEM_GUIDE.md).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'readDocsFile',
    description: 'Read a reference file from the docs/ folder. Returns paginated content. Use listDocsFiles first to see available files. These files contain complete RPR system definitions — pipe-delimited tables like SkillDef, PerkDef, Stat, SpellDef, MutatorDef, etc.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Filename to read (e.g., "WHRpR.txt", "A_AllTables.txt", "RPR_SYSTEM_GUIDE.md")',
        },
        offset: {
          type: 'number',
          description: 'Line offset to start reading from (default 0). Use for pagination on large files.',
        },
        limit: {
          type: 'number',
          description: 'Max lines to return (default 200, max 500). Use smaller values for large files to stay within context.',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'readMemory',
    description: 'Read your persistent memory file. This file persists across conversations — use it to store notes, learnings, system analysis, and design insights. Call this at session start to load previous notes.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'writeMemory',
    description: 'Write/update your persistent memory file. Use this to store knowledge that should persist across conversations — system analysis, design notes, user preferences, RPR patterns discovered. You control the full content (overwrites previous), so read first then append.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Full content to write to the memory file (markdown recommended)',
        },
      },
      required: ['content'],
    },
  },
];

export const fileSystemFunctions = {
  listDocsFiles,
  readDocsFile,
  readBaseline,
  readMemory,
  writeMemory,
};
