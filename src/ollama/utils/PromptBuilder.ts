/**
 * Assembles the system prompt from parts with token budgeting.
 */

import { PromptLoader } from './promptLoader';

export interface PromptBuildOptions {
  /** Budget in tokens (from getEffectiveContextSize * 0.4) */
  maxSystemTokens: number;
  /** Live editor summary from contextLoader.generateContextSummary() */
  editorSummary?: string;
  /** Addenda tab names to include (from selectAddenda) */
  addenda: string[];
  /** Selected record context string (from buildSelectedRecordContext) */
  selectedRecordContext?: string;
}

/**
 * Estimate token count using chars/4 approximation.
 * This is for preflight budgeting only — actual token counts
 * come from Ollama response (prompt_eval_count).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Serialize the currently selected record and its child rows
 * into a compact text block for the system prompt.
 *
 * @param data - editor data (Record<string, Row[]>)
 * @param activeCategory - e.g., 'Abilities', 'Perks'
 * @param selectedRecord - the row object from editorState.selected
 * @returns formatted string, or empty string if no record selected
 *
 * Child table mappings:
 *   Abilities → SpellEffect, SpellReqDef, SpellTargetCond (match on SpellID = selected ID)
 *   Perks     → PerkAction (match on PerkID = selected ID)
 *   Runes     → RuneAction (match on RuneID = selected NodeID), RuneCondition (match on RuneID = selected NodeID)
 *   Statuses  → StatusAction (match on StatusID = selected ID)
 *   Mutators  → MutatorAction, MutatorCondition (match on MutatorID = selected ID)
 *   Others    → no child rows
 *
 * Format example:
 *   SELECTED RECORD: SpellDef ID 47 "Fireball"
 *   Category: Destruction | TargetType: 2 | Range: 30 | Cooldown: 3
 *   [list all non-empty columns as Key: Value]
 *
 *   Child rows (SpellEffect): 3 rows
 *   - Row 0: Function=1 (Modify Stat), TargetID=5, Formula=-2d6+{c.INT}
 *   - Row 1: Function=4 (Buff Skill), TargetID=12, Value=-2, Duration=2
 *   [etc.]
 *
 * Token budget: cap at ~500 tokens. If the record + children exceed this,
 * truncate child rows (keep first 8) and add "... and N more".
 */
export function buildSelectedRecordContext(
  data: Record<string, any>,
  activeCategory: string,
  selectedRecord: Record<string, any> | null | undefined
): string {
  if (!selectedRecord || !data) return '';

  // Map category to primary table
  const categoryToTable: Record<string, string> = {
    'Attributes': 'SkillDef',
    'Skills': 'SkillDef',
    'Stats': 'Stat',
    'Perks': 'PerkDef',
    'Abilities': 'SpellDef',
    'Statuses': 'StatusDef',
    'Runes': 'RuneDef',
    'Mutators': 'MutatorDef',
  };

  const tableName = categoryToTable[activeCategory];
  if (!tableName) return '';

  // Get record ID
  const id = selectedRecord['ID'] ?? selectedRecord['Node ID'];
  if (id === undefined || id === null) return '';

  // Build record summary
  const recordName = selectedRecord['Name'] || '(unnamed)';
  let output = `SELECTED RECORD: ${tableName} ID ${id} "${recordName}"\n`;

  // List all non-empty columns
  const columns = Object.entries(selectedRecord)
    .filter(([k, v]) => !k.startsWith('__') && v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
  output += columns + '\n\n';

  // Child table mappings
  const childTables: Record<string, { tables: string[]; fkColumn: string }> = {
    'Abilities': { tables: ['SpellEffect', 'SpellReqDef', 'SpellTargetCond'], fkColumn: 'SpellID' },
    'Perks': { tables: ['PerkAction'], fkColumn: 'PerkID' },
    'Runes': { tables: ['RuneAction', 'RuneCondition'], fkColumn: 'RuneID' },
    'Statuses': { tables: ['StatusAction'], fkColumn: 'StatusID' },
    'Mutators': { tables: ['MutatorAction', 'MutatorCondition'], fkColumn: 'MutatorID' },
  };

  const childMapping = childTables[activeCategory];
  if (childMapping) {
    for (const childTableName of childMapping.tables) {
      const childRows = (data[childTableName] || []).filter(
        (row: any) => String(row[childMapping.fkColumn]) === String(id)
      );

      if (childRows.length > 0) {
        output += `Child rows (${childTableName}): ${childRows.length} rows\n`;

        const maxRows = 8;
        const rowsToShow = childRows.slice(0, maxRows);

        rowsToShow.forEach((row: any, idx: number) => {
          const rowSummary = Object.entries(row)
            .filter(([k, v]) => !k.startsWith('__') && k !== childMapping.fkColumn && v !== '' && v !== undefined && v !== null)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          output += `- Row ${idx}: ${rowSummary}\n`;
        });

        if (childRows.length > maxRows) {
          output += `... and ${childRows.length - maxRows} more\n`;
        }
        output += '\n';
      }
    }
  }

  // Cap at ~500 tokens
  const MAX_TOKENS = 500;
  if (estimateTokens(output) > MAX_TOKENS) {
    // Truncate to approximate token limit
    const charLimit = MAX_TOKENS * 4;
    output = output.substring(0, charLimit) + '\n... (truncated)';
  }

  return output.trim();
}

export class PromptBuilder {
  private loader: PromptLoader;

  constructor(loader: PromptLoader) {
    this.loader = loader;
  }

  /**
   * Build the complete system prompt string.
   *
   * Assembly order:
   * 1. core_system.txt (ALWAYS, budget: uncapped — this is essential)
   * 2. schema_truth.txt (ALWAYS, budget: uncapped)
   * 3. editorSummary (if provided and fits in budget)
   * 4. selectedRecordContext (if provided and fits in budget)
   * 5. addenda (0-2, each checked against remaining budget)
   *
   * Parts are joined with "\n\n---\n\n" separators.
   *
   * If total exceeds maxSystemTokens, drop parts from the bottom
   * (addenda first, then selectedRecordContext, then editorSummary).
   * Core + schema are NEVER dropped.
   */
  async buildSystemPrompt(options: PromptBuildOptions): Promise<string> {
    const parts: string[] = [];
    let remaining = options.maxSystemTokens;

    // 1. Core system (ALWAYS)
    const core = await this.loader.loadCore();
    if (core) {
      parts.push(core);
      remaining -= estimateTokens(core);
    }

    // 2. Schema truth (ALWAYS)
    const schema = await this.loader.loadSchemaTruth();
    if (schema) {
      parts.push(schema);
      remaining -= estimateTokens(schema);
    }

    // 3. Editor summary (if fits)
    if (options.editorSummary) {
      const editorTokens = estimateTokens(options.editorSummary);
      if (editorTokens <= remaining) {
        parts.push(options.editorSummary);
        remaining -= editorTokens;
      } else {
        console.warn('[PromptBuilder] Editor summary exceeds budget, skipping');
      }
    }

    // 4. Selected record context (if fits)
    if (options.selectedRecordContext) {
      const recordTokens = estimateTokens(options.selectedRecordContext);
      if (recordTokens <= remaining) {
        parts.push(options.selectedRecordContext);
        remaining -= recordTokens;
      } else {
        console.warn('[PromptBuilder] Selected record context exceeds budget, skipping');
      }
    }

    // 5. Addenda (max 2, each checked)
    const addendaToLoad = options.addenda.slice(0, 2);
    for (const tabName of addendaToLoad) {
      const addendum = await this.loader.loadAddendum(tabName);
      if (addendum) {
        const addendumTokens = estimateTokens(addendum);
        if (addendumTokens <= remaining) {
          parts.push(addendum);
          remaining -= addendumTokens;
        } else {
          console.warn(`[PromptBuilder] Addendum '${tabName}' exceeds budget, skipping`);
        }
      }
    }

    return parts.join('\n\n---\n\n');
  }
}
