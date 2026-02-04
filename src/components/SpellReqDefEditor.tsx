import { useEffect, useMemo } from 'react';

import type { SchemaColumn, SchemaData, TableSchema } from '@/models/schema';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

type Opt = { value: number; label: string };

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function col(schema: TableSchema, name: string): SchemaColumn | undefined {
  return schema.columns.find((c) => c.name === name);
}

const OP_ENUM_FALLBACK: Record<string, string> = {
  '0': '==',
  '1': '!=',
  '2': '>',
  '3': '>=',
  '4': '<',
  '5': '<=',
  '6': 'Between',
  '7': 'Outside',
};

const FULL_OP_FUNCTIONS = new Set([0, 1, 2, 4]);

const FUNCTION_LABEL_OVERRIDES: Record<string, string> = {
  '1': 'Skill Total',
  '4': 'Level',
  '5': 'Buff',
  '6': 'Item',
};

export default function SpellReqDefEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });
  const uiLabels = tableSchema.ui?.labels ?? {};

  const fnCol = col(tableSchema, 'Function');
  const opCol = col(tableSchema, 'Operator');
  const fnEnum = fnCol?.enum ?? {};
  const opEnum = opCol?.enum ?? OP_ENUM_FALLBACK;

  const fn = Number(record.Function ?? 0);
  const allowFullOps = Number.isFinite(fn) && FULL_OP_FUNCTIONS.has(fn);
  const allowedOpKeys = useMemo(
    () => (allowFullOps ? ['0', '1', '2', '3', '4', '5', '6', '7'] : ['0', '1']),
    [allowFullOps]
  );

  const rawOp = str(record.Operator ?? 0);
  const safeOpKey = allowedOpKeys.includes(rawOp) ? rawOp : '0';

  useEffect(() => {
    if (safeOpKey !== rawOp) {
      set('Operator', Number(safeOpKey));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeOpKey]);

  const opOptions = useMemo(() => {
    return Object.entries(opEnum).filter(([k]) => allowedOpKeys.includes(String(k)));
  }, [opEnum, allowedOpKeys]);

  const stats: Opt[] = useMemo(() => {
    const arr = Array.isArray(allData.Stat) ? (allData.Stat as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: Number(r.ID ?? NaN), label: String(r.Name ?? r.ID ?? '') }))
      .filter((o) => Number.isFinite(o.value))
      .sort((a, b) => a.value - b.value);
  }, [allData]);

  const skills: Opt[] = useMemo(() => {
    const arr = Array.isArray(allData.SkillDef) ? (allData.SkillDef as Array<Record<string, unknown>>) : [];
    return arr
      .filter((r) => String(r.TypeFlag ?? '').toLowerCase() === 'f')
      .map((r) => ({ value: Number(r['Node ID'] ?? NaN), label: String(r.Name ?? r['Node ID'] ?? '') }))
      .filter((o) => Number.isFinite(o.value))
      .sort((a, b) => a.value - b.value);
  }, [allData]);

  const perks: Opt[] = useMemo(() => {
    const arr = Array.isArray(allData.PerkDef) ? (allData.PerkDef as Array<Record<string, unknown>>) : [];
    return arr
      .map((r) => ({ value: Number(r.ID ?? NaN), label: String(r.Name ?? r.ID ?? '') }))
      .filter((o) => Number.isFinite(o.value))
      .sort((a, b) => a.value - b.value);
  }, [allData]);

  const onFunctionChange = (newVal: string) => {
    const n = newVal === '' ? '' : Number(newVal);
    const nextFn = newVal === '' ? NaN : Number(newVal);
    const nextAllowFull = Number.isFinite(nextFn) && FULL_OP_FUNCTIONS.has(nextFn);
    const nextAllowed = nextAllowFull ? ['0', '1', '2', '3', '4', '5', '6', '7'] : ['0', '1'];

    const next: Record<string, unknown> = {
      ...record,
      Function: n,
      Param: 0,
      ValueMin: 0,
      ValueMax: 0,
      Text: '',
    };

    const currentOpKey = str(record.Operator ?? 0);
    const fixedOpKey = nextAllowed.includes(currentOpKey) ? currentOpKey : '0';
    next.Operator = Number(fixedOpKey);

    // Perk requirement has no numeric value.
    if (Number.isFinite(nextFn) && nextFn === 3) {
      next.ValueMin = 0;
      next.ValueMax = 0;
    }

    // Item requirement uses Text as the value source.
    if (Number.isFinite(nextFn) && nextFn === 6) {
      next.ValueMin = 0;
      next.ValueMax = 0;
      next.Text = '';
    }

    onChange(next);
  };

  const setNumber = (field: string, raw: string) => {
    set(field, raw === '' ? '' : Number(raw));
  };

  const renderLabeled = (label: string, node: React.ReactNode) => (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="sr-only">{label}</div>
      {node}
    </div>
  );

  const baseSelect = "min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100";
  const baseInput = "min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100";

  const opNum = Number(safeOpKey);
  const showRange = opNum === 6 || opNum === 7;

  const isPerkRequirement = fn === 3;
  const isItemRequirement = fn === 6;
  const isBuffRequirement = fn === 5;
  const comparatorAfterAssociated = fn === 0 || fn === 1 || fn === 2 || fn === 3;

  const associatedControl = (() => {
    switch (fn) {
      case 0: // Stat
        return renderLabeled('Stat', (
          <select
            className={`${baseSelect} w-48`}
            value={str(record.Param ?? 0)}
            onChange={(e) => set('Param', Number(e.target.value || 0))}
          >
            {stats.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ));
      case 1: // Skill
        return renderLabeled('Skill Total', (
          <select
            className={`${baseSelect} w-56`}
            value={str(record.Param ?? 0)}
            onChange={(e) => set('Param', Number(e.target.value || 0))}
          >
            {skills.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ));
      case 2: // Skill Allocation
        return renderLabeled('Allocation', (
          <select
            className={`${baseSelect} w-40`}
            value={str(record.Param ?? 0)}
            onChange={(e) => set('Param', Number(e.target.value || 0))}
          >
            <option value={0}>Attribute 1</option>
            <option value={1}>Attribute 2</option>
            <option value={2}>Attribute 3</option>
            <option value={3}>Skill</option>
          </select>
        ));
      case 3: // Perk
        return renderLabeled('Perk', (
          <select
            className={`${baseSelect} w-56`}
            value={str(record.Param ?? 0)}
            onChange={(e) => set('Param', Number(e.target.value || 0))}
          >
            {perks.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ));
      case 5: // Status Category (Text)
        return renderLabeled('Buff', (
          <input
            type="text"
            className={`${baseInput} w-64`}
            value={str(record.Text)}
            onChange={(e) => set('Text', e.target.value)}
            placeholder="Buff category"
          />
        ));
      case 6: // Conan Item ID (Param)
        return renderLabeled('Item', (
          <input
            type="number"
            className={`${baseInput} w-24`}
            value={str(record.Param ?? 0)}
            onChange={(e) => setNumber('Param', e.target.value)}
            placeholder="Item ID"
          />
        ));
      default:
        return null;
    }
  })();

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-nowrap items-end gap-2 min-w-max">
        {renderLabeled(uiLabels.Function ?? 'Requirement', (
          <select className={`${baseSelect} w-40`} value={str(record.Function ?? 0)} onChange={(e) => onFunctionChange(e.target.value)}>
            <option value="">Select requirement…</option>
            {Object.entries(fnEnum)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([k, v]) => (
              <option key={k} value={k}>
                {FUNCTION_LABEL_OVERRIDES[k] ?? v}
              </option>
            ))}
          </select>
        ))}

        {comparatorAfterAssociated ? associatedControl : null}

        {renderLabeled(uiLabels.Operator ?? 'Comparator', (
          <select
            className={`${baseSelect} w-28`}
            value={safeOpKey}
            onChange={(e) => {
              const nextKey = e.target.value;
              const nextNum = nextKey === '' ? '' : Number(nextKey);
              const nextIsRange = nextKey === '6' || nextKey === '7';
              const patch: Record<string, unknown> = { ...record, Operator: nextNum };
              if (!nextIsRange) patch.ValueMax = 0;
              onChange(patch);
            }}
          >
            {opOptions.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        ))}

        {!comparatorAfterAssociated ? associatedControl : null}

        {/* Value controls */}
        {!isPerkRequirement && !isItemRequirement && !isBuffRequirement ? (
          <>
            {renderLabeled(showRange ? `${uiLabels.ValueMin ?? 'Value'} (Min)` : uiLabels.ValueMin ?? 'Value', (
              <input
                type="number"
                className={`${baseInput} w-24`}
                value={str(record.ValueMin ?? 0)}
                onChange={(e) => setNumber('ValueMin', e.target.value)}
                placeholder={showRange ? 'Min' : 'Value'}
              />
            ))}
            {showRange &&
              renderLabeled(uiLabels.ValueMax ?? 'Max', (
                <input
                  type="number"
                  className={`${baseInput} w-24`}
                  value={str(record.ValueMax ?? 0)}
                  onChange={(e) => setNumber('ValueMax', e.target.value)}
                  placeholder="Max"
                />
              ))}
          </>
        ) : null}

        {/* Item requirement: value is stored in Text (same column as category) */}
        {isItemRequirement ? (
          renderLabeled(uiLabels.ValueMin ?? 'Value', (
            <input
              type="number"
              className={`${baseInput} w-24`}
              value={str(record.Text)}
              onChange={(e) => set('Text', e.target.value)}
              placeholder="Value"
            />
          ))
        ) : null}
      </div>
    </div>
  );
}
