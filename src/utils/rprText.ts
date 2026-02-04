import type { SchemaData, SchemaStructure, TableSchema } from '@/models/schema';

function orderedColumns(schema: TableSchema) {
  return [...(schema.columns ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/**
 * Stringify a cell value, respecting column type for proper formatting.
 * float_or_int and int_or_float types always output with decimal (e.g., 0.0, 1.0)
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

function inferToken(tableName: string, tableSchema: TableSchema): string {
  const cols = orderedColumns(tableSchema);
  const first = cols[0] as unknown;
  if (first && typeof first === 'object' && 'const' in first) {
    const v = (first as { const?: unknown }).const;
    if (typeof v === 'string' && v.trim()) return v;
  }
  return tableName;
}

/**
 * The canonical table order expected by the game.
 * Parent tables are followed by their child tables.
 * Order: DiceConfig -> DiceRules -> Gear -> SkillDef -> PerkDef+children -> Rune+children -> Stat -> SpellDef+children -> MutatorDef+children -> StatusDef+children
 */
const TABLE_ORDER: string[] = [
  'DiceConfig',     // Single-row config table
  'DiceRules',      // Single-row rules table
  'Gear',           // Single-row gear table
  'SkillDef',       // Attributes (TypeFlag=t) and Skills (TypeFlag=f)
  'PerkDef',        // Perks with PerkAction children interleaved
  'RuneDef',        // Runes with RuneCondition/RuneAction children interleaved
  'Stat',           // Stats (no children)
  'SpellDef',       // Abilities with SpellReqDef/SpellTargetCond/SpellEffect children interleaved
  'MutatorDef',     // Mutators with MutatorCondition/MutatorAction children interleaved
  'StatusDef',      // Statuses with StatusAction children interleaved
];

/**
 * Map child tables to their parent table and foreign key field.
 */
const CHILD_TO_PARENT: Record<string, { parentTable: string; fk: string }> = {
  PerkAction: { parentTable: 'PerkDef', fk: 'PerkID' },
  RuneCondition: { parentTable: 'RuneDef', fk: 'RuneID' },
  RuneAction: { parentTable: 'RuneDef', fk: 'RuneID' },
  StatusAction: { parentTable: 'StatusDef', fk: 'StatusID' },
  MutatorCondition: { parentTable: 'MutatorDef', fk: 'MutatorID' },
  MutatorAction: { parentTable: 'MutatorDef', fk: 'MutatorID' },
  SpellReqDef: { parentTable: 'SpellDef', fk: 'SpellID' },
  SpellTargetCond: { parentTable: 'SpellDef', fk: 'SpellID' },
  SpellEffect: { parentTable: 'SpellDef', fk: 'SpellID' },
};

/**
 * Order of child tables when emitting children after a parent.
 */
const CHILD_TABLE_ORDER: Record<string, string[]> = {
  PerkDef: ['PerkAction'],
  RuneDef: ['RuneCondition', 'RuneAction'],
  SpellDef: ['SpellReqDef', 'SpellTargetCond', 'SpellEffect'],
  MutatorDef: ['MutatorCondition', 'MutatorAction'],
  StatusDef: ['StatusAction'],
};

/**
 * Validate data structure before export.
 * Throws detailed error if data has issues that would cause game import failures.
 */
function validateDataForExport(_schema: SchemaStructure, data: SchemaData): void {
  const errors: string[] = [];
  
  // Check for orphaned child records (child without parent)
  for (const [childTable, mapping] of Object.entries(CHILD_TO_PARENT)) {
    const childRows = Array.isArray(data[childTable]) ? (data[childTable] as Array<Record<string, unknown>>) : [];
    if (!childRows.length) continue;
    
    const parentRows = Array.isArray(data[mapping.parentTable]) 
      ? (data[mapping.parentTable] as Array<Record<string, unknown>>) 
      : [];
    
    const parentIds = new Set(parentRows.map(r => String(r['ID'] ?? r['Node ID'])));
    
    for (const childRow of childRows) {
      const parentId = String(childRow[mapping.fk] ?? '');
      if (!parentId || parentId === 'undefined' || parentId === 'null') {
        errors.push(
          `${childTable} record has no ${mapping.fk} (parent reference). ` +
          `This child record will not be linked to any parent in the game.`
        );
      } else if (!parentIds.has(parentId)) {
        errors.push(
          `${childTable} record references ${mapping.parentTable} ID ${parentId}, but no such parent exists. ` +
          `This orphaned child will cause issues in the game.`
        );
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(
      'Data validation failed. The following issues must be fixed before export:\n\n' +
      errors.map((e, i) => `${i + 1}. ${e}`).join('\n\n') +
      '\n\nPlease fix these issues and try again.'
    );
  }
}

export function exportSchemaDataToRprText(
  schema: SchemaStructure,
  data: SchemaData,
  options?: {
    includeTables?: Set<string>;
    filterRow?: (tableName: string, row: Record<string, unknown>) => boolean;
    skipValidation?: boolean;  // Allow skipping validation for testing
  },
): string {
  const includeTables = options?.includeTables;
  const filterRow = options?.filterRow;
  const skipValidation = options?.skipValidation ?? false;

  // Validate data structure before export
  if (!skipValidation) {
    validateDataForExport(schema, data);
  }

  const lines: string[] = [];

  const emitRow = (tableName: string, tableSchema: TableSchema, row: Record<string, unknown>) => {
    const cols = orderedColumns(tableSchema);
    const token = inferToken(tableName, tableSchema);

    const parts: string[] = [];
    parts.push(token);
    for (let i = 1; i < cols.length; i += 1) {
      parts.push(stringifyCell(row[cols[i].name], cols[i].type));
    }
    lines.push(parts.join('|'));
  };

  // Build a set of tables that have child relationships
  const parentTables = new Set(Object.values(CHILD_TO_PARENT).map(c => c.parentTable));
  
  // Group child rows by their parent ID for quick lookup
  const childRowsByParent: Record<string, Record<string | number, Array<Record<string, unknown>>>> = {};
  for (const [childTable, mapping] of Object.entries(CHILD_TO_PARENT)) {
    if (includeTables && !includeTables.has(childTable)) continue;
    const childRows = Array.isArray(data[childTable]) ? (data[childTable] as Array<Record<string, unknown>>) : [];
    if (!childRows.length) continue;
    
    if (!childRowsByParent[childTable]) {
      childRowsByParent[childTable] = {};
    }
    
    for (const row of childRows) {
      if (filterRow && !filterRow(childTable, row)) continue;
      const parentId = row[mapping.fk];
      if (parentId === undefined || parentId === null) continue;
      const key = String(parentId);
      if (!childRowsByParent[childTable][key]) {
        childRowsByParent[childTable][key] = [];
      }
      childRowsByParent[childTable][key].push(row);
    }
  }

  // Get child tables for a parent table in the correct order
  const getChildTables = (parentTable: string): string[] => {
    return CHILD_TABLE_ORDER[parentTable] ?? [];
  };

  // Emit a parent row and all its children
  const emitParentWithChildren = (parentTable: string, parentRow: Record<string, unknown>) => {
    const parentSchema = schema.tables?.[parentTable];
    if (!parentSchema) return;
    
    emitRow(parentTable, parentSchema, parentRow);
    
    // Emit children grouped by child table type, in order
    const childTables = getChildTables(parentTable);
    const parentId = parentRow['ID'] ?? parentRow['Node ID'];
    if (parentId === undefined || parentId === null) return;
    
    const parentIdKey = String(parentId);
    for (const childTable of childTables) {
      const childSchema = schema.tables?.[childTable];
      if (!childSchema) continue;
      
      const children = childRowsByParent[childTable]?.[parentIdKey] ?? [];
      for (const childRow of children) {
        emitRow(childTable, childSchema, childRow);
      }
    }
  };

  // Process tables in canonical order
  const processedChildTables = new Set<string>();
  
  for (const tableName of TABLE_ORDER) {
    if (includeTables && !includeTables.has(tableName)) continue;
    
    // Skip child tables - they're emitted with their parents
    if (CHILD_TO_PARENT[tableName]) {
      processedChildTables.add(tableName);
      continue;
    }
    
    const tableSchema = schema.tables?.[tableName];
    if (!tableSchema) continue;
    
    const rows = Array.isArray(data[tableName]) ? (data[tableName] as Array<Record<string, unknown>>) : [];
    if (!rows.length) continue;
    
    // Check if this is a parent table with children
    if (parentTables.has(tableName)) {
      for (const row of rows) {
        if (filterRow && !filterRow(tableName, row)) continue;
        emitParentWithChildren(tableName, row);
      }
    } else {
      // Regular table without children
      for (const row of rows) {
        if (filterRow && !filterRow(tableName, row)) continue;
        emitRow(tableName, tableSchema, row);
      }
    }
  }
  
  // Handle any tables not in TABLE_ORDER (fallback)
  // Skip child tables - they were already emitted with their parents
  const orderedTableSet = new Set(TABLE_ORDER);
  const childTableSet = new Set(Object.keys(CHILD_TO_PARENT));
  for (const [tableName, tableSchema] of Object.entries(schema.tables ?? {})) {
    if (orderedTableSet.has(tableName)) continue;
    if (childTableSet.has(tableName)) continue;  // Skip child tables
    if (includeTables && !includeTables.has(tableName)) continue;
    
    const rows = Array.isArray(data[tableName]) ? (data[tableName] as Array<Record<string, unknown>>) : [];
    if (!rows.length) continue;
    
    for (const row of rows) {
      if (filterRow && !filterRow(tableName, row)) continue;
      emitRow(tableName, tableSchema, row);
    }
  }

  return lines.join('\n').trimEnd();
}

function stripRowPrefix(line: string): string {
  // Allow pasting from the preview format like: "12\tSkillDef|..."
  return line.replace(/^\s*\d+\s*\t/, '').trimEnd();
}

export function rprPreviewWithNumbers(text: string): string {
  const lines = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const numbered = lines.map((l, i) => `${i + 1}\t${l}`);
  return numbered.join('\n').trimEnd();
}

export function stripRprPreviewPrefixes(text: string): string {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => stripRowPrefix(l.trimEnd()))
    .join('\n')
    .trimEnd();
}
