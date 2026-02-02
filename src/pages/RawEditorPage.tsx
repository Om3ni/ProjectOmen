import { useEffect, useState, useCallback } from 'react';
import RawModal from '@/components/RawModal';
import type { RprCategory } from '@/models/schema';
import type { ElectronWindow } from '@/types/electron';

type RawEditorData = {
  mode: 'all' | 'selection';
  category: RprCategory;
  initialText: string;
};

type RawWindowApi = {
  onInit?: (cb: (payload: RawEditorData) => void) => (() => void) | void;
  getData?: () => Promise<RawEditorData | null>;
  apply?: (
    payload:
      | { type: 'selection'; text: string; category: RprCategory }
      | { type: 'all'; text: string }
  ) => void;
  close?: () => void;
};

type ElectronApi = {
  rawWindow?: RawWindowApi;
};

function getElectron(): ElectronApi | null {
  try {
    return typeof window !== 'undefined' ? ((window as ElectronWindow).electron as ElectronApi | undefined) ?? null : null;
  } catch {
    return null;
  }
}

export default function RawEditorPage() {
  const [data, setData] = useState<RawEditorData | null>(() => {
    // Check localStorage for browser popout data on mount
    const storedData = localStorage.getItem('raw-editor-popout-data');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData) as RawEditorData;
        // Clear it so refreshing doesn't use stale data
        localStorage.removeItem('raw-editor-popout-data');
        return parsed;
      } catch {
        // ignore parse errors
      }
    }
    return null;
  });

  useEffect(() => {
    // If we already have data from localStorage, don't need Electron IPC
    if (data) return;
    
    const electron = getElectron();
    if (!electron?.rawWindow) return;

    // Listen for init data from main process
    const unsub = electron.rawWindow.onInit?.((payload: RawEditorData) => {
      setData(payload);
    });

    // Also try to get data immediately in case we missed the event
    (async () => {
      try {
        const existing = await electron.rawWindow?.getData?.();
        if (existing) {
          setData(existing);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      try {
        if (typeof unsub === 'function') {
          unsub();
        }
      } catch {
        // ignore
      }
    };
  }, [data]);

  const handleApplySelection = useCallback((text: string, category: RprCategory) => {
    const electron = getElectron();
    electron?.rawWindow?.apply?.({ type: 'selection', text, category });
  }, []);

  const handleApplyAll = useCallback((text: string) => {
    const electron = getElectron();
    electron?.rawWindow?.apply?.({ type: 'all', text });
  }, []);

  const handleClose = useCallback(() => {
    const electron = getElectron();
    electron?.rawWindow?.close?.();
  }, []);

  // Stub functions for export (not used in child window but required by RawModal)
  const noopExport = useCallback(() => data?.initialText ?? '', [data]);

  if (!data) {
    return (
      <div className="h-full bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading Raw Editor...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-950 text-slate-100">
      <RawModal
        mode={data.mode}
        category={data.category}
        initialText={data.initialText}
        onApplySelection={handleApplySelection}
        onApplyAll={handleApplyAll}
        onExportSelection={noopExport}
        onExportAll={noopExport}
        onClose={handleClose}
        isChildWindow={true}
      />
    </div>
  );
}
