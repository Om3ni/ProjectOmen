import type { FunctionHandler, OllamaFunction, OllamaContext } from '../types';
import { createDefaultRecord } from '@/utils/schemaDefaults';

/**
 * Schema manipulation functions — generic CRUD factory for all RPR tables.
 * Generates create/update/delete handlers from table config.
 */

// ─── Shared helpers ──────────────────────────────────────────────────

function allocateNextNodeId(data: Record<string, Array<Record<string, unknown>>>): {
  id: number;
  nextData: Record<string, Array<Record<string, unknown>>>;
} {
  let max = 0;
  for (const tableRows of Object.values(data)) {
    if (!Array.isArray(tableRows)) continue;
    for (const row of tableRows) {
      const nodeId = Number(row['Node ID']);
      if (Number.isFinite(nodeId)) max = Math.max(max, nodeId);
      const id = Number(row.ID);
      if (Number.isFinite(id)) max = Math.max(max, id);
    }
  }

  const diceConfigRows = data.DiceConfig || [];
  const diceConfig = diceConfigRows[0];
  const totalNodes = diceConfig ? Number(diceConfig.TotalNodes) : 0;
  const base = Math.max(totalNodes || 0, max);
  const nextId = base + 1;

  if (diceConfig) {
    const nextDiceConfig = { ...diceConfig, TotalNodes: nextId };
    return {
      id: nextId,
      nextData: {
        ...data,
        DiceConfig: [nextDiceConfig, ...diceConfigRows.slice(1)],
      },
    };
  }

  return { id: nextId, nextData: data };
}

function applyDataUpdate(context: OllamaContext, nextData: Record<string, unknown>): void {
  if (context.updateEditorData) {
    context.updateEditorData(nextData);
  } else if (context.editorState?.setData) {
    context.editorState.setData(nextData);
  } else {
    console.warn('[SchemaFunctions] No React setter available - direct mutation, UI may not update');
    context.editorState.data = nextData;
  }
}

// ─── Generic CRUD factory ────────────────────────────────────────────

interface TableCrudConfig {
  tableName: string;
  idField: 'ID' | 'Node ID';
  nameField?: string;
  parentFk?: string;
  childTables?: Array<{ table: string; fkField: string }>;
  needsGlobalId?: boolean;
}

function makeTableCrud(config: TableCrudConfig): {
  create: FunctionHandler;
  update: FunctionHandler;
  delete: FunctionHandler;
} {
  const {
    tableName,
    idField,
    nameField,
    parentFk,
    childTables,
    needsGlobalId = !parentFk, // parent tables get global IDs by default
  } = config;

  const create: FunctionHandler = async (args, context) => {
    try {
      const { editorState, recentChangesHandler } = context;
      const { data: schemaData, schema: schemaStructure } = editorState;

      if (!schemaData || !schemaStructure) {
        return { success: false, error: 'Schema not loaded' };
      }

      const tableSchema = schemaStructure.tables?.[tableName];
      if (!tableSchema) {
        return { success: false, error: `${tableName} table not found in schema` };
      }

      const { fields, ...topLevelFields } = args;
      const mergeFields = (fields && typeof fields === 'object') ? fields : topLevelFields;

      let nextData = { ...schemaData } as Record<string, Array<Record<string, unknown>>>;
      let newId: number | undefined;

      if (needsGlobalId) {
        const alloc = allocateNextNodeId(schemaData);
        newId = alloc.id;
        nextData = alloc.nextData;
      }

      const newRecord = createDefaultRecord(tableName, tableSchema);

      if (newId !== undefined) {
        newRecord[idField] = newId;
      }

      // Merge provided fields
      for (const [key, val] of Object.entries(mergeFields)) {
        if (key === 'fields') continue; // skip nested fields key
        if (val !== undefined && val !== null) {
          newRecord[key] = val;
        }
      }

      // For child tables, ensure parent FK is set
      if (parentFk && mergeFields[parentFk] !== undefined) {
        newRecord[parentFk] = mergeFields[parentFk];
      }

      const tableRows = Array.isArray(nextData[tableName]) ? nextData[tableName] : [];
      nextData = {
        ...nextData,
        [tableName]: [...tableRows, newRecord],
      };

      applyDataUpdate(context, nextData);

      if (recentChangesHandler) {
        recentChangesHandler({
          type: 'create',
          table: tableName,
          data: newRecord,
          description: nameField ? String(newRecord[nameField] || tableName) : tableName,
        });
      }

      const result: Record<string, unknown> = {
        message: `Created ${tableName} record${newId ? ` with ${idField} ${newId}` : ''}`,
        record: newRecord,
      };
      if (newId !== undefined) result.id = newId;
      if (nameField && newRecord[nameField]) result.name = newRecord[nameField];

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };

  const update: FunctionHandler = async (args, context) => {
    try {
      const { editorState, recentChangesHandler } = context;
      const { data: schemaData } = editorState;

      if (!schemaData) {
        return { success: false, error: 'Schema not loaded' };
      }

      const { id, updates } = args;

      if (id === undefined || id === null || !Number.isFinite(Number(id))) {
        return { success: false, error: `Valid id is required (${idField} of the ${tableName} to update)` };
      }

      if (!updates || typeof updates !== 'object') {
        return { success: false, error: 'Updates object is required' };
      }

      const numId = Number(id);
      const tableRows = Array.isArray(schemaData[tableName]) ? schemaData[tableName] : [];
      const index = tableRows.findIndex((r: Record<string, unknown>) => Number(r[idField]) === numId);

      if (index < 0) {
        return { success: false, error: `${tableName} with ${idField} ${numId} not found` };
      }

      const previousRecord = { ...tableRows[index] };
      const updatedRecord = { ...tableRows[index], ...updates };

      // Protect ID fields
      updatedRecord[idField] = tableRows[index][idField];
      if (idField === 'ID' && tableRows[index]['Node ID'] !== undefined) {
        updatedRecord['Node ID'] = tableRows[index]['Node ID'];
      }
      if (idField === 'Node ID' && tableRows[index].ID !== undefined) {
        updatedRecord.ID = tableRows[index].ID;
      }
      // Protect parent FK
      if (parentFk) {
        updatedRecord[parentFk] = tableRows[index][parentFk];
      }

      const nextRows = [...tableRows];
      nextRows[index] = updatedRecord;

      applyDataUpdate(context, { ...schemaData, [tableName]: nextRows });

      if (recentChangesHandler) {
        recentChangesHandler({
          type: 'update',
          table: tableName,
          data: updatedRecord,
          previousData: previousRecord,
          description: nameField ? String(updatedRecord[nameField] || tableName) : tableName,
        });
      }

      return {
        success: true,
        data: {
          id: numId,
          name: nameField ? updatedRecord[nameField] : undefined,
          updatedFields: Object.keys(updates),
          message: `Updated ${tableName} (${idField} ${numId})`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };

  const del: FunctionHandler = async (args, context) => {
    try {
      const { editorState, recentChangesHandler } = context;
      const { data: schemaData } = editorState;

      if (!schemaData) {
        return { success: false, error: 'Schema not loaded' };
      }

      const { id } = args;

      if (id === undefined || id === null || !Number.isFinite(Number(id))) {
        return { success: false, error: `Valid id is required (${idField} of the ${tableName} to delete)` };
      }

      const numId = Number(id);
      const tableRows = Array.isArray(schemaData[tableName]) ? schemaData[tableName] : [];
      const index = tableRows.findIndex((r: Record<string, unknown>) => Number(r[idField]) === numId);

      if (index < 0) {
        return { success: false, error: `${tableName} with ${idField} ${numId} not found` };
      }

      const deletedRecord = { ...tableRows[index] };
      const recordName = nameField ? deletedRecord[nameField] : undefined;

      const nextRows = tableRows.filter((_: Record<string, unknown>, i: number) => i !== index);
      const nextData: Record<string, unknown> = { ...schemaData, [tableName]: nextRows };

      // Cascade delete child records
      if (childTables) {
        for (const child of childTables) {
          const childRows = Array.isArray(schemaData[child.table]) ? schemaData[child.table] : [];
          (nextData as Record<string, unknown[]>)[child.table] = childRows.filter(
            (r: Record<string, unknown>) => Number(r[child.fkField]) !== numId
          );
        }
      }

      applyDataUpdate(context, nextData);

      if (recentChangesHandler) {
        recentChangesHandler({
          type: 'delete',
          table: tableName,
          data: deletedRecord,
          previousData: deletedRecord,
          description: recordName ? String(recordName) : tableName,
        });
      }

      return {
        success: true,
        data: {
          id: numId,
          name: recordName,
          message: `Deleted ${tableName} (${idField} ${numId})${childTables ? ' and child records' : ''}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };

  return { create, update, delete: del };
}

// ─── Singleton update (DiceConfig, DiceRules, Gear) ──────────────────

function makeSingletonUpdate(tableName: string): FunctionHandler {
  return async (args, context) => {
    try {
      const { editorState, recentChangesHandler } = context;
      const { data: schemaData } = editorState;

      if (!schemaData) {
        return { success: false, error: 'Schema not loaded' };
      }

      const { updates } = args;
      if (!updates || typeof updates !== 'object') {
        return { success: false, error: 'Updates object is required' };
      }

      const tableRows = Array.isArray(schemaData[tableName]) ? schemaData[tableName] : [];
      if (tableRows.length === 0) {
        return { success: false, error: `${tableName} table is empty` };
      }

      const previousRecord = { ...tableRows[0] };
      const updatedRecord = { ...tableRows[0], ...updates };

      applyDataUpdate(context, {
        ...schemaData,
        [tableName]: [updatedRecord, ...tableRows.slice(1)],
      });

      if (recentChangesHandler) {
        recentChangesHandler({
          type: 'update',
          table: tableName,
          data: updatedRecord,
          previousData: previousRecord,
          description: tableName,
        });
      }

      return {
        success: true,
        data: {
          updatedFields: Object.keys(updates),
          message: `Updated ${tableName}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

// ─── Child record add (with parent verification + FK injection) ──────

function makeChildAdd(tableName: string, parentTable: string, parentFk: string, parentIdField: 'ID' | 'Node ID' = 'ID'): FunctionHandler {
  return async (args, context) => {
    try {
      const { editorState } = context;
      const { data: schemaData, schema: schemaStructure } = editorState;

      if (!schemaData || !schemaStructure) {
        return { success: false, error: 'Schema not loaded' };
      }

      const { parentId, fields } = args;

      if (parentId === undefined || !Number.isFinite(Number(parentId))) {
        return { success: false, error: `Valid parentId is required (${parentIdField} of the parent ${parentTable})` };
      }

      const numParentId = Number(parentId);

      // Verify parent exists
      const parentRows = Array.isArray(schemaData[parentTable]) ? schemaData[parentTable] : [];
      const parent = parentRows.find((r: Record<string, unknown>) => Number(r[parentIdField]) === numParentId);
      if (!parent) {
        return { success: false, error: `${parentTable} with ${parentIdField} ${numParentId} not found` };
      }

      const tableSchema = schemaStructure.tables?.[tableName];
      if (!tableSchema) {
        return { success: false, error: `${tableName} table not found in schema` };
      }

      const newRecord = createDefaultRecord(tableName, tableSchema);
      newRecord[parentFk] = numParentId;

      // Merge provided fields
      if (fields && typeof fields === 'object') {
        for (const [key, val] of Object.entries(fields)) {
          if (val !== undefined && val !== null) {
            newRecord[key] = val;
          }
        }
        // Protect parent FK
        newRecord[parentFk] = numParentId;
      }

      const tableRows = Array.isArray(schemaData[tableName]) ? schemaData[tableName] : [];
      applyDataUpdate(context, {
        ...schemaData,
        [tableName]: [...tableRows, newRecord],
      });

      return {
        success: true,
        data: {
          parentId: numParentId,
          parentName: parent.Name,
          message: `Added ${tableName} to ${parentTable} "${parent.Name || numParentId}"`,
          record: newRecord,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

// ─── Child record update (by parent ID + index within parent) ────────

function makeChildUpdate(tableName: string, parentFk: string): FunctionHandler {
  return async (args, context) => {
    try {
      const { editorState } = context;
      const { data: schemaData } = editorState;

      if (!schemaData) {
        return { success: false, error: 'Schema not loaded' };
      }

      const { parentId, index, updates } = args;

      if (parentId === undefined || !Number.isFinite(Number(parentId))) {
        return { success: false, error: 'Valid parentId is required' };
      }
      if (!Number.isFinite(index) || index < 0) {
        return { success: false, error: 'Valid index is required (0-based)' };
      }
      if (!updates || typeof updates !== 'object') {
        return { success: false, error: 'Updates object is required' };
      }

      const numParentId = Number(parentId);
      const allRows = Array.isArray(schemaData[tableName]) ? schemaData[tableName] : [];
      const childRows = allRows.filter((r: Record<string, unknown>) => Number(r[parentFk]) === numParentId);

      if (index >= childRows.length) {
        return {
          success: false,
          error: `Index ${index} out of range (parent has ${childRows.length} ${tableName} records)`,
        };
      }

      const target = childRows[index];
      const globalIndex = allRows.indexOf(target);

      if (globalIndex < 0) {
        return { success: false, error: 'Record not found in global table' };
      }

      const updatedRecord = { ...target, ...updates };
      updatedRecord[parentFk] = numParentId; // protect FK

      const nextRows = [...allRows];
      nextRows[globalIndex] = updatedRecord;

      applyDataUpdate(context, { ...schemaData, [tableName]: nextRows });

      return {
        success: true,
        data: {
          parentId: numParentId,
          index,
          updatedFields: Object.keys(updates),
          message: `Updated ${tableName} index ${index} for parent ${numParentId}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

// ─── Child record delete (by parent ID + index) ─────────────────────

function makeChildDelete(tableName: string, parentFk: string): FunctionHandler {
  return async (args, context) => {
    try {
      const { editorState, recentChangesHandler } = context;
      const { data: schemaData } = editorState;

      if (!schemaData) {
        return { success: false, error: 'Schema not loaded' };
      }

      const { parentId, index } = args;

      if (parentId === undefined || !Number.isFinite(Number(parentId))) {
        return { success: false, error: 'Valid parentId is required' };
      }
      if (!Number.isFinite(index) || index < 0) {
        return { success: false, error: 'Valid index is required (0-based)' };
      }

      const numParentId = Number(parentId);
      const allRows = Array.isArray(schemaData[tableName]) ? schemaData[tableName] : [];
      const childRows = allRows.filter((r: Record<string, unknown>) => Number(r[parentFk]) === numParentId);

      if (index >= childRows.length) {
        return {
          success: false,
          error: `Index ${index} out of range (parent has ${childRows.length} ${tableName} records)`,
        };
      }

      const target = childRows[index];
      const globalIndex = allRows.indexOf(target);

      if (globalIndex < 0) {
        return { success: false, error: 'Record not found in global table' };
      }

      const nextRows = allRows.filter((_: Record<string, unknown>, i: number) => i !== globalIndex);

      applyDataUpdate(context, { ...schemaData, [tableName]: nextRows });

      if (recentChangesHandler) {
        recentChangesHandler({
          type: 'delete',
          table: tableName,
          data: target,
          previousData: target,
          description: tableName,
        });
      }

      return {
        success: true,
        data: {
          parentId: numParentId,
          index,
          message: `Deleted ${tableName} index ${index} from parent ${numParentId}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TABLE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════

// ─── Parent tables (full CRUD with global ID) ────────────────────────

const skillDef = makeTableCrud({
  tableName: 'SkillDef', idField: 'Node ID', nameField: 'Name',
});

const spellDef = makeTableCrud({
  tableName: 'SpellDef', idField: 'ID', nameField: 'Name',
  childTables: [
    { table: 'SpellEffect', fkField: 'SpellID' },
    { table: 'SpellReqDef', fkField: 'SpellID' },
    { table: 'SpellTargetCond', fkField: 'SpellID' },
  ],
});

const perkDef = makeTableCrud({
  tableName: 'PerkDef', idField: 'ID', nameField: 'Name',
  childTables: [{ table: 'PerkAction', fkField: 'PerkID' }],
});

const stat = makeTableCrud({
  tableName: 'Stat', idField: 'ID', nameField: 'Name',
});

const runeDef = makeTableCrud({
  tableName: 'RuneDef', idField: 'ID', nameField: 'Name',
  childTables: [
    { table: 'RuneAction', fkField: 'RuneID' },
    { table: 'RuneCondition', fkField: 'RuneID' },
  ],
});

const statusDef = makeTableCrud({
  tableName: 'StatusDef', idField: 'ID', nameField: 'Name',
  childTables: [{ table: 'StatusAction', fkField: 'StatusID' }],
});

const mutatorDef = makeTableCrud({
  tableName: 'MutatorDef', idField: 'ID', nameField: 'Name',
  childTables: [
    { table: 'MutatorAction', fkField: 'MutatorID' },
    { table: 'MutatorCondition', fkField: 'MutatorID' },
  ],
});

// ─── Child table operations ──────────────────────────────────────────

const addPerkAction = makeChildAdd('PerkAction', 'PerkDef', 'PerkID');
const updatePerkAction = makeChildUpdate('PerkAction', 'PerkID');
const deletePerkAction = makeChildDelete('PerkAction', 'PerkID');

const addSpellEffect = makeChildAdd('SpellEffect', 'SpellDef', 'SpellID');
const updateSpellEffect = makeChildUpdate('SpellEffect', 'SpellID');
const deleteSpellEffect = makeChildDelete('SpellEffect', 'SpellID');

const addSpellReqDef = makeChildAdd('SpellReqDef', 'SpellDef', 'SpellID');
const updateSpellReqDef = makeChildUpdate('SpellReqDef', 'SpellID');
const deleteSpellReqDef = makeChildDelete('SpellReqDef', 'SpellID');

const addSpellTargetCond = makeChildAdd('SpellTargetCond', 'SpellDef', 'SpellID');
const updateSpellTargetCond = makeChildUpdate('SpellTargetCond', 'SpellID');
const deleteSpellTargetCond = makeChildDelete('SpellTargetCond', 'SpellID');

const addRuneAction = makeChildAdd('RuneAction', 'RuneDef', 'RuneID');
const updateRuneAction = makeChildUpdate('RuneAction', 'RuneID');
const deleteRuneAction = makeChildDelete('RuneAction', 'RuneID');

const addRuneCondition = makeChildAdd('RuneCondition', 'RuneDef', 'RuneID');
const updateRuneCondition = makeChildUpdate('RuneCondition', 'RuneID');
const deleteRuneCondition = makeChildDelete('RuneCondition', 'RuneID');

const addStatusAction = makeChildAdd('StatusAction', 'StatusDef', 'StatusID');
const updateStatusAction = makeChildUpdate('StatusAction', 'StatusID');
const deleteStatusAction = makeChildDelete('StatusAction', 'StatusID');

const addMutatorAction = makeChildAdd('MutatorAction', 'MutatorDef', 'MutatorID');
const updateMutatorAction = makeChildUpdate('MutatorAction', 'MutatorID');
const deleteMutatorAction = makeChildDelete('MutatorAction', 'MutatorID');

const addMutatorCondition = makeChildAdd('MutatorCondition', 'MutatorDef', 'MutatorID');
const updateMutatorCondition = makeChildUpdate('MutatorCondition', 'MutatorID');
const deleteMutatorCondition = makeChildDelete('MutatorCondition', 'MutatorID');

// ─── Singleton updates ───────────────────────────────────────────────

const updateDiceConfig = makeSingletonUpdate('DiceConfig');
const updateDiceRules = makeSingletonUpdate('DiceRules');
const updateGear = makeSingletonUpdate('Gear');

// ═══════════════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE EXPORTS
// ═══════════════════════════════════════════════════════════════════════

export const createAbility = spellDef.create;
export const updateAbility = spellDef.update;
export const deleteAbility = spellDef.delete;
export const addAbilityEffect = addSpellEffect;
export const updateAbilityEffect = updateSpellEffect;

export const createPerk = perkDef.create;
export const updatePerk = perkDef.update;
export const deletePerk = perkDef.delete;

export const createStat = stat.create;
export const updateStat = stat.update;
export const deleteStat = stat.delete;

// ═══════════════════════════════════════════════════════════════════════
// FUNCTION DEFINITIONS FOR OLLAMA
// ═══════════════════════════════════════════════════════════════════════

function parentCrudDefs(
  table: string,
  label: string,
  description: string,
  keyFields: Array<{ name: string; type: string; desc: string }>,
): OllamaFunction[] {
  return [
    {
      name: `create${label}`,
      description: `Create a new ${description}. Adds a row to the editor UI immediately — the user sees it appear in the relevant tab. Pass any valid schema column as a top-level field (not just the ones listed here). ID is auto-assigned.`,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          keyFields.map(f => [f.name, { type: f.type, description: f.desc }])
        ),
        required: keyFields.filter(f => f.name === 'Name' || f.name === 'name').map(f => f.name),
      },
    },
    {
      name: `update${label}`,
      description: `Update an existing ${description}. Changes appear in the editor UI immediately.`,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: `ID of the ${table} to update` },
          updates: { type: 'object', description: `Object of fields to update on the ${table}. Can include any valid column name.` },
        },
        required: ['id', 'updates'],
      },
    },
    {
      name: `delete${label}`,
      description: `Delete a ${description} and its child records. Removes from the editor UI immediately.`,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: `ID of the ${table} to delete` },
        },
        required: ['id'],
      },
    },
  ];
}

function childCrudDefs(
  table: string,
  label: string,
  parentLabel: string,
  description: string,
  keyFields: Array<{ name: string; type: string; desc: string }>,
): OllamaFunction[] {
  return [
    {
      name: `add${label}`,
      description: `Add a ${description} to a ${parentLabel}. Adds a child row in the editor UI immediately.`,
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'number', description: `ID of the parent ${parentLabel}` },
          fields: {
            type: 'object',
            description: `Fields for the new ${table} record. Key fields: ${keyFields.map(f => `${f.name} (${f.desc})`).join(', ')}`,
          },
        },
        required: ['parentId'],
      },
    },
    {
      name: `update${label}`,
      description: `Update a ${description} on a ${parentLabel}`,
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'number', description: `ID of the parent ${parentLabel}` },
          index: { type: 'number', description: `0-based index of the ${table} to update (within this parent)` },
          updates: { type: 'object', description: `Object of fields to update` },
        },
        required: ['parentId', 'index', 'updates'],
      },
    },
    {
      name: `delete${label}`,
      description: `Delete a ${description} from a ${parentLabel}`,
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'number', description: `ID of the parent ${parentLabel}` },
          index: { type: 'number', description: `0-based index of the ${table} to delete (within this parent)` },
        },
        required: ['parentId', 'index'],
      },
    },
  ];
}

function singletonUpdateDef(table: string, description: string, keyFields: Array<{ name: string; desc: string }>): OllamaFunction {
  return {
    name: `update${table}`,
    description: `Update ${description} (single-row config table)`,
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'object',
          description: `Fields to update. Key fields: ${keyFields.map(f => `${f.name} (${f.desc})`).join(', ')}`,
        },
      },
      required: ['updates'],
    },
  };
}

export const schemaFunctionDefinitions: OllamaFunction[] = [
  // ─── Parent tables ─────────────────────────────────────────────
  ...parentCrudDefs('SkillDef', 'Skill', 'skill or attribute on the character sheet (SkillDef table). Set TypeFlag="t" for attributes (separators), TypeFlag="f" for skills. Skills MUST have BonusSource set to their parent attribute or they won\'t collapse under it in the editor.', [
    { name: 'Name', type: 'string', desc: 'Skill/attribute name' },
    { name: 'TypeFlag', type: 'string', desc: '"t" for attribute (separator), "f" for skill' },
    { name: 'Description', type: 'string', desc: 'Description text' },
    { name: 'BonusSource', type: 'string', desc: 'REQUIRED for skills — parent attribute "NodeID*Multiplier" (e.g., "1*1.0" links to attribute with Node ID 1 at 100%)' },
    { name: 'Max Allocation', type: 'number', desc: 'Max points allocatable (-1 = unlimited)' },
    { name: 'Trained', type: 'string', desc: '"t" = requires training, "f" = available by default' },
    { name: 'Natural Bonus', type: 'number', desc: 'Starting bonus value (default 0)' },
  ]),

  ...parentCrudDefs('SpellDef', 'Ability', 'ability/spell (SpellDef table)', [
    { name: 'Name', type: 'string', desc: 'Ability name' },
    { name: 'Description', type: 'string', desc: 'What the ability does' },
    { name: 'Cost', type: 'number', desc: 'Resource cost (mana, stamina, etc.)' },
  ]),

  ...parentCrudDefs('PerkDef', 'Perk', 'perk (PerkDef table)', [
    { name: 'Name', type: 'string', desc: 'Perk name' },
    { name: 'Description', type: 'string', desc: 'What the perk does' },
    { name: 'Cost', type: 'number', desc: 'Cost in perk points' },
  ]),

  ...parentCrudDefs('Stat', 'Stat', 'derived stat or resource (Stat table)', [
    { name: 'Name', type: 'string', desc: 'Stat name' },
    { name: 'Description', type: 'string', desc: 'What the stat represents' },
    { name: 'Formula', type: 'string', desc: 'Calculation formula (e.g., "1*1.0;2*0.5" for STR + 50% DEX)' },
  ]),

  ...parentCrudDefs('RuneDef', 'Rune', 'rune/equipment item (RuneDef table, admin-only)', [
    { name: 'Name', type: 'string', desc: 'Rune name' },
    { name: 'Description', type: 'string', desc: 'What the rune does' },
  ]),

  ...parentCrudDefs('StatusDef', 'Status', 'status effect/buff (StatusDef table)', [
    { name: 'Name', type: 'string', desc: 'Status name' },
    { name: 'Description', type: 'string', desc: 'What the status does' },
    { name: 'Duration', type: 'number', desc: 'Duration in rounds (0 = permanent)' },
  ]),

  ...parentCrudDefs('MutatorDef', 'Mutator', 'mutator/conditional effect group (MutatorDef table)', [
    { name: 'Name', type: 'string', desc: 'Mutator name' },
    { name: 'Description', type: 'string', desc: 'What the mutator does' },
  ]),

  // ─── Child tables ──────────────────────────────────────────────
  ...childCrudDefs('PerkAction', 'PerkAction', 'perk', 'perk action/effect (19 function types: 0=AllowSkill, 6=GrantStat, 7=StatModifier, 8=GrantAbility, 11=GrantPerk, etc.)', [
    { name: 'Function', type: 'number', desc: 'Action function (0-18)' },
    { name: 'TargetID', type: 'number', desc: 'Target ID (SkillDef/PerkDef/Stat/SpellDef depending on Function)' },
    { name: 'Modifier', type: 'string', desc: 'Modifier value' },
  ]),

  ...childCrudDefs('SpellEffect', 'SpellEffect', 'ability', 'ability effect (13 function types: 0=PrintMessage, 1=ModifyStat, 4=BuffSkill, 5=BuffStat, 10=SetStat, etc.)', [
    { name: 'Function', type: 'number', desc: 'Effect function (0-12)' },
    { name: 'Who', type: 'number', desc: '0=caster, 1=target' },
    { name: 'TargetID', type: 'number', desc: 'Target Stat/Skill/etc. ID' },
    { name: 'AdjustFormula', type: 'string', desc: 'Formula for adjustment amount' },
    { name: 'Outcome', type: 'number', desc: '0=onSuccess, 1=onFailure, 2=always' },
  ]),

  ...childCrudDefs('SpellReqDef', 'SpellReq', 'ability', 'ability requirement (7 function types: check stat, perk, level, etc.)', [
    { name: 'Function', type: 'number', desc: 'Requirement function type' },
    { name: 'TargetID', type: 'number', desc: 'Target ID to check' },
    { name: 'Operator', type: 'number', desc: 'Comparison operator (0==, 1!=, 2>, 3>=, 4<, 5<=)' },
    { name: 'Value', type: 'string', desc: 'Value to compare against' },
  ]),

  ...childCrudDefs('SpellTargetCond', 'SpellTargetCond', 'ability', 'ability target condition (1-indexed, 22 condition types)', [
    { name: 'Function', type: 'number', desc: 'Condition function type' },
    { name: 'TargetID', type: 'number', desc: 'Target ID' },
    { name: 'Operator', type: 'number', desc: 'Comparison operator' },
    { name: 'Value', type: 'string', desc: 'Comparison value' },
  ]),

  ...childCrudDefs('RuneAction', 'RuneAction', 'rune', 'rune action/effect (6 function types)', [
    { name: 'Function', type: 'number', desc: 'Action function type' },
    { name: 'TargetID', type: 'number', desc: 'Target ID' },
    { name: 'Modifier', type: 'string', desc: 'Modifier value' },
  ]),

  ...childCrudDefs('RuneCondition', 'RuneCondition', 'rune', 'rune condition (1-indexed, NOTE: RuneConditions are broken in RPR - logic never got hooked up)', [
    { name: 'Function', type: 'number', desc: 'Condition function type' },
    { name: 'TargetID', type: 'number', desc: 'Target ID' },
    { name: 'Operator', type: 'number', desc: 'Comparison operator' },
    { name: 'Value', type: 'string', desc: 'Comparison value' },
  ]),

  ...childCrudDefs('StatusAction', 'StatusAction', 'status', 'status action (column order: StatusAction|StatusID|TargetID|Value|Function — Function is in col 4!)', [
    { name: 'Function', type: 'number', desc: 'Action function type (col 4)' },
    { name: 'TargetID', type: 'number', desc: 'Target ID' },
    { name: 'Value', type: 'string', desc: 'Value' },
  ]),

  ...childCrudDefs('MutatorAction', 'MutatorAction', 'mutator', 'mutator action/effect (6 function types)', [
    { name: 'Function', type: 'number', desc: 'Action function type' },
    { name: 'TargetID', type: 'number', desc: 'Target ID' },
    { name: 'Modifier', type: 'string', desc: 'Modifier value' },
  ]),

  ...childCrudDefs('MutatorCondition', 'MutatorCondition', 'mutator', 'mutator condition (0-indexed! Different from RuneCondition which is 1-indexed)', [
    { name: 'Function', type: 'number', desc: 'Condition function type (0=Perk, 1=BuffCategory, etc.)' },
    { name: 'TargetID', type: 'number', desc: 'Target ID' },
    { name: 'Operator', type: 'number', desc: 'Comparison operator' },
    { name: 'Value', type: 'string', desc: 'Comparison value' },
  ]),

  // ─── Singleton tables ──────────────────────────────────────────
  singletonUpdateDef('DiceConfig', 'dice system configuration', [
    { name: 'TotalNodes', desc: 'Next node ID counter' },
    { name: 'DiceRoll', desc: 'Default dice formula (e.g., "1d20")' },
    { name: 'PointsPerLevel', desc: 'Skill points awarded per level' },
    { name: 'MaxLevel', desc: 'Maximum character level' },
  ]),

  singletonUpdateDef('DiceRules', 'dice system rules', [
    { name: 'CritSuccess', desc: 'Critical success threshold' },
    { name: 'CritFailure', desc: 'Critical failure threshold' },
  ]),

  singletonUpdateDef('Gear', 'armor/equipment weight configuration', [
    { name: 'LightWeight', desc: 'Light armor weight threshold' },
    { name: 'MediumWeight', desc: 'Medium armor weight threshold' },
    { name: 'HeavyWeight', desc: 'Heavy armor weight threshold' },
  ]),
];

// ═══════════════════════════════════════════════════════════════════════
// EXPORT ALL FUNCTIONS AS SINGLE OBJECT (keyed by definition name)
// ═══════════════════════════════════════════════════════════════════════

export const schemaFunctions: Record<string, FunctionHandler> = {
  // Parent CRUD
  createSkill: skillDef.create,
  updateSkill: skillDef.update,
  deleteSkill: skillDef.delete,

  createAbility: spellDef.create,
  updateAbility: spellDef.update,
  deleteAbility: spellDef.delete,

  createPerk: perkDef.create,
  updatePerk: perkDef.update,
  deletePerk: perkDef.delete,

  createStat: stat.create,
  updateStat: stat.update,
  deleteStat: stat.delete,

  createRune: runeDef.create,
  updateRune: runeDef.update,
  deleteRune: runeDef.delete,

  createStatus: statusDef.create,
  updateStatus: statusDef.update,
  deleteStatus: statusDef.delete,

  createMutator: mutatorDef.create,
  updateMutator: mutatorDef.update,
  deleteMutator: mutatorDef.delete,

  // Child CRUD
  addPerkAction, updatePerkAction, deletePerkAction,
  addSpellEffect, updateSpellEffect, deleteSpellEffect,
  addSpellReq: addSpellReqDef, updateSpellReq: updateSpellReqDef, deleteSpellReq: deleteSpellReqDef,
  addSpellTargetCond, updateSpellTargetCond, deleteSpellTargetCond,
  addRuneAction, updateRuneAction, deleteRuneAction,
  addRuneCondition, updateRuneCondition, deleteRuneCondition,
  addStatusAction, updateStatusAction, deleteStatusAction,
  addMutatorAction, updateMutatorAction, deleteMutatorAction,
  addMutatorCondition, updateMutatorCondition, deleteMutatorCondition,

  // Singleton updates
  updateDiceConfig,
  updateDiceRules,
  updateGear,
};
