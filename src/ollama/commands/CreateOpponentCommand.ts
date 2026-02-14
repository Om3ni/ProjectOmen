import type { CommandHandler, AiCharacter } from '../types';
import { OllamaAgent } from '../OllamaAgent';
import { generateAiCharacterId, addAiCharacter } from '../storage/AiCharacterStorage';

/**
 * /create-opponent [level] [role] - Create AI character sheet
 *
 * Example: /create-opponent 10 tank
 * Example: /create-opponent 5 healer
 */

// Store active agent per context
const activeAgents = new Map<string, OllamaAgent>();

function getContextKey(_context: any): string {
  return 'default';
}

export const createOpponentCommandHandler: CommandHandler = async (content, context) => {
  const { settings, chatState, editorState } = context;

  // Parse command: /create-opponent [level] [role]
  const parts = content.trim().split(/\s+/);
  const level = parts[1] ? parseInt(parts[1], 10) : 5;
  const role = parts[2] || 'balanced';

  if (!Number.isFinite(level) || level < 1) {
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'system',
      content: 'Usage: /create-opponent [level] [role]\n\nExample: /create-opponent 10 tank\nRoles: tank, healer, dps, balanced',
      timestamp: Date.now(),
    });
    return true;
  }

  // Show user message
  chatState.addMessage({
    id: Date.now().toString(),
    type: 'user',
    content: 'Create level ' + level + ' ' + role + ' opponent',
    timestamp: Date.now(),
  });

  // Show thinking indicator
  const thinkingId = 'thinking-' + Date.now();
  chatState.addMessage({
    id: thinkingId,
    type: 'system',
    content: '🤔 Sigil is designing the character...',
    timestamp: Date.now(),
  });

  try {
    // Get or create agent
    const contextKey = getContextKey(context);
    let agent = activeAgents.get(contextKey);

    if (!agent) {
      agent = new OllamaAgent({
        settings: settings.ollama,
        context,
      });
      activeAgents.set(contextKey, agent);
    }

    // Construct prompt for character creation
    const roleDescription = role === 'tank' ? 'High HP, defense, low damage' :
                           role === 'healer' ? 'Medium HP, support abilities, healing' :
                           role === 'dps' ? 'Low HP, high damage output' :
                           'Medium stats across the board';

    const prompt = 'Create a level ' + level + ' ' + role + ' character for the RPR system.\n\nRole: ' + role + '\n- ' + roleDescription + '\n\nBuild a character by:\n1. Use getSchemaStructure() to understand available stats and perks\n2. Use allocateStat() to distribute ' + (level * 5) + ' stat points (estimate based on level)\n3. Use selectPerk() to choose ' + Math.floor(level / 2) + ' perks that fit the ' + role + ' role\n4. Balance the character for level ' + level + ' power\n\nAfter building, respond with a summary of the character build (stats allocated and perks chosen).';

    // Get response from agent
    const response = await agent.sendMessage(prompt);

    // Remove thinking indicator
    if (chatState.removeMessage) {
      chatState.removeMessage(thinkingId);
    }

    // Create AI character record
    const aiCharacter: AiCharacter = {
      id: generateAiCharacterId(),
      name: role.charAt(0).toUpperCase() + role.slice(1) + ' Lv' + level,
      level,
      role,
      allocations: Array.from((editorState.allocations || new Map()).entries()),
      chosenPerks: editorState.chosenPerks || [],
      activeStatuses: [],
      statCurrentValues: Array.from((editorState.statCurrentValues || new Map()).entries()),
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    // Save to storage
    addAiCharacter(aiCharacter);

    // Show AI response
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'assistant',
      content: response.content + '\n\n✓ Character saved as "' + aiCharacter.name + '" (ID: ' + aiCharacter.id + ')',
      timestamp: Date.now(),
    });

  } catch (error) {
    // Remove thinking indicator
    if (chatState.removeMessage) {
      chatState.removeMessage(thinkingId);
    }

    // Show error
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'error',
      content: 'Failed to create opponent: ' + (error instanceof Error ? error.message : String(error)),
      timestamp: Date.now(),
    });
  }

  return true;
};
