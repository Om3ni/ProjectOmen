# RPR Ability Design Guide

## Overview
Designing abilities in RPR requires working within **strict function type enums**. Unlike flexible TTRPG systems, RPR abilities are built from **13 predefined SpellEffect types**. This guide teaches you to combine these effects creatively within technical constraints.

**Key Insight**: RPR ability design is about **clever combinations of simple effects**, not writing custom ability behavior. Think Lego blocks, not programming.

## Quick Start: The 13 SpellEffect Types

0. **Print Message** - Display text
1. **Modify Stat** - Change stat value (damage/healing/temp modifiers)
2. **Give Item** - Grant Conan Exiles item
3. **Remove Item** - Take Conan Exiles item
4. **Buff Skill** - Temporary skill bonus
5. **Buff Stat** - Temporary stat bonus
6. **Buff Perk** - Grant perk temporarily
7. **Dispel Buff** - Remove buffs by category
8. **Buff Ability** - Grant ability temporarily
9. **Auto Use Ability** - Trigger another ability
10. **Set Stat** - Set stat to exact value
11. **Buff Grant Status** - Apply status temporarily
12. **Buff Unlock Status** - Allow status temporarily

**Refer to rpr-system-architecture.md for detailed documentation on each effect type.**

## RPR Ability Structure

Every ability has four components:

1. **SpellDef**: Core definition (name, targeting, dice system)
2. **SpellReqDef**: Requirements (stat mins, perks, level) [optional]
3. **SpellTargetCond**: Target filters (who can be targeted) [optional]
4. **SpellEffect**: Effects (1+ from the 13 types)

## Design Process

### Step 1: Define Intent
Start with what the ability should **do**, not how:
- "Deal fire damage to 3 enemies"
- "Heal self and boost armor temporarily"
- "Remove debuffs from ally"

### Step 2: Choose Targeting
**TargetType**:
- 0=Selected (player picks)
- 1=Caster (self-only)
- 2=All (everyone)
- 3=All Others (not self)
- 4=Selected Others (pick excluding self)

**#Targets**: How many (0=unlimited)

### Step 3: Choose Roll System
**CasterRollType**:
- 0=Roll Skill (e.g., Athletics, Arcana)
- 1=Roll Stat (e.g., HP, Attack Power)
- 2=Custom Formula (e.g., `1d20+4*1.0`)

**DCType** (difficulty check):
- 0=Target Roll (target rolls save)
- 1=Target Stat (compare to target stat)
- 2=Fixed (always succeeds/fails)
- 3=Target Roll Stat (both roll stats)
- 4=Custom (complex)

### Step 4: Map to SpellEffects
Choose effects from the 13 types:

**Damage**: Modify Stat (Effect 1), TargetID=HP stat, negative value
**Healing**: Modify Stat (Effect 1), TargetID=HP stat, positive value
**Buff**: Buff Skill/Stat (Effects 4/5), with Duration
**Debuff**: Modify Stat (Effect 1) with Duration + negative value
**Status**: Buff Grant Status (Effect 11)
**Dispel**: Dispel Buff (Effect 7)

### Step 5: Add Conditionals
Every effect has:
- **If**: 0=Always, 1=Crit Only, 2=Non-Crit Only
- **Outcome**: 0=General, 1=Success, 2=Failure
- **Who**: 0=Target, 1=All Targets, 2=Caster

## Common RPR Ability Patterns

### Pattern: Basic Attack
```
SpellDef|100|Sword Slash|...|TargetType=0|#Targets=1|CasterRollType=0|RollStatSkillID=25|DCType=0|...
SpellEffect|100|0|1|1d6+1*1.0|92|0|...|Outcome=1|...  // Success: 1d6+STR damage
```
- Roll Athletics (ID 25) vs target roll
- Success: Modify HP (ID 92) by -(1d6 + 100% of Strength)

### Pattern: Self-Buff
```
SpellDef|101|Shield|...|TargetType=1|CasterRollType=2|DCType=2|FixedDCValue=0|...
SpellEffect|101|2|5|10|94|60|...|Outcome=0|...  // +10 Armor for 60 sec
```
- Self-target, auto-success
- Buff Stat (ID 94 = Armor) by +10 for 60 seconds

### Pattern: AOE Damage
```
SpellDef|102|Fireball|...|TargetType=0|#Targets=3|Range=30|CasterRollType=0|RollStatSkillID=9|DCType=0|...
SpellEffect|102|1|1|3d6|92|0|...|Outcome=1|...  // All targets: 3d6 damage
```
- Roll Arcana (ID 9) vs each target's roll
- All Targets (Who=1) take 3d6 damage (HP stat ID 92)

### Pattern: Healing
```
SpellDef|103|Heal|...|TargetType=0|#Targets=1|CasterRollType=0|RollStatSkillID=16|DCType=2|FixedDCValue=0|...
SpellEffect|103|0|1|2d8+5*1.0|92|0|...|Outcome=0|...  // 2d8+WIS healing
```
- Roll Medicine (ID 16), auto-success
- Modify HP by +2d8 + 100% of Wisdom (ID 5)

### Pattern: Buff + Debuff (Trade-off)
```
SpellDef|104|Rage|...|TargetType=1|DCType=2|...
SpellEffect|104|2|4|5|1|60|...|...  // Self: +5 STR for 60 sec
SpellEffect|104|2|5|-3|94|60|...|...  // Self: -3 Armor for 60 sec
```

### Pattern: Status Application
```
SpellDef|105|Poison Strike|...|TargetType=0|#Targets=1|CasterRollType=0|RollStatSkillID=23|DCType=0|...
SpellEffect|105|0|1|1d4|92|0|...|Outcome=1|...  // 1d4 damage
SpellEffect|105|0|11|10|30|...|Outcome=1|...  // Apply "Poisoned" status for 30 sec
```

### Pattern: Critical Effects
```
SpellDef|106|Critical Strike|...|EnableCriticalRolls=t|...
SpellEffect|106|0|1|1d6+1*1.0|92|0|...|If=2|Outcome=1|...  // Non-crit: 1d6+STR
SpellEffect|106|0|1|3d6+1*2.0|92|0|...|If=1|Outcome=1|...  // Crit: 3d6+2×STR
```

### Pattern: Dispel
```
SpellDef|107|Dispel Magic|...|TargetType=0|#Targets=1|CasterRollType=0|RollStatSkillID=9|DCType=1|RollStatSkillID=5|...
SpellEffect|107|0|7|Magic|...|Outcome=1|...  // Success: Remove "Magic" buffs
```

## Damage Scaling Guidelines

### Base Damage by Tier

| Tier | Dice | Avg Damage | Mana Cost | Example |
|------|------|-----------|----------|---------|
| Cantrip | 1d4-1d6 | 2.5-3.5 | 0 | Basic stab |
| Common | 1d6-2d6+2 | 5-9 | 10-15 | Power strike |
| Uncommon | 2d6-3d6+4 | 11-14.5 | 20-30 | Flaming sword |
| Rare | 3d6-5d6+6 | 16.5-23.5 | 40-60 | Lightning bolt |
| Legendary | 6d6-10d6 | 21-35 | 80-150 | Meteor |

### AOE Damage Reduction
Per-target damage when hitting multiple:
- 3 targets: 70% (e.g., 3d6 instead of 4d6)
- 5 targets: 60% (e.g., 2d6+2 instead of 4d6)
- 8+ targets: 50% (e.g., 2d6 instead of 4d6)

### Stat Scaling Formulas
Reference skills in formulas:
```
1d6+1*1.0        // 1d6 + 100% of Skill ID 1 (Strength)
2d6+4*0.5        // 2d6 + 50% of Skill ID 4 (Intelligence)
3d8+1*1.0;5*0.5  // 3d8 + STR + 50% of WIS
```

**Cannot reference**:
- Current stat values
- Other character variables
- Conditional expressions

## Cooldown vs Cost Balance

**Cooldowns**: Real-world minutes (not turns!)
- 0 = No cooldown (limited by mana/stamina)
- 1-5 min = Tactical abilities
- 10+ min = Ultimate abilities

**Trade-off**:
- High cost + No cooldown = Spam-limited
- Low cost + Long cooldown = Powerful but rare

**Examples**:
- Fireball: 30 mana, 0 cooldown
- Meteor: 10 mana, 10-min cooldown
- Basic Attack: 0 cost, 0 cooldown

## Buff Duration Guidelines

| Duration | Use Case | Example |
|----------|----------|---------|
| 30-60 sec | Combat buffs | +5 STR (one fight) |
| 3-5 min | Short utility | Water breathing |
| 10-30 min | Long buffs | Quest buffs |
| 1+ hour | Semi-permanent | Potion effects |
| 999999 sec | Permanent until dispelled | Curse |

**Combat Math**: Average fight = 30-60 seconds (5-10 rounds at 6 sec/round)

## Ability Cost Formula

Base: `(Avg Damage × Targets) / Efficiency Factor`

**Efficiency Factors**:
- Direct damage: 2.0×
- Healing: 3.0×
- Buffs: 4.0×
- Utility/CC: 5.0×

**Example**:
```
Fireball: 3d6 (avg 10.5) × 3 targets = 31.5 total
Cost: 31.5 / 2.0 = 15.75 → Round to 15-20 mana
```

## RPR Constraints

### What You CANNOT Do
❌ Write custom ability logic ("if HP < 50%, double damage")
❌ Reference current stat values in formulas
❌ Create new SpellEffect types beyond the 13
❌ Use turn-based cooldowns (only real-time minutes)
❌ Dynamically target "lowest HP ally" or conditional targeting

### What You CAN Do
✅ Combine 13 effect types creatively
✅ Use conditionals (If, Outcome, Who)
✅ Reference skills in formulas (but not stats)
✅ Apply multiple effects per ability
✅ Create combo abilities (Auto Use Ability)
✅ Use requirements and target filters

## Common Mistakes

### Mistake 1: Overpowered Healing
**Problem**: Heal restores more HP than damage deals
**Fix**: Healing efficiency = 60-70% of damage equivalent
```
Bad:  Heal 50 HP for 10 mana (enemies deal 20 damage for 10 stamina)
Good: Heal 30 HP for 10 mana
```

### Mistake 2: Forgetting Outcome Field
**Problem**: Damage applies even on miss
**Fix**: Set Outcome=1 (Success Effect)
```
Bad:  SpellEffect|...|Outcome|0|... (always applies)
Good: SpellEffect|...|Outcome|1|... (success only)
```

### Mistake 3: Infinite Buff Stacking
**Problem**: +5 STR buff stacks infinitely
**Fix**: Set DiceConfig.MaxAttributeBuff cap + use buff categories
```
DiceConfig: MaxAttributeBuff=10
Buff: Category="Strength Buffs"
Result: Max +10 STR from all buffs combined
```

### Mistake 4: Using Wrong TargetID
**Problem**: Reference Stat ID when should reference Skill ID
**Fix**: Check schema - formulas reference Skills, not Stats
```
Bad:  1d6+92*1.0  // ID 92 is HP (Stat), can't reference in formula
Good: 1d6+1*1.0   // ID 1 is Strength (Skill), correct
```

## Testing Checklist

Before finalizing an ability:

- [ ] CasterRollType matches intent (skill/stat/formula)
- [ ] DCType matches resistance type
- [ ] Effects use correct Who field (target/all/caster)
- [ ] Damage effects use Outcome=1 (success only)
- [ ] Buffs have Duration + Category fields filled
- [ ] TargetID references valid Skill/Stat/Perk/Status/SpellDef
- [ ] Formulas only reference Skills (ID 1-99 range typically)
- [ ] Cooldown balanced vs cost
- [ ] Requirements prevent abuse
- [ ] Message effects provide feedback

## Advanced Techniques

### Combo Abilities (Effect 9)
Chain abilities:
```
SpellDef|200|Blade Dance|Three-hit combo|...
SpellEffect|200|0|9|201|... // Trigger Hit 1
SpellDef|201|Hit 1|...
SpellEffect|201|0|1|1d6|92|...
SpellEffect|201|0|9|202|... // Trigger Hit 2
```

### Transformation (Effect 6)
Use Buff Perk to grant temporary perk tree:
```
PerkDef|300|f|Wolf Form|...|0|
PerkAction|300|8|0|301|...  // Grant Bite
PerkAction|300|8|0|302|...  // Grant Claw
PerkAction|300|4|2|2|...    // +2 DEX

SpellDef|304|Wildshape|...|...
SpellEffect|304|2|6|300|120|... // Grant Wolf Form for 2 min
```

### Reactive Abilities (Mutator + Effect 9)
Trigger abilities on conditions:
```
MutatorDef|400|Counter Attack|...|...
MutatorCondition|400|0|20|...|Taking Damage status
MutatorAction|400|3|401|... // Grant Counter ability when damaged

SpellDef|401|Counter|...|...
SpellEffect|401|0|1|1d6|92|... // Automatic counter
```

## Summary

RPR ability design is **constrained but creative**:
- Work within 13 SpellEffect types
- Combine effects for complexity
- Use conditionals (If, Outcome, Who)
- Balance costs (mana, cooldowns, requirements)
- Respect DiceConfig caps
- Test edge cases

**Key Resources**:
- rpr-system-architecture.md: Full RPR technical reference
- spell-templates.json: Example ability designs
- class-archetypes.json: Role-based ability patterns

**Remember**: RPR is data configuration, not programming. Master the 13 effect types and you can build any ability!
