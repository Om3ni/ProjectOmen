import { useRef, useState, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type { CellCoord } from '@/hooks/useGridSelection';

type Props = {
  isChildWindow: boolean;
  rows: string[][];
  visibleRows: string[][];
  startRow: number;
  endRow: number;
  rowHeight: number;
  rowNumWidth: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onScrollTopChange: (scrollTop: number) => void;
  onClearSelection: () => void;

  getSectionMaxCols: (rowIdx: number) => number;
  getColWidth: (colIdx: number) => number;
  onResizeStart: (colIdx: number, e: React.MouseEvent) => void;

  isChildRow: (rowIdx: number) => boolean;

  resizingCol: number | null;

  onSelectCol: (colIdx: number, sectionStartRow: number, e: React.MouseEvent) => void;
  onSelectRow: (rowIdx: number, e: React.MouseEvent) => void;

  isSel: (rowIdx: number, colIdx: number) => boolean;
  isFoc: (rowIdx: number, colIdx: number) => boolean;
  focusCell: CellCoord | null;
  selectedCells: Set<string>;

  onCellMouseDown: (rowIdx: number, colIdx: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (rowIdx: number, colIdx: number) => void;

  onExpandCell: (coord: CellCoord) => void;

  onUpdateCell: (rowIdx: number, colIdx: number, value: string) => void;
  onBulkUpdateCells: (value: string) => void;
  onFocusCell: (coord: CellCoord) => void;
  isDragging: boolean;
  findText?: string;
  currentMatchRow?: number;
  currentSectionToken?: string;
  currentSectionCols?: number;
  sectionBoundaries?: Map<number, string>;
  collapsedSections?: Set<string>;
  onToggleSection?: (sectionName: string) => void;
  isRowHidden?: (rowIdx: number) => boolean;
};

export function RawGrid({
  isChildWindow,
  rows,
  visibleRows,
  startRow,
  endRow,
  rowHeight,
  rowNumWidth,
  containerRef,
  onScrollTopChange,
  onClearSelection,
  getSectionMaxCols,
  getColWidth,
  onResizeStart,
  isChildRow,
  resizingCol,
  onSelectCol,
  onSelectRow,
  isSel,
  isFoc,
  focusCell,
  selectedCells,
  onCellMouseDown,
  onCellMouseEnter,
  onExpandCell,
  onUpdateCell,
  onBulkUpdateCells,
  onFocusCell,
  isDragging,
  findText,
  currentMatchRow,
  currentSectionToken,
  currentSectionCols,
  sectionBoundaries,
  collapsedSections,
  onToggleSection,
  isRowHidden,
}: Props) {
  // Bulk edit input for when cells are selected but no specific cell is focused
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  // When selection changes and there's no focus cell, show bulk input
  const hasMultiSelection = selectedCells.size > 0;
  const hasFocusedCell = focusCell !== null;

  // Determine if bulk input should be shown
  const shouldShowBulkInput = hasMultiSelection && !hasFocusedCell;

  useEffect(() => {
    // Only update if different to avoid unnecessary renders
    setShowBulkInput((prev) => {
      if (prev !== shouldShowBulkInput) {
        if (shouldShowBulkInput) {
          setBulkValue('');
          // Use setTimeout to ensure the input is rendered before focusing
          setTimeout(() => {
            bulkInputRef.current?.focus();
          }, 0);
        }
        return shouldShowBulkInput;
      }
      return prev;
    });
  }, [shouldShowBulkInput]);

  const handleBulkInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBulkValue(val);
    onBulkUpdateCells(val);
  }, [onBulkUpdateCells]);

  const handleBulkKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClearSelection();
      setBulkValue('');
      setShowBulkInput(false);
    }
  }, [onClearSelection]);

  return (
    <div
      className={
        isChildWindow
          ? 'mt-4 flex-1 min-h-0 overflow-auto rounded-md border border-slate-800 bg-slate-950/40 relative'
          : 'mt-4 flex-1 min-h-0 overflow-auto rounded-md border border-slate-800 bg-slate-950/40 relative'
      }
      onScroll={(e) => onScrollTopChange((e.target as HTMLDivElement).scrollTop)}
      ref={containerRef}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClearSelection();
      }}
    >
      {/* Bulk edit input bar - visible when cells are selected without focus */}
      {showBulkInput && (
        <div className="sticky top-0 z-20 bg-emerald-900/90 border-b border-emerald-600 px-2 py-1 flex items-center gap-2">
          <span className="text-xs text-emerald-300">Editing {selectedCells.size} cells:</span>
          <input
            ref={bulkInputRef}
            type="text"
            className="flex-1 bg-slate-950/60 border border-emerald-600 rounded px-2 py-0.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-400"
            value={bulkValue}
            onChange={handleBulkInput}
            onKeyDown={handleBulkKeyDown}
            placeholder="Type to set value for all selected cells..."
          />
          <button
            type="button"
            className="text-xs text-emerald-300 hover:text-emerald-100 px-1"
            onClick={() => {
              onClearSelection();
              setBulkValue('');
              setShowBulkInput(false);
            }}
          >
            ✕
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="p-4 text-slate-500">(no data - use Paste Raw to load)</div>
      ) : (
        <div>
          {/* Persistent sticky header showing current section */}
          {currentSectionToken && (
            <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-600 px-1 py-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-emerald-400 font-semibold text-xs">{currentSectionToken}</span>
                <span className="text-slate-500 text-[10px]">({currentSectionCols ?? 0} cols)</span>
              </div>
              <div className="flex">
                <div style={{ width: rowNumWidth }} className="flex-shrink-0" />
                {Array.from({ length: currentSectionCols ?? 0 }, (_, i) => (
                  <div
                    key={i}
                    style={{ width: getColWidth(i) }}
                    className="flex-shrink-0 text-center text-slate-600 text-[9px] cursor-pointer hover:text-slate-400 relative"
                    onClick={(e) => i > 0 && onSelectCol(i, startRow, e)}
                  >
                    {i}
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50"
                      onMouseDown={(e) => onResizeStart(i, e)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Spacer for rows above viewport */}
          {startRow > 0 && (
            <div style={{ height: startRow * rowHeight }} onMouseDown={() => onClearSelection()} />
          )}

          {/* Visible rows */}
          {visibleRows.map((row, idx) => {
            const rowIdx = startRow + idx;
            const token = row[0] ?? '';
            
            // Check if this row should be hidden (collapsed section)
            if (isRowHidden?.(rowIdx)) {
              return null;
            }
            
            // Check if this is a section boundary - render header before the row
            const sectionName = sectionBoundaries?.get(rowIdx);
            const isCollapsed = sectionName ? (collapsedSections?.has(sectionName) ?? false) : false;
            
            const isChild = isChildRow(rowIdx);
            const sectionCols = getSectionMaxCols(rowIdx);

            return (
              <div key={rowIdx}>
                {/* Section header - rendered at section boundaries */}
                {sectionName && (
                  <div
                    style={{ height: rowHeight }}
                    className="flex items-center sticky left-0 z-20 bg-slate-800 border-b-2 border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors"
                    onClick={() => onToggleSection?.(sectionName)}
                  >
                    <div className="flex items-center gap-2 px-4 text-sm font-semibold text-slate-200 select-none">
                      <svg
                        className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span>{sectionName}</span>
                      <span className="text-xs text-slate-400 ml-2">({isCollapsed ? 'collapsed' : 'click to collapse'})</span>
                    </div>
                  </div>
                )}
                
                {/* Data row */}
                {(() => {
                  // Check if this row matches the search
                  const searchLower = findText?.toLowerCase() ?? '';
                  const rowMatches = searchLower && row.some(cell => cell.toLowerCase().includes(searchLower));
                  const isCurrentMatch = currentMatchRow === rowIdx;
                  
                  let rowBg = isChild ? 'bg-slate-900/50' : '';
                  if (rowMatches) {
                    rowBg = isCurrentMatch ? 'bg-amber-700/50' : 'bg-amber-900/30';
                  }
                  
                  return (
                    <div
                      className={`flex border-b border-slate-800 ${rowBg} ${resizingCol !== null ? 'select-none' : ''}`}
                      style={{ height: rowHeight }}
                    >
                  {/* Row number */}
                  <div
                    style={{ width: rowNumWidth }}
                    className="flex-shrink-0 px-1 flex items-center justify-center text-slate-500 text-[10px] cursor-pointer hover:bg-slate-800 border-r border-slate-800"
                    onClick={(e) => onSelectRow(rowIdx, e)}
                  >
                    {rowIdx + 1}
                  </div>

                  {/* Data cells - resizable widths */}
                  {Array.from({ length: sectionCols }, (_, colIdx) => {
                    const val = row[colIdx] ?? '';
                    const sel = isSel(rowIdx, colIdx);
                    const foc = isFoc(rowIdx, colIdx);
                    const isTokenCol = colIdx === 0;

                    return (
                      <div
                        key={colIdx}
                        style={{ width: getColWidth(colIdx) }}
                        className={`flex-shrink-0 border-r border-slate-800 flex items-center relative ${
                          sel && !isTokenCol ? 'bg-emerald-900/40' : ''
                        } ${foc && !isTokenCol ? 'ring-1 ring-emerald-400 ring-inset' : ''}`}
                        onMouseDown={(e) => !isTokenCol && onCellMouseDown(rowIdx, colIdx, e)}
                        onMouseEnter={() => !isTokenCol && onCellMouseEnter(rowIdx, colIdx)}
                        onDoubleClick={() => !isTokenCol && onExpandCell({ row: rowIdx, col: colIdx })}
                      >
                        {isTokenCol ? (
                          <span
                            className={`px-1 text-[11px] truncate ${isChild ? 'text-slate-500 pl-2' : 'text-emerald-400 font-medium'}`}
                            title="Delete row to change table type"
                          >
                            {isChild ? `└ ${token}` : token}
                          </span>
                        ) : (
                          <input
                            type="text"
                            className="w-full bg-transparent border-none outline-none text-slate-100 text-xs px-1"
                            value={val}
                            onChange={(e) => onUpdateCell(rowIdx, colIdx, e.target.value)}
                            onFocus={() => !isDragging && onFocusCell({ row: rowIdx, col: colIdx })}
                          />
                        )}
                        {/* Resize handle on each cell for visual consistency */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50"
                          onMouseDown={(e) => onResizeStart(colIdx, e)}
                        />
                      </div>
                    );
                  })}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {/* Spacer for rows below viewport */}
          {endRow < rows.length && (
            <div
              style={{ height: (rows.length - endRow) * rowHeight } as React.CSSProperties}
              onMouseDown={() => onClearSelection()}
            />
          )}
        </div>
      )}
    </div>
  );
}
