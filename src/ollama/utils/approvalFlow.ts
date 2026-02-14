import type { OllamaFreedomLevel, ApprovalRequest, ApprovalResponse } from '../types';

/**
 * Approval flow for Ollama function calls based on freedom level.
 * Determines when user approval is required before executing functions.
 */

export interface ApprovalCheckResult {
  needsApproval: boolean;
  reason?: string;
}

/**
 * Check if a function call requires user approval
 */
export function checkApprovalNeeded(
  functionName: string,
  args: Record<string, any>,
  freedomLevel: OllamaFreedomLevel,
  requiresApproval: boolean
): ApprovalCheckResult {
  // Safety: if function name is missing, deny by default
  if (!functionName || typeof functionName !== 'string') {
    console.error('[Approval] Invalid function name:', functionName);
    return {
      needsApproval: true,
      reason: 'Invalid function name - cannot determine approval requirements',
    };
  }

  // Conservative: everything except query functions needs approval
  if (freedomLevel === 'conservative') {
    if (requiresApproval || functionName !== 'getDesignGuidance') {
      return {
        needsApproval: true,
        reason: 'Conservative mode requires approval for all actions',
      };
    }
  }

  // Autonomous: nothing needs approval
  if (freedomLevel === 'autonomous') {
    return { needsApproval: false };
  }

  // Balanced: selective approvals based on function category and impact
  if (freedomLevel === 'balanced') {
    // Query functions never need approval (except webFetch)
    const queryFunctions = [
      'getCharacterState',
      'getDummyState',
      'getAbilityInfo',
      'getPerkInfo',
      'getStatInfo',
      'getSchemaStructure',
      'getDiceConfig',
      'getDesignGuidance',
      'getSystemOverview',
      'listSkills',
      'listPerks',
      'listStats',
      'listAbilities',
      'listStatuses',
      'listRunes',
      'readRefinements',
      'updateRefinements',
      'listDocsFiles',
      'readDocsFile',
      'readMemory',
      'writeMemory',
    ];

    if (queryFunctions.includes(functionName)) {
      return { needsApproval: false };
    }

    // Web fetch requires approval in balanced mode (external resource access)
    if (functionName === 'webFetch') {
      const url = args.url || 'unknown URL';
      return {
        needsApproval: true,
        reason: `Fetching external URL: ${url}`,
      };
    }

    // Character functions: approve significant changes
    if (functionName === 'allocateStat') {
      const points = Math.abs(args.points || 0);
      if (points <= 2) {
        // Small adjustments don't need approval
        return { needsApproval: false };
      }
      return {
        needsApproval: true,
        reason: `Allocating ${args.points} points is a significant change`,
      };
    }

    if (functionName === 'selectPerk' || functionName === 'deselectPerk') {
      // Perk selection always needs approval in balanced mode
      return {
        needsApproval: true,
        reason: 'Perk changes affect character build significantly',
      };
    }

    if (functionName === 'setStatCurrent') {
      // Setting current stats (HP, mana) doesn't need approval - testing/debugging
      return { needsApproval: false };
    }

    if (functionName === 'toggleStatus') {
      // Status toggles don't need approval - combat testing
      return { needsApproval: false };
    }

    // Schema functions: create/delete need approval, minor edits don't
    if (functionName.startsWith('create') || functionName.startsWith('delete')) {
      return {
        needsApproval: true,
        reason: 'Creating or deleting schema elements requires approval',
      };
    }

    if (functionName.startsWith('update')) {
      // Check what's being updated
      if (args.updates && (args.updates.Name || args.updates.Description)) {
        // Name/description edits are minor
        return { needsApproval: false };
      }
      return {
        needsApproval: true,
        reason: 'Updating formulas or costs requires approval',
      };
    }

    // Combat functions always need approval in balanced mode
    if (functionName.includes('Dummy') || functionName.includes('Ability') || functionName === 'endTurn') {
      return {
        needsApproval: true,
        reason: 'Combat actions require approval',
      };
    }

    // Default: require approval if function itself requires it
    if (requiresApproval) {
      return {
        needsApproval: true,
        reason: 'Function requires approval',
      };
    }

    return { needsApproval: false };
  }

  // Fallback: require approval
  return { needsApproval: true, reason: 'Unknown freedom level' };
}

/**
 * Create an approval request object
 */
export function createApprovalRequest(
  functionName: string,
  args: Record<string, any>,
  description?: string
): ApprovalRequest {
  // Determine impact level
  let impact: 'low' | 'medium' | 'high' = 'medium';

  if (functionName === 'webFetch') {
    impact = 'low'; // Just fetching information
  } else if (functionName.startsWith('create') || functionName.startsWith('delete')) {
    impact = 'high';
  } else if (functionName.startsWith('update')) {
    impact = 'medium';
  } else if (functionName === 'selectPerk' || functionName === 'deselectPerk') {
    impact = 'high';
  } else if (functionName === 'allocateStat' && Math.abs(args.points || 0) > 5) {
    impact = 'high';
  }

  return {
    functionName,
    description: description || `Execute ${functionName}`,
    args,
    impact,
  };
}

/**
 * Request approval from user (to be called by agent)
 * Returns a promise that resolves when user responds
 */
export async function requestApproval(
  request: ApprovalRequest,
  onRequest: (request: ApprovalRequest) => Promise<ApprovalResponse>
): Promise<ApprovalResponse> {
  return await onRequest(request);
}

/**
 * Format approval request for display
 */
export function formatApprovalRequest(request: ApprovalRequest): string {
  let message = `Sigil wants to ${request.description}\n\n`;
  message += `Function: ${request.functionName}\n`;
  message += `Arguments:\n`;

  for (const [key, value] of Object.entries(request.args)) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    message += `  ${key}: ${valueStr}\n`;
  }

  message += `\nImpact: ${request.impact}`;

  return message;
}
