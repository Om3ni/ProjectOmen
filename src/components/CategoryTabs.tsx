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
    <div className="mb-4 rounded-lg border theme-border theme-bg-muted p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide theme-text-muted">Categories</div>
        <div className="text-xs theme-text-muted">
          <span className="theme-text-faint">Columns:</span> {columnCount} ·{' '}
          <span className="theme-text-faint">Loaded tables:</span> {tableCount}
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
                  ? 'rounded-md theme-bg-selection px-3 py-2 text-sm font-medium theme-text-selection'
                  : 'rounded-md border theme-border theme-bg-input px-3 py-2 text-sm theme-text-secondary hover:theme-bg-surface'
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
