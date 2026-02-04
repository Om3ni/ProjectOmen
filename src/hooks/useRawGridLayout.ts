import { useEffect, useMemo, useRef, useState } from 'react';

export type RawGridSection = {
  token: string;
  startRow: number;
  endRow: number; // exclusive
  maxCols: number;
};

export type UseRawGridLayoutArgs = {
  rows: string[][];
};

export function useRawGridLayout({ rows }: UseRawGridLayoutArgs) {
  // Column widths (resizable) - default widths in pixels
  const DEFAULT_TOKEN_COL_WIDTH = 96; // w-24
  const DEFAULT_DATA_COL_WIDTH = 64; // w-16
  const ROW_NUM_WIDTH = 40; // w-10

  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  const getColWidth = (colIdx: number) => {
    if (colWidths[colIdx] !== undefined) return colWidths[colIdx];
    return colIdx === 0 ? DEFAULT_TOKEN_COL_WIDTH : DEFAULT_DATA_COL_WIDTH;
  };

  const handleResizeStart = (colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIdx);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = getColWidth(colIdx);
  };

  useEffect(() => {
    if (resizingCol === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(40, resizeStartWidth.current + delta);
      setColWidths((prev) => ({ ...prev, [resizingCol]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // Virtualization inputs/outputs
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(500);
  const containerRef = useRef<HTMLDivElement>(null);

  const ROW_HEIGHT = 24;
  const OVERSCAN = 5;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setViewportHeight(h);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxCols = useMemo(() => Math.max(0, ...rows.map((r) => r.length)), [rows]);

  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endRow = Math.min(rows.length, startRow + visibleCount);

  const visibleRange = useMemo(
    () => ({ startRow, endRow, visibleCount, scrollTop, viewportHeight }),
    [startRow, endRow, visibleCount, scrollTop, viewportHeight],
  );

  const sections: RawGridSection[] = useMemo(() => {
    const out: RawGridSection[] = [];
    let currentToken = '';
    let start = 0;
    let sectionMaxCols = 0;

    const flush = (end: number) => {
      if (end <= start) return;
      out.push({ token: currentToken, startRow: start, endRow: end, maxCols: sectionMaxCols });
    };

    for (let i = 0; i < rows.length; i++) {
      const token = rows[i][0] ?? '';
      if (i === 0) {
        currentToken = token;
        start = 0;
        sectionMaxCols = rows[i].length;
        continue;
      }

      if (token !== currentToken) {
        flush(i);
        currentToken = token;
        start = i;
        sectionMaxCols = rows[i].length;
      } else {
        sectionMaxCols = Math.max(sectionMaxCols, rows[i].length);
      }
    }

    flush(rows.length);
    return out;
  }, [rows]);

  const sectionInfo = useMemo(() => {
    const info: { token: string; maxCols: number; sectionStart: number }[] = [];

    for (const sec of sections) {
      for (let ri = sec.startRow; ri < sec.endRow; ri++) {
        info[ri] = { token: sec.token, maxCols: sec.maxCols, sectionStart: sec.startRow };
      }
    }

    return info;
  }, [sections]);

  const getSectionMaxCols = (rowIdx: number) => sectionInfo[rowIdx]?.maxCols ?? 1;

  return {
    // col sizing
    colWidths,
    setColWidths,
    getColWidth,
    handleResizeStart,
    resizingCol,
    ROW_NUM_WIDTH,

    // virtualization
    containerRef,
    scrollTop,
    setScrollTop,
    viewportHeight,
    setViewportHeight,
    ROW_HEIGHT,
    visibleRange,

    // sections
    sections,
    sectionInfo,
    getSectionMaxCols,

    // misc
    maxCols,
  };
}
