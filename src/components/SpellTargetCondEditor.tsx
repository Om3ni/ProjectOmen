import { useMemo } from 'react';

import type { SchemaColumn, SchemaData, TableSchema } from '@/models/schema';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

type Opt = { value: string; label: string };

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function col(schema: TableSchema, name: string): SchemaColumn | undefined {
  return schema.columns.find((c) => c.name === name);
}

/**
 * SpellTargetCond types (from schema):
 * 0: Perk - uses Param (perk ID)
 * 1: Buff Category - uses Text field
 * 2: Skill Allocation - uses Param (skill), ValueMin
 * 3: Level - uses ValueMin
 * 4: Climate - uses ValueMin with dropdown
 * 5: Shelter - uses ValueMin with dropdown
 * 6: Time of Day - uses ValueMin with dropdown
 * 7: Equipped Main Hand - uses ValueMin with dropdown
 * 8: Equipped Off Hand - uses ValueMin with dropdown
 * 9: Armor Class - uses ValueMin with dropdown
 * 10: Character Height - uses ValueMin
 * 11: Character Build - uses ValueMin
 * 12: Bust Size - uses ValueMin/ValueMax
 * 13: Dong Size - uses ValueMin/ValueMax
 * 14: Flying - bool (helper: True)
 * 15: Riding - bool (helper: True)
 * 16: Swimming - bool (helper: True)
 * 17: Gender - bool (helper: Female)
 * 18: High Heels - bool (helper: True)
 * 19: Corruption - uses ValueMin
 * 20: Status - uses Param (status ID)
 * 21: Perk Category - uses Text field
 */

// Operator labels
const ALL_OPERATORS: Opt[] = [
  { value: '0', label: '==' },
  { value: '1', label: '!=' },
  { value: '2', label: '>' },
  { value: '3', label: '>=' },
  { value: '4', label: '<' },
  { value: '5', label: '<=' },
  { value: '6', label: 'Between' },
  { value: '7', label: 'Outside' },
];

const EQUALITY_OPERATORS: Opt[] = [
  { value: '0', label: '==' },
  { value: '1', label: '!=' },
];

// Hardcoded value options
const CLIMATE_OPTIONS: Opt[] = [
  { value: '0', label: 'Hot' },
  { value: '1', label: 'Cold' },
];

const SHELTER_OPTIONS: Opt[] = [
  { value: '0', label: 'No Shelter' },
  { value: '1', label: 'Some Shelter' },
  { value: '2', label: 'Has Shelter' },
];

const TIME_OF_DAY_OPTIONS: Opt[] = [
  { value: '0', label: 'Dawn' },
  { value: '1', label: 'Day' },
  { value: '2', label: 'Dusk' },
  { value: '3', label: 'Night' },
];

const MAIN_HAND_OPTIONS: Opt[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Axe 1H' },
  { value: '2', label: 'Axe 2H' },
  { value: '3', label: 'Bow' },
  { value: '4', label: 'Crossbow' },
  { value: '5', label: 'Daggers' },
  { value: '6', label: 'Mace 1H' },
  { value: '7', label: 'Mace 2H' },
  { value: '8', label: 'Spear 1H' },
  { value: '9', label: 'Spear 2H' },
  { value: '10', label: 'Sword 1H' },
  { value: '11', label: 'Sword 2H' },
  { value: '12', label: 'Other' },
  { value: '13', label: 'Focus 2H' },
];

const OFF_HAND_OPTIONS: Opt[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Shield' },
  { value: '2', label: 'Thrown' },
  { value: '3', label: 'Torch' },
  { value: '4', label: 'Other' },
];

const ARMOR_CLASS_OPTIONS: Opt[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Light' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Heavy' },
];

/**
 * Returns field visibility based on the selected Function.
 */
function getFieldMeta(fn: number | null, operator: number | null) {
  const show = { Param: false, ValueMin: true, ValueMax: false, Text: false };
  const valueOptions: Opt[] | null = null;
  const nodeType: 'perk' | 'skill' | 'status' | 'none' = 'none';
  const helperText: string | null = null;
  const operatorOptions: Opt[] = ALL_OPERATORS;

  // MaxValue shown for Between (6) and Outside (7) operators
  if (operator === 6 || operator === 7) {
    show.ValueMax = true;
  }

  if (fn === null) return { show, valueOptions, nodeType, helperText, operatorOptions };

  switch (fn) {
    case 0: // Perk - uses Param, equality only
      return {
        show: { Param: true, ValueMin: false, ValueMax: false, Text: false },
        valueOptions: null,
        nodeType: 'perk' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 1: // Buff Category - uses Text, equality only
    case 21: // Perk Category - uses Text, equality only
      return {
        show: { Param: false, ValueMin: false, ValueMax: false, Text: true },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 2: // Skill Allocation - uses Param (skill), ValueMin, all operators
      return {
        show: { Param: true, ValueMin: true, ValueMax: operator === 6 || operator === 7, Text: false },
        valueOptions: null,
        nodeType: 'skill' as const,
        helperText: null,
        operatorOptions: ALL_OPERATORS,
      };

    case 3: // Level - numeric, all operators
    case 19: // Corruption - numeric, all operators
    case 10: // Character Height - numeric, all operators
    case 11: // Character Build - numeric, all operators
    case 12: // Bust Size - numeric, all operators
    case 13: // Dong Size - numeric, all operators
      return {
        show: { Param: false, ValueMin: true, ValueMax: operator === 6 || operator === 7, Text: false },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: ALL_OPERATORS,
      };

    case 4: // Climate - enum, equality only
      return {
        show: { Param: false, ValueMin: true, ValueMax: false, Text: false },
        valueOptions: CLIMATE_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 5: // Shelter - enum, equality only
      return {
        show: { Param: false, ValueMin: true, ValueMax: false, Text: false },
        valueOptions: SHELTER_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 6: // Time of Day - enum, equality only
      return {
        show: { Param: false, ValueMin: true, ValueMax: false, Text: false },
        valueOptions: TIME_OF_DAY_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 7: // Equipped Main Hand - enum, equality only
      return {
        show: { Param: false, ValueMin: true, ValueMax: false, Text: false },
        valueOptions: MAIN_HAND_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 8: // Equipped Off Hand - enum, equality only
      return {
        show: { Param: false, ValueMin: true, ValueMax: false, Text: false },
        valueOptions: OFF_HAND_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 9: // Armor Class - enum, equality only
      return {
        show: { Param: false, ValueMin: true, ValueMax: false, Text: false },
        valueOptions: ARMOR_CLASS_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 14: // Flying - bool, equality only
    case 15: // Riding - bool, equality only
    case 16: // Swimming - bool, equality only
    case 18: // High Heels - bool, equality only
      return {
        show: { Param: false, ValueMin: false, ValueMax: false, Text: false },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: 'True',
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 17: // Gender - bool, equality only
      return {
        show: { Param: false, ValueMin: false, ValueMax: false, Text: false },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: 'Female',
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 20: // Status - uses Param (status ID), equality only
      return {
        show: { Param: true, ValueMin: false, ValueMax: false, Text: false },
        valueOptions: null,
        nodeType: 'status' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    default:
      return { show, valueOptions, nodeType, helperText, operatorOptions };
  }
}

export default function SpellTargetCondEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  // Mode = Include/Exclude
  const modeCol = col(tableSchema, 'Mode');
  const modeEnum = modeCol?.enum ?? { '0': 'Include', '1': 'Exclude' };
  const modeOptions = Object.entries(modeEnum);

  // Function = condition type
  const fnCol = col(tableSchema, 'Function');
  const fnEnum = fnCol?.enum ?? {};
  const fnOptions = Object.entries(fnEnum).sort(([a], [b]) => Number(a) - Number(b));

  const rawFn = record.Function;
  const fn = rawFn === '' || rawFn === null || rawFn === undefined ? null : Number(rawFn);
  const rawOp = record.Operator;
  const op = rawOp === '' || rawOp === null || rawOp === undefined ? null : Number(rawOp);
  const meta = getFieldMeta(Number.isFinite(fn) ? fn : null, Number.isFinite(op) ? op : null);

  const categoryPlaceholder = fn === 1 ? 'Buff category' : fn === 21 ? 'Perk category' : 'Category';
  const nodePlaceholder =
    meta.nodeType === 'perk'
      ? 'Select perk…'
      : meta.nodeType === 'skill'
        ? 'Select skill…'
        : meta.nodeType === 'status'
          ? 'Select status…'
          : 'Select…';

  // Build lookup option lists
  const perks = useMemo(() => {
    const arr = Array.isArray(allData.PerkDef) ? (allData.PerkDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const skills = useMemo(() => {
    const arr = Array.isArray(allData.SkillDef) ? (allData.SkillDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r['Node ID'] ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const statuses = useMemo(() => {
    const arr = Array.isArray(allData.StatusDef) ? (allData.StatusDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const getNodeOptions = (): Opt[] => {
    switch (meta.nodeType) {
      case 'perk':
        return perks;
      case 'skill':
        return skills;
      case 'status':
        return statuses;
      default:
        return [];
    }
  };

  const nodeOpts = getNodeOptions();
  const valueDropdownOpts = meta.valueOptions ?? [];

  const onFunctionChange = (newVal: string) => {
    const nFn = Number(newVal) || 0;
    const next: Record<string, unknown> = { ...record, Function: nFn };
    next.Param = 0;
    next.ValueMin = 0;
    next.ValueMax = 0;
    next.Text = '';
    onChange(next);
  };

  const baseInput =
    'rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mode (Include/Exclude) */}
      <select
        className={`${baseInput} w-24`}
        value={str(record.Mode)}
        onChange={(e) => set('Mode', Number(e.target.value) || 0)}
      >
        {modeOptions.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      {/* "If" label */}
      <span className="text-sm text-slate-400">If</span>

      {/* Function (condition type) */}
      <select
        className={`${baseInput} w-44`}
        value={str(record.Function)}
        onChange={(e) => onFunctionChange(e.target.value)}
      >
        {fnOptions.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        className={`${baseInput} w-24`}
        value={str(record.Operator)}
        onChange={(e) => set('Operator', Number(e.target.value) || 0)}
      >
        {meta.operatorOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Param - shown for perk/skill/status conditions */}
      {meta.show.Param && (
        nodeOpts.length > 0 ? (
          <select
            className={`${baseInput} min-w-40`}
            value={str(record.Param)}
            onChange={(e) => set('Param', Number(e.target.value) || 0)}
          >
            <option value="">{nodePlaceholder}</option>
            {nodeOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            className={`${baseInput} w-24`}
            value={str(record.Param)}
            onChange={(e) => set('Param', Number(e.target.value) || 0)}
          />
        )
      )}

      {/* Text - for Perk Category / Buff Category conditions */}
      {meta.show.Text && (
        <>
          <span className="text-sm text-slate-400">Category:</span>
          <input
            type="text"
            className={`${baseInput} min-w-32`}
            value={str(record.Text)}
            onChange={(e) => set('Text', e.target.value)}
            placeholder={categoryPlaceholder}
          />
        </>
      )}

      {/* ValueMin - dropdown for enum conditions or numeric input */}
      {meta.show.ValueMin && (
        valueDropdownOpts.length > 0 ? (
          <select
            className={`${baseInput} w-36`}
            value={str(record.ValueMin)}
            onChange={(e) => set('ValueMin', Number(e.target.value) || 0)}
          >
            {valueDropdownOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <>
            <span className="text-sm text-slate-400">{meta.show.ValueMax ? 'Min:' : 'Value:'}</span>
            <input
              type="number"
              step="0.1"
              className={`${baseInput} w-20`}
              value={str(record.ValueMin)}
              onChange={(e) => set('ValueMin', Number(e.target.value) || 0)}
            />
          </>
        )
      )}

      {/* Static helper text for bool conditions */}
      {!meta.show.ValueMin && meta.helperText && (
        <span className="text-sm font-medium text-slate-100">{meta.helperText}</span>
      )}

      {/* ValueMax - shown for Between/Outside operators */}
      {meta.show.ValueMax && (
        <>
          <span className="text-sm text-slate-400">Max:</span>
          <input
            type="number"
            step="0.1"
            className={`${baseInput} w-20`}
            value={str(record.ValueMax)}
            onChange={(e) => set('ValueMax', Number(e.target.value) || 0)}
          />
        </>
      )}
    </div>
  );
}
