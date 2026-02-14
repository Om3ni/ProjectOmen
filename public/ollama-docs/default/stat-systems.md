# RPR Stat Systems Guide

## Overview
In RPR, the stat system is built on two distinct layers:
1. **Attributes & Skills** (SkillDef table) - Direct player allocation
2. **Derived Stats** (Stat table) - Calculated from formulas

**Critical Understanding**: RPR uses a **single table (SkillDef)** for both attributes and skills, distinguished by the `TypeFlag` field. This is a fundamental architectural constraint that shapes how you design your system.

**Refer to rpr-system-architecture.md for detailed technical specifications.**

## SkillDef: Attributes vs Skills

### TypeFlag='t': Attributes
**Attributes** are primary stats that players allocate points to directly.

**Structure**:
```
SkillDef|t|ID|Name|Description|f|Category|Bonus Source||BonusFunction|Public|Trained
SkillDef|t|1|Strength|Physical power|f|-1||0|t|0
```

**Key Fields**:
- `TypeFlag='t'`: Marks as attribute
- `Bonus Source`: Empty (players allocate directly)
- `Category=-1`: No category (attributes stand alone)
- `Public='t'`: Visible on character sheet
- `Trained=0`: Not trained (fixed value)

**Design Pattern**: Create 3-6 attributes as foundation
```
Strength (ID 1)    // Physical power
Dexterity (ID 2)   // Agility, reflexes
Constitution (ID 3) // Endurance, health
Intelligence (ID 4) // Mental acuity, magic
Wisdom (ID 5)      // Perception, willpower
Charisma (ID 6)    // Social influence
```

### TypeFlag='f': Skills
**Skills** are derived from attributes via formulas.

**Structure**:
```
SkillDef|f|ID|Name|Description|f|Category|Bonus Source|0|BonusFunction|Public|Trained
SkillDef|f|10|Athletics|Physical prowess|f|-1|1*1.0|0|t|0
```

**Key Fields**:
- `TypeFlag='f'`: Marks as skill
- `Bonus Source`: Formula referencing attributes (e.g., `1*1.0` = 100% of STR)
- `BonusFunction`: How to combine multiple sources (Sum/Average/Min/Max)
- `Public='t'`: Show on sheet
- `Trained='t'/'f'`: Requires training to use?

**RPR Formula Syntax**:
```
SkillID*Multiplier;SkillID*Multiplier;...
```

**Examples**:
```
Athletics: 1*1.0           // 100% Strength
Acrobatics: 2*1.0          // 100% Dexterity
Fortitude Save: 3*1.0      // 100% Constitution
Medicine: 5*1.0            // 100% Wisdom
Crafting: 4*1.0            // 100% Intelligence
Diplomacy: 6*1.0           // 100% Charisma

// Multi-attribute skills
Best Attack Mod: 1*1.0;2*1.0;4*1.0;5*1.0;6*1.0   // With BonusFunction=3 (Max)
Hybrid Mod: 1*0.5;2*0.5    // 50% STR + 50% DEX (average build)
```

### BonusFunction Enum (How Formulas Combine)
- **0: Sum** - Add all sources (most common)
- **1: Average** - Average all sources
- **2: Take Min** - Use lowest value
- **3: Take Max** - Use highest value

**Example Use Cases**:
```
// Sum: Athletics = STR + Equipment Bonus + Buff
SkillDef|f|10|Athletics|...|1*1.0|0|...

// Max: Best Attack Mod = Highest of STR/DEX/INT/WIS/CHA
SkillDef|f|50|Best Attack|...|1*1.0;2*1.0;4*1.0;5*1.0;6*1.0|3|...
```

## Point Allocation System (DiceConfig)

RPR point allocation is controlled by **DiceConfig** fields:

### Point Pools
```
DiceConfig Fields:
- AttributePoints: Pool for attributes (e.g., 27)
- SkillPoints: Pool for skills (e.g., 15)
- PerkPoints: Pool for perks (e.g., 10)
```

### Allocation Limits
```
- MaxAttributeAllocation: Per-attribute cap (e.g., 5)
- MaxSkillAllocation: Per-skill cap (e.g., 10)
- MinAttributeAllocation: Per-attribute floor (e.g., -3)
- MinSkillAllocation: Per-skill floor (e.g., 0)
```

**Design Pattern**: Start all attributes at 0, give pool to allocate
```
DiceConfig: AttributePoints=27, MaxAttributeAllocation=5
Result: Players distribute 27 points, max 5 per attribute
```

### Point Buy System (Escalating Costs)

Enable with `AttributePointBuy='t'` or `SkillPointBuy='t'`

**Fixed Formula** (hardcoded in game engine):
```
0→1 = 1 point
1→2 = 1 point
2→3 = 2 points
3→4 = 3 points
4→5 = 4 points
5→6 = 5 points, etc.
```

**Example**:
```
DiceConfig: AttributePointBuy='t', AttributePoints=27
Player wants STR=5, DEX=3, CON=4, INT=2, WIS=2, CHA=0:
- STR 0→5: 1+1+2+3+4 = 11 points
- DEX 0→3: 1+1+2 = 4 points
- CON 0→4: 1+1+2+3 = 7 points
- INT 0→2: 1+1 = 2 points
- WIS 0→2: 1+1 = 2 points
- CHA 0: 0 points
Total: 11+4+7+2+2 = 26 points (1 remaining)
```

**This formula is NOT customizable** - it's baked into RPR's code.

## Derived Stats (Stat Table)

**Derived stats** are calculated from formulas referencing skills/attributes.

### Stat Structure
```
Stat|ID|Name|Public|Show|Active|Base|Floor|Scale|BonusFunction|Formula|Display|Trainable
Stat|92|HP|t|t|f|100|0|1.0|0|3*10|f|f
```

**Key Fields**:
- **Formula**: Weighted sum of skills (e.g., `3*10` = 10× CON)
- **Base**: Starting value before formula
- **Floor**: Minimum value (after all calculations)
- **Scale**: Final multiplier
- **BonusFunction**: How to combine formula + modifiers (0=Sun, 1=Avg, 2=Min, 3=Max)

### Calculation Order
```
1. FormulaResult = Σ(SkillValue * Multiplier) combined via BonusFunction
2. Total = (Base + FormulaResult) * Scale
3. FinalValue = max(Total, Floor)
```

### Common Derived Stats

#### Health Points
```
Stat|92|HP|t|t|f|100|1|1.0|0|3*10|f|f
// Base=100, Formula=CON×10
// Example: CON=5 → HP = (100 + 5×10) × 1.0 = 150
```

**Design Pattern**: Scale HP by Constitution
```
Low HP: 3*5   (CON × 5)
Medium HP: 3*10  (CON × 10)
High HP: 3*15   (CON × 15)
```

#### Mana/Stamina
```
Stat|93|Mana|t|t|f|50|0|1.0|0|4*8;5*2|f|f
// Base=50, Formula=INT×8 + WIS×2
// Example: INT=10, WIS=5 → Mana = (50 + 80 + 10) × 1.0 = 140
```

**Design Pattern**: Multiple attribute sources
```
Mana: 4*8;5*2      // 80% INT, 20% WIS
Stamina: 1*5;3*5   // 50% STR, 50% CON
```

#### Armor Class
```
Stat|94|Armor|t|t|f|10|0|1.0|0|2*1.0;854*1.0|f|f
// Base=10, Formula=DEX×1.0 + ArmorMod×1.0
// ArmorMod comes from gear/perks
```

#### Attack Power
```
Stat|245|Attack Power|t|f|f|0|0|1.0|0|1*1.0;620*1.0|f|f
// Formula=STR×1.0 + GenDamageMod×1.0
// GenDamageMod is hidden skill modified by perks
```

#### Initiative
```
Stat|325|Initiative|t|f|f|0|0|1.0|0|2*1.0|f|f
// Formula=DEX×1.0
// Determines turn order in combat
```

## RPR Formula Constraints

### What You CAN Do
✅ Reference any SkillDef (attribute or skill) by ID
✅ Apply fixed multipliers (e.g., `1*2.5` = 250% of STR)
✅ Combine multiple skills (e.g., `1*1.0;2*0.5` = STR + 50% DEX)
✅ Use BonusFunction (Sum/Avg/Min/Max) to choose combination method
✅ Set Base value for starting points
✅ Apply Scale multiplier to final result
✅ Set Floor for minimum values

### What You CANNOT Do
❌ Reference Stat values in formulas (only Skills/Attributes)
❌ Use conditional formulas (`if STR > 10, use 2*STR`)
❌ Use math operations beyond multiplication (`(STR + DEX) / 2`)
❌ Reference character current HP, buffs, status, etc.
❌ Use dice notation in formulas (1d6, 2d8+4)
❌ Apply caps/ceilings (only floors)
❌ Create dynamic formulas based on equipment/conditions

**Why This Matters**:
Formulas are **static calculations**, not runtime logic. They recalculate when underlying skills change, but cannot adapt based on context.

## Hidden Skills (Internal Calculations)

Create skills with `Public='f'` for internal use:

```
SkillDef|f|620|GenDamageMod||f|-1||0|f|0
```

**Use Cases**:
- Damage modifiers referenced by abilities
- Intermediate calculations for complex stats
- Placeholders modified by perks/mutators

**Example Pattern**:
```
// Hidden skill: BestAttackMod
SkillDef|f|2152|BestAttackMod||f|-1|1*1.0;2*1.0;4*1.0;5*1.0;6*1.0|0|f|3

// Ability references this skill in damage formula
SpellEffect|...|1d6+2152*1.0|...  // Damage = 1d6 + highest attribute
```

## Buff/Debuff System

### Buff Caps (DiceConfig)
```
MaxAttributeBuff: 10    // Total +10 cap on attribute buffs
MaxAttributeDebuff: 10  // Total -10 cap on attribute debuffs
MaxSkillBuff: 10        // Total +10 cap on skill buffs
MaxSkillDebuff: 10      // Total -10 cap on skill debuffs
MaxStatBuff: 10         // Total +10 cap on stat buffs
MaxStatDebuff: 10       // Total -10 cap on stat debuffs
```

**How Caps Work**:
- Sum of ALL buffs cannot exceed cap
- Example: +3 STR buff + +5 STR buff + +4 STR buff = +10 STR (capped, +2 wasted)
- Prevents infinite stacking exploits

### Buff Categories
Organize buffs via Category string for clean dispelling:
```
SpellEffect|...|Category|Strength Buffs|...
SpellEffect|...|Category|Magic Buffs|...
SpellEffect|...|Category|Poison|...
```

## Design Patterns

### Pattern: Class-Based Stat Distribution
```
// Fighter: High STR/CON
AttributePoints=27, recommend: STR=5, CON=4, DEX=3, others=2-3

// Wizard: High INT/WIS
AttributePoints=27, recommend: INT=5, WIS=4, CON=3, others=2-3

// Rogue: High DEX/INT
AttributePoints=27, recommend: DEX=5, INT=4, CON=3, others=2-3
```

### Pattern: Multi-Stat Skills
Allow versatility:
```
// Athletics: Pure STR
SkillDef|f|10|Athletics|...|1*1.0|0|...

// Grappling: STR or DEX (player choice via allocation)
SkillDef|f|50|Grapple Mod|...|1*1.0;2*1.0|3|...  // BonusFunction=3 (Max)
```

### Pattern: Graduated Stat Scaling
```
// Low-tier: HP = CON × 5
Stat|92|HP|...|3*5|...

// Mid-tier: HP = CON × 10
Stat|92|HP|...|3*10|...

// High-tier: HP = CON × 15
Stat|92|HP|...|3*15|...
```

### Pattern: Hybrid Resource Pools
```
// Mana: 80% INT, 20% WIS
Stat|93|Mana|...|4*8;5*2|...

// Stamina: 50% STR, 50% CON
Stat|277|Stamina|...|1*5;3*5|...
```

## Stat System Progression

RPR has **no native leveling**, so stat progression requires workarounds:

### Option 1: Perk-Based Progression
Create perks that grant stat increases:
```
PerkDef|100|t|Level 1|Base stats|0|Progression
PerkAction|100|7|10|92||...  // +10 HP

PerkDef|101|t|Level 2|Improved stats|0|Progression
PerkAction|101|7|20|92||...  // +20 HP
```

### Option 2: Fixed Scaling
Use high base values and formula multipliers:
```
Stat|92|HP|...|Base=200|Formula=3*20|...
// HP = 200 + CON×20 → CON investment heavily rewarded
```

### Option 3: External Tracking
Track level/XP externally (Discord bot, admin tools), manually grant perks:
```
Admin: "Player reached level 5, grant Level 5 perk"
Perk grants: +50 HP, +30 Mana, +2 STR, +2 DEX
```

**Refer to rpr-system-architecture.md § Leveling and Progression for详细 workarounds.**

## Common Mistakes

### Mistake 1: Referencing Stats in Formulas
**Problem**: Try to create formula like `HP=92*1.0` (reference HP stat in another stat)
**Fix**: Formulas can ONLY reference SkillDef, not Stat
```
Bad:  Stat|100|Armor|...|92*0.1|...  // Can't reference Stat ID 92 (HP)
Good: Stat|100|Armor|...|3*0.5|...   // Reference Skill ID 3 (CON)
```

### Mistake 2: Conditional Formulas
**Problem**: Want "if STR > 10, HP = CON × 15, else HP = CON × 10"
**Fix**: Use mutators for conditional modifiers, not formulas
```
Bad:  (Can't do in RPR)
Good:
  Stat|92|HP|...|3*10|...  // Base formula
  MutatorDef+MutatorAction for conditional +5×CON when STR > 10
```

### Mistake 3: Complex Math in Formulas
**Problem**: Want `HP = (STR + CON) / 2 × 10`
**Fix**: Use weighted sums only
```
Bad:  (STR + CON) / 2 × 10  // Can't do division or parentheses
Good: 1*5;3*5                // 50% STR + 50% CON (weighted sum)
```

### Mistake 4: Ignoring Buff Caps
**Problem**: Allow unlimited +STR buffs
**Fix**: Set `DiceConfig.MaxAttributeBuff=10` and use buff categories

## Testing Checklist

Before finalizing stat system:

- [ ] All attributes (TypeFlag='t') are meaningful for at least 2 builds
- [ ] All skills (TypeFlag='f') have valid formulas referencing attributes
- [ ] Derived stats use formulas that create desired scaling (test at min/max attribute values)
- [ ] Point Buy enabled (`AttributePointBuy='t'`) if using escalating costs
- [ ] Point pools (AttributePoints, SkillPoints) match intended character power
- [ ] Buff/debuff caps set (`MaxAttributeBuff`, etc.) to prevent exploits
- [ ] Hidden skills (`Public='f'`) used for internal calculations
- [ ] No formulas reference Stats (only SkillDef allowed)
- [ ] Floor values prevent negative stats where inappropriate
- [ ] BonusFunction (0=Sum, 3=Max) matches intended behavior

## Summary

RPR stat systems are **formula-driven configuration**:
- One table (SkillDef) for both attributes and skills via TypeFlag
- Formulas are **static weighted sums** (SkillID*Multiplier)
- Derived stats (Stat table) calculated from formulas
- Point Buy uses **fixed escalating costs** (not customizable)
- Buff caps prevent stacking exploits
- No native leveling - use workarounds

**Key Resources**:
- rpr-system-architecture.md: Complete technical reference
- class-archetypes.json: Example stat distributions by role
- WHRpR.txt / SHRpR.txt: Real working systems to study

**Remember**: RPR formulas are calculations, not code. Design within the constraint of weighted sums and you can create rich, balanced stat systems!

## Point Buy Systems

### Standard Point Buy
Players distribute a pool of points across primary stats.

**Recommended values**:
- **Point pool**: 25-30 points for balanced games, 35-40 for heroic
- **Stat minimum**: 3-5 (avoid dump stats being useless)
- **Stat maximum**: 18-20 at creation (allow room for growth)
- **Base value**: All stats start at 8-10, spend points to increase

**Cost curve**:
| Stat Value | Cost (Linear) | Cost (Exponential) |
|------------|---------------|-------------------|
| 8-10       | Free (base)   | Free (base)       |
| 11-12      | 1 per point   | 1 per point       |
| 13-14      | 1 per point   | 2 per point       |
| 15-16      | 1 per point   | 3 per point       |
| 17-18      | 1 per point   | 4 per point       |
| 19-20      | 1 per point   | 5 per point       |

**Linear vs Exponential**:
- **Linear**: Simpler, encourages balanced builds
- **Exponential**: Rewards specialization, discourages min-maxing extremes

### Array Method
Pre-set array of values to assign (e.g., 15, 14, 13, 12, 10, 8).
- **Pros**: Fast, balanced, no math required
- **Cons**: Less customization, multiple characters may feel similar

### Rolling
Random generation (e.g., roll 4d6, drop lowest, six times).
- **Pros**: Exciting, old-school charm
- **Cons**: Wildly unbalanced, can create vastly different power levels

**Recommendation**: Use point buy for tactical games, array for quick-start games.

## Bounded Accuracy Principles

**Bounded accuracy** keeps numbers small and meaningful throughout progression.

**Traditional (unbounded)**:
- Level 1: Attack +2, AC 14, Hit DC 12
- Level 20: Attack +15, AC 28, Hit DC 25
- Problem: At high levels, only specialized characters can hit, miss chance disappears

**Bounded (recommended)**:
- Level 1: Attack +2, AC 14, Hit DC 12
- Level 20: Attack +9, AC 20, Hit DC 18
- Benefit: All levels remain engaging, lower-level threats can still contribute

**Implementation**:
```
Stat Bonus = (StatValue - 10) ÷ 2   // Typical D&D modifier
Max Progression = +Starting Bonus + (Level ÷ 4)   // Slow growth
```

**Why it matters**:
- Keeps math manageable (no adding +47 to rolls)
- Low-level content remains challenging
- Gear and choices matter more than raw level

## Derived Stat Formulas

### Health Points (HP)
How much damage a character can sustain.

**Common formulas**:
```
HP = BaseHP + (CON × HPPerPoint) + (Level × HPPerLevel)
```

**Recommended values**:
- **BaseHP**: 20-30 (starting survival buffer)
- **HPPerPoint**: 2-5 (CON investment reward)
- **HPPerLevel**: 5-10 (growth rate)

**Class variations**:
- **Tank/Warrior**: Higher base, higher growth (30 base, 10/level)
- **Balanced**: Medium (25 base, 7/level)
- **Glass Cannon**: Lower base, lower growth (20 base, 5/level)

### Mana/Resource Pools
Fuel for abilities.

**Common formulas**:
```
Mana = BaseMana + (INT × ManaPerPoint) + (Level × ManaPerLevel)
```

**Recommended values**:
- **BaseMana**: 30-50 (enough for 2-3 starting abilities)
- **ManaPerPoint**: 3-7 (scaling reward)
- **ManaPerLevel**: 5-10 (progression)

**Alternative**: Use Cooldowns instead of mana (simpler, but less resource management depth)

### Armor/Defense
Reduces incoming damage or increases miss chance.

**Damage Reduction**:
```
Damage Taken = Max(1, Incoming Damage - Armor)
```
- **Flat reduction**: Simple, but can make weak attacks useless
- **Percentage reduction**: Scales better, requires more math
  ```
  Damage Taken = Incoming Damage × (1 - ArmorRating ÷ (ArmorRating + 100))
  ```

**Miss Chance (Armor Class)**:
```
AC = BaseAC + DEX Modifier + Armor Bonus + Shield Bonus
```
- **Pros**: Exciting (dodging feels good), no partial damage
- **Cons**: Swingy (can be hit 5 times in a row by chance)

**Recommendation**: Use AC for fast-paced combat, DR for tactical depth.

### Critical Hit Systems
Bonus damage on lucky hits.

**Simple**:
```
Crit Chance = 5% + (LuckStat × 0.5%)
Crit Multiplier = 2× damage
```

**Complex**:
```
Crit Chance = Base + (DEX ÷ 10) + BonusFromGear
Crit Damage = NormalDamage × (1.5 + CritDamageStat × 0.05)
```

**Balance considerations**:
- **High crit chance (20%+)**: Reduce multiplier to 1.5×
- **Low crit chance (5-10%)**: Use 2× or higher
- **Avoid** crit chance > 50% (removes tension)

## Stat Growth and Progression

### Levelup Increases
How stats improve over time.

**Fixed increase** (e.g., +1 primary stat every 4 levels):
- **Pros**: Predictable, easy to plan builds
- **Cons**: Less exciting, everyone progresses similarly

**Point pool each level** (e.g., +2 points to spend freely):
- **Pros**: Flexible, players feel agency
- **Cons**: Can lead to min-maxing, harder to balance

**Milestone-based** (e.g., unlock stat increases at specific story points):
- **Pros**: Tied to narrative, feels earned
- **Cons**: Variable progression, harder to predict power levels

**Recommendation**: Use fixed increases for streamlined games, point pools for character customization depth.

### Soft Caps and Diminishing Returns
Prevent stats from scaling infinitely.

**Soft cap**:
```
Effective Stat = Stat (up to cap) + ((Stat - Cap) × 0.5)
```

**Example**:
- Cap at 50: 50 points = 50 effective
- Above cap: 60 points = 50 + (10 × 0.5) = 55 effective (diminishing returns)

**Why use caps**:
- Prevents extreme specialization from being overwhelmingly dominant
- Encourages balanced builds
- Keeps power progression predictable

## Common Stat System Pitfalls

**Avoid these mistakes**:

1. **Dump Stats**: Stats that are useless for most builds
   - *Fix*: Ensure every stat affects multiple important systems

2. **God Stats**: One stat that's always best (e.g., DEX affecting damage, AC, initiative, skills)
   - *Fix*: Spread benefits across multiple stats

3. **Linear Scaling with No Caps**: Stats become infinitely powerful
   - *Fix*: Use soft caps or percentage-based scaling

4. **Too Many Stats**: Overwhelming for players
   - *Fix*: Consolidate (e.g., merge WIS and INT into "Mind")

5. **Opaque Formulas**: Players can't tell how stats help them
   - *Fix*: Show formulas in tooltips, use simple multipliers

## Quick Reference: Stat System Checklist

- [ ] 3-6 primary stats, each impacting multiple systems
- [ ] Clear formulas for all derived stats
- [ ] Point buy system with 25-35 point pool
- [ ] Stat range: 8-20 at creation, 8-25 at max level
- [ ] HP formula: Base + (CON × 2-5) + (Level × 5-10)
- [ ] Mana formula: Base + (INT × 3-7) + (Level × 5-10)
- [ ] Soft caps or diminishing returns above 50-70
- [ ] Bounded accuracy: attack bonuses grow slowly (+0.5 per level)
- [ ] Critical chance: 5-15% base, up to 30% with specialization
- [ ] Defense: AC or DR, not both (avoid complexity)

---

**Remember**: Playtest thoroughly! Numbers look good on paper but may feel different in actual play. Adjust based on player feedback.
