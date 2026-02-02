import { useEffect, useMemo, useState } from 'react';

import type { SchemaData } from '@/models/schema';
import CharacterSheetModal from '@/components/CharacterSheetModal';
import { isElectron, getElectron } from '@/types/electron';

type InitPayload = {
  data: SchemaData;
};

export default function CharacterSheetPage() {
  const [payload, setPayload] = useState<InitPayload | null>(null);

  const isDesktop = useMemo(() => isElectron(), []);

  useEffect(() => {
    if (!isDesktop) return;

    const electron = getElectron();

    const unsub = electron?.sheetWindow?.onInit?.((data: unknown) => {
      const payload = data as InitPayload;
      setPayload(payload);
    });

    (async () => {
      try {
        const existing = await electron?.sheetWindow?.getData?.();
        if (existing && !payload) setPayload(existing as InitPayload);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
