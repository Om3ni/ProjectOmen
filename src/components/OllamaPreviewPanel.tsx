/**
 * Recent Changes Panel
 * Shows Sigil's recently applied changes with undo capability
 */

import { useRecentChanges, type RecentChange } from '@/contexts/PendingChangesContext';

interface Props {
  onUndo: (change: RecentChange) => void;
}

export function RecentChangesPanel({ onUndo }: Props) {
  const { recentChanges, undoChange, clearAll } = useRecentChanges();

  // Only show non-undone changes
  const activeChanges = recentChanges.filter(c => !c.undone);

  if (activeChanges.length === 0) return null;

  const handleUndo = (id: string) => {
    const change = undoChange(id);
    if (change) {
      onUndo(change);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 w-96 theme-bg-surface border theme-border rounded-lg shadow-2xl z-50 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b theme-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-sm font-semibold theme-text">Sigil Activity</h3>
        </div>
        <button
          onClick={clearAll}
          className="text-xs theme-text-muted hover:theme-text"
          title="Clear all"
        >
          Clear
        </button>
      </div>

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeChanges.slice(-10).reverse().map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            onUndo={() => handleUndo(change.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ChangeCardProps {
  change: RecentChange;
  onUndo: () => void;
}

function ChangeCard({ change, onUndo }: ChangeCardProps) {
  const typeColors = {
    create: 'bg-green-950/50 border-green-800/50',
    update: 'bg-blue-950/50 border-blue-800/50',
    delete: 'bg-red-950/50 border-red-800/50',
  };

  const typeIcons = {
    create: '➕',
    update: '✏️',
    delete: '🗑️',
  };

  const typeLabels = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
  };

  const tableLabels: Record<string, string> = {
    SpellDef: 'Ability',
    PerkDef: 'Perk',
    Stat: 'Stat',
    SkillDef: 'Skill',
  };

  const timeAgo = () => {
    const seconds = Math.floor((Date.now() - change.timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className={`rounded border p-2 ${typeColors[change.type]} transition-all hover:bg-opacity-70`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base flex-shrink-0">{typeIcons[change.type]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium theme-text truncate">
              {typeLabels[change.type]} {tableLabels[change.table] || change.table}
            </div>
            <div className="text-xs theme-text-muted truncate">
              {change.description}
            </div>
          </div>
        </div>
        <button
          onClick={onUndo}
          className="flex-shrink-0 px-2 py-0.5 rounded text-xs theme-bg-secondary hover:opacity-80 theme-text transition-opacity"
          title="Undo this change"
        >
          ↶ Undo
        </button>
      </div>

      {/* Timestamp */}
      <div className="text-xs theme-text-muted opacity-60 mt-1">
        {timeAgo()}
      </div>
    </div>
  );
}
