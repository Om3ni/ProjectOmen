import type { RprCategory } from '@/models/schema';

type Props = {
  categories: RprCategory[];
  activeCategory: RprCategory;
  onCategoryChange: (cat: RprCategory) => void;
  columnCount: number;
  tableCount: number;
};

export default function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
  columnCount,
  tableCount,
}: Props) {
  return (
    <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categories</div>
        <div className="text-xs text-slate-400">
          <span className="text-slate-500">Columns:</span> {columnCount} ·{' '}
          <span className="text-slate-500">Loaded tables:</span> {tableCount}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {categories.map((cat) => {
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={
                isActive
                  ? 'rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900'
                  : 'rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60'
              }
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
