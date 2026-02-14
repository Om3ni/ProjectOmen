# RPR Perk Design Guide

## Overview
In RPR, perks are built from **19 predefined PerkAction function types**. Unlike flexible TTRPG systems, you cannot write custom perk behavior—you configure existing functions. This guide teaches you to design compelling perk trees within RPR's technical constraints.

**Key Insight**: RPR perk design is about **clever combinations of PerkAction types** and **category-based progression gates**, not programming custom effects.

**Refer to rpr-system-architecture.md for complete technical specifications.**

## Quick Start: The 19 PerkAction Types

0. **Allow Skill** - Unlock skill for allocation
1. **Deny Skill** - Block skill allocation
2. **Allow Perk** - Unlock another perk (prerequisite)
3. **Deny Perk** - Block another perk (mutual exclusion)
4. **Dice Modifier** - Modify attribute/skill rolls
5. **Give Feat** - Legacy (unused in modern RPR)
6. **Grant Stat** - Give a derived stat
7. **Stat Modifier** - Permanent stat bonus
8. **Grant Ability** - Give spell/ability permanently
9. **Grant Status** - Apply permanent status
10. **Unlock Status** - Allow status to be applied
11. **Grant Perk** - Give another perk (auto-grant)
12. **Grant Sudo Role** - Admin permissions (rarely used)
13. **Allow Perk Category** - Unlock entire perk category
14. **Deny Perk Category** - Block entire perk category
15. **Teach Language** - Conan Exiles language system
16. **Give CharTag** - Apply character tag
17. **Set Float CharVar** - Set numeric variable
18. **Set String CharVar** - Set text variable

**Most Important**: Functions 0-4, 7-11, 13-14 (core progression mechanics)

## RPR Perk Structure

Every perk has two components:

1. **PerkDef**: Definition (name, cost, category, visibility)
2. **PerkAction**: Effects (1+ actions from the 19 types)

**Structure**:
```
PerkDef|ID|Public|Name|Description|Cost|Category
PerkAction|PerkID|Function|TargetType|TargetID|SecondTargetID|StringArg|Value
```

## Perk Point System (DiceConfig)

**DiceConfig Fields**:
- **PerkPoints**: Total pool for perk purchases (e.g., 15-25)
- Perks cost points defined in PerkDef.Cost
- No native leveling—perks purchased during character creation or via admin grant

**Cost Guidelines**:
| Cost | Power Level | Example |
|------|-------------|---------|
| 0 | Free (racial/background) | Human versatility trait |
| 1 | Minor bonus | +1 to one attribute |
| 2-3 | Moderate bonus | +5% to skill group, unlock training |
| 4-5 | Significant bonus | +10 HP, grant simple ability |
| 6-8 | Build-defining | Grant powerful ability, major stat boost |
| 10+ | Capstone | Transformation, ultimate ability |

**Design Pattern**: Start with pool of 15-20 points
```
DiceConfig: PerkPoints=15
- 3× Tier 1 perks (5 points spent)
- 2× Tier 2 perks (6 points spent)
- 1× Tier 3 perk (4 points spent)
Total: 15 points
```

## Categories: The Core of Perk Trees

**Categories** (string field in PerkDef) enable progression gates:

**Pattern 1: Linear Progression**
```
PerkDef|1|t|Novice Fighter|Entry to Fighter path|0|Class
PerkAction|1|13|0|0|Subclass||0.0  // Allow "Subclass" category
PerkAction|1|14|0|0|Class||0.0     // Deny "Class" (force choice)

PerkDef|2|t|Weapon Master|Specialize in weapons|2|Subclass
PerkAction|2|14|0|0|Subclass||0.0  // Deny other subclasses
PerkAction|2|13|0|0|Advanced||0.0  // Allow "Advanced" perks
```

**Pattern 2: Racial/Background Template**
```
PerkDef|10|t|Human|Versatile race|0|Races
PerkAction|10|4|1|1|||2.0     // +2 to Strength rolls
PerkAction|10|4|1|6|||1.0     // +1 to Charisma rolls
PerkAction|10|13|0|0|Class||0.0  // Unlock "Class" perks

PerkDef|11|t|Elf|Agile and magical race|0|Races
PerkAction|11|4|1|2|||2.0     // +2 to Dexterity rolls
PerkAction|11|4|1|4|||1.0     // +1 to Intelligence rolls
PerkAction|11|13|0|0|Class||0.0  // Unlock "Class" perks
```

**Pattern 3: Mutual Exclusion**
```
PerkDef|20|t|Heavy Armor Training|Wear plate armor|3|Armor
PerkAction|20|7|10|94|||5.0     // +5 Armor stat
PerkAction|20|3|0|21||0.0       // Deny Light Armor perk

PerkDef|21|t|Light Armor Training|Wear leather armor|3|Armor
PerkAction|21|7|10|325|||3.0    // +3 Initiative
PerkAction|21|3|0|20||0.0       // Deny Heavy Armor perk
```

## Common PerkAction Patterns

### Pattern: Attribute/Skill Bonus (Function 4)
```
PerkDef|30|t|Mighty|Increase strength|2|General
PerkAction|30|4|1|1|||2.0  // +2 to Strength rolls
```
**TargetType Enum**:
- 0=Target Entity (unused in perks)
- 1=Specific Attribute/Skill (TargetID = Skill ID)
- 2=All Attributes
- 3=All Skills

### Pattern: Stat Boost (Function 7)
```
PerkDef|40|t|Tough|Increase health|3|General
PerkAction|40|7|10|92|||10.0  // +10 to HP stat (ID 92)
```
**Usage**: Permanent modifier to derived stats (HP, Mana, Armor, etc.)

### Pattern: Grant Ability (Function 8)
```
PerkDef|50|t|Fireball|Learn Fireball spell|5|Magic
PerkAction|50|8|0|100|||0.0  // Grant SpellDef ID 100
```
**Usage**: Unlock spells/abilities for use

### Pattern: Unlock Skill Training (Function 0)
```
PerkDef|60|t|Rogue Training|Learn stealth skills|2|Class
PerkAction|60|0|0|15|||0.0  // Allow Stealth skill (ID 15)
PerkAction|60|0|0|18|||0.0  // Allow Lockpicking skill (ID 18)
```
**Usage**: Allow allocation of points to skills that require training

### Pattern: Grant Status (Function 9)
```
PerkDef|70|t|Blessed|Divine favor|4|Divine
PerkAction|70|9|0|10|||0.0  // Grant "Blessed" status (ID 10)
```
**Usage**: Permanent status effects (buffs that don't expire)

### Pattern: Combo (Multiple Functions)
```
PerkDef|80|t|Battle Mage|Hybrid warrior-mage|6|Advanced
PerkAction|80|4|1|1|||1.0     // +1 Strength
PerkAction|80|4|1|4|||1.0     // +1 Intelligence
PerkAction|80|7|10|93|||10.0  // +10 Mana
PerkAction|80|8|0|150|||0.0   // Grant "Arcane Strike" ability
```
**Usage**: Build-defining perks with multiple benefits

### Pattern: Auto-Grant (Function 11)
```
PerkDef|90|t|Elven Heritage|Elven racial package|0|Racial
PerkAction|90|11|0|91|||0.0  // Auto-grant "Elven Vision" perk
PerkAction|90|11|0|92|||0.0  // Auto-grant "Forest Affinity" perk
```
**Usage**: Bundle perks together (selecting one gives others free)

## RPR Perk Constraints

### What You CAN Do
✅ Modify attribute/skill rolls permanently (Function 4)
✅ Grant permanent stat bonuses (Function 7)
✅ Unlock abilities permanently (Function 8)
✅ Apply permanent status effects (Function 9)
✅ Create prerequisite chains (Function 2: Allow Perk)
✅ Build perk trees via categories (Functions 13-14)
✅ Allow/deny skill training (Functions 0-1)
✅ Create mutually exclusive perks (Function 3: Deny Perk)
✅ Auto-grant perk bundles (Function 11)

### What You CANNOT Do
❌ Write custom perk logic ("if HP < 50%, gain effect")
❌ Create temporary or duration-based perk effects (perks are permanent)
❌ Reference current stat values or character state
❌ Create percentage bonuses directly (only flat modifiers via Function 4)
❌ Invent new PerkAction types beyond the 19
❌ Apply conditional modifiers (use Mutators for that)
❌ Trigger effects on events (on hit, on kill, etc.)

**Critical**: Perks are **permanent character modifiers**, not **conditional effects**. For conditional bonuses, use Mutators + Statuses.

## Building Perk Trees

### Method 1: Category-Based Progression (Recommended)
Use categories + Allow/Deny functions to create gated progression:

**Example: Fighter → Subclass → Advanced**
```
// Step 1: Racial choice (free, unlocks "Class")
PerkDef|1|t|Human|Versatile human|0|Races
PerkAction|1|13|0|0|Class||0.0  // Unlock "Class" category

// Step 2: Class choice (consumes "Class", opens "Subclass")
PerkDef|10|t|Fighter|Warrior class|0|Class
PerkAction|10|14|0|0|Class||0.0      // Deny other classes
PerkAction|10|13|0|0|Subclass||0.0   // Unlock "Subclass"
PerkAction|10|7|10|92|||20.0         // +20 HP

// Step 3: Subclass choices (mutually exclusive)
PerkDef|20|t|Duelist|Agile fighter|3|Subclass
PerkAction|20|14|0|0|Subclass||0.0   // Deny other subclasses
PerkAction|20|13|0|0|Advanced||0.0   // Unlock "Advanced"
PerkAction|20|4|1|2|||3.0            // +3 DEX

PerkDef|21|t|Knight|Armored tank|3|Subclass
PerkAction|21|14|0|0|Subclass||0.0   // Deny other subclasses
PerkAction|21|13|0|0|Advanced||0.0   // Unlock "Advanced"
PerkAction|21|7|10|94|||8.0          // +8 Armor

// Step 4: Advanced perks (available after subclass)
PerkDef|30|t|Weapon Master|Master combat|5|Advanced
PerkAction|30|4|1|25|||5.0           // +5 to Combat skill
```

**Advantages**:
- Clean progression gates
- Prevents taking incompatible perks
- Easy to add new branches

### Method 2: Direct Prerequisites (Function 2)
Link perks directly:

```
PerkDef|100|t|Basic Strike|Learn basic attack|2|Combat
PerkAction|100|8|0|200|||0.0  // Grant ability ID 200

PerkDef|101|f|Power Strike|Requires Basic Strike|4|Combat
PerkAction|101|2|0|100|||0.0  // Allow this perk (prerequisite)
PerkAction|101|8|0|201|||0.0  // Grant ability ID 201

PerkDef|102|f|Cleave|Requires Power Strike|6|Combat
PerkAction|102|2|0|101|||0.0  // Prerequisite chain
PerkAction|102|8|0|202|||0.0  // Grant ability ID 202
```

**Note**: Public='f' hides perk until prerequisite unlocked

**Advantages**:
- Explicit perk chains
- Fine-grained control

**Disadvantages**:
- More verbose (one Allow Perk per prerequisite)
- Doesn't prevent similar perks from other trees

### Method 3: Hybrid (Recommended for Complex Systems)
Combine both methods:
- Categories for major branches (Race, Class, Subclass)
- Direct prerequisites for specific chains within branches

## Design Patterns

### Pattern: Race → Class → Subclass
Standard character creation flow:
```
1. Choose Race (free, Category="Races")
   → Unlocks "Class" category via Allow Perk Category

2. Choose Class (0-2 cost, Category="Class")
   → Denies other classes via Deny Perk Category
   → Unlocks "Subclass" category
   → Grants baseline abilities/stats

3. Choose Subclass (3-5 cost, Category="Subclass")
   → Denies other subclasses
   → Defines playstyle
   → Unlocks "Advanced" perks

4. Purchase Advanced perks (variable cost, Category="Advanced")
   → Customization within subclass
```

### Pattern: General Perks (Always Available)
```
PerkDef|200|t|Tough|Increase HP|2|General
PerkAction|200|7|10|92|||15.0

PerkDef|201|t|Quick|Increase Initiative|2|General
PerkAction|201|7|10|325|||3.0
```
**Usage**: Generic perks with no category restrictions

### Pattern: Scaling Perks (Tiered)
```
PerkDef|300|t|Weapon Training I|Basic training|1|Combat
PerkAction|300|4|1|25|||2.0  // +2 to Combat skill

PerkDef|301|t|Weapon Training II|Advanced training|3|Combat
PerkAction|301|2|0|300|||0.0  // Requires Weapon Training I
PerkAction|301|4|1|25|||5.0  // +5 total (replaces, doesn't stack)

PerkDef|302|t|Weapon Mastery|Master training|6|Combat
PerkAction|302|2|0|301|||0.0  // Requires Weapon Training II
PerkAction|302|4|1|25|||10.0  // +10 total
```

**Note**: RPR perks don't "upgrade"—later perks must include full bonus if you want replacement behavior. Use prerequisites to enforce linear progression.

### Pattern: Mutually Exclusive Paths
```
PerkDef|400|t|Light Armor|Dodge-focused|3|Armor
PerkAction|400|3|0|401|||0.0  // Deny Heavy Armor
PerkAction|400|7|10|501|||10.0  // +10 to Dodge% stat

PerkDef|401|t|Heavy Armor|Defense-focused|3|Armor
PerkAction|401|3|0|400|||0.0  // Deny Light Armor
PerkAction|401|7|10|94|||8.0  // +8 Armor Stat
```

## Common Mistakes

### Mistake 1: Expecting Percentage Bonuses
**Problem**: Try to create "+20% damage" perk
**Reality**: Function 4 (Dice Modifier) adds flat values to rolls, not percentages
**Fix**: Use flat bonuses to skills/attributes:
```
Bad:  (Can't do "+20% damage" directly)
Good: PerkAction|X|4|1|1|||3.0  // +3 to Strength (affects damage formulas)
```

### Mistake 2: Temporary Perk Effects
**Problem**: Want perk that grants buff for 60 seconds
**Reality**: Perks are permanent character modifiers
**Fix**: Use abilities or mutators for temporary effects:
```
Bad:  PerkAction with Duration field (doesn't exist)
Good: Grant an ability (Function 8) that applies temporary buff
```

### Mistake 3: Conditional Perks
**Problem**: Want "+5 damage when HP > 50%"
**Reality**: PerkAction cannot check conditions
**Fix**: Use Mutators for conditional logic:
```
Bad:  PerkAction with conditional (not possible)
Good:
  Perk grants Status (Function 9)
  Mutator checks Status + HP condition → applies modifier
```

### Mistake 4: Forgetting to Block Categories
**Problem**: Player can select multiple class perks
**Fix**: Always Deny Category after selection:
```
PerkDef|10|t|Fighter|Warrior class|0|Class
PerkAction|10|14|0|0|Class||0.0  // CRITICAL: Deny "Class" category
```

### Mistake 5: Not Unlocking Next Tier
**Problem**: Player stuck after choosing class
**Fix**: Allow next category:
```
PerkAction|10|13|0|0|Subclass||0.0  // Unlock progression
```

### Mistake 6: Orphaned Perk IDs
**Problem**: Using TargetID that doesn't exist (e.g., perk 999 not in schema)
**Fix**: Always validate TargetID references:
- Function 0/1: TargetID = SkillDef ID
- Function 2/3: TargetID = PerkDef ID
- Function 4: TargetID = SkillDef ID (if TargetType=1)
- Function 7: TargetType enum + TargetID = Stat ID
- Function 8: TargetID = SpellDef ID
- Function 9/10: TargetID = StatusDef ID
- Function 11: TargetID = PerkDef ID

## Testing Checklist

Before finalizing perk system:
- [ ] DiceConfig.PerkPoints matches total available points
- [ ] All racial/background perks cost 0 and unlock "Class"
- [ ] Class perks Deny "Class" category and Allow "Subclass"
- [ ] Subclass perks Deny "Subclass" and Allow "Advanced"
- [ ] Mutually exclusive perks use Deny Perk (Function 3)
- [ ] All TargetIDs reference valid entries (Skills, Stats, Abilities, Statuses, Perks)
- [ ] Prerequisites form valid chains (no circular references)
- [ ] Hidden perks (Public='f') have Allow Perk actions to unlock them
- [ ] Perk costs scale with power (0=free, 1-2=minor, 3-5=moderate, 6-10=major)
- [ ] No perks are strictly superior to others at same cost
- [ ] Total perk options > PerkPoints pool (player must make choices)

## Summary

RPR perk design is **category-driven configuration**:
- 19 PerkAction function types (fixed, cannot invent new ones)
- Categories + Allow/Deny functions create perk trees
- Perks are permanent modifiers (no durations, no conditionals)
- Use Mutators for conditional effects
- Use Statuses as perk-granted flags
- Prerequisites via Allow Perk or category unlocking

**Key Resources**:
- rpr-system-architecture.md: Complete PerkAction reference
- class-archetypes.json: Example perk trees by role

**Remember**: RPR perks are data configuration, not programming. Master the 19 PerkAction types and category system to build rich progression!
