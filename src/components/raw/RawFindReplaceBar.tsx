type Props = {
  selectedCount: number;
  findText: string;
  replaceText: string;
  matchCount: number;
  currentMatchIndex: number;
  onChangeFindText: (text: string) => void;
  onChangeReplaceText: (text: string) => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onSequenceIds: () => void;
  onClearSelection: () => void;
};

export function RawFindReplaceBar({
  selectedCount,
  findText,
  replaceText,
  matchCount,
  currentMatchIndex,
  onChangeFindText,
  onChangeReplaceText,
  onFindNext,
  onFindPrev,
  onReplace,
  onReplaceAll,
  onSequenceIds,
  onClearSelection,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onFindPrev();
      } else {
        onFindNext();
      }
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-900/30 p-2">
      <span className="text-xs text-slate-400">{selectedCount > 0 ? `${selectedCount} cells` : 'All'}</span>
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="rounded-md border border-slate-700 bg-slate-950/40 px-2 py-1 text-sm text-slate-100 w-32"
          placeholder="Find..."
          value={findText}
          onChange={(e) => onChangeFindText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {findText && (
          <span className="text-xs text-slate-400 min-w-[60px]">
            {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : 'No matches'}
          </span>
        )}
        <button
          type="button"
          className="rounded-md border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900/60 disabled:opacity-40"
          onClick={onFindPrev}
          disabled={matchCount === 0}
          title="Find Previous (Shift+Enter)"
        >
          ↑
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900/60 disabled:opacity-40"
          onClick={onFindNext}
          disabled={matchCount === 0}
          title="Find Next (Enter)"
        >
          ↓
        </button>
      </div>
      <input
        type="text"
        className="rounded-md border border-slate-700 bg-slate-950/40 px-2 py-1 text-sm text-slate-100 w-28"
        placeholder="Replace..."
        value={replaceText}
        onChange={(e) => onChangeReplaceText(e.target.value)}
      />
      <button
        type="button"
        className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500"
        onClick={onReplace}
      >
        Replace
      </button>
      <button
        type="button"
        className="rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-slate-950 hover:bg-amber-400"
        onClick={onReplaceAll}
      >
        Replace All
      </button>
      <button
        type="button"
        className="rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500"
        onClick={onSequenceIds}
        title="Re-sequence Node IDs"
      >
        Sequence IDs
      </button>
      {selectedCount > 0 && (
        <button
          type="button"
          className="rounded-md border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-slate-300 hover:bg-slate-900/60"
          onClick={onClearSelection}
        >
          Clear
        </button>
      )}
    </div>
  );
}
