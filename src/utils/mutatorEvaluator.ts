/**
 * Evaluator for MutatorCondition — determines which MutatorDefs are active
 * based on the character's current state (perks, statuses, allocations, etc.)
 *
 * Condition Functions:
 *   0  = Perk (has perk NodeAffected)
 *   1  = Buff Category (active status with matching Category text)
 *   2  = Skill Allocation (points in skill NodeAffected)
 *   3  = Level
 *   20 = Status (has active status NodeAffected)
 *   21 = Perk Category (has any perk in Category)
 *
 * Game-state conditions (4-19: climate, equipment, flying, etc.) cannot be
 * evaluated in the editor. By default they are treated as TRUE so that
 * abilities gated only on game-state still appear.
 *
 * Inclusion field:
 *   0 = Include condition (must pass for mutator to activate)
 *   1 = Exclude condition (if passes, mutator is blocked)
 *
 * MutatorDef flags:
 *   AllIncludesMustMatch:  't' = AND all includes, 'f' = OR any include
 *   AllExcludesMustMatch:  't' = AND all excludes to block, 'f' = OR any exclude blocks
 */

import { num, tf } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

/** Character state needed for mutator evaluation */
export interface MutatorEvalState {
  chosenPerkIds: Set<number>;
  /** Active StatusDef IDs */
  activeStatusIds: Set<number>;
  /** Active status categories (from StatusDef.Category for each active status) */
  activeStatusCategories: Set<string>;
  /** SkillDef ID → allocation points */
  skillAllocations: Map<number, number>;
  /** All chosen perks, used to check perk categories */
  chosenPerks: Row[];
}

/**
 * Evaluate a single MutatorCondition row against character state.
 * Returns true if the condition matches.
 */
function evaluateCondition(cond: Row, state: MutatorEvalState): boolean {
  const fn = num(cond.Condition ?? cond.Function);
  const operator = num(cond.Operator);
  const nodeAffected = num(cond.NodeAffected ?? cond.Param);
  const value = num(cond.Value ?? cond.ValueMin);
  const maxValue = num(cond.MaxValue ?? cond.ValueMax);
  const category = String(cond.Category ?? cond.Text ?? '').trim();

  switch (fn) {
    case 0: {
      // Perk — does character have perk NodeAffected?
      const hasPerk = state.chosenPerkIds.has(nodeAffected);
      return operator === 0 ? hasPerk : !hasPerk; // 0 == "has", 1 == "doesn't have"
    }

    case 1: {
      // Buff Category — in the game this checks the SpellDef Category of the buff
      // that applied a status. In the editor, we approximate by matching toggled
      // status names and explicit categories against the condition text.
      // Uses substring matching: "In Combat" status matches "Combat" category.
      const hasCategory = matchBuffCategory(category, state.activeStatusCategories);
      return operator === 0 ? hasCategory : !hasCategory;
    }

    case 2: {
      // Skill Allocation — compare allocation for skill NodeAffected against value
      const alloc = state.skillAllocations.get(nodeAffected) ?? 0;
      return compareNumeric(alloc, operator, value, maxValue);
    }

    case 3: {
      // Level — editor doesn't track level; treat as met
      return true;
    }

    case 20: {
      // Status — does character have active status NodeAffected?
      const hasStatus = state.activeStatusIds.has(nodeAffected);
      return operator === 0 ? hasStatus : !hasStatus;
    }

    case 21: {
      // Perk Category — does character have any perk in this category?
      const hasCategory = state.chosenPerks.some(
        (p) => String(p.Category ?? '').trim() === category,
      );
      return operator === 0 ? hasCategory : !hasCategory;
    }

    default: {
      // Game-state conditions (4-19: climate, equipment, flying, etc.)
      // Can't evaluate in editor — optimistically return true
      return true;
    }
  }
}

/**
 * Check if a buff category condition matches any active status.
 * In the game, Buff Category checks against the SpellDef.Category of the ability
 * that applied a status. In the editor, we approximate by:
 * 1. Exact match against active categories/names
 * 2. Substring match: "In Combat" status matches "Combat" category
 */
function matchBuffCategory(
  conditionCategory: string,
  activeCategories: Set<string>,
): boolean {
  const lower = conditionCategory.toLowerCase();
  for (const cat of activeCategories) {
    const catLower = cat.toLowerCase();
    // Exact match
    if (catLower === lower) return true;
    // Substring: active status name contains the condition category
    // e.g. "In Combat" contains "Combat"
    if (catLower.includes(lower)) return true;
  }
  return false;
}

/** Numeric comparison using the operator enum */
function compareNumeric(
  actual: number,
  operator: number,
  value: number,
  maxValue: number,
): boolean {
  switch (operator) {
    case 0: return actual === value;   // ==
    case 1: return actual !== value;   // !=
    case 2: return actual > value;     // >
    case 3: return actual >= value;    // >=
    case 4: return actual < value;     // <
    case 5: return actual <= value;    // <=
    case 6: return actual >= value && actual <= maxValue; // Between
    case 7: return actual < value || actual > maxValue;   // Outside
    default: return true;
  }
}

/**
 * Evaluate all mutators and return the set of MutatorDef IDs whose conditions
 * are currently satisfied.
 *
 * @param mutatorDefs  - MutatorDef rows
 * @param mutatorConds - MutatorCondition rows
 * @param state        - current character state
 */
export function evaluateActiveMutators(
  mutatorDefs: Row[],
  mutatorConds: Row[],
  state: MutatorEvalState,
): Set<number> {
  // Group conditions by MutatorID
  const condsByMutator = new Map<number, Row[]>();
  for (const cond of mutatorConds) {
    const mid = num(cond.MutatorID);
    if (!condsByMutator.has(mid)) condsByMutator.set(mid, []);
    condsByMutator.get(mid)!.push(cond);
  }

  const activeIds = new Set<number>();

  for (const def of mutatorDefs) {
    const mid = num(def.ID);
    const allIncMustMatch = tf(def['All Includes Must Match']);
    const allExcMustMatch = tf(def['All Excludes Must Match']);
    const conditions = condsByMutator.get(mid) ?? [];

    if (conditions.length === 0) {
      // No conditions → always active
      activeIds.add(mid);
      continue;
    }

    // Partition into include (0) and exclude (1) conditions
    const includes: Row[] = [];
    const excludes: Row[] = [];
    for (const c of conditions) {
      const inclusion = num(c.Inclusion ?? c.Mode);
      if (inclusion === 1) {
        excludes.push(c);
      } else {
        includes.push(c);
      }
    }

    // Evaluate includes
    let includePass: boolean;
    if (includes.length === 0) {
      includePass = true; // No include conditions → passes
    } else {
      const results = includes.map((c) => evaluateCondition(c, state));
      includePass = allIncMustMatch
        ? results.every(Boolean) // ALL must pass
        : results.some(Boolean); // ANY can pass
    }

    if (!includePass) continue; // Don't add to active set

    // Evaluate excludes — if exclusion condition(s) match, mutator is blocked
    if (excludes.length > 0) {
      const exResults = excludes.map((c) => evaluateCondition(c, state));
      const excluded = allExcMustMatch
        ? exResults.every(Boolean) // ALL must match to exclude
        : exResults.some(Boolean); // ANY match excludes

      if (excluded) continue; // Blocked by exclusion
    }

    activeIds.add(mid);
  }

  return activeIds;
}
