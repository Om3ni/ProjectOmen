import { useMemo, useState } from 'react';

import type { SchemaColumn, SchemaData, TableSchema } from '@/models/schema';
import FormulaEditorModal from '@/components/FormulaEditorModal';

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
 * Metadata for each Effect type:
 * - show: which fields are visible
 * - targetSource: what dropdown to use for TargetID
 * - labels: custom labels for fields
 * 
 * Effect enum (from schema):
 * 0: Print Message - just message text
 * 1: Modify Stat - stat dropdown + amount
 * 2: Give Base Game Item - item ID + amount
 * 3: Remove Base Game Item - item ID
 * 4: Buff Skill - skill dropdown + amount + duration + delay + category
 * 5: Buff Stat - stat dropdown + amount + duration + delay + category
 * 6: Buff Perk - perk dropdown + duration + delay + category
 * 7: Dispel Buff - just category
 * 8: Buff Ability - ability dropdown + duration + delay
 * 9: Auto Use Ability - ability dropdown
 * 10: Set Stat - stat dropdown + value
 * 11: Buff Grant Status - status dropdown + duration + delay + category
 * 12: Buff Unlock Status - status dropdown + delay + category
 */

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
  0: { // Print Message
    show: ['AdjustFormula'],
    targetSource: null,
    adjustLabel: 'Message',
    adjustMode: 'message',
  },
  1: { // Modify Stat
    show: ['TargetID', 'AdjustFormula'],
    targetSource: 'stat',
    targetLabel: 'Stat',
    adjustLabel: 'By',
  },
  2: { // Give Base Game Item
    show: ['TargetID', 'AdjustFormula'],
    targetSource: 'item',
    targetLabel: 'Item ID',
    adjustLabel: 'Amount',
  },
  3: { // Remove Base Game Item
    show: ['TargetID', 'AdjustFormula'],
    targetSource: 'item',
    targetLabel: 'Item ID',
    adjustLabel: 'Amount',
  },
  4: { // Buff Skill
    show: ['TargetID', 'AdjustFormula', 'DurationFormula', 'DelayFormula', 'Category'],
    targetSource: 'skill',
    targetLabel: 'Skill',
    adjustLabel: 'By',
  },
  5: { // Buff Stat
    show: ['TargetID', 'AdjustFormula', 'DurationFormula', 'DelayFormula', 'Category'],
    targetSource: 'stat',
    targetLabel: 'Stat',
    adjustLabel: 'By',
  },
  6: { // Buff Perk
    show: ['TargetID', 'DurationFormula', 'DelayFormula', 'Category'],
    targetSource: 'perk',
    targetLabel: 'Perk',
  },
  7: { // Dispel Buff
    show: ['Category'],
    targetSource: null,
  },
  8: { // Buff Ability
    show: ['TargetID', 'DurationFormula', 'DelayFormula', 'Category'],
    targetSource: 'ability',
    targetLabel: 'Ability',
  },
  9: { // Auto Use Ability
    show: ['TargetID'],
    targetSource: 'ability',
    targetLabel: 'Ability',
  },
  10: { // Set Stat
    show: ['TargetID', 'AdjustFormula'],
    targetSource: 'stat',
    targetLabel: 'Stat',
    adjustLabel: 'To',
  },
  11: { // Buff Grant Status
    show: ['TargetID', 'DurationFormula', 'DelayFormula', 'Category'],
    targetSource: 'status',
    targetLabel: 'Status',
  },
  12: { // Buff Unlock Status
    show: ['TargetID', 'DelayFormula', 'Category'],
    targetSource: 'status',
    targetLabel: 'Status',
  },
};

function getEffectMeta(fn: number | null): EffectMeta {
  if (fn === null || !Object.prototype.hasOwnProperty.call(EFFECT_META, fn)) {
    return DEFAULT_META;
  }
  return { ...DEFAULT_META, ...EFFECT_META[fn] };
}

function placeholderFromLabel(label: string): string {
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return '';
  // Common ask: "Buff Category" -> "Buff category"
  return normalized.replace(/\bCategory\b/g, 'category');
}

// Fields to clear when switching effect types
const CLEARABLE_FIELDS = ['AdjustFormula', 'TargetID', 'DurationFormula', 'DelayFormula', 'Category'];

export default function SpellEffectEditor({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  // Track which formula field is being edited in the modal
  const [formulaModalField, setFormulaModalField] = useState<string | null>(null);

  // Get enums from schema
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

  // Current function value
  const rawFn = record.Function;
  const fn = rawFn === '' || rawFn === null || rawFn === undefined ? null : Number(rawFn);
  const meta = getEffectMeta(Number.isFinite(fn) ? fn : null);
  const showSet = new Set(meta.show);

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
    switch (meta.targetSource) {
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
      case 'item':
        return []; // Item IDs are entered manually
      default:
        return [];
    }
  };

  const targetOpts = getTargetOptions();

  const onFunctionChange = (newVal: string) => {
    const isBlank = newVal === '';
    const nFn = isBlank ? null : Number(newVal);
    const next: Record<string, unknown> = { ...record, Function: isBlank ? '' : nFn };

    // Get new meta and clear fields not in the new show list
    if (Number.isFinite(nFn)) {
      const newMeta = getEffectMeta(nFn);
      const newShowSet = new Set(newMeta.show);
      
      CLEARABLE_FIELDS.forEach((field) => {
        if (!newShowSet.has(field)) {
          next[field] = field === 'TargetID' ? 0 : '';
        }
      });

      // Auto-select first option for target if applicable
      if (newShowSet.has('TargetID') && newMeta.targetSource) {
        const pick = (opts: Opt[]) => (opts.length > 0 ? opts[0].value : 0);
        switch (newMeta.targetSource) {
          case 'skill':
            next.TargetID = pick(skills);
            break;
          case 'stat':
            next.TargetID = pick(stats);
            break;
          case 'perk':
            next.TargetID = pick(perks);
            break;
          case 'ability':
            next.TargetID = pick(abilities);
            break;
          case 'status':
            next.TargetID = pick(statuses);
            break;
        }
      }
    }

    onChange(next);
  };

  // Render helpers
  const renderSelect = (
    label: string,
    value: unknown,
    options: [string, string][],
    onChangeVal: (v: string) => void,
    className = 'w-24',
    showLabel = true
  ) => (
    <div className="flex min-w-0 flex-col gap-1">
      {showLabel && <label className="text-xs font-medium text-slate-400">{label}</label>}
      <select
        className={`min-w-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100 ${className}`}
        value={str(value)}
        onChange={(e) => onChangeVal(e.target.value)}
      >
        {options.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );

  const renderTargetSelect = () => {
    if (!showSet.has('TargetID')) return null;
    
    if (targetOpts.length === 0) {
      // No options - render as text input (for item IDs)
      return (
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">{meta.targetLabel}</label>
          <input
            type="text"
            className="w-24 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-sm text-slate-100"
            value={str(record.TargetID)}
            onChange={(e) => set('TargetID', e.target.value)}
            placeholder={placeholderFromLabel(meta.targetLabel)}
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
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Formula fields that support double-click to open editor
  const FORMULA_FIELDS = ['AdjustFormula', 'DurationFormula', 'DelayFormula'];
  const DEFAULT_FORMULA_PLACEHOLDER = 'e.g. 1d20+3';

  const renderTextInput = (field: string, label: string, wide = false) => {
    if (!showSet.has(field)) return null;

    const isMessageBox = field === 'AdjustFormula' && meta.adjustMode === 'message';
    const isFormulaField = FORMULA_FIELDS.includes(field) && !isMessageBox;
    const placeholder = isMessageBox
      ? 'Enter message…'
      : isFormulaField
        ? DEFAULT_FORMULA_PLACEHOLDER
        : field === 'Category'
          ? 'Curse, magic, physical, etc'
          : '';
    const inputWidthClass = wide
      ? 'min-w-[200px] w-full'
      : field === 'AdjustFormula'
        ? 'w-32'
        : field === 'Category'
          ? 'w-48'
          : 'w-40';

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
      {/* Top row: Broadcast, To, If, Effect, Target, Adjust (scrolls horizontally if needed) */}
      <div className="flex flex-wrap items-end gap-1">
        {renderSelect('Broadcast', record.Broadcast, broadcastOptions, (v) => set('Broadcast', Number(v)), 'w-20', false)}
        {inlineTag('To')}
        {renderSelect('To', record.Who, whoOptions, (v) => set('Who', Number(v)), 'w-24', false)}
        {inlineTag('If')}
        {renderSelect('If', record.If, ifOptions, (v) => set('If', Number(v)), 'w-28', false)}
        {renderSelect('Effect', record.Function, fnOptions, onFunctionChange, 'w-36', false)}
        {renderTargetSelect()}
        {meta.adjustMode !== 'message' && showSet.has('AdjustFormula') && inlineTag(meta.adjustLabel)}
        {meta.adjustMode !== 'message' && renderTextInput('AdjustFormula', meta.adjustLabel)}
      </div>

      {/* Message mode gets its own row (textarea) */}
      {meta.adjustMode === 'message' && (
        <div className="flex flex-wrap items-end gap-3">
          {renderTextInput('AdjustFormula', meta.adjustLabel, true)}
        </div>
      )}

      {/* Duration, Delay, Category row */}
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

      {/* Formula Editor Modal */}
      {formulaModalField && (
        <FormulaEditorModal
          label={
            formulaModalField === 'AdjustFormula'
              ? meta.adjustLabel
              : formulaModalField === 'DurationFormula'
                ? meta.durationLabel
                : meta.delayLabel
          }
          value={str(record[formulaModalField])}
          onApply={(v) => {
            set(formulaModalField, v);
            setFormulaModalField(null);
          }}
          onClose={() => setFormulaModalField(null)}
        />
      )}
    </div>
  );
}
