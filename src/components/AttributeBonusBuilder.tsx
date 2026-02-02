import { useMemo, useState } from 'react';

import type { SchemaData } from '@/models/schema';

type Option = { value: number; label: string };

type BonusEntry = { attrId: number; mult: number };

type Props = {
  allData: SchemaData;
  value: string;
  onChange: (next: string) => void;
  addButtonLabel?: string;
};

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function attributeOptions(allData: SchemaData): Option[] {
  const skills = Array.isArray(allData.SkillDef) ? (allData.SkillDef as Array<Record<string, unknown>>) : [];

  const filtered = skills
    .filter((r) => {
      const typeFlag = String(r.TypeFlag ?? '').toLowerCase();
      return typeFlag === 't';
    })
    .map((r) => {
      const id = Number(r['Node ID']);
      if (!Number.isFinite(id)) return null;
      const name = String(r.Name ?? `Attribute ${id}`);
      return { value: id, label: name } satisfies Option;
    })
    .filter((x): x is Option => x !== null)
    .sort((a, b) => a.value - b.value);

  return filtered;
}

function parseBonusText(text: string): BonusEntry[] {
  const raw = text.trim();
  if (!raw) return [];
  return raw
    .split(/\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const [rawId, rawMult] = entry.split('*');
      const attrId = Number(String(rawId ?? '').trim());
      const mult = rawMult === undefined ? 1.0 : Number(String(rawMult).trim());
      return {
        attrId: Number.isFinite(attrId) ? attrId : 0,
        mult: Number.isFinite(mult) ? mult : 1.0,
      } satisfies BonusEntry;
    })
    .filter((e) => e.attrId > 0);
}

function formatBonusText(entries: BonusEntry[]): string {
  return entries
    .filter((e) => e.attrId > 0)
    .map((e) => {
      const mult = Number.isFinite(e.mult) ? e.mult : 1.0;
      return `${e.attrId}*${mult.toFixed(1)}`;
    })
    .join(';');
}

export default function AttributeBonusBuilder({
  allData,
  value,
  onChange,
  addButtonLabel = 'Add bonus source',
}: Props) {
  const opts = useMemo(() => attributeOptions(allData), [allData]);
  const entries = useMemo(() => parseBonusText(str(value)), [value]);

  // State for the "add new" row
  const [isAdding, setIsAdding] = useState(false);
  const [draftAttrId, setDraftAttrId] = useState<number>(0);
  const [draftMult, setDraftMult] = useState<number>(1.0);

  const baseInput =
    'rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';

  const updateEntry = (idx: number, next: BonusEntry) => {
    const nextEntries = entries.slice();
    nextEntries[idx] = next;
    onChange(formatBonusText(nextEntries));
  };

  const removeEntry = (idx: number) => {
    const nextEntries = entries.filter((_, i) => i !== idx);
    onChange(formatBonusText(nextEntries));
  };

  const startAdding = () => {
    setDraftAttrId(opts[0]?.value ?? 0);
    setDraftMult(1.0);
    setIsAdding(true);
  };

  const confirmAdd = () => {
    if (!draftAttrId) return;
    const nextEntries = entries.concat([{ attrId: draftAttrId, mult: draftMult }]);
    onChange(formatBonusText(nextEntries));
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Existing entries first (native style) */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, idx) => (
            <div
              key={idx}
              className="group flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/30 p-2"
            >
              <select
                className={`${baseInput} w-48`}
                value={String(e.attrId)}
                onChange={(ev) => updateEntry(idx, { ...e, attrId: Number(ev.target.value || 0) })}
              >
                {opts.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-slate-400">x</span>
              <input
                className={`${baseInput} w-20`}
                type="number"
                step="0.1"
                value={String(e.mult)}
                onChange={(ev) => updateEntry(idx, { ...e, mult: Number(ev.target.value || 1.0) })}
              />
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                className="ml-auto px-2 py-1 text-xs text-red-400 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add row — shows dropdown when adding */}
      {isAdding ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-700/50 bg-slate-950/30 p-2">
          {opts.length > 0 ? (
            <>
              <select
                className={`${baseInput} w-48`}
                value={String(draftAttrId || '')}
                onChange={(e) => setDraftAttrId(Number(e.target.value || 0))}
              >
                <option value="">— Select Attribute —</option>
                {opts.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-slate-400">x</span>
              <input
                className={`${baseInput} w-20`}
                type="number"
                step="0.1"
                value={String(draftMult)}
                onChange={(e) => setDraftMult(Number(e.target.value || 1.0))}
              />
              <button
                type="button"
                onClick={confirmAdd}
                disabled={!draftAttrId}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                Add
              </button>
            </>
          ) : (
            <span className="text-sm text-amber-400">No attributes exist yet. Create some in the Attributes tab first.</span>
          )}
          <button
            type="button"
            onClick={cancelAdd}
            className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdding}
          className="w-fit rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-500"
        >
          {addButtonLabel}
        </button>
      )}
    </div>
  );
}
