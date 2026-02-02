import type { SchemaColumn, TableSchema } from '@/models/schema';

function orderedColumns(schema: TableSchema): SchemaColumn[] {
  const cols = Array.isArray(schema.columns) ? schema.columns : [];
  return [...cols].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function toTf(value: string): 't' | 'f' {
  const v = value.trim().toLowerCase();
  if (v === 't' || v === 'true' || v === '1' || v === 'yes' || v === 'y') return 't';
  return 'f';
}

function parseCell(raw: string, type: string): unknown {
  const text = raw ?? '';
  const t = type || 'string';

  if (t === 'int') {
    const n = Number.parseInt(text, 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (t === 'float_or_int') {
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? n : 0;
  }
  if (t === 'bool_tf') {
    return toTf(text);
  }

  // string-ish types
  return text;
}

/**
 * Stringify a cell value, respecting column type for proper formatting.
 * float_or_int types always output with decimal (e.g., 0.0, 1.0)
 */
function stringifyCell(value: unknown, colType?: string): string {
  if (value === undefined || value === null) return '';
  
  const t = (colType ?? '').toLowerCase();
  
  // For float types, ensure decimal format
  if (t === 'float_or_int' || t === 'int_or_float' || t === 'float') {
    const num = Number(value);
    if (Number.isFinite(num)) {
      // If it's a whole number, add .0
      if (Number.isInteger(num)) {
        return `${num}.0`;
      }
      return String(num);
    }
    return String(value);
  }
  
  return String(value);
}

export function exportRowsToPipe(tableSchema: TableSchema, rows: Array<Record<string, unknown>>): string {
  const cols = orderedColumns(tableSchema);
  return rows
    .map((row) => cols.map((c) => stringifyCell(row[c.name], c.type)).join('|'))
    .join('\n');
}

function stripRowPrefix(line: string): string {
  // Allow pasting from the preview format like: "12\tfoo|bar|..."
  return line.replace(/^\s*\d+\s*\t/, '').trimEnd();
}

export function parsePipeToRows(tableSchema: TableSchema, text: string): Array<Record<string, unknown>> {
  const cols = orderedColumns(tableSchema);
  const lines = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => stripRowPrefix(l.trimEnd()))
    .filter((l) => l.trim().length > 0);

  return lines.map((line) => {
    const parts = line.split('|');
    const row: Record<string, unknown> = {};
    cols.forEach((c, idx) => {
      row[c.name] = parseCell(parts[idx] ?? '', c.type);
    });
    return row;
  });
}

export function pipePreviewWithNumbers(tableSchema: TableSchema, text: string): string {
  const cols = orderedColumns(tableSchema);
  const header = cols.map((c, i) => `[${i + 1}]${c.name}`).join('|');
  const lines = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const numbered = lines.map((l, i) => `${i + 1}\t${l}`);
  return `#\t${header}\n${numbered.join('\n')}`.trimEnd();
}
