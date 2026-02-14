import type { FunctionHandler, OllamaFunction } from '../types';

/**
 * Character functions: Modify player character sheet.
 * These functions require approval based on freedom level.
 */

// Allocate points to a stat (attribute or skill)
export const allocateStat: FunctionHandler = async (args, context) => {
  const { statId, points } = args;

  try {
    const { editorState } = context;
    const { allocations } = editorState;

    // Validate statId
    const skillDefs = Array.isArray(editorState.data?.SkillDef) ? editorState.data.SkillDef : [];
    const skill = skillDefs.find((s: any) => Number(s.ID ?? s['Node ID']) === Number(statId));
    if (!skill) {
      return { success: false, error: `Stat ${statId} not found` };
    }

    // Get current allocation
    const current = allocations.get(statId) || 0;
    const newAmount = current + points;

    if (newAmount < 0) {
      return { success: false, error: `Cannot allocate negative total (current: ${current}, change: ${points})` };
    }

    // Update allocation via React setter if available, otherwise direct mutation
    if (context.updateCharacterState) {
      context.updateCharacterState({ type: 'allocateStat', statId, points });
    } else {
      allocations.set(statId, newAmount);
    }

    return {
      success: true,
      data: {
        statId,
        statName: skill.Name,
        oldAmount: current,
        newAmount,
        change: points,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Select a perk
export const selectPerk: FunctionHandler = async (args, context) => {
  const { perkId } = args;

  try {
    const { editorState } = context;
    const { chosenPerks } = editorState;

    // Validate perkId
    const perkDefs = Array.isArray(editorState.data?.PerkDef) ? editorState.data.PerkDef : [];
    const perk = perkDefs.find((p: any) => Number(p.ID) === Number(perkId));
    if (!perk) {
      return { success: false, error: `Perk ${perkId} not found` };
    }

    // Check if already selected
    if (chosenPerks.includes(perkId)) {
      return { success: false, error: `Perk ${perkId} (${perk.Name}) already selected` };
    }

    // Add perk via React setter if available, otherwise direct mutation
    if (context.updateCharacterState) {
      context.updateCharacterState({ type: 'selectPerk', perkId });
    } else {
      chosenPerks.push(perkId);
    }

    return {
      success: true,
      data: {
        perkId,
        perkName: perk.Name,
        perkCost: perk.Cost,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Deselect a perk
export const deselectPerk: FunctionHandler = async (args, context) => {
  const { perkId } = args;

  try {
    const { editorState } = context;
    const { chosenPerks } = editorState;

    // Validate perkId
    const perkDefs = Array.isArray(editorState.data?.PerkDef) ? editorState.data.PerkDef : [];
    const perk = perkDefs.find((p: any) => Number(p.ID) === Number(perkId));
    if (!perk) {
      return { success: false, error: `Perk ${perkId} not found` };
    }

    // Check if selected
    const index = chosenPerks.indexOf(perkId);
    if (index === -1) {
      return { success: false, error: `Perk ${perkId} (${perk.Name}) not selected` };
    }

    // Remove perk via React setter if available, otherwise direct mutation
    if (context.updateCharacterState) {
      context.updateCharacterState({ type: 'deselectPerk', perkId });
    } else {
      chosenPerks.splice(index, 1);
    }

    return {
      success: true,
      data: {
        perkId,
        perkName: perk.Name,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Set current value of a stat (for HP, mana, etc.)
export const setStatCurrent: FunctionHandler = async (args, context) => {
  const { statId, value } = args;

  try {
    const { editorState } = context;
    const { statCurrentValues } = editorState;

    // Validate statId
    const statDefs = Array.isArray(editorState.data?.Stat) ? editorState.data.Stat : [];
    const stat = statDefs.find((s: any) => Number(s.ID) === Number(statId));
    if (!stat) {
      return { success: false, error: `Stat ${statId} not found` };
    }

    if (value < 0) {
      return { success: false, error: `Cannot set stat to negative value: ${value}` };
    }

    // Update current value via React setter if available, otherwise direct mutation
    if (context.updateCharacterState) {
      context.updateCharacterState({ type: 'setStatCurrent', statId, value });
    } else {
      statCurrentValues.set(statId, value);
    }

    return {
      success: true,
      data: {
        statId,
        statName: stat.Name,
        newValue: value,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Toggle a status on/off
export const toggleStatus: FunctionHandler = async (args, context) => {
  const { statusId, active } = args;

  try {
    const { editorState } = context;
    const { activeStatuses } = editorState;

    // Validate statusId
    const statusDefs = Array.isArray(editorState.data?.StatusDef) ? editorState.data.StatusDef : [];
    const status = statusDefs.find((s: any) => Number(s.ID) === Number(statusId));
    if (!status) {
      return { success: false, error: `Status ${statusId} not found` };
    }

    const index = activeStatuses.indexOf(statusId);
    const currentlyActive = index !== -1;

    if (active && !currentlyActive) {
      if (context.updateCharacterState) {
        context.updateCharacterState({ type: 'toggleStatus', statusId, active: true });
      } else {
        activeStatuses.push(statusId);
      }
    } else if (!active && currentlyActive) {
      if (context.updateCharacterState) {
        context.updateCharacterState({ type: 'toggleStatus', statusId, active: false });
      } else {
        activeStatuses.splice(index, 1);
      }
    } else {
      return {
        success: false,
        error: `Status ${statusId} (${status.Name}) is already ${active ? 'active' : 'inactive'}`,
      };
    }

    return {
      success: true,
      data: {
        statusId,
        statusName: status.Name,
        active,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Function definitions for Ollama
export const characterFunctionDefinitions: OllamaFunction[] = [
  {
    name: 'allocateStat',
    description: 'Allocate points to an attribute or skill. Use positive points to add, negative to remove.',
    parameters: {
      type: 'object',
      properties: {
        statId: {
          type: 'number',
          description: 'ID of the stat (from SkillDef table)',
        },
        points: {
          type: 'number',
          description: 'Number of points to allocate (positive or negative)',
        },
      },
      required: ['statId', 'points'],
    },
  },
  {
    name: 'selectPerk',
    description: 'Select a perk for the character',
    parameters: {
      type: 'object',
      properties: {
        perkId: {
          type: 'number',
          description: 'ID of the perk (from PerkDef table)',
        },
      },
      required: ['perkId'],
    },
  },
  {
    name: 'deselectPerk',
    description: 'Deselect a previously selected perk',
    parameters: {
      type: 'object',
      properties: {
        perkId: {
          type: 'number',
          description: 'ID of the perk to deselect',
        },
      },
      required: ['perkId'],
    },
  },
  {
    name: 'setStatCurrent',
    description: 'Set the current value of a stat (e.g., HP, Mana). Use for damage, healing, or resource management.',
    parameters: {
      type: 'object',
      properties: {
        statId: {
          type: 'number',
          description: 'ID of the stat (from Stat table)',
        },
        value: {
          type: 'number',
          description: 'New current value',
        },
      },
      required: ['statId', 'value'],
    },
  },
  {
    name: 'toggleStatus',
    description: 'Activate or deactivate a status effect on the character',
    parameters: {
      type: 'object',
      properties: {
        statusId: {
          type: 'number',
          description: 'ID of the status (from StatusDef table)',
        },
        active: {
          type: 'boolean',
          description: 'true to activate, false to deactivate',
        },
      },
      required: ['statusId', 'active'],
    },
  },
];

// Export all handlers
export const characterFunctions = {
  allocateStat,
  selectPerk,
  deselectPerk,
  setStatCurrent,
  toggleStatus,
};
