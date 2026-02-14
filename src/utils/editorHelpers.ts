import type { SchemaData } from '@/models/schema';

export function toSafeNonNegativeInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

export function maxNumericIdInData(data: SchemaData): number {
  let max = 0;
  for (const tableRows of Object.values(data)) {
    if (!Array.isArray(tableRows)) continue;
    for (const row of tableRows as Array<Record<string, unknown>>) {
      const nodeId = Number(row?.['Node ID']);
      if (Number.isFinite(nodeId)) max = Math.max(max, nodeId);
      const id = Number(row?.ID);
      if (Number.isFinite(id)) max = Math.max(max, id);
    }
  }
  return toSafeNonNegativeInt(max);
}

export function allocateNextNodeId(data: SchemaData): { id: number; nextData: SchemaData } {
  const maxExisting = maxNumericIdInData(data);
  const diceConfigRows = Array.isArray(data.DiceConfig)
    ? (data.DiceConfig as Array<Record<string, unknown>>)
    : [];
  const diceConfig = diceConfigRows[0];

  // Base comes from DiceConfig.TotalNodes (includes deleted nodes), but never allow it
  // to fall behind what's actually in the file.
  const base = Math.max(toSafeNonNegativeInt(diceConfig?.TotalNodes), maxExisting);
  const nextId = base + 1;

  if (!diceConfig) {
    return { id: nextId, nextData: data };
  }

  const nextDiceConfig = { ...diceConfig, TotalNodes: nextId };
  return {
    id: nextId,
    nextData: {
      ...data,
      DiceConfig: [nextDiceConfig, ...diceConfigRows.slice(1)],
    },
  };
}

export function asRows(data: SchemaData | null, table: string): Array<Record<string, unknown>> {
  const raw = data?.[table];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export function inferLabel(row: Record<string, unknown>): string {
  const candidates = ['Name', 'Literal', 'ID', 'Node ID'];
  for (const key of candidates) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '(unnamed)';
}
