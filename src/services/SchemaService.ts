import type { SchemaData, SchemaDataFile, SchemaStructure } from '@/models/schema';
import { getAdapter } from './PlatformAdapter';

type FetchOptions = {
  cacheBust?: boolean;
};

function resolvePublicAssetUrl(path: string): string {
  // `path` is typically like "/schema-data.json".
  // In production Electron builds we load the renderer via file:// and leading slashes
  // would resolve to the filesystem root (and fail). Resolve against Vite's BASE_URL.
  const clean = path.replace(/^\/+/, '');
  const base = new URL(import.meta.env.BASE_URL ?? './', window.location.href);
  return new URL(clean, base).toString();
}

function shouldCacheBust(): boolean {
  // Cache-busting query params do not work reliably with file:// URLs.
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

async function fetchJson<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const adapter = getAdapter();
  const resolved = resolvePublicAssetUrl(path);
  const url = options.cacheBust && shouldCacheBust() ? `${resolved}?v=${Date.now()}` : resolved;
  const text = await adapter.readFile(url);
  return JSON.parse(text) as T;
}

async function fetchJsonOptional<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  try {
    return await fetchJson<T>(path, options);
  } catch {
    return null;
  }
}

type SchemaUiOverrideFile = {
  // Partial UI overrides per table. This file is optional.
  tables?: Record<string, { ui?: Record<string, unknown> } | undefined>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeRecord(base: unknown, override: unknown): Record<string, unknown> {
  const a = isPlainObject(base) ? base : {};
  const b = isPlainObject(override) ? override : {};
  return { ...a, ...b };
}

function mergeTableUi(baseUi: unknown, overrideUi: unknown): Record<string, unknown> {
  const base = isPlainObject(baseUi) ? baseUi : {};
  const override = isPlainObject(overrideUi) ? overrideUi : {};

  const out: Record<string, unknown> = { ...base, ...override };

  // Merge known nested maps instead of clobbering them.
  const mapKeys = ['labels', 'tooltips', 'input', 'rows', 'span', 'scale', 'skipLineBefore'] as const;
  for (const key of mapKeys) {
    out[key] = mergeRecord(base[key], override[key]);
  }

  out.hiddenByTab = mergeRecord(base.hiddenByTab, override.hiddenByTab);
  out.layoutGrid = mergeRecord(base.layoutGrid, override.layoutGrid);

  // layoutGridScoped is a map of scopeKey -> layoutGrid map
  const baseScoped = isPlainObject(base.layoutGridScoped) ? base.layoutGridScoped : {};
  const overrideScoped = isPlainObject(override.layoutGridScoped) ? override.layoutGridScoped : {};
  const mergedScoped: Record<string, unknown> = { ...baseScoped, ...overrideScoped };
  for (const [scopeKey, scopeValue] of Object.entries(overrideScoped)) {
    mergedScoped[scopeKey] = mergeRecord(baseScoped[scopeKey], scopeValue);
  }
  out.layoutGridScoped = mergedScoped;

  // Arrays are replaced (override wins)
  if (Array.isArray(override.hidden)) out.hidden = override.hidden;
  if (Array.isArray(override.displayOrder)) out.displayOrder = override.displayOrder;

  return out;
}

function mergeSchemaStructureWithUi(base: SchemaStructure, overrideFile: SchemaUiOverrideFile | null): SchemaStructure {
  if (!overrideFile || !overrideFile.tables || typeof overrideFile.tables !== 'object') return base;

  const next: SchemaStructure = {
    ...base,
    tables: { ...base.tables },
  };

  for (const [tableName, overrideEntry] of Object.entries(overrideFile.tables)) {
    if (!overrideEntry || !overrideEntry.ui) continue;
    const baseTable = next.tables[tableName];
    if (!baseTable) continue;
    next.tables[tableName] = {
      ...baseTable,
      ui: mergeTableUi(baseTable.ui as unknown, overrideEntry.ui),
    };
  }

  return next;
}

function normalizeSchemaData(payload: unknown): { data: SchemaData; schemaVersion?: string; tooltips?: SchemaDataFile['tooltips'] } {
  if (payload && typeof payload === 'object') {
    const anyPayload = payload as Record<string, unknown>;
    const inner = anyPayload.data;
    if (inner && typeof inner === 'object') {
      return {
        data: inner as SchemaData,
        schemaVersion: typeof anyPayload.schemaVersion === 'string' ? anyPayload.schemaVersion : undefined,
        tooltips: typeof anyPayload.tooltips === 'object' ? (anyPayload.tooltips as SchemaDataFile['tooltips']) : undefined,
      };
    }

    // Legacy: some tools may export raw { TableName: [...] }
    const looksLikeTables = Object.values(anyPayload).some((v) => Array.isArray(v));
    if (looksLikeTables) {
      return { data: anyPayload as SchemaData };
    }
  }

  throw new Error('schema-data.json has an unexpected shape');
}

function normalizeSchemaStructure(payload: unknown): SchemaStructure {
  if (!payload || typeof payload !== 'object') {
    throw new Error('schema-structure.json has an unexpected shape');
  }
  const obj = payload as Record<string, unknown>;
  const tables = obj.tables;
  if (!tables || typeof tables !== 'object') {
    throw new Error('schema-structure.json missing "tables"');
  }
  return payload as SchemaStructure;
}

export const SchemaService = {
  parseSchemaDataFile(payload: unknown): { data: SchemaData; schemaVersion?: string; tooltips?: SchemaDataFile['tooltips'] } {
    return normalizeSchemaData(payload);
  },

  async loadSchemaStructure(): Promise<SchemaStructure> {
    try {
      const structured = await fetchJson<unknown>('/schema-structure.json', { cacheBust: true });
      const base = normalizeSchemaStructure(structured);

      // Optional UI overlay: keeps per-tab/per-page layout hints out of schema-structure.json
      const uiOverride = await fetchJsonOptional<unknown>('/schema-ui.json', { cacheBust: true });
      const normalizedOverride = uiOverride ? (uiOverride as SchemaUiOverrideFile) : null;
      return mergeSchemaStructureWithUi(base, normalizedOverride);
    } catch {
      // Optional legacy fallback: combined schema.json
      const legacy = await fetchJson<unknown>('/schema.json', { cacheBust: true });
      return normalizeSchemaStructure(legacy);
    }
  },

  async loadSchemaData(): Promise<{ data: SchemaData; schemaVersion?: string; tooltips?: SchemaDataFile['tooltips'] }> {
    const payload = await fetchJson<unknown>('/schema-data.json', { cacheBust: true });
    return normalizeSchemaData(payload);
  },
};
