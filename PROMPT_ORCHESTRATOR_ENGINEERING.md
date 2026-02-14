# Sigil Prompt Orchestrator — Engineering Specification

> **Purpose**: This document is a complete implementation spec for a Sonnet-class agent.
> Follow it literally. Do not deviate from the architecture, signatures, or integration
> points described. When in doubt, preserve existing behavior.

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [File Manifest](#2-file-manifest)
3. [Spec: promptLoader.ts](#3-spec-promptloaderts)
4. [Spec: addendaPolicy.ts](#4-spec-addendapolicyts)
5. [Spec: PromptBuilder.ts](#5-spec-promptbuilderts)
6. [Spec: OllamaAgent.ts Integration](#6-spec-ollamaaagentts-integration)
7. [Spec: Prompt Content Files](#7-spec-prompt-content-files)
8. [Spec: Electron Build Config](#8-spec-electron-build-config)
9. [DO NOT CHANGE List](#9-do-not-change-list)
10. [Verification](#10-verification)

---

## 1. System Overview

### Problem
Sigil's system prompt is hardcoded in `OllamaAgent.getDefaultSystemPrompt()` (lines 918-970).
The editor data summary (`contextLoader.ts` lines 84-177) only shows the first 10 records per
table. The model **cannot see the record the user is actively editing**. There is no mechanism
to inject tab-specific help on demand.

### Solution
Replace hardcoded prompt with deterministic file-based assembly:
- **Static prompt files** (`prompts/core_system.txt`, `prompts/schema_truth.txt`) — always injected
- **Addenda files** (`prompts/addenda/tab_help_*.txt`) — injected 0-2 per message based on context
- **Selected record context** — serializes the record the user is editing + its child rows
- **Per-message addenda re-evaluation** — addenda swap as user changes topics/tabs

### What is NOT changing
Everything listed in [Section 9](#9-do-not-change-list). The new code slots into the existing
OllamaAgent without replacing or restructuring it.

---

## 2. File Manifest

### New Files to CREATE

| File | Lines (approx) | Purpose |
|------|----------------|---------|
| `src/ollama/utils/promptLoader.ts` | ~120 | Load prompt files via Electron IPC with caching |
| `src/ollama/utils/addendaPolicy.ts` | ~80 | Deterministic addenda selection per-message |
| `src/ollama/utils/PromptBuilder.ts` | ~200 | Assemble system prompt with token budgeting |

### Existing Files to MODIFY

| File | What Changes |
|------|-------------|
| `src/ollama/OllamaAgent.ts` | Constructor, `getDefaultSystemPrompt()` → `buildSystemPrompt()`, new `updateAddendaIfNeeded()`, adjust `exitWizardMode()` and `clearHistory()` |
| `package.json` | Add `prompts/**` to `build.extraResources` |

### Prompt Content Files to WRITE (fill existing empty placeholders)

| File | Tokens (approx) |
|------|-----------------|
| `prompts/core_system.txt` | ~400 |
| `prompts/schema_truth.txt` | ~300 |
| `prompts/addenda/tab_help_dice_system.txt` | ~250 |
| `prompts/addenda/tab_help_attributes.txt` | ~300 |
| `prompts/addenda/tab_help_skills.txt` | ~300 |
| `prompts/addenda/tab_help_stats.txt` | ~350 |
| `prompts/addenda/tab_help_perks.txt` | ~500 |
| `prompts/addenda/tab_help_abilities.txt` | ~600 |
| `prompts/addenda/tab_help_statuses.txt` | ~300 |
| `prompts/addenda/tab_help_runes.txt` | ~400 |
| `prompts/addenda/tab_help_mutators.txt` | ~400 |

---

## 3. Spec: promptLoader.ts

**Create**: `src/ollama/utils/promptLoader.ts`

This module loads prompt text files from the `prompts/` directory. It uses the same
Electron IPC pattern as `contextLoader.ts` (line 34-48) and `documentationLoader.ts` (line 39-56).

### Reference Pattern (from contextLoader.ts)

```typescript
// This is the existing pattern. Use the same approach.
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
```

### Exports

```typescript
/**
 * Cached prompt file loader.
 * Uses Electron IPC readAppResourceFile for both dev and prod.
 * Falls back to fetch() for Vite dev server (no Electron).
 */
export class PromptLoader {
  private cache: Map<string, string> = new Map();

  /**
   * Load prompts/core_system.txt
   * Returns empty string on failure (never throws).
   */
  async loadCore(): Promise<string>;

  /**
   * Load prompts/schema_truth.txt
   * Returns empty string on failure (never throws).
   */
  async loadSchemaTruth(): Promise<string>;

  /**
   * Load a specific addendum file.
   * @param tabName - e.g., 'abilities', 'perks', 'stats'
   * Resolves to: prompts/addenda/tab_help_{tabName}.txt
   * Returns null if file not found or empty.
   */
  async loadAddendum(tabName: string): Promise<string | null>;

  /**
   * Clear the cache (for testing or hot-reload).
   */
  clearCache(): void;
}
```

### Implementation Notes

- `getElectron()` — copy the helper from contextLoader.ts (or import if you extract it to a shared module, but copying is fine for 6 lines)
- For each load method: check `this.cache` first. If miss, try `el.fs.readAppResourceFile(path)`. If Electron unavailable, try `fetch('/' + path)` and read as text (Vite dev server serves from project root). Cache the result. On any error, log a warning and return empty string / null.
- The `tabName` parameter is lowercase (e.g., `'abilities'`, `'perks'`). Map to filename: `prompts/addenda/tab_help_${tabName}.txt`.
- DO NOT use Node.js `fs` module. This runs in the renderer process.

---

## 4. Spec: addendaPolicy.ts

**Create**: `src/ollama/utils/addendaPolicy.ts`

Deterministic selection of which addenda to inject. No LLM calls. Runs on every user message.

### Types

```typescript
/** Tab names that have addenda files. Lowercase, matches filename suffix. */
export type AddendaTab =
  | 'dice_system'
  | 'attributes'
  | 'skills'
  | 'stats'
  | 'perks'
  | 'abilities'
  | 'statuses'
  | 'runes'
  | 'mutators';
```

### Exports

```typescript
/**
 * Map editor activeCategory (from useEditorState) to AddendaTab.
 * The editor uses capitalized names: 'Attributes', 'Perks', 'Abilities', etc.
 * Returns undefined if no mapping exists.
 */
export function categoryToTab(activeCategory: string): AddendaTab | undefined;

/**
 * Infer which tab the user is asking about from their message text.
 * Returns undefined if no clear topic detected.
 * Uses keyword matching — keep patterns simple and fast.
 */
export function inferTabFromMessage(message: string): AddendaTab | undefined;

/**
 * Determine if the user's message warrants loading tab help addenda.
 * True when:
 *   - Message contains explain-type signals (what, how, explain, help, etc.)
 *   - User is in a complex tab AND appears to be editing/creating
 */
export function isHelpQuery(message: string): boolean;

/**
 * Select which addenda to load for this message.
 * @param activeCategory - from editorState.activeCategory (e.g., 'Attributes')
 * @param userMessage - the user's message text
 * @returns array of 0-2 AddendaTab names to load
 *
 * Rules:
 * 1. If isHelpQuery(message), include tab from activeCategory (if mapped)
 * 2. If inferTabFromMessage finds a different tab, include that too
 * 3. For complex tabs (abilities, runes, mutators, perks), include their
 *    addendum even for non-help queries if the user is on that tab
 * 4. Cap at 2 addenda max
 * 5. Deduplicate
 */
export function selectAddenda(
  activeCategory: string | undefined,
  userMessage: string
): AddendaTab[];
```

### Implementation Notes

**categoryToTab mapping:**
```
'Dice System' → 'dice_system'
'Attributes'  → 'attributes'
'Skills'      → 'skills'
'Stats'       → 'stats'
'Perks'       → 'perks'
'Abilities'   → 'abilities'
'Statuses'    → 'statuses'
'Runes'       → 'runes'
'Mutators'    → 'mutators'
```

**inferTabFromMessage keyword patterns** (case-insensitive):
```
dice|point budget|allocation       → 'dice_system'
attribute|separator                → 'attributes'
skill|proficiency|bonus source     → 'skills'
stat|formula|derived               → 'stats'
perk|feat|perk action|perkaction   → 'perks'
abilit|spell|spelldef|spelleffect  → 'abilities'
status|condition|statusaction      → 'statuses'
rune|equipment|runeaction          → 'runes'
mutator|conditional|mutatorcond    → 'mutators'
```

**isHelpQuery signals** (case-insensitive word boundaries):
```
what does|what is|what are|how does|how do|how to|explain|help|
meaning|difference|when should|why|define|tell me about|guide|describe
```

**Complex tabs** (always load addendum when user is on these):
```
'abilities', 'runes', 'mutators', 'perks'
```

---

## 5. Spec: PromptBuilder.ts

**Create**: `src/ollama/utils/PromptBuilder.ts`

Assembles the system prompt from parts with token budgeting.

### Types

```typescript
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
```

### Exports

```typescript
import { PromptLoader } from './promptLoader';

/**
 * Estimate token count using chars/4 approximation.
 * This is for preflight budgeting only — actual token counts
 * come from Ollama response (prompt_eval_count).
 */
export function estimateTokens(text: string): number;

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
): string;

export class PromptBuilder {
  constructor(private loader: PromptLoader);

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
  async buildSystemPrompt(options: PromptBuildOptions): Promise<string>;
}
```

### Implementation Notes

**buildSelectedRecordContext details:**

The `activeCategory` maps to a primary table:
```
'Attributes' → 'SkillDef' (filter TypeFlag === 't')
'Skills'     → 'SkillDef' (filter TypeFlag === 'f')
'Stats'      → 'Stat'
'Perks'      → 'PerkDef'
'Abilities'  → 'SpellDef'
'Statuses'   → 'StatusDef'
'Runes'      → 'RuneDef'
'Mutators'   → 'MutatorDef'
```

To get the selected record's ID:
```typescript
const id = selectedRecord['ID'] ?? selectedRecord['Node ID'];
```

To find child rows, filter the child table array where the FK column matches the parent ID:
```typescript
// Example for Abilities:
const effects = (data['SpellEffect'] || []).filter(
  (row: any) => String(row['SpellID']) === String(id)
);
```

For the record itself, list all columns that have non-empty values:
```typescript
Object.entries(selectedRecord)
  .filter(([k, v]) => !k.startsWith('__') && v !== '' && v !== undefined && v !== null)
  .map(([k, v]) => `${k}: ${v}`)
  .join(' | ')
```

**estimateTokens**: `Math.ceil(text.length / 4)`

**Budget logic in buildSystemPrompt:**
```
remaining = maxSystemTokens
add core (always)         → remaining -= estimateTokens(core)
add schema (always)       → remaining -= estimateTokens(schema)
add editorSummary         → if fits in remaining, add it
add selectedRecordContext → if fits in remaining, add it
for each addendum         → if fits in remaining, add it (max 2)
```

---

## 6. Spec: OllamaAgent.ts Integration

**Modify**: `src/ollama/OllamaAgent.ts`

### 6.1 New Imports (add at top, after line 11)

```typescript
import { PromptLoader } from './utils/promptLoader';
import { PromptBuilder, buildSelectedRecordContext } from './utils/PromptBuilder';
import { selectAddenda, type AddendaTab } from './utils/addendaPolicy';
```

### 6.2 New Instance Fields (add after line 57)

```typescript
private promptLoader: PromptLoader = new PromptLoader();
private promptBuilder: PromptBuilder = new PromptBuilder(this.promptLoader);
private currentAddenda: AddendaTab[] = [];
```

### 6.3 Replace getDefaultSystemPrompt() (lines 918-970)

Delete the entire method body but keep a synchronous fallback for pre-bootstrap use.
Replace with two methods:

```typescript
/**
 * Minimal synchronous fallback — used in constructor before async bootstrap runs.
 * Contains only identity + safety rule. Full prompt is built in buildSystemPrompt().
 */
private getMinimalSystemPrompt(): string {
  return `⚠️ CRITICAL IMMUTABLE RULE ⚠️
ABSOLUTELY NO depictions, descriptions, implications, or suggestions of minors (children, teenagers, underage individuals) in ANY explicit, sexual, or adult-oriented context. This is NON-NEGOTIABLE.

You are **Sigil**, the creative RPR design advisor for Project Omen — a Conan Exiles roleplay system editor.
Full context is loading...`;
}

/**
 * Build the full system prompt from files + live context.
 * Async — called during bootstrap and when addenda change.
 */
private async buildSystemPrompt(editorSummary?: string): Promise<string> {
  const effectiveCtx = this.getEffectiveContextSize();
  const maxSystemTokens = Math.floor(effectiveCtx * 0.4);

  const selectedRecord = this.context.editorState?.selected ?? null;
  const activeCategory = this.context.editorState?.activeCategory ?? '';
  const data = this.context.editorState?.data;

  let selectedRecordContext = '';
  if (selectedRecord && data) {
    selectedRecordContext = buildSelectedRecordContext(data, activeCategory, selectedRecord);
  }

  return this.promptBuilder.buildSystemPrompt({
    maxSystemTokens,
    editorSummary,
    addenda: this.currentAddenda,
    selectedRecordContext,
  });
}
```

### 6.4 Constructor Change (line 70-72)

**BEFORE:**
```typescript
this.systemPrompt = this.wizardMode
  ? SYSTEM_WIZARD_PROMPT
  : (options.systemPrompt || this.getDefaultSystemPrompt());
```

**AFTER:**
```typescript
this.systemPrompt = this.wizardMode
  ? SYSTEM_WIZARD_PROMPT
  : (options.systemPrompt || this.getMinimalSystemPrompt());
```

### 6.5 bootstrap() — No structural changes (lines 114-151)

The existing `bootstrap()` method stays as-is. The only difference is that
`loadFullContext()` (called at line 150) will now also rebuild the system prompt.

### 6.6 loadFullContext() — Add prompt rebuild (modify lines 157-254)

After step 1 (loading RPR context, line 176), add prompt rebuild logic.
Insert AFTER line 176 (after `console.log('[Sigil] ✅ RPR context loaded from editor data');`),
BEFORE the `} catch` on line 177:

```typescript
        // Rebuild system prompt from files + editor summary
        const editorSummary = generateContextSummary(rprContext);
        this.currentAddenda = selectAddenda(
          this.context.editorState?.activeCategory,
          '' // No user message at bootstrap time
        );
        const builtPrompt = await this.buildSystemPrompt(editorSummary);
        this.systemPrompt = builtPrompt;
        this.conversationHistory[0] = {
          role: 'system',
          content: builtPrompt,
        };
```

**IMPORTANT**: The rest of `loadFullContext()` (steps 2-5: doc index, baseline, memory,
refinements) is UNCHANGED. These still get concatenated and injected at index 1.

### 6.7 New Method: updateAddendaIfNeeded() (add after upgradeBootstrapIfNeeded, ~line 270)

```typescript
/**
 * Re-evaluate addenda selection on each message. If the needed addenda
 * have changed (user switched tabs or topics), rebuild the system prompt.
 * This is lightweight — only rebuilds if the addenda set actually changed.
 */
private async updateAddendaIfNeeded(userMessage: string): Promise<void> {
  if (!this.fullContextLoaded) return; // Not bootstrapped yet, nothing to update
  if (this.wizardMode) return; // Wizard mode uses its own prompt

  const newAddenda = selectAddenda(
    this.context.editorState?.activeCategory,
    userMessage
  );

  // Check if addenda changed
  const changed = newAddenda.length !== this.currentAddenda.length ||
    newAddenda.some((tab, i) => tab !== this.currentAddenda[i]);

  // Also check if selected record changed (user clicked a different record)
  const currentSelectedId = this.context.editorState?.selected?.['ID'] ??
    this.context.editorState?.selected?.['Node ID'];
  const needsRecordUpdate = currentSelectedId !== undefined; // Always include if available

  if (!changed && !needsRecordUpdate) return;

  this.currentAddenda = newAddenda;

  // Rebuild system prompt with new addenda + current selected record
  const editorData = this.context.editorState?.data;
  let editorSummary = '';
  if (editorData) {
    const rprContext = await loadRPRContext(editorData);
    if (rprContext) {
      editorSummary = generateContextSummary(rprContext);
    }
  }

  const builtPrompt = await this.buildSystemPrompt(editorSummary);
  this.systemPrompt = builtPrompt;
  this.conversationHistory[0] = {
    role: 'system',
    content: builtPrompt,
  };

  if (changed) {
    console.log(`[Sigil] Addenda updated: [${newAddenda.join(', ')}]`);
  }
}
```

### 6.8 Wire updateAddendaIfNeeded into sendMessage and sendMessageStreaming

**In `sendMessage()`** — add AFTER line 335 (`await this.upgradeBootstrapIfNeeded(userMessage);`):

```typescript
    await this.updateAddendaIfNeeded(userMessage);
```

**In `sendMessageStreaming()`** — add AFTER line 475 (`await this.upgradeBootstrapIfNeeded(userMessage);`):

```typescript
    await this.updateAddendaIfNeeded(userMessage);
```

### 6.9 Update exitWizardMode() (lines 869-879)

**BEFORE (line 873):**
```typescript
this.systemPrompt = this.getDefaultSystemPrompt();
```

**AFTER:**
```typescript
this.systemPrompt = this.getMinimalSystemPrompt();
// Full prompt will be rebuilt on next message via updateAddendaIfNeeded
this.fullContextLoaded = false; // Force re-bootstrap to load full context
this.contextLoaded = false;
```

### 6.10 Update clearHistory() (lines 885-894)

**BEFORE (line 886):**
```typescript
const newSystemPrompt = this.wizardMode ? SYSTEM_WIZARD_PROMPT : this.getDefaultSystemPrompt();
```

**AFTER:**
```typescript
const newSystemPrompt = this.wizardMode ? SYSTEM_WIZARD_PROMPT : this.getMinimalSystemPrompt();
```

Also add after line 893 (after the history reset):
```typescript
    this.contextLoaded = false;
    this.fullContextLoaded = false;
    this.currentAddenda = [];
```

---

## 7. Spec: Prompt Content Files

### 7.1 `prompts/core_system.txt`

Write exactly this content (adjust tone if needed, but keep the structure):

```
⚠️ CRITICAL IMMUTABLE RULE ⚠️
ABSOLUTELY NO depictions, descriptions, implications, or suggestions of minors (children, teenagers, underage individuals) in ANY explicit, sexual, or adult-oriented context. This is NON-NEGOTIABLE. Violation will immediately stop the application. Age-appropriate content about young characters is fine (e.g., "teenage squire training"), but NEVER in explicit contexts.

---

You are **Sigil**, the creative RPR design advisor for Project Omen — a Conan Exiles roleplay system editor.

**Personality:** You're warm, creative, and conversational. Respond naturally to greetings, small talk, and casual questions. When someone says "hi," say hi back. When they want to chat about game design ideas, brainstorm with them. You're a collaborator, a dungeon master, a worldbuilder.

IMPLEMENTATION-FIRST RULE:
- If the user asks how to BUILD/IMPLEMENT something (engine, combat loop, action economy, effect/status pipeline, data model, first steps), answer with concrete mechanics and structure first.
- Do NOT redirect into theme/tone/setting unless the user explicitly asks about theme.
- Avoid giant blobs: prefer short sections and a single worked example; ask at most ONE clarifying question.

Your Tier A baseline contract is loaded separately. It covers formatting rules, RPR invariants, and memory discipline. Follow it strictly.

ANTI-HALLUCINATION:
- Only reference tables, columns, and enum values listed in SCHEMA TRUTH below.
- If a user references a field not in SCHEMA TRUTH, state it is not present in the schema.
- Do not invent column names, enum values, or table relationships.

**What you CAN do:**
- Explain RPR concepts — what tables to use, which columns matter, how formulas work
- Brainstorm designs — help plan stat systems, ability sets, perk trees, combat mechanics
- Write descriptions & flavor text — ability names, perk descriptions, lore, character concepts
- Guide through the editor — tell users which tab to use, what fields to fill in, step-by-step
- Answer questions — about the loaded system, design patterns, balance considerations

**What you CANNOT do:**
You cannot directly modify the editor data. When users ask you to "create" or "build" something, guide them on how to do it in the editor UI. Describe what they need to create, which values to set, and in which order. You're the knowledgeable advisor; they drive the editor.

**Capabilities:**
- Knowledge: Deep understanding of RPR table structure, formulas, and design patterns
- Creative: Design thematic abilities, worldbuilding, roleplay concepts, flavor text
- Mature content: Adult themes (violence, sexuality, dark content) are acceptable — 18+ creative space
- Context: You can see the current system's data summary and the record the user is editing

Be creative, be helpful, be knowledgeable. You're Sigil — here to enable storytelling.
```

### 7.2 `prompts/schema_truth.txt`

Write exactly this content:

```
# SCHEMA TRUTH

## Core Tables

**SkillDef** — Skills and attributes
Columns: TypeFlag(t=attr/f=skill), Node ID, Name, Description, Trained, Max Allocation, Bonus Source, Natural Bonus, Public, Bonus Function(0=Sum/1=Avg/2=Min/3=Max)

**PerkDef** — Perks (passive/active bonuses)
Columns: ID, Public, Name, Description, Cost, Category

**PerkAction** — Child of PerkDef (FK: PerkID)
Columns: PerkID, Function(0-18), TargetType, TargetID, Modifier, Extra, Value
Functions: 0=Allow Skill, 1=Deny Skill, 2=Allow Perk, 3=Deny Perk, 4=Dice Modifier, 5=Give Feat, 6=Grant Stat, 7=Stat Modifier, 8=Grant Ability, 9=Grant Status, 10=Unlock Status, 11=Grant Perk, 12=Grant Sudo Role, 13=Allow Perk Category, 14=Deny Perk Category, 15=Teach Language, 16=Give CharTag, 17=Set Float CharVar, 18=Set String CharVar

**Stat** — Numeric values
Columns: ID, Name, Base, Formula, Bonus, Public, Show, Active, Description, Scale, Trainable, Display, CategoryID, BonusFunction(0-3)

**SpellDef** — Abilities
Columns: ID, Name, Description, Range, TargetType(0=Selected/1=Caster/2=All/3=All Others/4=Selected Others), #Targets, CasterRollType(0=Skill/1=Stat/2=Custom), RollStatSkillID, CasterRollFormula, DCType(0=Target Roll/1=Target Stat/2=Fixed/3=Target Roll Stat/4=Custom), FixedDCValue, ReqMode, AllowMods, Common, Log, Cooldown, Icon, AllowComment, Critical, IconColor, Category, IncludeAll, ExcludeAll, ChatRadius, DCTypeFormula, TargetDCFormula

**SpellEffect** — Child of SpellDef (FK: SpellID)
Columns: SpellID, Targets, Effect(0-12), Formula/Text, TargetID, If, Broadcast, Outcome, Duration, Category, Delay, Reserved
Functions: 0=Print Message, 1=Modify Stat, 2=Give Item, 3=Remove Item, 4=Buff Skill, 5=Buff Stat, 6=Buff Perk, 7=Dispel Buff, 8=Buff Ability, 9=Auto Use Ability, 10=Set Stat, 11=Buff Grant Status, 12=Buff Unlock Status

**SpellReqDef** — Requirements for SpellDef (FK: SpellID)
Columns: SpellID, Function(0-6), Operator, Param, ValueMin, ValueMax, Text

**SpellTargetCond** — Target conditions for SpellDef (FK: SpellID) [1-INDEXED]
Columns: SpellID, Mode, Function, Operator, Param, ValueMin, ValueMax, Text

**StatusDef** — Persistent conditions
Columns: ID, Name, Color(RGBA floats), Public

**StatusAction** — Child of StatusDef (FK: StatusID)
Columns: StatusAction, StatusID, TargetID, Value, Function(col 4! 0=Modify Skill, 1=Modify Stat, 2=Grant Perk, 3=Grant Ability, 4=Grant Status)

**RuneDef** — Equipment items
Columns: NodeID, ItemID, Broadcast, Slot, Description, IncludeAll, ExcludeAll, AutoEquipAdd, AutoEquipEquip

**RuneAction** — Child of Rune (FK: RuneID)
Columns: RuneID, TargetID, Value, Effect(0=Dice Mod/1=Grant Perk/3=Stat Mod/4=Grant Ability/5=Grant Status/6=Unlock Status), Reserved

**RuneCondition** — Child of RuneDef (FK: RuneID) [1-INDEXED, NOT ENFORCED]
Columns: RuneID, Inclusion, Condition, Operator, NodeAffected, Value, MaxValue, Category

**MutatorDef** — Conditional modifiers
Columns: ID, Name, AllIncludesMustMatch, AllExcludesMustMatch

**MutatorAction** — Child of MutatorDef (FK: MutatorID)
Columns: MutatorID, Function(0-5), TargetID, Value

**MutatorCondition** — Child of MutatorDef (FK: MutatorID) [0-INDEXED]
Columns: MutatorID, Inclusion, Condition(0=Perk/1=Buff Category/2=Skill Alloc/3=Level/20=Status/21=Perk Category), Operator, NodeAffected, Value, MaxValue, Category

**DiceConfig** — Core dice settings
Key fields: AttributePoints, SkillPoints, PerkPoints, TotalNodes

## Formulas
Variables: {c.StatName} (caster), {t.StatName} (target), {s.StatName} (source)
Functions: f.clamp[val,min,max], f.max[a,b], f.min[a,b], f.ceil[val], f.floor[val]
Dice: 2d6+5, 2d20kh1 (advantage), 1d20+{c.Dexterity}
Bonus Source format: NodeID*Multiplier;NodeID*Multiplier (e.g., 2*1.0;1*0.5)

## Operators
0==, 1!=, 2>, 3>=, 4<, 5<=, 6=Between, 7=Outside

## Critical Invariants
- PerkAction: 19 functions (0-18). SpellEffect: 13 functions (0-12).
- RuneCondition: 1-indexed. SpellTargetCond: 1-indexed. MutatorCondition: 0-indexed.
- StatusAction Function is in COLUMN 4, not column 2.
- RuneConditions exist in schema but are NOT enforced by the live RPR engine.
- DiceConfig.TotalNodes must equal the highest Node ID in SkillDef.
```

### 7.3 Addenda Files

Each addendum provides detailed guidance for one editor tab. Keep them focused —
columns, enum values, gotchas, and common patterns. No personality or general RPR overview
(that's in core_system.txt).

**Source material**: Use the tables in `RPR_TABLES.md` (memory file read above) and the
column/function details already captured in `schema_truth.txt` as the authoritative reference.
Expand with practical guidance: "when to use", "common patterns", "gotchas".

Below are content outlines. Write the actual files with this structure but flesh them out
with practical guidance paragraphs.

#### `prompts/addenda/tab_help_dice_system.txt`

```
# Dice System Tab Help

The DiceConfig table controls point budgets and system-wide dice settings.

Key fields:
- AttributePoints: Total points players can spend on attributes
- SkillPoints: Total points for skills
- PerkPoints: Total points for perks
- TotalNodes: MUST equal the highest Node ID in SkillDef

Design patterns:
- Typical ratios: 2-4x more skill points than attribute points
- TotalNodes is a system invariant — update it when adding/removing skills
- Point budgets define character breadth vs depth

Gotchas:
- If TotalNodes doesn't match SkillDef, the dice system breaks silently
- Setting points to 0 doesn't disable that allocation type — it gives 0 points
```

#### `prompts/addenda/tab_help_attributes.txt`

```
# Attributes Tab Help

Attributes are SkillDef rows with TypeFlag="t". They act as separators/headers
that regular skills (TypeFlag="f") nest under.

Key fields:
- TypeFlag: Must be "t" for attributes
- Node ID: Unique, sequential. Referenced by skills via Bonus Source
- Max Allocation: How many points can be spent (-1 = unlimited)
- Bonus Source: For attributes, usually empty or self-referential
- Bonus Function: 0=Sum (most common), 1=Average, 2=Min, 3=Max

Design patterns:
- Typical setup: 4-8 attributes (Strength, Dexterity, Intelligence, etc.)
- Skills reference attributes via Bonus Source: "NodeID*Multiplier"
- Attributes with Max Allocation=-1 have no spending cap

Gotchas:
- Separator skills MUST have correct Bonus Source or skills won't collapse under them in the UI
- Node IDs must be sequential and match TotalNodes in DiceConfig
- Changing an attribute's Node ID breaks all Bonus Source references in skills and Stat formulas
```

#### `prompts/addenda/tab_help_skills.txt`

```
# Skills Tab Help

Skills are SkillDef rows with TypeFlag="f". They nest under attributes.

Key fields:
- TypeFlag: Must be "f" for skills
- Bonus Source: Links to parent attribute(s). Format: "NodeID*Multiplier;NodeID*Multiplier"
  Example: "1*1.0;2*0.5" means 100% of attribute 1 + 50% of attribute 2
- Trained: "t" if skill requires training to use
- Max Allocation: Maximum skill points (-1 = unlimited)
- Natural Bonus: Base bonus added before allocation
- Bonus Function: How multiple bonus sources combine (0=Sum, 1=Average)

Design patterns:
- Skills typically reference 1-2 attributes via Bonus Source
- Multipliers control how much the parent attribute contributes
- Trained skills can be gated behind perks (PerkAction function 0 = Allow Skill)

Gotchas:
- If Bonus Source references a Node ID that doesn't exist, the skill silently gets 0 bonus
- Skills without Bonus Source won't appear nested under any attribute in the UI
- The Bonus Source Node IDs reference SkillDef Node IDs (attributes), NOT Stat IDs
```

#### `prompts/addenda/tab_help_stats.txt`

```
# Stats Tab Help

Stats are numeric values (Health, Mana, Strength score, Initiative, etc.).

Key fields:
- Formula: Derives stat value from skills. Format: "NodeID*Mult;NodeID*Mult"
  These reference SkillDef Node IDs, NOT other Stat IDs
- Base: Starting value before formula
- Bonus: Minimum value floor
- Scale: Final multiplier applied after formula
- Active: "t" if stat is active/visible
- BonusFunction: How formula sources combine (0=Sum, 1=Average, 2=Min, 3=Max)

Formulas:
- Stats can use {c.StatName} syntax in ability formulas
- Formula field uses Bonus Source format (NodeID*Multiplier), NOT {c.StatName}
- {c.StatName} is for SpellDef/SpellEffect formulas, not Stat.Formula

Design patterns:
- Derived stats: Health = Base + STR*2 (Formula: "1*2.0" where Node ID 1 is STR attribute)
- Resource pools: Set Base for starting amount, Scale for level multiplier
- Hidden stats: Set Public="f", Show="f" for internal tracking values

Gotchas:
- Stat.Formula references SkillDef Node IDs, not Stat IDs
- Don't confuse Stat.Formula (Bonus Source format) with {c.StatName} (ability formula syntax)
```

#### `prompts/addenda/tab_help_perks.txt`

```
# Perks Tab Help

Perks are passive or active bonuses with 19 PerkAction function types.

## PerkDef fields:
- Cost: Perk point cost (from DiceConfig.PerkPoints budget)
- Category: Groups perks in the UI. Used by PerkAction functions 13/14 (Allow/Deny Category)

## PerkAction functions (all 19):
| Fn | Name | TargetID references | Notes |
|----|------|---------------------|-------|
| 0 | Allow Skill | SkillDef | Unlocks a trained skill |
| 1 | Deny Skill | SkillDef | Locks a skill |
| 2 | Allow Perk | PerkDef | Makes perk available |
| 3 | Deny Perk | PerkDef | Hides/locks a perk |
| 4 | Dice Modifier | SkillDef | Adds Value to dice roll |
| 5 | Give Feat | (game ID) | Grants in-game feat |
| 6 | Grant Stat | Stat | Reveals stat on character sheet |
| 7 | Stat Modifier | Stat | Adds Value to stat |
| 8 | Grant Ability | SpellDef | Gives access to ability |
| 9 | Grant Status | StatusDef | Applies status effect |
| 10 | Unlock Status | StatusDef | Makes status available |
| 11 | Grant Perk | PerkDef | Force-gives another perk |
| 12 | Grant Sudo Role | (external) | Server admin role |
| 13 | Allow Perk Category | (uses Modifier col) | Unlocks entire category |
| 14 | Deny Perk Category | (uses Modifier col) | Locks entire category |
| 15 | Teach Language | (external) | Language system |
| 16 | Give CharTag | (external) | Character tag |
| 17 | Set Float CharVar | (external) | Float variable |
| 18 | Set String CharVar | (external) | String variable |

Design patterns:
- Race/Class perks: Use function 6 (Grant Stat) + 8 (Grant Ability) to define racial packages
- Prerequisite chains: Use function 2 (Allow Perk) to gate advanced perks behind basic ones
- Skill trees: Use function 0 (Allow Skill) to unlock skill progression

Gotchas:
- Functions 13/14 use the Modifier column for the category name, NOT TargetID
- Functions 5, 12, 15-18 reference external game systems, not RPR table IDs
```

#### `prompts/addenda/tab_help_abilities.txt`

```
# Abilities Tab Help

Abilities (SpellDef) are rollable actions with effects, requirements, and targeting.

## SpellDef key fields:
- TargetType: 0=Selected target, 1=Caster only, 2=All, 3=All Others, 4=Selected Others
- CasterRollType: 0=Roll Skill, 1=Roll Stat, 2=Custom Formula
- RollStatSkillID: Which skill/stat to roll (depends on CasterRollType)
- CasterRollFormula: Custom formula when CasterRollType=2
- DCType: 0=Target Roll, 1=Target Stat, 2=Fixed, 3=Target Roll Stat, 4=Custom
- AllowMods: "t" if modifiers (runes, mutators) apply to this ability
- Category: Groups abilities in UI

## SpellEffect functions (all 13):
| Fn | Name | TargetID → | Key fields |
|----|------|-----------|------------|
| 0 | Print Message | (none) | Formula/Text = message |
| 1 | Modify Stat | Stat | Formula/Text = amount formula |
| 2 | Give Item | (game ID) | Value = item count |
| 3 | Remove Item | (game ID) | Value = item count |
| 4 | Buff Skill | SkillDef | Duration, Formula/Text = amount |
| 5 | Buff Stat | Stat | Duration, Formula/Text = amount |
| 6 | Buff Perk | PerkDef | Duration |
| 7 | Dispel Buff | (none) | Category = buff category to dispel |
| 8 | Buff Ability | SpellDef | Duration |
| 9 | Auto Use Ability | SpellDef | Chains into another ability |
| 10 | Set Stat | Stat | Sets (not modifies) stat value |
| 11 | Buff Grant Status | StatusDef | Duration |
| 12 | Buff Unlock Status | StatusDef | Duration |

## SpellReqDef — Requirements:
Functions: 0=Stat check, 1=Skill check, 2=Skill Allocation check, 3=Perk check, 4=Conan Level, 5=Status Category, 6=Conan Item
Column 7 (Text) MUST exist even when blank.

## SpellTargetCond — Target conditions:
Same conditions as RuneCondition. **1-INDEXED** (no Perk at index 0).
Column 8 (Text) MUST exist even when blank.

Design patterns:
- Attack ability: CasterRollType=0 (Roll Skill), DCType=0 (Target Roll), SpellEffect function 1 (Modify Stat on Health)
- Buff ability: TargetType=1 (Caster), SpellEffect function 5 (Buff Stat) with Duration
- Healing: SpellEffect function 1 (Modify Stat) with positive formula on Health stat
- Chain abilities: SpellEffect function 9 (Auto Use Ability) triggers another SpellDef

Gotchas:
- SpellTargetCond is 1-indexed (shifted from MutatorCondition which is 0-indexed)
- If vs Outcome in SpellEffect: If = condition for applying, Outcome = which roll result triggers it
- Formula variables: {c.StatName} = caster, {t.StatName} = target
```

#### `prompts/addenda/tab_help_statuses.txt`

```
# Statuses Tab Help

Statuses (StatusDef) are persistent conditions applied to characters.

## StatusDef fields:
- Color: RGBA floats, e.g., "1.0,0.0,0.0,1.0" (red, fully opaque)
- Public: "t" if visible to other players

## StatusAction — what the status does:
Columns: StatusAction, StatusID, TargetID, Value, Function

**GOTCHA: Function is in column 4 (the last column), NOT column 2.**

| Fn | Name | TargetID → |
|----|------|-----------|
| 0 | Modify Skill | SkillDef |
| 1 | Modify Stat | Stat |
| 2 | Grant Perk | PerkDef |
| 3 | Grant Ability | SpellDef |
| 4 | Grant Status | StatusDef |

Design patterns:
- Poison: StatusAction function 1 (Modify Stat) on Health, negative Value
- Buff: StatusAction function 0 (Modify Skill) with positive Value
- Transformation: StatusAction function 2 (Grant Perk) to change available abilities
- Status chains: StatusAction function 4 (Grant Status) for cascading effects

Gotchas:
- StatusAction column order is different from A_AllTables documentation
- Actual order: StatusAction|StatusID|TargetID|Value|Function
- Statuses are toggled on/off, they don't have duration (use SpellEffect buffs for timed effects)
```

#### `prompts/addenda/tab_help_runes.txt`

```
# Runes Tab Help

Runes (RuneDef) represent equipment items that modify character stats.

## RuneDef fields:
- NodeID: Unique identifier
- ItemID: Game item ID (external, not RPR ID)
- Slot: Equipment slot
- IncludeAll/ExcludeAll: Tag-based filtering

## RuneAction — effects when equipped:
Columns: RuneID, TargetID, Value, Effect, Reserved(0)

Note: RuneAction's parent is "Rune" (not RuneDef!)

| Effect | Name | TargetID → |
|--------|------|-----------|
| 0 | Dice Modifier | SkillDef |
| 1 | Grant Perk | PerkDef |
| 3 | Stat Modifier | Stat |
| 4 | Grant Ability | SpellDef |
| 5 | Grant Status | StatusDef |
| 6 | Unlock Status | StatusDef |

Note: Effect 2 is missing (skipped in the enum).

## RuneCondition — equip requirements:
Columns: RuneID, Inclusion, Condition, Operator, NodeAffected, Value, MaxValue, Category

**1-INDEXED** — same conditions as MutatorCondition but shifted +1 (no Perk at index 0).

Design patterns:
- Weapon: RuneAction effect 0 (Dice Modifier) on combat skill
- Magical item: RuneAction effect 4 (Grant Ability) to give special attacks
- Armor: RuneAction effect 3 (Stat Modifier) on Defense stat

Gotchas:
- RuneConditions are documented but NOT ENFORCED by the live RPR engine
- RuneAction parent FK is "Rune" table, not "RuneDef" table
- Effect enum skips 2 (goes 0, 1, 3, 4, 5, 6)
```

#### `prompts/addenda/tab_help_mutators.txt`

```
# Mutators Tab Help

Mutators (MutatorDef) are conditional modifiers that apply when conditions are met.

## MutatorDef fields:
- AllIncludesMustMatch: "t" = ALL include conditions must be true (AND logic)
- AllExcludesMustMatch: "t" = ALL exclude conditions must be true (AND logic)

## MutatorCondition — when the mutator applies:
Columns: MutatorID, Inclusion, Condition, Operator, NodeAffected, Value, MaxValue, Category

**0-INDEXED** (unlike RuneCondition and SpellTargetCond which are 1-indexed)

| Cond | Name | NodeAffected → |
|------|------|---------------|
| 0 | Perk | PerkDef |
| 1 | Buff Category | (uses Category col) |
| 2 | Skill Allocation | SkillDef |
| 3 | Level | (none) |
| 4-19 | Various game state | (external) |
| 20 | Status | StatusDef |
| 21 | Perk Category | (uses Category col) |

Inclusion: 0 = Include condition, 1 = Exclude condition

## MutatorAction — what it does:
Columns: MutatorID, Function, TargetID, Value

| Fn | Name | TargetID → |
|----|------|-----------|
| 0 | Modify Skill | SkillDef |
| 1 | Modify Stat | Stat |
| 2 | Grant Perk | PerkDef |
| 3 | Grant Ability | SpellDef |
| 4 | Grant Status | StatusDef |
| 5 | Unlock Status | StatusDef |

Design patterns:
- "If has perk X, get +2 to skill Y": Condition 0 (Perk) → Action 0 (Modify Skill)
- "If level > 10, grant ability": Condition 3 (Level) → Action 3 (Grant Ability)
- Mutator-heavy systems (like CXRpR with 2,998 mutators) use them instead of stat formulas

Gotchas:
- 0-indexed conditions (Perk=0), unlike RuneCondition/SpellTargetCond (1-indexed, Perk=1)
- Conditions 4-19 reference game state (time of day, weather, etc.), not RPR tables
- AllIncludesMustMatch/AllExcludesMustMatch control AND vs OR logic for condition groups
```

---

## 8. Spec: Electron Build Config

**Modify**: `package.json`, `build.extraResources` array (line 62-70)

Add the prompts directory so it's accessible in production builds:

**BEFORE:**
```json
"extraResources": [
  {
    "from": "resources/ollama-win/",
    "to": "ollama",
    "filter": ["**/*"]
  }
],
```

**AFTER:**
```json
"extraResources": [
  {
    "from": "resources/ollama-win/",
    "to": "ollama",
    "filter": ["**/*"]
  },
  {
    "from": "prompts/",
    "to": "prompts",
    "filter": ["**/*.txt"]
  }
],
```

This makes `prompts/*.txt` available at `process.resourcesPath/prompts/` in production.
The existing `readAppResourceFile` IPC handler (electron/main.cjs line 432-457) already
checks `path.join(resourcesPath, relativePath)`, so `prompts/core_system.txt` will resolve.

**NOTE**: Also verify that `docs/` is handled the same way. If `docs/` is NOT in
extraResources and still works in production, then the asar fallback (`app.getAppPath()`)
is doing the work, and `prompts/` might also work without this change. But adding it
explicitly is safer.

---

## 9. DO NOT CHANGE List

These features/methods in OllamaAgent.ts MUST remain exactly as they are:

| Lines | Feature | Why |
|-------|---------|-----|
| 98-108 | `prewarmModel()` | Pre-warms GPU, independent of prompts |
| 114-121 | `bootstrap()` lite detection regex | Conversational heuristic works well |
| 126-148 | Lite bootstrap path (memory-only) | Preserves personality for greetings |
| 260-270 | `upgradeBootstrapIfNeeded()` | Lite→full upgrade on RPR topics |
| 276-292 | `isImplementationAsk()` + `insertTempSystemDirective()` | Implementation-mode temp directives |
| 337-354 | Temp directive injection in `sendMessage()` | Forces structured output for impl questions |
| 477-494 | Temp directive injection in `sendMessageStreaming()` | Same for streaming |
| 387-408 | Output gate (RPR dump detection + retry) | Blocks pipe-delimited data in responses |
| 410-414 | Content filter + emergency stop | Safety |
| 542-563 | Streaming output gate | Same gate for streaming path |
| 565-569 | Content filter in streaming | Safety |
| 583-714 | Context budgeting (pruneIfNeeded, generateModelSummary, buildHeuristicSummary) | Conversation length management |
| 716-817 | VRAM-aware context sizing | Consumer GPU optimization |
| 822-832 | `getContextUsage()` | UI progress bar |
| 844-850 | `abort()` | User cancellation |
| 855-857 | `getHistory()` | Conversation export |
| 862-864 | `isWizardMode()` | Wizard mode check |
| 896-911 | `getDocSummary()` | Doc index labels |
| 975-1009 | `saveCurrentConversation()` | Conversation persistence |

Also DO NOT CHANGE:
- `contextLoader.ts` — used as-is, `loadRPRContext()` and `generateContextSummary()` called from OllamaAgent
- `ollamaClient.ts` — HTTP wrapper, not touched
- `outputGate.ts` — output rejection logic
- `contentFilter.ts` — safety
- `systemWizard.ts` — wizard mode prompt
- `conversationManager.ts` — persistence
- `documentationLoader.ts` — doc loading
- `ChatPanel.tsx` — UI integration
- `useChatState.tsx` — chat state management

---

## 10. Verification

### Build Check
```bash
npm run build
```
Must compile without errors. New TypeScript files must have no type errors.

### Manual Test Scenarios

**Test 1: Empty system → Wizard mode**
1. Start with no RPR data loaded
2. Open chat, send a message
3. Verify wizard mode activates (check console: `[Sigil] Starting in Wizard Mode`)
4. Verify prompt files are NOT used (wizard has its own prompt)

**Test 2: Loaded system, conversational greeting**
1. Load WHRpR.txt
2. Send "hi" in chat
3. Verify lite bootstrap (console: `[Sigil] Lite bootstrap`)
4. Verify no addenda loaded (console should NOT show `[Sigil] Addenda updated`)
5. Verify Sigil responds conversationally, not with RPR tables

**Test 3: Loaded system, RPR question**
1. Load WHRpR.txt
2. Send "how do perks work?"
3. Verify full bootstrap (console: `[Sigil] Full bootstrap`)
4. Verify addenda loaded (console: `[Sigil] Addenda updated: [perks]`)
5. Verify response references PerkAction functions accurately

**Test 4: Lite → full upgrade**
1. Load WHRpR.txt
2. Send "hi" (lite bootstrap)
3. Send "tell me about the abilities in this system"
4. Verify upgrade (console: `[Sigil] Upgrading from lite → full bootstrap`)
5. Verify addenda updated to include abilities

**Test 5: Selected record context**
1. Load WHRpR.txt
2. Navigate to Abilities tab, select an ability
3. Send "explain this ability"
4. Verify response references the specific ability by name and describes its effects
5. This is the key test — previously the model couldn't see the selected record

**Test 6: Tab switching mid-conversation**
1. Load WHRpR.txt, start on Perks tab
2. Send "what does Allow Skill do?" → should get perk-specific help
3. Switch to Abilities tab
4. Send "how do I add damage effects?" → addenda should swap to abilities
5. Verify console shows addenda change

**Test 7: Implementation-mode directive**
1. Load WHRpR.txt
2. Send "how do I implement a combat loop?"
3. Verify structured output (## Assumptions, ## Core loop, etc.)
4. This tests that temp directive injection still works alongside new prompt assembly

**Test 8: Context budgeting**
1. Have a long conversation (10+ messages)
2. Verify pruning triggers (console: `[Sigil] Context budget: pruned N messages`)
3. Verify conversation continues working after pruning

### Console Log Checkpoints

After implementing, these log lines should appear in a normal flow:

```
[Sigil] Lite bootstrap — conversational first message, skipping heavy context
  OR
[Sigil] Full bootstrap — loading context, training docs, memory...
[Sigil] ✅ RPR context loaded from editor data
[Sigil] Addenda updated: [perks]  (or whichever tab)
[Sigil] Model info: 14.8B, arch_max=32768, effective_ctx=12288, quant=Q4_K_M
[Sigil] Streaming, N messages in history
[Sigil] Stream complete: M chunks, L chars
[Ollama] Stream complete: P/12288 tokens (X%)
```

---

## Summary for Executing Agent

1. Create 3 new TypeScript files (Section 3, 4, 5)
2. Write content to 11 prompt files (Section 7)
3. Modify OllamaAgent.ts at specific line numbers (Section 6)
4. Add `prompts/` to extraResources in package.json (Section 8)
5. Do NOT touch anything in Section 9
6. Verify with the test scenarios in Section 10

The total change is ~400 lines of new code + ~800 lines of prompt content.
OllamaAgent.ts gets ~50 new lines and ~10 modified lines.
