/**
 * Hook for managing training dummy state
 */

import { useState, useCallback } from 'react';
import { num } from '@/utils/rprHelpers';
import type { TrainingDummy, TrainingDummyConfig } from '@/types/trainingDummy';
import {
  createEmptyDummy,
  createDummyFromConfig,
  setDummyStat,
  modifyDummyStat,
} from '@/types/trainingDummy';

type Row = Record<string, unknown>;

export interface UseTrainingDummiesOptions {
  // Schema data for deriving status categories
  statusDefRows?: Row[];

  // Schema data for getting stat defaults
  statRows?: Row[];

  // Initial dummies (optional)
  initialDummies?: TrainingDummy[];
}

export interface UseTrainingDummiesResult {
  // Current dummies
  dummies: TrainingDummy[];

  // Add a new dummy
  addDummy: (config?: TrainingDummyConfig) => number;

  // Remove a dummy by ID
  removeDummy: (id: number) => void;

  // Update a dummy's name
  renameDummy: (id: number, name: string) => void;

  // Set a stat on a dummy
  setStat: (dummyId: number, statId: number, value: number) => void;

  // Modify a stat on a dummy (add delta)
  modifyStat: (dummyId: number, statId: number, delta: number) => void;

  // Add a status to a dummy
  addStatus: (dummyId: number, statusId: number) => void;

  // Remove a status from a dummy
  removeStatus: (dummyId: number, statusId: number) => void;

  // Reset a dummy to default stats
  resetDummy: (id: number) => void;

  // Reset all dummies
  resetAll: () => void;

  // Get a dummy by ID
  getDummy: (id: number) => TrainingDummy | undefined;

  // Initialize dummies with default stats from schema
  initializeWithDefaults: () => void;
}

export function useTrainingDummies(options: UseTrainingDummiesOptions = {}): UseTrainingDummiesResult {
  const { statusDefRows = [], statRows = [], initialDummies = [] } = options;

  // Next ID counter for new dummies
  const [nextId, setNextId] = useState(() => {
    if (initialDummies.length > 0) {
      return Math.max(...initialDummies.map((d) => d.id)) + 1;
    }
    return 1;
  });

  // Current dummies state
  const [dummies, setDummies] = useState<TrainingDummy[]>(() => {
    if (initialDummies.length > 0) {
      return initialDummies;
    }
    // Start with one default dummy
    return [createDefaultDummy(1, statRows)];
  });

  // Add a new dummy
  const addDummy = useCallback(
    (config?: TrainingDummyConfig): number => {
      const id = nextId;
      setNextId((n) => n + 1);

      let newDummy: TrainingDummy;
      if (config) {
        newDummy = createDummyFromConfig(id, config, statusDefRows);
      } else {
        newDummy = createDefaultDummy(id, statRows);
      }

      setDummies((prev) => [...prev, newDummy]);
      return id;
    },
    [nextId, statusDefRows, statRows]
  );

  // Remove a dummy by ID
  const removeDummy = useCallback((id: number) => {
    setDummies((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Rename a dummy
  const renameDummy = useCallback((id: number, name: string) => {
    setDummies((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name } : d))
    );
  }, []);

  // Set a stat on a dummy
  const setStat = useCallback((dummyId: number, statId: number, value: number) => {
    setDummies((prev) =>
      prev.map((d) => (d.id === dummyId ? setDummyStat(d, statId, value) : d))
    );
  }, []);

  // Modify a stat on a dummy
  const modifyStat = useCallback((dummyId: number, statId: number, delta: number) => {
    setDummies((prev) =>
      prev.map((d) => (d.id === dummyId ? modifyDummyStat(d, statId, delta) : d))
    );
  }, []);

  // Add a status to a dummy
  const addStatus = useCallback(
    (dummyId: number, statusId: number) => {
      setDummies((prev) =>
        prev.map((d) => {
          if (d.id !== dummyId) return d;

          const newStatusIds = new Set(d.activeStatusIds);
          newStatusIds.add(statusId);

          return {
            ...d,
            activeStatusIds: newStatusIds,
          };
        })
      );
    },
    []
  );

  // Remove a status from a dummy
  const removeStatus = useCallback(
    (dummyId: number, statusId: number) => {
      setDummies((prev) =>
        prev.map((d) => {
          if (d.id !== dummyId) return d;

          const newStatusIds = new Set(d.activeStatusIds);
          newStatusIds.delete(statusId);

          const newCategoryMap = new Map(d.statusCategoryMap);
          newCategoryMap.delete(statusId);

          return {
            ...d,
            activeStatusIds: newStatusIds,
            statusCategoryMap: newCategoryMap,
          };
        })
      );
    },
    []
  );

  // Reset a dummy to default stats
  const resetDummy = useCallback(
    (id: number) => {
      setDummies((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          return createDefaultDummy(d.id, statRows, d.name);
        })
      );
    },
    [statRows]
  );

  // Reset all dummies
  const resetAll = useCallback(() => {
    setDummies([createDefaultDummy(1, statRows)]);
    setNextId(2);
  }, [statRows]);

  // Get a dummy by ID
  const getDummy = useCallback(
    (id: number): TrainingDummy | undefined => {
      return dummies.find((d) => d.id === id);
    },
    [dummies]
  );

  // Initialize dummies with default stats from schema
  const initializeWithDefaults = useCallback(() => {
    setDummies((prev) =>
      prev.map((d) => {
        const defaults = getDefaultStats(statRows);
        const newStats = new Map(d.stats);

        // Only set defaults for stats not already set
        for (const [statId, value] of defaults) {
          if (!newStats.has(statId)) {
            newStats.set(statId, value);
          }
        }

        return { ...d, stats: newStats };
      })
    );
  }, [statRows]);

  return {
    dummies,
    addDummy,
    removeDummy,
    renameDummy,
    setStat,
    modifyStat,
    addStatus,
    removeStatus,
    resetDummy,
    resetAll,
    getDummy,
    initializeWithDefaults,
  };
}

/**
 * Get default stats from schema
 * Uses Stat.DefaultValue if available
 */
function getDefaultStats(statRows: Row[]): Map<number, number> {
  const defaults = new Map<number, number>();

  for (const row of statRows) {
    const id = num(row.ID);
    if (id <= 0) continue;

    // Check for DefaultValue field
    const defaultValue = num(row.DefaultValue, 0);
    if (defaultValue !== 0) {
      defaults.set(id, defaultValue);
    }
  }

  return defaults;
}

/**
 * Create a default dummy with schema-based default stats
 */
function createDefaultDummy(id: number, statRows: Row[], name?: string): TrainingDummy {
  const dummy = createEmptyDummy(id, name);
  const defaults = getDefaultStats(statRows);

  // Copy defaults to dummy stats
  for (const [statId, value] of defaults) {
    dummy.stats.set(statId, value);
  }

  return dummy;
}
