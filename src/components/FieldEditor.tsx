import { useMemo } from 'react';

import type { SchemaColumn } from '@/models/schema';
import DescriptionField from './DescriptionField';

type Props = {
  column: SchemaColumn;
  value: unknown;
  onChange: (next: unknown) => void;
  label?: string;
  tooltip?: string;
  appearance?: 'dark' | 'light';
  onFocus?: () => void;
  disabled?: boolean;
};

function isBoolTf(column: SchemaColumn): boolean {
  return String(column.type).toLowerCase() === 'bool_tf';
}

function toBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 't') return true;
  if (s === 'f') return false;
  const n = Number(value);
  if (Number.isFinite(n)) return n !== 0;
  return false;
}

function isNumeric(column: SchemaColumn): boolean {
  const t = String(column.type).toLowerCase();
  return t === 'int' || t === 'number' || t === 'int_or_float';
}

type Rgba = { r: number; g: number; b: number; a: number };

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function parseRgbaFloatList(value: unknown): Rgba | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const nums = value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    if (nums.length >= 3) {
      const [r, g, b, a = 1] = nums;
      return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;
  // Expected format in rpr: "0.0,0.556863,1.0,1.0" (comma-separated floats)
  const parts = raw
    .replace(/[[(){}\\]]/g, '')
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;
  const nums = parts.map((p) => Number(p));
  if (!nums.slice(0, 3).every((n) => Number.isFinite(n))) return null;
  const [r, g, b, a = 1] = nums;
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
}

function formatFloat01(n: number): string {
  const clamped = clamp01(n);
  // Keep the same style as your rpr.txt (always at least one decimal)
  let s = clamped.toFixed(6);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (!s.includes('.')) s += '.0';
  return s;
}

function formatRgbaFloatList(rgba: Rgba): string {
  return [rgba.r, rgba.g, rgba.b, rgba.a].map(formatFloat01).join(',');
}

function byteToHex(b: number): string {
  const n = Math.max(0, Math.min(255, Math.round(b)));
  return n.toString(16).padStart(2, '0');
}

function rgb01ToHex(r: number, g: number, b: number): string {
  return `#${byteToHex(clamp01(r) * 255)}${byteToHex(clamp01(g) * 255)}${byteToHex(clamp01(b) * 255)}`;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } | null {
  const h = String(hex || '').trim().replace(/^#/, '');
  if (h.length !== 6) return null;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

export default function FieldEditor({ column, value, onChange, label, tooltip, appearance = 'dark', onFocus, disabled }: Props) {
  const isDark = appearance === 'dark';
  const baseInput = isDark
    ? 'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40'
    : 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300/60';

  const labelText = label ?? column.name;

  const enumEntries = useMemo(() => {
    const e = column.enum;
    if (!e || typeof e !== 'object') return [];
    return Object.entries(e);
  }, [column.enum]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-3">
        <div className={isDark ? 'text-xs font-semibold text-slate-200' : 'text-xs font-semibold text-slate-700'}>
          {labelText}
        </div>
      </div>
      {tooltip ? (
        <div className={isDark ? 'text-[10px] uppercase tracking-wide text-slate-500' : 'text-[10px] text-slate-500'}>
          {tooltip}
        </div>
      ) : null}

      {String(column.type).toLowerCase() === 'literal' || column.const !== undefined ? (
        <input className={baseInput} disabled value={String(column.const ?? value ?? '')} />
      ) : String(column.type).toLowerCase() === 'rgba_float_list' || String(column.type).toLowerCase() === 'rgb_float_list' ? (
        (() => {
          const parsed = parseRgbaFloatList(value) ?? { r: 1, g: 1, b: 1, a: 1 };
          const hex = rgb01ToHex(parsed.r, parsed.g, parsed.b);
          const alpha = parsed.a;

          const commit = (next: Partial<Rgba>) => {
            const merged: Rgba = {
              r: next.r !== undefined ? clamp01(next.r) : parsed.r,
              g: next.g !== undefined ? clamp01(next.g) : parsed.g,
              b: next.b !== undefined ? clamp01(next.b) : parsed.b,
              a: next.a !== undefined ? clamp01(next.a) : parsed.a,
            };

            // rgb_float_list gets written without alpha (but we still show alpha slider for rgba)
            const isRgb = String(column.type).toLowerCase() === 'rgb_float_list';
            const out = isRgb
              ? [merged.r, merged.g, merged.b].map(formatFloat01).join(',')
              : formatRgbaFloatList(merged);
            onChange(out);
          };

          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={hex}
                  disabled={disabled}
                  onChange={(e) => {
                    const rgb = hexToRgb01(e.target.value);
                    if (!rgb) return;
                    commit({ r: rgb.r, g: rgb.g, b: rgb.b });
                  }}
                  title="Pick color"
                />

                {String(column.type).toLowerCase() === 'rgba_float_list' ? (
                  <div className="flex items-center gap-2">
                    <span className={isDark ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>A</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={alpha}
                      disabled={disabled}
                      onChange={(e) => commit({ a: Number(e.target.value) })}
                    />
                    <span className={isDark ? 'text-xs text-slate-300 tabular-nums' : 'text-xs text-slate-600 tabular-nums'}>
                      {formatFloat01(alpha)}
                    </span>
                  </div>
                ) : null}

                <div
                  className="h-6 w-10 rounded border border-slate-700"
                  style={{ backgroundColor: `rgba(${Math.round(parsed.r * 255)}, ${Math.round(parsed.g * 255)}, ${Math.round(parsed.b * 255)}, ${alpha})` }}
                  title="Preview"
                />
              </div>

              {/* Raw value editor (keeps the exact float-list format) */}
              <input
                className={baseInput}
                placeholder={String(column.type).toLowerCase() === 'rgb_float_list' ? 'r,g,b' : 'r,g,b,a'}
                value={value === undefined || value === null ? '' : String(value)}
                disabled={disabled}
                onFocus={onFocus}
                onChange={(e) => {
                  // Let power users paste exact values.
                  onChange(e.target.value);
                }}
              />
            </div>
          );
        })()
      ) : isBoolTf(column) ? (
        (() => {
          const checked = toBool(value);
          return (
        <label className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? 't' : 'f')}
          />
        </label>
          );
        })()
      ) : enumEntries.length > 0 ? (
        <select
          className={baseInput}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
        >
          <option value="">Select {labelText}…</option>
          {enumEntries.map(([k, v]) => (
            <option key={k} value={k}>
              {k} – {v}
            </option>
          ))}
        </select>
      ) : isNumeric(column) ? (
        <input
          className={baseInput}
          type="number"
          placeholder={labelText}
          value={value === undefined || value === null ? '' : String(value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange('');
              return;
            }
            const num = Number(raw);
            onChange(Number.isFinite(num) ? num : raw);
          }}
        />
      ) : column.name === 'Description' ? (
        <DescriptionField
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(v) => onChange(v)}
          placeholder={labelText}
          className={baseInput + ' min-h-24'}
        />
      ) : (
        <input
          className={baseInput}
          placeholder={labelText}
          value={value === undefined || value === null ? '' : String(value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
