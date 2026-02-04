import type { CellCoord } from '@/hooks/useGridSelection';

type Props = {
  cell: CellCoord | null;
  value: string;
  onUpdate: (row: number, col: number, value: string) => void;
  onClose: () => void;
};

export function ExpandedCellEditor({ cell, value, onUpdate, onClose }: Props) {
  if (!cell) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-xs text-slate-400">
          Edit cell [{cell.row}, {cell.col}]:
        </div>
        <textarea
          autoFocus
          className="h-40 w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-sm text-slate-100"
          value={value}
          onChange={(e) => onUpdate(cell.row, cell.col, e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
