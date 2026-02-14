/**
 * Refinement functions - Allow Ollama to read/write its own learning document
 */

import type { FunctionHandler, OllamaFunction } from '../types';

const REFINEMENTS_FILE = 'ollama-refinements.md';

type ElectronBridge = {
  fs?: {
    readTextFile?: (filePath: string) => Promise<string>;
    writeTextFile?: (filePath: string, content: string) => Promise<boolean>;
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

/**
 * Get the refinements file path (app data folder)
 */
async function getRefinementsPath(): Promise<string> {
  const el = getElectron();
  
  // Get app save folder (where user data is stored)
  if (el?.app?.getSaveFolder) {
    const appFolder = await el.app.getSaveFolder();
    const separator = appFolder.includes('\\') ? '\\' : '/';
    return `${appFolder}${separator}${REFINEMENTS_FILE}`;
  }
  
  // Fallback
  return REFINEMENTS_FILE;
}

/**
 * Read file with error handling
 */
async function readFile(filePath: string): Promise<string | null> {
  try {
    const el = getElectron();
    if (!el?.fs?.readTextFile) return null;
    return await el.fs.readTextFile(filePath);
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Write file with error handling
 */
async function writeFile(filePath: string, content: string): Promise<boolean> {
  try {
    const el = getElectron();
    if (!el?.fs?.writeTextFile) return false;
    await el.fs.writeTextFile(filePath, content);
    return true;
  } catch (error) {
    console.error('[Refinements] Write failed:', error);
    return false;
  }
}

/**
 * Read current refinements
 */
export const readRefinements: FunctionHandler = async (_args, _context) => {
  try {
    const filePath = await getRefinementsPath();
    const content = await readFile(filePath);
    
    if (!content) {
      return {
        success: true,
        data: 'No refinements file found yet. Use updateRefinements() to create one and begin learning.',
      };
    }
    
    return {
      success: true,
      data: content,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Append a new refinement to the file
 */
export const updateRefinements: FunctionHandler = async (args, _context) => {
  try {
    const { topic, issue, correction, applyTo } = args;
    const filePath = await getRefinementsPath();
    
    // Read existing content (or use default template)
    let existingContent = await readFile(filePath);
    
    if (!existingContent) {
      // Create initial template
      existingContent = `# Ollama Refinements & Corrections

This file is automatically loaded by Ollama to learn from corrections and improve behavior over time.

**Instructions for Ollama:**
- When told "you did this wrong" or given corrections, append them here
- Load this file at startup and apply all refinements
- Keep refinements specific and actionable

---

## Refinements Log

`;
    }
    
    // Create timestamp
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Format new entry
    const entry = `### ${timestamp} - ${topic}
**Issue:** ${issue}
**Correction:** ${correction}
**Apply to:** ${applyTo}

`;
    
    // Append and write
    const newContent = existingContent + entry;
    const success = await writeFile(filePath, newContent);
    
    if (!success) {
      return {
        success: false,
        error: 'Failed to write refinements file',
      };
    }
    
    return {
      success: true,
      data: `Refinement added successfully to ${filePath}. Future sessions will apply this learning.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Function definitions for Ollama
 */
export const refinementFunctionDefinitions: OllamaFunction[] = [
  {
    name: 'readRefinements',
    description: 'Read the current refinements/corrections that have been taught. Use this at session start to load learnings.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'updateRefinements',
    description: 'When told you did something wrong or given a correction, append it to refinements file. This creates persistent learning across sessions.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Brief topic of the refinement (e.g., "Ability Creation", "Formula Syntax")',
        },
        issue: {
          type: 'string',
          description: 'What was done incorrectly',
        },
        correction: {
          type: 'string',
          description: 'How to do it correctly going forward',
        },
        applyTo: {
          type: 'string',
          description: 'When to apply this correction (e.g., "All future ability creations", "When user mentions turn order")',
        },
      },
      required: ['topic', 'issue', 'correction', 'applyTo'],
    },
  },
];

/**
 * Export function map
 */
export const refinementFunctions = {
  readRefinements,
  updateRefinements,
};
