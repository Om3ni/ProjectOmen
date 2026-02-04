import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RprCategory } from '@/models/schema';
import { CATEGORY_VIEWS } from '@/hooks/useEditorState';
import { useRawGridState } from '@/hooks/useRawGridState';
import { useGridSelection, type CellCoord } from '@/hooks/useGridSelection';
import { useRawGridLayout } from '@/hooks/useRawGridLayout';
import { sequenceIds } from '@/utils/rprSequence';

import { ExpandedCellEditor } from '@/components/raw/ExpandedCellEditor';
import { RawToolbar } from '@/components/raw/RawToolbar';
import { RawPastePanel } from '@/components/raw/RawPastePanel';
import { RawFindReplaceBar } from '@/components/raw/RawFindReplaceBar';
import { RawGrid } from '@/components/raw/RawGrid';

type Props = {
  mode: 'all' | 'selection';
  category: RprCategory;
  initialText: string;
  onApplySelection: (text: string, category: RprCategory) => void;
  onApplyAll: (text: string) => void;
  onExportSelection: (cat: RprCategory) => string;
  onExportAll: () => string;
  onClose: () => void;
  /** When true, renders as full-page component (no modal overlay) */
  isChildWindow?: boolean;
};

export default function RawModal({
  mode: initialMode,
  category: initialCategory,
  initialText,
  onApplySelection,
  onApplyAll,
  onExportSelection,
  onExportAll,
  onClose,
  isChildWindow = false,
}: Props) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Resizable modal dimensions (percentage of viewport)
  const [modalSize, setModalSize] = useState({ width: 95, height: 90 });

  const { rawMode, rows, setRows, rawCategory, setRawCategory, rawText, refreshFromCategory, importFromText } =
    useRawGridState({ initialText, initialCategory, mode: initialMode });
  
  // Section boundaries for collapsible headers (raw index → section name)
  const sectionBoundaries = useMemo(() => {
    if (rawMode !== 'all') return new Map<number, string>();
    
    const mainTables = new Set(['SkillDef', 'PerkDef', 'RuneDef', 'Stat', 'SpellDef', 'MutatorDef', 'StatusDef']);
    const boundaries = new Map<number, string>();
    let lastMainTable = '';
    
    rows.forEach((row, idx) => {
      const token = row[0] || '';
      if (mainTables.has(token) && token !== lastMainTable) {
        boundaries.set(idx, token);
        lastMainTable = token;
      }
    });
    
    return boundaries;
  }, [rows, rawMode]);
  
  // Section ranges for filtering (section name → { start, end })
  const sectionRanges = useMemo(() => {
    const ranges = new Map<string, { start: number; end: number }>();
    const entries = Array.from(sectionBoundaries.entries()).sort((a, b) => a[0] - b[0]);
    
    entries.forEach(([startIdx, name], i) => {
      const endIdx = i < entries.length - 1 ? entries[i + 1][0] : rows.length;
      ranges.set(name, { start: startIdx, end: endIdx });
    });
    
    return ranges;
  }, [sectionBoundaries, rows.length]);
  
  // Toggle section collapse
  const toggleSection = useCallback((sectionName: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  }, []);
  
  // Check if a row index should be hidden
  const isRowHidden = useCallback((rowIdx: number) => {
    for (const [section, range] of sectionRanges.entries()) {
      if (collapsedSections.has(section) && rowIdx >= range.start && rowIdx < range.end) {
        // But don't hide the first row (the header row)
        if (rowIdx === range.start) return false;
        return true;
      }
    }
    return false;
  }, [sectionRanges, collapsedSections]);

  const {
    selectedCells,
    focusCell,
    setFocusCell,
    isDragging,
    clearSelection,
    updateCell,
    bulkUpdateCells,
    handleCellMouseDown,
    handleCellMouseEnter,
    selectRow,
    selectCol,
    isSel,
    isFoc,
  } = useGridSelection({ rows, setRows });

  // Expand modal for long content
  const [expandCell, setExpandCell] = useState<CellCoord | null>(null);

  // Find/Replace with navigation
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Compute all matches whenever findText or rows change
  const findMatches = useMemo(() => {
    if (!findText) return [];
    const matches: Array<{ row: number; col: number }> = [];
    const searchLower = findText.toLowerCase();
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      for (let ci = 0; ci < row.length; ci++) {
        if (row[ci].toLowerCase().includes(searchLower)) {
          matches.push({ row: ri, col: ci });
        }
      }
    }
    return matches;
  }, [findText, rows]);

  // Paste raw - always show when no data, allow toggle otherwise
  const [showPasteManual, setShowPasteManual] = useState(!initialText.trim());
  const showPaste = rows.length === 0 || showPasteManual;
  const [pasteText, setPasteText] = useState('');

  // Pop out to new window (works in browser dev server)
  const handlePopOut = useCallback(() => {
    // Store current data in localStorage for the child window to pick up
    const popoutData = {
      mode: rawMode,
      category: rawCategory,
      initialText: rawText,
    };
    localStorage.setItem('raw-editor-popout-data', JSON.stringify(popoutData));
    const url = `${window.location.origin}${window.location.pathname}?raw-editor=1`;
    window.open(url, '_blank', 'width=1200,height=800,menubar=no,toolbar=no');
  }, [rawMode, rawCategory, rawText]);

  // Handle resize drag
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = modalSize.width;
    const startHeight = modalSize.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const newWidth = Math.min(98, Math.max(50, startWidth + (deltaX / window.innerWidth) * 100));
      const newHeight = Math.min(98, Math.max(40, startHeight + (deltaY / window.innerHeight) * 100));
      setModalSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [modalSize]);

  // Track token groups for visual styling
  const getRowToken = useCallback((rowIdx: number) => rows[rowIdx]?.[0] ?? '', [rows]);

  const {
    getColWidth,
    handleResizeStart,
    resizingCol,
    ROW_NUM_WIDTH,
    containerRef,
    setScrollTop,
    ROW_HEIGHT,
    visibleRange,
    getSectionMaxCols,
  } = useRawGridLayout({ rows });

  const { startRow, endRow } = visibleRange;
  const visibleRows = useMemo(() => rows.slice(startRow, endRow), [rows, startRow, endRow]);

  // Child tokens get indented styling
  const childTokens = new Set([
    'SpellReqDef', 'SpellTargetCond', 'SpellEffect',
    'RuneCond', 'RuneEffect', 'PerkEffect', 'StatusAction',
    'MutatorAction', 'MutatorCondition',
  ]);
  const isChildRow = (rowIdx: number) => childTokens.has(getRowToken(rowIdx));
  
  // Calculate the current section based on the first visible row
  const currentSectionInfo = useMemo(() => {
    if (rows.length === 0) return { token: '', cols: 0 };
    const token = getRowToken(startRow);
    const cols = getSectionMaxCols(startRow);
    return { token, cols };
  }, [rows, startRow, getSectionMaxCols, getRowToken]);

  const handleApplySelection = () => {
    try {
      setLocalError(null);
      onApplySelection(rawText, rawCategory);
      onClose();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleApplyAll = () => {
    try {
      setLocalError(null);
      onApplyAll(rawText);
      onClose();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshFromAll = () => {
    importFromText(onExportAll());
    clearSelection();
  };

  const handlePasteApply = () => {
    importFromText(pasteText);
    setPasteText('');
    setShowPasteManual(false);
    clearSelection();
  };

  // Navigate to a specific match and scroll it into view
  const goToMatch = useCallback((index: number) => {
    if (findMatches.length === 0) return;
    const wrappedIndex = ((index % findMatches.length) + findMatches.length) % findMatches.length;
    setCurrentMatchIndex(wrappedIndex);
    const match = findMatches[wrappedIndex];
    if (!match) return;

    // Select the matched cell
    setFocusCell({ row: match.row, col: match.col });
    clearSelection();

    // Scroll the row into view
    const targetScrollTop = match.row * ROW_HEIGHT;
    const container = containerRef.current;
    if (container) {
      const viewportHeight = container.clientHeight;
      const currentScrollTop = container.scrollTop;
      // Only scroll if the row is outside the visible area
      if (targetScrollTop < currentScrollTop || targetScrollTop > currentScrollTop + viewportHeight - ROW_HEIGHT) {
        container.scrollTop = Math.max(0, targetScrollTop - viewportHeight / 3);
        setScrollTop(container.scrollTop);
      }
    }
  }, [findMatches, setFocusCell, clearSelection, ROW_HEIGHT, containerRef, setScrollTop]);

  const handleFindNext = useCallback(() => {
    goToMatch(currentMatchIndex + 1);
  }, [goToMatch, currentMatchIndex]);

  const handleFindPrev = useCallback(() => {
    goToMatch(currentMatchIndex - 1);
  }, [goToMatch, currentMatchIndex]);

  // Auto-jump to first match when search text changes and has matches
  const prevFindTextRef = useRef('');
  useEffect(() => {
    if (findText !== prevFindTextRef.current) {
      prevFindTextRef.current = findText;
      if (findMatches.length > 0 && findText) {
        // Schedule the navigation for after render
        setTimeout(() => goToMatch(0), 0);
      }
    }
  }, [findText, findMatches.length, goToMatch]);

  // Find/Replace
  const handleFindReplace = () => {
    if (!findText) return;
    const inSel = selectedCells.size > 0;
    setRows((prev) => {
      let done = false;
      return prev.map((r, ri) =>
        r.map((c, ci) => {
          if (done) return c;
          if (inSel && !selectedCells.has(`${ri}:${ci}`)) return c;
          if (c.includes(findText)) {
            done = true;
            return c.replace(findText, replaceText);
          }
          return c;
        }),
      );
    });
  };

  const handleFindReplaceAll = () => {
    if (!findText) return;
    const inSel = selectedCells.size > 0;
    setRows((prev) =>
      prev.map((r, ri) =>
        r.map((c, ci) => {
          if (inSel && !selectedCells.has(`${ri}:${ci}`)) return c;
          return c.split(findText).join(replaceText);
        }),
      ),
    );
  };

  const handleSequence = () => {
    setRows((prev) => sequenceIds(prev));
  };

  // Expand modal
  const expandValue = expandCell ? (rows[expandCell.row]?.[expandCell.col] ?? '') : '';

  // When in child window mode, render full-page without modal overlay
  const outerClasses = isChildWindow
    ? 'h-full flex flex-col bg-slate-950 overflow-hidden'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-hidden';

  // Dynamic sizing for resizable modal
  const innerStyle = isChildWindow ? undefined : {
    width: `${modalSize.width}vw`,
    height: `${modalSize.height}vh`,
  };

  const innerClasses = isChildWindow
    ? 'flex-1 flex flex-col min-h-0 p-4'
    : 'relative flex flex-col flex-1 min-h-0 rounded-lg border border-slate-800 bg-slate-950 p-4 overflow-hidden';

  return (
    <div className={outerClasses}>
      <ExpandedCellEditor
        cell={expandCell}
        value={expandValue}
        onUpdate={updateCell}
        onClose={() => setExpandCell(null)}
      />

      <div
        className={innerClasses}
        style={innerStyle}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
      >
        {/* Resize handle for modal (bottom-right corner) */}
        {!isChildWindow && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 hover:bg-slate-700/50"
            onMouseDown={handleResizeMouseDown}
            style={{ 
              background: 'linear-gradient(135deg, transparent 50%, #475569 50%)',
              borderBottomRightRadius: '0.5rem'
            }}
          />
        )}

        <RawToolbar
          rawMode={rawMode}
          rawCategory={rawCategory}
          categoryViews={CATEGORY_VIEWS}
          onChangeCategory={(next) => {
            setRawCategory(next);
            refreshFromCategory(next, onExportSelection(next));
          }}
          onLoadGrouped={() => {
            if (rawMode === 'selection') {
              refreshFromCategory(rawCategory, onExportSelection(rawCategory));
            } else {
              refreshFromAll();
            }
          }}
          onApply={() => {
            if (rawMode === 'selection') {
              handleApplySelection();
            } else {
              handleApplyAll();
            }
          }}
          showPaste={showPaste}
          onTogglePaste={() => setShowPasteManual((p) => !p)}
          onCopy={() => {
            // Use the export functions to preserve original file order
            const textToCopy = rawMode === 'selection' ? onExportSelection(rawCategory) : onExportAll();
            navigator.clipboard?.writeText(textToCopy);
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
          }}
          onClose={onClose}
          onPopOut={isChildWindow ? undefined : handlePopOut}
        />

        {localError && (
          <div className="mt-4 rounded-md border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200">
            {localError}
          </div>
        )}

        {/* Copied notification */}
        {showCopied && (
          <div className="fixed left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 animate-fade-out">
            <div className="px-6 py-3 text-base text-gray-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
              Copied
            </div>
          </div>
        )}

        <RawPastePanel
          show={showPaste}
          autoFocus={!initialText.trim()}
          pasteText={pasteText}
          canCancel={rows.length > 0}
          onChangePasteText={setPasteText}
          onLoad={handlePasteApply}
          onCancel={() => setShowPasteManual(false)}
        />

        {rows.length > 0 && (
          <>
            <RawFindReplaceBar
              selectedCount={selectedCells.size}
              findText={findText}
              replaceText={replaceText}
              onChangeFindText={setFindText}
              onChangeReplaceText={setReplaceText}
              onReplace={handleFindReplace}
              onReplaceAll={handleFindReplaceAll}
              onSequenceIds={handleSequence}
              onClearSelection={clearSelection}
              matchCount={findMatches.length}
              currentMatchIndex={currentMatchIndex}
              onFindNext={handleFindNext}
              onFindPrev={handleFindPrev}
            />

            <RawGrid
              isChildWindow={isChildWindow}
              rows={rows}
              visibleRows={visibleRows}
              startRow={startRow}
              endRow={endRow}
              rowHeight={ROW_HEIGHT}
              rowNumWidth={ROW_NUM_WIDTH}
              containerRef={containerRef}
              onScrollTopChange={setScrollTop}
              onClearSelection={clearSelection}
              getSectionMaxCols={getSectionMaxCols}
              getColWidth={getColWidth}
              onResizeStart={handleResizeStart}
              isChildRow={isChildRow}
              resizingCol={resizingCol}
              onSelectCol={selectCol}
              onSelectRow={selectRow}
              isSel={isSel}
              isFoc={isFoc}
              focusCell={focusCell}
              selectedCells={selectedCells}
              onCellMouseDown={handleCellMouseDown}
              onCellMouseEnter={handleCellMouseEnter}
              onExpandCell={(coord) => setExpandCell(coord)}
              onUpdateCell={updateCell}
              onBulkUpdateCells={bulkUpdateCells}
              onFocusCell={setFocusCell}
              isDragging={isDragging}
              findText={findText}
              currentMatchRow={findMatches[currentMatchIndex]?.row}
              currentSectionToken={currentSectionInfo.token}
              currentSectionCols={currentSectionInfo.cols}
              sectionBoundaries={sectionBoundaries}
              collapsedSections={collapsedSections}
              onToggleSection={toggleSection}
              isRowHidden={isRowHidden}
            />
          </>
        )}
      </div>
    </div>
  );
}
