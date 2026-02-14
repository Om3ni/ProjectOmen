# RPR System Complete Reference Guide

This document serves as the authoritative reference for understanding the RPR (Role Play Redux) system, the editor architecture, and how to build features within the engine.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Format](#data-format)
3. [Core Record Types](#core-record-types)
4. [Schema System](#schema-system)
5. [Editor Architecture](#editor-architecture)
6. [Character Sheet System](#character-sheet-system)
7. [Abilities System](#abilities-system)
8. [Combat Simulation (Testing Suite)](#combat-simulation-testing-suite)
9. [Formula & Expression Language](#formula--expression-language)
10. [Building New Features](#building-new-features)

---

## System Overview

### What is RPR?

RPR (Role Play Rules) is a **data-driven tabletop RPG ruleset system** used in the Conan Exiles mod RPR. The system defines:

- Character creation (races, classes, feats, skills)
- Combat mechanics (action economy, dice rolling, contested checks)
- Abilities/spells with requirements, targeting, and effects
- Status effects (buffs/debuffs)
- Equipment (runes) with stat modifications
- Conditional modifiers (mutators based on game state)

### Key Design Principle: Data Agnostic

The editor is **completely server-agnostic**. The same codebase works for different rulesets:

| Aspect | WHRpR (Wildheart) | SHRpR (Other Server) |
|--------|-------------------|----------------------|
| Health Stat ID | 35 | 92 |
| Mana Stat ID | 32 | 93 |
| Attributes | 6 (STR-CHA) | 7 (adds Willpower) |
| Combat Style | D&D 5e-like | Different action economy |

**Never hardcode stat IDs or names.** Always reference data dynamically.

---

## Data Format

### File Structure

RPR data files (`.txt`) use **pipe-delimited** format:

```
RecordType|Field1|Field2|Field3|...
```

Example:
```
SkillDef|t|1|Strength|The measure of physical power|f|0|0|0|t|0
SpellDef|100|Fireball|Launches a ball of fire|5|4|3|1|30||fire|0|...
```

### Data Conventions

| Convention | Format | Example |
|------------|--------|---------|
| Boolean | `t` / `f` | `t` = true |
| Empty string | `\|  \|` (consecutive pipes) | `\|\|` |
| Colors | RGBA floats | `1.0,0.5,0.0,1.0` |
| Line breaks in text | `&brk;` | `Line 1&brk;Line 2` |
| Formulas | Stat references | `{c.StrDamageMod}` |
| Codex links | `[codex:ID]` | `[codex:M20]` |

### Record Type Frequency (WHRpR)

| Type | Count | Purpose |
|------|-------|---------|
| SpellEffect | 3765 | Ability effect definitions |
| PerkAction | 1285 | Perk-triggered actions |
| SpellReqDef | 1042 | Ability requirements |
| SpellDef | 742 | Ability definitions |
| StatusAction | 501 | Status-triggered actions |
| RuneAction | 378 | Equipment actions |
| StatusDef | 226 | Status definitions |
| PerkDef | 216 | Perk definitions |
| Stat | 145 | Stat definitions |
| SkillDef | 59 | Attribute/skill definitions |

---

## Core Record Types

### SkillDef (Attributes & Skills)

Defines both core attributes (STR, DEX, etc.) and derived skills.

```
SkillDef|TypeFlag|ID|Name|Description|flag|NaturalBonus|BonusSource|value|Public|Mode
```

| Field | Type | Description |
|-------|------|-------------|
| TypeFlag | bool_tf | `t` = attribute, `f` = skill |
| ID | int | Unique identifier |
| Name | string | Display name |
| NaturalBonus | int | Base value |
| BonusSource | formula | Stat modifiers (e.g., `2*1.0` = DEX×1) |
| Public | bool_tf | Visible to players |
| Mode | int | 0=normal, 3=take highest of multiple |

**Key IDs (WHRpR):**
- 1-6: STR, DEX, CON, INT, WIS, CHA
- 7-24: Skills (Acrobatics, Athletics, etc.)
- 36-41: Saving throws
- 587-592: Damage modifiers

### Stat

Defines derived stats and resources.

```
Stat|ID|Name|Base|Formula|MinValue|IsResource|flag|Public|Description|Scale|Trainable|Display|Mode
```

| Field | Type | Description |
|-------|------|-------------|
| ID | int | Unique identifier |
| Base | int | Starting value |
| Formula | string | Stat modifier formula (`statID*multiplier;...`) |
| IsResource | bool_tf | Consumable (Health, Mana) vs static |
| Public | bool_tf | Visible on character sheet |
| Trainable | bool_tf | Can player modify directly |
| Display | bool_tf | `t` = secret/internal only |
| Scale | float | Multiplier for final value |

**Key Stats (WHRpR):**
- 35: Health
- 32: Mana
- 29: Armor Class
- 30: Attack Bonus
- 946: Magic Bonus
- 455/453/454: Standard/Bonus/Reaction Actions

### PerkDef & PerkAction

Perks are character building options (races, classes, feats).

**PerkDef:**
```
PerkDef|ID|Public|Name|Description|Cost|Category
```

**PerkAction:**
```
PerkAction|PerkID|Function|Value|TargetID|Modifier|...
```

#### PerkAction Functions

| ID | Function | Parameters | Effect |
|----|----------|------------|--------|
| 0 | Allow Skill | TargetID=SkillDef ID | Grant access to skill |
| 1 | Deny Skill | TargetID=SkillDef ID | Remove skill access |
| 2 | Allow Perk | TargetID=PerkDef ID | Make perk available |
| 3 | Deny Perk | TargetID=PerkDef ID | Block perk selection |
| 4 | Dice Modifier | Value=amount, TargetID=SkillDef ID | +/- to rolls |
| 5 | Give Feat | TargetID=Feat ID | Grant Conan feat |
| 6 | Grant Stat | TargetID=Stat ID | Reveal stat on sheet |
| 7 | Stat Modifier | Value=amount, TargetID=Stat ID | +/- to stat value |
| 8 | Grant Ability | TargetID=SpellDef ID | Give spell/ability |
| 9 | Grant Status | TargetID=StatusDef ID | Apply status effect |
| 10 | Unlock Status | TargetID=StatusDef ID | Make status available |
| 11 | Grant Perk | TargetID=PerkDef ID | Force-give perk |
| 13 | Allow Category | Modifier=category name | Open perk category |
| 14 | Deny Category | Modifier=category name | Close perk category |
| 15 | Teach Language | Modifier=language name | Add language |



### SpellReqDef (Ability Requirements)

```
SpellReqDef|SpellID|Function|Operator|Param|ValueMin|ValueMax|Text
```

#### Requirement Functions

| ID | Function | Parameters |
|----|----------|------------|
| 0 | Stat Check | Param=Stat ID, ValueMin=minimum |
| 1 | Skill Check | Param=SkillDef ID, ValueMin=minimum |
| 2 | Skill Allocation | Param=SkillDef ID, ValueMin=minimum |
| 3 | Perk Ownership | Param=PerkDef ID |
| 4 | Conan Level | ValueMin=level |
| 5 | Status Category | Text=category name |
| 6 | Item ID | Param=Conan item ID |

#### Operators

| ID | Meaning |
|----|---------|
| 0 | Greater than or equal (≥) |
| 1 | Less than (<) |
| 2 | Equal to (=) |
| 3 | Not equal (≠) |



### StatusDef & StatusAction

**StatusDef:**
```
StatusDef|ID|Name|Color|flag
```

**StatusAction:**
```
StatusAction|StatusID|TargetID|Value|Function
```

Status actions trigger when status is active:
- Function 0: Stat modifier
- Function 2: Grant perk
- Function 3: Grant ability

---

## Schema System

### Purpose

The schema defines:
1. **Column structure** for each record type
2. **Data types** for validation
3. **UI hints** for the editor

### Schema Files

| File | Purpose |
|------|---------|
| `schema.json` / `schema-structure.json` | Full schema with columns and UI |
| `schema-data.json` | Runtime data storage |
| `src/models/schema.ts` | TypeScript interfaces |

### Column Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | "Fireball" |
| `int` | Integer | 42 |
| `float` | Decimal | 1.5 |
| `bool_tf` | t/f boolean | "t" |
| `char` | Single character | "A" |
| `string_or_empty` | String or blank | "" |
| `int_or_float` | Number (either type) | 1 or 1.5 |
| `rgba_float_list` | Color | "1.0,0.5,0.0,1.0" |
| `string_or_id` | Name or numeric ID | "Fireball" or 100 |

### UI Configuration

```typescript
interface TableUI {
  hidden?: string[];           // Never shown
  hiddenByTab?: Record<string, string[]>;  // Hidden on specific tabs
  displayOrder?: string[];     // Field render order
  labels?: Record<string, string>;  // Display names
  tooltips?: Record<string, string>;  // Help text
  input?: Record<string, string>;  // "text" or "textarea"
  span?: Record<string, number>;   // Column width
  layoutGrid?: Record<string, unknown>;  // Absolute positioning
  enum?: Record<string, string>;   // Dropdown options
}
```

### Enum Definitions

Enums are defined per-column in the schema:

```json
{
  "columns": [{
    "name": "Function",
    "type": "int",
    "enum": {
      "0": "Allow Skill",
      "1": "Deny Skill",
      "2": "Allow Perk",
      ...
    }
  }]
}
```

---

## Editor Architecture

### Tech Stack

- **React 18** with TypeScript
- **Vite** for building
- **TailwindCSS** for styling
- **LocalStorage** for persistence

### Key Files

```
src/
├── components/
│   ├── CharacterSheetModal.tsx   # Character sheet + abilities
│   ├── chat/
│   │   ├── ChatPanel.tsx         # Chat UI
│   │   ├── ChatInput.tsx         # Message input
│   │   └── ChatMessageList.tsx   # Message display
│   └── abilities/
│       ├── AbilitiesTab.tsx      # Abilities list
│       ├── AbilityCard.tsx       # Single ability display
│       └── AbilityCategoryGroup.tsx  # Collapsible category
├── hooks/
│   ├── useChatState.tsx          # Chat context provider
│   └── useEditorState.ts         # Editor state management
├── utils/
│   ├── diceRoller.ts             # Dice parsing and rolling
│   ├── abilityFiltering.ts       # Ability availability logic
│   └── rprImport.ts              # RPR file parsing
├── types/
│   └── chat.ts                   # Chat type definitions
└── models/
    └── schema.ts                 # Schema TypeScript types
```

### State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SchemaDataEditorPage                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ schemaData: Record<string, Row[]>                   │    │
│  │   - SkillDef[], Stat[], PerkDef[], SpellDef[], etc. │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              CharacterSheetModal                     │    │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │    │
│  │  │ Character Tab   │  │ Abilities Tab           │   │    │
│  │  │ - allocations   │  │ - available abilities   │   │    │
│  │  │ - chosen perks  │  │ - requirements          │   │    │
│  │  │ - perk bonuses  │  │ - combat state (future) │   │    │
│  │  │ - stat values   │  │                         │   │    │
│  │  └────────┬────────┘  └────────────┬────────────┘   │    │
│  │           │                        │                 │    │
│  │           └────────────┬───────────┘                 │    │
│  │                        ▼                             │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │              ChatPanel                       │    │    │
│  │  │  - Roll results                              │    │    │
│  │  │  - Ability usage logs                        │    │    │
│  │  │  - System messages                           │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Character Sheet System

### State Management

```typescript
// Core character state
const [allocations, setAllocations] = useState<Map<number, number>>();  // SkillDef ID → points
const [chosen, setChosen] = useState<number[]>();  // Chosen PerkDef IDs

// Derived state
const perkBonuses: Map<number, number>;     // SkillDef ID → bonus from perks
const statPerkBonuses: Map<number, number>; // Stat ID → bonus from perks
const grantedStatIDs: Set<number>;          // Stats revealed by perks
```

### Stat Computation

```typescript
function computeStatValue(stat, attrMap, perkBonuses, statPerkBonuses) {
  const base = stat.Base;
  const bonus = stat.Bonus;
  const scale = stat.Scale || 1;
  const parts = parseAttrList(stat.Formula);  // "2*1.0;1*0.5" → [{id:2, mult:1}, {id:1, mult:0.5}]

  let contrib = 0;
  for (const p of parts) {
    const attr = attrMap.get(p.id);
    const val = attr.NaturalBonus + allocations.get(p.id) + perkBonuses.get(p.id);
    contrib += val * p.mult;
  }

  const perkStatBonus = statPerkBonuses.get(stat.ID) || 0;
  return (base + bonus + contrib + perkStatBonus) * scale;
}
```

### Perk Cascade System

When perks are chosen, their PerkActions cascade:

```typescript
// Build available perks list
for (const pid of chosen) {
  const actions = actsByPerk.get(pid);
  for (const a of actions) {
    switch (a.Function) {
      case 2:  // Allow Perk
        allowIDs.add(a.TargetID);
        break;
      case 3:  // Deny Perk
        denyIDs.add(a.TargetID);
        break;
      case 13: // Allow Category
        allowCats.add(a.Modifier);
        break;
      case 14: // Deny Category
        denyCats.add(a.Modifier);
        break;
      // ... etc
    }
  }
}
```

### Dice Rolling

Two dice systems supported (from DiceRules):

1. **Roll System** (DiceSystem=0): Standard dice + modifier
   - Roll `NumDice`d`Sides` + modifier
   - Compare to DC or contested roll
   - Supports 5e advantage/disadvantage

2. **Dice Pool System** (DiceSystem=1): Success counting
   - Roll N dice (N = skill bonus)
   - Count successes (≥ threshold) and failures (≤ threshold)
   - Net hits = successes - failures

---



### Availability Filtering

An ability is available if:

1. `CommonAbility = 't'` (available to everyone), OR
2. Granted by chosen perk (PerkAction Function=8), OR
3. Granted by active status (StatusAction Function=3), OR
4. Granted by active mutator (MutatorAction Function=3)

```typescript
function getAvailableAbilities(options: {
  spellDefs: Row[];
  perkActions: Row[];
  mutatorActions?: Row[];
  statusActions?: Row[];
  chosenPerkIds: Set<number>;
  activeStatusIds?: Set<number>;
  activeMutatorIds?: Set<number>;
  adminMode?: boolean;
}): Row[]
```

### Requirement Checking

Each ability has SpellReqDef entries. Check depends on `RequirementsMode`:
- `t` = ALL requirements must pass
- `f` = ANY requirement can pass

```typescript
function checkRequirement(req: SpellReqDef, characterState, combatState): {
  met: boolean;
  text: string;
}
```

### Target Types

| Value | Type | Description |
|-------|------|-------------|
| 0 | Selected | Player picks targets |
| 1 | Self | Caster only |
| 2 | All | Everyone in range |
| 3 | All Others | Everyone except caster |
| 4 | Selected Others | Pick targets, excluding self |

---

## Combat Simulation (Testing Suite)

### Combat State

```typescript
interface CombatState {
  // Virtual stat values (keyed by Stat ID)
  stats: Map<number, number>;

  // Active statuses (keyed by StatusDef ID)
  activeStatuses: Set<number>;

  // Status categories (for dispel matching)
  activeStatusCategories: Set<string>;

  // Ability cooldowns (keyed by SpellDef ID)
  cooldowns: Map<number, number>;

  // Combat mode
  inCombat: boolean;
  currentTurn: number;
}
```

### Training Dummies

```typescript
interface TrainingDummy {
  id: number;
  name: string;
  enabled: boolean;

  stats: Map<number, number>;
  maxHealth: number;
  currentHealth: number;

  activeStatuses: Set<number>;
  buffs: Map<number, BuffInstance>;
}
```

### Combat Execution Flow

```
1. SELECT ABILITY
   └── Validate SpellReqDef requirements
       └── If RequirementsMode='t': ALL must pass
       └── If RequirementsMode='f': ANY can pass

2. SELECT TARGETS
   └── Based on TargetType and #Targets
   └── Present target selector UI

3. CASTER ROLL (if applicable)
   └── Evaluate CasterRollFormula
   └── Or use RollStatSkillID
   └── Determine success/failure/critical

4. FOR EACH TARGET:
   a. Roll Target DC (if DCType requires)
   b. Determine outcome (success/failure)
   c. Apply SpellEffects filtered by:
      - Who (0=Target, 1=All, 2=Caster)
      - Outcome (0=Always, 1=Success, 2=Failure)
      - If (0=Always, 1=Critical, 2=Non-Critical)

5. PROCESS EFFECTS:
   | Function | Action |
   |----------|--------|
   | 0 | Print message to chat |
   | 1 | target.stats[id] += value |
   | 5 | Add temporary buff |
   | 10 | target.stats[id] = value |
   | 11 | target.activeStatuses.add(id) |
   | 7 | Remove statuses by category |
   | 9 | Recursively execute target ability |

6. LOG TO CHAT
   └── Roll results, damage, status changes
```

---



---



### Adding a New Record Type

1. **Define in schema.json:**
```json
{
  "tables": {
    "NewType": {
      "columns": [
        { "index": 0, "name": "ID", "type": "int" },
        { "index": 1, "name": "Name", "type": "string" },
        ...
      ],
      "ui": {
        "displayOrder": ["ID", "Name", ...],
        "labels": { "ID": "Identifier" }
      }
    }
  }
}
```

2. **Add to categories if needed:**
```json
{
  "categories": ["Attributes", "Skills", "Perks", "Stats", "Runes", "Statuses", "Mutators", "Abilities", "NewCategory"]
}
```

3. **Update expectedOrder for export:**
```json
{
  "expectedOrder": [..., "NewType"]
}
```

### Adding a New PerkAction Function

1. **Add enum value in schema:**
```json
{
  "columns": [{
    "name": "Function",
    "enum": {
      ...
      "16": "New Function"
    }
  }]
}
```

2. **Handle in CharacterSheetModal.tsx:**
```typescript
for (const act of actions) {
  const fn = Number(act.Function);
  if (fn === 16) {  // New Function
    // Process the action
  }
}
```

3. **Update describePerk() for UI display:**
```typescript
} else if (fn === 16) {
  effects.push(`New effect: ${act.TargetID}`);
}
```

### Adding a New SpellEffect Function

1. **Add enum value in schema**

2. **Handle in effect processor (future):**
```typescript
function processEffect(effect: Row, caster: Entity, target: Entity, state: CombatState) {
  const fn = Number(effect.Function);
  switch (fn) {
    case 13: // New effect
      // Apply effect
      break;
  }
}
```

### Creating a New UI Component

Follow the existing patterns:

```typescript
// src/components/feature/NewComponent.tsx
type Row = Record<string, unknown>;

type Props = {
  data: Row[];
  onAction: (id: number) => void;
};

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function tf(v: unknown): boolean {
  return String(v).toLowerCase() === 't' || v === true;
}

export default function NewComponent({ data, onAction }: Props) {
  // Component implementation
}
```



---

## Implementation Status

### Completed (Phase 1)

- [x] Character sheet with allocations and perks
- [x] Stat computation from formulas
- [x] Perk cascade (allow/deny perks, categories, skills)
- [x] Dice rolling (both systems)
- [x] Chat panel integration
- [x] Abilities tab with filtering
- [x] Category grouping

### In Progress (Phase 2-3)

- [ ] Requirement checking against character state
- [ ] Color-coded requirement display
- [ ] Training dummy system
- [ ] Target selection UI

### Planned (Phase 4-6)

- [ ] Formula parser/evaluator
- [ ] Full combat execution
- [ ] SpellEffect processor
- [ ] Auto-ability chains
- [ ] Buff/debuff duration tracking
- [ ] Cooldown management

---

## Quick Reference

### Common Stat IDs (WHRpR)

| ID | Name |
|----|------|
| 1-6 | STR, DEX, CON, INT, WIS, CHA |
| 29 | Armor Class |
| 30 | Attack Bonus |
| 32 | Mana |
| 35 | Health |
| 43 | Initiative |
| 44 | Speed |
| 453 | Bonus Action |
| 454 | Reaction |
| 455 | Standard Action |
| 587-592 | Damage Mods (Str/Dex/Con/Int/Wis/Cha) |
| 945 | Caster Mod |
| 946 | Magic Bonus |

### Character Building Stages

1. S1: Race
2. S1.1: Human (human-only)
3. S1.5: Flaw
4. S2: Class
5. S3: Armor Spec
6. S4: Weapon Spec
7. S5: Feats
8. S7-S9: Skills

### File Paths

| Purpose | Path |
|---------|------|
| Schema definition | `public/schema-structure.json` |
| Runtime data | `public/schema-data.json` |
| Type definitions | `src/models/schema.ts` |
| Character sheet | `src/components/CharacterSheetModal.tsx` |
| Abilities | `src/components/abilities/` |
| Chat | `src/components/chat/` |
| Dice rolling | `src/utils/diceRoller.ts` |
| Ability filtering | `src/utils/abilityFiltering.ts` |

---

## Appendix: Implementation Plan

### Key SpellDef Fields for Combat

```
ID, Name, Description, Range, TargetType, #Targets,
CasterRollType, RollStatSkillID, CasterRollFormula,
DCType, FixedDCValue, RequirementsMode,
CommonAbility (t = available to all),
AbilityIcon, IconColor, Category
```

### SpellEffect Functions (Full List for Simulation)

| Function | Effect | Simulation Action |
|----------|--------|-------------------|
| 0 | Print Message | Add to chat |
| 1 | Modify Stat | `target.stats[id] += value` |
| 3 | Give Item | Spawn Conan item (log only) |
| 4 | Buff Skill | Temporary skill modifier |
| 5 | Buff Stat | Temporary stat modifier |
| 7 | Dispel Buff | Remove buffs by category |
| 9 | Auto Use Ability | **Recursively execute** target ability |
| 10 | Set Stat | `target.stats[id] = value` |
| 11 | Grant Status | `target.activeStatuses.add(id)` |
| 12 | Caster Dispel | Remove caster's statuses by category |

### Training Dummy System

```typescript
interface TrainingDummy {
  id: number;                    // 0-9
  name: string;                  // "Dummy 1", customizable
  enabled: boolean;              // Show in target list

  // Core stats (customizable)
  stats: Map<number, number>;    // Health, Mana, AC, etc.
  maxHealth: number;
  currentHealth: number;

  // State
  activeStatuses: Set<number>;   // StatusDef IDs
  statusCategories: Set<string>; // For dispel matching
  buffs: Map<number, BuffInstance>; // Active buff effects
}

interface BuffInstance {
  sourceAbilityId: number;
  category: string;
  duration: number;              // Turns remaining, -1 = permanent
  statModifiers: Map<number, number>;
}
```

### Key Utilities to Implement

```typescript
// 1. Requirement checking
function checkRequirement(
  req: SpellReqDef,
  characterState: CharacterState,
  combatState: CombatState
): { met: boolean; text: string }

// 2. Effect processing
function applyAbilityEffects(
  spell: SpellDef,
  effects: SpellEffect[],
  caster: Entity,
  targets: Entity[],
  outcome: 'success' | 'failure' | 'critical',
  state: CombatState
): CombatState

// 3. Formula evaluation
function evaluateFormula(
  formula: string,
  context: { caster: Entity; target?: Entity; roll?: number }
): number
```

### Planned File Structure

```
src/
  components/
    abilities/
      AbilitiesTab.tsx           (main container) ✓
      AbilityCard.tsx            (single ability) ✓
      AbilityCategoryGroup.tsx   (collapsible) ✓
      RequirementLine.tsx        (requirement formatting)
      TargetSelector.tsx         (dummy selection UI)
      TrainingDummyConfig.tsx    (dummy setup panel)
      DummyStatusBar.tsx         (health/status display)
  hooks/
    useCombatSimulation.ts       (full state machine)
    useFormulaEvaluator.ts       (parse & evaluate)
    useTrainingDummies.ts        (dummy management)
  utils/
    abilityFiltering.ts          (filter by perks) ✓
    requirementChecker.ts        (check SpellReqDef)
    effectProcessor.ts           (apply SpellEffects)
    formulaParser.ts             (parse dice/stat formulas)
    diceRoller.ts                (dice expressions) ✓
```

### Implementation Phases (Detailed)

#### Phase 1: Foundation ✓ COMPLETE
- [x] Add Abilities tab to CharacterSheetModal
- [x] Filter abilities by CommonAbility + perk grants
- [x] Group by Category with collapsible dividers
- [x] Display ability cards (static info only)

#### Phase 2: Requirements & State
- [ ] Parse SpellReqDef for each ability
- [ ] Implement `checkRequirement()` function
- [ ] Initialize combat state from character allocations/bonuses
- [ ] Color-code requirements (green=met, orange=unmet)
- [ ] Enable/disable Select button based on requirements

#### Phase 3: Training Dummies
- [ ] TrainingDummy data structure
- [ ] Dummy configuration UI (add/remove, set stats)
- [ ] Target selection modal when ability selected
- [ ] Dummy health/status display in sidebar

#### Phase 4: Combat Execution
- [ ] Formula parser for `{c.StatName}`, `{t.StatName}` references
- [ ] Dice expression evaluator (`2d6+5`, `f.clamp[...]`)
- [ ] Caster roll execution using CasterRollFormula/RollStatSkillID
- [ ] Target DC evaluation
- [ ] SpellEffect processor with outcome filtering

#### Phase 5: Advanced Effects
- [ ] Auto-ability chains (Function=9 recursive execution)
- [ ] Buff/debuff duration tracking (turn-based)
- [ ] Dispel by category matching
- [ ] Cooldown tracking (CooldownMinutes + stat-based)

#### Phase 6: Polish
- [x] Filter/search abilities
- [x] Collapse/expand categories
- [ ] Ability descriptions on expand/hover
- [ ] Combat log formatting (structured chat messages)
- [ ] Reset combat button
- [ ] Preset dummy configurations (save/load)

### Design Decisions

1. **Cooldowns**: Data-driven. `CooldownMinutes` for real-time, stat counters for turn-based.
2. **Target Selection**: Virtual training dummies (up to 10) with customizable stats.
3. **Roll Results**: Display in chat panel (shared with CharacterSheet).
4. **RequirementsMode**: `t` = ALL must match, `f` = ANY can match.
5. **Category Separators**: Render as collapsible dividers.
6. **Integration**: Tab within CharacterSheetModal to share state and chat panel.

---

*Last updated: Session analyzing WHRpR.txt, SHRpR.txt, schema system, and editor architecture.*
