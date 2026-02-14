import type { SchemaData, TableSchema } from '@/models/schema';
import { str, col } from '@/utils/rprHelpers';
import { useEffectTargetLookups } from '@/hooks/useEffectTargetLookups';
import type { Opt } from '@/hooks/useEffectTargetLookups';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

function getFieldMeta(fn: number | null) {
  const show = { TargetID: true, Modifier: false, Extra: false, Value: false };
  const labels = { TargetID: 'Target ID', Modifier: 'Modifier', Extra: 'Extra', Value: 'Value' };
  const targetType: 'skill' | 'skillAttr' | 'perk' | 'stat' | 'ability' | 'status' | 'category' | 'text' | 'id' = 'id';

  if (fn === null) return { show, labels, targetType };

  switch (fn) {
    case 0: case 1:
      return { show, labels: { ...labels, TargetID: 'Skill' }, targetType: 'skill' as const };
    case 2: case 3: case 11:
      return { show, labels: { ...labels, TargetID: 'Perk' }, targetType: 'perk' as const };
    case 4:
      return { show: { ...show, Value: true }, labels: { ...labels, TargetID: 'Skill/Attribute', Value: 'Modifier' }, targetType: 'skillAttr' as const };
    case 5:
      return { show, labels: { ...labels, TargetID: 'Feat ID' }, targetType: 'id' as const };
    case 6:
      return { show, labels: { ...labels, TargetID: 'Stat' }, targetType: 'stat' as const };
    case 7:
      return { show: { ...show, Value: true }, labels: { ...labels, TargetID: 'Stat', Value: 'Modifier' }, targetType: 'stat' as const };
    case 8:
      return { show, labels: { ...labels, TargetID: 'Ability' }, targetType: 'ability' as const };
    case 9: case 10:
      return { show, labels: { ...labels, TargetID: 'Status' }, targetType: 'status' as const };
    case 12:
      return { show, labels: { ...labels, TargetID: 'Role ID' }, targetType: 'id' as const };
    case 13: case 14:
      return { show: { TargetID: false, Modifier: true, Extra: false, Value: false }, labels: { ...labels, Modifier: 'Category' }, targetType: 'category' as const };
    case 15:
      return { show: { TargetID: false, Modifier: true, Extra: false, Value: false }, labels: { ...labels, Modifier: 'Language' }, targetType: 'text' as const };
    case 16:
      return { show: { TargetID: false, Modifier: true, Extra: false, Value: false }, labels: { ...labels, Modifier: 'CharTag' }, targetType: 'text' as const };
    case 17:
      return { show: { TargetID: false, Modifier: false, Extra: true, Value: true }, labels: { ...labels, Extra: 'Variable Name', Value: 'Numeric Value' }, targetType: 'text' as const };
    case 18:
      return { show: { TargetID: false, Modifier: true, Extra: true, Value: false }, labels: { ...labels, Extra: 'Variable Name', Modifier: 'String Value' }, targetType: 'text' as const };
    default:
      return { show, labels, targetType };
  }
}

export default function PerkEffectEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const lookups = useEffectTargetLookups(allData, {
    filteredSkills: true,
    perkCategories: true,
    labelFormat: 'id-name',
  });

  const fnCol = col(tableSchema, 'Function');
  const fnEnum = fnCol?.enum ?? {};
  const fnOptions = Object.entries(fnEnum);

  const rawFn = record.Function;
  const fn = rawFn === '' || rawFn === null || rawFn === undefined ? null : Number(rawFn);
  const meta = getFieldMeta(Number.isFinite(fn) ? fn : null);

  const targetOpts = lookups.getTargetOptions(meta.targetType);

  const onFunctionChange = (newVal: string) => {
    const isBlank = newVal === '';
    const nFn = isBlank ? null : Number(newVal);
    const next: Record<string, unknown> = { ...record, Function: isBlank ? '' : nFn };

    if (Number.isFinite(nFn)) {
      const pick = (opts: Opt[]) => (opts.length > 0 ? opts[0].value : '');
      switch (nFn) {
        case 0: case 1:
          next.TargetID = Number(pick(lookups.skills)) || 0; break;
        case 2: case 3: case 11:
          next.TargetID = Number(pick(lookups.perks)) || 0; break;
        case 4:
          next.TargetID = Number(pick(lookups.skillsAndAttrs)) || 0;
          next.Value = Number(next.Value ?? 0); break;
        case 5: case 12:
          next.TargetID = 0; break;
        case 6: case 7:
          next.TargetID = Number(pick(lookups.stats)) || 0;
          if (nFn === 7) next.Value = Number(next.Value ?? 0); break;
        case 8:
          next.TargetID = Number(pick(lookups.abilities)) || 0; break;
        case 9: case 10:
          next.TargetID = Number(pick(lookups.statuses)) || 0; break;
        case 13: case 14:
          next.Modifier = pick(lookups.perkCategories);
          next.TargetID = 0; break;
        case 15: case 16:
          next.Modifier = ''; next.TargetID = 0; break;
        case 17:
          next.Extra = ''; next.Value = 0; next.TargetID = 0; break;
        case 18:
          next.Extra = ''; next.Modifier = ''; next.TargetID = 0; break;
      }
    } else {
      next.TargetID = 0; next.Modifier = ''; next.Extra = ''; next.Value = 0;
    }
    onChange(next);
  };

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';
  const labelCls = 'text-xs font-semibold text-slate-200';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <div className={labelCls}>Function</div>
        <select
          className={`${baseInput} w-48`}
          value={str(record.Function)}
          onChange={(e) => onFunctionChange(e.target.value)}
        >
          <option value="">Select function…</option>
          {fnOptions.map(([k, v]) => (
            <option key={k} value={k}>{k} – {v}</option>
          ))}
        </select>
      </div>

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
                <option key={o.value} value={o.value}>{o.label}</option>
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

      {meta.show.Modifier && (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>{meta.labels.Modifier}</div>
          {meta.targetType === 'category' && lookups.perkCategories.length > 0 ? (
            <select
              className={`${baseInput} w-40`}
              value={str(record.Modifier)}
              onChange={(e) => set('Modifier', e.target.value)}
            >
              <option value="">Select {meta.labels.Modifier}…</option>
              {lookups.perkCategories.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
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
