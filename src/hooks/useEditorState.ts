import { useEffect, useMemo, useRef, useState } from 'react';

import type { RprCategory, SchemaData, SchemaStructure, TableSchema } from '@/models/schema';
import { SchemaService } from '@/services/SchemaService';
import { createDefaultRecord, inferIdField } from '@/utils/schemaDefaults';
import { CHILDREN_BY_PARENT } from '@/components/childrenConfigs';
import { readAutosave } from '@/utils/autosave';
import { allocateNextNodeId, asRows, toSafeNonNegativeInt, maxNumericIdInData } from '@/utils/editorHelpers';
import { CATEGORY_VIEWS } from '@/constants/categoryViews';
import { useEditorAutosave } from './useEditorAutosave';
import { useEditorBroadcast } from './useEditorBroadcast';
import { useEditorFileIO } from './useEditorFileIO';
import { useEditorRawIO } from './useEditorRawIO';

// Re-export for backward compatibility (consumed by RawModal, RecordListSidebar, etc.)
export { CATEGORY_VIEWS } from '@/constants/categoryViews';
export type { CategoryView } from '@/constants/categoryViews';
export { asRows, inferLabel } from '@/utils/editorHelpers';

const CORE_SINGLE_ROW_TABLES: Array<'DiceConfig' | 'DiceRules' | 'Gear'> = ['DiceConfig', 'DiceRules', 'Gear'];

function ensureCoreTables(schema: SchemaStructure, data: SchemaData): SchemaData {
  const next: SchemaData = { ...data };
  const maxNodeId = maxNumericIdInData(data);

  for (const tableName of CORE_SINGLE_ROW_TABLES) {
    const tableSchema = schema.tables?.[tableName];
    if (!tableSchema) continue;

    const existing = next[tableName];
    const existingRows = Array.isArray(existing) ? (existing as Array<Record<string, unknown>>) : [];

    const defaults = createDefaultRecord(tableName, tableSchema);

    // Product requirement: dice is enabled by default.
    if (tableName === 'DiceConfig') {
      (defaults as Record<string, unknown>).EnableDiceCheck = 't';
    }

    const hydrateRecord = (record: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = { ...record };
      for (const col of tableSchema.columns ?? []) {
        const key = col?.name;
        if (!key) continue;
        const current = out[key];
        const isBlank = current === undefined || current === null || current === '';
        if (!isBlank) continue;
        if (defaults[key] !== undefined) out[key] = defaults[key];
      }
      return out;
    };

    if (existingRows.length > 0) {
      const hydrated = hydrateRecord(existingRows[0] ?? {});

      if (tableName === 'DiceConfig') {
        const baseNum = toSafeNonNegativeInt(hydrated.TotalNodes);
        hydrated.TotalNodes = Math.max(baseNum, maxNodeId);
      }

      next[tableName] = [hydrated];
      continue;
    }

    if (tableName === 'DiceConfig') {
      const baseNum = toSafeNonNegativeInt((defaults as Record<string, unknown>).TotalNodes);
      (defaults as Record<string, unknown>).TotalNodes = Math.max(baseNum, maxNodeId);
    }

    next[tableName] = [defaults];
  }

  return next;
}

export function useEditorState() {
  const [schema, setSchema] = useState<SchemaStructure | null>(null);
  const [data, setData] = useState<SchemaData | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<string | undefined>(undefined);
  const [tooltips, setTooltips] = useState<Record<string, string> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<RprCategory>('Attributes');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Initialization ---
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
          setData(ensureCoreTables(structure, autosave.data));
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
          setData(ensureCoreTables(structure, dataFile.data));
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

  // --- Sub-hooks ---
  useEditorAutosave(data, schemaVersion, tooltips, activeCategory, selectedIndex, setError);
  useEditorBroadcast(data, schemaVersion, tooltips);

  const { newFile, requestLoadFile, onLoadFileSelected } = useEditorFileIO(
    schema, ensureCoreTables, setData, setSchemaVersion, setTooltips, setSelectedIndex, setError, fileInputRef,
  );

  const { exportSelectionToRaw, exportAllToRaw, applyRawToSelection, applyRawToAll } = useEditorRawIO(
    schema, data, setData, setError,
  );

  // --- Derived state ---
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
  const selectedLabel = selected ? ((): string => {
    const candidates = ['Name', 'Literal', 'ID', 'Node ID'];
    for (const key of candidates) {
      const value = selected[key];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '(unnamed)';
  })() : '';

  const hasEmbeddedChildren =
    activeView.table === 'PerkDef' ||
    activeView.table === 'RuneDef' ||
    activeView.table === 'StatusDef' ||
    activeView.table === 'MutatorDef' ||
    activeView.table === 'SpellDef';

  // --- Navigation ---
  const setActiveCategorySafe = (next: RprCategory) => {
    setActiveCategory(next);
    setSelectedIndex(0);
  };

  // --- Row CRUD ---
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

    let nextData: SchemaData = data;

    if (tableName === 'SkillDef') {
      if (activeCategory === 'Attributes') nextRecord.TypeFlag = 't';
      if (activeCategory === 'Skills') nextRecord.TypeFlag = 'f';
    }

    const idField = inferIdField(ts);
    if (idField) {
      const alloc = allocateNextNodeId(nextData);
      nextRecord[idField] = alloc.id;
      nextData = alloc.nextData;
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
      nextRecord.__autoName = autoName;
      nextRecord.__autoNameCleared = false;
    }

    const currentTableRows = tableRows;
    const maxOrderInTable = currentTableRows.reduce((m, r) => {
      const n = Number((r as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, -1);

    const maxOrderGlobal = Object.values(data)
      .flatMap((v) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []))
      .reduce((m, r) => {
        const n = Number((r as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, -1);

    (nextRecord as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder = maxOrderInTable >= 0 ? maxOrderInTable + 1 : maxOrderGlobal + 1;

    const nextRows = [...tableRows, nextRecord];
    setData({
      ...nextData,
      [tableName]: nextRows,
    });
    setSelectedIndex(filteredRows.length);
  };

  const cloneSelectedRecord = () => {
    if (!schema || !data || !selected) return;
    const tableName = activeView.table;
    const ts = schema.tables?.[tableName];
    if (!ts) return;

    const tableRows = asRows(data, tableName);
    const tableIndex = tableRows.findIndex((r) => r === selected);
    if (tableIndex < 0) return;

    const idField = inferIdField(ts);
    const nextRecord = createDefaultRecord(tableName, ts);

    for (const col of ts.columns ?? []) {
      const name = col?.name;
      if (!name) continue;
      if (name === 'Node ID') continue;
      if (name === 'ID') continue;
      if (idField && name === idField) continue;

      if (Object.prototype.hasOwnProperty.call(selected, name)) {
        nextRecord[name] = (selected as Record<string, unknown>)[name];
      }
    }

    const oldParentId = Number((selected as Record<string, unknown>).ID);
    const oldParentIdValid = Number.isFinite(oldParentId) && oldParentId > 0;

    let nextData: SchemaData = data;
    if (idField) {
      const alloc = allocateNextNodeId(nextData);
      nextRecord[idField] = alloc.id;
      nextData = alloc.nextData;
    }

    const newParentId = Number((nextRecord as Record<string, unknown>).ID);
    const newParentIdValid = Number.isFinite(newParentId) && newParentId > 0;

    const maxOrderInTable = tableRows.reduce((m, r) => {
      const n = Number((r as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, -1);

    const maxOrderGlobal = Object.values(data)
      .flatMap((v) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []))
      .reduce((m, r) => {
        const n = Number((r as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, -1);

    (nextRecord as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder =
      maxOrderInTable >= 0 ? maxOrderInTable + 1 : maxOrderGlobal + 1;

    let nextOrder = Number((nextRecord as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
    if (!Number.isFinite(nextOrder)) nextOrder = maxOrderGlobal + 1;

    const children = CHILDREN_BY_PARENT[tableName] ?? [];
    const childTableKeys = new Set(children.map((c) => `${c.table}::${c.fk}`));
    const childRowsByTable: Record<string, Array<Record<string, unknown>>> = {};

    if (children.length && oldParentIdValid && newParentIdValid) {
      for (const key of childTableKeys) {
        const [childTable, fk] = key.split('::');
        if (!childTable || !fk) continue;

        const allChildRows = asRows(nextData, childTable);
        const rowsToClone = allChildRows.filter((r) => Number(r[fk]) === oldParentId);
        if (!rowsToClone.length) continue;

        let insertAt = -1;
        for (let i = 0; i < allChildRows.length; i += 1) {
          const row = allChildRows[i];
          if (Number(row?.[fk]) === oldParentId) insertAt = i;
        }
        insertAt = insertAt >= 0 ? insertAt + 1 : allChildRows.length;

        const sorted = [...rowsToClone].sort((a, b) => {
          const ao = Number((a as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
          const bo = Number((b as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
          if (!Number.isFinite(ao) && !Number.isFinite(bo)) return 0;
          if (!Number.isFinite(ao)) return 1;
          if (!Number.isFinite(bo)) return -1;
          return ao - bo;
        });

        const clonedChildren: Array<Record<string, unknown>> = sorted.map((row) => {
          const cloned: Record<string, unknown> = { ...row };
          cloned[fk] = newParentId;
          delete cloned['Node ID'];
          delete cloned.ID;

          nextOrder += 1;
          (cloned as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder = nextOrder;
          return cloned;
        });

        childRowsByTable[childTable] = [
          ...allChildRows.slice(0, insertAt),
          ...clonedChildren,
          ...allChildRows.slice(insertAt),
        ];
      }
    }

    const nextRows = [...tableRows];
    nextRows.splice(tableIndex + 1, 0, nextRecord);
    const merged: SchemaData = {
      ...nextData,
      [tableName]: nextRows,
    };

    for (const [childTable, rows] of Object.entries(childRowsByTable)) {
      merged[childTable] = rows;
    }

    setData(merged);

    const nextFilteredRows = activeView.filter ? nextRows.filter(activeView.filter) : nextRows;
    const nextSelectedIndex = nextFilteredRows.findIndex((r) => r === nextRecord);
    setSelectedIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : selectedIndex);
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

  return {
    // State
    schema,
    data,
    setData,
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
    cloneSelectedRecord,
    deleteSelected,
    newFile,
    requestLoadFile,
    onLoadFileSelected,
    exportSelectionToRaw,
    exportAllToRaw,
    applyRawToSelection,
    applyRawToAll,
  };
}
