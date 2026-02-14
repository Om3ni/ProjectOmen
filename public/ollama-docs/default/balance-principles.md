# RPR Balance Principles Guide

## Overview
Game balance ensures that all options are viable,no single strategy dominates, and player decisions matter. This guide covers both **RPR-specific implementation details** and **general TTRPG balance principles**.

**Critical Understanding**: RPR has no built-in playtesting metrics or analytics. Balance is achieved through **math-driven design** + **external playtesting** + **iterative tuning**.

**Refer to rpr-system-architecture.md for complete technical specifications.**

## RPR Balance Architecture

### What RPR Provides for Balance
- **Point Pools** (DiceConfig): AttributePoints, SkillPoints, PerkPoints
- **Point Buy Escalating Costs** (hardcoded: 0→1=1pt, 1→2=1pt, 2→3=2pts, etc.)
- **Buff/Debuff Caps** (MaxAttributeBuff, MaxSkillBuff, MaxStatBuff)
- **Formula System** (static weighted sums prevent runaway scaling)
- **Cost Fields** (Mana cost, cooldowns, perk point costs)

### What RPR Does NOT Provide
❌ No win/loss tracking
❌ No pick rate analytics
❌ No damage meters or combat logs
❌ No playtest metrics
❌ No automatic balance adjustments

### RPR-Specific Balance Constraints

#### 1. Point Pool Balance (DiceConfig)
```
DiceConfig Field: AttributePoints=27
Players allocate 27 points across attributes.

With Point Buy enabled:
- Getting one attribute to 5: 1+1+2+3+4 = 11 points
- Getting two attributes to 4: (1+1+2+3)×2 = 14 points
- Result: Encourages balanced builds (can't max everything)
```

**Balance Rule**: Total point pool determines power ceiling
- Low pool (15-20): Low power, simple builds
- Medium pool (25-30): Moderate power, balanced builds
- High pool (35-50): High power, specialized builds

#### 2. Buff/Debuff Caps (Prevents Stacking Exploits)
```
DiceConfig|...|MaxAttributeBuff=10|MaxAttributeDebuff=10|MaxSkillBuff=10|MaxSkillDebuff=10|MaxStatBuff=10|MaxStatDebuff=10|...
```

**Purpose**: Prevents "+100 Strength from 50 buffs"
- Multiple buffs on same stat cap at Max value
- Example: +3 STR buff + +5 STR buff + +4 STR buff = +10 STR (capped, +2 wasted)

**Balance Rule**: Set caps to ~2-3× base attribute value
- Base attribute range: 0-5
- Buff cap: 10
- Max effective attribute: 15 (reasonable ceiling)

#### 3. Formula Constraints (No Exponential Scaling)
RPR formulas are **static weighted sums**:
```
HP Formula: 3*10  // CON × 10
Damage Formula: 1d6+1*1.0  // 1d6 + Strength
```

**What This Means for Balance**:
✅ Linear scaling (predictable power growth)
✅ No compound multipliers (can't do "STR × (1 + bonuses) × (1 + more bonuses)")
✅ Buff stacking is flat addition (not multiplicative)

**Balance Benefit**: Prevents runaway power, makes math tractable

#### 4. Cost Balancing
Every ability/perk has costs in RPR:

**Abilities (SpellDef)**:
- Mana cost (numeric field)
- Cooldown (real-time minutes)
- Requirements (stat minimums, perk prerequisites)

**Perks (PerkDef)**:
- Perk point cost (numeric field)
- Prerequisites (Allow/Deny Perk, category gates)

**Balance Formula** (Ability Power):
```
Power = (Damage × Targets × Success Rate) ÷ (ManaEfficiency × CooldownPenalty)

Where:
- ManaEfficiency = ManaCost ÷ 5
- CooldownPenalty = Cooldown > 0 ? 1 + (Cooldown ÷ 10) : 1

Example:
Fireball: 3d6 damage (avg 10.5), 3 targets, 80% hit rate, 15 mana, 0 cooldown
Power = (10.5 × 3 × 0.8) ÷ (3 × 1) = 25.2 ÷ 3 = 8.4

Basic Attack: 1d6+STR (avg 7), 1 target, 70% hit rate, 0 mana, 0 cooldown
Power = (7 × 1 × 0.7) ÷ (0 × 1) = 4.9 ÷ 0 = ∞ (free ability, lower power acceptable)
```

#### 5. Testing RPR Balance (External Process)
1. **Design** system in editor
2. **Export** to RPR text file
3. **Load** into Conan Exiles server
4. **Playtest** with real players
5. **Track metrics** externally (Discord bot, spreadsheet):
   - Damage per round per build
   - Average combat length
   - Perk selection frequency
   - Build viability (win/loss)
6. **Iterate** in editor based on feedback
7. **Re-export** and test again

**No built-in feedback loop** - all balance iteration is manual.

## General TTRPG Balance Theory

The sections below provide design principles applicable to any TTRPG system:

## Power Budgets

### Concept
Every character/ability/item has an invisible "power budget" - a total amount of power it can have.

**Formula**:
```
Power Budget = Level × BasePower × (1 + Rarity Multiplier)
```

**Example**:
- Level 5 character
- BasePower = 10
- Common rarity = ×1.0
- Total budget: 5 × 10 × 1.0 = 50 points

### Spending the Budget
Allocate budget across categories:

**Offense** (damage output):
- DPS: 1 damage per second = 2 budget
- Burst: 1 damage in one hit = 1.5 budget (less valuable due to timing)

**Defense** (damage mitigation):
- HP: 1 HP = 0.5 budget
- Armor: 1 point reducing 1% of damage = 1 budget

**Utility** (non-combat value):
- Mobility: +10% move speed = 3 budget
- Resource gen: +1 mana/turn = 2 budget
- Crowd control: 1 turn of stun = 10 budget

**Example character** (50 budget):
- 20 budget: 40 damage per turn (offense)
- 15 budget: 30 HP (defense)
- 10 budget: 10 armor (10% damage reduction)
- 5 budget: +25% move speed (utility)

### Adjusting for Weaknesses
Powerful effects should have counterbalancing weaknesses:

**High damage** → Low defense (glass cannon)
**High defense** → Low damage (tank)
**High utility** → Low combat stats (support)

**Balance formula**:
```
Net Power = Strengths - (Weaknesses × 0.7)
```

Weaknesses count for 70% value to encourage specialized builds.

## Niche Protection

### Concept
Each character class, ability, or playstyle should have a unique role where it excels.

**The Trinity**:
- **Tank**: Absorbs damage, protects allies
- **DPS**: Deals damage, defeats enemies
- **Support**: Heals, buffs, controls battlefield

**More granular niches**:
- **Burst DPS**: High damage in short windows
- **Sustained DPS**: Consistent damage over long fights
- **AOE specialist**: Excels against groups
- **Single-target specialist**: Excels against bosses
- **Hybrid**: Flexible, decent at multiple roles

### Avoiding Homogenization
Don't make all options do the same thing:

**Bad**:
- Class A: 50 damage single-target
- Class B: 50 damage single-target with different animation
- Class C: 50 damage single-target with DOT

**Good**:
- Class A: 60 damage single-target, slow
- Class B: 40 damage AOE (3 targets), fast
- Class C: 30 damage + 10 healing, medium speed

### Identifying Niche Overlap
Check for redundancy:

**Questions to ask**:
1. Can this role be fulfilled by another option?
2. Does this choice enable a different playstyle?
3. Is there a situation where this is clearly best?

If all answers are "no", redesign or remove the option.

## Risk vs Reward

### High-Risk, High-Reward
Powerful effects should come with meaningful costs or risks:

**Examples**:
- **Berserker Rage**: +100% damage, but take +50% damage
- **Life Tap**: Convert HP to mana at 1.5× rate
- **All-or-Nothing**: Deal 200% damage on hit, 0% on miss

**Balance rule**:
```
Expected Value = (Reward × Success Rate) - (Cost × Failure Rate)
```

For balance, Expected Value should equal standard options.

**Example**:
- Standard: 50 damage guaranteed
- Risky: 100 damage on 50% hit chance, 0 on miss
- Expected: 100 × 0.5 = 50 (balanced)

### Risk-Averse Options
Some players prefer reliability over ceiling:

**Examples**:
- **Steady Strike**: Always deals 45-55damage (low variance)
- **Sure Shot**: 100% hit chance, moderate damage
- **Protective Stance**: -20% damage dealt, -40% damage taken

**Design tip**: Include both risky and safe options to accommodate player preferences.

## Linear vs Exponential Scaling

### Linear Scaling
Each point of investment gives the same benefit:

**Example**: +10% damage per point invested
- 1 point: 10% (110% total)
- 2 points: 20% (120% total)
- 3 points: 30% (130% total)

**Pros**: Predictable, prevents runaway power
**Cons**: Less exciting, diminishes value of high investment

### Exponential Scaling
Each point multiplies previous value:

**Example**: ×1.1 damage per point invested
- 1 point: ×1.1 (110% total)
- 2 points: ×1.21 (121% total)
- 3 points: ×1.33 (133% total)

**Pros**: Rewards specialization, feels impactful
**Cons**: Can lead to runaway power, hard to balance

### Quadratic Scaling (Balanced Middle Ground)
Benefits increase but with diminishing returns:

**Example**: Benefits follow formula `√(Points × Multiplier)`
- 1 point: 10% bonus
- 4 points: 20% bonus (not 40%)
- 9 points: 30% bonus (not 90%)

**Recommendation**: Use linear for most systems, quadratic for specialization bonuses, avoid pure exponential.

## Avoiding Degenerate Strategies

### What is Degenerate?
A strategy that's so effective it dominates all alternatives, often by exploiting unintended interactions.

**Examples**:
- **Infinite combo**: Chain abilities to never let enemy act
- **Invincibility loop**: Stack defenses to take 0 damage
- **One-shot build**: Kill everything instantly, trivializing combat

### Preventing Degeneracy

**1. Diminishing Returns**:
Cap effectiveness of stacking same bonus:
```
Effective Bonus = ΣBonus × (1 - 0.1 × StackCount)
```

**2. Internal Cooldowns (ICD)**:
Limit trigger frequency:
- "Can only trigger once per 3 seconds"
- "Cannot chain into itself"

**3. Resource Limits**:
Combos require resources that deplete:
- Mana costs prevent infinite spam
- Cooldowns force rotation variety

**4. Hard Caps**:
Maximum values for critical stats:
- Critical chance caps at 75%
- Dodge chance caps at 50%
- Cooldown reduction caps at 80%

**5. Testing Edge Cases**:
Ask "What if...":
- Player stacks ONLY this stat?
- Player uses ONLY this ability?
- Player ignores entire system?

If any break the game, add limits.

## Skill vs Gear Balance

### Skill Expression
Player decisions should matter more than character stats:

**Recommended ratio**:
- 60% output from player skill (positioning, ability use, timing)
- 40% from character power (stats, gear, level)

**Ways to emphasize skill**:
- **Dodgeable attacks**: Enemies telegraph, player can evade
- **Interrupt windows**: Enemies have vulnerable moments
- **Resource management**: Mana/cooldowns require planning
- **Target priority**: Knowing which enemy to focus

### Avoiding Gear Treadmills
Progression through better gear can invalidate skill:

**Design strategies**:
- **Horizontal progression**: New gear = new options, not just bigger numbers
- **Situational gear**: Best equipment varies by encounter
- **Diminishing returns**: Each tier gives smaller % increase

**Example**:
- Tier 1 weapon: 50 damage
- Tier 2 weapon: 65 damage (+30%)
- Tier 3 weapon: 75 damage (+15%)
- Tier 4 weapon: 82 damage (+9%)

## Counterplay and Interactivity

### Every Strategy Has a Counter
No option should be unbeatable:

**Rock-Paper-Scissors design**:
- Aggression beats Defense (overwhelm with damage)
- Defense beats Control (outlast status effects)
- Control beats Aggression (disrupt combo chains)

**Implementation**:
- AOE damage counters summons
- High armor counters physical damage (forcing magical)
- Dispels counter buff stacking
- Fast attacks counter slow, high-damage abilities

### Telegraphing Danger
Players should be able to see threats and respond:

**Visual cues**:
- Boss wind-up animation before big attacks
- Enemy aura showing buff effects
- Warnings before AOE damage zones

**Information available**:
- Enemy health bars
- Active status effects
- Upcoming turn order

**Counterplay options**:
- Defensive cooldowns (invulnerability, shields)
- Crowd control (stop enemy action)
- Positioning (move out of danger)

## Testing and Iteration

### Metrics to Track

**Win rates**:
- Overall: Target 45-55% for fair challenge
- By build: No build should have >65% or <35%

**Pick rates**:
- Classes: Even distribution (20% each for 5 classes)
- Abilities: All abilities picked by >10% of players
- Perks: No perk >70% or <5% pick rate

**Time to victory**:
- Standard encounter: 80-120 seconds (target 100s)
- Boss fight: 5-10 minutes

**Engagement**:
- Combat turns: Average 6-8 turns per encounter
- Ability variety: Players use avg 5+ different abilities per fight

### Identifying Imbalance

**Overpowered (OP)**:
- Win rate >65%
- Pick rate >80%
- Time to victory <60% of target

**Underpowered (UP)**:
- Win rate <35%
- Pick rate <10%
- Time to victory >140% of target

### Fixing Imbalance

**If OP**:
1. Reduce numbers by 15-20%
2. Add costs or cooldowns
3. Introduce hard counters
4. Nerf synergies

**If UP**:
1. Increase numbers by 20-30%
2. Reduce costs or cooldowns
3. Buffsynergies
4. Add niche where it excels

**Rule of thumb**: Buff weak options before nerfing strong ones (players prefer buffs).

## Common Balance Pitfalls

**1. Power Creep**:
Each patch adds stronger options, invalidating old content.
- **Fix**: Balance new content against existing, not above it.

**2. Homogenization**:
Making everything balanced by making everything the same.
- **Fix**: Preserve unique strengths while adjusting weaknesses.

**3. Overbuffing Counters**:
Counters so strong they shut down strategies completely.
- **Fix**: Counters should advantage, not invalidate.

**4. Hidden Information**:
Players can't evaluate options without theorycrafting.
- **Fix**: Show formulas, provide tooltips with numbers.

**5. Ignoring Player Perception**:
Something feels OP/UP even if mathematically balanced.
- **Fix**: Trust player feedback, adjust to feel right.

## Quick Reference Checklist

- [ ] Power budget defined for each option
- [ ] All builds have 45-55% win rate (±10%)
- [ ] Each class/option has protected niche
- [ ] High-risk options have proportional rewards
- [ ] Linear or quadratic scaling (avoid exponential)
- [ ] Degenerate strategies prevented (caps, ICD, resources)
- [ ] Skill accounts for 60%+ of success
- [ ] Every strategy has viable counterplay
- [ ] Danger telegraphed with 1-2s warning
- [ ] Internal playtesting done with varied builds
- [ ] Pick rates within 15% of expected distribution
- [ ] No option >70% or <10% pick rate

---

## Applying Balance Theory to RPR

The sections above provide general balance principles. Here's how to apply them to RPR:

### Power Budgets → Point Pools
RPR power budgets are **point allocation systems**:
```
DiceConfig Fields:
- AttributePoints: 27 (with Point Buy: maximum ~3 attributes at 5, or 5-6 attributes at 3)
- SkillPoints: 15 (allocate to skills with Trained='t')
- PerkPoints: 15-20 (purchase perks)

Total character power = Sum of all pool spending
```

**Balance Check**:
- Calculate average build power: AttributePoints + SkillPoints + PerkPoints
- Standard build: 27 + 15 + 15 = 57 total points
- High-power build: 35 + 20 + 25 = 80 total points

### Niche Protection → Perk Categories + Mutators
Create distinct playstyles via perk trees and mutators:
```
// Tank niche
PerkDef|10|t|Heavy Armor|Tank specialization|3|Armor
PerkAction|10|7|10|92|||30.0  // +30 HP
PerkAction|10|7|10|94|||10.0  // +10 Armor

// DPS niche
PerkDef|20|t|Weapon Master|Damage specialization|3|Combat
PerkAction|20|4|1|1|||3.0  // +3 STR
PerkAction|20|8|0|100|||0.0  // Grant high-damage ability

// Use mutators for conditional benefits
MutatorDef|100|Heavy Armor Bonus|Tank bonus while wearing heavy armor
MutatorCondition|100|0|0|10|...  // If has Heavy Armor perk
MutatorAction|100|1|10|94|||5.0  // +5 Armor (stacks with perk)
```

### Risk vs Reward → Cost + Requirements + Downsides
```
// High-risk, high-reward ability
SpellDef|100|Desperation Strike|All-or-nothing attack|...|Cost=20 mana|...
SpellReqDef|100|0|92|...||50|...  // Requires HP < 50 (risky)
SpellEffect|100|0|1|3d10+1*2.0|92|0|...|Outcome=1|...  // Huge damage on hit

// Safe, reliable ability
SpellDef|101|Steady Strike|Consistent damage|...|Cost=10 mana|...
SpellEffect|101|0|1|1d8+3+1*1.0|92|0|...|Outcome=1|...  // Fixed +3 plus STR (low variance)
```

### Linear vs Exponential Scaling → RPR Enforces Linear
RPR formulas are inherently linear (weighted sums):
```
// Linear scaling example
Stat|92|HP|...|3*10|...  // HP = CON × 10
- CON  3: HP = 30
- CON 5: HP = 50
- CON 10: HP = 100
Linear growth: each point of CON = +10 HP

// Can't do exponential in RPR:
❌ HP = CON² × 10  (not possible)
❌ HP = Base × (1.1 ^ CON)  (not possible)
```

**Balance Benefit**: Predictable power, no runaway scaling

### Avoiding Degenerate Strategies → Buff Caps + Mutator Limits
```
// Buff caps prevent infinite stacking
DiceConfig: MaxAttributeBuff=10, MaxSkillBuff=10, MaxStatBuff=10

// Example: Multiple +STR buffs
SpellEffect (Ability A): +5 STR for 60s
SpellEffect (Ability B): +5 STR for 60s
SpellEffect (Ability C): +5 STR for 60s
Result: +10 STR (capped), not +15

// Mutator conditions prevent abuse
MutatorCondition: Only triggers if specific perk owned
No perkinfinite loops, no infinite mutator chains
```

### Skill vs Gear → External System Design
RPR has minimal "gear" concept (Gear table is obsolete):
- **Skill expression**: Design abilities that require player decisions (target choice, resource management, timing)
- **Character power**: Comes from attributes, skills, perks, stats
- **No gear treadmill**: RPR doesn't have progressive gear systems

**Focus balance on**: Attribute allocation + Perk choices + Ability usage

### Counterplay → Dispel + Requirements + Mutators
```
// Buff strategy
SpellDef|100|Mega Buff|Stack buffs|...|Cost=30 mana|...
SpellEffect|100|2|4|5|1|60|...  // +5 STR buff

// Counter: Dispel
SpellDef|101|Dispel Magic|Remove buffs|...|Cost=10 mana|...
SpellEffect|101|0|7|0|BuffCategory|"Strength Buffs"|...  // Remove STR buffs

// Counter: Requirements
SpellReqDef|102|0|1|...|5|...|...  // Requires STR > 5 (buff strategy blocked)

// Counter: Mutators
MutatorDef|200|Anti-Magic|...|...
MutatorCondition|200|1|0|"Magic Buffs"|...  // If target has magic buffs
MutatorAction|200|1|10|245|||10.0  // +10 Attack Power
```

### Testing and Iteration → Manual Process
1. **Theorycraf** balance in editor:
   - Calculate average damage per round per build
   - Verify point budgets are exhausted reasonably
   - Check buff caps prevent degeneracy

2. **Export** to RPR text file

3. **Playtest** on Conan Exiles server:
   - Track damage logs via Discord bot or spreadsheet
   - Note which perks/abilities are chosen
   - Observe combat length

4. **Analyze metrics** externally:
   - Pick rates (which perks/abilities used?)
   - Win rates (which builds succeed?)
   - Time to victory (combats too short/long?)

5. **Iterate** in editor:
   - Adjust formulas, costs, point pools
   - Add/remove perks or abilities
   - Re-export and test

**No automation** - balance is human-driven process

## RPR Balance Checklist

Before finalizing system:
- [ ] Point pools defined (AttributePoints, SkillPoints, PerkPoints)
- [ ] Point Buy enabled if using escalating costs
- [ ] Buff/debuff caps set (MaxAttributeBuff, MaxSkillBuff, MaxStatBuff)
- [ ] Combat length calculated (HP ÷ average damage = target rounds)
- [ ] Abilities balanced for cost (use power formula)
- [ ] Perks balanced for point cost (0=free, 1-2=minor, 3-5=moderate, 6-10=major)
- [ ] Each class/build has protected niche (unique playstyle)
- [ ] High-risk abilities have proportional rewards
- [ ] Formulas verified as linear (no runaway scaling)
- [ ] Degenerate strategies prevented (caps, requirements, mutators)
- [ ] Counterplay options exist for all strategies
- [ ] External playtesting planned (Discord bot, admin tracking)
- [ ] Iteration process defined (test → analyze → adjust → repeat)

## Summary

RPR balance is **math-driven design + external iteration**:
- **In RPR**: Point pools, buff caps, linear formulas, costs
- **External**: Playtesting, metrics tracking, analysis, iteration

**Formula-Based Balance**:
```
Character Power = (AttributePoints + SkillPoints + PerkPoints) × Efficiency
Ability Power = (Damage × Targets × Success Rate) ÷ (Cost × Cooldown)
Perk Value = (Stat Bonuses + Abilities Granted) ÷ Perk Point Cost
```

**Key Resources**:
- rpr-system-architecture.md: Complete RPR technical reference
- ability-design.md: How to design balanced abilities
- perk-design.md: How to design balanced perks
- stat-systems.md: How formulas scale power

**Remember**: RPR prevents exponential power creep by design. Embrace linear scaling, use caps, and iterate based on actual play!

