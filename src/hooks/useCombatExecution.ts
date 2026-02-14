/**
 * Hook for executing combat abilities
 *
 * Handles:
 * - Caster roll execution
 * - Target DC evaluation
 * - SpellEffect processing
 * - State updates
 * - Chat logging
 */

import { useCallback, useMemo } from 'react';
import { num } from '@/utils/rprHelpers';
import type { TrainingDummy } from '@/types/trainingDummy';
import {
  evaluateCombatFormula,
  buildNameLookups,
  type CombatFormulaContext,
} from '@/utils/formulaParser';
import {
  processAbilityEffects,
  buildEffectContext,
  dummyToParticipant,
  participantToDummy,
  type CombatParticipant,
  type EffectProcessingContext,
  type EffectResult,
} from '@/utils/effectProcessor';

type Row = Record<string, unknown>;

/**
 * Result of executing an ability
 */
export interface AbilityExecutionResult {
  spellId: number;
  spellName: string;
  casterName: string;
  success: boolean;
  critical: boolean;
  statIdToName?: Map<number, string>;
  casterRoll?: {
    formula: string;
    total: number;
    rolls: number[];
    natural20: boolean;
    natural1: boolean;
  };
  targetResults: Map<number, {
    targetName: string;
    dc?: number;
    success: boolean;
  }>;
  effects: EffectResult[];
  messages: string[];
  updatedDummies: TrainingDummy[];
}

export interface UseCombatExecutionOptions {
  schemaData: Record<string, Row[]>;

  // Character state (caster)
  statValues: Map<number, number>;
  skillTotals: Map<number, number>;
  characterName?: string;

  // Status state from character sheet
  activeStatusIds?: Set<number>;
  statusCategoryMap?: Map<number, string>;

  // Dice configuration for CasterRollType=1 (Roll Stat)
  numDice?: number;
  diceSides?: number;
}

export interface UseCombatExecutionResult {
  executeAbility: (
    spellId: number,
    targetIds: number[],
    dummies: TrainingDummy[]
  ) => AbilityExecutionResult | null;
}

export function useCombatExecution(
  options: UseCombatExecutionOptions
): UseCombatExecutionResult {
  const {
    schemaData, statValues, skillTotals, characterName = 'Player',
    activeStatusIds: casterStatusIds = new Set<number>(),
    statusCategoryMap: casterStatusCategoryMap = new Map<number, string>(),
    numDice = 1, diceSides = 20,
  } = options;

  const statIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of (schemaData.Stat ?? []) as Row[]) {
      const id = num(row.ID ?? row['Node ID']);
      if (id <= 0) continue;
      const name = String(row.Name ?? '').trim();
      if (name) map.set(id, name);
    }
    return map;
  }, [schemaData]);

  // Build lookup tables
  const lookups = useMemo(() => {
    const statRows = (schemaData.Stat ?? []) as Row[];
    const skillRows = (schemaData.SkillDef ?? []) as Row[];
    return buildNameLookups(statRows, skillRows);
  }, [schemaData]);

  const effectContext = useMemo(() => {
    return buildEffectContext(schemaData);
  }, [schemaData]);

  // Build spell lookup
  const spellLookup = useMemo(() => {
    const map = new Map<number, Row>();
    for (const row of (schemaData.SpellDef ?? []) as Row[]) {
      const id = num(row.ID ?? row['Node ID']);
      if (id > 0) {
        map.set(id, row);
      }
    }
    return map;
  }, [schemaData]);

  // Build spell effects lookup
  const spellEffectsLookup = useMemo(() => {
    const map = new Map<number, Row[]>();
    for (const row of (schemaData.SpellEffect ?? []) as Row[]) {
      const spellId = num(row.SpellID);
      if (!map.has(spellId)) {
        map.set(spellId, []);
      }
      map.get(spellId)!.push(row);
    }
    return map;
  }, [schemaData]);

  const executeAbility = useCallback(
    (
      spellId: number,
      targetIds: number[],
      dummies: TrainingDummy[]
    ): AbilityExecutionResult | null => {
      const spell = spellLookup.get(spellId);
      if (!spell) {
        console.error(`Spell ${spellId} not found`);
        return null;
      }

      const spellName = String(spell.Name ?? `Ability ${spellId}`);
      const effects = spellEffectsLookup.get(spellId) ?? [];

      // Build caster participant
      const caster: CombatParticipant = {
        id: 0,
        name: characterName,
        stats: statValues,
        skills: skillTotals,
        activeStatusIds: new Set(casterStatusIds),
        statusCategoryMap: new Map(casterStatusCategoryMap),
      };

      // Build target participants from dummies
      const targetDummies = dummies.filter((d) => targetIds.includes(d.id));
      const targets = targetDummies.map(dummyToParticipant);

      // For self-target abilities (TargetType=1), the caster IS the target
      const targetType = num(spell.TargetType, 0);
      if (targetType === 1 || (targets.length === 0 && targetIds.length === 0)) {
        // Self-cast: treat caster as a target so Who=0 effects hit the caster
        targets.push({ ...caster });
      }

      // Execute caster roll if applicable
      let casterRoll: AbilityExecutionResult['casterRoll'] | undefined;
      let rollSuccess = true;
      let rollCritical = false;
      let rollTotal = 0;
      const preMessages: string[] = [];

      const casterRollFormula = String(spell.CasterRollFormula ?? '').trim();
      const casterRollType = num(spell.CasterRollType, 0);
      const rollStatSkillId = num(spell.RollStatSkillID);

      // Determine the effective roll formula
      let effectiveRollFormula = casterRollFormula;

      if (!effectiveRollFormula && casterRollType === 1 && rollStatSkillId > 0) {
        // CasterRollType=1 (Roll Stat): build roll from stat/skill value + dice
        // Look up the stat value first, then skill value as fallback
        const statValue = statValues.get(rollStatSkillId) ?? skillTotals.get(rollStatSkillId) ?? 0;
        const modifier = Math.floor(statValue);
        effectiveRollFormula = `${numDice}d${diceSides}${modifier >= 0 ? '+' : ''}${modifier}`;
      } else if (!effectiveRollFormula && casterRollType === 0 && rollStatSkillId > 0) {
        // CasterRollType=0 (Roll Skill): build roll from skill value + dice
        const skillValue = skillTotals.get(rollStatSkillId) ?? statValues.get(rollStatSkillId) ?? 0;
        const modifier = Math.floor(skillValue);
        effectiveRollFormula = `${numDice}d${diceSides}${modifier >= 0 ? '+' : ''}${modifier}`;
      }

      if (effectiveRollFormula) {
        // Evaluate the roll formula
        const formulaContext: CombatFormulaContext = {
          casterStats: statValues,
          casterSkills: skillTotals,
          targetStats: targets[0]?.stats ?? new Map(),
          targetSkills: targets[0]?.skills ?? new Map(),
          ...lookups,
          casterName: characterName,
          targetName: targets[0]?.name ?? 'Target',
        };

        try {
          const result = evaluateCombatFormula(effectiveRollFormula, formulaContext);
          rollTotal = result.rounded;

          // Check for natural 20/1 on d20 rolls
          const d20Rolls = result.rolls.filter((r) => r.sides === 20);
          const natural20 = d20Rolls.some((r) => r.rolls.includes(20));
          const natural1 = d20Rolls.some((r) => r.rolls.includes(1));

          rollCritical = natural20;

          casterRoll = {
            formula: effectiveRollFormula,
            total: rollTotal,
            rolls: result.rolls.flatMap((r) => r.rolls),
            natural20,
            natural1,
          };

          // Determine success based on DC
          const dcType = num(spell.DCType, 0);
          const fixedDC = num(spell.FixedDCValue, 0);

          if (dcType > 0 && fixedDC > 0) {
            // Compare roll to DC
            rollSuccess = rollTotal >= fixedDC;
          } else {
            // No DC, roll always succeeds
            rollSuccess = true;
          }

          // Natural 1 is always failure, natural 20 is always success
          if (natural1 && !natural20) rollSuccess = false;
          if (natural20) rollSuccess = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          preMessages.push(`Error: ${msg}`);
          // Fallback: treat as no-roll success to keep the rest of the pipeline usable
          rollTotal = 0;
          rollSuccess = true;
          rollCritical = false;
        }
      }

      // Process effects
      const processingContext: EffectProcessingContext = {
        caster,
        targets,
        schemaData,
        ...effectContext,
        rollSuccess,
        rollCritical,
        rollResult: rollTotal,
      };

      const {
        results: effectResults,
        updatedCaster: _updatedCaster,
        updatedTargets,
        chainAbilities: _chainAbilities,
        messages: effectMessages,
      } = processAbilityEffects(spell, effects, processingContext);
      void _updatedCaster;
      void _chainAbilities;

      // Convert targets back to dummies
      const updatedDummies = dummies.map((dummy) => {
        const updatedTarget = updatedTargets.find((t) => t.id === dummy.id);
        if (updatedTarget) {
          return participantToDummy(updatedTarget, dummy);
        }
        return dummy;
      });

      // Build target results
      const targetResults = new Map<number, {
        targetName: string;
        dc?: number;
        success: boolean;
      }>();

      for (const target of targets) {
        targetResults.set(target.id, {
          targetName: target.name,
          success: rollSuccess,
        });
      }

      const messages = [...preMessages, ...effectMessages];

      return {
        spellId,
        spellName,
        casterName: characterName,
        success: rollSuccess,
        critical: rollCritical,
        statIdToName,
        casterRoll,
        targetResults,
        effects: effectResults,
        messages,
        updatedDummies,
      };
    },
    [
      spellLookup,
      spellEffectsLookup,
      statValues,
      skillTotals,
      characterName,
      numDice,
      diceSides,
      lookups,
      effectContext,
      schemaData,
      casterStatusIds,
      casterStatusCategoryMap,
    ]
  );

  return { executeAbility };
}

/**
 * Format ability execution result for chat display
 */
export function formatExecutionResult(result: AbilityExecutionResult): string[] {
  const lines: string[] = [];

  // Header
  lines.push(`**${result.spellName}**`);

  // Caster roll
  if (result.casterRoll) {
    const rollStr = result.casterRoll.rolls.join(', ');
    let line = `Roll: [${rollStr}] = ${result.casterRoll.total}`;

    if (result.casterRoll.natural20) {
      line += ' **(Critical!)**';
    } else if (result.casterRoll.natural1) {
      line += ' **(Natural 1!)**';
    }

    lines.push(line);
  }

  // Success/failure
  if (result.casterRoll) {
    lines.push(result.success ? 'Result: **Success**' : 'Result: **Failure**');
  }

  // Messages from effects (already outcome-filtered)
  for (const msg of result.messages) {
    lines.push(msg);
  }

  // Stat changes (never label as "damage"; Health is just another stat)
  // Hide Secret effects (broadcast=2)
  const visibleStatEffects = (result.effects ?? []).filter(
    (e) => e.statChanged && e.broadcast !== 2
  );

  for (const e of visibleStatEffects) {
    const sc = e.statChanged!;
    const delta = sc.newValue - sc.oldValue;
    const who = e.appliedToName ?? 'Target';
    const statName =
      result.statIdToName?.get(sc.statId) ?? `stat ${sc.statId}`;
    if (e.function === 10) {
      lines.push(`→ ${who} (${statName}) = ${sc.newValue}`);
    } else {
      const sign = delta >= 0 ? '+' : '';
      lines.push(`→ ${who} ${sign}${delta} (${statName})`);
    }
  }

  return lines;
}
