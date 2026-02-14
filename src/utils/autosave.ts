import type { RprCategory, SchemaData } from '@/models/schema';

export const NEW_AUTOSAVE_KEY = 'project-omen:autosave:v1';
export const OLD_AUTOSAVE_KEY = 'rpr-parser-editor:autosave:v1';

export type AutosavePayloadV1 = {
  v: 1;
  savedAt: number;
  schemaVersion?: string;
  tooltips?: Record<string, string>;
  data: SchemaData;
  activeCategory?: RprCategory;
  selectedIndex?: number;
};

export function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function stripUiMetadataFromRecord(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('__')) continue;
    next[k] = v;
  }
  return next;
}

export function stripUiMetadataFromData(data: SchemaData): SchemaData {
  const next: SchemaData = {};
  for (const [tableName, tableRows] of Object.entries(data)) {
    const rows = Array.isArray(tableRows) ? (tableRows as Array<Record<string, unknown>>) : [];
    next[tableName] = rows.map(stripUiMetadataFromRecord);
  }
  return next;
}

export function readAutosave(): AutosavePayloadV1 | null {
  if (!canUseLocalStorage()) return null;
  try {
    const rawNew = window.localStorage.getItem(NEW_AUTOSAVE_KEY);
    const raw = rawNew ?? window.localStorage.getItem(OLD_AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Partial<AutosavePayloadV1>;
    if (p.v !== 1) return null;
    if (!p.data || typeof p.data !== 'object') return null;
    // If we read from the old key and the new key wasn't present, migrate and remove the old key
    if (!rawNew) {
      try {
        window.localStorage.setItem(NEW_AUTOSAVE_KEY, raw);
        window.localStorage.removeItem(OLD_AUTOSAVE_KEY);
      } catch {
        // ignore quota or privacy failures
      }
    }
    return p as AutosavePayloadV1;
  } catch {
    return null;
  }
}

export function writeAutosave(payload: AutosavePayloadV1): void {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(NEW_AUTOSAVE_KEY, JSON.stringify(payload));
}

export function clearAutosave(): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(NEW_AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}
