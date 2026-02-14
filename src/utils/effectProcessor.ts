/**
 * SpellEffect processor for applying ability effects
 *
 * SpellEffect Function types:
 * - 0: Print Message
 * - 1: Modify Stat (add value)
 * - 5: Buff Stat (temporary modifier)
 * - 7: Dispel Buff (remove by category)
 * - 9: Auto Use Ability (chain to another ability)
 * - 10: Set Stat (set to value)
 * - 11: Grant Status (add status)
 *
 * Who field:
 * - 0: Target
 * - 1: All Targets
 * - 2: Caster
 *
 * Outcome field:
 * - 0: General (always)
 * - 1: On Success
 * - 2: On Failure
 *
 * If field:
 * - 0: Always
 * - 1: Critical Only
 * - 2: Non-Critical Only
 */

import type { TrainingDummy } from '@/types/trainingDummy';
import {
  evaluateCombatFormula,
  buildNameLookups,
  type CombatFormulaContext,
  type FormulaTestResult,
} from './formulaParser';

import { num } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

/**
 * Result of processing a single effect
 */
export interface EffectResult {
  effectId: number;
  function: number;
  broadcast?: number;
  appliedToId?: number;
  appliedToName?: string;
  description: string;
  formulaResult?: FormulaTestResult;
  statChanged?: { statId: number; oldValue: number; newValue: number };
  statusGranted?: number;
  statusGrantCategory?: string; // The category the status was granted under
  statusRemoved?: number[];
  chainAbilityId?: number;
  message?: string;
}

/**
 * Result of processing all effects for an ability use
 */
export interface AbilityExecutionResult {
  spellId: number;
  spellName: string;
  success: boolean;
  critical: boolean;
  casterRoll?: FormulaTestResult;
  targetRolls?: Map<number, FormulaTestResult>;
  effects: EffectResult[];
  chainAbilities: number[];
  messages: string[];
}

/**
 * Combat state for a participant (caster or target)
 */
export interface CombatParticipant {
  id: number;
  name: string;
  stats: Map<number, number>;
  skills: Map<number, number>;
  activeStatusIds: Set<number>;
  /** Maps status ID -> category it was granted under (for Dispel Buff matching) */
  statusCategoryMap: Map<number, string>;
}

/**
 * Context for effect processing
 */
export interface EffectProcessingContext {
  caster: CombatParticipant;
  targets: CombatParticipant[];
  schemaData: Record<string, Row[]>;

  // Lookup tables (built once, reused)
  statNameToId: Map<string, number>;
  skillNameToId: Map<string, number>;
  /** Maps status ID -> grant category, built from SpellEffect function=11 rows */
  statusCategoryLookup: Map<number, string>;
  /** Maps status ID -> status name, for fallback category matching */
  statusNameLookup: Map<number, string>;

  // Roll results
  rollSuccess: boolean;
  rollCritical: boolean;
  rollResult?: number;
}

/**
 * Build context helpers from schema data
 */
export function buildEffectContext(
  schemaData: Record<string, Row[]>
): {
  statNameToId: Map<string, number>;
  skillNameToId: Map<string, number>;
  statusCategoryLookup: Map<number, string>;
  statusNameLookup: Map<number, string>;
} {
  const statRows = (schemaData.Stat ?? []) as Row[];
  const skillRows = (schemaData.SkillDef ?? []) as Row[];
  const statusRows = (schemaData.StatusDef ?? []) as Row[];
  const spellEffectRows = (schemaData.SpellEffect ?? []) as Row[];

  const { statNameToId, skillNameToId } = buildNameLookups(statRows, skillRows);

  // Build category lookup from SpellEffect function=11 (Grant Status) rows
  // These have a Category field that identifies what buff category the status belongs to
  const statusCategoryLookup = new Map<number, string>();
  for (const row of spellEffectRows) {
    const fn = num(row.Function);
    if (fn === 11) {
      const targetId = num(row.TargetID);
      const category = String(row.Category ?? '').trim();
      if (targetId > 0 && category) {
        statusCategoryLookup.set(targetId, category);
      }
    }
  }

  // Build status name lookup from StatusDef
  const statusNameLookup = new Map<number, string>();
  for (const row of statusRows) {
    const id = num(row.ID);
    const name = String(row.Name ?? '').trim();
    if (id > 0 && name) {
      statusNameLookup.set(id, name);
    }
  }

  return { statNameToId, skillNameToId, statusCategoryLookup, statusNameLookup };
}

/**
 * Filter effects by outcome and critical status
 */
export function filterEffectsByOutcome(
  effects: Row[],
  success: boolean,
  critical: boolean
): Row[] {
  return effects.filter((effect) => {
    const outcome = num(effect.Outcome, 0);
    const ifCondition = num(effect.If, 0);

    // Check outcome condition
    // 0 = General (always), 1 = On Success, 2 = On Failure
    if (outcome === 1 && !success) return false;
    if (outcome === 2 && success) return false;

    // Check if condition
    // 0 = Always, 1 = Critical Only, 2 = Non-Critical Only
    if (ifCondition === 1 && !critical) return false;
    if (ifCondition === 2 && critical) return false;

    return true;
  });
}

/**
 * Get effects for a specific target type
 */
export function filterEffectsByWho(effects: Row[], who: 0 | 1 | 2): Row[] {
  return effects.filter((effect) => num(effect.Who, 0) === who);
}

/**
 * Process a single effect on a target
 */
export function processEffect(
  effect: Row,
  target: CombatParticipant,
  context: EffectProcessingContext
): { result: EffectResult; updatedTarget: CombatParticipant } {
  const effectId = num(effect.ID ?? effect['Node ID']);
  const fn = num(effect.Function);
  const broadcast = num(effect.Broadcast, 0);
  const targetStatId = num(effect.TargetID);
  const formula = String(effect.AdjustFormula ?? '').trim();
  // For Print Message (fn=0) and Dispel Buff (fn=7), the message/category is in AdjustFormula
  // For other functions, AdjustFormula is the numeric formula
  const category = String(effect.Category ?? '').trim();

  const result: EffectResult = {
    effectId,
    function: fn,
    broadcast,
    appliedToId: target.id,
    appliedToName: target.name,
    description: '',
  };

  let updatedTarget = target;

  // Build formula context
  const formulaContext: CombatFormulaContext = {
    casterStats: context.caster.stats,
    casterSkills: context.caster.skills,
    targetStats: target.stats,
    targetSkills: target.skills,
    statNameToId: context.statNameToId,
    skillNameToId: context.skillNameToId,
    casterName: context.caster.name,
    targetName: target.name,
  };

  const isCodexPlaceholder = (value: string) => /^\[codex:[^\]]+\]$/i.test(value.trim());
  const stripCodexTokens = (value: string) => {
    if (!value) return '';
    return value
      .replace(/\[codex:[^\]]+\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  switch (fn) {
    case 0: {
      // Print Message - message text is in AdjustFormula field
      // Codex tokens are not available in this editor; strip them from display.
      let message = stripCodexTokens(formula);
      if (!message) {
        result.description = '';
        break;
      }
      // Substitute {caster} and {target}
      message = message.replace(/\{caster\}/gi, context.caster.name);
      message = message.replace(/\{target\}/gi, target.name);
      // Substitute {roll} with the roll result
      if (context.rollResult !== undefined) {
        message = message.replace(/\{roll\}/gi, String(context.rollResult));
      }
      result.message = message;
      result.description = `Message: ${message}`;
      break;
    }

    case 1: {
      // Modify Stat (add value)
      if (formula) {
        if (isCodexPlaceholder(formula)) {
          result.message = `Error: codex placeholder used as formula (not supported): ${formula}`;
          result.description = `Modify stat ${targetStatId}: codex formula not supported`;
          break;
        }

        try {
          const formulaResult = evaluateCombatFormula(formula, formulaContext);
          result.formulaResult = formulaResult;

          const oldValue = target.stats.get(targetStatId) ?? 0;
          const newValue = oldValue + formulaResult.rounded;

          const newStats = new Map(target.stats);
          newStats.set(targetStatId, newValue);
          updatedTarget = { ...target, stats: newStats };

          result.statChanged = { statId: targetStatId, oldValue, newValue };
          result.description = `Modify stat ${targetStatId}: ${oldValue} + ${formulaResult.rounded} = ${newValue}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.message = `Formula error (Modify Stat): ${message}`;
          result.description = `Modify stat ${targetStatId}: formula failed`;
        }
      }
      break;
    }

    case 5: {
      // Buff Stat (temporary modifier - for now, treat same as modify)
      if (formula) {
        if (isCodexPlaceholder(formula)) {
          result.message = `Error: codex placeholder used as formula (not supported): ${formula}`;
          result.description = `Buff stat ${targetStatId}: codex formula not supported`;
          break;
        }

        try {
          const formulaResult = evaluateCombatFormula(formula, formulaContext);
          result.formulaResult = formulaResult;

          const oldValue = target.stats.get(targetStatId) ?? 0;
          const newValue = oldValue + formulaResult.rounded;

          const newStats = new Map(target.stats);
          newStats.set(targetStatId, newValue);
          updatedTarget = { ...target, stats: newStats };

          result.statChanged = { statId: targetStatId, oldValue, newValue };
          result.description = `Buff stat ${targetStatId}: ${oldValue} + ${formulaResult.rounded} = ${newValue}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.message = `Formula error (Buff Stat): ${message}`;
          result.description = `Buff stat ${targetStatId}: formula failed`;
        }
      }
      break;
    }

    case 7: {
      // Dispel Buff (remove by category)
      // Category to dispel comes from the effect's Category field (or AdjustFormula as fallback)
      const categoryToDispel = (category || formula).toLowerCase();
      const removedStatuses: number[] = [];

      const newStatusIds = new Set(target.activeStatusIds);
      const newCategoryMap = new Map(target.statusCategoryMap);

      for (const statusId of target.activeStatusIds) {
        // Check multiple sources for category match:
        // 1. The category the status was granted under (on the participant)
        const grantCategory = target.statusCategoryMap.get(statusId);
        // 2. The global category lookup (from SpellEffect function=11)
        const globalCategory = context.statusCategoryLookup.get(statusId);
        // 3. The status name itself (RPR often uses status name as category)
        const statusName = context.statusNameLookup.get(statusId);

        const matches = [grantCategory, globalCategory, statusName]
          .filter(Boolean)
          .some((c) => c!.toLowerCase() === categoryToDispel);

        if (matches) {
          newStatusIds.delete(statusId);
          newCategoryMap.delete(statusId);
          removedStatuses.push(statusId);
        }
      }

      updatedTarget = {
        ...target,
        activeStatusIds: newStatusIds,
        statusCategoryMap: newCategoryMap,
      };

      result.statusRemoved = removedStatuses;
      result.description = `Dispel "${categoryToDispel}": removed ${removedStatuses.length} status(es)`;
      break;
    }

    case 9: {
      // Auto Use Ability (chain)
      result.chainAbilityId = targetStatId; // TargetID = SpellDef ID to chain
      result.description = `Chain to ability ${targetStatId}`;
      break;
    }

    case 10: {
      // Set Stat (set to value)
      if (formula) {
        if (isCodexPlaceholder(formula)) {
          result.message = `Error: codex placeholder used as formula (not supported): ${formula}`;
          result.description = `Set stat ${targetStatId}: codex formula not supported`;
          break;
        }

        try {
          const formulaResult = evaluateCombatFormula(formula, formulaContext);
          result.formulaResult = formulaResult;

          const oldValue = target.stats.get(targetStatId) ?? 0;
          const newValue = formulaResult.rounded;

          const newStats = new Map(target.stats);
          newStats.set(targetStatId, newValue);
          updatedTarget = { ...target, stats: newStats };

          result.statChanged = { statId: targetStatId, oldValue, newValue };
          result.description = `Set stat ${targetStatId}: ${oldValue} -> ${newValue}`;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.message = `Formula error (Set Stat): ${message}`;
          result.description = `Set stat ${targetStatId}: formula failed`;
        }
      }
      break;
    }

    case 11: {
      // Grant Status
      const statusId = targetStatId;
      // Category comes from the SpellEffect's Category field
      const grantCategory = category || context.statusCategoryLookup.get(statusId) || '';

      const newStatusIds = new Set(target.activeStatusIds);
      newStatusIds.add(statusId);

      const newCategoryMap = new Map(target.statusCategoryMap);
      if (grantCategory) {
        newCategoryMap.set(statusId, grantCategory);
      }

      updatedTarget = {
        ...target,
        activeStatusIds: newStatusIds,
        statusCategoryMap: newCategoryMap,
      };

      result.statusGranted = statusId;
      result.statusGrantCategory = grantCategory || undefined;
      result.description = `Grant status ${statusId}${grantCategory ? ` (${grantCategory})` : ''}`;
      break;
    }

    default:
      result.description = `Unknown effect function ${fn}`;
  }

  return { result, updatedTarget };
}

/**
 * Process all effects for an ability use
 */
export function processAbilityEffects(
  _spell: Row,
  effects: Row[],
  context: EffectProcessingContext
): {
  results: EffectResult[];
  updatedCaster: CombatParticipant;
  updatedTargets: CombatParticipant[];
  chainAbilities: number[];
  messages: string[];
} {
  const results: EffectResult[] = [];
  const chainAbilities: number[] = [];
  const messages: string[] = [];

  let updatedCaster = context.caster;
  let updatedTargets = [...context.targets];

  // Filter effects by outcome
  const applicableEffects = filterEffectsByOutcome(
    effects,
    context.rollSuccess,
    context.rollCritical
  );

  // Process caster effects (Who = 2)
  const casterEffects = filterEffectsByWho(applicableEffects, 2);
  for (const effect of casterEffects) {
    const { result, updatedTarget } = processEffect(effect, updatedCaster, context);
    results.push(result);
    updatedCaster = updatedTarget;

    if (result.chainAbilityId) chainAbilities.push(result.chainAbilityId);
    if (result.message && result.broadcast !== 2) messages.push(result.message);
  }

  // Process target effects (Who = 0) for each target
  const targetEffects = filterEffectsByWho(applicableEffects, 0);
  for (let i = 0; i < updatedTargets.length; i++) {
    let target = updatedTargets[i];

    for (const effect of targetEffects) {
      const { result, updatedTarget } = processEffect(effect, target, {
        ...context,
        caster: updatedCaster, // Use updated caster stats
      });
      results.push(result);
      target = updatedTarget;

      if (result.chainAbilityId) chainAbilities.push(result.chainAbilityId);
      if (result.message && result.broadcast !== 2) messages.push(result.message);
    }

    updatedTargets[i] = target;
  }

  // Process all-targets effects (Who = 1)
  const allTargetsEffects = filterEffectsByWho(applicableEffects, 1);
  for (const effect of allTargetsEffects) {
    for (let i = 0; i < updatedTargets.length; i++) {
      let target = updatedTargets[i];

      const { result, updatedTarget } = processEffect(effect, target, {
        ...context,
        caster: updatedCaster,
      });
      results.push(result);
      target = updatedTarget;

      if (result.chainAbilityId) chainAbilities.push(result.chainAbilityId);
      if (result.message && result.broadcast !== 2) messages.push(result.message);

      updatedTargets[i] = target;
    }
  }

  return {
    results,
    updatedCaster,
    updatedTargets,
    chainAbilities,
    messages,
  };
}

/**
 * Convert a TrainingDummy to a CombatParticipant
 */
export function dummyToParticipant(dummy: TrainingDummy): CombatParticipant {
  return {
    id: dummy.id,
    name: dummy.name,
    stats: new Map(dummy.stats),
    skills: new Map(), // Dummies don't have skills
    activeStatusIds: new Set(dummy.activeStatusIds),
    statusCategoryMap: new Map(dummy.statusCategoryMap ?? []),
  };
}

/**
 * Convert a CombatParticipant back to a TrainingDummy
 */
export function participantToDummy(
  participant: CombatParticipant,
  originalDummy: TrainingDummy
): TrainingDummy {
  return {
    ...originalDummy,
    stats: participant.stats,
    activeStatusIds: participant.activeStatusIds,
    statusCategoryMap: participant.statusCategoryMap,
  };
}
