import { useCallback, useEffect, useMemo, useState } from 'react';

export type CellCoord = { row: number; col: number };

function coordKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function parseCoordKey(key: string): CellCoord {
  const [r, c] = key.split(':').map(Number);
  return { row: r, col: c };
}

export type UseGridSelectionArgs = {
  rows: string[][];
  setRows: React.Dispatch<React.SetStateAction<string[][]>>;
};

export function useGridSelection({ rows, setRows }: UseGridSelectionArgs) {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<CellCoord | null>(null);
  const [focusCell, setFocusCell] = useState<CellCoord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [addMode, setAddMode] = useState(false);

  const maxCols = useMemo(() => Math.max(0, ...rows.map((r) => r.length)), [rows]);

  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setSelectionAnchor(null);
    setFocusCell(null);
  }, []);

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      setRows((prev) => {
        const next = prev.map((r) => [...r]);
        const cellsToUpdate = selectedCells.size > 1 ? selectedCells : new Set([coordKey(rowIdx, colIdx)]);
        for (const key of cellsToUpdate) {
          const { row, col } = parseCoordKey(key);
          if (row < next.length) {
            while (next[row].length <= col) next[row].push('');
            next[row][col] = value;
          }
        }
        return next;
      });
    },
    [selectedCells, setRows],
  );

  // Bulk update all selected cells (used when typing without a focused cell)
  const bulkUpdateCells = useCallback(
    (value: string) => {
      if (selectedCells.size === 0) return;
      setRows((prev) => {
        const next = prev.map((r) => [...r]);
        for (const key of selectedCells) {
          const { row, col } = parseCoordKey(key);
          if (col === 0) continue; // Skip token column
          if (row < next.length) {
            while (next[row].length <= col) next[row].push('');
            next[row][col] = value;
          }
        }
        return next;
      });
    },
    [selectedCells, setRows],
  );

  const handleCellMouseDown = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = coordKey(rowIdx, colIdx);

      if (isCtrl) {
        const next = new Set(selectedCells);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedCells(next);
        setSelectionAnchor({ row: rowIdx, col: colIdx });
        setFocusCell({ row: rowIdx, col: colIdx });
        setAddMode(true);
        setIsDragging(true);
        e.preventDefault();
        return;
      }

      if (!e.shiftKey && selectedCells.size > 1 && selectedCells.has(key)) {
        setSelectionAnchor({ row: rowIdx, col: colIdx });
        setFocusCell({ row: rowIdx, col: colIdx });
        setIsDragging(true);
        e.preventDefault();
        return;
      }

      if (e.shiftKey && selectionAnchor) {
        const minR = Math.min(selectionAnchor.row, rowIdx);
        const maxR = Math.max(selectionAnchor.row, rowIdx);
        const minC = Math.min(selectionAnchor.col, colIdx);
        const maxC = Math.max(selectionAnchor.col, colIdx);
        const sel = new Set<string>();
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) sel.add(coordKey(r, c));
        }
        setSelectedCells(sel);
        setFocusCell({ row: rowIdx, col: colIdx });
        e.preventDefault();
      } else {
        if (!e.shiftKey && selectedCells.size === 1 && selectedCells.has(key)) {
          clearSelection();
          return;
        }
        setSelectionAnchor({ row: rowIdx, col: colIdx });
        setSelectedCells(new Set([key]));
        setFocusCell({ row: rowIdx, col: colIdx });
      }
      setIsDragging(true);
    },
    [clearSelection, selectedCells, selectionAnchor],
  );

  const handleCellMouseEnter = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (!isDragging || !selectionAnchor) return;
      const minR = Math.min(selectionAnchor.row, rowIdx);
      const maxR = Math.max(selectionAnchor.row, rowIdx);
      const minC = Math.min(selectionAnchor.col, colIdx);
      const maxC = Math.max(selectionAnchor.col, colIdx);
      const area = new Set<string>();
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) area.add(coordKey(r, c));
      }
      if (addMode) {
        const merged = new Set<string>(selectedCells);
        for (const k of area) merged.add(k);
        setSelectedCells(merged);
      } else {
        setSelectedCells(area);
      }
      setFocusCell({ row: rowIdx, col: colIdx });
    },
    [addMode, isDragging, selectionAnchor, selectedCells],
  );

  useEffect(() => {
    const up = () => {
      setIsDragging(false);
      setAddMode(false);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const selectRow = useCallback(
    (rowIdx: number, e: React.MouseEvent) => {
      const sel = new Set<string>();
      if (e.shiftKey && selectionAnchor) {
        const minR = Math.min(selectionAnchor.row, rowIdx);
        const maxR = Math.max(selectionAnchor.row, rowIdx);
        for (let r = minR; r <= maxR; r++) {
          for (let c = 0; c < maxCols; c++) sel.add(coordKey(r, c));
        }
        const same = sel.size === selectedCells.size && Array.from(sel).every((s) => selectedCells.has(s));
        if (same) {
          clearSelection();
          return;
        }
      } else {
        for (let c = 0; c < maxCols; c++) sel.add(coordKey(rowIdx, c));
        const same = sel.size === selectedCells.size && Array.from(sel).every((s) => selectedCells.has(s));
        if (same) {
          clearSelection();
          return;
        }
        setSelectionAnchor({ row: rowIdx, col: 0 });
      }
      setSelectedCells(sel);
      // Don't set focusCell so bulk input can capture keystrokes
      setFocusCell(null);
    },
    [clearSelection, maxCols, selectedCells, selectionAnchor],
  );

  const selectCol = useCallback(
    (colIdx: number, sectionStartRow: number, e: React.MouseEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const sectionToken = rows[sectionStartRow]?.[0] ?? '';
      let sectionEnd = sectionStartRow;
      while (sectionEnd < rows.length && rows[sectionEnd]?.[0] === sectionToken) {
        sectionEnd++;
      }

      const sel = new Set<string>();
      if (e.shiftKey && selectionAnchor) {
        const minC = Math.min(selectionAnchor.col, colIdx);
        const maxC = Math.max(selectionAnchor.col, colIdx);
        for (let r = sectionStartRow; r < sectionEnd; r++) {
          for (let c = minC; c <= maxC; c++) sel.add(coordKey(r, c));
        }
        const same = sel.size === selectedCells.size && Array.from(sel).every((s) => selectedCells.has(s));
        if (same) {
          clearSelection();
          return;
        }
        if (isCtrl) {
          const merged = new Set<string>(selectedCells);
          for (const k of sel) merged.add(k);
          setSelectedCells(merged);
          setSelectionAnchor({ row: sectionStartRow, col: colIdx });
          // Don't set focusCell so bulk input can capture keystrokes
          setFocusCell(null);
          return;
        }
      } else if (isCtrl) {
        for (let r = sectionStartRow; r < sectionEnd; r++) sel.add(coordKey(r, colIdx));
        const allSelected = Array.from(sel).every((s) => selectedCells.has(s));
        if (allSelected) {
          const next = new Set<string>(selectedCells);
          for (const s of sel) next.delete(s);
          setSelectedCells(next);
          return;
        }
        const merged = new Set<string>(selectedCells);
        for (const k of sel) merged.add(k);
        setSelectedCells(merged);
        setSelectionAnchor({ row: sectionStartRow, col: colIdx });
        // Don't set focusCell so bulk input can capture keystrokes
        setFocusCell(null);
        return;
      } else {
        for (let r = sectionStartRow; r < sectionEnd; r++) sel.add(coordKey(r, colIdx));
        const same = sel.size === selectedCells.size && Array.from(sel).every((s) => selectedCells.has(s));
        if (same) {
          clearSelection();
          return;
        }
        setSelectionAnchor({ row: sectionStartRow, col: colIdx });
      }

      setSelectedCells(sel);
      // Don't set focusCell so bulk input can capture keystrokes
      setFocusCell(null);
    },
    [clearSelection, rows, selectedCells, selectionAnchor],
  );

  const isSel = useCallback((r: number, c: number) => selectedCells.has(coordKey(r, c)), [selectedCells]);
  const isFoc = useCallback((r: number, c: number) => focusCell?.row === r && focusCell?.col === c, [focusCell]);

  return {
    selectedCells,
    selectionAnchor,
    focusCell,
    setFocusCell,
    isDragging,
    addMode,
    clearSelection,
    updateCell,
    bulkUpdateCells,
    handleCellMouseDown,
    handleCellMouseEnter,
    selectRow,
    selectCol,
    isSel,
    isFoc,
  };
}
