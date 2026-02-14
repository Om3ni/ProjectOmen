import type { CommandHandler } from '../types';
import { OllamaAgent } from '../OllamaAgent';

/**
 * /ai-turn - Let Ollama take its combat turn
 *
 * AI analyzes combat state and executes an ability.
 */

// Store active agent per context
const activeAgents = new Map<string, OllamaAgent>();

function getContextKey(_context: any): string {
  return 'default';
}

export const aiTurnCommandHandler: CommandHandler = async (_content, context) => {
  const { settings, chatState, combatExecution } = context;

  // Check if combat system is available
  if (!combatExecution) {
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'system',
      content: 'Combat execution system not available. This command requires useCombatExecution hook.',
      timestamp: Date.now(),
    });
    return true;
  }

  // Show user message
  chatState.addMessage({
    id: Date.now().toString(),
    type: 'user',
    content: 'AI take your turn',
    timestamp: Date.now(),
  });

  // Show thinking indicator
  const thinkingId = 'thinking-' + Date.now();
  chatState.addMessage({
    id: thinkingId,
    type: 'system',
    content: '🤔 AI is analyzing combat situation...',
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

    // Construct prompt for AI turn
    const prompt = 'Analyze the current combat situation and take your turn.\n\n' +
      'Steps:\n' +
      '1. Use getCharacterState() to see your current HP and resources\n' +
      '2. Use getDummyState() to see enemy targets\n' +
      '3. Use getAbilityInfo() to check available abilities\n' +
      '4. Choose the best ability based on:\n' +
      '   - Your health (heal if low)\n' +
      '   - Enemy health (finish weak targets)\n' +
      '   - Resource efficiency\n' +
      '5. Use executeAbility() with the chosen ability and target(s)\n' +
      '6. Use endTurn() to complete your turn\n\n' +
      'Explain your tactical reasoning briefly.';

    // Get response from agent
    const response = await agent.sendMessage(prompt);

    // Remove thinking indicator
    if (chatState.removeMessage) {
      chatState.removeMessage(thinkingId);
    }

    // Show AI response
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'assistant',
      content: response.content,
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
      content: 'AI turn failed: ' + (error instanceof Error ? error.message : String(error)),
      timestamp: Date.now(),
    });
  }

  return true;
};
