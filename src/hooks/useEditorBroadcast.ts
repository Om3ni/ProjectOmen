import { useEffect, useRef } from 'react';

import type { SchemaData } from '@/models/schema';
import { stripUiMetadataFromData } from '@/utils/autosave';

export function useEditorBroadcast(
  data: SchemaData | null,
  schemaVersion: string | undefined,
  tooltips: Record<string, string> | undefined,
): void {
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    try {
      broadcastChannelRef.current = new BroadcastChannel('rpr-sheet-sync');
    } catch {
      // BroadcastChannel not supported (e.g., older browsers, some privacy modes)
    }
    return () => {
      try {
        broadcastChannelRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!data || !broadcastChannelRef.current) return;

    try {
      broadcastChannelRef.current.postMessage({
        type: 'rpr-data',
        data: stripUiMetadataFromData(data),
        schemaVersion,
        tooltips,
      });
    } catch {
      // ignore broadcast failures
    }
  }, [data, schemaVersion, tooltips]);
}
