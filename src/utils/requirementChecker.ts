/**
 * Utility for checking SpellReqDef requirements against character state
 */

import { num, tf } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

/**
 * Character state needed for requirement checking
 */
export interface CharacterState {
  // SkillDef ID -> total value (allocation + perk bonuses + natural)
  skillTotals: Map<number, number>;

  // SkillDef ID -> allocation only (points invested)
  skillAllocations: Map<number, number>;

  // Stat ID -> computed value
  statValues: Map<number, number>;

  // Set of chosen PerkDef IDs
  chosenPerkIds: Set<number>;

  // Set of active StatusDef IDs
  activeStatusIds: Set<number>;

  // Set of active status categories (for category-based checks)
  activeStatusCategories: Set<string>;

  // Conan level (if applicable)
  conanLevel?: number;

  // For item-based requirements (future)
  heldItemIds?: Set<number>;
}

/**
 * Lookup tables for resolving IDs to names
 */
export interface LookupTables {
  stats: Map<number, Row>;         // Stat ID -> Stat row
  skills: Map<number, Row>;        // SkillDef ID -> SkillDef row
  perks: Map<number, Row>;         // PerkDef ID -> PerkDef row
  statuses: Map<number, Row>;      // StatusDef ID -> StatusDef row
}

/**
 * Result of checking a single requirement
 */
export interface RequirementResult {
  met: boolean;
  text: string;           // Human-readable description
  currentValue?: number;  // Current value (for stat/skill checks)
  requiredValue?: number; // Required value (for stat/skill checks)
}

/**
 * Result of checking all requirements for an ability
 */
export interface AbilityRequirementsResult {
  allMet: boolean;        // True if all requirements pass (or any, depending on mode)
  requirements: RequirementResult[];
  requirementsMode: 't' | 'f';  // 't' = ALL, 'f' = ANY
}

/**
 * Operator comparison functions.
 *
 * NOTE: The WHRpR dataset uses operator codes differently than the older guide.
 * In practice (validated from SpellReqDef usage patterns in WHRpR.txt):
 * - 0: equal (cooldowns must be 0)
 * - 1: not equal (used for negation checks like NOT having a perk/status)
 * - 2: greater than (Health > 0 for turn flow)
 * - 3: greater or equal (action points >= 1)
 * - 4: less than (Health < 10 for "below 10 HP" effects)
 */
const OPERATOR_FNS: Record<number, (current: number, required: number) => boolean> = {
  0: (c, r) => c === r,
  1: (c, r) => c !== r,
  2: (c, r) => c > r,
  3: (c, r) => c >= r,
  4: (c, r) => c < r,
};

const OPERATOR_LABELS: Record<number, string> = {
  0: 'equal to',
  1: 'not equal to',
  2: 'greater than',
  3: 'at least',
  4: 'below',
};

/**
 * Check a single requirement against character state
 */
export function checkRequirement(
  req: Row,
  characterState: CharacterState,
  lookups: LookupTables
): RequirementResult {
  const fn = num(req.Function);
  const operator = num(req.Operator, 0);
  const param = num(req.Param);
  const valueMin = num(req.ValueMin);
  const text = String(req.Text ?? '').trim();

  const operatorFn = OPERATOR_FNS[operator] ?? OPERATOR_FNS[0];
  const operatorLabel = OPERATOR_LABELS[operator] ?? 'at least';

  switch (fn) {
    case 0: { // Stat check
      const stat = lookups.stats.get(param);
      const statName = stat ? String(stat.Name ?? `Stat ${param}`) : `Stat ${param}`;
      const currentValue = characterState.statValues.get(param) ?? 0;
      const met = operatorFn(currentValue, valueMin);

      return {
        met,
        text: `${statName} is ${operatorLabel} ${valueMin}`,
        currentValue,
        requiredValue: valueMin,
      };
    }

    case 1: { // Skill check (total value including bonuses)
      const skill = lookups.skills.get(param);
      const skillName = skill ? String(skill.Name ?? `Skill ${param}`) : `Skill ${param}`;
      const currentValue = characterState.skillTotals.get(param) ?? 0;
      const met = operatorFn(currentValue, valueMin);

      return {
        met,
        text: `${skillName} is ${operatorLabel} ${valueMin}`,
        currentValue,
        requiredValue: valueMin,
      };
    }

    case 2: { // Skill allocation check (points invested only)
      const skill = lookups.skills.get(param);
      const skillName = skill ? String(skill.Name ?? `Skill ${param}`) : `Skill ${param}`;
      const currentValue = characterState.skillAllocations.get(param) ?? 0;
      const met = operatorFn(currentValue, valueMin);

      return {
        met,
        text: `${skillName} allocation is ${operatorLabel} ${valueMin}`,
        currentValue,
        requiredValue: valueMin,
      };
    }

    case 3: { // Perk ownership
      const perk = lookups.perks.get(param);
      const perkName = perk ? String(perk.Name ?? `Perk ${param}`) : `Perk ${param}`;
      const hasPerk = characterState.chosenPerkIds.has(param);

      // In WHRpR SpellReqDef, perk requirements use operator:
      // - 0: require has perk
      // - 1: require does NOT have perk
      const requireHas = operator !== 1;
      const met = requireHas ? hasPerk : !hasPerk;

      return {
        met,
        text: requireHas ? `Has ${perkName}` : `Does not have ${perkName}`,
      };
    }

    case 4: { // Conan Level
      const currentLevel = characterState.conanLevel ?? 0;
      const met = operatorFn(currentLevel, valueMin);

      return {
        met,
        text: `Character level is ${operatorLabel} ${valueMin}`,
        currentValue: currentLevel,
        requiredValue: valueMin,
      };
    }

    case 5: { // Status Category
      // Check if any active status has this category
      const hasCategory = characterState.activeStatusCategories.has(text);

      // In WHRpR SpellReqDef, status category requirements use operator:
      // - 0: require has category
      // - 1: require does NOT have category
      const requireHas = operator !== 1;
      const met = requireHas ? hasCategory : !hasCategory;

      return {
        met,
        text: requireHas ? `Has status: ${text}` : `Does not have status: ${text}`,
      };
    }

    case 6: { // Item ID (Conan item)
      const hasItem = characterState.heldItemIds?.has(param) ?? false;
      const requireHas = operator !== 1;
      const met = requireHas ? hasItem : !hasItem;

      return {
        met,
        text: requireHas ? `Has item #${param}` : `Does not have item #${param}`,
      };
    }

    default:
      return {
        met: true, // Unknown requirements pass by default
        text: `Unknown requirement (function ${fn})`,
      };
  }
}

/**
 * Check all requirements for an ability
 *
 * @param spell - The SpellDef row
 * @param requirements - Array of SpellReqDef rows for this spell
 * @param characterState - Current character state
 * @param lookups - Lookup tables for ID -> name resolution
 */
export function checkAbilityRequirements(
  spell: Row,
  requirements: Row[],
  characterState: CharacterState,
  lookups: LookupTables
): AbilityRequirementsResult {
  // RequirementsMode: 't' = ALL must pass, 'f' = ANY can pass
  const requirementsMode = tf(spell.RequirementsMode) ? 't' : 'f';

  if (requirements.length === 0) {
    return {
      allMet: true,
      requirements: [],
      requirementsMode,
    };
  }

  const results: RequirementResult[] = requirements.map((req) =>
    checkRequirement(req, characterState, lookups)
  );

  // Determine if all requirements are met based on mode
  const allMet =
    requirementsMode === 't'
      ? results.every((r) => r.met)      // ALL must pass
      : results.some((r) => r.met);       // ANY can pass

  return {
    allMet,
    requirements: results,
    requirementsMode,
  };
}

/**
 * Build lookup tables from schema data
 */
export function buildLookupTables(data: Record<string, Row[]>): LookupTables {
  const stats = new Map<number, Row>();
  const skills = new Map<number, Row>();
  const perks = new Map<number, Row>();
  const statuses = new Map<number, Row>();

  // Build stat lookup
  for (const row of (data.Stat ?? []) as Row[]) {
    const id = num(row.ID);
    if (id > 0) {
      stats.set(id, row);
    }
  }

  // Build skill lookup
  for (const row of (data.SkillDef ?? []) as Row[]) {
    const id = num(row.ID);
    if (id > 0) {
      skills.set(id, row);
    }
  }

  // Build perk lookup
  for (const row of (data.PerkDef ?? []) as Row[]) {
    const id = num(row.ID);
    if (id > 0) {
      perks.set(id, row);
    }
  }

  // Build status lookup
  for (const row of (data.StatusDef ?? []) as Row[]) {
    const id = num(row.ID);
    if (id > 0) {
      statuses.set(id, row);
    }
  }

  return { stats, skills, perks, statuses };
}

/**
 * Create an empty character state (useful for testing/initialization)
 */
export function createEmptyCharacterState(): CharacterState {
  return {
    skillTotals: new Map(),
    skillAllocations: new Map(),
    statValues: new Map(),
    chosenPerkIds: new Set(),
    activeStatusIds: new Set(),
    activeStatusCategories: new Set(),
    conanLevel: 0,
    heldItemIds: new Set(),
  };
}
