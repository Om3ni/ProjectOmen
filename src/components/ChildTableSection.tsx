import { useMemo, useState } from 'react';

import type { SchemaData, SchemaStructure, TableSchema } from '@/models/schema';
import RecordEditor from '@/components/RecordEditor';
import PerkEffectEditor from '@/components/PerkEffectEditor';
import RuneEffectEditor from '@/components/RuneEffectEditor';
import RuneConditionEditor from '@/components/RuneConditionEditor';
import StatusActionEditor from '@/components/StatusActionEditor';
import MutatorActionEditor from '@/components/MutatorActionEditor';
import MutatorConditionEditor from '@/components/MutatorConditionEditor';
import SpellEffectEditor from '@/components/SpellEffectEditor';
import SpellReqDefEditor from '@/components/SpellReqDefEditor';
import SpellTargetCondEditor from '@/components/SpellTargetCondEditor';
import { createDefaultRecord } from '@/utils/schemaDefaults';

// Type for records with internal metadata
type RecordWithMeta = Record<string, unknown> & { __rprOrder?: unknown };

export type ChildConfig = {
  table: string;
  fk: string;
  label: string;
  defaults?: (parent: Record<string, unknown>) => Record<string, unknown>;
  hideLinkInfo?: boolean;
  addButtonLabel?: string;
  deleteButtonLabel?: string;
  perRowDelete?: boolean;
  customEditor?:
    | 'perkEffect'
    | 'runeEffect'
    | 'runeCondition'
    | 'statusAction'
    | 'mutatorAction'
    | 'mutatorCondition'
    | 'spellEffect'
    | 'spellReqDef'
    | 'spellTargetCond';
  inlineEditor?: boolean;
  /** Optional field name to filter rows by (e.g. 'Outcome' for SpellEffect) */
  filterField?: string;
  /** Value to match for filterField (e.g. 0, 1, 2 for General/Success/Failure) */
  filterValue?: unknown;
};

type Props = {
  schema: SchemaStructure;
  data: SchemaData;
  parent: Record<string, unknown>;
  parentId: number;
  child: ChildConfig;
  tabName?: string;
  allowIdEdit?: boolean;
  onChangeParent?: (next: Record<string, unknown>) => void;
  onSetTableRows: (table: string, nextRows: Array<Record<string, unknown>>) => void;
};

function asRows(data: SchemaData, table: string): Array<Record<string, unknown>> {
  const raw = data[table];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function inferLabel(row: Record<string, unknown>): string {
  const candidates = ['Name', 'Label', 'Description', 'ID', 'Node ID', 'Function'];
  for (const key of candidates) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '(child)';
}

export default function ChildTableSection({
  schema,
  data,
  parent,
  parentId,
  child,
  tabName,
  allowIdEdit = false,
  onChangeParent,
  onSetTableRows,
}: Props) {
  const childSchema: TableSchema | undefined = schema.tables?.[child.table];
  const allRows = useMemo(() => asRows(data, child.table), [data, child.table]);

  const childRows = useMemo(() => {
    let rows = allRows.filter((r) => Number(r[child.fk]) === parentId);
    // Apply additional filter if filterField is specified
    if (child.filterField !== undefined && child.filterValue !== undefined) {
      rows = rows.filter((r) => {
        const fieldVal = r[child.filterField!];
        // Compare as numbers if both are numeric, otherwise as strings
        if (typeof child.filterValue === 'number' && typeof fieldVal === 'number') {
          return fieldVal === child.filterValue;
        }
        return String(fieldVal) === String(child.filterValue);
      });
    }
    return rows;
  }, [allRows, child.fk, parentId, child.filterField, child.filterValue]);

  const scopeKey = `${child.table}:${parentId}:${child.filterValue ?? ''}`;
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Reset selection when parent or filter context changes
  if (prevScopeKey !== scopeKey) {
    setPrevScopeKey(scopeKey);
    setSelectedIndex(0);
  }


  const selected = childRows[selectedIndex] ?? null;

  const updateSelected = (next: Record<string, unknown>) => {
    if (!selected) return;

    // enforce fk
    const normalized: Record<string, unknown> = { ...next, [child.fk]: parentId };

    const tableIndex = allRows.findIndex((r) => r === selected);
    if (tableIndex < 0) return;

    const nextAll = [...allRows];
    nextAll[tableIndex] = normalized;
    onSetTableRows(child.table, nextAll);
  };

  const addChild = () => {
    if (!childSchema) return;

    const base = createDefaultRecord(child.table, childSchema);
    const seeded = {
      ...base,
      [child.fk]: parentId,
      ...(child.defaults ? child.defaults(parent) : null),
      [child.fk]: parentId,
    } as Record<string, unknown>;

    // Preserve canonical file ordering by placing child records right after their parent or siblings.
    // First, try to find the max __rprOrder among sibling child rows with the same parent.
    const siblingMaxOrder = childRows.reduce((m, r) => {
      const n = Number((r as RecordWithMeta).__rprOrder);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, -1);
    
    // If no siblings have __rprOrder, try to place after the parent
    let orderToUse = siblingMaxOrder;
    if (orderToUse < 0) {
      const parentOrder = Number((parent as RecordWithMeta).__rprOrder);
      orderToUse = Number.isFinite(parentOrder) ? parentOrder : -1;
    }
    
    // If still no valid order, fall back to global max
    if (orderToUse < 0) {
      orderToUse = Object.values(data)
        .flatMap((v) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []))
        .reduce((m, r) => {
          const n = Number((r as RecordWithMeta).__rprOrder);
          return Number.isFinite(n) ? Math.max(m, n) : m;
        }, -1);
    }
    
    (seeded as RecordWithMeta).__rprOrder = orderToUse + 1;

    const nextAll = [...allRows, seeded];
    onSetTableRows(child.table, nextAll);
    setSelectedIndex(childRows.length);
  };

  const deleteSelected = () => {
    if (!selected) return;
    const tableIndex = allRows.findIndex((r) => r === selected);
    if (tableIndex < 0) return;

    const nextAll = allRows.slice(0, tableIndex).concat(allRows.slice(tableIndex + 1));
    onSetTableRows(child.table, nextAll);
    const nextIndex = Math.max(0, Math.min(selectedIndex, childRows.length - 2));
    setSelectedIndex(nextIndex);
  };

  const deleteRow = (row: Record<string, unknown>, rowIndexInChildRows: number) => {
    const tableIndex = allRows.findIndex((r) => r === row);
    if (tableIndex < 0) return;
    const nextAll = allRows.slice(0, tableIndex).concat(allRows.slice(tableIndex + 1));
    onSetTableRows(child.table, nextAll);

    // keep selection stable-ish
    const nextIndex = Math.max(0, Math.min(selectedIndex, childRows.length - 2));
    if (rowIndexInChildRows === selectedIndex) {
      setSelectedIndex(nextIndex);
    } else if (rowIndexInChildRows < selectedIndex) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
  };

  if (!childSchema) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/20 p-3">
        <div className="text-sm font-semibold">{child.label}</div>
        <div className="mt-1 text-sm text-slate-400">Missing schema for table {child.table}.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <button
          type="button"
          onClick={() => setIsCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left hover:text-slate-200 transition-colors"
        >
          <span className="text-slate-400 text-xs font-mono">{isCollapsed ? '[+]' : '[-]'}</span>
          <div>
            <div className="text-sm font-semibold">
              {child.label} <span className="text-xs text-slate-500">({childRows.length})</span>
            </div>
            {!child.hideLinkInfo ? (
              <div className="text-[11px] text-slate-500">
                {child.table} linked by {child.fk} = {parentId}
              </div>
            ) : null}
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {child.table === 'SpellReqDef' && onChangeParent ? (
            <div className="mr-2 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/40 p-1">
              <button
                type="button"
                className={`rounded-full px-2 py-1 text-xs ${
                  String(parent.RequirementsMode ?? 'f').toLowerCase() === 't'
                    ? 'text-slate-300 hover:bg-slate-800/60'
                    : 'bg-emerald-500 text-slate-950'
                }`}
                onClick={() => onChangeParent({ ...parent, RequirementsMode: 'f' })}
                title="All requirements must be met"
              >
                All
              </button>
              <button
                type="button"
                className={`rounded-full px-2 py-1 text-xs ${
                  String(parent.RequirementsMode ?? 'f').toLowerCase() === 't'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
                onClick={() => onChangeParent({ ...parent, RequirementsMode: 't' })}
                title="Any one requirement can be met"
              >
                One Of
              </button>
            </div>
          ) : null}
          {child.table === 'SpellTargetCond' && onChangeParent ? (
            <div className="mr-2 flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                  checked={String(parent.TargetCondIncludeAll ?? 'f').toLowerCase() === 't'}
                  onChange={(e) => onChangeParent({ ...parent, TargetCondIncludeAll: e.target.checked ? 't' : 'f' })}
                />
                <span className="text-xs text-slate-300">All Includes must match</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                  checked={String(parent.TargetCondExcludeAll ?? 'f').toLowerCase() === 't'}
                  onChange={(e) => onChangeParent({ ...parent, TargetCondExcludeAll: e.target.checked ? 't' : 'f' })}
                />
                <span className="text-xs text-slate-300">All Excludes must match</span>
              </label>
            </div>
          ) : null}
          <button
            type="button"
            onClick={addChild}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            {child.addButtonLabel ?? 'Add'}
          </button>
          {!child.perRowDelete ? (
            <button
              type="button"
              onClick={deleteSelected}
              className="rounded-md border border-red-700/60 bg-red-950/30 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950/50"
              disabled={!selected}
            >
              {child.deleteButtonLabel ?? 'Delete'}
            </button>
          ) : null}
        </div>
      </div>

      {isCollapsed ? null : child.inlineEditor ? (
        <div className="space-y-2 p-3">
          {childRows.length === 0 ? (
            <div className="text-sm text-slate-400">No effects yet. Click "Add effect" to create one.</div>
          ) : (
            childRows.map((row, idx) => {
              const updateRow = (next: Record<string, unknown>) => {
                const normalized: Record<string, unknown> = { ...next, [child.fk]: parentId };
                const tableIndex = allRows.findIndex((r) => r === row);
                if (tableIndex < 0) return;
                const nextAll = [...allRows];
                nextAll[tableIndex] = normalized;
                onSetTableRows(child.table, nextAll);
              };
              return (
                <div
                  key={`${idx}-${String(row[child.fk] ?? '')}`}
                  className="group flex items-center gap-3 rounded-md border border-slate-800 bg-slate-950/30 p-2"
                >
                  <div className="flex-1">
                    {child.customEditor === 'perkEffect' ? (
                      <PerkEffectEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'runeEffect' ? (
                      <RuneEffectEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'runeCondition' ? (
                      <RuneConditionEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'statusAction' ? (
                      <StatusActionEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'mutatorAction' ? (
                      <MutatorActionEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'mutatorCondition' ? (
                      <MutatorConditionEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'spellReqDef' ? (
                      <SpellReqDefEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'spellEffect' ? (
                      <SpellEffectEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : child.customEditor === 'spellTargetCond' ? (
                      <SpellTargetCondEditor
                        tableSchema={childSchema}
                        record={row}
                        allData={data}
                        onChange={updateRow}
                      />
                    ) : (
                      <RecordEditor
                        tableName={child.table}
                        tableSchema={childSchema}
                        record={row}
                        onChange={updateRow}
                        tabName={tabName}
                        hiddenFields={[child.fk]}
                        allowIdEdit={allowIdEdit}
                      />
                    )}
                  </div>
                  {child.perRowDelete ? (
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => deleteRow(row, idx)}
                      className="px-2 py-1 text-xs text-red-400 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="grid gap-3 p-3 lg:grid-cols-[280px_1fr]">
          <div className="max-h-[360px] overflow-auto">
            {childRows.length === 0 ? (
              <div className="text-sm text-slate-400">No rows</div>
            ) : (
              <div className="flex flex-col gap-1">
                {childRows.map((row, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <div
                      key={`${idx}-${String(row[child.fk] ?? '')}`}
                      className={
                        isActive
                          ? 'group rounded-md bg-slate-200 px-2 py-2 text-left text-sm font-medium text-slate-900'
                          : 'group rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-900/60'
                      }
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedIndex(idx)}
                          className="flex-1 text-left"
                        >
                          <div className="truncate">{inferLabel(row)}</div>
                          {!child.hideLinkInfo ? (
                            <div className={isActive ? 'text-[10px] text-slate-700' : 'text-[10px] text-slate-500'}>
                              {child.fk}: {String(row[child.fk] ?? '')}
                            </div>
                          ) : null}
                        </button>

                        {child.perRowDelete ? (
                          <button
                            type="button"
                            title="Remove"
                            onClick={() => deleteRow(row, idx)}
                            className={
                              isActive
                                ? 'ml-auto px-2 py-1 text-xs text-red-700 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100'
                                : 'ml-auto px-2 py-1 text-xs text-red-400 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100'
                            }
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            {selected ? (
              child.customEditor === 'perkEffect' ? (
                <PerkEffectEditor
                  tableSchema={childSchema}
                  record={selected}
                  allData={data}
                  onChange={updateSelected}
                />
              ) : (
                <RecordEditor
                  tableName={child.table}
                  tableSchema={childSchema}
                  record={selected}
                  onChange={updateSelected}
                  tabName={tabName}
                  hiddenFields={[child.fk]}
                  allowIdEdit={allowIdEdit}
                />
              )
            ) : (
              <div className="text-sm text-slate-400">Select a row to edit.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
