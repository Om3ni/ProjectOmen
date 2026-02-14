/**
 * Context Loader - Generates RPR context from the currently loaded editor data
 * and optionally loads documentation from app resources.
 *
 * This replaces the old approach of loading a hardcoded WHRpR.txt file.
 * Now it reads from whatever system is actually loaded in the editor.
 */

export interface RPRContext {
  systemGuide: string;
  editorSummary: string; // Summary generated from live editor data
}

type ElectronBridge = {
  fs?: {
    readTextFile?: (filePath: string) => Promise<string>;
    readAppResourceFile?: (relativePath: string) => Promise<string>;
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
 * Load RPR system guide from app resources (documentation only)
 */
async function loadSystemGuide(): Promise<string> {
  const el = getElectron();
  if (!el?.fs?.readAppResourceFile) {
    console.warn('[ContextLoader] Electron bridge not available for documentation');
    return '';
  }

  try {
    const guide = await el.fs.readAppResourceFile('docs/RPR_SYSTEM_GUIDE.md');
    console.log('[ContextLoader] Loaded RPR_SYSTEM_GUIDE.md');
    return guide;
  } catch (error) {
    console.warn('[ContextLoader] Could not load RPR_SYSTEM_GUIDE.md:', error);
    return '';
  }
}

/**
 * Load RPR context from the currently loaded editor data
 * Instead of reading a hardcoded file, this reads from live editor state
 */
export async function loadRPRContext(editorData?: Record<string, any>): Promise<RPRContext | null> {
  try {
    console.log('[ContextLoader] Loading RPR context...');

    const systemGuide = await loadSystemGuide();

    // Generate summary from live editor data if available
    let editorSummary = '';
    if (editorData) {
      editorSummary = generateEditorDataSummary(editorData);
      console.log('[ContextLoader] Generated context from live editor data');
    } else {
      console.warn('[ContextLoader] No editor data provided - Ollama will need to call getSystemOverview()');
    }

    return {
      systemGuide,
      editorSummary,
    };
  } catch (error) {
    console.error('[ContextLoader] Failed to load RPR context:', error);
    return null;
  }
}

/**
 * Generate a summary of the currently loaded editor data
 * This gives Ollama immediate understanding of the loaded system
 */
function generateEditorDataSummary(data: Record<string, any>): string {
  const safeArray = (table: string): any[] => {
    const rows = data[table];
    return Array.isArray(rows) ? rows : [];
  };

  const skillDefs = safeArray('SkillDef');
  const perkDefs = safeArray('PerkDef');
  const perkActions = safeArray('PerkAction');
  const stats = safeArray('Stat');
  const spellDefs = safeArray('SpellDef');
  const spellEffects = safeArray('SpellEffect');
  const statusDefs = safeArray('StatusDef');
  const runeDefs = safeArray('RuneDef');
  const diceConfig = safeArray('DiceConfig');

  const attributes = skillDefs.filter((s: any) => String(s.TypeFlag) === 't');
  const skills = skillDefs.filter((s: any) => String(s.TypeFlag) !== 't');

  const totalRecords = attributes.length + skills.length + perkDefs.length + stats.length + spellDefs.length + statusDefs.length + runeDefs.length;

  // For empty systems, keep it minimal
  if (totalRecords === 0) {
    let summary = `# Currently Loaded RPR System\n\n**Empty system** — no records loaded. Ready for a fresh build.\n`;
    if (diceConfig.length > 0) {
      const dc = diceConfig[0];
      summary += `\nDice config: ${dc.AttributePoints ?? 0} attr pts, ${dc.SkillPoints ?? 0} skill pts, ${dc.PerkPoints ?? 0} perk pts\n`;
    }
    return summary;
  }

  // Non-empty system: compact summary
  let summary = `# Currently Loaded RPR System\n\n`;

  if (diceConfig.length > 0) {
    const dc = diceConfig[0];
    summary += `Dice config: ${dc.AttributePoints ?? 0} attr pts, ${dc.SkillPoints ?? 0} skill pts, ${dc.PerkPoints ?? 0} perk pts, ${dc.TotalNodes ?? 0} total nodes\n\n`;
  }

  summary += `**Records:** ${attributes.length} attributes, ${skills.length} skills, ${perkDefs.length} perks (${perkActions.length} actions), ${stats.length} stats, ${spellDefs.length} abilities (${spellEffects.length} effects), ${statusDefs.length} statuses, ${runeDefs.length} runes\n`;

  // Only list attributes/skills/stats if they exist
  if (attributes.length > 0) {
    summary += `\n## Attributes\n`;
    for (const attr of attributes.slice(0, 10)) {
      summary += `- ID ${attr['Node ID'] ?? attr.ID}: ${attr.Name}\n`;
    }
    if (attributes.length > 10) summary += `  ... and ${attributes.length - 10} more\n`;
  }

  if (skills.length > 0) {
    summary += `\n## Skills (sample)\n`;
    for (const skill of skills.slice(0, 10)) {
      const bonus = skill['Bonus Source'] ? ` [${skill['Bonus Source']}]` : '';
      summary += `- ID ${skill['Node ID'] ?? skill.ID}: ${skill.Name}${bonus}\n`;
    }
    if (skills.length > 10) summary += `  ... and ${skills.length - 10} more\n`;
  }

  if (stats.length > 0) {
    summary += `\n## Stats (sample)\n`;
    for (const stat of stats.slice(0, 10)) {
      const formula = stat.Formula ? ` [${stat.Formula}]` : '';
      summary += `- ID ${stat.ID}: ${stat.Name}${formula}\n`;
    }
    if (stats.length > 10) summary += `  ... and ${stats.length - 10} more\n`;
  }

  if (perkDefs.length > 0) {
    const perkCategories: Record<string, number> = {};
    for (const p of perkDefs) {
      const cat = p.Category || 'Uncategorized';
      perkCategories[cat] = (perkCategories[cat] || 0) + 1;
    }
    summary += `\n## Perk Categories\n`;
    for (const [cat, count] of Object.entries(perkCategories)) {
      summary += `- ${cat}: ${count}\n`;
    }
  }

  if (spellDefs.length > 0) {
    const abilityCategories: Record<string, number> = {};
    for (const a of spellDefs) {
      const cat = a.Category || 'Uncategorized';
      abilityCategories[cat] = (abilityCategories[cat] || 0) + 1;
    }
    summary += `\n## Ability Categories\n`;
    for (const [cat, count] of Object.entries(abilityCategories)) {
      summary += `- ${cat}: ${count}\n`;
    }
  }

  return summary;
}

/**
 * Generate context summary message for Ollama conversation.
 * IMPORTANT: Only include the editor data summary here, NOT the full system guide.
 * The 28KB RPR_SYSTEM_GUIDE.md is available via readDocsFile() when needed —
 * injecting it into every conversation wastes ~8K tokens of prompt on an 8B model.
 */
export function generateContextSummary(context: RPRContext): string {
  let summary = `# RPR System Context\n\n`;

  if (context.editorSummary) {
    summary += context.editorSummary + '\n\n';
  }

  // Don't inject the full system guide — it's 28KB and available via readDocsFile("RPR_SYSTEM_GUIDE.md")
  if (context.systemGuide) {
    summary += `*Full RPR design guide available via readDocsFile("RPR_SYSTEM_GUIDE.md") — retrieve when needed, not preloaded.*\n\n`;
  }

  return summary;
}
