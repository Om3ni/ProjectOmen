# RPR Combat Mechanics Guide

## Overview
Combat mechanics define how battles unfold in RPR systems. This guide covers both **RPR-specific implementation details** and **general TTRPG design principles** to help you design engaging combat within RPR's constraints.

**Critical Understanding**: RPR has **no native turn system** or **combat engine**. Turn order, action economy, and combat flow are defined by how you design your stat system, abilities, and external tools (Discord bots, admin management).

**Refer to rpr-system-architecture.md for complete technical specifications.**

## RPR Combat Architecture

### What RPR Provides
RPR gives you building blocks:
- **Abilities** (SpellDef with 13 SpellEffect types)
- **Cooldowns** (real-time minutes, not turns)
- **Resource pools** (Stat table: HP, Mana, Stamina)
- **Status effects** (StatusDef for buffs/debuffs/conditions)
- **Roll systems** (CasterRollType, DCType for opposed checks)

### What RPR Does NOT Provide
❌ No turn order system (you must define via external rules)
❌ No action economy (no "major/minor actions" field)
❌ No initiative rolls (you build this via custom stats/abilities)
❌ No combat state machine (no "combat mode" vs "exploration mode")
❌ No automatic turn progression

### How to Build Combat in RPR

**Option 1: Turn-Based via External Management**
```
1. Create Initiative stat (Stat table, Formula=2*1.0 for DEX-based)
2. Players roll initiative using custom ability or Discord bot
3. GM/bot tracks turn order externally
4. Players execute abilities via character sheet when their turn comes
5. Cooldowns are ignored or tracked manually in turns
```

**Option 2: Real-Time Cooldown-Based**
```
1. Rely on RPR's cooldown system (real-time minutes)
2. No turn order—players act whenever ready
3. Combat length determined by cooldown cycles
4. Example:
   - Basic Attack: 0 cooldown, 5 mana
   - Power Strike: 2-minute cooldown, 15 mana
   - Ultimate: 10-minute cooldown, 50 mana
```

**Option 3: Hybrid (Recommended for Tactical Combat)**
```
1. Use turn-based structure (externally managed)
2. Translate RPR cooldowns: "2-minute cooldown" = "2 turn cooldown"
3. Create Action Point stat (Stat table) for action economy
4. Abilities cost Action Points + Mana
5. Track turns and cooldowns via Discord bot or admin tools
```

### RPR Combat Flow Example

**Gritty Tactical System (10-round max)**:
```
// 1. Define combat stats
Stat|325|Initiative|t|f|f|0|0|1.0|0|2*1.0|f|f       // DEX-based
Stat|92|HP|t|t|f|100|1|1.0|0|3*10|f|f             // CON×10, ~100-150 HP
Stat|500|Action Points|t|t|f|3|0|1.0|0||f|f        // 3 AP per turn (manual reset)

// 2. Define damage scaling for 10-round combat
Average HP: 125
Target rounds: 6-10
Damage per round needed: 125÷8 = ~15 damage/round

// 3. Design abilities
SpellDef|100|Basic Attack|Single-target strike|...|Cost=0|Cooldown=0|...
SpellEffect|100|0|1|1d6+1*1.0|92|0|...  // 1d6+STR (~7-11 damage)

SpellDef|101|Power Strike|Heavy hit|...|Cost=10 mana|Cooldown=0|...
SpellEffect|101|0|1|2d8+1*1.5|92|0|...  // 2d8+1.5×STR (~14-25 damage)

SpellDef|102|Defensive Stance|Reduce damage|...|Cost=5 mana|Cooldown=0|...
SpellEffect|102|2|5|10|94|60|...  // +10 Armor for 60 seconds (1 turn if 1 turn = 1 minute)

// 4. External turn tracking
Discord bot commands:
  !init - Roll initiative (1d20 + Initiative stat)
  !turn - Advance to next player
  !cooldown <ability> - Track cooldowns in turns
  !ap reset - Reset AP to 3 at turn start
```

## Turn Order Systems

### Initiative-Based (D&D Style)
Each combatant rolls initiative at combat start, creating a turn order.

**RPR Implementation**:
```
// Create Initiative stat
Stat|325|Initiative|t|f|f|0|0|1.0|0|2*1.0|f|f  // DEX-based

// Create initiative roll ability (optional)
SpellDef|1000|Roll Initiative|Determine turn order|...|TargetType=1|...
SpellEffect|1000|0|0|Roll: 1d20+Initiative|...|Broadcast=1|...  // Print result

// Manual tracking: Players/GM note initiative values, act highest-to-lowest
```

**Formula**:
```
Initiative = 1d20 + DEX Modifier + Initiative Bonus
```

**Turn order**: Highest to lowest initiative

**Pros**:
- Simple and familiar
- Fast characters act first (makes DEX valuable)
- Single roll reduces bookkeeping

**Cons**:
- Random, can feel unfair
- Fixed order for entire combat
- DEX becomes a "god stat"

**When to use**: Fast-paced games, tactical focus

### Speed-Based (Active Time Battle)
Characters act when their "turn meter" fills based on speed stat.

**Formula**:
```
Turn Meter += Speed × TimeUnitsPerTick
When Meter >= 100: Character acts, Meter resets
```

**Pros**:
- Fast characters act multiple times
- Speed stat has clear value
- Dynamic turn order

**Cons**:
- Complex to track
- Requires real-time or careful bookkeeping
- Speed can become overpowered

**When to use**: JRPGs, games with haste/slow mechanics

### Round Robin (Simultaneous Turns)
All players choose actions, then all resolve simultaneously.

**Phases**:
1. Plan phase: All players select actions
2. Resolution phase: Actions resolve in priority order (attacks → spells → movement)
3. Repeat

**Pros**:
- No turn order advantage
- Emphasizes prediction and mind games
- Works well for multiplayer

**Cons**:
- Can be chaotic
- Hard to target mobile enemies
- Requires good UI for simultaneous input

**When to use**: PvP, strategy games, multiplayer

### Hybrid: Phase-Based Initiative
Combines initiative with action phases.

**Structure**:
1. Fast phase: Characters with Initiative ≥ 15 act
2. Normal phase: Characters with Initiative 5-14 act
3. Slow phase: Characters with Initiative < 5 act

**Pros**:
- Grouping makes turns faster
- Still rewards high initiative
- Less swingy than pure initiative

**Cons**:
- Ties within phases need resolution rules
- More complex than pure initiative

**Recommendation**: Use initiative-based for simplicity, speed-based for tactical depth.

## Action Economy

### Actions Per Turn
How many things can a character do in one turn?

**Standard action structure**:
- **1 Major Action**: Attack, cast spell, use ability
- **1 Minor Action**: Move, drink potion, interact with object
- **1 Free Action**: Drop item, speak, trigger passive

**Alternative structures**:

**Action Points (AP)**:
Every action costs AP, pool of 3-6 per turn:
- Attack: 2 AP
- Move: 1 AP
- Cast spell: 2-4 AP (varies)
- Use item: 1 AP

**Pros**: Flexibility, can make multiple small actions or one big action
**Cons**: More bookkeeping, harder to balance

**Split Actions**:
One full action OR two partial actions:
- Full: One attack at full power
- Partial: Two attacks at -2 penalty, or attack + move

**Pros**: Simple choice
**Cons**: Full action often dominant

**Recommendation**: Use Major/Minor/Free for ease, AP for tactical complexity.

### Bonus Actions and Reactions
Special actions that occur outside normal turns.

**Bonus Actions**:
- Triggered by specific abilities or perks
- One per turn maximum
- Examples: Attack with offhand weapon, cast quickened spell, activate item

**Reactions**:
- Triggered by enemy actions
- One per round (across all turns)
- Examples: Opportunity attack when enemy moves, counterspell, parry

**Design tips**:
- Bonus actions prevent wasted turns (always something to do)
- Reactions create tactical counterplay
- Limit frequency to avoid action bloat

### Swift/Free Actions
Abilities that don't consume main action.

**Examples**:
- Speak (communicate strategy)
- Drop item (free hand for weapon)
- Maintain concentration (ongoing spell)
- Toggle stance (defensive/aggressive mode)

**Balance rule**: Free actions should never directly deal damage or heal.

## Resource Management

### Mana/Energy Pools
Fuel for abilities, regenerates over time.

**Regeneration patterns**:

**Constant regen**: +10 mana per turn
- **Pros**: Predictable, encourages pacing
- **Cons**: Can lead to"optimal" play loops

**Percentage regen**: Restore 10% of max per turn
- **Pros**: Scales with character growth
- **Cons**: High-mana builds regenerate faster (rich get richer)

**Combat-only regen**: No regen during combat, full between fights
- **Pros**: Forces resource management in long battles
- **Cons**: Encourages rest spamming

**Hit-based regen**: Restore mana on successful hits
- **Pros**: Rewards aggression
- **Cons**: Punishes missing or defensive play

**Recommendation**: Use constant or percentage regen with out-of-combat full restore.

### Cooldown Systems
Alternative to mana, abilities recharge individually.

**Cooldown types**:
- **Turn-based**: "Usable once every 3 turns"
- **Real-time**: "Usable once every 30 seconds" (for real-time combat)

**Pros**:
- No resource pool to track
- Each ability balanced independently
- Encourages ability rotation

**Cons**:
- Less resource management depth
- Can feel restrictive

**Hybrid approach**: Short cooldowns + mana costs prevents spam of powerful abilities.

### Health as a Resource
Some abilities cost HP instead of mana.

**Design considerations**:
- **Conversion rate**: HP costs should be 2-3× mana equivalent (health is more valuable)
- **Risk/reward**: High power but dangerous
- **Lifesteal synergy**: Pairs well with healing effects

**Example abilities**:
- Blood Magic: Deal 10 damage to self, deal 50 damage to enemy
- Berserk: Lose 25% max HP, gain +100% damage for 3 turns
- Life Tap: Convert 20 HP to 30 mana

### Action Points (Alternative Resource)
Characters gain a pool of AP per combat, spend throughout.

**Example**:
- Start with 20 AP
- Basic attack: 2 AP
- Strong ability: 5 AP
- Ultimate: 10 AP

**Strategic element**: Do you spend AP early for pressure or save for late-game burst?

**Recommendation**: Use for roguelike or puzzle combat games.

## Combat Length and Pacing

### Ideal Combat Duration
Battles should last long enough to execute strategy but not drag:

**Guidelines**:
- **Trash mobs**: 1-3 turns (quickly cleared, not tedious)
- **Standard encounters**: 4-8 turns (test tactics and resource management)
- **Boss fights**: 10-20 turns (epic, require full strategy and cooldown rotation)

**Target formula**:
```
Turns to Kill = Enemy HP ÷ (Player DPS × Hit Chance)
```

Balance enemy HP to hit target turn counts.

### Burst vs Sustain
Different character archetypes excel at different timeframes:

**Burst** (high damage, short windows):
- Strong in turns 1-3
- Uses ultimate abilities and cooldowns
- Good for quick fights

**Sustain** (moderate damage, long endurance):
- Strong in turns 5+
- Relies on efficient resource use
- Good for boss fights

**Balance by encounter design**:
- Short encounters favor burst
- Long encounters favor sustain
- Mix both to avoid dominant strategies

### Combat Phases
Bosses can have multiple phases to extend fights interestingly:

**Example**:
- Phase 1 (HP 100-50%): Normal attacks
- Phase 2 (HP 50-25%): Faster attacks, summons adds
- Phase 3 (HP 25-0%): Berserker mode, AOE spam

**Design tips**:
- Each phase should require adaptation
- Reward saving cooldowns for dangerous phases
- Signal phase transitions clearly

## Crowd Control (CC)

### CC Types
Effects that restrict enemy actions:

**Hard CC** (prevents all actions):
- **Stun**: Cannot act for X turns
- **Sleep**: Cannot act until damaged
- **Charm**: Acts on your side for X turns
- **Freeze**: Cannot act, takes extra damage from next hit

**Soft CC** (restricts actions):
- **Slow**: Initiative/speed reduced 50%
- **Silence**: Cannot cast spells
- **Disarm**: Cannot use weapon attacks
- **Blind**: -50% hit chance

**Movement CC**:
- **Root**: Cannot move but can act
- **Knock back**: Moved away from target
- **Taunt**: Must target taunter

### CC Duration Balance
CC is very powerful, must be limited:

**Recommended durations**:
- Hard CC on single enemy: 1-2 turns
- Hard CC AOE: 1 turn
- Soft CC: 2-4 turns
- Movement CC: 2-3 turns

**Diminishing returns**:
Repeated CC on same target is less effective:
```
Duration = BaseDuration × (0.5 ^ ApplicationCount)
```

Example: First stun lasts 2 turns, second stun lasts 1 turn, third lasts 0.5 turns

**Boss immunity**: Major bosses should be immune or highly resistant to CC.

## Status Effects

### Damage Over Time (DoT)
Ongoing damage each turn:

**Bleed**: 10 damage per turn for 5 turns
**Burn**: 15 damage per turn for 3 turns
**Poison**: 5 damage per turn for 8 turns

**Balance formula**:
```
Total DoT Damage ≈ 70-80% of equivalent direct damage ability
```

Example: 50-damage attack vs 10 damage/turn for 5 turns (50 total). Direct damage should cost more or have shorter cooldown.

### Buffs and Debuffs
Stat modifications:

**Buff examples**:
- Haste: +50% speed for 3 turns
- Shield: +20 temporary HP
- Bless: +10% damage for 4 turns

**Debuff examples**:
- Weaken: -30% damage dealt for 3 turns
- Vulnerable: +30% damage taken for 2 turns
- Curse: -10% all stats for 5 turns

**Stacking rules**:
- Same effect from different sources: Choose highest magnitude
- Different effects: Stack fully
- Same source repeatedly: Refresh duration, don't stack magnitude

## Victory and Defeat Conditions

### Standard Condition
Reduce all enemies to 0 HP.

**Defeat**: Reduce all players to 0 HP.

### Alternative Conditions
Add variety and strategy:

**Objective-based**:
- Survive X turns
- Escort NPC to location
- Destroy target object
- Capture control points

**Time limits**:
- Defeat boss in 10 turns or lose
- Survive longer than enemy

**Resource goals**:
- Reduce enemy mana to 0
- Accumulate X combo points

**Design tip**: Use alternative conditions for 20-30% of encounters to vary gameplay.

## Combat Feedback

### Displaying Information
Players need to understand combat state:

**Essential info**:
- Current HP/resources for all combatants
- Active status effects and durations
- Available actions and costs
- Turn order/who acts next

**Optional info**:
- Damage numbers (floating text)
- Hit/miss indicators
- Critical hit animations
- Countdown timers

**UI recommendations**:
- Color-code buffs (green) and debuffs (red)
- Show cooldowns clearly
- Highlight valid targets
- Preview ability effects before committing

## Quick Reference Checklist

- [ ] Turn order system chosen (initiative, speed, or simultaneous)
- [ ] Actions per turn defined (major/minor/free or action points)
- [ ] Resource system implemented (mana, cooldowns, or hybrid)
- [ ] Combat duration targets: trash 1-3 turns, standard 4-8, boss 10-20
- [ ] CC durations limited (hard CC 1-2 turns, soft CC 2-4 turns)
- [ ] DoT totals 70-80% of direct damage equivalent
- [ ] Status effect stacking rules defined
- [ ] Victory conditions clear and varied
- [ ] UI shows all essential combat information
- [ ] Boss fights have phases or mechanics (not just HP sponges)

---

## Applying TTRPG Design Theory to RPR

The sections above provide general TTRPG combat design principles. Here's how to apply them to RPR:

### Turn Systems → External Management
- RPR has no native turns
- Choose a turn system (initiative, speed, simultaneous) based on your game's feel
- Implement via Discord bot, admin tools, or player honor system
- Document turn rules in system description

### Action Economy → Stats + External Rules
- Create Action Point stat if needed
- Define in system documentation: "Each turn: 1 Major + 1 Minor + unlimited Free"
- Abilities don't have "action type" field—must be documented externally
- Bonus actions/reactions: Grant abilities via perks, document their type

### Resources → Stat Table + DiceConfig
```
Stat|93|Mana|t|t|f|50|0|1.0|0|4*8;5*2|f|f    // Mana = INT×8 + WIS×2
Stat|277|Stamina|t|t|f|30|0|1.0|0|1*5;3*5|f|f  // Stamina = STR×5 + CON×5
```
- Regen: Manual (player resets current value) or ability-based (healing spell)
- No automatic resource regen in RPR

### Cooldowns → Real-Time Minutes
- RPR cooldowns are real-world time, not turns
- For turn-based combat: Document conversion (e.g., "1 minute = 1 turn")
- Or set cooldowns to 0 and track externally

### Status Effects → StatusDef + SpellEffect Type 11
```
// Define status
StatusDef|10|Stunned|f|f|1.0|0.0|0.0|1.0

// Apply via ability
SpellEffect|X|0|11|10|60|...  // Apply "Stunned" for 60 seconds
```
- Duration in seconds
- CC/buffs/debuffs all use status system

### Combat Length → HP and Damage Scaling
```
Target: 6-10 rounds
Average HP: 125
Damage needed: 125 ÷ 8 = ~15-16 damage/round

Design abilities:
- Basic Attack: 1d6+STR (~7-11) → 2 hits to kill with average rolls
- Power Strike: 2d8+STR (~14-25) → 1-2 hits
- AOE: 1d8+INT per target (~8-12) → chip damage
```

### Victory Conditions → External Definition
- RPR doesn't have "win/lose" logic
- Standard: "Reduce enemy HP to 0"
- Alternative: Document in system rules ("Survive 5 turns", "Protect NPC", etc.)
- Enforce via GM/bot

## RPR Combat Design Checklist

Before finalizing combat system:
- [ ] Turn system chosen and documented (initiative/speed/simultaneous/none)
- [ ] Action economy defined (if any) and documented
- [ ] Resource pools created (HP, Mana, Stamina stats)
- [ ] Combat length calculated (HP ÷ average DPS = target rounds)
- [ ] Abilities balanced for target combat length
- [ ] Status effects defined for CC, buffs, debuffs
- [ ] Initiative stat created (if using initiative system)
- [ ] Action Point stat created (if using AP system)
- [ ] Cooldown interpretation documented (real-time vs turns)
- [ ] External tracking method planned (Discord bot, admin tools, manual)

## Summary

RPR combat is **hybrid design**:
- **In RPR**: Stat pools, abilities, status effects, roll systems
- **External**: Turn order, action economy, combat flow, win conditions

**Key Resources**:
- rpr-system-architecture.md: Complete SpellEffect and StatusDef reference
- ability-design.md: How to design balanced abilities
- stat-systems.md: How to create HP, Mana, and combat stats

**Remember**: RPR provides combat **building blocks**, not a complete **combat engine**. You define the rules, RPR provides the math!

