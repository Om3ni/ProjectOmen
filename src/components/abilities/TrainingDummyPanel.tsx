/**
 * TrainingDummyPanel - Panel for configuring training dummies
 * Displays list of dummies and allows stat configuration
 */

import { useState } from 'react';
import { num } from '@/utils/rprHelpers';
import type { TrainingDummy } from '@/types/trainingDummy';

type Row = Record<string, unknown>;

interface Props {
  dummies: TrainingDummy[];
  statRows: Row[];

  onAddDummy: () => number;
  onRemoveDummy: (id: number) => void;
  onRenameDummy: (id: number, name: string) => void;
  onSetStat: (dummyId: number, statId: number, value: number) => void;
  onResetDummy: (id: number) => void;
}

export default function TrainingDummyPanel({
  dummies,
  statRows,
  onAddDummy,
  onRemoveDummy,
  onRenameDummy,
  onSetStat,
  onResetDummy,
}: Props) {
  const [expandedDummyId, setExpandedDummyId] = useState<number | null>(
    dummies.length > 0 ? dummies[0].id : null
  );

  // Get commonly used stats for combat (those with specific flags)
  // Filter to stats that would be relevant for combat targets
  const combatStats = statRows.filter((stat) => {
    const name = String(stat.Name ?? '').toLowerCase();
    // Include stats commonly used in combat
    return (
      name.includes('health') ||
      name.includes('armor') ||
      name.includes('ac') ||
      name.includes('defense') ||
      name.includes('resistance') ||
      name.includes('mana') ||
      name.includes('stamina') ||
      name.includes('action')
    );
  });

  // If no combat stats found, show first 10 stats
  const displayStats = combatStats.length > 0 ? combatStats : statRows.slice(0, 10);

  const handleAddDummy = () => {
    const newId = onAddDummy();
    setExpandedDummyId(newId);
  };

  const toggleExpand = (id: number) => {
    setExpandedDummyId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="rounded-lg border theme-border theme-bg-surface p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold theme-text">Training Dummies</h3>
        <button
          type="button"
          className="px-3 py-1 text-sm rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]"
          onClick={handleAddDummy}
        >
          + Add
        </button>
      </div>

      {dummies.length === 0 ? (
        <div className="text-center py-4 theme-text-muted text-sm">
          No training dummies. Add one to test abilities.
        </div>
      ) : (
        <div className="space-y-2">
          {dummies.map((dummy) => (
            <DummyCard
              key={dummy.id}
              dummy={dummy}
              stats={displayStats}
              isExpanded={expandedDummyId === dummy.id}
              onToggle={() => toggleExpand(dummy.id)}
              onRename={(name) => onRenameDummy(dummy.id, name)}
              onSetStat={(statId, value) => onSetStat(dummy.id, statId, value)}
              onReset={() => onResetDummy(dummy.id)}
              onRemove={() => onRemoveDummy(dummy.id)}
              canRemove={dummies.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DummyCardProps {
  dummy: TrainingDummy;
  stats: Row[];
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onSetStat: (statId: number, value: number) => void;
  onReset: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

function DummyCard({
  dummy,
  stats,
  isExpanded,
  onToggle,
  onRename,
  onSetStat,
  onReset,
  onRemove,
  canRemove,
}: DummyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(dummy.name);

  const handleNameSubmit = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    } else {
      setEditName(dummy.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(dummy.name);
      setIsEditing(false);
    }
  };

  // Get a quick stat summary for collapsed view
  const healthStat = stats.find((s) =>
    String(s.Name ?? '').toLowerCase().includes('health')
  );
  const healthValue = healthStat
    ? dummy.stats.get(num(healthStat.ID)) ?? 0
    : null;

  return (
    <div className="rounded-md border theme-border-muted theme-bg-elevated">
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-black/10"
        onClick={onToggle}
      >
        <span className="theme-text-muted text-sm">
          {isExpanded ? '▼' : '▶'}
        </span>

        {isEditing ? (
          <input
            type="text"
            className="flex-1 px-2 py-0.5 text-sm rounded theme-bg-input theme-text theme-border-muted border"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span
            className="flex-1 font-medium theme-text cursor-text"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {dummy.name}
          </span>
        )}

        {healthValue !== null && !isExpanded && (
          <span className="text-xs theme-text-muted">
            HP: {healthValue}
          </span>
        )}

        {canRemove && (
          <button
            type="button"
            className="px-2 py-0.5 text-xs rounded theme-text-muted hover:text-red-500 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 pt-0 border-t theme-border-muted">
          <div className="grid grid-cols-2 gap-2 mt-2">
            {stats.map((stat) => {
              const statId = num(stat.ID);
              const statName = String(stat.Name ?? `Stat ${statId}`);
              const currentValue = dummy.stats.get(statId) ?? 0;

              return (
                <div key={statId} className="flex items-center gap-2">
                  <label className="text-xs theme-text-secondary flex-1 truncate">
                    {statName}
                  </label>
                  <input
                    type="number"
                    className="w-16 px-2 py-1 text-xs rounded theme-bg-input theme-text theme-border-muted border text-right"
                    value={currentValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        onSetStat(statId, val);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              className="px-3 py-1 text-xs rounded theme-bg-surface theme-text-secondary hover:theme-bg-elevated border theme-border-muted"
              onClick={onReset}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
