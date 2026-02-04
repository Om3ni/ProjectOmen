import type { SchemaData, SchemaStructure } from '@/models/schema';
import { CHILDREN_BY_PARENT } from '@/components/childrenConfigs';

type Category =
  | 'Attributes'
  | 'Skills'
  | 'Perks'
  | 'Stats'
  | 'Runes'
  | 'Statuses'
  | 'Mutators'
  | 'Abilities';

type CategoryView = {
  category: Category;
  table: string;
  filter?: (row: Record<string, unknown>) => boolean;
};

const CATEGORY_VIEWS: CategoryView[] = [
  {
    category: 'Attributes',
    table: 'SkillDef',
    filter: (row) => String(row.TypeFlag ?? 'f').toLowerCase() === 't',
  },
  {
    category: 'Skills',
    table: 'SkillDef',
    filter: (row) => String(row.TypeFlag ?? 'f').toLowerCase() === 'f',
  },
  { category: 'Perks', table: 'PerkDef' },
  { category: 'Stats', table: 'Stat' },
  { category: 'Runes', table: 'RuneDef' },
  { category: 'Statuses', table: 'StatusDef' },
  { category: 'Mutators', table: 'MutatorDef' },
  { category: 'Abilities', table: 'SpellDef' },
];

function asRows(data: SchemaData, table: string): Array<Record<string, unknown>> {
  const raw = data[table];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function inferIdField(tableName: string, schema: SchemaStructure): string | null {
  const t = schema.tables?.[tableName];
  if (!t) return null;
  const names = t.columns.map((c) => c.name);
  if (names.includes('Node ID')) return 'Node ID';
  if (names.includes('ID')) return 'ID';
  return null;
}

function numericId(row: Record<string, unknown>, field: string): number | null {
  const n = Number(row[field]);
  return Number.isFinite(n) ? n : null;
}

function sortKey(row: Record<string, unknown>, field: string): [number, string] {
  const id = numericId(row, field);
  const name = String(row.Name ?? '').toLowerCase();
  return [id ?? Number.MAX_SAFE_INTEGER, name];
}

function buildIdMap(
  rows: Array<Record<string, unknown>>,
  idField: string,
  start: number,
): { map: Map<number, number>; nextRows: Array<Record<string, unknown>> } {
  const items = rows.map((r) => ({ row: r, old: numericId(r, idField) }));
  items.sort((a, b) => {
    const ak = sortKey(a.row, idField);
    const bk = sortKey(b.row, idField);
    if (ak[0] !== bk[0]) return ak[0] - bk[0];
    return ak[1].localeCompare(bk[1]);
  });

  const map = new Map<number, number>();
  const nextRows = items.map((it, idx) => {
    const nextId = start + idx;
    if (it.old !== null) map.set(it.old, nextId);
    return { ...it.row, [idField]: nextId };
  });

  return { map, nextRows };
}

function remapFormulaText(text: unknown, attrIdMap: Map<number, number>): string {
  const raw = String(text ?? '').trim();
  if (!raw) return '';

  // format: "2*1.0;1*0.5" etc
  return raw
    .split(/\s*;\s*/)
    .map((part) => {
      const p = part.trim();
      if (!p) return '';
      const [idPart, multPart] = p.split('*');
      const oldId = Number(String(idPart ?? '').trim());
      const mapped = Number.isFinite(oldId) ? attrIdMap.get(oldId) : undefined;
      if (mapped === undefined) return p;
      const mult = multPart === undefined ? '1.0' : String(multPart).trim();
      return `${mapped}*${mult}`;
    })
    .filter(Boolean)
    .join(';');
}

function remapChildForeignKeys(
  data: SchemaData,
  parentTable: string,
  parentIdMap: Map<number, number>,
): SchemaData {
  const children = CHILDREN_BY_PARENT[parentTable] ?? [];
  if (!children.length) return data;

  const next: SchemaData = { ...data };
  for (const child of children) {
    const rows = asRows(next, child.table);
    next[child.table] = rows.map((r) => {
      const old = Number(r[child.fk]);
      const mapped = Number.isFinite(old) ? parentIdMap.get(old) : undefined;
      if (mapped === undefined) return r;
      return { ...r, [child.fk]: mapped };
    });
  }
  return next;
}

export function normalizeDataToRanges(schema: SchemaStructure, data: SchemaData): SchemaData {
  let nextData: SchemaData = { ...data };

  let nextIdStart = 1;

  // 1) SkillDef: Attributes then Skills (same table) — normalize into a single global 1..N sequence.
  const skillTable = 'SkillDef';
  const skillSchema = schema.tables?.[skillTable];
  if (skillSchema) {
    const idField = inferIdField(skillTable, schema);
    if (idField) {
      const all = asRows(nextData, skillTable);
      const attrs = all.filter((r) => String(r.TypeFlag ?? 'f').toLowerCase() === 't');
      const skills = all.filter((r) => String(r.TypeFlag ?? 'f').toLowerCase() === 'f');

      const { map: attrMap, nextRows: nextAttrs } = buildIdMap(attrs, idField, nextIdStart);
      nextIdStart += nextAttrs.length;
      const { map: skillMap, nextRows: nextSkills } = buildIdMap(skills, idField, nextIdStart);
      nextIdStart += nextSkills.length;

      const combined = new Map<number, Record<string, unknown>>();
      for (const r of nextAttrs) combined.set(Number(r[idField]), r);
      for (const r of nextSkills) combined.set(Number(r[idField]), r);

      // Preserve table order: replace within original list
      nextData[skillTable] = all.map((r) => {
        const oldId = numericId(r, idField);
        const mappedId = oldId !== null ? (String(r.TypeFlag ?? 'f').toLowerCase() === 't' ? attrMap.get(oldId) : skillMap.get(oldId)) : undefined;
        if (mappedId === undefined) return r;
        return combined.get(mappedId) ?? r;
      });

      // Remap formulas that refer to attribute IDs
      nextData[skillTable] = asRows(nextData, skillTable).map((r) => {
        if (typeof r['Bonus Source'] !== 'string' && r['Bonus Source'] !== undefined && r['Bonus Source'] !== null) return r;
        const nextText = remapFormulaText(r['Bonus Source'], attrMap);
        if (nextText === String(r['Bonus Source'] ?? '')) return r;
        return { ...r, ['Bonus Source']: nextText };
      });

      const statRows = asRows(nextData, 'Stat');
      if (statRows.length) {
        nextData.Stat = statRows.map((r) => {
          const nextText = remapFormulaText(r.Formula, attrMap);
          if (nextText === String(r.Formula ?? '')) return r;
          return { ...r, Formula: nextText };
        });
      }
    }
  }

  // 2) Other parent tables — keep the global sequence running and update known child foreign keys
  const normalizeParents: Array<{ category: Category; table: string }> = [
    { category: 'Perks', table: 'PerkDef' },
    { category: 'Runes', table: 'RuneDef' },
    { category: 'Statuses', table: 'StatusDef' },
    { category: 'Mutators', table: 'MutatorDef' },
    { category: 'Abilities', table: 'SpellDef' },
    { category: 'Stats', table: 'Stat' },
  ];

  for (const item of normalizeParents) {
    const tableSchema = schema.tables?.[item.table];
    if (!tableSchema) continue;
    const idField = inferIdField(item.table, schema);
    if (!idField) continue;

    const rows = asRows(nextData, item.table);
    if (!rows.length) continue;

    // Normalize each table into the shared global 1..N ID space.
    const { map, nextRows } = buildIdMap(rows, idField, nextIdStart);
    nextIdStart += nextRows.length;
    nextData = { ...nextData, [item.table]: nextRows };

    // Update child FKs for known embedded relationships
    nextData = remapChildForeignKeys(nextData, item.table, map);
  }

  return nextData;
}

export function getCategoryViews(): CategoryView[] {
  return CATEGORY_VIEWS;
}
