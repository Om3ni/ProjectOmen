import type { CommandHandler, OllamaContext } from '../types';
import { OllamaAgent } from '../OllamaAgent';

/**
 * /ollama [question] - Design assistance command
 *
 * Starts or continues a conversation with the Ollama AI assistant
 * for RPR system design help.
 */

// Store active agent per context (simple in-memory store)
const activeAgents = new Map<string, OllamaAgent>();

function getContextKey(_context: OllamaContext): string {
  // Simple key based on settings - in practice might use user ID or session
  return 'default';
}

export const ollamaCommandHandler: CommandHandler = async (content, context) => {
  const { settings, chatState } = context;

  // Extract question from command
  const question = content.replace(/^\/ollama\s*/i, '').trim();

  if (!question) {
    chatState.addMessage({
      tab: 'local',
      sender: 'system',
      type: 'system',
      content: 'Usage: /ollama [question]\n\nExample: /ollama Create a fireball spell that deals 2d6+5 damage',
    });
    return true;
  }

  // Get or create agent for this context
  const contextKey = getContextKey(context);
  let agent = activeAgents.get(contextKey);

  if (!agent) {
    agent = new OllamaAgent({
      settings: settings.ollama,
      context,
    });
    activeAgents.set(contextKey, agent);
  }

  // Show user message
  chatState.addMessage({
    tab: 'local',
    sender: 'user',
    type: 'text',
    content: question,
  });

  // Show thinking indicator
  chatState.addMessage({
    tab: 'local',
    sender: 'system',
    type: 'system',
    content: '🤔 Sigil is thinking...',
  });

  try {
    // Get response from agent
    const response = await agent.sendMessage(question);

    // Show AI response
    chatState.addMessage({
      tab: 'local',
      sender: 'bot',
      type: 'llm-response',
      content: response.content,
    });

  } catch (error) {
    // Show error
    chatState.addMessage({
      tab: 'local',
      sender: 'system',
      type: 'error',
      content: `Sigil error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return true;
};

/**
 * Clear conversation history for /ollama
 */
export function clearOllamaConversation(context: OllamaContext): void {
  const contextKey = getContextKey(context);
  const agent = activeAgents.get(contextKey);
  if (agent) {
    agent.clearHistory();
  }
}
