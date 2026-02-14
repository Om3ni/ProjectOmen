import type { SchemaColumn, TableSchema } from '@/models/schema';

/** Parse unknown value to number, returning default if not finite.
 *  Treats null, undefined, and blank strings as the default. */
export function num(v: unknown, d = 0): number {
  if (v === null || v === undefined) return d;
  if (typeof v === 'string' && v.trim() === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Parse unknown value as RPR boolean ('t'/'f' flag). */
export function tf(v: unknown): boolean {
  return String(v).toLowerCase() === 't' || v === true;
}

/** Coerce unknown value to string, treating null/undefined as empty string. */
export function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

/** Find a column definition by name within a table schema. */
export function col(schema: TableSchema, name: string): SchemaColumn | undefined {
  return schema.columns.find((c) => c.name === name);
}
