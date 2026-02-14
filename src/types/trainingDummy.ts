/**
 * Training Dummy types for combat simulation
 * Training dummies are configurable mock targets for testing abilities
 */

/**
 * A single training dummy target
 */
export interface TrainingDummy {
  id: number;
  name: string;

  // Stats map: Stat ID -> value
  // This allows any stat to be configured without hardcoding IDs
  stats: Map<number, number>;

  // Active statuses on the dummy
  activeStatusIds: Set<number>;

  // Maps status ID -> category it was granted under (for Dispel Buff matching)
  statusCategoryMap: Map<number, string>;
}

/**
 * Configuration for creating/editing a training dummy
 */
export interface TrainingDummyConfig {
  name: string;

  // Stat overrides: only stats explicitly set are stored
  // Other stats default to 0 or schema defaults
  statOverrides: Map<number, number>;

  // Status IDs to apply to this dummy
  statusIds: Set<number>;
}

/**
 * Preset dummy configurations for quick setup
 */
export interface TrainingDummyPreset {
  id: string;
  name: string;
  description: string;
  config: TrainingDummyConfig;
}

/**
 * Create a new empty training dummy
 */
export function createEmptyDummy(id: number, name?: string): TrainingDummy {
  return {
    id,
    name: name ?? `Dummy ${id}`,
    stats: new Map(),
    activeStatusIds: new Set(),
    statusCategoryMap: new Map(),
  };
}

/**
 * Create a training dummy from a config
 */
export function createDummyFromConfig(
  id: number,
  config: TrainingDummyConfig,
  _statusDefRows?: Record<string, unknown>[]
): TrainingDummy {
  return {
    id,
    name: config.name,
    stats: new Map(config.statOverrides),
    activeStatusIds: new Set(config.statusIds),
    statusCategoryMap: new Map(),
  };
}

/**
 * Get a stat value from a dummy, with optional default
 */
export function getDummyStat(dummy: TrainingDummy, statId: number, defaultValue = 0): number {
  return dummy.stats.get(statId) ?? defaultValue;
}

/**
 * Set a stat value on a dummy (returns new dummy, immutable)
 */
export function setDummyStat(dummy: TrainingDummy, statId: number, value: number): TrainingDummy {
  const newStats = new Map(dummy.stats);
  newStats.set(statId, value);
  return { ...dummy, stats: newStats };
}

/**
 * Apply a stat modifier to a dummy (returns new dummy, immutable)
 */
export function modifyDummyStat(
  dummy: TrainingDummy,
  statId: number,
  delta: number,
  clampMin?: number,
  clampMax?: number
): TrainingDummy {
  const currentValue = dummy.stats.get(statId) ?? 0;
  let newValue = currentValue + delta;

  if (clampMin !== undefined) {
    newValue = Math.max(clampMin, newValue);
  }
  if (clampMax !== undefined) {
    newValue = Math.min(clampMax, newValue);
  }

  return setDummyStat(dummy, statId, newValue);
}
