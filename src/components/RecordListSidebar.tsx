import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { inferLabel } from '@/hooks/useEditorState';

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

type Props = {
  rows: Array<Record<string, unknown>>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  title?: string;
  enableFilter?: boolean;
  filterPlaceholder?: string;
  groupBy?: string;
  onReorder?: (fromIndex: number, toIndex: number, dropAfter: boolean) => void;
};

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function isHeaderRow(row: Record<string, unknown>): boolean {
  const name = str(row.Name ?? '');
  return name.startsWith('=====') && name.endsWith('=====');
}

function extractHeaderText(name: string): string {
  return name.replace(/^=+|=+$/g, '').trim();
}

export default function RecordListSidebar({
  rows,
  selectedIndex,
  onSelect,
  title = 'Records',
  enableFilter = false,
  filterPlaceholder = 'Filter…',
  groupBy,
  onReorder,
}: Props) {
  const [query, setQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [unlockedHeaders, setUnlockedHeaders] = useState<Set<Record<string, unknown>>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; after: boolean } | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const setActiveItemRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) {
      activeItemRef.current = el;
    }
  }, []);

  const dragEnabled = Boolean(onReorder) && !groupBy;

  const toggleCategory = useCallback((categoryName: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows.map((row, index) => ({ row, index }));
    if (!q) return base;
    return base.filter(({ row }) => {
      const label = inferLabel(row).toLowerCase();
      const id = str(row.ID ?? row['Node ID']).toLowerCase();
      const cat = groupBy ? str(row[groupBy]).toLowerCase() : '';
      return label.includes(q) || id.includes(q) || (cat && cat.includes(q));
    });
  }, [rows, query, groupBy]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const by = new Map<string, Array<{ row: Record<string, unknown>; index: number }>>();
    for (const it of items) {
      const key = str(it.row[groupBy]).trim() || 'Uncategorized';
      const arr = by.get(key) ?? [];
      arr.push(it);
      by.set(key, arr);
    }
    const groups = Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [, arr] of groups) {
      arr.sort((x, y) => inferLabel(x.row).localeCompare(inferLabel(y.row)));
    }
    return groups;
  }, [items, groupBy]);

  const itemIndexLookup = useMemo(() => {
    const map = new Map<number, number>();
    items.forEach((item, idx) => {
      map.set(item.index, idx);
    });
    return map;
  }, [items]);

  useEffect(() => {
    const el = activeItemRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedIndex, items.length]);

  const toggleHeaderUnlock = useCallback(
    (row: Record<string, unknown>, index: number) => {
      let unlocking = false;
      setUnlockedHeaders((prev) => {
        const next = new Set(prev);
        if (next.has(row)) {
          next.delete(row);
        } else {
          next.add(row);
          unlocking = true;
        }
        return next;
      });
      if (unlocking) {
        onSelect(index);
      }
    },
    [onSelect],
  );

  const clearDragState = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
  }, []);

  const attachDragHandlers = useCallback(
    (rowIndex: number) => {
      if (!dragEnabled) return {};
      return {
        draggable: true,
        onDragStart: (e: DragEvent<HTMLElement>) => {
          setDragIndex(rowIndex);
          try {
            e.dataTransfer.setData('text/plain', String(rowIndex));
          } catch {
            // dataTransfer might throw in some browsers; ignore
          }
          e.dataTransfer.effectAllowed = 'move';
        },
        onDragOver: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const after = e.clientY - rect.top > rect.height / 2;
          setDropTarget({ index: rowIndex, after });
          e.dataTransfer.dropEffect = 'move';
        },
        onDragLeave: () => {
          setDropTarget((prev) => (prev && prev.index === rowIndex ? null : prev));
        },
        onDrop: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          if (!onReorder) {
            clearDragState();
            return;
          }
          let fromIndex = dragIndex;
          try {
            const parsed = Number(e.dataTransfer.getData('text/plain'));
            if (!Number.isNaN(parsed)) fromIndex = parsed;
          } catch {
            // ignore - fallback to dragIndex
          }
          if (fromIndex === null) {
            clearDragState();
            return;
          }
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const after = dropTarget && dropTarget.index === rowIndex ? dropTarget.after : e.clientY - rect.top > rect.height / 2;
          if (fromIndex !== rowIndex || after) {
            onReorder(fromIndex, rowIndex, after);
          }
          clearDragState();
        },
        onDragEnd: clearDragState,
      } as const;
    },
    [dragEnabled, dragIndex, dropTarget, onReorder, clearDragState],
  );

  const handleRowKeyDown = useCallback(
    (rowIndex: number, totalRows: number) =>
      (e: ReactKeyboardEvent<HTMLButtonElement>) => {
        const key = e.key;
        const isNavKey =
          key === 'ArrowUp' ||
          key === 'ArrowDown' ||
          key === 'Home' ||
          key === 'End' ||
          key === 'PageUp' ||
          key === 'PageDown';

        const wantsReorder = dragEnabled && onReorder && (e.ctrlKey || e.metaKey);
        if (wantsReorder && isNavKey) {
          let targetIndex = rowIndex;
          let dropAfter = false;

          if (key === 'ArrowUp') {
            const delta = e.shiftKey ? 10 : 1;
            targetIndex = Math.max(0, rowIndex - delta);
            dropAfter = false;
          } else if (key === 'ArrowDown') {
            const delta = e.shiftKey ? 10 : 1;
            targetIndex = Math.min(totalRows - 1, rowIndex + delta);
            dropAfter = true;
          } else if (key === 'Home' || key === 'PageUp') {
            targetIndex = 0;
            dropAfter = false;
          } else if (key === 'End' || key === 'PageDown') {
            targetIndex = totalRows - 1;
            dropAfter = true;
          } else {
            return;
          }

          if (targetIndex === rowIndex) return;

          e.preventDefault();
          e.stopPropagation();
          onReorder(rowIndex, targetIndex, dropAfter);
          return;
        }

        if (!isNavKey || items.length === 0) return;

        const position = itemIndexLookup.get(rowIndex);
        if (position === undefined) return;

        let nextPos = position;
        if (key === 'ArrowUp') {
          nextPos = Math.max(0, position - 1);
        } else if (key === 'ArrowDown') {
          nextPos = Math.min(items.length - 1, position + 1);
        } else if (key === 'Home') {
          nextPos = 0;
        } else if (key === 'End') {
          nextPos = items.length - 1;
        } else if (key === 'PageUp') {
          nextPos = Math.max(0, position - 10);
        } else if (key === 'PageDown') {
          nextPos = Math.min(items.length - 1, position + 10);
        }

        if (nextPos === position) return;

        const target = items[nextPos];
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();
        onSelect(target.index);
      },
    [dragEnabled, onReorder, itemIndexLookup, items, onSelect],
  );

  const totalRows = rows.length;

  return (
    <section className="rounded-lg border theme-border theme-bg-muted flex flex-col overflow-hidden">
      <div className="border-b theme-border px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide theme-text-muted">{title}</div>
        <div className="mt-1 text-xs theme-text-muted">
          Showing {items.length} / {rows.length} · Selected {rows.length ? selectedIndex + 1 : 0}
        </div>
        {enableFilter ? (
          <input
            className="mt-2 w-full rounded-md border theme-border theme-bg-input px-2 py-1.5 text-xs theme-text placeholder-current theme-text-muted focus:outline-none theme-ring"
            value={query}
            placeholder={filterPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {rows.length === 0 ? (
          <div className="p-2 text-sm theme-text-muted">No rows</div>
        ) : (
          <div className="flex flex-col gap-1">
            {grouped ? (
              grouped.map(([groupName, groupItems]) => {
                const isCollapsed = collapsedCategories.has(groupName);
                return (
                  <div key={groupName} className="mt-2 first:mt-0">
                    <button
                      type="button"
                      onClick={() => toggleCategory(groupName)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide theme-text-muted hover:theme-text hover:theme-bg-elevated rounded transition-colors"
                    >
                      <ChevronIcon collapsed={isCollapsed} />
                      <span className="flex-1 text-left">{groupName}</span>
                      <span className="theme-text-faint">({groupItems.length})</span>
                    </button>
                    {!isCollapsed && (
                      <div className="flex flex-col gap-1 mt-1">
                        {groupItems.map(({ row, index }) => {
                          const isActive = index === selectedIndex;
                          const id = row.ID ?? row['Node ID'] ?? '';
                          return (
                            <button
                              key={`${index}-${String(id)}`}
                              type="button"
                              onClick={() => onSelect(index)}
                              className={
                                isActive
                                  ? 'rounded-md theme-bg-selection px-2 py-2 text-left text-sm font-medium theme-text-selection'
                                  : 'rounded-md border theme-border theme-bg-input px-2 py-2 text-left text-sm theme-text-secondary hover:theme-bg-surface'
                              }
                              ref={isActive ? setActiveItemRef : undefined}
                              onKeyDown={handleRowKeyDown(index, totalRows)}
                            >
                              <div className="truncate">{inferLabel(row)}</div>
                              <div className={isActive ? 'text-[10px] theme-text-selection opacity-70' : 'text-[10px] theme-text-muted'}>
                                {String(id)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <>
                {items.map(({ row, index: rowIndex }) => {
                  const isActive = rowIndex === selectedIndex;
                  const id = row.ID ?? row['Node ID'] ?? '';
                  const name = str(row.Name ?? '');
                  const isHeader = isHeaderRow(row);
                  const isUnlocked = unlockedHeaders.has(row);
                  const dragProps = attachDragHandlers(rowIndex);
                  const isDropHighlight = dropTarget && dropTarget.index === rowIndex;

                  if (isHeader) {
                    return (
                      <div
                        key={`${rowIndex}-${String(id)}`}
                        className={`mt-2 first:mt-0 flex items-stretch gap-1 px-2`}
                        {...dragProps}
                      >
                        <button
                          type="button"
                          onClick={() => toggleHeaderUnlock(row, rowIndex)}
                          className="flex items-center justify-center h-6 w-6 rounded border theme-border-muted theme-bg-input theme-text-muted hover:theme-text hover:theme-border transition"
                        >
                          <ChevronIcon collapsed={!isUnlocked} />
                        </button>
                        {isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => onSelect(rowIndex)}
                            className={
                              isActive
                                ? 'flex-1 rounded-md theme-bg-selection px-2 py-2 text-left text-sm font-medium theme-text-selection'
                                : 'flex-1 rounded-md border theme-border theme-bg-input px-2 py-2 text-left text-sm theme-text-secondary hover:theme-bg-surface'
                            }
                            ref={isActive ? setActiveItemRef : undefined}
                            onKeyDown={handleRowKeyDown(rowIndex, totalRows)}
                          >
                            <div className="truncate uppercase tracking-wide text-[10px]">{extractHeaderText(name)}</div>
                            <div className={isActive ? 'text-[10px] theme-text-selection opacity-70' : 'text-[10px] theme-text-muted'}>
                              {String(id)}
                            </div>
                          </button>
                        ) : (
                          <div
                            className={`flex-1 rounded-md px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide ${
                              isDropHighlight ? 'border theme-text-accent' : 'theme-text-muted'
                            }`}
                          >
                            {extractHeaderText(name)}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`${rowIndex}-${String(id)}`}
                      type="button"
                      onClick={() => onSelect(rowIndex)}
                      className={
                        isActive
                          ? 'rounded-md theme-bg-selection px-2 py-2 text-left text-sm font-medium theme-text-selection'
                          : 'rounded-md border theme-border theme-bg-input px-2 py-2 text-left text-sm theme-text-secondary hover:theme-bg-surface'
                      }
                      {...dragProps}
                      ref={isActive ? setActiveItemRef : undefined}
                      onKeyDown={handleRowKeyDown(rowIndex, totalRows)}
                    >
                      <div className="truncate">{inferLabel(row)}</div>
                      <div className={isActive ? 'text-[10px] theme-text-selection opacity-70' : 'text-[10px] theme-text-muted'}>
                        {String(id)}
                      </div>
                    </button>
                  );
                })}
                {dragEnabled && items.length > 0 ? (
                  <div
                    className={`mt-2 h-4 rounded border border-dashed ${
                      dropTarget && dropTarget.after && dropTarget.index === items[items.length - 1].index
                        ? 'theme-text-accent'
                        : 'border-transparent'
                    }`}
                    onDragOver={(e) => {
                      if (!dragEnabled) return;
                      e.preventDefault();
                      const lastIndex = items[items.length - 1]?.index;
                      if (lastIndex === undefined) return;
                      setDropTarget({ index: lastIndex, after: true });
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragLeave={() => {
                      const lastIndex = items[items.length - 1]?.index;
                      setDropTarget((prev) =>
                        prev && prev.index === lastIndex && prev.after ? null : prev,
                      );
                    }}
                    onDrop={(e) => {
                      if (!dragEnabled || !onReorder) {
                        clearDragState();
                        return;
                      }
                      e.preventDefault();
                      const lastIndex = items[items.length - 1]?.index;
                      if (lastIndex === undefined) {
                        clearDragState();
                        return;
                      }
                      let fromIndex = dragIndex;
                      try {
                        const parsed = Number(e.dataTransfer.getData('text/plain'));
                        if (!Number.isNaN(parsed)) fromIndex = parsed;
                      } catch {
                        // ignore
                      }
                      if (fromIndex !== null) {
                        onReorder(fromIndex, lastIndex, true);
                      }
                      clearDragState();
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
