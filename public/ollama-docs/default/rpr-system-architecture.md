# RPR System Architecture Guide

## Overview
RPR (Role Play Repository) is a **pipe-delimited data format** for defining tabletop RPG systems within Conan Exiles. Unlike traditional TTRPGs with narrative flexibility, RPR operates under strict technical constraints that fundamentally shape what's possible.

**Critical Understanding**: RPR is not a programming language. It's a structured data format with fixed tables, enum values, and formula patterns. You cannot write custom logic—you configure predefined systems.

## Core Philosophy
RPR systems are **configuration-driven**, not **code-driven**. Design approaches that work in traditional TTRPGs often don't translate to RPR because:
- **No scripting**: Can't write "if health < 50%, +2 damage" logic
- **Static formulas**: All calculations are fixed weighted sums
- **Enum constraints**: Limited to predefined function types
- **No runtime evaluation**: Can't check variables during ability execution

## File Structure

### Pipe-Delimited Format
Every line follows: `Literal|Field1|Field2|Field3|...`

Example:
```
SkillDef|t|1|Strength|Measures physical power|f|-1||0|t|0
```

- First field is always the table literal (`SkillDef`, `PerkDef`, etc.)
- Subsequent fields match schema column order EXACTLY
- Empty fields still need delimiters: `||`
- No comments allowed mid-file

### Required Tables (in order)
1. **DiceConfig** (singleton, exactly 1 row)
2. **DiceRules** (singleton, exactly 1 row)
3. **Gear** (singleton, exactly 1 row)
4. **SkillDef** (attributes and skills)
5. **PerkDef** / **PerkAction**
6. **Stat**
7. **RuneDef** / **RuneAction** / **RuneCondition** (admin-only)
8. **StatusDef** / **StatusAction**
9. **MutatorDef** / **MutatorAction** / **MutatorCondition**
10. **SpellDef** / **SpellReqDef** / **SpellTargetCond** / **SpellEffect**

## DiceConfig: The Control Center

Single row that controls the entire system. Key fields:

### Node Management
- **TotalNodes**: Highest ID ever used (includes deleted). CRITICAL: Must increment when creating, never decrement.
- **Node IDs**: Unique integers across ALL tables (SkillDef, PerkDef, Stat, SpellDef share ID space)

### Point Allocation
- **AttributePoints**: Pool for attribute allocation
- **SkillPoints**: Pool for skill allocation
- **PerkPoints**: Pool for purchasing perks
- **MaxAttributeAllocation** / **MaxSkillAllocation**: Per-stat caps
- **MinAttributeAllocation** / **MinSkillAllocation**: Per-stat minimums

### Point Buy System
- **AttributePointBuy** / **SkillPointBuy**: Enable escalating costs
- **Fixed Formula**:
  - 0→1 = 1 point
  - 1→2 = 1 point
  - 2→3 = 2 points
  - 3→4 = 3 points
  - 4→5 = 4 points, etc.
- **Not Customizable**: This formula is hardcoded in the game engine

### Buff/Debuff Limits
- **MaxAttributeBuff** / **MaxAttributeDebuff**: Total buff/debuff cap for attributes
- **MaxSkillBuff** / **MaxSkillDebuff**: Total buff/debuff cap for skills
- **MaxStatBuff** / **MaxStatDebuff**: Total buff/debuff cap for derived stats
- **Purpose**: Prevents stacking exploits (e.g., +100 Strength from 50 buffs)

### Other Limits
- **MaxRunes**: Maximum equipped runes
- **MaxPlayersPerAbility**: How many players can be targeted by an ability

## SkillDef: Attributes vs Skills

**Single table serves TWO purposes** via TypeFlag:
- `TypeFlag='t'`: **Attribute** (primary stats like Strength, Intelligence)
- `TypeFlag='f'`: **Skill** (derived from attributes via Bonus Source)

### Attributes (TypeFlag='t')
```
SkillDef|t|1|Strength|Measures physical power|f|-1||0|t|0
```
- No Bonus Source (field is empty)
- Players allocate points directly
- Used as inputs for skills and stats

### Skills (TypeFlag='f')
```
SkillDef|f|10|Athletics|Climbing, jumping, swimming|f|-1|1*1.0|0|t|0
```
- **Bonus Source**: Formula referencing attributes (e.g., `1*1.0` = 100% of Attribute ID 1)
- **Bonus Function**: How to combine multiple sources
  - `0` = Sum (most common)
  - `1` = Average
  - `2` = Take Min
  - `3` = Take Max

### Hidden Skills
- Set `Public='f'` to hide from character sheet
- Used for internal calculations (damage modifiers, custom rolls)
- Example: `StrDamageMod` (Strength-based damage modifier)

### Trained Flag
- **Trained='t'**: Skill requires training/allocation to use
- **Trained='f'**: Always usable (e.g., Perception, passive saves)

## Formula System (CRITICAL CONSTRAINT)

### Stat.Formula
**Syntax**: `SkillID*Multiplier;SkillID*Multiplier;...`

**Examples**:
```
2*1.0;1*0.5        // 100% of Skill 2 + 50% of Skill 1
1*1.0;2*1.0;4*1.0  // Sum of Skills 1, 2, and 4
```

**What You CAN Do**:
- Reference any attribute or skill by ID
- Apply fixed multipliers
- Combine with BonusFunction (Sum/Average/Min/Max)

**What You CANNOT Do**:
- ❌ Reference stat current values (only base formulas)
- ❌ Conditional formulas (`if STR > 10, use 2*STR, else 1*STR`)
- ❌ Math operations (`(STR + DEX) / 2`)
- ❌ Reference character variables
- ❌ Use dice notation (1d6, 2d8+4)
- ❌ Apply caps or floors (min/max functions)

### Custom Roll Formulas (SpellDef, SpellEffect)
**Syntax**: Dice notation + stat references

**Example**:
```
1d20+4*1.0   // Roll 1d20, add 100% of Skill ID 4
2d6+1*1.0;3*0.5   // Roll 2d6, add Skill 1 + 50% of Skill 3
```

**Limitations**:
- Can only reference skills (not stats, not other character state)
- No conditional expressions
- No complex math (parentheses, exponents, etc.)

## Perk System

### PerkDef
Defines a selectable perk with:
- **Cost**: Perk point cost (can be 0)
- **Category**: String for grouping (e.g., "Fighter", "Racial")
- **Public**: `t` = selectable, `f` = hidden (admin/quest perks)

### PerkAction (19 Function Types)
What happens when you select the perk:

| Function | Purpose | TargetID | Value | Example |
|----------|---------|----------|-------|---------|
| **0: Allow Skill** | Unlock skill allocation | Skill ID | — | Allow training Stealth |
| **1: Deny Skill** | Block skill allocation | Skill ID | — | Prevent Stealth training |
| **2: Allow Perk** | Unlock another perk | Perk ID | — | Prerequisite chains |
| **3: Deny Perk** | Block another perk | Perk ID | — | Mutually exclusive perks |
| **4: Dice Modifier** | Modify attribute/skill rolls | TargetType enum + ID | Modifier amount | +2 to Strength rolls |
| **5: Give Feat** | Legacy (unused) | — | — | — |
| **6: Grant Stat** | Give a derived stat | Stat ID | Initial value | Grant HP stat with 100 value |
| **7: Stat Modifier** | Modify stat permanently | Stat ID | Modifier amount | +10 HP |
| **8: Grant Ability** | Give a spell/ability | SpellDef ID | — | Grant Fireball ability |
| **9: Grant Status** | Apply permanent status | StatusDef ID | — | Grant "Blessed" status |
| **10: Unlock Status** | Allow status to be applied | StatusDef ID | — | Make "Rage" available |
| **11: Grant Perk** | Give another perk | Perk ID | — | Bonus perk |
| **12: Grant Sudo Role** | Admin permissions | — | — | Rarely used |
| **13: Allow Perk Category** | Unlock perk category | — | — | Allow "Fighter" perks |
| **14: Deny Perk Category** | Block perk category | — | — | Prevent "Wizard" perks |
| **15: Teach Language** | Grant language | — | — | Conan Exiles feature |
| **16: Give CharTag** | Apply character tag | — | Tag string | Mark "Veteran" |
| **17: Set Float CharVar** | Set numeric variable | — | Value | Set "Speed" = 30 |
| **18: Set String CharVar** | Set text variable | — | Text | Set "Title" = "Knight" |

### Building Perk Trees
**Pattern**: Use Allow/Deny Perk Category progression

**Example**: Fighter Progression
```
PerkDef|1|t|Fighter Base|Choose Fighter class|0|Class
PerkAction|1|13|0|0|Class||0.0   // Deny "Class" category (force specialization)
PerkAction|1|14|0|0|Subclass||0.0 // Allow "Subclass" category

PerkDef|2|t|Knight Subclass|Shield specialist|0|Subclass
PerkAction|2|14|0|0|Subclass||0.0 // Deny other subclasses
PerkAction|2|8|0|50||0.0          // Grant Shield Bash ability
```

## Stat System (Derived Stats)

### Purpose
Derived stats (HP, Mana, Armor, etc.) calculated from attributes/skills.

### Key Fields
- **Formula**: Weighted sum of skills (e.g., `3*10;1*2` = 10× CON + 2× STR)
- **Base**: Starting value before formula
- **Bonus**: Minimum value (floor)
- **Scale**: Final multiplier applied to result
- **BonusFunction**: How to combine Formula + permanent modifiers

### Calculation Order
```
1. FormulaResult = Σ(SkillValue * Multiplier) combined via BonusFunction
2. Total = (Base + FormulaResult) * Scale
3. FinalValue = max(Total, Bonus)
```

### Flags
- **Public**: Show on character sheet
- **Show**: Player can reset value (resource pools)
- **Active**: Player can modify directly (manual tracking)
- **Trainable**: Player can allocate points (unusual for Stats)
- **Display**: Secret stat (hidden calculation

)

## Ability System (SpellDef)

### Core Structure
- **SpellDef**: Ability definition (name, range, targeting)
- **SpellReqDef**: Requirements to use (stat minimums, perks, level)
- **SpellTargetCond**: Who can be targeted (filters)
- **SpellEffect**: What happens when used (multiple effects per ability)

### CasterRollType (How Caster Rolls)
- **0: Roll Skill** - Roll skill + opposed by DC
- **1: Roll Stat** - Roll derived stat + opposed by DC
- **2: Custom Formula** - Use CasterRollFormula (e.g., `1d20+4*1.0`)

### DCType (Difficulty Check)
- **0: Target Roll** - Target rolls to resist
- **1: Target Stat** - Target's stat is DC
- **2: Fixed** - Use FixedDCValue
- **3: Target Roll Stat** - Target rolls stat
- **4: Custom** - Use TargetDCFormula

### Targeting
- **TargetType**: Selected / Caster / All / All Others / Selected Others
- **#Targets**: How many targets
- **Range**: Distance in game units
- **TargetCondIncludeAll** / **TargetCondExcludeAll**: Condition logic (AND vs OR)

### SpellEffect (13 Function Types)

| Function | Purpose | Who | TargetID | AdjustFormula | Duration |
|----------|---------|-----|----------|---------------|----------|
| **0: Print Message** | Display text | Any | — | Message text | — |
| **1: Modify Stat** | Change stat temporarily | Any | Stat ID | Amount formula | Duration |
| **2: Give Item** | Grant game item | Any | — | Item ID | — |
| **3: Remove Item** | Take game item | Any | — | Item ID | — |
| **4: Buff Skill** | Temporary skill bonus | Any | Skill ID | Bonus formula | Duration |
| **5: Buff Stat** | Temporary stat bonus | Any | Stat ID | Bonus formula | Duration |
| **6: Buff Perk** | Temporary perk | Any | Perk ID | — | Duration |
| **7: Dispel Buff** | Remove status by category | Any | — | Category string | — |
| **8: Buff Ability** | Temporary ability grant | Any | SpellDef ID | — | Duration |
| **9: Auto Use Ability** | Trigger another ability | Any | SpellDef ID | — | — |
| **10: Set Stat** | Set stat to exact value | Any | Stat ID | Value formula | — |
| **11: Buff Grant Status** | Temporary status | Any | StatusDef ID | — | Duration |
| **12: Buff Unlock Status** | Temporarily allow status | Any | StatusDef ID | — | Duration |

### Effect Conditionals
- **If**: Always / Critical Only / Non-Critical Only
- **Outcome**: General Effect / Success Effect / Failure Effect
- **Who**: Target / All Targets / Caster
- **Broadcast**: Public / Private / Secret
- **DelayFormula**: Apply effect after delay (e.g., `5` = 5 seconds)

### Duration and Buff Categories
- **DurationFormula**: How long buff lasts (seconds or formula)
- **Category**: Buff category string (for Dispel targeting)
- Buffs respect DiceConfig max buff/debuff limits

## Mutator System (Conditional Modifiers)

### Purpose
Apply effects based on character state WITHOUT ability activation.

**Example Use Cases**:
- "While wearing Heavy Armor, -2 Stealth"
- "If Strength > 15, +5 damage"
- "When flying, +10 movement speed"

### Structure
- **MutatorDef**: Named mutator (checked automatically)
- **MutatorCondition**: When it applies (Include/Exclude logic)
- **MutatorAction**: What effect to apply

### MutatorCondition (22 Condition Types)
- **0: Perk** - Has specific perk
- **1: Buff Category** - Has buff in category
- **2: Skill Allocation** - Skill points allocated
- **3: Level** - Character level (external system)
- **4-9**: Environmental (Climate, Shelter, Time, Armor Class, Main/Off Hand)
- **10-13**: Physical (Height, Build, Bust/Dong Size)
- **14-16**: State (Flying, Riding, Swimming)
- **17: Gender** - Character gender
- **18: High Heels** - Wearing high heels
- **19: Corruption** - Corruption level
- **20: Status** - Has specific status
- **21: Perk Category** - Has perk in category

### Operators
- **0-1**: `==`, `!=`
- **2-5**: `>`, `>=`, `<`, `<=`
- **6-7**: `Between`, `Outside` (uses Value + MaxValue)

### MutatorAction (6 Function Types)
- **0: Modify Skill** - Adjust skill modifier
- **1: Modify Stat** - Adjust stat modifier
- **2: Grant Perk** - Give perk while active
- **3: Grant Ability** - Give ability while active
- **4: Grant Status** - Give status while active
- **5: Unlock Status** - Allow status while active

## Status/Buff System

### StatusDef
- **Name**: Display name
- **Color**: RGBA color for UI (float values 0.0-1.0)
- **Public**: Visible to players

### StatusAction (5 Function Types)
- **0: Modify Skill** - Permanent skill modifier
- **1: Modify Stat** - Permanent stat modifier
- **2: Grant Perk** - Permanent perk
- **3: Grant Ability** - Permanent ability
- **4: Grant Status** - Stack another status

### Buff System vs Status System
**Confusion Point**: RPR has two "buff" concepts:
1. **Temporary Buffs** (via SpellEffect with Duration) - Time-limited, dispellable
2. **Permanent Statuses** (via StatusDef/StatusAction) - Persist until removed

**Design Tip**: Use temporary buffs for combat effects, permanent statuses for character flags/conditions.

## Leveling and Progression (THE BIG PROBLEM)

### Built-In Support: NONE
RPR has **no native leveling system**. DiceConfig has no "Level" or "XP" fields.

### Workarounds (All Imperfect)

#### Option 1: Perk-Based Progression
- Create "Level 1", "Level 2", ..., "Level 20" perks
- Each level perk grants stats, abilities, points
- Player selects perks sequentially (enforced via Prerequisites)

**Pros**: Works within RPR
**Cons**:
- Manual selection required
- Perk points != XP (awkward)
- Can't auto-level

#### Option 2: External Tracking (Recommended)
- Track level/XP in Discord bot, admin spreadsheet, or external database
- Manually grant perks via admin commands
- Use `Grant Perk` function (PerkAction 11) from admin-controlled perks

**Pros**: Flexible, proper XP progression
**Cons**: Requires external tools, manual admin work

#### Option 3: Formula-Based Scaling
- Create stats with formulas that reference other stats
- Example: `HP Formula = 3*10` (CON × 10)
- As CON increases, HP scales automatically

**Pros**: Automatic scaling
**Cons**:
- Not true leveling (just stat-scaling)
- No discrete level thresholds
- Can't gate abilities by "level"

### Why This Matters for Ollama
**CRITICAL**: Do not suggest "level-gated abilities" without explaining the workaround. Phrases like "unlocked at level 5" need implementation details.

## What RPR CAN Do Well

1. **Point-Buy Character Creation**
   - Allocate attributes, skills, perks from pools
   - Escalating costs via PointBuy system
   - Clear budget management

2. **Derived Stat Scaling**
   - HP/Mana/Armor automatically update from attributes
   - Formula-driven dependencies

3. **Conditional Abilities**
   - Requirements (stat minimums, perk prerequisites)
   - Target filtering (conditions on who can be targeted)
   - Success/Failure branching effects

4. **Buff/Debuff Management**
   - Temporary stat modifiers with durations
   - Buff categories for organized dispelling
   - Hard caps to prevent stacking exploits

5. **Mutator-Based Conditional Logic**
   - Equipment-based modifiers (armor type, weapon equipped)
   - Environmental effects (climate, time of day)
   - Character state (flying, swimming, corruption)

6. **Perk Tree Design**
   - Prerequisites via Allow/Deny Perk
   - Category-based progression gates
   - Mutually exclusive paths

## What RPR CANNOT Do

1. ❌ **Dynamic Formula Evaluation**
   - Can't write `if HP < 50%, +10 damage`
   - Formulas are static weighted sums only

2. ❌ **Complex Conditional Logic**
   - No nested conditions (`(A AND B) OR (C AND D)`)
   - Flat Include/Exclude lists with All Match flags

3. ❌ **Character Variable References**
   - Can't reference current stat values in formulas
   - Can't read buff stacks, status counts, etc.

4. ❌ **Native Leveling**
   - No XP tracking
   - No level-up events
   - No auto-scaling by level

5. ❌ **Scripting/Programming**
   - No loops, variables, functions
   - No event handlers (on hit, on kill, on rest)
   - Fixed function enums only

6. ❌ **Advanced Targeting**
   - Can't target "lowest HP ally" or "highest threat enemy"
   - Selection is player-driven or all/none

7. ❌ **Resource Conversion**
   - Can't write "convert HP to Mana" without external logic
   - No dynamic resource exchanges

8. ❌ **Cooldown Sharing**
   - Each ability has independent cooldown
   - No "shared cooldown group" concept

## Design Patterns

### Pattern: Graduated Perks
Instead of "+10% damage" perks, use graduated tiers:
```
Light Weapon Training (+1 damage) → 1 perk point
Weapon Adept (+2 damage total) → 2 perk points
Weapon Master (+4 damage total) → 5 perk points
```

### Pattern: Mutator-Based Builds
Enable "playstyles" via mutators:
```
Mutator: Heavy Armor User
Condition: Armor Class == Heavy Armor
Action: +5 HP, -2 Stealth
```

### Pattern: Status-Flag Abilities
Use statuses as activation flags:
```
Ability: Enter Rage (grants "Raging" status)
Mutator: While Raging
  +2 Strength, -2 AC
Ability: Exit Rage (removes "Raging" status)
```

### Pattern: Hidden Modifier Skills
Create internal skills for clean formulas:
```
Skill: BestDamageMod (Public=f)
Formula: 1*1.0;2*1.0;4*1.0;5*1.0;6*1.0  // Max of all attributes
BonusFunction: 3 (Take Max)
```
Use in abilities: "Roll damage using BestDamageMod" gives highest stat bonus.

### Pattern: Buff Categories for Control
Organize buffs by type:
```
Category: "Damage"
Category: "Defense"
Category: "Utility"
Ability: Dispel Magic → Removes all "Damage" buffs
```

## Common Pitfalls

### Pitfall: Assuming Scriptability
**Wrong**: "If player has less than 50% HP, ability does double damage"
**Right**: Create two abilities with requirements:
- Ability 1: Requires HP stat > 50%, normal damage
- Ability 2: Requires HP stat ≤ 50%, double damage

### Pitfall: Complex Formula Syntax
**Wrong**: `Formula = (STR + DEX) / 2`
**Right**: `Formula = 1*0.5;2*0.5` (50% STR + 50% DEX)

### Pitfall: Expecting Leveling
**Wrong**: "At level 10, unlock Fireball"
**Right**:
- Create "Level 10" perk granting Fireball
- Or use external system to trigger perk grant

### Pitfall: Infinite Buff Stacking
**Wrong**: Allowing unlimited "+1 Strength" buffs
**Right**: Set `DiceConfig.MaxAttributeBuff = 10` to cap at +10

### Pitfall: Overly Granular Perks
**Wrong**: 100 perks each giving +1% damage
**Right**: 10 meaningful perks with thematic effects

## Cross-System Integration

### Conan Exiles Features
RPR integrates with game features:
- **Gear Table**: Armor weight detection (Light/Medium/Heavy)
- **Game Item ID**: Link perks/runes to in-game items
- **Climate/Shelter/TimeOfDay**: Environmental conditions
- **Character Physical Stats**: Height, Build, Gender (for mutators)

### External Systems
RPR files can be:
- Edited in this web editor
- Uploaded to Conan Exiles server
- Parsed by game mod at runtime

**Admin Tools**:
- Grant perks via in-game commands
- Trigger abilities on players
- Apply statuses manually

## Summary for Ollama

When designing RPR systems:

1. **Start with DiceConfig** - Define point pools and caps
2. **Design Attributes First** - Foundation for everything
3. **Build Skills from Attributes** - Use clear formulas
4. **Create Derived Stats** - HP, Mana, Armor, etc.
5. **Design Perk Trees** - Build progression paths
6. **Create Abilities** - Spells/skills for combat
7. **Add Mutators Last** - Conditional flavor

**Always Remember**:
- RPR is data, not code
- Formulas are static weighted sums
- Use enums, don't invent new function types
- Test multiplication (formula references, buff stacking, Prerequisites)

**Never Suggest**:
- Custom scripting or programming
- Dynamic formula evaluation
- Native leveling without explaining workarounds
- Features outside the 13 SpellEffect / 19 PerkAction function types
