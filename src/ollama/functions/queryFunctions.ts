import type { FunctionHandler, OllamaFunction } from '../types';
import { getDesignGuidance } from '../utils/documentationLoader';

/**
 * Query functions: Read-only operations that don't modify state.
 * These functions never require approval.
 */

// Get current player character state
export const getCharacterState: FunctionHandler = async (_args, context) => {
  try {
    const { editorState } = context;
    const { allocations, chosenPerks, statCurrentValues } = editorState;

    return {
      success: true,
      data: {
        allocations: Array.from(allocations.entries() as Iterable<[number, number]>).map(([id, amt]) => ({ skillId: id, amount: amt })),
        perks: chosenPerks,
        currentStats: Array.from(statCurrentValues.entries() as Iterable<[number , number]>).map(([id, val]) => ({ statId: id, current: val })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get training dummy state
export const getDummyState: FunctionHandler = async (args, context) => {
  const { dummyId } = args;
  
  try {
    const { trainingDummies } = context;
    if (!trainingDummies) {
      return { success: false, error: 'Training dummies not available' };
    }

    const dummy = trainingDummies.dummies.find((d: any) => d.id === dummyId);
    if (!dummy) {
      return { success: false, error: `Dummy ${dummyId} not found` };
    }

    return {
      success: true,
      data: dummy,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get ability information
export const getAbilityInfo: FunctionHandler = async (args, context) => {
  const { abilityId } = args;

  try {
    const { editorState } = context;
    const data = editorState.data;

    if (!data) return { success: false, error: 'No data loaded' };

    const spellDefs = Array.isArray(data.SpellDef) ? data.SpellDef : [];
    const ability = spellDefs.find((spell: any) => Number(spell.ID) === Number(abilityId));
    if (!ability) {
      return { success: false, error: `Ability ${abilityId} not found` };
    }

    const spellEffects = Array.isArray(data.SpellEffect) ? data.SpellEffect : [];
    const effects = spellEffects.filter((effect: any) => Number(effect.SpellID) === Number(abilityId));

    const spellReqs = Array.isArray(data.SpellReqDef) ? data.SpellReqDef : [];
    const requirements = spellReqs.filter((req: any) => Number(req.SpellID) === Number(abilityId));

    return {
      success: true,
      data: {
        definition: ability,
        effects,
        requirements,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get perk information
export const getPerkInfo: FunctionHandler = async (args, context) => {
  const { perkId } = args;

  try {
    const { editorState } = context;
    const data = editorState.data;

    if (!data) return { success: false, error: 'No data loaded' };

    const perkDefs = Array.isArray(data.PerkDef) ? data.PerkDef : [];
    const perk = perkDefs.find((p: any) => Number(p.ID) === Number(perkId));
    if (!perk) {
      return { success: false, error: `Perk ${perkId} not found` };
    }

    const perkActions = Array.isArray(data.PerkAction) ? data.PerkAction : [];
    const actions = perkActions.filter((action: any) => Number(action.PerkID) === Number(perkId));

    return {
      success: true,
      data: {
        definition: perk,
        actions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get stat information
export const getStatInfo: FunctionHandler = async (args, context) => {
  const { statId } = args;

  try {
    const { editorState } = context;
    const data = editorState.data;

    if (!data) return { success: false, error: 'No data loaded' };

    const stats = Array.isArray(data.Stat) ? data.Stat : [];
    const stat = stats.find((s: any) => Number(s.ID) === Number(statId));
    if (!stat) {
      return { success: false, error: `Stat ${statId} not found` };
    }

    return {
      success: true,
      data: stat,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get schema structure overview
export const getSchemaStructure: FunctionHandler = async (_args, context) => {
  try {
    const { editorState } = context;
    const { schema } = editorState;

    return {
      success: true,
      data: schema,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get DiceConfig (system configuration)
export const getDiceConfig: FunctionHandler = async (_args, context) => {
  try {
    const { editorState } = context;
    const data = editorState.data;

    if (!data) return { success: false, error: 'No data loaded' };

    const diceConfigRows = Array.isArray(data.DiceConfig) ? data.DiceConfig : [];
    return {
      success: true,
      data: diceConfigRows[0] || null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// List all skills/attributes in the system
export const listSkills: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const skillDefs = Array.isArray(data.SkillDef) ? data.SkillDef : [];
    const summary = skillDefs.map((s: any) => ({
      id: Number(s['Node ID'] ?? s.ID),
      name: s.Name,
      type: String(s.TypeFlag) === 't' ? 'Attribute' : 'Skill',
      description: s.Description || '',
      bonusSource: s['Bonus Source'] || '',
      maxAllocation: s['Max Allocation'],
    }));

    return {
      success: true,
      data: {
        count: summary.length,
        attributes: summary.filter((s: any) => s.type === 'Attribute'),
        skills: summary.filter((s: any) => s.type === 'Skill'),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// List all perks in the system
export const listPerks: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const perkDefs = Array.isArray(data.PerkDef) ? data.PerkDef : [];
    const perkActions = Array.isArray(data.PerkAction) ? data.PerkAction : [];

    const summary = perkDefs.map((p: any) => {
      const id = Number(p.ID);
      const actions = perkActions.filter((a: any) => Number(a.PerkID) === id);
      return {
        id,
        name: p.Name,
        description: p.Description || '',
        category: p.Category || '',
        cost: p.Cost,
        actionCount: actions.length,
      };
    });

    // Group by category
    const categories: Record<string, any[]> = {};
    for (const p of summary) {
      const cat = p.category || 'Uncategorized';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    }

    return {
      success: true,
      data: { count: summary.length, categories, perks: summary },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// List all stats in the system
export const listStats: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const stats = Array.isArray(data.Stat) ? data.Stat : [];
    const summary = stats.map((s: any) => ({
      id: Number(s.ID),
      name: s.Name,
      description: s.Description || '',
      base: s.Base,
      formula: s.Formula || '',
      public: s.Public,
    }));

    return {
      success: true,
      data: { count: summary.length, stats: summary },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// List all abilities in the system
export const listAbilities: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const spellDefs = Array.isArray(data.SpellDef) ? data.SpellDef : [];
    const spellEffects = Array.isArray(data.SpellEffect) ? data.SpellEffect : [];

    const summary = spellDefs.map((s: any) => {
      const id = Number(s.ID);
      const effects = spellEffects.filter((e: any) => Number(e.SpellID) === id);
      return {
        id,
        name: s.Name,
        description: s.Description || '',
        category: s.Category || '',
        range: s.Range,
        targetType: s.TargetType,
        effectCount: effects.length,
      };
    });

    // Group by category
    const categories: Record<string, any[]> = {};
    for (const a of summary) {
      const cat = a.category || 'Uncategorized';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(a);
    }

    return {
      success: true,
      data: { count: summary.length, categories, abilities: summary },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// List all statuses in the system
export const listStatuses: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const statusDefs = Array.isArray(data.StatusDef) ? data.StatusDef : [];
    const statusActions = Array.isArray(data.StatusAction) ? data.StatusAction : [];

    const summary = statusDefs.map((s: any) => {
      const id = Number(s.ID);
      const actions = statusActions.filter((a: any) => Number(a.StatusID) === id);
      return {
        id,
        name: s.Name,
        description: s.Description || '',
        public: s.Public,
        actionCount: actions.length,
      };
    });

    return {
      success: true,
      data: { count: summary.length, statuses: summary },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// List all runes/equipment in the system
export const listRunes: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const runeDefs = Array.isArray(data.RuneDef) ? data.RuneDef : [];
    const runeActions = Array.isArray(data.RuneAction) ? data.RuneAction : [];

    const summary = runeDefs.map((r: any) => {
      const id = Number(r.ID);
      const actions = runeActions.filter((a: any) => Number(a.RuneID) === id);
      return {
        id,
        name: r.Description || r.Name || `Rune ${id}`,
        runeSlot: r['Rune Slot'] || '',
        actionCount: actions.length,
      };
    });

    return {
      success: true,
      data: { count: summary.length, runes: summary },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// Get design guidance from documentation
export const getDesignGuidanceFunc: FunctionHandler = async (args, _context) => {
  const { topic } = args;

  try {
    const guidance = await getDesignGuidance(topic);
    return {
      success: true,
      data: guidance,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get a full snapshot of the loaded system (for context)
export const getSystemOverview: FunctionHandler = async (_args, context) => {
  try {
    const data = context.editorState?.data;
    if (!data) return { success: false, error: 'No data loaded' };

    const count = (table: string) => {
      const rows = data[table];
      return Array.isArray(rows) ? rows.length : 0;
    };

    const diceConfig = Array.isArray(data.DiceConfig) ? data.DiceConfig[0] : null;

    return {
      success: true,
      data: {
        diceConfig: diceConfig || 'Not configured',
        tableCounts: {
          SkillDef: count('SkillDef'),
          PerkDef: count('PerkDef'),
          PerkAction: count('PerkAction'),
          Stat: count('Stat'),
          RuneDef: count('RuneDef'),
          RuneAction: count('RuneAction'),
          StatusDef: count('StatusDef'),
          StatusAction: count('StatusAction'),
          MutatorDef: count('MutatorDef'),
          SpellDef: count('SpellDef'),
          SpellEffect: count('SpellEffect'),
          SpellReqDef: count('SpellReqDef'),
        },
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// Function definitions for Ollama
export const queryFunctionDefinitions: OllamaFunction[] = [
  {
    name: 'getCharacterState',
    description: 'Get current player character state (stat allocations, chosen perks, current stat values)',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getDummyState',
    description: 'Get state of a training dummy by ID',
    parameters: {
      type: 'object',
      properties: {
        dummyId: {
          type: 'number',
          description: 'ID of the training dummy',
        },
      },
      required: ['dummyId'],
    },
  },
  {
    name: 'getAbilityInfo',
    description: 'Get detailed information about an ability/spell by ID',
    parameters: {
      type: 'object',
      properties: {
        abilityId: {
          type: 'number',
          description: 'ID of the ability (SpellDef)',
        },
      },
      required: ['abilityId'],
    },
  },
  {
    name: 'getPerkInfo',
    description: 'Get detailed information about a perk by ID',
    parameters: {
      type: 'object',
      properties: {
        perkId: {
          type: 'number',
          description: 'ID of the perk (PerkDef)',
        },
      },
      required: ['perkId'],
    },
  },
  {
    name: 'getStatInfo',
    description: 'Get detailed information about a stat by ID',
    parameters: {
      type: 'object',
      properties: {
        statId: {
          type: 'number',
          description: 'ID of the stat',
        },
      },
      required: ['statId'],
    },
  },
  {
    name: 'getSchemaStructure',
    description: 'Get the RPR schema structure (available tables and fields)',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getDiceConfig',
    description: 'Get the DiceConfig (system configuration: point pools, caps, settings)',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getDesignGuidance',
    description: 'Search RPR design documentation for guidance on a specific topic (abilities, stats, perks, balance, combat)',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The design topic to search for (e.g., "damage scaling", "point buy", "buff caps")',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'getSystemOverview',
    description: 'Get an overview of the currently loaded RPR system - table counts, dice config, and system structure. Call this first to understand what system is loaded.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listSkills',
    description: 'List all skills and attributes in the loaded system with their IDs, names, types, and formulas',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listPerks',
    description: 'List all perks in the loaded system with their IDs, names, categories, costs, and action counts',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listStats',
    description: 'List all stats in the loaded system with their IDs, names, base values, and formulas',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listAbilities',
    description: 'List all abilities/spells in the loaded system with their IDs, names, categories, and effect counts',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listStatuses',
    description: 'List all status effects in the loaded system with their IDs, names, and action counts',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'listRunes',
    description: 'List all runes/equipment in the loaded system with their IDs, names, slots, and action counts',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Export all handlers
export const queryFunctions = {
  getCharacterState,
  getDummyState,
  getAbilityInfo,
  getPerkInfo,
  getStatInfo,
  getSchemaStructure,
  getDiceConfig,
  getDesignGuidance: getDesignGuidanceFunc,
  getSystemOverview,
  listSkills,
  listPerks,
  listStats,
  listAbilities,
  listStatuses,
  listRunes,
};
