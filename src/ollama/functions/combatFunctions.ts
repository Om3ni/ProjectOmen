import type { FunctionHandler, OllamaFunction } from '../types';

/**
 * Combat functions - control training dummies and execute combat actions.
 * These functions allow Ollama to participate in combat sparring.
 */

/**
 * Create a training dummy
 */
export const createDummy: FunctionHandler = async (args, context) => {
  try {
    const { trainingDummies } = context;

    if (!trainingDummies) {
      return { success: false, error: 'Training dummies system not available' };
    }

    const { name, config } = args;

    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Name is required and must be a string' };
    }

    // Create dummy with default or provided config
    const dummyConfig = {
      name,
      maxHp: 100,
      currentHp: 100,
      stats: {},
      statuses: [],
      ...config,
    };

    // Add dummy via training dummies hook
    const dummyId = trainingDummies.addDummy(dummyConfig);

    return {
      success: true,
      data: {
        dummyId,
        dummyName: name,
        message: `Created training dummy "${name}" with ID ${dummyId}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create dummy: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Update a training dummy's properties
 */
export const updateDummy: FunctionHandler = async (args, context) => {
  try {
    const { trainingDummies } = context;

    if (!trainingDummies) {
      return { success: false, error: 'Training dummies system not available' };
    }

    const { dummyId, updates } = args;

    if (!dummyId || !Number.isFinite(dummyId)) {
      return { success: false, error: 'Valid dummyId is required' };
    }

    if (!updates || typeof updates !== 'object') {
      return { success: false, error: 'Updates object is required' };
    }

    const dummy = trainingDummies.getDummy(dummyId);
    if (!dummy) {
      return { success: false, error: `Dummy with ID ${dummyId} not found` };
    }

    // Update dummy
    trainingDummies.updateDummy(dummyId, updates);

    return {
      success: true,
      data: {
        dummyId,
        dummyName: dummy.name,
        updatedFields: Object.keys(updates),
        message: `Updated dummy "${dummy.name}" (ID ${dummyId})`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update dummy: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Delete a training dummy
 */
export const deleteDummy: FunctionHandler = async (args, context) => {
  try {
    const { trainingDummies } = context;

    if (!trainingDummies) {
      return { success: false, error: 'Training dummies system not available' };
    }

    const { dummyId } = args;

    if (!dummyId || !Number.isFinite(dummyId)) {
      return { success: false, error: 'Valid dummyId is required' };
    }

    const dummy = trainingDummies.getDummy(dummyId);
    if (!dummy) {
      return { success: false, error: `Dummy with ID ${dummyId} not found` };
    }

    const dummyName = dummy.name;

    // Remove dummy
    trainingDummies.removeDummy(dummyId);

    return {
      success: true,
      data: {
        dummyId,
        dummyName,
        message: `Deleted training dummy "${dummyName}" (ID ${dummyId})`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete dummy: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Execute an ability in combat
 */
export const executeAbility: FunctionHandler = async (args, context) => {
  try {
    const { combatExecution, chatState } = context;

    if (!combatExecution) {
      return { success: false, error: 'Combat execution system not available' };
    }

    const { abilityId, targetIds } = args;

    if (!abilityId || !Number.isFinite(abilityId)) {
      return { success: false, error: 'Valid abilityId is required' };
    }

    if (!Array.isArray(targetIds)) {
      return { success: false, error: 'targetIds must be an array' };
    }

    // Execute ability via combat execution hook
    const result = await combatExecution.executeAbility(abilityId, targetIds);

    // Log to chat if available
    if (chatState && result.success) {
      const logMessage = result.data?.logMessage || `Executed ability ${abilityId}`;
      chatState.addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: logMessage,
        timestamp: Date.now(),
      });
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute ability: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * End the current combat turn
 */
export const endTurn: FunctionHandler = async (_args, context) => {
  try {
    const { combatExecution, chatState } = context;

    if (!combatExecution) {
      return { success: false, error: 'Combat execution system not available' };
    }

    // End turn via combat execution hook
    const result = combatExecution.endTurn();

    // Log to chat if available
    if (chatState && result.success) {
      chatState.addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: 'Turn ended',
        timestamp: Date.now(),
      });
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to end turn: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Function definitions for Ollama
export const combatFunctionDefinitions: OllamaFunction[] = [
  {
    name: 'createDummy',
    description: 'Create a training dummy for combat testing',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the training dummy',
        },
        config: {
          type: 'object',
          description: 'Optional configuration (maxHp, currentHp, stats, statuses)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'updateDummy',
    description: 'Update properties of a training dummy',
    parameters: {
      type: 'object',
      properties: {
        dummyId: {
          type: 'number',
          description: 'ID of the dummy to update',
        },
        updates: {
          type: 'object',
          description: 'Object containing fields to update',
        },
      },
      required: ['dummyId', 'updates'],
    },
  },
  {
    name: 'deleteDummy',
    description: 'Delete a training dummy',
    parameters: {
      type: 'object',
      properties: {
        dummyId: {
          type: 'number',
          description: 'ID of the dummy to delete',
        },
      },
      required: ['dummyId'],
    },
  },
  {
    name: 'executeAbility',
    description: 'Execute an ability on one or more targets',
    parameters: {
      type: 'object',
      properties: {
        abilityId: {
          type: 'number',
          description: 'ID of the ability to execute',
        },
        targetIds: {
          type: 'array',
          description: 'Array of target IDs (dummy IDs or player ID)',
        },
      },
      required: ['abilityId', 'targetIds'],
    },
  },
  {
    name: 'endTurn',
    description: 'End the current combat turn',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// Export all combat functions as a single object
export const combatFunctions = {
  createDummy,
  updateDummy,
  deleteDummy,
  executeAbility,
  endTurn,
};
