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
 * Returns field visibility and labels based on the selected Effect.
 * 
 * Effect enum:
 * 0: Dice Modifier - TargetID (skill/attr), Value (amount)
 * 1: Grant Perk - TargetID (perk)
 * 3: Stat Modifier - TargetID (stat), Value (amount)
 * 4: Grant Ability - TargetID (ability)
 * 5: Grant Status - TargetID (status)
 * 6: Unlock Status - TargetID (status)
 */
function getFieldMeta(effect: number | null) {
  const show = { TargetID: true, Value: false };
  const labels = { TargetID: 'Target', Value: 'by' };
  const targetType: 'skillAttr' | 'perk' | 'stat' | 'ability' | 'status' = 'skillAttr';

  if (effect === null) return { show, labels, targetType };

  switch (effect) {
    case 0: // Dice Modifier
      return {
        show: { TargetID: true, Value: true },
        labels: { TargetID: 'Skill/Attribute', Value: 'Modifier' },
        targetType: 'skillAttr' as const,
      };

    case 1: // Grant Perk
      return {
        show: { TargetID: true, Value: false },
        labels: { TargetID: 'Perk', Value: 'by' },
        targetType: 'perk' as const,
      };

    case 3: // Stat Modifier
      return {
        show: { TargetID: true, Value: true },
        labels: { TargetID: 'Stat', Value: 'Modifier' },
        targetType: 'stat' as const,
      };

    case 4: // Grant Ability
      return {
        show: { TargetID: true, Value: false },
        labels: { TargetID: 'Ability', Value: 'by' },
        targetType: 'ability' as const,
      };

    case 5: // Grant Status
    case 6: // Unlock Status
      return {
        show: { TargetID: true, Value: false },
        labels: { TargetID: 'Status', Value: 'by' },
        targetType: 'status' as const,
      };

    default:
      return { show, labels, targetType };
  }
}

export default function RuneEffectEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const effectCol = col(tableSchema, 'Effect');
  const effectEnum = effectCol?.enum ?? {};
  const effectOptions = Object.entries(effectEnum);

  const rawEffect = record.Effect;
  const effect = rawEffect === '' || rawEffect === null || rawEffect === undefined ? null : Number(rawEffect);
  const meta = getFieldMeta(Number.isFinite(effect) ? effect : null);

  // Build lookup option lists
  const skillsAndAttrs = useMemo(() => {
    const arr = Array.isArray(allData.SkillDef) ? (allData.SkillDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r['Node ID'] ?? ''), label: `${r['Node ID']} – ${r.Name ?? '(unnamed)'}` }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [allData]);

  const perks = useMemo(() => {
    const arr = Array.isArray(allData.PerkDef) ? (allData.PerkDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: `${r.ID} – ${r.Name ?? '(unnamed)'}` }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [allData]);

  const stats = useMemo(() => {
    const arr = Array.isArray(allData.Stat) ? (allData.Stat as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: `${r.ID} – ${r.Name ?? '(unnamed)'}` }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [allData]);

  const abilities = useMemo(() => {
    const arr = Array.isArray(allData.SpellDef) ? (allData.SpellDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: `${r.ID} – ${r.Name ?? '(unnamed)'}` }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [allData]);

  const statuses = useMemo(() => {
    const arr = Array.isArray(allData.StatusDef) ? (allData.StatusDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: String(r.ID ?? ''), label: `${r.ID} – ${r.Name ?? '(unnamed)'}` }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [allData]);

  const getTargetOptions = (): Opt[] => {
    switch (meta.targetType) {
      case 'skillAttr':
        return skillsAndAttrs;
      case 'perk':
        return perks;
      case 'stat':
        return stats;
      case 'ability':
        return abilities;
      case 'status':
        return statuses;
      default:
        return [];
    }
  };

  const targetOpts = getTargetOptions();

  const onEffectChange = (newVal: string) => {
    const isBlank = newVal === '';
    const nEffect = isBlank ? null : Number(newVal);
    const next: Record<string, unknown> = { ...record, Effect: isBlank ? '' : nEffect };

    // Auto-seed first valid option when switching effects
    if (Number.isFinite(nEffect)) {
      const pick = (opts: Opt[]) => (opts.length > 0 ? opts[0].value : '');
      switch (nEffect) {
        case 0: // Dice Modifier
          next.TargetID = Number(pick(skillsAndAttrs)) || 0;
          next.Value = Number(next.Value ?? 0);
          break;
        case 1: // Grant Perk
          next.TargetID = Number(pick(perks)) || 0;
          break;
        case 3: // Stat Modifier
          next.TargetID = Number(pick(stats)) || 0;
          next.Value = Number(next.Value ?? 0);
          break;
        case 4: // Grant Ability
          next.TargetID = Number(pick(abilities)) || 0;
          break;
        case 5: // Grant Status
        case 6: // Unlock Status
          next.TargetID = Number(pick(statuses)) || 0;
          break;
        default:
          break;
      }
    } else {
      // Clear all context fields
      next.TargetID = 0;
      next.Value = 0;
    }
    onChange(next);
  };

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';

  const labelCls = 'text-xs font-semibold text-slate-200';

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Effect dropdown */}
      <div className="flex flex-col gap-1">
        <div className={labelCls}>Effect</div>
        <select
          className={`${baseInput} w-48`}
          value={str(record.Effect)}
          onChange={(e) => onEffectChange(e.target.value)}
        >
            <option value="">Select effect…</option>
          {effectOptions.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* TargetID - dropdown based on effect type */}
      {meta.show.TargetID && (
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <div className={labelCls}>{meta.labels.TargetID}</div>
          {targetOpts.length > 0 ? (
            <select
              className={`${baseInput} w-full`}
              value={str(record.TargetID)}
              onChange={(e) => set('TargetID', Number(e.target.value) || 0)}
            >
              <option value="">Select {meta.labels.TargetID}…</option>
              {targetOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              className={baseInput}
              value={str(record.TargetID)}
              onChange={(e) => set('TargetID', Number(e.target.value) || 0)}
              placeholder={meta.labels.TargetID}
            />
          )}
        </div>
      )}

      {/* Value - numeric modifier for Dice/Stat modifiers */}
      {meta.show.Value && (
        <div className="flex flex-col gap-1 w-24">
          <div className={labelCls}>{meta.labels.Value}</div>
          <input
            type="number"
            className={baseInput}
            value={str(record.Value)}
            onChange={(e) => set('Value', Number(e.target.value) || 0)}
            placeholder={meta.labels.Value}
          />
        </div>
      )}
    </div>
  );
}
