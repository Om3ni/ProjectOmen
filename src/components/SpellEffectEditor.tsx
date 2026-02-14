import { useState } from 'react';

import type { SchemaData, TableSchema } from '@/models/schema';
import { str, col } from '@/utils/rprHelpers';
import FormulaEditorModal from '@/components/FormulaEditorModal';
import { useEffectTargetLookups } from '@/hooks/useEffectTargetLookups';
import type { Opt } from '@/hooks/useEffectTargetLookups';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

type EffectMeta = {
  show: string[];
  targetSource: 'skill' | 'stat' | 'perk' | 'ability' | 'status' | 'item' | null;
  targetLabel: string;
  adjustLabel: string;
  adjustMode: 'formula' | 'message';
  durationLabel: string;
  delayLabel: string;
  categoryLabel: string;
};

const DEFAULT_META: EffectMeta = {
  show: ['TargetID'],
  targetSource: null,
  targetLabel: 'Node ID',
  adjustLabel: 'Formula / Text',
  adjustMode: 'formula',
  durationLabel: 'Duration (minutes)',
  delayLabel: 'Delay (minutes)',
  categoryLabel: 'Buff category',
};

const EFFECT_META: Record<number, Partial<EffectMeta>> = {
  0: { show: ['AdjustFormula'], targetSource: null, adjustLabel: 'Message', adjustMode: 'message' },
  1: { show: ['TargetID', 'AdjustFormula'], targetSource: 'stat', targetLabel: 'Stat', adjustLabel: 'By' },
  2: { show: ['TargetID', 'AdjustFormula'], targetSource: 'item', targetLabel: 'Item ID', adjustLabel: 'Amount' },
  3: { show: ['TargetID', 'AdjustFormula'], targetSource: 'item', targetLabel: 'Item ID', adjustLabel: 'Amount' },
  4: { show: ['TargetID', 'AdjustFormula', 'DurationFormula', 'DelayFormula', 'Category'], targetSource: 'skill', targetLabel: 'Skill', adjustLabel: 'By' },
  5: { show: ['TargetID', 'AdjustFormula', 'DurationFormula', 'DelayFormula', 'Category'], targetSource: 'stat', targetLabel: 'Stat', adjustLabel: 'By' },
  6: { show: ['TargetID', 'DurationFormula', 'DelayFormula', 'Category'], targetSource: 'perk', targetLabel: 'Perk' },
  7: { show: ['Category'], targetSource: null },
  8: { show: ['TargetID', 'DurationFormula', 'DelayFormula', 'Category'], targetSource: 'ability', targetLabel: 'Ability' },
  9: { show: ['TargetID'], targetSource: 'ability', targetLabel: 'Ability' },
  10: { show: ['TargetID', 'AdjustFormula'], targetSource: 'stat', targetLabel: 'Stat', adjustLabel: 'To' },
  11: { show: ['TargetID', 'DurationFormula', 'DelayFormula', 'Category'], targetSource: 'status', targetLabel: 'Status' },
  12: { show: ['TargetID', 'DelayFormula', 'Category'], targetSource: 'status', targetLabel: 'Status' },
};

function getEffectMeta(fn: number | null): EffectMeta {
  if (fn === null || !Object.prototype.hasOwnProperty.call(EFFECT_META, fn)) return DEFAULT_META;
  return { ...DEFAULT_META, ...EFFECT_META[fn] };
}

const CLEARABLE_FIELDS = ['AdjustFormula', 'TargetID', 'DurationFormula', 'DelayFormula', 'Category'];

export default function SpellEffectEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });
  const [formulaModalField, setFormulaModalField] = useState<string | null>(null);

  const lookups = useEffectTargetLookups(allData);

  const broadcastCol = col(tableSchema, 'Broadcast');
  const broadcastEnum = broadcastCol?.enum ?? { '0': 'Public', '1': 'Private', '2': 'Secret' };
  const broadcastOptions = Object.entries(broadcastEnum);

  const whoCol = col(tableSchema, 'Who');
  const whoEnum = whoCol?.enum ?? { '0': 'Target', '1': 'All Targets', '2': 'Caster' };
  const whoOptions = Object.entries(whoEnum);

  const ifCol = col(tableSchema, 'If');
  const ifEnum = ifCol?.enum ?? { '0': 'Always', '1': 'Critical Only', '2': 'Non-Critical Only' };
  const ifOptions = Object.entries(ifEnum);

  const fnCol = col(tableSchema, 'Function');
  const fnEnum = fnCol?.enum ?? {};
  const fnOptions = Object.entries(fnEnum);

  const rawFn = record.Function;
  const fn = rawFn === '' || rawFn === null || rawFn === undefined ? null : Number(rawFn);
  const meta = getEffectMeta(Number.isFinite(fn) ? fn : null);
  const showSet = new Set(meta.show);

  const targetOpts = lookups.getTargetOptions(meta.targetSource);

  const onFunctionChange = (newVal: string) => {
    const isBlank = newVal === '';
    const nFn = isBlank ? null : Number(newVal);
    const next: Record<string, unknown> = { ...record, Function: isBlank ? '' : nFn };

    if (Number.isFinite(nFn)) {
      const newMeta = getEffectMeta(nFn);
      const newShowSet = new Set(newMeta.show);

      CLEARABLE_FIELDS.forEach((field) => {
        if (!newShowSet.has(field)) {
          next[field] = field === 'TargetID' ? 0 : '';
        }
      });

      if (newShowSet.has('TargetID') && newMeta.targetSource) {
        const opts = lookups.getTargetOptions(newMeta.targetSource);
        const pick = (o: Opt[]) => (o.length > 0 ? o[0].value : 0);
        next.TargetID = pick(opts);
      }
    }

    onChange(next);
  };

  const renderSelect = (
    value: unknown, options: [string, string][],
    onChangeVal: (v: string) => void, className = 'w-24',
  ) => (
    <div className="flex min-w-0 flex-col gap-1">
      <select
        className={`min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100 ${className}`}
        value={str(value)}
        onChange={(e) => onChangeVal(e.target.value)}
      >
        {options.map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );

  const renderTargetSelect = () => {
    if (!showSet.has('TargetID')) return null;

    if (targetOpts.length === 0) {
      return (
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{meta.targetLabel}</label>
          <input
            type="text"
            className="w-24 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100"
            value={str(record.TargetID)}
            onChange={(e) => set('TargetID', e.target.value)}
            placeholder={meta.targetLabel}
          />
        </div>
      );
    }

    return (
      <div className="flex min-w-0 flex-col gap-1">
        <label className="sr-only">{meta.targetLabel}</label>
        <select
          className="w-40 min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100"
          value={str(record.TargetID)}
          onChange={(e) => {
            const val = e.target.value;
            const numeric = Number(val);
            set('TargetID', Number.isFinite(numeric) ? numeric : val);
          }}
        >
          <option value="">Select {meta.targetLabel}…</option>
          {targetOpts.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  };

  const FORMULA_FIELDS = ['AdjustFormula', 'DurationFormula', 'DelayFormula'];

  const renderTextInput = (field: string, label: string, wide = false) => {
    if (!showSet.has(field)) return null;

    const isMessageBox = field === 'AdjustFormula' && meta.adjustMode === 'message';
    const isFormulaField = FORMULA_FIELDS.includes(field) && !isMessageBox;
    const placeholder = isMessageBox
      ? 'Enter message…'
      : isFormulaField ? 'e.g. 1d20+3'
      : field === 'Category' ? 'Curse, magic, physical, etc' : '';
    const inputWidthClass = wide ? 'min-w-[200px] w-full'
      : field === 'AdjustFormula' ? 'w-32'
      : field === 'Category' ? 'w-48' : 'w-40';

    return (
      <div className={`flex flex-col gap-1 ${wide || isMessageBox ? 'w-full' : 'min-w-0'}`}>
        <label className={isMessageBox ? 'text-xs font-medium text-slate-400' : 'sr-only'}>{label}</label>
        {isMessageBox ? (
          <textarea
            rows={6}
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
            value={str(record[field])}
            onChange={(e) => set(field, e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            type="text"
            className={`min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100 ${inputWidthClass} ${isFormulaField ? 'cursor-pointer' : ''}`}
            value={str(record[field])}
            onChange={(e) => set(field, e.target.value)}
            onDoubleClick={isFormulaField ? () => setFormulaModalField(field) : undefined}
            title={isFormulaField ? 'Double-click to open formula editor' : undefined}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  };

  const inlineTag = (text: string) => (
    <div className="flex items-center">
      <span className="text-[11px] font-medium text-slate-300">{text}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-1">
        {renderSelect(record.Broadcast, broadcastOptions, (v) => set('Broadcast', Number(v)), 'w-20')}
        {inlineTag('To')}
        {renderSelect(record.Who, whoOptions, (v) => set('Who', Number(v)), 'w-24')}
        {inlineTag('If')}
        {renderSelect(record.If, ifOptions, (v) => set('If', Number(v)), 'w-28')}
        {renderSelect(record.Function, fnOptions, onFunctionChange, 'w-36')}
        {renderTargetSelect()}
        {meta.adjustMode !== 'message' && showSet.has('AdjustFormula') && inlineTag(meta.adjustLabel)}
        {meta.adjustMode !== 'message' && renderTextInput('AdjustFormula', meta.adjustLabel)}
      </div>

      {meta.adjustMode === 'message' && (
        <div className="flex flex-wrap items-end gap-3">
          {renderTextInput('AdjustFormula', meta.adjustLabel, true)}
        </div>
      )}

      {(showSet.has('DurationFormula') || showSet.has('DelayFormula') || showSet.has('Category')) && (
        <div className="flex flex-wrap items-center gap-1">
          {showSet.has('DurationFormula') && inlineTag(meta.durationLabel)}
          {renderTextInput('DurationFormula', meta.durationLabel)}
          {showSet.has('DelayFormula') && inlineTag(meta.delayLabel)}
          {renderTextInput('DelayFormula', meta.delayLabel)}
          {showSet.has('Category') && inlineTag(meta.categoryLabel)}
          {renderTextInput('Category', meta.categoryLabel)}
        </div>
      )}

      {formulaModalField && (
        <FormulaEditorModal
          label={
            formulaModalField === 'AdjustFormula' ? meta.adjustLabel
            : formulaModalField === 'DurationFormula' ? meta.durationLabel
            : meta.delayLabel
          }
          value={str(record[formulaModalField])}
          onApply={(v) => { set(formulaModalField, v); setFormulaModalField(null); }}
          onClose={() => setFormulaModalField(null)}
        />
      )}
    </div>
  );
}
