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
 * Returns field visibility based on the selected Function.
 *
 * Function enum (from schema / actual RPR format):
 * 0: Modify Skill - TargetID (skill), Value (amount)
 * 1: Modify Stat  - TargetID (stat), Value (amount)
 * 2: Grant Perk   - TargetID (perk)
 * 3: Grant Ability- TargetID (ability/spell)
 * 4: Grant Status - TargetID (status)
 */
function getFieldMeta(fn: number | null) {
  const show = { TargetID: true, Value: false };
  const targetType: 'skill' | 'stat' | 'perk' | 'ability' | 'status' = 'stat';

  if (fn === null) return { show, targetType };

  switch (fn) {
    case 0: // Modify Skill
      return {
        show: { TargetID: true, Value: true },
        targetType: 'skill' as const,
      };

    case 1: // Modify Stat
      return {
        show: { TargetID: true, Value: true },
        targetType: 'stat' as const,
      };

    case 2: // Grant Perk
      return {
        show: { TargetID: true, Value: false },
        targetType: 'perk' as const,
      };

    case 3: // Grant Ability
      return {
        show: { TargetID: true, Value: false },
        targetType: 'ability' as const,
      };

    case 4: // Grant Status
      return {
        show: { TargetID: true, Value: false },
        targetType: 'status' as const,
      };

    default:
      return { show, targetType };
  }
}

export default function StatusActionEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const fnCol = col(tableSchema, 'Function');
  const fnEnum = fnCol?.enum ?? {};
  const fnOptions = Object.entries(fnEnum);

  const rawFn = record.Function;
  const fn = rawFn === '' || rawFn === null || rawFn === undefined ? null : Number(rawFn);
  const meta = getFieldMeta(Number.isFinite(fn) ? fn : null);

  // Build lookup option lists
  const skills = useMemo(() => {
    const arr = Array.isArray(allData.SkillDef) ? (allData.SkillDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r['Node ID'] ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const stats = useMemo(() => {
    const arr = Array.isArray(allData.Stat) ? (allData.Stat as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const perks = useMemo(() => {
    const arr = Array.isArray(allData.PerkDef) ? (allData.PerkDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const abilities = useMemo(() => {
    const arr = Array.isArray(allData.SpellDef) ? (allData.SpellDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const statuses = useMemo(() => {
    const arr = Array.isArray(allData.StatusDef) ? (allData.StatusDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: String(r.Name ?? '(unnamed)') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const getTargetOptions = (): Opt[] => {
    switch (meta.targetType) {
      case 'skill':
        return skills;
      case 'stat':
        return stats;
      case 'perk':
        return perks;
      case 'ability':
        return abilities;
      case 'status':
        return statuses;
      default:
        return [];
    }
  };

  const targetOpts = getTargetOptions();

  const onFunctionChange = (newVal: string) => {
    const isBlank = newVal === '';
    const nFn = isBlank ? null : Number(newVal);
    const next: Record<string, unknown> = { ...record, Function: isBlank ? '' : nFn };

    // Auto-seed first valid option when switching functions
    if (Number.isFinite(nFn)) {
      const pick = (opts: Opt[]) => (opts.length > 0 ? opts[0].value : '');
      switch (nFn) {
        case 0: // Modify Skill
          next.TargetID = Number(pick(skills)) || 0;
          next.Value = Number(next.Value ?? 0);
          break;
        case 1: // Modify Stat
          next.TargetID = Number(pick(stats)) || 0;
          next.Value = Number(next.Value ?? 0);
          break;
        case 2: // Grant Perk
          next.TargetID = Number(pick(perks)) || 0;
          break;
        case 3: // Grant Ability
          next.TargetID = Number(pick(abilities)) || 0;
          break;
        case 4: // Grant Status
          next.TargetID = Number(pick(statuses)) || 0;
          break;
        default:
          break;
      }
    } else {
      next.TargetID = 0;
      next.Value = 0;
    }
    onChange(next);
  };

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Function dropdown */}
      <select
        className={`${baseInput} w-36`}
        value={str(record.Function)}
        onChange={(e) => onFunctionChange(e.target.value)}
      >
        <option value="">—</option>
        {fnOptions.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      {/* TargetID - dropdown based on function type */}
      {meta.show.TargetID && (
        targetOpts.length > 0 ? (
          <select
            className={`${baseInput} min-w-40`}
            value={str(record.TargetID)}
            onChange={(e) => set('TargetID', Number(e.target.value) || 0)}
          >
            <option value="">—</option>
            {targetOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            className={`${baseInput} w-24`}
            value={str(record.TargetID)}
            onChange={(e) => set('TargetID', Number(e.target.value) || 0)}
          />
        )
      )}

      {/* Value - with inline "by" label for modifiers */}
      {meta.show.Value && (
        <>
          <span className="text-sm text-slate-400">by</span>
          <input
            type="number"
            className={`${baseInput} w-20`}
            value={str(record.Value)}
            onChange={(e) => set('Value', Number(e.target.value) || 0)}
          />
        </>
      )}
    </div>
  );
}
