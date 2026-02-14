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

function getFieldMeta(effect: number | null) {
  const show = { TargetID: true, Value: false };
  const labels = { TargetID: 'Target', Value: 'by' };
  const targetType: 'skillAttr' | 'perk' | 'stat' | 'ability' | 'status' = 'skillAttr';

  if (effect === null) return { show, labels, targetType };

  switch (effect) {
    case 0:
      return { show: { TargetID: true, Value: true }, labels: { TargetID: 'Skill/Attribute', Value: 'Modifier' }, targetType: 'skillAttr' as const };
    case 1:
      return { show: { TargetID: true, Value: false }, labels: { TargetID: 'Perk', Value: 'by' }, targetType: 'perk' as const };
    case 3:
      return { show: { TargetID: true, Value: true }, labels: { TargetID: 'Stat', Value: 'Modifier' }, targetType: 'stat' as const };
    case 4:
      return { show: { TargetID: true, Value: false }, labels: { TargetID: 'Ability', Value: 'by' }, targetType: 'ability' as const };
    case 5: case 6:
      return { show: { TargetID: true, Value: false }, labels: { TargetID: 'Status', Value: 'by' }, targetType: 'status' as const };
    default:
      return { show, labels, targetType };
  }
}

export default function RuneEffectEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const lookups = useEffectTargetLookups(allData, { labelFormat: 'id-name' });

  const effectCol = col(tableSchema, 'Effect');
  const effectEnum = effectCol?.enum ?? {};
  const effectOptions = Object.entries(effectEnum);

  const rawEffect = record.Effect;
  const effect = rawEffect === '' || rawEffect === null || rawEffect === undefined ? null : Number(rawEffect);
  const meta = getFieldMeta(Number.isFinite(effect) ? effect : null);

  const targetOpts = lookups.getTargetOptions(meta.targetType);

  const onEffectChange = (newVal: string) => {
    const isBlank = newVal === '';
    const nEffect = isBlank ? null : Number(newVal);
    const next: Record<string, unknown> = { ...record, Effect: isBlank ? '' : nEffect };

    if (Number.isFinite(nEffect)) {
      const pick = (opts: Opt[]) => (opts.length > 0 ? opts[0].value : '');
      switch (nEffect) {
        case 0:
          next.TargetID = Number(pick(lookups.skillsAndAttrs)) || 0;
          next.Value = Number(next.Value ?? 0); break;
        case 1:
          next.TargetID = Number(pick(lookups.perks)) || 0; break;
        case 3:
          next.TargetID = Number(pick(lookups.stats)) || 0;
          next.Value = Number(next.Value ?? 0); break;
        case 4:
          next.TargetID = Number(pick(lookups.abilities)) || 0; break;
        case 5: case 6:
          next.TargetID = Number(pick(lookups.statuses)) || 0; break;
      }
    } else {
      next.TargetID = 0; next.Value = 0;
    }
    onChange(next);
  };

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';
  const labelCls = 'text-xs font-semibold text-slate-200';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <div className={labelCls}>Effect</div>
        <select
          className={`${baseInput} w-48`}
          value={str(record.Effect)}
          onChange={(e) => onEffectChange(e.target.value)}
        >
          <option value="">Select effect…</option>
          {effectOptions.map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

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
                <option key={o.value} value={o.value}>{o.label}</option>
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
