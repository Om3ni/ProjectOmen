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
 * Returns field visibility and labels based on the selected Function.
 * Mirrors the native UI's perkMeta() behavior.
 */
function getFieldMeta(fn: number | null) {
  const show = { TargetID: true, Modifier: false, Extra: false, Value: false, TargetType: false };
  const labels = { TargetID: 'Target ID', Modifier: 'Modifier', Extra: 'Extra', Value: 'Value' };
  const targetType: 'skill' | 'skillAttr' | 'perk' | 'stat' | 'ability' | 'status' | 'category' | 'text' | 'id' = 'id';

  if (fn === null) return { show, labels, targetType };

  switch (fn) {
    case 0: // Allow Skill
    case 1: // Deny Skill
      return { show, labels: { ...labels, TargetID: 'Skill' }, targetType: 'skill' as const };

    case 2: // Allow Perk
    case 3: // Deny Perk
    case 11: // Grant Perk
      return { show, labels: { ...labels, TargetID: 'Perk' }, targetType: 'perk' as const };

    case 4: // Dice Modifier
      return {
        show: { ...show, Value: true },
        labels: { ...labels, TargetID: 'Skill/Attribute', Value: 'Modifier' },
        targetType: 'skillAttr' as const,
      };

    case 5: // Give Feat
      return { show, labels: { ...labels, TargetID: 'Feat ID' }, targetType: 'id' as const };

    case 6: // Grant Stat
      return { show, labels: { ...labels, TargetID: 'Stat' }, targetType: 'stat' as const };

    case 7: // Stat Modifier
      return {
        show: { ...show, Value: true },
        labels: { ...labels, TargetID: 'Stat', Value: 'Modifier' },
        targetType: 'stat' as const,
      };

    case 8: // Grant Ability
      return { show, labels: { ...labels, TargetID: 'Ability' }, targetType: 'ability' as const };

    case 9: // Grant Status
    case 10: // Unlock Status
      return { show, labels: { ...labels, TargetID: 'Status' }, targetType: 'status' as const };

    case 12: // Grant Sudo Role
      return { show, labels: { ...labels, TargetID: 'Role ID' }, targetType: 'id' as const };

    case 13: // Allow Perk Category
    case 14: // Deny Perk Category
      return {
        show: { TargetID: false, Modifier: true, Extra: false, Value: false, TargetType: false },
        labels: { ...labels, Modifier: 'Category' },
        targetType: 'category' as const,
      };

    case 15: // Teach Language
      return {
        show: { TargetID: false, Modifier: true, Extra: false, Value: false, TargetType: false },
        labels: { ...labels, Modifier: 'Language' },
        targetType: 'text' as const,
      };

    case 16: // Give CharTag
      return {
        show: { TargetID: false, Modifier: true, Extra: false, Value: false, TargetType: false },
        labels: { ...labels, Modifier: 'CharTag' },
        targetType: 'text' as const,
      };

    case 17: // Set Float CharVar
      return {
        show: { TargetID: false, Modifier: false, Extra: true, Value: true, TargetType: false },
        labels: { ...labels, Extra: 'Variable Name', Value: 'Numeric Value' },
        targetType: 'text' as const,
      };

    case 18: // Set String CharVar
      return {
        show: { TargetID: false, Modifier: true, Extra: true, Value: false, TargetType: false },
        labels: { ...labels, Extra: 'Variable Name', Modifier: 'String Value' },
        targetType: 'text' as const,
      };

    default:
      return { show, labels, targetType };
  }
}

export default function PerkEffectEditor({ tableSchema, record, allData, onChange }: Props) {
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
      .filter((r) => String(r.TypeFlag ?? '').toLowerCase() === 'f')
      .map((r) => ({ value: String(r['Node ID'] ?? ''), label: `${r['Node ID']} – ${r.Name ?? '(unnamed)'}` }))
      .sort((a, b) => Number(a.value) - Number(b.value));
  }, [allData]);

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

  const perkCategories = useMemo(() => {
    const arr = Array.isArray(allData.PerkDef) ? (allData.PerkDef as Array<Record<string, unknown>>) : [];
    const cats = new Set<string>();
    arr.forEach((r) => {
      const c = String(r.Category ?? '').trim();
      if (c) cats.add(c);
    });
    return Array.from(cats)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [allData]);

  const getTargetOptions = (): Opt[] => {
    switch (meta.targetType) {
      case 'skill':
        return skills;
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
      case 'category':
        return perkCategories;
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
        case 0:
        case 1:
          next.TargetID = Number(pick(skills)) || 0;
          break;
        case 2:
        case 3:
        case 11:
          next.TargetID = Number(pick(perks)) || 0;
          break;
        case 4:
          next.TargetID = Number(pick(skillsAndAttrs)) || 0;
          next.Value = Number(next.Value ?? 0);
          break;
        case 5:
        case 12:
          next.TargetID = 0;
          break;
        case 6:
        case 7:
          next.TargetID = Number(pick(stats)) || 0;
          if (nFn === 7) next.Value = Number(next.Value ?? 0);
          break;
        case 8:
          next.TargetID = Number(pick(abilities)) || 0;
          break;
        case 9:
        case 10:
          next.TargetID = Number(pick(statuses)) || 0;
          break;
        case 13:
        case 14:
          next.Modifier = pick(perkCategories);
          next.TargetID = 0;
          break;
        case 15:
        case 16:
          next.Modifier = '';
          next.TargetID = 0;
          break;
        case 17:
          next.Extra = '';
          next.Value = 0;
          next.TargetID = 0;
          break;
        case 18:
          next.Extra = '';
          next.Modifier = '';
          next.TargetID = 0;
          break;
        default:
          break;
      }
    } else {
      // Clear all context fields
      next.TargetID = 0;
      next.Modifier = '';
      next.Extra = '';
      next.Value = 0;
    }
    onChange(next);
  };

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';

  const labelCls = 'text-xs font-semibold text-slate-200';

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Function dropdown */}
      <div className="flex flex-col gap-1">
        <div className={labelCls}>Function</div>
        <select
          className={`${baseInput} w-48`}
          value={str(record.Function)}
          onChange={(e) => onFunctionChange(e.target.value)}
        >
            <option value="">Select function…</option>
          {fnOptions.map(([k, v]) => (
            <option key={k} value={k}>
              {k} – {v}
            </option>
          ))}
        </select>
      </div>

      {/* TargetID - shown for most functions as a dropdown or numeric input */}
      {meta.show.TargetID && (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>{meta.labels.TargetID}</div>
          {targetOpts.length > 0 ? (
            <select
              className={`${baseInput} w-48`}
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
              className={`${baseInput} w-24`}
              type="number"
              value={str(record.TargetID)}
              onChange={(e) => set('TargetID', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={meta.labels.TargetID}
            />
          )}
        </div>
      )}

      {/* Modifier - shown for category/language/chartag/string var */}
      {meta.show.Modifier && (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>{meta.labels.Modifier}</div>
          {meta.targetType === 'category' && perkCategories.length > 0 ? (
            <select
              className={`${baseInput} w-40`}
              value={str(record.Modifier)}
              onChange={(e) => set('Modifier', e.target.value)}
            >
              <option value="">Select {meta.labels.Modifier}…</option>
              {perkCategories.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={`${baseInput} w-40`}
              value={str(record.Modifier)}
              onChange={(e) => set('Modifier', e.target.value)}
              placeholder={meta.labels.Modifier}
            />
          )}
        </div>
      )}

      {/* Extra - shown for charvar functions */}
      {meta.show.Extra && (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>{meta.labels.Extra}</div>
          <input
            className={`${baseInput} w-40`}
            value={str(record.Extra)}
            onChange={(e) => set('Extra', e.target.value)}
            placeholder={meta.labels.Extra}
          />
        </div>
      )}

      {/* Value - shown for dice/stat modifiers and float charvar */}
      {meta.show.Value && (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>{meta.labels.Value}</div>
          <input
            className={`${baseInput} w-20`}
            type="number"
            step="0.1"
            value={str(record.Value)}
            onChange={(e) => set('Value', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={meta.labels.Value}
          />
        </div>
      )}
    </div>
  );
}
