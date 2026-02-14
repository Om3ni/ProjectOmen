/**
 * Unified condition editor component.
 * Renders SpellTargetCond, RuneCondition, or MutatorCondition rows
 * based on a ConditionConfig that maps generic slots to actual column names.
 */

import { useMemo } from 'react';

import type { SchemaData, TableSchema } from '@/models/schema';
import { str, col } from '@/utils/rprHelpers';
import type { Opt } from '@/constants/conditionConstants';
import type { ConditionConfig, ConditionTypeMeta } from '@/constants/conditionConfigs';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
  config: ConditionConfig;
};

const DEFAULT_META: ConditionTypeMeta = {
  show: { node: false, valueLow: true, valueHigh: false, category: false },
  nodeType: 'none',
  valueOptions: null,
  operatorOptions: [],
  helperText: null,
};

function resolveMeta(
  config: ConditionConfig,
  condId: number | null,
  opId: number | null,
): ConditionTypeMeta {
  if (condId === null || !(condId in config.conditionMeta)) {
    // For unknown condition, show ValueLow with all operators and apply operator-dependent valueHigh
    const base = { ...DEFAULT_META };
    if (opId === 6 || opId === 7) {
      base.show = { ...base.show, valueHigh: true };
    }
    return base;
  }

  const raw = config.conditionMeta[condId];
  // Resolve 'operator-dependent' for valueHigh
  const valueHigh = raw.show.valueHigh === 'operator-dependent'
    ? (opId === 6 || opId === 7)
    : raw.show.valueHigh;

  return {
    ...raw,
    show: { ...raw.show, valueHigh },
  };
}

export default function ConditionEditor({ tableSchema, record, allData, onChange, config }: Props) {
  const { fields } = config;
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  // ── Inclusion dropdown ─────────────────────────────────────
  const inclusionCol = col(tableSchema, fields.inclusion);
  const inclusionEnum = inclusionCol?.enum ?? { '0': 'Include', '1': 'Exclude' };
  const inclusionOptions = Object.entries(inclusionEnum);

  // ── Condition type dropdown ────────────────────────────────
  const condOptions: Array<[string, string]> = useMemo(() => {
    if (config.useSchemaEnum) {
      const condCol = col(tableSchema, fields.condition);
      const condEnum = condCol?.enum ?? {};
      return Object.entries(condEnum).sort(([a], [b]) => Number(a) - Number(b));
    }
    if (config.conditionOptions) {
      return config.conditionOptions.map((o) => [o.value, o.label] as [string, string]);
    }
    return [];
  }, [tableSchema, config, fields.condition]);

  // ── Parse current values ───────────────────────────────────
  const rawCond = record[fields.condition];
  const condId = rawCond === '' || rawCond === null || rawCond === undefined ? null : Number(rawCond);
  const rawOp = record[fields.operator];
  const opId = rawOp === '' || rawOp === null || rawOp === undefined ? null : Number(rawOp);
  const meta = resolveMeta(config, Number.isFinite(condId) ? condId : null, Number.isFinite(opId) ? opId : null);

  // ── Node target lookups ────────────────────────────────────
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
    const arr = Array.isArray((allData as Record<string, unknown>).StatusDef)
      ? ((allData as Record<string, unknown>).StatusDef as Array<Record<string, unknown>>)
      : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const getNodeOptions = (): Opt[] => {
    switch (meta.nodeType) {
      case 'perk': return perks;
      case 'skill': return skills;
      case 'status': return statuses;
      default: return [];
    }
  };

  const nodeOpts = getNodeOptions();
  const valueDropdownOpts = meta.valueOptions ?? [];

  const nodePlaceholder =
    meta.nodeType === 'perk' ? 'Select perk…'
    : meta.nodeType === 'skill' ? 'Select skill…'
    : meta.nodeType === 'status' ? 'Select status…'
    : 'Select…';

  // ── Category placeholder ───────────────────────────────────
  // Derive from the condition label in the dropdown
  const categoryPlaceholder = useMemo(() => {
    if (condId === null) return 'Category';
    const entry = condOptions.find(([k]) => Number(k) === condId);
    if (!entry) return 'Category';
    const label = entry[1].toLowerCase();
    if (label.includes('buff')) return 'Buff category';
    if (label.includes('perk')) return 'Perk category';
    return 'Category';
  }, [condId, condOptions]);

  // ── On condition type change ───────────────────────────────
  const onConditionChange = (newVal: string) => {
    const nCond = Number(newVal) || 0;
    const next: Record<string, unknown> = { ...record, [fields.condition]: nCond };
    next[fields.node] = 0;
    next[fields.valueLow] = 0;
    next[fields.valueHigh] = 0;
    next[fields.category] = '';
    onChange(next);
  };

  const baseInput =
    'rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Inclusion (Include/Exclude) */}
      <select
        className={`${baseInput} w-28`}
        value={str(record[fields.inclusion])}
        onChange={(e) => set(fields.inclusion, Number(e.target.value) || 0)}
      >
        {inclusionOptions.map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Optional "If" label */}
      {config.showIfLabel && (
        <span className="text-sm text-slate-400">If</span>
      )}

      {/* Condition type */}
      <select
        className={`${baseInput} w-44`}
        value={str(record[fields.condition])}
        onChange={(e) => onConditionChange(e.target.value)}
      >
        {condOptions.map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        className={`${baseInput} w-24`}
        value={str(record[fields.operator])}
        onChange={(e) => set(fields.operator, Number(e.target.value) || 0)}
      >
        {meta.operatorOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Node target (perk/skill/status dropdown or numeric input) */}
      {meta.show.node && (
        nodeOpts.length > 0 ? (
          <select
            className={`${baseInput} min-w-40`}
            value={str(record[fields.node])}
            onChange={(e) => set(fields.node, Number(e.target.value) || 0)}
          >
            <option value="">{nodePlaceholder}</option>
            {nodeOpts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            className={`${baseInput} w-24`}
            value={str(record[fields.node])}
            onChange={(e) => set(fields.node, Number(e.target.value) || 0)}
          />
        )
      )}

      {/* Category text field */}
      {meta.show.category && (
        <>
          <span className="text-sm text-slate-400">Category:</span>
          <input
            type="text"
            className={`${baseInput} min-w-32`}
            value={str(record[fields.category])}
            onChange={(e) => set(fields.category, e.target.value)}
            placeholder={categoryPlaceholder}
          />
        </>
      )}

      {/* Value (low) — dropdown for enum conditions or numeric input */}
      {meta.show.valueLow && (
        valueDropdownOpts.length > 0 ? (
          <select
            className={`${baseInput} w-36`}
            value={str(record[fields.valueLow])}
            onChange={(e) => set(fields.valueLow, Number(e.target.value) || 0)}
          >
            {valueDropdownOpts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <>
            <span className="text-sm text-slate-400">{meta.show.valueHigh ? 'Min:' : 'Value:'}</span>
            <input
              type="number"
              step="0.1"
              className={`${baseInput} w-20`}
              value={str(record[fields.valueLow])}
              onChange={(e) => set(fields.valueLow, Number(e.target.value) || 0)}
            />
          </>
        )
      )}

      {/* Helper text for bool conditions */}
      {!meta.show.valueLow && meta.helperText && (
        <span className="text-sm font-medium text-slate-100">{meta.helperText}</span>
      )}

      {/* Value (high) — shown for Between/Outside operators */}
      {meta.show.valueHigh && (
        <>
          <span className="text-sm text-slate-400">Max:</span>
          <input
            type="number"
            step="0.1"
            className={`${baseInput} w-20`}
            value={str(record[fields.valueHigh])}
            onChange={(e) => set(fields.valueHigh, Number(e.target.value) || 0)}
          />
        </>
      )}
    </div>
  );
}
