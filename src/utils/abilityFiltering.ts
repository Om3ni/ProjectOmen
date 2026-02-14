/**
 * Utility functions for filtering and grouping abilities (SpellDef)
 */

import { num, tf } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

/**
 * Options for filtering abilities with extended grant sources
 */
export interface AbilityFilterOptions {
  spellDefs: Row[];
  perkActions: Row[];
  mutatorActions?: Row[];
  statusActions?: Row[];
  chosenPerkIds: Set<number>;
  activeStatusIds?: Set<number>;   // StatusDef IDs currently active on character
  activeMutatorIds?: Set<number>;  // MutatorDef IDs whose conditions are met
  adminMode?: boolean;
}

/**
 * Get abilities available to the player based on:
 * 1. CommonAbility = 't' (available to everyone)
 * 2. Granted by chosen perks via PerkAction Function=8
 * 3. Granted by active statuses via StatusAction Function=3
 * 4. Granted by active mutators via MutatorAction Function=3
 *
 * Note: For Phase 1, mutator conditions are not fully evaluated.
 * We collect abilities that COULD be granted by mutators and show them
 * when adminMode is enabled or when activeMutatorIds explicitly includes them.
 */
export function getAvailableAbilities(options: AbilityFilterOptions): Row[];

/**
 * @deprecated Use the options object overload instead
 */
export function getAvailableAbilities(
  spellDefs: Row[],
  perkActions: Row[],
  chosenPerkIds: Set<number>,
  adminMode?: boolean
): Row[];

export function getAvailableAbilities(
  optionsOrSpellDefs: AbilityFilterOptions | Row[],
  perkActionsArg?: Row[],
  chosenPerkIdsArg?: Set<number>,
  adminModeArg?: boolean
): Row[] {
  // Handle both overloads
  let options: AbilityFilterOptions;

  if (Array.isArray(optionsOrSpellDefs)) {
    // Legacy call signature
    options = {
      spellDefs: optionsOrSpellDefs,
      perkActions: perkActionsArg ?? [],
      chosenPerkIds: chosenPerkIdsArg ?? new Set(),
      adminMode: adminModeArg ?? false,
    };
  } else {
    options = optionsOrSpellDefs;
  }

  const {
    spellDefs,
    perkActions,
    mutatorActions = [],
    statusActions = [],
    chosenPerkIds,
    activeStatusIds = new Set(),
    activeMutatorIds = new Set(),
    adminMode = false,
  } = options;

  // Build set of ability IDs granted by various sources
  const grantedAbilityIds = new Set<number>();

  // 1. Abilities granted by chosen perks (PerkAction Function=8)
  for (const action of perkActions) {
    const perkId = num(action.PerkID);
    const fn = num(action.Function);

    // Function 8 = Grant Ability
    if (fn === 8 && chosenPerkIds.has(perkId)) {
      const abilityId = num(action.TargetID);
      if (abilityId > 0) {
        grantedAbilityIds.add(abilityId);
      }
    }
  }

  // 2. Abilities granted by active statuses (StatusAction Function=3)
  for (const action of statusActions) {
    const statusId = num(action.StatusID);
    const fn = num(action.Function);

    // Function 3 = Grant Ability
    if (fn === 3 && activeStatusIds.has(statusId)) {
      const abilityId = num(action.TargetID);
      if (abilityId > 0) {
        grantedAbilityIds.add(abilityId);
      }
    }
  }

  // 3. Abilities granted by active mutators (MutatorAction Function=3)
  for (const action of mutatorActions) {
    const mutatorId = num(action.MutatorID);
    const fn = num(action.Function);

    // Function 3 = Grant Ability
    if (fn === 3 && activeMutatorIds.has(mutatorId)) {
      const abilityId = num(action.TargetID);
      if (abilityId > 0) {
        grantedAbilityIds.add(abilityId);
      }
    }
  }

  return spellDefs.filter((spell) => {
    const id = num(spell.ID ?? spell['Node ID']);
    const category = String(spell.Category ?? '').trim();
    const isCommon = tf(spell.CommonAbility);
    const isGranted = grantedAbilityIds.has(id);

    // Filter out admin-only unless in admin mode
    if (category.toLowerCase() === 'admin' && !adminMode) {
      return false;
    }

    // Include if common OR granted
    return isCommon || isGranted;
  });
}

/**
 * Get all abilities that could potentially be granted by mutators.
 * Useful for admin mode to see all possible abilities without evaluating conditions.
 */
export function getAllMutatorGrantedAbilityIds(mutatorActions: Row[]): Set<number> {
  const ids = new Set<number>();
  for (const action of mutatorActions) {
    const fn = num(action.Function);
    if (fn === 3) { // Grant Ability
      const abilityId = num(action.TargetID);
      if (abilityId > 0) {
        ids.add(abilityId);
      }
    }
  }
  return ids;
}

/**
 * Get all abilities that could potentially be granted by statuses.
 */
export function getAllStatusGrantedAbilityIds(statusActions: Row[]): Set<number> {
  const ids = new Set<number>();
  for (const action of statusActions) {
    const fn = num(action.Function);
    if (fn === 3) { // Grant Ability
      const abilityId = num(action.TargetID);
      if (abilityId > 0) {
        ids.add(abilityId);
      }
    }
  }
  return ids;
}

/**
 * Check if an ability is a category separator (visual divider)
 * Skills-style separators use names like "=====Combat Flow=====".
 */
export function isCategorySeparator(spell: Row): boolean {
  const name = String(spell.Name ?? '').trim();
  return name.startsWith('=====') && name.endsWith('=====');
}

/**
 * Group abilities by category, preserving encounter order.
 * Returns an array of { category, abilities, isSeparator } in the order they appear.
 */
export interface CategoryGroup {
  category: string;
  abilities: Row[];
  isSeparator: boolean;
  separatorLabel?: string; // For separator rows, the name field
}

export function groupAbilitiesByCategory(abilities: Row[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  const categoryOrder: string[] = [];
  const categoryMap = new Map<string, Row[]>();

  for (const ability of abilities) {
    const category = String(ability.Category ?? '').trim() || 'Uncategorized';

    // Handle separators specially
    if (isCategorySeparator(ability)) {
      // Separators create a visual break - we'll include them as marker entries
      const separatorLabel = String(ability.Name ?? '').replace(/^=+|=+$/g, '').trim();
      groups.push({
        category: `__separator_${groups.length}`,
        abilities: [],
        isSeparator: true,
        separatorLabel: separatorLabel || 'Divider'
      });
      continue;
    }

    if (!categoryMap.has(category)) {
      categoryOrder.push(category);
      categoryMap.set(category, []);
    }

    categoryMap.get(category)!.push(ability);
  }

  // Build final groups in order, inserting separators where they appeared
  // For simplicity, we'll just use categoryOrder since separators are already in groups
  for (const category of categoryOrder) {
    const abilitiesInCategory = categoryMap.get(category) ?? [];
    if (abilitiesInCategory.length > 0) {
      groups.push({
        category,
        abilities: abilitiesInCategory,
        isSeparator: false
      });
    }
  }

  return groups;
}

/**
 * Alternative grouping that preserves exact data order including separators as dividers
 */
export function groupAbilitiesPreservingOrder(abilities: Row[]): CategoryGroup[] {
  const result: CategoryGroup[] = [];
  let currentCategory: string | null = null;
  let currentGroup: Row[] = [];

  for (const ability of abilities) {
    // Check if this is a separator
    if (isCategorySeparator(ability)) {
      // Flush current group if any
      if (currentCategory && currentGroup.length > 0) {
        result.push({
          category: currentCategory,
          abilities: currentGroup,
          isSeparator: false
        });
      }

      // Add separator
      const separatorLabel = String(ability.Name ?? '').replace(/^=+|=+$/g, '').trim();
      result.push({
        category: `__separator_${result.length}`,
        abilities: [],
        isSeparator: true,
        separatorLabel: separatorLabel || 'Divider'
      });

      currentCategory = null;
      currentGroup = [];
      continue;
    }

    const category = String(ability.Category ?? '').trim() || 'Uncategorized';

    // If category changed, flush and start new group
    if (category !== currentCategory) {
      if (currentCategory && currentGroup.length > 0) {
        result.push({
          category: currentCategory,
          abilities: currentGroup,
          isSeparator: false
        });
      }
      currentCategory = category;
      currentGroup = [ability];
    } else {
      currentGroup.push(ability);
    }
  }

  // Flush final group
  if (currentCategory && currentGroup.length > 0) {
    result.push({
      category: currentCategory,
      abilities: currentGroup,
      isSeparator: false
    });
  }

  return result;
}

/**
 * Format target info for display
 * e.g., "Select 1 target within 5 tiles" or "Targets self"
 */
export function formatTargetInfo(spell: Row): string {
  const targetType = num(spell.TargetType, 0);
  const numTargets = num(spell['#Targets'], 1);
  const range = num(spell.Range, 0);

  // TargetType enum: 0=Selected, 1=Caster, 2=All, 3=All Others, 4=Selected Others
  switch (targetType) {
    case 1: // Caster (self)
      return 'Targets self';
    case 2: // All
      return range > 0
        ? `Targets all within ${range} tile${range !== 1 ? 's' : ''}`
        : 'Targets all';
    case 3: // All Others
      return range > 0
        ? `Targets all others within ${range} tile${range !== 1 ? 's' : ''}`
        : 'Targets all others';
    case 4: // Selected Others
    case 0: // Selected
    default:
      if (numTargets === 0) {
        return 'Targets self';
      }
      const targetWord = numTargets === 1 ? 'target' : 'targets';
      if (range > 0) {
        return `Select ${numTargets} ${targetWord} within a ${range} tile radius`;
      }
      return `Select ${numTargets} ${targetWord}`;
  }
}

/**
 * Parse RGBA color string like "1.0,0.5,0.0,1.0" to CSS color
 */
export function parseIconColor(colorStr: unknown): string {
  const str = String(colorStr ?? '1.0,1.0,1.0,1.0');
  const parts = str.split(',').map(s => parseFloat(s.trim()));

  if (parts.length >= 3) {
    const r = Math.round((parts[0] ?? 1) * 255);
    const g = Math.round((parts[1] ?? 1) * 255);
    const b = Math.round((parts[2] ?? 1) * 255);
    const a = parts[3] ?? 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return 'rgba(255, 255, 255, 1)';
}
