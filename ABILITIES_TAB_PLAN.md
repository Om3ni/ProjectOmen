# Abilities Tab Implementation Plan

## Overview

A **full combat simulation/testing suite** for the Character Sheet that allows ability creators to verify their SpellDef configurations work correctly. This tab simulates the complete combat state machine including:

- Stat/status tracking for player and targets
- Virtual "training dummies" (up to 10) with customizable stats
- Multi-target ability testing
- Damage formula evaluation
- Auto-ability chains (SpellEffect Function=9)
- Roll results displayed in chat panel

**Future**: LLM integration for automated combat simulation.

---

## Data Model

### Tables Involved

| Table | Purpose |
|-------|---------|
| `SpellDef` | Ability definitions (name, icon, targets, range, category, etc.) |
| `SpellReqDef` | Requirements to use an ability (stat checks, perk ownership, status, etc.) |
| `SpellEffect` | Effects that trigger when ability is used (stat changes, status grants, etc.) |
| `StatusDef` | Status definitions (for tracking active buffs/debuffs) |
| `Stat` | Stat definitions (Health, Mana, action counters, etc.) |
| `PerkAction` | Perk effects including Function=8 (Grant Ability) |

### Key SpellDef Fields

```
ID, Name, Description, Range, TargetType, #Targets,
CasterRollType, RollStatSkillID, CasterRollFormula,
DCType, FixedDCValue, RequirementsMode,
CommonAbility (t = available to all),
AbilityIcon, IconColor, Category
```

### SpellReqDef Functions (Requirement Types)

| Function | Meaning | Params |
|----------|---------|--------|
| 0 | Stat check | Param=StatID, ValueMin, Operator |
| 1 | Skill check | Param=SkillID, ValueMin, Operator |
| 2 | Skill Allocation check | Param=SkillID, ValueMin |
| 3 | Perk ownership | Param=PerkID |
| 4 | Conan Level | ValueMin |
| 5 | Status Category | Text field |
| 6 | Conan Item ID | Param=ItemID |

### SpellEffect Functions (Effect Types to Simulate)

| Function | Effect | Simulation Action |
|----------|--------|-------------------|
| 1 | Modify Stat | Add value to stat |
| 5 | Buff Stat | Temporary stat modifier |
| 10 | Set Stat | Set stat to value |
| 11 | Buff Grant Status | Add status to active list |
| 7 | Dispel Buff | Remove status by category |

---

## State Machine

### Combat State Tracked

```typescript
interface CombatState {
  // Virtual stat values (keyed by Stat ID)
  stats: Map<number, number>;

  // Active statuses (keyed by StatusDef ID)
  activeStatuses: Set<number>;

  // Status categories active
  activeStatusCategories: Set<string>;

  // Ability cooldowns (keyed by SpellDef ID, value = turns remaining)
  cooldowns: Map<number, number>;

  // Combat mode
  inCombat: boolean;
  currentTurn: number;
}
```

### State Initialization

On tab load / reset:
1. Initialize stats from character's current values (from allocations + perk bonuses)
2. Clear all active statuses
3. Clear all cooldowns
4. Set inCombat = false

### State Transitions

When "Select" (use ability) is clicked:
1. Verify all SpellReqDef requirements are met
2. Apply SpellEffect entries where `Who = 2` (Caster) or `Who = 0` (Target = self for self-cast)
3. For stat modifications: update `stats` map
4. For status grants: add to `activeStatuses`
5. For dispels: remove matching statuses
6. Set cooldown if ability has CooldownMinutes > 0
7. Log the action to chat panel

---

## Abilities Filtering

### Available Abilities = Union of:

1. **CommonAbility = 't'** - Available to everyone
2. **Granted by chosen perks** - PerkAction where:
   - `Function = 8` (Grant Ability)
   - `PerkID` is in chosen perks list
   - `TargetID` = SpellDef ID

### Excluded Abilities:

- `Category = "Category"` (separators)
- `Category = "Admin"` (unless admin mode)
- Abilities with no icon (`AbilityIcon = "None"` or empty) - optional filter

---

## UI Components

### 1. AbilitiesTab (main container)

```
┌─────────────────────────────────────────────────────┐
│ [Filter...                    ] [X] [Refresh]       │
├─────────────────────────────────────────────────────┤
│ ▼ General                                           │
│   ┌─────────────────────────────────────────────┐   │
│   │ [Icon] Rest                         [Select]│   │
│   │        Targets self                         │   │
│   │        Requires:                            │   │
│   │        ◆ Does not have In Combat (green)    │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│ ▼ Peri Combat                                       │
│   ┌─────────────────────────────────────────────┐   │
│   │ [Icon] Roll Initiative PVP/PVE      [Select]│   │
│   │        Targets self                         │   │
│   │        No requirements                      │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│ ▼ Standard Action                                   │
│   ┌─────────────────────────────────────────────┐   │
│   │ [Icon] Acid Flask                  [Select] │   │
│   │        Select 1 target within 5 tiles       │   │
│   │        Requires all of the following:       │   │
│   │        ◆ Class Skill I is equal to 2 (red)  │   │
│   │        ◆ Standard Action is equal to 1      │   │
│   │        ◆ Mana is at least 5 (red)           │   │
│   └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 2. AbilityCard Component

Props:
```typescript
interface AbilityCardProps {
  spell: SpellDef;
  requirements: SpellReqDef[];
  combatState: CombatState;
  characterState: CharacterState; // allocations, perks, etc.
  onSelect: (spellId: number) => void;
}
```

Displays:
- Icon with IconColor tint
- Name
- Target info: "Select X target(s) within Y tile radius" or "Targets self"
- Requirements section with met/unmet styling
- Select button (disabled if requirements not met)

### 3. RequirementLine Component

Formats a single SpellReqDef into human-readable text:
- "Mana is at least 5"
- "First Aid allocation is at least 1"
- "Does not have In Combat"
- "Standard Action is equal to 1"

Color: green if met, orange/red if not met.

---

## Integration with CharacterSheetModal

### Option A: Tab within existing modal

Add a tab bar to CharacterSheetModal:
```
[Stats/Skills] [Perks] [Abilities]
```

Share state between tabs:
- Allocations
- Chosen perks
- Perk bonuses

### Option B: Separate panel (as shown in screenshots)

The Abilities panel appears to be its own window/tab in the game UI. Could be:
- A separate route/modal
- A collapsible panel within CharacterSheet

**Recommendation**: Tab within CharacterSheetModal for easier state sharing.

---

## Implementation Phases

### Phase 1: Basic Ability Display
- Filter abilities by CommonAbility + perk grants
- Group by Category (preserve data order)
- Display ability cards with static info
- No state simulation yet

### Phase 2: Requirement Checking
- Parse SpellReqDef for each ability
- Check against character state (allocations, perks, stats)
- Color-code requirements (met = green, unmet = orange)
- Enable/disable Select button

### Phase 3: Combat State Simulation
- Initialize combat state from character
- Track stats, statuses, cooldowns
- "Select" button applies SpellEffects
- State persists within session

### Phase 4: Advanced Features
- Filter/search abilities
- Collapse/expand categories
- Show ability descriptions on hover/click
- Log actions to chat panel
- "Reset Combat" button

---

## File Structure

```
src/
  components/
    CharacterSheetModal.tsx (add tab support)
    abilities/
      AbilitiesTab.tsx        (main container)
      AbilityCard.tsx         (single ability display)
      RequirementLine.tsx     (requirement formatting)
      useCombatState.ts       (state management hook)
      abilityUtils.ts         (filtering, requirement checking)
```

---

## Key Utilities Needed

### 1. `getAvailableAbilities(spellDefs, perkActions, chosenPerks)`
Returns SpellDef[] filtered by CommonAbility + perk grants

### 2. `checkRequirement(req: SpellReqDef, state: CombatState, charState: CharacterState)`
Returns { met: boolean, text: string }

### 3. `applyAbilityEffects(spell: SpellDef, effects: SpellEffect[], state: CombatState)`
Returns new CombatState with effects applied

### 4. `formatTargetInfo(spell: SpellDef)`
Returns string like "Select 1 target within 5 tiles"

### 5. `groupByCategory(abilities: SpellDef[])`
Returns Map<string, SpellDef[]> preserving encounter order

---

## Resolved Design Decisions

1. **Cooldowns**: Data-driven. `CooldownMinutes` for real-time, stat counters for turn-based.
2. **Target Selection**: Virtual training dummies (up to 10) with customizable stats.
3. **Roll Results**: Display in chat panel (shared with CharacterSheet).
4. **RequirementsMode**: `t` = ALL must match, `f` = ANY can match.
5. **Category Separators**: Render as **collapsible dividers**.
6. **Integration**: Tab within CharacterSheetModal to share chat panel.

---

## Training Dummies System

### Purpose
- Test multi-target abilities
- Verify damage formulas
- Test auto-ability chains
- Future: LLM-driven combat simulation

### Dummy Entity

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

### Dummy Configuration UI

```
┌─ Training Dummies ─────────────────────────────────┐
│ [+] Add Dummy                    [Reset All]       │
├────────────────────────────────────────────────────┤
│ ☑ Dummy 1: "Goblin"     HP: [50]/[50]  AC: [12]   │
│ ☑ Dummy 2: "Orc"        HP: [80]/[80]  AC: [14]   │
│ ☐ Dummy 3              (disabled)                  │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

### Target Selection UI

When ability is selected:
```
┌─ Select Targets (1/3) ─────────────────────────────┐
│ ○ Self (Player)           HP: 45/50               │
│ ● Dummy 1: "Goblin"       HP: 32/50  [Burning]    │
│ ● Dummy 2: "Orc"          HP: 80/80               │
│ ○ Dummy 3: "Dragon"       HP: 200/200             │
├────────────────────────────────────────────────────┤
│ Modifier: [+0]  Reason: [____________]  50        │
│                    [ Use Ability ]                 │
└────────────────────────────────────────────────────┘
```

---

## Combat Execution Flow

### When "Use Ability" is clicked:

1. **Validate Requirements**
   - Check all SpellReqDef entries against caster state
   - If RequirementsMode='t', ALL must pass
   - If RequirementsMode='f', ANY can pass

2. **Roll Caster Dice** (if applicable)
   - Evaluate CasterRollFormula or use RollStatSkillID
   - Determine success/failure/critical

3. **For Each Target:**
   a. **Roll Target DC** (if DCType requires it)
   b. **Determine Outcome** (success/failure per target)
   c. **Apply SpellEffects** filtered by:
      - `Who` (0=Target, 1=All Targets, 2=Caster)
      - `Outcome` (0=General, 1=Success, 2=Failure)
      - `If` (0=Always, 1=Critical Only, 2=Non-Critical)

4. **Process SpellEffects:**
   | Function | Action |
   |----------|--------|
   | 0: Print Message | Add to chat |
   | 1: Modify Stat | target.stats[id] += value |
   | 5: Buff Stat | Add temporary modifier |
   | 10: Set Stat | target.stats[id] = value |
   | 11: Grant Status | target.activeStatuses.add(id) |
   | 7: Dispel | Remove buffs by category |
   | 9: Auto Use Ability | **Recursively execute** target ability |

5. **Update Cooldowns**
   - If CooldownMinutes > 0, track real-time
   - If stat-based, the SpellEffects handle it

6. **Log to Chat**
   - Roll results
   - Damage dealt
   - Status changes
   - Auto-ability triggers

---

## Formula Evaluation

### Variables Available

```
{c.StatName}      - Caster's stat value
{c.SkillName}     - Caster's skill total (alloc + bonus)
{t.StatName}      - Target's stat value
{t.SkillName}     - Target's skill total
{roll}            - The dice roll result
{caster}          - Caster's name
{target}          - Target's name
```

### Dice Notation

```
1d20              - Roll 1d20
2d6 + 5           - Roll 2d6, add 5
f.max[a, b]       - Maximum of a and b
f.round[x]        - Round to nearest integer
```

### Example Formulas

```
1d20 + {c.Attack Bonus}
2d6 + {c.StrDamageMod}
f.max[(1d20 + {c.Attack Bonus}), (1d20 + {c.Attack Bonus})]
```

---

## File Structure (Updated)

```
src/
  components/
    CharacterSheetModal.tsx      (add Abilities tab)
    abilities/
      AbilitiesTab.tsx           (main container)
      AbilityCard.tsx            (single ability display)
      AbilityCategoryGroup.tsx   (collapsible category)
      RequirementLine.tsx        (requirement formatting)
      TargetSelector.tsx         (dummy selection UI)
      TrainingDummyConfig.tsx    (dummy setup panel)
      DummyStatusBar.tsx         (health/status display)
    hooks/
      useCombatSimulation.ts     (full state machine)
      useFormulaEvaluator.ts     (parse & evaluate formulas)
      useTrainingDummies.ts      (dummy state management)
    utils/
      abilityFiltering.ts        (filter by perks/common)
      requirementChecker.ts      (check SpellReqDef)
      effectProcessor.ts         (apply SpellEffects)
      formulaParser.ts           (parse dice/stat formulas)
      diceRoller.ts              (evaluate dice expressions)
```

---

## Implementation Phases (Revised)

### Phase 1: Foundation
- [ ] Add Abilities tab to CharacterSheetModal
- [ ] Filter abilities by CommonAbility + perk grants
- [ ] Group by Category with collapsible dividers
- [ ] Display ability cards (static info only)

### Phase 2: Requirements & State
- [ ] Parse SpellReqDef for each ability
- [ ] Implement requirement checking
- [ ] Initialize combat state from character
- [ ] Color-code requirements (met/unmet)

### Phase 3: Training Dummies
- [ ] TrainingDummy data structure
- [ ] Dummy configuration UI
- [ ] Target selection UI
- [ ] Dummy stat/health display

### Phase 4: Combat Execution
- [ ] Formula parser for dice expressions
- [ ] Formula evaluator with stat lookups
- [ ] Caster roll execution
- [ ] Target DC evaluation
- [ ] SpellEffect processor

### Phase 5: Advanced Effects
- [ ] Auto-ability chains (Function=9)
- [ ] Buff/debuff duration tracking
- [ ] Dispel by category
- [ ] Cooldown tracking (both types)

### Phase 6: Polish
- [ ] Filter/search abilities
- [ ] Ability descriptions on expand
- [ ] Combat log formatting
- [ ] Reset combat button
- [ ] Preset dummy configurations

---

## Dependencies

- Existing: CharacterSheetModal state (allocations, chosen perks, perkBonuses)
- Existing: useChatState for logging rolls/actions
- Existing: Chat panel for displaying combat results
- New: Combat simulation state machine
- New: Formula parser/evaluator
- New: Training dummy management
