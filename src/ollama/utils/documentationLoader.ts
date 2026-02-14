import type { DocumentationResult } from '../types';

/**
 * Loads and searches RPR design documentation for Ollama.
 * Searches both default/ and custom/ folders.
 *
 * In Electron: uses readAppResourceFile IPC (resolves dev + prod paths).
 * In browser:  falls back to fetch() (works with Vite dev server).
 */

interface DocumentationFile {
  path: string;
  name: string;
  content: string;
  isDefault: boolean;
}

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

/**
 * Read a file from the public/ollama-docs tree.
 * Prefers Electron bridge (works in production builds), falls back to fetch().
 */
async function readDocFile(relativePath: string): Promise<string | null> {
  // Try Electron bridge first (resolves both dev and prod paths)
  const el = getElectron();
  if (el?.fs?.readAppResourceFile) {
    try {
      return await el.fs.readAppResourceFile(relativePath);
    } catch {
      // File doesn't exist at this path
      return null;
    }
  }

  // Fallback: fetch (works in Vite dev server where public/ is served at root)
  try {
    const response = await fetch(`/${relativePath}`);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // fetch failed
  }
  return null;
}

class DocumentationLoader {
  private cache: Map<string, DocumentationFile> = new Map();
  private loadedAt: number = 0;
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Load all documentation files from public/ollama-docs/
   */
  async loadAll(): Promise<DocumentationFile[]> {
    // Check cache
    if (this.cache.size > 0 && Date.now() - this.loadedAt < this.CACHE_DURATION) {
      return Array.from(this.cache.values());
    }

    const files: DocumentationFile[] = [];

    // Known default documentation files
    const defaultDocs = [
      'ability-design.md',
      'stat-systems.md',
      'perk-design.md',
      'combat-mechanics.md',
      'balance-principles.md',
      'examples/spell-templates.json',
      'examples/class-archetypes.json',
    ];

    // Load default documentation
    for (const doc of defaultDocs) {
      try {
        const content = await readDocFile(`ollama-docs/default/${doc}`);
        if (content) {
          const file: DocumentationFile = {
            path: `ollama-docs/default/${doc}`,
            name: doc,
            content,
            isDefault: true,
          };
          files.push(file);
          this.cache.set(doc, file);
        }
      } catch (error) {
        console.warn(`Failed to load documentation: ${doc}`, error);
      }
    }

    // Load custom documentation via manifest
    try {
      const manifestContent = await readDocFile('ollama-docs/custom-docs-manifest.json');
      if (manifestContent) {
        const manifest = JSON.parse(manifestContent);
        for (const docMeta of manifest.files || []) {
          try {
            // docMeta.path is typically "/ollama-docs/custom/filename" — strip leading slash
            const relativePath = String(docMeta.path).replace(/^\/+/, '');
            const content = await readDocFile(relativePath);
            if (content) {
              const file: DocumentationFile = {
                path: relativePath,
                name: docMeta.name,
                content,
                isDefault: false,
              };
              files.push(file);
              this.cache.set(`custom:${docMeta.name}`, file);
            }
          } catch (error) {
            console.warn(`Failed to load custom documentation: ${docMeta.name}`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load custom docs manifest:', error);
      // Not a fatal error - custom docs are optional
    }

    this.loadedAt = Date.now();
    return files;
  }

  /**
   * Search documentation for relevant content based on keywords
   */
  async search(query: string, limit: number = 5): Promise<DocumentationResult[]> {
    const docs = await this.loadAll();
    const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: DocumentationResult[] = [];

    for (const doc of docs) {
      // For JSON files, parse and search
      if (doc.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(doc.content);
          const text = JSON.stringify(parsed, null, 2).toLowerCase();
          const relevance = this.calculateRelevance(text, keywords);
          if (relevance > 0) {
            results.push({
              file: doc.name,
              section: 'JSON Data',
              content: doc.content,
              relevance,
            });
          }
        } catch {
          // Invalid JSON, skip
        }
        continue;
      }

      // For markdown/text files, search by section
      const sections = this.extractSections(doc.content);
      for (const section of sections) {
        const relevance = this.calculateRelevance(
          section.title.toLowerCase() + ' ' + section.content.toLowerCase(),
          keywords
        );
        if (relevance > 0) {
          results.push({
            file: doc.name,
            section: section.title,
            content: section.content,
            relevance,
          });
        }
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = [];
    const lines = content.split('\n');
    let currentSection = { title: 'Overview', content: '' };

    for (const line of lines) {
      // Check for section headers (## or ###)
      const headerMatch = line.match(/^#{2,3}\s+(.+)$/);
      if (headerMatch) {
        // Save previous section if it has content
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        // Start new section
        currentSection = {
          title: headerMatch[1].trim(),
          content: '',
        };
      } else {
        currentSection.content += line + '\n';
      }
    }

    // Add last section
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Calculate relevance score based on keyword matches
   */
  private calculateRelevance(text: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
      // Count occurrences
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        // Title/header boost: check if keyword appears in headings
        if (text.match(new RegExp(`^#{1,6}.*${keyword}`, 'mi'))) {
          score += matches.length * 5;
        } else {
          score += matches.length;
        }
      }
    }
    return score;
  }

  /**
   * Get specific documentation file by name
   */
  async getFile(name: string): Promise<DocumentationFile | null> {
    const docs = await this.loadAll();
    return docs.find(doc => doc.name === name) || null;
  }

  /**
   * Clear cache (useful for testing or reloading)
   */
  clearCache(): void {
    this.cache.clear();
    this.loadedAt = 0;
  }
}

// Singleton instance
export const documentationLoader = new DocumentationLoader();

/**
 * Function exposed to Ollama for design guidance
 */
export async function getDesignGuidance(topic: string): Promise<string> {
  try {
    const results = await documentationLoader.search(topic, 3);

    if (results.length === 0) {
      return `No specific guidance found for "${topic}". Available documentation covers: ability design, stat systems, perk design, combat mechanics, and balance principles.`;
    }

    let response = `Design guidance for "${topic}":\n\n`;

    for (const result of results) {
      response += `### ${result.file} - ${result.section}\n`;
      response += result.content;
      response += '\n\n---\n\n';
    }

    return response;
  } catch (error) {
    return `Error loading documentation: ${error instanceof Error ? error.message : String(error)}`;
  }
}
