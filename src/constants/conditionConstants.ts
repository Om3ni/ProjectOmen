/**
 * Shared constants for condition and effect editors.
 * Extracted from SpellTargetCondEditor, RuneConditionEditor, MutatorConditionEditor.
 */

export type Opt = { value: string; label: string };

// ── Operators ────────────────────────────────────────────────

export const ALL_OPERATORS: Opt[] = [
  { value: '0', label: '==' },
  { value: '1', label: '!=' },
  { value: '2', label: '>' },
  { value: '3', label: '>=' },
  { value: '4', label: '<' },
  { value: '5', label: '<=' },
  { value: '6', label: 'Between' },
  { value: '7', label: 'Outside' },
];

export const EQUALITY_OPERATORS: Opt[] = [
  { value: '0', label: '==' },
  { value: '1', label: '!=' },
];

// ── Value option sets ────────────────────────────────────────

export const CLIMATE_OPTIONS: Opt[] = [
  { value: '0', label: 'Hot' },
  { value: '1', label: 'Cold' },
];

export const SHELTER_OPTIONS: Opt[] = [
  { value: '0', label: 'No Shelter' },
  { value: '1', label: 'Some Shelter' },
  { value: '2', label: 'Has Shelter' },
];

export const TIME_OF_DAY_OPTIONS: Opt[] = [
  { value: '0', label: 'Dawn' },
  { value: '1', label: 'Day' },
  { value: '2', label: 'Dusk' },
  { value: '3', label: 'Night' },
];

export const MAIN_HAND_OPTIONS: Opt[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Axe 1H' },
  { value: '2', label: 'Axe 2H' },
  { value: '3', label: 'Bow' },
  { value: '4', label: 'Crossbow' },
  { value: '5', label: 'Daggers' },
  { value: '6', label: 'Mace 1H' },
  { value: '7', label: 'Mace 2H' },
  { value: '8', label: 'Spear 1H' },
  { value: '9', label: 'Spear 2H' },
  { value: '10', label: 'Sword 1H' },
  { value: '11', label: 'Sword 2H' },
  { value: '12', label: 'Other' },
  { value: '13', label: 'Focus 2H' },
];

export const OFF_HAND_OPTIONS: Opt[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Shield' },
  { value: '2', label: 'Thrown' },
  { value: '3', label: 'Torch' },
  { value: '4', label: 'Other' },
];

export const ARMOR_CLASS_OPTIONS: Opt[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Light' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Heavy' },
];
