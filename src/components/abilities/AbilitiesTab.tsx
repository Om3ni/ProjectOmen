import { useMemo, useState } from 'react';
import { num } from '@/utils/rprHelpers';
import {
  getAvailableAbilities,
  groupAbilitiesPreservingOrder,
} from '@/utils/abilityFiltering';
import {
  buildLookupTables,
  checkAbilityRequirements,
  type CharacterState,
  type LookupTables,
  type AbilityRequirementsResult,
} from '@/utils/requirementChecker';
import type { TargetConditionLookups } from '@/utils/targetConditionChecker';
import { useTrainingDummies } from '@/hooks/useTrainingDummies';
import {
  useCombatExecution,
  formatExecutionResult,
  type AbilityExecutionResult,
} from '@/hooks/useCombatExecution';
import AbilityCategoryGroup from './AbilityCategoryGroup';
import AbilityCard from './AbilityCard';
import TrainingDummyPanel from './TrainingDummyPanel';
import TargetSelector from './TargetSelector';

type Row = Record<string, unknown>;

type Props = {
  // Schema data
  spellDefs: Row[];
  spellReqDefs: Row[];
  perkActions: Row[];
  mutatorActions?: Row[];
  statusActions?: Row[];

  // Full schema data for lookups (stats, skills, perks, statuses)
  schemaData: Record<string, Row[]>;

  // Character state (from CharacterSheetModal)
  chosenPerkIds: Set<number>;
  activeStatusIds?: Set<number>;   // StatusDef IDs currently active
  activeMutatorIds?: Set<number>;  // MutatorDef IDs whose conditions are met
  adminMode: boolean;

  // Character state for requirement checking
  allocations: Map<number, number>;        // SkillDef ID -> allocation
  perkBonuses: Map<number, number>;        // SkillDef ID -> bonus from perks
  statValues: Map<number, number>;         // Stat ID -> computed value
  activeStatusCategories?: Set<string>;    // Status categories currently active
  statusCategoryMap?: Map<number, string>;  // StatusID -> category for caster combat participant

  // Dice configuration for Roll Stat abilities
  numDice?: number;
  diceSides?: number;

  // Character name for combat messages
  characterName?: string;

  // Callbacks
  onUseAbility?: (spellId: number, targets: number[]) => void;
  onAbilityResult?: (result: AbilityExecutionResult, messages: string[]) => void;
};

export default function AbilitiesTab({
  spellDefs,
  spellReqDefs,
  perkActions,
  mutatorActions = [],
  statusActions = [],
  schemaData,
  chosenPerkIds,
  activeStatusIds = new Set(),
  activeMutatorIds,
  adminMode,
  allocations,
  perkBonuses,
  statValues,
  activeStatusCategories = new Set(),
  statusCategoryMap = new Map(),
  characterName = 'Player',
  numDice = 1,
  diceSides = 20,
  onUseAbility,
  onAbilityResult
}: Props) {
  const [filter, setFilter] = useState('');
  const [selectedAbilityId, setSelectedAbilityId] = useState<number | null>(null);
  const [showDummyPanel, setShowDummyPanel] = useState(false);

  // Training dummies for target selection
  const statRows = (schemaData.Stat ?? []) as Row[];
  const statusDefRows = (schemaData.StatusDef ?? []) as Row[];

  const {
    dummies,
    addDummy,
    removeDummy,
    renameDummy,
    setStat,
    resetDummy,
    // We need a way to update dummies after combat
  } = useTrainingDummies({
    statRows,
    statusDefRows,
  });

  // Track dummies state that can be updated after combat
  const [combatDummies, setCombatDummies] = useState(dummies);

  // Sync with base dummies when they change (add/remove/reset)
  useMemo(() => {
    setCombatDummies(dummies);
  }, [dummies]);

  // Build skill totals for combat execution
  const skillTotals = useMemo(() => {
    const totals = new Map<number, number>();
    const skillRows = (schemaData.SkillDef ?? []) as Row[];

    for (const skill of skillRows) {
      const id = num(skill.ID);
      if (id <= 0) continue;

      const naturalBonus = num(skill['Natural Bonus'], 0);
      const allocation = allocations.get(id) ?? 0;
      const perkBonus = perkBonuses.get(id) ?? 0;
      totals.set(id, naturalBonus + allocation + perkBonus);
    }

    return totals;
  }, [schemaData, allocations, perkBonuses]);

  // Combat execution hook
  const { executeAbility } = useCombatExecution({
    schemaData,
    statValues,
    skillTotals,
    characterName,
    numDice,
    diceSides,
    activeStatusIds,
    statusCategoryMap,
  });

  // Build lookup tables for ID -> name resolution
  const lookupTables = useMemo<LookupTables>(() => {
    return buildLookupTables(schemaData);
  }, [schemaData]);

  // Build character state for requirement checking
  const characterState = useMemo<CharacterState>(() => {
    // Build skill totals: allocation + perk bonus + natural bonus
    const skillTotals = new Map<number, number>();
    const skillRows = (schemaData.SkillDef ?? []) as Row[];

    for (const skill of skillRows) {
      const id = num(skill.ID);
      if (id <= 0) continue;

      const naturalBonus = num(skill['Natural Bonus'], 0);
      const allocation = allocations.get(id) ?? 0;
      const perkBonus = perkBonuses.get(id) ?? 0;
      skillTotals.set(id, naturalBonus + allocation + perkBonus);
    }

    return {
      skillTotals,
      skillAllocations: allocations,
      statValues,
      chosenPerkIds,
      activeStatusIds,
      activeStatusCategories,
      conanLevel: 0, // Not tracked in this editor
      heldItemIds: new Set(), // Not tracked in this editor
    };
  }, [schemaData, allocations, perkBonuses, statValues, chosenPerkIds, activeStatusIds, activeStatusCategories]);

  // In admin mode, show all abilities that COULD be granted by mutators/statuses
  // This allows testing abilities without needing to activate specific conditions
  const effectiveActiveMutatorIds = useMemo(() => {
    if (adminMode) {
      // In admin mode, include all mutator IDs that grant abilities
      const allMutatorIds = new Set<number>();
      for (const action of mutatorActions) {
        const fn = num(action.Function);
        if (fn === 3) { // Grant Ability
          allMutatorIds.add(num(action.MutatorID));
        }
      }
      return allMutatorIds;
    }
    return activeMutatorIds ?? new Set<number>();
  }, [adminMode, mutatorActions, activeMutatorIds]);

  const effectiveActiveStatusIds = useMemo(() => {
    if (adminMode) {
      // In admin mode, include all status IDs that grant abilities
      const allStatusIds = new Set<number>();
      for (const action of statusActions) {
        const fn = num(action.Function);
        if (fn === 3) { // Grant Ability
          allStatusIds.add(num(action.StatusID));
        }
      }
      return allStatusIds;
    }
    return activeStatusIds;
  }, [adminMode, statusActions, activeStatusIds]);

  // Get available abilities based on perks, statuses, mutators, and common flag
  const availableAbilities = useMemo(() => {
    return getAvailableAbilities({
      spellDefs,
      perkActions,
      mutatorActions,
      statusActions,
      chosenPerkIds,
      activeStatusIds: effectiveActiveStatusIds,
      activeMutatorIds: effectiveActiveMutatorIds,
      adminMode,
    });
  }, [spellDefs, perkActions, mutatorActions, statusActions, chosenPerkIds, effectiveActiveStatusIds, effectiveActiveMutatorIds, adminMode]);

  // Build requirement lookup: spellId -> SpellReqDef[]
  const requirementsBySpell = useMemo(() => {
    const map = new Map<number, Row[]>();
    for (const req of spellReqDefs) {
      const spellId = num(req.SpellID);
      if (!map.has(spellId)) {
        map.set(spellId, []);
      }
      map.get(spellId)!.push(req);
    }
    return map;
  }, [spellReqDefs]);

  // Build target condition lookup: spellId -> SpellTargetCond[]
  const targetCondsBySpell = useMemo(() => {
    const map = new Map<number, Row[]>();
    const rows = (schemaData.SpellTargetCond ?? []) as Row[];
    for (const cond of rows) {
      const spellId = num(cond.SpellID);
      if (!map.has(spellId)) map.set(spellId, []);
      map.get(spellId)!.push(cond);
    }
    return map;
  }, [schemaData]);

  // Check requirements for all available abilities
  const requirementResults = useMemo(() => {
    const results = new Map<number, AbilityRequirementsResult>();

    for (const spell of availableAbilities) {
      const spellId = num(spell.ID ?? spell['Node ID']);
      const reqs = requirementsBySpell.get(spellId) ?? [];
      const result = checkAbilityRequirements(spell, reqs, characterState, lookupTables);
      results.set(spellId, result);
    }

    return results;
  }, [availableAbilities, requirementsBySpell, characterState, lookupTables]);

  // Apply text filter
  const filteredAbilities = useMemo(() => {
    if (!filter.trim()) return availableAbilities;

    const lowerFilter = filter.toLowerCase();
    return availableAbilities.filter((spell) => {
      const name = String(spell.Name ?? '').toLowerCase();
      const category = String(spell.Category ?? '').toLowerCase();
      const desc = String(spell.Description ?? '').toLowerCase();
      return (
        name.includes(lowerFilter) ||
        category.includes(lowerFilter) ||
        desc.includes(lowerFilter)
      );
    });
  }, [availableAbilities, filter]);

  // Group by category
  const categoryGroups = useMemo(() => {
    return groupAbilitiesPreservingOrder(filteredAbilities);
  }, [filteredAbilities]);

  const handleSelectAbility = (spellId: number) => {
    setSelectedAbilityId(spellId);
  };

  const handleConfirmTargets = (targetIds: number[]) => {
    if (selectedAbilityId) {
      // Execute the ability
      const result = executeAbility(selectedAbilityId, targetIds, combatDummies);

      if (result) {
        // Update dummies with combat effects
        setCombatDummies(result.updatedDummies);

        // Format messages for chat
        const messages = formatExecutionResult(result);

        // Call callbacks
        if (onAbilityResult) {
          onAbilityResult(result, messages);
        }
        if (onUseAbility) {
          onUseAbility(selectedAbilityId, targetIds);
        }
      }
    }
    setSelectedAbilityId(null);
  };

  const handleCancelTargetSelection = () => {
    setSelectedAbilityId(null);
  };

  // Get the selected spell for the target selector
  const selectedSpell = useMemo(() => {
    if (!selectedAbilityId) return null;
    return availableAbilities.find((s) => {
      const id = num(s.ID ?? s['Node ID']);
      return id === selectedAbilityId;
    }) ?? null;
  }, [selectedAbilityId, availableAbilities]);

  const handleClearFilter = () => {
    setFilter('');
  };

  const handleRefresh = () => {
    // Force re-render by clearing selection
    setSelectedAbilityId(null);
    setFilter('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Target selector overlay */}
      {selectedSpell && (
        <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <TargetSelector
              spell={selectedSpell}
              dummies={combatDummies}
              targetConds={targetCondsBySpell.get(num(selectedSpell.ID ?? selectedSpell['Node ID'])) ?? []}
              lookups={lookupTables as unknown as TargetConditionLookups}
              onConfirm={handleConfirmTargets}
              onCancel={handleCancelTargetSelection}
            />
          </div>
        </div>
      )}

      {/* Header with filter and dummy toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full rounded-md border theme-border-muted theme-bg-input px-3 py-2 text-sm theme-text placeholder-current theme-text-muted focus:outline-none theme-ring pr-8"
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 theme-text-muted hover:theme-text"
              onClick={handleClearFilter}
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          className={`px-3 py-2 text-sm rounded-md transition-colors ${
            showDummyPanel
              ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-text)]'
              : 'theme-bg-elevated theme-text-secondary hover:theme-bg-surface'
          }`}
          onClick={() => setShowDummyPanel(!showDummyPanel)}
          title="Configure training dummies"
        >
          Dummies
        </button>
        <button
          type="button"
          className="px-3 py-2 text-sm rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]"
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>

      {/* Training dummy panel (collapsible) */}
      {showDummyPanel && (
        <div className="mb-3">
          <TrainingDummyPanel
            dummies={combatDummies}
            statRows={statRows}
            onAddDummy={addDummy}
            onRemoveDummy={removeDummy}
            onRenameDummy={renameDummy}
            onSetStat={(dummyId, statId, value) => {
              // Update both base dummies and combat dummies
              setStat(dummyId, statId, value);
              setCombatDummies(prev =>
                prev.map(d => {
                  if (d.id === dummyId) {
                    const newStats = new Map(d.stats);
                    newStats.set(statId, value);
                    return { ...d, stats: newStats };
                  }
                  return d;
                })
              );
            }}
            onResetDummy={(id) => {
              resetDummy(id);
              // Combat dummies will sync via the useMemo dependency
            }}
          />
        </div>
      )}

      {/* Abilities list */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1">
        {categoryGroups.length === 0 ? (
          <div className="text-center py-8 theme-text-muted">
            {filter
              ? 'No abilities match your filter'
              : 'No abilities available. Choose perks to unlock abilities.'}
          </div>
        ) : (
          categoryGroups.map((group, idx) => (
            <AbilityCategoryGroup
              key={group.isSeparator ? `sep-${idx}` : `${group.category}-${idx}`}
              category={group.category}
              isSeparator={group.isSeparator}
              separatorLabel={group.separatorLabel}
              defaultOpen={true}
            >
              {group.abilities.map((spell) => {
                const spellId = num(spell.ID ?? spell['Node ID']);
                const requirements = requirementsBySpell.get(spellId) ?? [];
                const reqResult = requirementResults.get(spellId);
                const allMet = reqResult?.allMet ?? true;

                return (
                  <AbilityCard
                    key={spellId}
                    spell={spell}
                    requirements={requirements}
                    requirementResults={reqResult}
                    onSelect={handleSelectAbility}
                    disabled={!allMet && !adminMode}
                  />
                );
              })}
            </AbilityCategoryGroup>
          ))
        )}
      </div>

      {/* Stats summary */}
      <div className="mt-3 pt-3 border-t theme-border">
        <div className="text-xs theme-text-muted flex justify-between">
          <span>
            {availableAbilities.length} abilities available
            {filter && ` (${filteredAbilities.length} shown)`}
          </span>
          <span>
            {combatDummies.length} dummy{combatDummies.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
      </div>
    </div>
  );
}
