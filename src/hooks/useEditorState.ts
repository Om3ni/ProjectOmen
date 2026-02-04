import { useEffect, useMemo, useRef, useState } from 'react';

import type { RprCategory, SchemaData, SchemaStructure, TableSchema } from '@/models/schema';
import { SchemaService } from '@/services/SchemaService';
import { normalizeDataToRanges } from '@/utils/normalize';
import { parseRprTextToSchemaData } from '@/utils/rprImport';
import { exportSchemaDataToRprText, stripRprPreviewPrefixes } from '@/utils/rprText';
import { createDefaultRecord, inferIdField, nextGlobalNumericId } from '@/utils/schemaDefaults';

export type CategoryView = {
  category: RprCategory;
  table: string;
  filter?: (row: Record<string, unknown>) => boolean;
};

export const CATEGORY_VIEWS: CategoryView[] = [
  // Dice System is a special combined settings view (DiceConfig + DiceRules + Gear)
  { category: 'Dice System', table: 'DiceConfig' },
  {
    category: 'Attributes',
    table: 'SkillDef',
    filter: (row) => String(row.TypeFlag ?? 'f').toLowerCase() === 't',
  },
  {
    category: 'Skills',
    table: 'SkillDef',
    filter: (row) => String(row.TypeFlag ?? 'f').toLowerCase() === 'f',
  },
  { category: 'Perks', table: 'PerkDef' },
  { category: 'Stats', table: 'Stat' },
  { category: 'Runes', table: 'RuneDef' },
  { category: 'Statuses', table: 'StatusDef' },
  { category: 'Mutators', table: 'MutatorDef' },
  { category: 'Abilities', table: 'SpellDef' },
];


export function asRows(data: SchemaData | null, table: string): Array<Record<string, unknown>> {
  const raw = data?.[table];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export function inferLabel(row: Record<string, unknown>): string {
  const candidates = ['Name', 'Literal', 'ID', 'Node ID'];
  for (const key of candidates) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '(unnamed)';
}

const NEW_AUTOSAVE_KEY = 'project-omen:autosave:v1';
const OLD_AUTOSAVE_KEY = 'rpr-parser-editor:autosave:v1';

type AutosavePayloadV1 = {
  v: 1;
  savedAt: number;
  schemaVersion?: string;
  tooltips?: Record<string, string>;
  data: SchemaData;
  activeCategory?: RprCategory;
  selectedIndex?: number;
};

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function stripUiMetadataFromRecord(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('__')) continue;
    next[k] = v;
  }
  return next;
}

function stripUiMetadataFromData(data: SchemaData): SchemaData {
  const next: SchemaData = {};
  for (const [tableName, tableRows] of Object.entries(data)) {
    const rows = Array.isArray(tableRows) ? (tableRows as Array<Record<string, unknown>>) : [];
    next[tableName] = rows.map(stripUiMetadataFromRecord);
  }
  return next;
}

function readAutosave(): AutosavePayloadV1 | null {
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

function writeAutosave(payload: AutosavePayloadV1): void {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(NEW_AUTOSAVE_KEY, JSON.stringify(payload));
}

function clearAutosave(): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(NEW_AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

export function useEditorState() {
  const [schema, setSchema] = useState<SchemaStructure | null>(null);
  const [data, setData] = useState<SchemaData | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<string | undefined>(undefined);
  const [tooltips, setTooltips] = useState<Record<string, string> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<RprCategory>('Attributes');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const autosaveTimerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load initial data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const [structure, dataFile] = await Promise.all([
          SchemaService.loadSchemaStructure(),
          SchemaService.loadSchemaData(),
        ]);
        if (cancelled) return;

        const autosave = readAutosave();

        setSchema(structure);
        if (autosave?.data) {
          setData(autosave.data);
          setSchemaVersion(autosave.schemaVersion ?? dataFile.schemaVersion);
          setTooltips(autosave.tooltips ?? dataFile.tooltips);

          const allowedCategories = new Set(
            (structure.categories?.length ? structure.categories : CATEGORY_VIEWS.map((c) => c.category)) as string[],
          );
          const restoredCategory = autosave.activeCategory;
          setActiveCategory(
            restoredCategory && allowedCategories.has(String(restoredCategory))
              ? restoredCategory
              : 'Attributes',
          );
          setSelectedIndex(Number.isFinite(Number(autosave.selectedIndex)) ? (autosave.selectedIndex ?? 0) : 0);
        } else {
          setData(dataFile.data);
          setSchemaVersion(dataFile.schemaVersion);
          setTooltips(dataFile.tooltips);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist edits across refreshes until the user explicitly New/Loads.
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

  // Broadcast data changes to sheet.html via BroadcastChannel
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

  // Derived state
  const categories = useMemo(() => {
    const fromSchema = schema?.categories ?? [];
    if (fromSchema.length) return fromSchema;
    return CATEGORY_VIEWS.map((c) => c.category);
  }, [schema]);

  const activeView = useMemo(() => {
    return (
      CATEGORY_VIEWS.find((v) => v.category === activeCategory) ?? {
        category: activeCategory,
        table: String(activeCategory),
      }
    );
  }, [activeCategory]);

  const tableSchema: TableSchema | undefined = schema?.tables?.[activeView.table];
  const allRows = useMemo(() => asRows(data, activeView.table), [data, activeView.table]);
  const filteredRows = useMemo(() => {
    return activeView.filter ? allRows.filter(activeView.filter) : allRows;
  }, [allRows, activeView]);

  const selected = filteredRows[selectedIndex] ?? null;
  const selectedLabel = selected ? inferLabel(selected) : '';

  const hasEmbeddedChildren =
    activeView.table === 'PerkDef' ||
    activeView.table === 'RuneDef' ||
    activeView.table === 'StatusDef' ||
    activeView.table === 'MutatorDef' ||
    activeView.table === 'SpellDef';

  // Actions
  const setActiveCategorySafe = (next: RprCategory) => {
    setActiveCategory(next);
    setSelectedIndex(0);
  };

  const updateSelectedRecord = (next: Record<string, unknown>) => {
    if (!data) return;

    const tableName = activeView.table;
    const tableRows = asRows(data, tableName);
    const tableIndex = tableRows.findIndex((r) => r === selected);
    if (tableIndex < 0) return;

    const nextTableRows = [...tableRows];
    nextTableRows[tableIndex] = next;
    setData({
      ...data,
      [tableName]: nextTableRows,
    });
  };

  const setTableRows = (tableName: string, nextRows: Array<Record<string, unknown>>) => {
    if (!data) return;
    setData({
      ...data,
      [tableName]: nextRows,
    });
  };

  const reorderFilteredRows = (fromIndex: number, toIndex: number, dropAfter: boolean) => {
    if (!data) return;

    const tableName = activeView.table;
    const tableRows = asRows(data, tableName);
    if (!tableRows.length) return;

    const filterFn = activeView.filter;
    const filteredIndices: number[] = [];
    tableRows.forEach((row, idx) => {
      if (!filterFn || filterFn(row)) filteredIndices.push(idx);
    });

    if (!filteredIndices.length) return;
    if (fromIndex < 0 || fromIndex >= filteredIndices.length) return;
    if (toIndex < 0 || toIndex >= filteredIndices.length) return;
    if (fromIndex === toIndex && !dropAfter) return;
    if (fromIndex === toIndex && dropAfter) return;

    const fromTableIndex = filteredIndices[fromIndex];
    const targetTableIndex = filteredIndices[toIndex];
    let insertIndex = dropAfter ? targetTableIndex + 1 : targetTableIndex;

    const nextRows = [...tableRows];
    const [movedRow] = nextRows.splice(fromTableIndex, 1);
    if (!movedRow) return;

    if (fromTableIndex < insertIndex) {
      insertIndex -= 1;
    }

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > nextRows.length) insertIndex = nextRows.length;

    nextRows.splice(insertIndex, 0, movedRow);

    const nextFilteredRows = filterFn ? nextRows.filter(filterFn) : nextRows;

    const prevSelectedRow = selected;
    let nextSelectedIndex = -1;
    if (prevSelectedRow) {
      nextSelectedIndex = nextFilteredRows.findIndex((row) => row === prevSelectedRow);
    }
    if (nextSelectedIndex < 0) {
      nextSelectedIndex = nextFilteredRows.findIndex((row) => row === movedRow);
    }

    setData({
      ...data,
      [tableName]: nextRows,
    });

    if (nextSelectedIndex >= 0) {
      setSelectedIndex(nextSelectedIndex);
    } else if (nextFilteredRows.length === 0) {
      setSelectedIndex(0);
    }
  };

  const addRecord = () => {
    if (!schema || !data) return;
    const tableName = activeView.table;
    const ts = schema.tables?.[tableName];
    if (!ts) return;

    const tableRows = asRows(data, tableName);
    const nextRecord = createDefaultRecord(tableName, ts);

    if (tableName === 'SkillDef') {
      if (activeCategory === 'Attributes') nextRecord.TypeFlag = 't';
      if (activeCategory === 'Skills') nextRecord.TypeFlag = 'f';
    }

    const idField = inferIdField(ts);
    if (idField) {
      nextRecord[idField] = nextGlobalNumericId(data);
    }

    // Default Name: "<Category> <ID>" (one-time clear on first click)
    const hasNameColumn = Array.isArray(ts.columns) && ts.columns.some((c) => c?.name === 'Name');
    const currentName = String(nextRecord.Name ?? '').trim();
    const idForName = idField ? Number(nextRecord[idField]) : NaN;
    if (hasNameColumn && !currentName && Number.isFinite(idForName) && idForName > 0) {
      const singularByCategory: Partial<Record<RprCategory, string>> = {
        Attributes: 'Attribute',
        Skills: 'Skill',
        Perks: 'Perk',
        Stats: 'Stat',
        Runes: 'Rune',
        Statuses: 'Status',
        Mutators: 'Mutator',
        Abilities: 'Ability',
      };
      const singular = singularByCategory[activeCategory] ?? String(activeCategory);
      const autoName = `${singular} ${idForName}`;
      nextRecord.Name = autoName;
      // Non-schema metadata used by UI; ignored by export.
      nextRecord.__autoName = autoName;
      nextRecord.__autoNameCleared = false;
    }

    // Preserve canonical file ordering on export by assigning new rows an order within their table section.
    // Find the max __rprOrder for rows in the same table, and place the new row right after.
    const currentTableRows = tableRows;
    const maxOrderInTable = currentTableRows.reduce((m, r) => {
      const n = Number((r as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, -1);
    
    // If no rows in this table have __rprOrder yet, find the max across all tables to append at the end
    const maxOrderGlobal = Object.values(data)
      .flatMap((v) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []))
      .reduce((m, r) => {
        const n = Number((r as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, -1);
    
    (nextRecord as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder = maxOrderInTable >= 0 ? maxOrderInTable + 1 : maxOrderGlobal + 1;

    const nextRows = [...tableRows, nextRecord];
    setData({
      ...data,
      [tableName]: nextRows,
    });
    setSelectedIndex(filteredRows.length);
  };

  const deleteSelected = () => {
    if (!data || !selected) return;
    const tableName = activeView.table;
    const tableRows = asRows(data, tableName);
    const tableIndex = tableRows.findIndex((r) => r === selected);
    if (tableIndex < 0) return;

    const nextRows = tableRows.slice(0, tableIndex).concat(tableRows.slice(tableIndex + 1));
    setData({
      ...data,
      [tableName]: nextRows,
    });
    setSelectedIndex((idx) => Math.max(0, Math.min(idx, filteredRows.length - 2)));
  };

  const newFile = () => {
    if (!schema) return;
    const ok = window.confirm('Start a new file? This will clear the current data (and the autosave).');
    if (!ok) return;
    clearAutosave();
    setError(null);
    setData({});
    setTooltips({});
    setSchemaVersion(schema.version);
    setSelectedIndex(0);
  };

  const requestLoadFile = () => {
    fileInputRef.current?.click();
  };

  const onLoadFileSelected = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const filename = String(file.name ?? '').toLowerCase();

        if (filename.endsWith('.json') || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
          const json = JSON.parse(text) as unknown;
          const parsed = SchemaService.parseSchemaDataFile(json);
          clearAutosave();
          setError(null);
          setData(parsed.data);
          setSchemaVersion(parsed.schemaVersion);
          setTooltips(parsed.tooltips as Record<string, string> | undefined);
          setSelectedIndex(0);
          return;
        }

        if (!schema) {
          throw new Error('Schema not loaded yet; cannot import .rpr');
        }

        const parsedData = parseRprTextToSchemaData(schema, text);
        clearAutosave();
        setError(null);
        setData(parsedData);
        setSelectedIndex(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const normalizeInPlace = () => {
    if (!schema || !data) return;
    const ok = window.confirm(
      'Normalize IDs now? This renumbers IDs into a single global sequential space starting at 1 (Attributes first), and updates known references. This modifies your in-memory data.',
    );
    if (!ok) return;
    try {
      const normalized = normalizeDataToRanges(schema, data);
      setData(normalized);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Raw export helpers
  const exportSelectionToRaw = (cat: RprCategory): string => {
    if (!schema || !data) return '';
    const view = CATEGORY_VIEWS.find((v) => v.category === cat);
    if (!view) return '';

    const includeTables = new Set([view.table]);
    const filterRow = view.filter
      ? (t: string, row: Record<string, unknown>) => (t === view.table ? view.filter!(row) : false)
      : undefined;
    return exportSchemaDataToRprText(schema, data, { includeTables, filterRow });
  };

  const exportAllToRaw = (): string => {
    if (!schema || !data) return '';
    return exportSchemaDataToRprText(schema, data);
  };

  const applyRawToSelection = (rawText: string, rawCategory: RprCategory) => {
    if (!schema || !data) return;
    const view = CATEGORY_VIEWS.find((v) => v.category === rawCategory);
    if (!view) return;

    try {
      const cleaned = stripRprPreviewPrefixes(rawText);
      const parsedData = parseRprTextToSchemaData(schema, cleaned);
      const parsedRows = asRows(parsedData, view.table);

      if (view.table === 'SkillDef' && (rawCategory === 'Attributes' || rawCategory === 'Skills')) {
        const keep = asRows(data, 'SkillDef').filter((r) => {
          const isAttr = String(r.TypeFlag ?? 'f').toLowerCase() === 't';
          return rawCategory === 'Attributes' ? !isAttr : isAttr;
        });

        const flag = rawCategory === 'Attributes' ? 't' : 'f';
        const withFlag = parsedRows.map((r) => ({ ...r, TypeFlag: flag }));

        setData({
          ...data,
          SkillDef: keep.concat(withFlag),
        });
      } else {
        setData({
          ...data,
          [view.table]: parsedRows,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  const applyRawToAll = (rawText: string) => {
    if (!schema || !data) return;
    try {
      const cleaned = stripRprPreviewPrefixes(rawText);
      const next = parseRprTextToSchemaData(schema, cleaned);
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  return {
    // State
    schema,
    data,
    schemaVersion,
    tooltips,
    error,
    activeCategory,
    selectedIndex,
    fileInputRef,

    // Derived
    categories,
    activeView,
    tableSchema,
    allRows,
    filteredRows,
    selected,
    selectedLabel,
    hasEmbeddedChildren,

    // Actions
    setError,
    setActiveCategory: setActiveCategorySafe,
    setSelectedIndex,
    updateSelectedRecord,
    setTableRows,
    reorderFilteredRows,
    addRecord,
    deleteSelected,
    newFile,
    requestLoadFile,
    onLoadFileSelected,
    normalizeInPlace,
    exportSelectionToRaw,
    exportAllToRaw,
    applyRawToSelection,
    applyRawToAll,
  };
}
