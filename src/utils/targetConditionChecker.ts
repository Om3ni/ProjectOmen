/**
 * SpellTargetCond evaluation for validating legitimate targets.
 *
 * Important semantics (per your guidance):
 * - SpellReqDef: requirements for the caster
 * - SpellTargetCond: conditions that must be true/false for a legitimate target
 */

import { num, tf } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

export interface TargetConditionLookups {
  statuses?: Map<number, Row>; // StatusDef ID -> row (for name resolution only)
}

export interface TargetConditionContext {
  activeStatusIds: Set<number>;
  activeStatusCategories: Set<string>;
}

export interface TargetConditionCheckResult {
  allowed: boolean;
  reasons: string[];
}

function describeStatus(statusId: number, lookups: TargetConditionLookups): string {
  const row = lookups.statuses?.get(statusId);
  const name = row ? String(row.Name ?? '').trim() : '';
  return name ? `${name} (${statusId})` : `Status ${statusId}`;
}

function evalStatusCondition(
  operator: number,
  statusId: number,
  ctx: TargetConditionContext,
  lookups: TargetConditionLookups
): { met: boolean; text: string } {
  const has = ctx.activeStatusIds.has(statusId);
  const label = describeStatus(statusId, lookups);

  // Operators for categorical checks
  // 0 == (has), 1 != (does not have)
  if (operator === 1) {
    return { met: !has, text: `must NOT have ${label}` };
  }
  return { met: has, text: `must have ${label}` };
}

function evalBuffCategoryCondition(
  operator: number,
  category: string,
  ctx: TargetConditionContext
): { met: boolean; text: string } {
  const cat = category.trim();
  if (!cat) {
    // Empty categories are not actionable; treat as met.
    return { met: true, text: 'buff category (empty)' };
  }
  const has = ctx.activeStatusCategories.has(cat);
  if (operator === 1) {
    return { met: !has, text: `must NOT be in buff category "${cat}"` };
  }
  return { met: has, text: `must be in buff category "${cat}"` };
}

function checkSingleTargetCond(
  cond: Row,
  ctx: TargetConditionContext,
  lookups: TargetConditionLookups
): { met: boolean; text: string; mode: 0 | 1 } {
  const mode = num(cond.Mode, 0) as 0 | 1; // 0 include, 1 exclude
  const fn = num(cond.Function);
  const operator = num(cond.Operator, 0);
  const param = num(cond.Param);
  const text = String(cond.Text ?? '').trim();

  switch (fn) {
    case 1: // Buff Category
      return { ...evalBuffCategoryCondition(operator, text, ctx), mode };
    case 20: // Status
      return { ...evalStatusCondition(operator, param, ctx, lookups), mode };

    default:
      // We currently only model statuses + buff categories for training dummies.
      // For other condition types, do not block targeting.
      return { met: true, text: '', mode };
  }
}

/**
 * Evaluate all SpellTargetCond rows for a given target.
 *
 * Include rows:
 * - If TargetCondIncludeAll=t => all include rows must pass
 * - Otherwise => any include row may pass
 *
 * Exclude rows:
 * - Exclude rows disqualify a target when they are met
 * - If TargetCondExcludeAll=t => disqualify only when ALL exclude rows are met
 * - Otherwise => disqualify when ANY exclude row is met
 */
export function checkSpellTargetConditions(
  spell: Row,
  targetConds: Row[],
  targetCtx: TargetConditionContext,
  lookups: TargetConditionLookups = {}
): TargetConditionCheckResult {
  const includeAll = tf(spell.TargetCondIncludeAll);
  const excludeAll = tf(spell.TargetCondExcludeAll);

  const includeRows = targetConds.filter((r) => num(r.Mode, 0) === 0);
  const excludeRows = targetConds.filter((r) => num(r.Mode, 0) === 1);

  const includeChecks = includeRows
    .map((r) => checkSingleTargetCond(r, targetCtx, lookups))
    .filter((r) => r.text);
  const excludeChecks = excludeRows
    .map((r) => checkSingleTargetCond(r, targetCtx, lookups))
    .filter((r) => r.text);

  const includeOk =
    includeChecks.length === 0
      ? true
      : includeAll
        ? includeChecks.every((c) => c.met)
        : includeChecks.some((c) => c.met);

  const excludeTriggered =
    excludeChecks.length === 0
      ? false
      : excludeAll
        ? excludeChecks.every((c) => c.met)
        : excludeChecks.some((c) => c.met);

  const reasons: string[] = [];

  if (!includeOk) {
    // Show unmet include requirements
    for (const c of includeChecks) {
      if (!c.met) reasons.push(c.text);
    }
  }

  if (excludeTriggered) {
    // Show the exclude conditions that are currently true
    for (const c of excludeChecks) {
      if (c.met) reasons.push(`excluded: ${c.text.replace(/^must\s+/i, '')}`);
    }
  }

  return {
    allowed: includeOk && !excludeTriggered,
    reasons,
  };
}
