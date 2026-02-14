import { useEffect, useMemo, useState } from 'react';

import type { SchemaData } from '@/models/schema';
import CharacterSheetModal from '@/components/CharacterSheetModal';
import { isElectron, getElectron } from '@/types/electron';
import { SchemaService } from '@/services/SchemaService';
import type { Settings } from '@/services/SettingsService';

type InitPayload = {
  data: SchemaData;
  settings?: Settings;
};

export default function CharacterSheetPage() {
  const [payload, setPayload] = useState<InitPayload | null>(null);

  const isDesktop = useMemo(() => isElectron(), []);

  useEffect(() => {
    const electron = isDesktop ? getElectron() : null;

    const unsub = electron?.sheetWindow?.onInit?.((data: unknown) => {
      const next = data as InitPayload;
      if (next?.data) setPayload(next);
    });

    // Always self-load schema-data.json so the EXE build can populate even if
    // the init payload is missed/too large. IPC updates can still override.
    (async () => {
      try {
        const loaded = await SchemaService.loadSchemaData();
        if (loaded?.data) setPayload({ data: loaded.data });
      } catch {
        // ignore
      }

      // If the main process has a newer in-memory snapshot, apply it.
      try {
        const existing = await electron?.sheetWindow?.getData?.();
        const next = existing as InitPayload | null;
        if (next?.data) setPayload(next);
      } catch {
        // ignore
      }
    })();

    return () => {
      try {
        unsub?.();
      } catch {
        // ignore
      }
    };
  }, [isDesktop]);

  if (!payload?.data) {
    return <div className="h-full w-full bg-slate-950 text-slate-200 p-4">Loading character sheet…</div>;
  }

  return (
    <div className="h-full w-full overflow-hidden bg-slate-950 text-slate-100">
      <CharacterSheetModal
        data={payload.data}
        isChildWindow={true}
        onClose={() => {
          try {
            const electron = getElectron();
            electron?.sheetWindow?.close?.();
          } catch {
            window.close();
          }
        }}
      />
    </div>
  );
}
