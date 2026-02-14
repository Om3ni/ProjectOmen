import { useEffect, useRef } from 'react';

import type { RprCategory, SchemaData } from '@/models/schema';
import { writeAutosave, stripUiMetadataFromData } from '@/utils/autosave';

export function useEditorAutosave(
  data: SchemaData | null,
  schemaVersion: string | undefined,
  tooltips: Record<string, string> | undefined,
  activeCategory: RprCategory,
  selectedIndex: number,
  setError: (fn: (prev: string | null) => string | null) => void,
): void {
  const autosaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!data) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        writeAutosave({
          v: 1,
          savedAt: Date.now(),
          schemaVersion,
          tooltips,
          data: stripUiMetadataFromData(data),
          activeCategory,
          selectedIndex,
        });
      } catch (e) {
        // localStorage can fail (quota, privacy mode). Don't break the editor.
        setError((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
      }
    }, 300);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [data, schemaVersion, tooltips, activeCategory, selectedIndex]);
}
