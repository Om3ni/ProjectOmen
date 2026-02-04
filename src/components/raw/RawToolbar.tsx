import type { RprCategory } from '@/models/schema';

type CategoryView = { category: RprCategory };

type Props = {
  rawMode: 'all' | 'selection';
  rawCategory: RprCategory;
  categoryViews: CategoryView[];
  onChangeCategory: (next: RprCategory) => void;
  onLoadGrouped: () => void;
  onApply: () => void;
  showPaste: boolean;
  onTogglePaste: () => void;
  onCopy: () => void;
  onClose: () => void;
  onPopOut?: () => void;
};

export function RawToolbar({
  rawMode,
  rawCategory,
  categoryViews,
  onChangeCategory,
  onLoadGrouped,
  onApply,
  showPaste,
  onTogglePaste,
  onCopy,
  onClose,
  onPopOut,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-300">Raw Editor</span>
        <span className="hidden sm:inline text-xs text-slate-500">Click to edit · Shift+drag to select</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rawMode === 'selection' ? (
          <>
            <select
              className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={String(rawCategory)}
              onChange={(e) => onChangeCategory(e.target.value as RprCategory)}
            >
              {categoryViews.map((v) => (
                <option key={v.category} value={v.category}>
                  {v.category}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
              onClick={onLoadGrouped}
              title="Load from editor"
            >
              Load
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
              onClick={onApply}
            >
              Apply
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
              onClick={onLoadGrouped}
              title="Load from editor"
            >
              Load
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
              onClick={onApply}
            >
              Apply
            </button>
          </>
        )}
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-medium ${showPaste ? 'bg-emerald-600 text-white' : 'border border-emerald-600 text-emerald-400 hover:bg-emerald-900/30'}`}
          onClick={onTogglePaste}
        >
          Paste Raw
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
          onClick={onCopy}
        >
          Copy
        </button>
        {onPopOut && (
          <button
            type="button"
            className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
            onClick={onPopOut}
            title="Open in new window"
          >
            ↗ Pop Out
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
