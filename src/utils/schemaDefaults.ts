import type { SchemaColumn, SchemaData, TableSchema } from '@/models/schema';

function normalizeDefaultValue(column: SchemaColumn, raw: unknown): unknown {
  const t = String(column.type).toLowerCase();

  // Preserve schema's string defaults for bool_tf ("t"/"f") and enums.
  if (t === 'bool_tf' || t === 'enum' || t === 'char' || t === 'string' || t.includes('string')) {
    return raw ?? '';
  }

  if (t === 'int' || t === 'number' || t === 'int_or_float') {
    if (raw === '' || raw === null || raw === undefined) return '';
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }

  return raw ?? '';
}

export function createDefaultRecord(tableName: string, schema: TableSchema): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  for (const col of schema.columns ?? []) {
    if (!col || !col.name) continue;

    if (col.const !== undefined) {
      record[col.name] = col.const;
      continue;
    }

    if (String(col.name).toLowerCase() === 'literal') {
      record[col.name] = col.const ?? tableName;
      continue;
    }

    if (col.default !== undefined) {
      record[col.name] = normalizeDefaultValue(col, col.default);
      continue;
    }

    record[col.name] = '';
  }

  return record;
}

export function inferIdField(schema: TableSchema): 'ID' | 'Node ID' | null {
  const names = new Set((schema.columns ?? []).map((c) => c.name));
  if (names.has('ID')) return 'ID';
  if (names.has('Node ID')) return 'Node ID';
  return null;
}

export function nextNumericId(rows: Array<Record<string, unknown>>, field: 'ID' | 'Node ID'): number {
  let max = 0;
  for (const row of rows) {
    const n = Number(row[field]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max + 1;
}

export function nextGlobalNumericId(data: SchemaData): number {
  let max = 0;
  for (const tableRows of Object.values(data)) {
    if (!Array.isArray(tableRows)) continue;
    for (const row of tableRows as Array<Record<string, unknown>>) {
      const nodeId = Number(row['Node ID']);
      if (Number.isFinite(nodeId)) max = Math.max(max, nodeId);
      const id = Number(row.ID);
      if (Number.isFinite(id)) max = Math.max(max, id);
    }
  }
  return max + 1;
}

export function nextNumericIdInRange(
  rows: Array<Record<string, unknown>>,
  field: 'ID' | 'Node ID',
  startInclusive: number,
  endInclusive: number,
): number | null {
  const start = Math.trunc(startInclusive);
  const end = Math.trunc(endInclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) return null;

  const used = new Set<number>();
  for (const row of rows) {
    const n = Number(row[field]);
    if (!Number.isFinite(n)) continue;
    if (n < start || n > end) continue;
    used.add(Math.trunc(n));
  }

  for (let id = start; id <= end; id += 1) {
    if (!used.has(id)) return id;
  }
  return null;
}
