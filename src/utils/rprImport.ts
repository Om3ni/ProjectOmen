import type { SchemaData, SchemaStructure, TableSchema } from '@/models/schema';

const DEFAULT_IGNORED = new Set([
  'DiceConfig',
  'DiceRules',
  'Gear',
  'Mechanic',
  'Megascope',
  'MechanicCondition',
]);

function orderedColumns(schema: TableSchema) {
  return [...schema.columns].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function toTf(value: string): 't' | 'f' {
  const v = value.trim().toLowerCase();
  if (v === 't' || v === 'true' || v === '1' || v === 'yes' || v === 'y') return 't';
  return 'f';
}

function parseNumberMaybe(text: string): number | string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : text;
}

function parseCell(raw: string, type: string): unknown {
  const text = raw ?? '';
  const t = type || 'string';

  switch (t) {
    case 'int': {
      const n = Number.parseInt(text, 10);
      return Number.isFinite(n) ? n : 0;
    }
    case 'float':
    case 'float_or_int':
    case 'int_or_float': {
      const n = Number.parseFloat(text);
      return Number.isFinite(n) ? n : 0;
    }
    case 'bool_tf':
      return toTf(text);

    case 'char':
      return text;

    // common schema types we keep as strings
    case 'string':
    case 'string_or_empty':
    case 'string_or_id':
      return text;

    default:
      // Be permissive: many columns in the wider RPR ecosystem are numeric-ish.
      return parseNumberMaybe(text);
  }
}

function buildLiteralToTableMap(schema: SchemaStructure): Map<string, string> {
  const map = new Map<string, string>();

  for (const [tableName, tableSchema] of Object.entries(schema.tables ?? {})) {
    // Allow direct match by table name
    map.set(tableName, tableName);

    const cols = orderedColumns(tableSchema);
    const first = cols[0] as unknown;
    if (first && typeof first === 'object' && 'const' in first) {
      const v = (first as { const?: unknown }).const;
      if (typeof v === 'string') map.set(v, tableName);
    }
  }

  return map;
}

function parseLine(schema: TableSchema, literalToken: string, fields: string[]): Record<string, unknown> {
  const cols = orderedColumns(schema);
  const first = cols[0] as unknown;

  // If first column is a const literal matching the line token, the token is not part of fields.
  const hasConstLiteral =
    !!first &&
    typeof first === 'object' &&
    'const' in first &&
    typeof (first as { const?: unknown }).const === 'string' &&
    String((first as { const?: unknown }).const) === literalToken;

  // Legacy/raw format always begins each line with a table token.
  // When a table does NOT have a const literal as its first column, treat that token as column 0.
  const effectiveFields = hasConstLiteral ? fields : [literalToken, ...fields];
  const startColIndex = hasConstLiteral ? 1 : 0;
  const row: Record<string, unknown> = {};

  for (let colIdx = startColIndex; colIdx < cols.length; colIdx++) {
    const col = cols[colIdx];
    const fieldIdx = colIdx - startColIndex;
    row[col.name] = parseCell(effectiveFields[fieldIdx] ?? '', col.type);
  }

  return row;
}

export function parseRprTextToSchemaData(
  schema: SchemaStructure,
  text: string,
  ignoredTokens: Set<string> = DEFAULT_IGNORED,
): SchemaData {
  const literalMap = buildLiteralToTableMap(schema);
  const next: SchemaData = {};

  // Legacy UX allows pasting as one long line; it inserts newlines before any known token+pipe.
  let normalized = String(text ?? '').trim();
  const newlineCount = (normalized.match(/\r?\n/g) || []).length;
  if (newlineCount < 2) {
    const tokens = Array.from(literalMap.keys())
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((t) => t.length > 0);
    if (tokens.length) {
      const re = new RegExp(`(?!^)\\b(${tokens.join('|')})\\|`, 'g');
      normalized = normalized.replace(re, '\n$1|').trim();
    }
  }

  const lines = normalized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const parts = line.split('|');
    const token = parts[0]?.trim();
    if (!token) continue;

    if (ignoredTokens.has(token)) continue;

    const tableName = literalMap.get(token);
    if (!tableName) {
      // Unknown table: ignore
      continue;
    }

    const tableSchema = schema.tables?.[tableName];
    if (!tableSchema) continue;

    const row = parseLine(tableSchema, token, parts.slice(1));

    // Track original file order so we can re-export in EXACTLY the same line order.
    // This is intentionally not part of the schema columns so it won't serialize as a cell.
    (row as Record<string, unknown>).__rprOrder = i;

    const arr = Array.isArray(next[tableName]) ? (next[tableName] as Array<Record<string, unknown>>) : [];
    arr.push(row);
    next[tableName] = arr;
  }

  // Auto-create parent records for orphaned children
  autoCreateParentRecords(schema, next);

  // Validate imported data structure
  validateImportedData(schema, next, lines);

  // Validate that we actually parsed something
  const totalRows = Object.values(next).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  if (totalRows === 0 && lines.length > 0) {
    throw new Error(
      `No valid records found. Make sure the text is in RPR pipe format (e.g., "TableName|field1|field2|..."). ` +
        `Found ${lines.length} line(s) but none matched known tables.`,
    );
  }

  return next;
}

/**
 * Child table → Parent table mapping with their FK and parent ID field
 */
const CHILD_PARENT_MAP: Record<string, { parentTable: string; fk: string; parentIdField: string }> = {
  RuneAction: { parentTable: 'RuneDef', fk: 'RuneID', parentIdField: 'ID' },
  RuneCondition: { parentTable: 'RuneDef', fk: 'RuneID', parentIdField: 'ID' },
  PerkAction: { parentTable: 'PerkDef', fk: 'PerkID', parentIdField: 'ID' },
  StatusAction: { parentTable: 'StatusDef', fk: 'StatusID', parentIdField: 'ID' },
  MutatorAction: { parentTable: 'MutatorDef', fk: 'MutatorID', parentIdField: 'ID' },
  MutatorCondition: { parentTable: 'MutatorDef', fk: 'MutatorID', parentIdField: 'ID' },
  SpellEffect: { parentTable: 'SpellDef', fk: 'SpellID', parentIdField: 'ID' },
  SpellReqDef: { parentTable: 'SpellDef', fk: 'SpellID', parentIdField: 'ID' },
  SpellTargetCond: { parentTable: 'SpellDef', fk: 'SpellID', parentIdField: 'ID' },
};

/**
 * Expected table order for validation
 */
const EXPECTED_TABLE_ORDER: string[] = [
  'SkillDef',
  'PerkDef',
  'RuneDef',
  'Stat',
  'SpellDef',
  'MutatorDef',
  'StatusDef',
];

/**
 * Validate imported data structure.
 * Checks for common issues that would cause game import failures.
 */
function validateImportedData(schema: SchemaStructure, data: SchemaData, lines: string[]): void {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Build a map of which line each table first appears and track all occurrences
  const tableFirstLine: Record<string, number> = {};
  const tableAllLines: Record<string, number[]> = {};
  const literalMap = buildLiteralToTableMap(schema);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const token = line.split('|')[0]?.trim();
    if (!token) continue;
    
    const tableName = literalMap.get(token);
    if (tableName) {
      if (!tableFirstLine[tableName]) {
        tableFirstLine[tableName] = i + 1; // 1-based line numbers
      }
      if (!tableAllLines[tableName]) {
        tableAllLines[tableName] = [];
      }
      tableAllLines[tableName].push(i + 1);
    }
  }
  
  // Check table order - main parent tables should appear in sequence
  const presentTables = EXPECTED_TABLE_ORDER.filter(t => tableFirstLine[t] !== undefined);
  for (let i = 0; i < presentTables.length - 1; i++) {
    const current = presentTables[i];
    const next = presentTables[i + 1];
    const currentLine = tableFirstLine[current];
    const nextLine = tableFirstLine[next];
    
    if (currentLine > nextLine) {
      errors.push(
        `Table order violation: ${current} appears at line ${currentLine}, ` +
        `but ${next} appears earlier at line ${nextLine}. ` +
        `Expected order: ${EXPECTED_TABLE_ORDER.join(' → ')}`
      );
    }
  }
  
  // Check if tables are interleaved (not grouped together)
  // Also check that main parent tables don't appear after their section has ended
  for (const tableName of EXPECTED_TABLE_ORDER) {
    const allLines = tableAllLines[tableName];
    if (!allLines || allLines.length <= 1) continue;
    
    // Check if there's ANY gap with another main table appearing in between
    for (let i = 0; i < allLines.length - 1; i++) {
      const startLine = allLines[i];
      const endLine = allLines[i + 1];
      
      // Check if any other main table appears in this gap
      for (const otherTable of EXPECTED_TABLE_ORDER) {
        if (otherTable === tableName) continue;
        const otherLines = tableAllLines[otherTable] || [];
        const inBetween = otherLines.filter(l => l > startLine && l < endLine);
        if (inBetween.length > 0) {
          errors.push(
            `${tableName} records are not grouped together. Found ${tableName} at line ${startLine}, ` +
            `then ${otherTable} at line ${inBetween[0]}, then ${tableName} again at line ${endLine}. ` +
            `All records of the same type must be grouped together.`
          );
          break;
        }
      }
    }
  }
  
  // Check that no main table appears after a later table in the sequence has started
  for (let i = 0; i < EXPECTED_TABLE_ORDER.length; i++) {
    const currentTable = EXPECTED_TABLE_ORDER[i];
    const currentLines = tableAllLines[currentTable];
    if (!currentLines) continue;
    
    // Check all tables that should come after this one
    for (let j = i + 1; j < EXPECTED_TABLE_ORDER.length; j++) {
      const laterTable = EXPECTED_TABLE_ORDER[j];
      const laterLines = tableAllLines[laterTable];
      if (!laterLines) continue;
      
      const laterFirstLine = laterLines[0];
      // Find any current table lines that come after the later table started
      const violatingLines = currentLines.filter(l => l > laterFirstLine);
      if (violatingLines.length > 0) {
        errors.push(
          `Table order violation: ${currentTable} appears at line ${violatingLines[0]} ` +
          `AFTER ${laterTable} has already started at line ${laterFirstLine}. ` +
          `All ${currentTable} records must appear before any ${laterTable} records.`
        );
        break;
      }
    }
  }
  
  // Check for orphaned children appearing before their parents
  for (const [childTable, mapping] of Object.entries(CHILD_PARENT_MAP)) {
    const childRows = Array.isArray(data[childTable]) ? (data[childTable] as Array<Record<string, unknown>>) : [];
    if (!childRows.length) continue;
    
    const parentRows = Array.isArray(data[mapping.parentTable]) 
      ? (data[mapping.parentTable] as Array<Record<string, unknown>>) 
      : [];
    
    // Build map of parent line numbers
    const parentLineMap = new Map<string, number>();
    for (const parent of parentRows) {
      const id = String(parent['ID'] ?? parent['Node ID']);
      const order = Number((parent as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
      if (id && Number.isFinite(order)) {
        parentLineMap.set(id, order + 1); // 1-based
      }
    }
    
    // Check each child
    for (const child of childRows) {
      const parentId = String(child[mapping.fk] ?? '');
      const childOrder = Number((child as Record<string, unknown> & { __rprOrder?: unknown }).__rprOrder);
      const childLine = Number.isFinite(childOrder) ? childOrder + 1 : 0;
      
      if (!parentId || parentId === 'undefined' || parentId === 'null') {
        warnings.push(
          `${childTable} at line ${childLine} has no ${mapping.fk}. ` +
          `It will not be linked to any parent.`
        );
      } else {
        const parentLine = parentLineMap.get(parentId);
        if (!parentLine) {
          errors.push(
            `${childTable} at line ${childLine} references ${mapping.parentTable} ID ${parentId}, ` +
            `but no such parent exists in the file.`
          );
        } else if (childLine < parentLine) {
          errors.push(
            `${childTable} at line ${childLine} appears BEFORE its parent ${mapping.parentTable} ` +
            `ID ${parentId} at line ${parentLine}. Children must come after their parents.`
          );
        }
      }
    }
  }
  
  // Report errors
  if (errors.length > 0) {
    throw new Error(
      'Import validation failed. The file has structural issues that will cause problems in the game:\n\n' +
      errors.map((e, i) => `${i + 1}. ${e}`).join('\n\n') +
      '\n\nPlease fix these issues in the source file and try importing again.'
    );
  }
  
  // Report warnings (non-fatal)
  if (warnings.length > 0) {
    console.warn(
      'Import warnings (file was imported but may have issues):\n' +
      warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')
    );
  }
}

/**
 * Automatically create parent records for child records that reference non-existent parents.
 */
function autoCreateParentRecords(schema: SchemaStructure, data: SchemaData): void {
  for (const [childTable, mapping] of Object.entries(CHILD_PARENT_MAP)) {
    const childRows = Array.isArray(data[childTable]) ? (data[childTable] as Array<Record<string, unknown>>) : [];
    if (!childRows.length) continue;

    const parentTable = mapping.parentTable;
    const parentSchema = schema.tables?.[parentTable];
    if (!parentSchema) continue;

    const parentRows = Array.isArray(data[parentTable]) ? (data[parentTable] as Array<Record<string, unknown>>) : [];
    const existingParentIds = new Set(parentRows.map((r) => Number(r[mapping.parentIdField])));

    // Find all unique parent IDs referenced by children that don't exist
    const neededParentIds = new Set<number>();
    for (const child of childRows) {
      const parentId = Number(child[mapping.fk]);
      if (Number.isFinite(parentId) && parentId > 0 && !existingParentIds.has(parentId)) {
        neededParentIds.add(parentId);
      }
    }

    // Create placeholder parent records for each missing ID
    if (neededParentIds.size > 0) {
      const newParents: Array<Record<string, unknown>> = [];
      for (const parentId of neededParentIds) {
        const parent = createMinimalParentRecord(parentSchema, mapping.parentIdField, parentId, parentTable);
        newParents.push(parent);
      }
      data[parentTable] = [...parentRows, ...newParents];
    }
  }
}

/**
 * Create a minimal parent record with defaults and the specified ID.
 */
function createMinimalParentRecord(
  schema: TableSchema,
  idField: string,
  idValue: number,
  tableName: string,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const cols = [...schema.columns].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const col of cols) {
    if (col.const !== undefined) {
      record[col.name] = col.const;
    } else if (col.default !== undefined) {
      record[col.name] = col.default;
    } else {
      // Provide sensible defaults based on type
      switch (col.type) {
        case 'int':
        case 'float':
        case 'float_or_int':
        case 'int_or_float':
          record[col.name] = 0;
          break;
        case 'bool_tf':
          record[col.name] = 'f';
          break;
        default:
          record[col.name] = '';
      }
    }
  }

  // Set the ID
  record[idField] = idValue;

  // Set a placeholder name
  const singularNames: Record<string, string> = {
    RuneDef: 'Rune',
    PerkDef: 'Perk',
    StatusDef: 'Status',
    MutatorDef: 'Mutator',
    SpellDef: 'Ability',
  };
  const singular = singularNames[tableName] ?? tableName.replace(/Def$/, '');
  if ('Name' in record || schema.columns.some((c) => c.name === 'Name')) {
    record.Name = `${singular} ${idValue}`;
  }

  return record;
}
