/**
 * Configuration for each condition editor variant.
 * Maps generic field slots to actual schema column names and defines
 * per-condition-type metadata (visibility, node type, value options, operators).
 */

import type { Opt } from '@/constants/conditionConstants';
import {
  ALL_OPERATORS,
  EQUALITY_OPERATORS,
  CLIMATE_OPTIONS,
  SHELTER_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  MAIN_HAND_OPTIONS,
  OFF_HAND_OPTIONS,
  ARMOR_CLASS_OPTIONS,
} from '@/constants/conditionConstants';

// ── Types ────────────────────────────────────────────────────

export type ConditionFieldMap = {
  inclusion: string;
  condition: string;
  operator: string;
  node: string;
  valueLow: string;
  valueHigh: string;
  category: string;
};

export type ConditionTypeMeta = {
  show: { node: boolean; valueLow: boolean; valueHigh: 'operator-dependent' | boolean; category: boolean };
  nodeType: 'perk' | 'skill' | 'status' | 'none';
  valueOptions: Opt[] | null;
  operatorOptions: Opt[];
  helperText: string | null;
};

export type ConditionConfig = {
  fields: ConditionFieldMap;
  showIfLabel: boolean;
  /** Whether to read condition type options from the schema enum (true) or use hardcoded list */
  useSchemaEnum: boolean;
  /** Hardcoded condition type dropdown options (used when useSchemaEnum is false) */
  conditionOptions?: Opt[];
  conditionMeta: Record<number, ConditionTypeMeta>;
};

// ── Shared condition type metadata ───────────────────────────
// The actual condition semantics are the same across all three tables.
// Only indexing and field names differ. We build the metadata once.

function perk(): ConditionTypeMeta {
  return { show: { node: true, valueLow: false, valueHigh: false, category: false }, nodeType: 'perk', valueOptions: null, operatorOptions: EQUALITY_OPERATORS, helperText: null };
}
function buffOrPerkCategory(): ConditionTypeMeta {
  return { show: { node: false, valueLow: false, valueHigh: false, category: true }, nodeType: 'none', valueOptions: null, operatorOptions: EQUALITY_OPERATORS, helperText: null };
}
function skillAllocation(): ConditionTypeMeta {
  return { show: { node: true, valueLow: true, valueHigh: 'operator-dependent', category: false }, nodeType: 'skill', valueOptions: null, operatorOptions: ALL_OPERATORS, helperText: null };
}
function numeric(): ConditionTypeMeta {
  return { show: { node: false, valueLow: true, valueHigh: 'operator-dependent', category: false }, nodeType: 'none', valueOptions: null, operatorOptions: ALL_OPERATORS, helperText: null };
}
function enumCond(options: Opt[]): ConditionTypeMeta {
  return { show: { node: false, valueLow: true, valueHigh: false, category: false }, nodeType: 'none', valueOptions: options, operatorOptions: EQUALITY_OPERATORS, helperText: null };
}
function boolCond(text = 'True'): ConditionTypeMeta {
  return { show: { node: false, valueLow: false, valueHigh: false, category: false }, nodeType: 'none', valueOptions: null, operatorOptions: EQUALITY_OPERATORS, helperText: text };
}
function status(): ConditionTypeMeta {
  return { show: { node: true, valueLow: false, valueHigh: false, category: false }, nodeType: 'status', valueOptions: null, operatorOptions: EQUALITY_OPERATORS, helperText: null };
}

/** Full 22-type metadata (0-indexed, used by SpellTargetCond and MutatorCondition) */
const FULL_CONDITION_META: Record<number, ConditionTypeMeta> = {
  0: perk(),
  1: buffOrPerkCategory(),
  2: skillAllocation(),
  3: numeric(),        // Level
  4: enumCond(CLIMATE_OPTIONS),
  5: enumCond(SHELTER_OPTIONS),
  6: enumCond(TIME_OF_DAY_OPTIONS),
  7: enumCond(MAIN_HAND_OPTIONS),
  8: enumCond(OFF_HAND_OPTIONS),
  9: enumCond(ARMOR_CLASS_OPTIONS),
  10: numeric(),       // Character Height
  11: numeric(),       // Character Build
  12: numeric(),       // Bust Size
  13: numeric(),       // Dong Size
  14: boolCond(),      // Flying
  15: boolCond(),      // Riding
  16: boolCond(),      // Swimming
  17: boolCond('Female'), // Gender
  18: boolCond(),      // High Heels
  19: numeric(),       // Corruption
  20: status(),
  21: buffOrPerkCategory(),
};

/**
 * RuneCondition is 1-indexed and has fewer condition types.
 * Same semantics where IDs overlap, but starts at 1 and omits Perk (0), Status (20), Perk Category (21).
 */
const RUNE_CONDITION_META: Record<number, ConditionTypeMeta> = {
  1: buffOrPerkCategory(),
  2: skillAllocation(),
  3: numeric(),        // Level
  4: enumCond(CLIMATE_OPTIONS),
  5: enumCond(SHELTER_OPTIONS),
  6: enumCond(TIME_OF_DAY_OPTIONS),
  7: enumCond(MAIN_HAND_OPTIONS),
  8: enumCond(OFF_HAND_OPTIONS),
  9: enumCond(ARMOR_CLASS_OPTIONS),
  10: numeric(),       // Character Height
  11: numeric(),       // Character Build
  12: numeric(),       // Bust Size
  13: numeric(),       // Dong Size
  14: boolCond(),      // Flying
  15: boolCond(),      // Riding
  16: boolCond(),      // Swimming
  17: boolCond('Female'), // Gender
  18: boolCond(),      // High Heels
  19: numeric(),       // Corruption
};

// ── Configs ──────────────────────────────────────────────────

export const SPELL_TARGET_COND_CONFIG: ConditionConfig = {
  fields: {
    inclusion: 'Mode',
    condition: 'Function',
    operator: 'Operator',
    node: 'Param',
    valueLow: 'ValueMin',
    valueHigh: 'ValueMax',
    category: 'Text',
  },
  showIfLabel: true,
  useSchemaEnum: true,
  conditionMeta: FULL_CONDITION_META,
};

export const RUNE_CONDITION_CONFIG: ConditionConfig = {
  fields: {
    inclusion: 'Inclusion',
    condition: 'Condition',
    operator: 'Operator',
    node: 'NodeAffected',
    valueLow: 'Value',
    valueHigh: 'MaxValue',
    category: 'Category',
  },
  showIfLabel: false,
  useSchemaEnum: false,
  conditionOptions: [
    { value: '1', label: 'Buff Category' },
    { value: '2', label: 'Skill Allocation' },
    { value: '3', label: 'Level' },
    { value: '4', label: 'Climate' },
    { value: '5', label: 'Shelter' },
    { value: '6', label: 'Time of Day' },
    { value: '7', label: 'Equipped Main Hand' },
    { value: '8', label: 'Equipped Off Hand' },
    { value: '9', label: 'Armor Class' },
    { value: '10', label: 'Character Height' },
    { value: '11', label: 'Character Build' },
    { value: '12', label: 'Bust Size' },
    { value: '13', label: 'Dong Size' },
    { value: '14', label: 'Flying' },
    { value: '15', label: 'Riding' },
    { value: '16', label: 'Swimming' },
    { value: '17', label: 'Gender' },
    { value: '18', label: 'High Heels' },
    { value: '19', label: 'Corruption' },
  ],
  conditionMeta: RUNE_CONDITION_META,
};

export const MUTATOR_CONDITION_CONFIG: ConditionConfig = {
  fields: {
    inclusion: 'Inclusion',
    condition: 'Condition',
    operator: 'Operator',
    node: 'NodeAffected',
    valueLow: 'Value',
    valueHigh: 'MaxValue',
    category: 'Category',
  },
  showIfLabel: true,
  useSchemaEnum: false,
  conditionOptions: [
    { value: '0', label: 'Perk' },
    { value: '1', label: 'Buff Category' },
    { value: '2', label: 'Skill Allocation' },
    { value: '3', label: 'Level' },
    { value: '4', label: 'Climate' },
    { value: '5', label: 'Shelter' },
    { value: '6', label: 'Time of Day' },
    { value: '7', label: 'Equipped Main Hand' },
    { value: '8', label: 'Equipped Off Hand' },
    { value: '9', label: 'Armor Class' },
    { value: '10', label: 'Character Height' },
    { value: '11', label: 'Character Build' },
    { value: '12', label: 'Bust Size' },
    { value: '13', label: 'Dong Size' },
    { value: '14', label: 'Flying' },
    { value: '15', label: 'Riding' },
    { value: '16', label: 'Swimming' },
    { value: '17', label: 'Gender' },
    { value: '18', label: 'High Heels' },
    { value: '19', label: 'Corruption' },
    { value: '20', label: 'Status' },
    { value: '21', label: 'Perk Category' },
  ],
  conditionMeta: FULL_CONDITION_META,
};
