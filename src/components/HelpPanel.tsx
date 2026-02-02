import { useState } from 'react';

import type { RprCategory } from '@/models/schema';

const HELP_CONTENT: Record<string, string> = {
  Attributes: `**Trained Only**
Skills marked as "Trained Only" must have at least 1 point assigned to them in order to use them.

**Public**
Public skills/attributes can be allocated by players without any special requirements. If you wish to limit the availability of a skill through Perks, or just plain old Admin editing, toggle this option off.

**Natural Bonus**
Use this to make a skill naturally easier to perform. This value will always be added to the total skill bonus.

For example, "Use Rope" gets a +10 bonus by default because it is far easier to tie someone up than to escape from the restraints.

For d20 it simply adds to the roll.
For d6 it modifies the number of dice rolls.

**Max Allocation**
Allows you to override the maximum allowed number of allocated of a skill/attribute. If set to -1, the global maximum will be used as defined in the Rules section above.

**Descriptions**
When writing a skill/attribute description it is generally a good idea to explain how the skill should and shouldn't be used.

Many players are beginners and it would help ease their journey into Roleplay.`,

  Skills: `**Bonus**
A list of attributes to derive a bonus value from.
NOTE: If you have any number of bonus attributes other than 1, the character sheet UI will not render collapsible Attributes. Instead you'll get a flat list of all Attributes and Skills.

**Function**
If you use multiple bonus attributes, this determines how the final result is computed.

• Sum – Adds all the sources together.
• Average – Gets the average value (rounded down) of all sources.
• Take Min – Uses the smallest value of all sources.
• Take Max – Uses the largest value of all sources.

**Trained Only**
Skills marked as "Trained Only" must have at least 1 point assigned to them in order to use them.

**Public**
Public skills/attributes can be allocated by players without any special requirements. If you wish to limit the availability of a skill through Perks, or just plain old Admin editing, toggle this option off.

**Natural Bonus**
Use this to make a skill naturally easier to perform. This value will always be added to the total skill bonus.

**Max Allocation**
Allows you to override the maximum allowed number of allocated of a skill/attribute. If set to -1, the global maximum will be used as defined in the Rules section above.`,

  Perks: `**Category**
Can be used to allow/deny groups of perks, or to check for the existence of this perk category via Mutators.

**Public**
Just like skills and attributes, public Perks can be selected by players.

**Allow Skill/Attribute/Perk**
Having this perk will give access to whatever you have selected in this action.

**Deny Skill/Attribute/Perk**
The opposite of Allow Skill/Attribute/Perk. A Deny action always trumps any Allow actions.

**Skill/Attribute Modifier**
Having this perk will modify the skill or attribute in question by the given value.

**Give Feat**
Gives players a Feat by ID. If this perk is removed from the character, the Feat will be removed as well.

NOTE: Feats only work for player selected perks. Runes/Mutators/etc that grant Perks will not give Feats.

**Give Sudo Role**
Gives players a Sudo Role by ID. If this perk is removed from the character, the Role will be removed as well.

NOTE: Sudo Roles only work for player selected perks. Runes/Mutators/etc that grant Perks will not give Sudo Roles.

**Cost**
How many Perk points it costs to get this Perk. 0 means it's a free Perk.

**Teach Language**
For supporting chat systems only, gives the player access to specific languages. Currently only Tot!Chat implements this functionality.

**CharTag / CharVar**
Sets CharVars/Tags in Sudo.

NOTE: This only works for player selected perks. Runes/Mutators/etc will not have any effect.`,

  Stats: `Stats are static attributes that cannot be rolled with dice. They consist of a maximum and temporary value. The maximum can be modified by Perks, Runes and Levels, while the temporary value can be adjusted by the player (if enabled).

You can use this to create stats like HP, Mana, Reputation, and so on.

**Base Value**
The value of the stat before any modifications.

**Bonus**
A list of attributes and/or skills to derive a bonus value from.

**Function**
If you use multiple attributes/skills for bonus sources, this determines how the final result is computed.

• Sum – Adds all the sources together.
• Average – Gets the average value (rounded down) of all sources.
• Take Min – Uses the smallest value of all sources.
• Take Max – Uses the largest value of all sources.

**Final Multiplier**
Applied to the final bonus value and rounded down.

1.9 = 1
2.1 = 2

**Min Value**
The absolute minimum value a stat can be after all modifiers are applied to it. This does not include player editing!

For example, a character's max HP value cannot decrease below 1 no matter what penalties they get from Perks and Runes. A player may still temporarily set his HP to 0 though.

**Public**
Public stats are available to all characters. Otherwise stats cannot be used unless they are made available through Perks, Runes, etc.

**Secret**
Secret stats behave exactly the same with the only difference being that they are hidden from the player's UI.

**Can Modify**
If enabled, the stat value will range between 0 and the maximum calculated value (base + attribute + perks + runes).

**Player Can Modify**
If enabled allows the player to manually modify the stat value.

**Player Can Reset**
Allows the player to reset any admin changes to this stat when updating their character sheet.

If you want to have persistent stats, like Reputation/Humanity/etc, keep this off.`,

  Runes: `Runes are items that can be inserted into special slots in the Roleplay panel. These items can provide stat modifiers and give out perks.

The physical item must be in the player's backpack or the effects will not apply.

**Item ID**
You can use any item you wish to be recognized as a Rune, so long as it resides in the player's Backpack (not equipped and not in the hotbar).

Item IDs must be unique! If you use the same item twice, the mod will only use the effects of the first one it finds.

Provided are a set of runes for your disposal, item IDs ranging from 833101 to 833175.

• 833101 to 833125 – Lesser runes.
• 833126 to 833150 – Greater runes.
• 833151 to 833175 – Infused runes.

The first of each rune type is a blank one, if you wish to implement a crafting/enchantment system through Thespians.

**Modify**
Modifies the target attribute or skill, if the Rune's Game State conditions are met.

**Broadcast Equip**
If checked, a message will be posted in chat whenever the player equips or unequips this Rune.

**Slot**
Allows you to control what Rune combinations a player may have. Only one Rune can be equipped per Slot.

**Grant Perk**
Gives the player a Perk (unlike Allow Perk in the Perks section which only enables the player to select it).

The perk will only be in effect if the Rune's Game State conditions are met.

Grant Perk will override any Deny Perk rules you have in place.

**Game states**
• Dawn – 4 AM to 6 AM
• Day – 6 AM to 4 PM
• Dusk – 4 PM to 8 PM
• Night – 8 PM to 4 AM
• Hot – Applies game logic (+armors)
• Cold – Applies game logic (+armors)
• Has Shelter – Shelter level above 75%
• Has Some Shelter – Shelter level between 25% and 75%
• Has No Shelter – Shelter level below 25%`,

  Statuses: `Statuses are displayed under the character's name. They can be either player selected, or given out through other systems. There is no limit to how many statuses can be granted to a character.

**Is Public**
Public statuses can be selected by players from their Bio panel.

You can configure how many statuses they may select in the System tab.`,

  Mutators: `Mutators allow you to create complex game conditions to modify character sheets, grant Perks and Abilities based on many variables.

Mutators are evaluated sequentially, taking previous effects into account. This is important to keep in mind when you are checking for Perks/Statuses and using Mutators to grant said Perks and Statuses at the same time.

**All Includes/Excludes must match**
This controls whether one or all the include/exclude conditions must be met for the Mutator to be active.
Excludes always beat Includes.

**Operators**
• == Equals
• != Not equals
• > Greater than
• >= Greater or equal to
• < Less than
• <= Less or equal to

**Between:**
Max > Value >= Min

**Outside:**
Value >= Max OR Value < Min

**Game states**
• Dawn – 4 AM to 6 AM
• Day – 6 AM to 4 PM
• Dusk – 4 PM to 8 PM
• Night – 8 PM to 4 AM
• Hot – Applies game logic (+armors)
• Cold – Applies game logic (+armors)
• Has Shelter – Shelter level above 75%
• Has Some Shelter – Shelter level between 25% and 75%
• Has No Shelter – Shelter level below 25%`,

  Abilities: `**Custom rolls**
Some fields support custom rolls where you can enter free text. You can use numbers, dice rolls, attribute/skill or stat names to write a formula.

To make a spell effect negate a stat, remember to ensure the formula output value is negative.

More information is available inside the formula editor, accessible by pressing the green "Edit" button next to formula inputs.

**Formatting**
"Print Message" effects support different formatting options. Names in brackets like {this} will be replaced with the appropriate value when using the ability.

They work a little different depending on the effect target.

*Caster effect options:*
• {caster} - the name of the caster character.
• {target} - the names of all the targets.
• {roll} - the rolls that were made to determine success or failure per target.
• {success_target} - names of targets that that the ability worked on.
• {success_roll} - the successful rolls.
• {failure_target} - names of failed targets.
• {failure_roll} - the failed rolls.
• {comment} - caster player input, if any was provided.

*Target/All targets options:*
• {caster} - the name of the caster character.
• {target} - the names of relevant target.
• {roll} - the roll that was made to determine success or failure for the relevant target.
• {comment} - caster player input, if any was provided.

**Caster roll type**
If you are using the d20 system and have "Enable Critical Rolls" checked, natural 1's and 20's count as critical successes/failures, disregarding any skill bonuses.
1's will always fail.
20's will always succeed.
If the target makes a counter roll, their natural 1's and 20's also apply.

Rules:
• 20 vs any = success
• 1 vs any = fail
• any vs 1 = success
• any vs 20 = fail
• 20 vs 20 = determined by roll totals
• 1 vs 1 = determined by roll totals

**Target type**
Determines who are the ability's targets.

• Selected - Player selects a number of targets for the ability (can select themselves)
• Selected Others - Player selects a number of targets, except for themselves.
• Caster - Only the player using the ability is affected.
• All - Everyone in a given radius is affected.
• All Others - Everyone but the caster in a given radius is affected.

Whenever the caster is listed among the spell targets, both Target and Caster effects will apply to them.

**# of targets**
Sets the maximum number of targets for Selected target type.

**In range**
In building tiles, how far the ability can reach.

**DC Type**
Determines how the target may attempt to resist the ability.

• Target roll - make a counter roll with a given attribute/skill. If you are using the d20 system and "Enable Critical Rolls" is checked, natural 1's and 20's count as critical successes/failures.
• Target stat - compares the caster's roll against the target's Stat value. For example, rolling attack vs an Armor Class stat in D&D.
• Target roll stat - same as roll, only uses a stat instead of a skill/attribute.
• Fixed - caster roll must beat a predeterminate number.
• Custom - allows you to write whatever formula you want.

**Cooldown**
How long in minutes must the caster wait before being able to use the ability again.

**Chat Radius**
Any chat printouts will be sent in this radius. This only works for Roleplay Chat!

**Common ability**
Common abilities are known by all characters by default.

**Allow player modifiers/comment**
If checked, the player may apply modifiers and write a short description to the roll. You must still provide a "Print message" effect with "{comment}" in there to display it.

**Enable Critical Rolls**
This only works for the d20 system. If enabled, Critical success/failure rolls will be enabled for this ability.

**Log usage**
If checked, all uses of this ability will be logged.

**Requirements**
*All / One of*
You may determine how requirements are checked.
• All - all requirements must be met to use the ability.
• One of - any one of the requirements must be met to use the ability.

*Type*
The requirement types are pretty self explanatory. The only one worth mentioning is "Has Skill Level":
This measures the number of points allocated to an attribute or skill, NOT the total bonus of said skill!

**Operators**
• == Equals
• != Not equals
• > Greater than
• >= Greater or equal to
• < Less than
• <= Less or equal to

Between:
Max > Value >= Min

Outside:
Value >= Max OR Value < Min

**Target Conditions**
*Include/Exclude*
These are rules by which the system determines valid targets for a given ability.

For more information see Mutators, this works exactly like them.

**Effects**
Effects are split into 3 groups:
• General - always happen no matter what.
• Success - Only for successful rolls (per target)
• Failure - Only for failed rolls (per target)

If there are multiple targets and at least one is successful, the Success caster effects will be applied.

**Publicity**
Determines how the effect will be broadcast in Say/Local radius in the relevant character's bubble.

• Public effects will be displayed for everyone.
• Private effects will be displayed only for the relevant player (Global chat private notification in Pippi)
• Secret effects will not be displayed at all.

**Target**
• Caster - applies only to the caster.
• Target - applies to each target individually, if the effect is a damage roll for example, each target will get a different roll.
• All Targets - applies the same effect to all the targets.

**Condition**
• Always - Self explanatory
• Critical only - Relevant only to d20 systems. This effect will only apply on critical success/fail rolls.
• Non critical only - the opposite of Critical only, will only apply on normal rolls.

**Buff category**
Buffs can be dispelled by Category. For example, you may want to create a spell that removes all "Magical" buffs, or a medical ability that removes "Physical" debuffs.

**Buff duration**
Buffs can be temporary. You can roll the outcome just like the effect itself, or you can set it to -1 to make the buff permanent. It can still be removed with a Dispel of the corresponding Category.

**Auto Use Ability**
The target of this effect will automatically attempt to use this ability.

All requirement and target checks will apply. If they are not met, nothing will happen.

When the auto-triggered Ability has a target type of Selected, the original caster will be this Ability's target.`,
};

type Props = {
  category: RprCategory;
};

export default function HelpPanel({ category }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  
  const helpText = HELP_CONTENT[category] ?? '';
  
  if (!helpText) return null;

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;

    for (const line of lines) {
      if (line.startsWith('**') && line.endsWith('**')) {
        // Bold header
        elements.push(
          <h4 key={key++} className="mt-3 mb-1 font-semibold text-slate-200">
            {line.slice(2, -2)}
          </h4>
        );
      } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
        // Italic subheader
        elements.push(
          <p key={key++} className="mt-2 mb-1 italic text-slate-300">
            {line.slice(1, -1)}
          </p>
        );
      } else if (line.startsWith('• ')) {
        // Bullet point
        elements.push(
          <p key={key++} className="ml-3 text-slate-400">
            {line}
          </p>
        );
      } else if (line.trim() === '') {
        elements.push(<br key={key++} />);
      } else {
        elements.push(
          <p key={key++} className="text-slate-400">
            {line}
          </p>
        );
      }
    }

    return elements;
  };

  return (
    <aside className="flex flex-col border-l border-slate-800 bg-slate-900/40 rounded-lg overflow-hidden max-h-full">
      <button
        type="button"
        className="flex-shrink-0 flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/50 border-b border-slate-800"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>{category} – Help</span>
        <span className="text-xs text-slate-500">{collapsed ? '▶' : '▼'}</span>
      </button>
      
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 text-xs leading-relaxed">
          {renderContent(helpText)}
        </div>
      )}
    </aside>
  );
}
