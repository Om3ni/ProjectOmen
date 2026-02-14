/**
 * TargetSelector - Modal/panel for selecting ability targets
 * Shows available training dummies and allows selection based on ability's target requirements
 */

import { useState, useMemo } from 'react';
import { num } from '@/utils/rprHelpers';
import { formatTargetInfo } from '@/utils/abilityFiltering';
import type { TrainingDummy } from '@/types/trainingDummy';
import {
  checkSpellTargetConditions,
  type TargetConditionLookups,
} from '@/utils/targetConditionChecker';

type Row = Record<string, unknown>;

interface Props {
  spell: Row;
  dummies: TrainingDummy[];
  targetConds?: Row[];
  lookups?: TargetConditionLookups;
  casterId?: number; // ID of caster (to exclude from "others" targeting)

  onConfirm: (targetIds: number[]) => void;
  onCancel: () => void;
}

/**
 * TargetType enum from SpellDef:
 * 0 = Selected (pick specific targets)
 * 1 = Caster (self only)
 * 2 = All (all targets in range)
 * 3 = All Others (all except caster)
 * 4 = Selected Others (pick from non-caster targets)
 */
type TargetType = 0 | 1 | 2 | 3 | 4;

export default function TargetSelector({
  spell,
  dummies,
  targetConds = [],
  lookups = {},
  casterId,
  onConfirm,
  onCancel,
}: Props) {
  const spellName = String(spell.Name ?? 'Ability');
  const targetType = num(spell.TargetType, 0) as TargetType;
  const numTargets = num(spell['#Targets'], 1);
  const targetInfo = formatTargetInfo(spell);

  // Track selected target IDs
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Evaluate target conditions for each dummy
  const targetValidation = useMemo(() => {
    const map = new Map<number, { allowed: boolean; reasons: string[] }>();
    for (const d of dummies) {
      const activeStatusCategories = new Set<string>();
      for (const [_sid, cat] of (d.statusCategoryMap ?? [])) {
        if (cat) activeStatusCategories.add(String(cat));
      }
      const res = checkSpellTargetConditions(
        spell,
        targetConds,
        {
          activeStatusIds: new Set(d.activeStatusIds ?? []),
          activeStatusCategories,
        },
        lookups
      );
      map.set(d.id, res);
    }
    return map;
  }, [dummies, lookups, spell, targetConds]);

  // Determine which dummies are selectable based on target type
  const selectableDummies = useMemo(() => {
    switch (targetType) {
      case 1: // Caster - no selection needed
        return [];
      case 3: // All Others
      case 4: // Selected Others
        // Exclude caster if we know who it is
        return dummies.filter((d) => d.id !== casterId);
      case 0: // Selected
      case 2: // All
      default:
        return dummies;
    }
  }, [dummies, targetType, casterId]);

  const isValidTarget = (dummyId: number) => {
    const res = targetValidation.get(dummyId);
    return res ? res.allowed : true;
  };

  // Auto-selection for "All" target types
  const autoTargets = useMemo(() => {
    switch (targetType) {
      case 1: // Caster (self-target) — always auto-confirm with empty targets
        // The caster-as-target logic is handled in useCombatExecution
        return [];
      case 2: // All
        return dummies.map((d) => d.id).filter(isValidTarget);
      case 3: // All Others
        return dummies
          .filter((d) => d.id !== casterId)
          .map((d) => d.id)
          .filter(isValidTarget);
      default:
        return null; // Requires manual selection
    }
  }, [dummies, targetType, casterId, targetValidation]);

  // Can we confirm the selection?
  const canConfirm = useMemo(() => {
    if (autoTargets !== null) {
      return true; // Auto-target abilities always ready
    }

    // For manual selection, check if we have enough targets
    if (numTargets === 0) {
      return true; // Self-target
    }

    const validCount = selectableDummies.filter((d) => isValidTarget(d.id)).length;
    return selectedIds.size >= Math.min(numTargets, validCount);
  }, [autoTargets, numTargets, selectedIds.size, selectableDummies, targetValidation]);

  const handleToggleTarget = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Enforce max targets
        if (next.size < numTargets) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const ids = selectableDummies.slice(0, numTargets).map((d) => d.id);
    setSelectedIds(new Set(ids));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    if (autoTargets !== null) {
      onConfirm(autoTargets);
    } else {
      onConfirm(Array.from(selectedIds));
    }
  };

  // For self-targeting or auto-targeting, show a simpler confirmation
  const isAutoTarget = autoTargets !== null;

  return (
    <div className="rounded-lg border theme-border theme-bg-surface p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-semibold theme-text text-lg">{spellName}</h3>
        <p className="text-sm theme-text-secondary mt-1">{targetInfo}</p>
      </div>

      {/* Target selection */}
      {isAutoTarget ? (
        <div className="mb-4">
          <div className="text-sm theme-text-muted mb-2">
            {targetType === 1
              ? 'This ability targets yourself.'
              : targetType === 2
                ? `This ability targets all ${dummies.length} dummy${dummies.length !== 1 ? 'ies' : 'y'}.`
                : `This ability targets ${autoTargets.length} other dummy${autoTargets.length !== 1 ? 'ies' : 'y'}.`}
          </div>

          {autoTargets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {autoTargets.map((id) => {
                const dummy = dummies.find((d) => d.id === id);
                return (
                  <span
                    key={id}
                    className="px-2 py-1 text-xs rounded theme-bg-elevated theme-text-secondary"
                  >
                    {dummy?.name ?? `Target ${id}`}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm theme-text-muted">
              Select {numTargets} target{numTargets !== 1 ? 's' : ''}
              {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-2 py-1 text-xs rounded theme-bg-elevated theme-text-secondary hover:theme-bg-surface"
                onClick={handleSelectAll}
              >
                All
              </button>
              <button
                type="button"
                className="px-2 py-1 text-xs rounded theme-bg-elevated theme-text-secondary hover:theme-bg-surface"
                onClick={handleClearSelection}
              >
                Clear
              </button>
            </div>
          </div>

          {selectableDummies.length === 0 ? (
            <div className="text-center py-4 theme-text-muted text-sm">
              No targets available
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selectableDummies.map((dummy) => {
                const isSelected = selectedIds.has(dummy.id);
                const valid = isValidTarget(dummy.id);
                const canSelect = valid && (isSelected || selectedIds.size < numTargets);
                const reasons = targetValidation.get(dummy.id)?.reasons ?? [];

                return (
                  <button
                    key={dummy.id}
                    type="button"
                    className={`
                      p-2 rounded-md border text-left transition-colors
                      ${isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                        : 'theme-border-muted hover:theme-bg-elevated'
                      }
                      ${!canSelect ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    onClick={() => canSelect && handleToggleTarget(dummy.id)}
                    disabled={!canSelect}
                    title={!valid && reasons.length > 0 ? reasons.join(' / ') : undefined}
                  >
                    <div className="font-medium theme-text text-sm">
                      {dummy.name}
                    </div>
                    <DummyStatSummary dummy={dummy} />
                    {!valid && reasons.length > 0 && (
                      <div className="text-xs mt-1 theme-text-muted">
                        Not a valid target: {reasons[0]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t theme-border">
        <button
          type="button"
          className="px-4 py-2 text-sm rounded-md theme-bg-elevated theme-text-secondary hover:theme-bg-surface"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`
            px-4 py-2 text-sm rounded-md
            ${canConfirm
              ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]'
              : 'theme-bg-elevated theme-text-muted cursor-not-allowed'
            }
          `}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          Use Ability
        </button>
      </div>
    </div>
  );
}

/**
 * Quick stat summary for a dummy in the selector
 */
function DummyStatSummary({ dummy }: { dummy: TrainingDummy }) {
  // Show a few key stats if available
  const statEntries = Array.from(dummy.stats.entries()).slice(0, 3);

  if (statEntries.length === 0) {
    return (
      <div className="text-xs theme-text-muted mt-1">No stats configured</div>
    );
  }

  return (
    <div className="text-xs theme-text-muted mt-1">
      {statEntries.map(([id, value], idx) => (
        <span key={id}>
          {idx > 0 && ' · '}
          {value}
        </span>
      ))}
    </div>
  );
}
