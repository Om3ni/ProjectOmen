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
 * MutatorCondition types (0-indexed per game UI screenshot):
 * 0: Perk - uses NodeAffected (perk ID)
 * 1: Perk Category - uses Category text field
 * 2: Buff Category - uses Category text field
 * 3: Skill Allocation - uses NodeAffected (skill), Value
 * 4: Level - uses Value
 * 5: Climate - uses Value with dropdown
 * 6: Shelter - uses Value with dropdown
 * 7: Corruption - uses Value
 * 8: Time of Day - uses Value with dropdown
 * 9: Armor Class - uses Value with dropdown
 * 10: Equipped Main Hand - uses Value with dropdown
 * 11: Equipped Off Hand - uses Value with dropdown
 * 12: High Heels - bool (helper: True)
 * 13: Gender - bool (helper: Female)
 * 14: Character Height - uses Value
 * 15: Character Build - uses Value
 * 16: Bust Size - uses Value
 * 17: Dong Size - uses Value
 * 18: Flying - bool (helper: True)
 * 19: Riding - bool (helper: True)
 * 20: Swimming - bool (helper: True)
 * 21: Status - uses NodeAffected (status ID)
 */

// Condition labels (0-indexed for MutatorCondition)
const CONDITION_OPTIONS: Opt[] = [
  { value: '0', label: 'Perk' },
  { value: '1', label: 'Buff Category' },
  { value: '2', label: 'Skill Allocation' },
  { value: '3', label: 'Level' },
  { value: '4', label: 'Climate' },
  { value: '5', label: 'Shelter' },
  { value: '6', label: 'Time of Day' },
  { value: '7', label: 'Equipped Main Hand' },
  { value: '8', label: 'Equipped Off Hand' },
  { value: '9', label: 'Armor Class' },
  { value: '10', label: 'Character Height' },
  { value: '11', label: 'Character Build' },
  { value: '12', label: 'Bust Size' },
  { value: '13', label: 'Dong Size' },
  { value: '14', label: 'Flying' },
  { value: '15', label: 'Riding' },
  { value: '16', label: 'Swimming' },
  { value: '17', label: 'Gender' },
  { value: '18', label: 'High Heels' },
  { value: '19', label: 'Corruption' },
  { value: '20', label: 'Status' },
  { value: '21', label: 'Perk Category' },
];

// Operator labels (0-indexed)
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
 * Returns field visibility based on the selected Condition.
 */
function getFieldMeta(cond: number | null, operator: number | null) {
  const show = { NodeAffected: false, Value: true, MaxValue: false, Category: false };
  const valueOptions: Opt[] | null = null;
  const nodeType: 'perk' | 'skill' | 'status' | 'none' = 'none';
  const helperText: string | null = null;
  const operatorOptions: Opt[] = ALL_OPERATORS;

  // MaxValue shown for Between (6) and Outside (7) operators
  if (operator === 6 || operator === 7) {
    show.MaxValue = true;
  }

  if (cond === null) return { show, valueOptions, nodeType, helperText, operatorOptions };

  switch (cond) {
    case 0: // Perk - uses NodeAffected, equality only
      return {
        show: { NodeAffected: true, Value: false, MaxValue: false, Category: false },
        valueOptions: null,
        nodeType: 'perk' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 1: // Buff Category - uses Category text, equality only
    case 21: // Perk Category - uses Category text, equality only
      return {
        show: { NodeAffected: false, Value: false, MaxValue: false, Category: true },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 2: // Skill Allocation - uses NodeAffected (skill), Value, all operators
      return {
        show: { NodeAffected: true, Value: true, MaxValue: operator === 6 || operator === 7, Category: false },
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
        show: { NodeAffected: false, Value: true, MaxValue: operator === 6 || operator === 7, Category: false },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: ALL_OPERATORS,
      };

    case 4: // Climate - enum, equality only
      return {
        show: { NodeAffected: false, Value: true, MaxValue: false, Category: false },
        valueOptions: CLIMATE_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 5: // Shelter - enum, equality only
      return {
        show: { NodeAffected: false, Value: true, MaxValue: false, Category: false },
        valueOptions: SHELTER_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 6: // Time of Day - enum, equality only
      return {
        show: { NodeAffected: false, Value: true, MaxValue: false, Category: false },
        valueOptions: TIME_OF_DAY_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 7: // Equipped Main Hand - enum, equality only
      return {
        show: { NodeAffected: false, Value: true, MaxValue: false, Category: false },
        valueOptions: MAIN_HAND_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 8: // Equipped Off Hand - enum, equality only
      return {
        show: { NodeAffected: false, Value: true, MaxValue: false, Category: false },
        valueOptions: OFF_HAND_OPTIONS,
        nodeType: 'none' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 9: // Armor Class - enum, equality only
      return {
        show: { NodeAffected: false, Value: true, MaxValue: false, Category: false },
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
        show: { NodeAffected: false, Value: false, MaxValue: false, Category: false },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: 'True',
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 17: // Gender - bool, equality only
      return {
        show: { NodeAffected: false, Value: false, MaxValue: false, Category: false },
        valueOptions: null,
        nodeType: 'none' as const,
        helperText: 'Female',
        operatorOptions: EQUALITY_OPERATORS,
      };

    case 20: // Status - uses NodeAffected (status ID), equality only
      return {
        show: { NodeAffected: true, Value: false, MaxValue: false, Category: false },
        valueOptions: null,
        nodeType: 'status' as const,
        helperText: null,
        operatorOptions: EQUALITY_OPERATORS,
      };

    default:
      return { show, valueOptions, nodeType, helperText, operatorOptions };
  }
}

export default function MutatorConditionEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const inclusionCol = col(tableSchema, 'Inclusion');
  const inclusionEnum = inclusionCol?.enum ?? { '0': 'Include', '1': 'Exclude' };
  const inclusionOptions = Object.entries(inclusionEnum);

  const rawCond = record.Condition;
  const cond = rawCond === '' || rawCond === null || rawCond === undefined ? null : Number(rawCond);
  const rawOp = record.Operator;
  const op = rawOp === '' || rawOp === null || rawOp === undefined ? null : Number(rawOp);
  const meta = getFieldMeta(Number.isFinite(cond) ? cond : null, Number.isFinite(op) ? op : null);

  const categoryPlaceholder = cond === 1 ? 'Buff category' : cond === 21 ? 'Perk category' : 'Category';
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

  const onConditionChange = (newVal: string) => {
    const nCond = Number(newVal) || 0;
    const next: Record<string, unknown> = { ...record, Condition: nCond };
    next.NodeAffected = 0;
    next.Value = 0;
    next.MaxValue = 0;
    next.Category = '';
    onChange(next);
  };

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Inclusion (Include/Exclude) */}
      <select
        className={`${baseInput} w-28`}
        value={str(record.Inclusion)}
        onChange={(e) => set('Inclusion', Number(e.target.value) || 0)}
      >
        {inclusionOptions.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      {/* "If" label */}
      <span className="text-sm text-slate-400">If</span>

      {/* Condition type */}
      <select
        className={`${baseInput} w-44`}
        value={str(record.Condition)}
        onChange={(e) => onConditionChange(e.target.value)}
      >
        {CONDITION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Operator - comes BEFORE NodeAffected */}
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

      {/* NodeAffected - shown for perk/skill/status conditions */}
      {meta.show.NodeAffected && (
        nodeOpts.length > 0 ? (
          <select
            className={`${baseInput} min-w-40`}
            value={str(record.NodeAffected)}
            onChange={(e) => set('NodeAffected', Number(e.target.value) || 0)}
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
            value={str(record.NodeAffected)}
            onChange={(e) => set('NodeAffected', Number(e.target.value) || 0)}
          />
        )
      )}

      {/* Category - for Perk Category / Buff Category conditions */}
      {meta.show.Category && (
        <>
          <span className="text-sm text-slate-400">Category:</span>
          <input
            type="text"
            className={`${baseInput} min-w-32`}
            value={str(record.Category)}
            onChange={(e) => set('Category', e.target.value)}
            placeholder={categoryPlaceholder}
          />
        </>
      )}

      {/* Value - dropdown for enum conditions or numeric input */}
      {meta.show.Value && (
        valueDropdownOpts.length > 0 ? (
          <select
            className={`${baseInput} w-36`}
            value={str(record.Value)}
            onChange={(e) => set('Value', Number(e.target.value) || 0)}
          >
            {valueDropdownOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <>
            <span className="text-sm text-slate-400">Value:</span>
            <input
              type="number"
              step="0.1"
              className={`${baseInput} w-20`}
              value={str(record.Value)}
              onChange={(e) => set('Value', Number(e.target.value) || 0)}
            />
          </>
        )
      )}

      {/* Static helper text for bool conditions */}
      {!meta.show.Value && meta.helperText && (
        <span className="text-sm font-medium text-slate-100">{meta.helperText}</span>
      )}

      {/* MaxValue - shown for Between/Outside operators */}
      {meta.show.MaxValue && (
        <input
          type="number"
          step="0.1"
          className={`${baseInput} w-20`}
          value={str(record.MaxValue)}
          onChange={(e) => set('MaxValue', Number(e.target.value) || 0)}
        />
      )}
    </div>
  );
}
