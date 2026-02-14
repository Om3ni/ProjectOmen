import type { CommandHandler } from '../types';

/**
 * /spar [opponent-id] - Start combat sparring session
 *
 * Example: /spar ai-char-123456
 * Example: /spar (creates a new balanced opponent)
 */

export const sparCommandHandler: CommandHandler = async (content, context) => {
  const { chatState, combatExecution, trainingDummies } = context;

  // Check if combat systems are available
  if (!combatExecution || !trainingDummies) {
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'system',
      content: 'Combat systems not available. Combat features require useCombatExecution and useTrainingDummies hooks.',
      timestamp: Date.now(),
    });
    return true;
  }

  // Parse command: /spar [opponent-id]
  const parts = content.trim().split(/\s+/);
  const opponentId = parts[1] || null;

  // Show user message
  if (opponentId) {
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'user',
      content: 'Start sparring with ' + opponentId,
      timestamp: Date.now(),
    });
  } else {
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'user',
      content: 'Start sparring session',
      timestamp: Date.now(),
    });
  }

  try {
    // If opponent ID provided, try to load that AI character
    if (opponentId) {
      // For now, just acknowledge - full AI character loading in later iteration
      chatState.addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: 'Loading AI character ' + opponentId + '...\n\n(Note: AI character loading from storage will be fully implemented in Phase 6)',
        timestamp: Date.now(),
      });
    }

    // Initialize combat state
    const result = combatExecution.startCombat?.();

    if (result && result.success) {
      chatState.addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: '⚔️ Combat sparring session started!\n\nUse /ai-turn to let the AI opponent take their turn.\nUse /ollama to ask the AI for combat advice.\n\nAvailable abilities can be checked with: /ollama "What abilities can I use?"',
        timestamp: Date.now(),
      });
    } else {
      chatState.addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: '⚔️ Sparring mode activated!\n\nNote: Full combat system integration pending.\nYou can use:\n- /create-opponent to design AI opponents\n- /ollama to get combat advice\n- Combat execution functions once integrated',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    chatState.addMessage({
      id: Date.now().toString(),
      type: 'error',
      content: 'Failed to start sparring: ' + (error instanceof Error ? error.message : String(error)),
      timestamp: Date.now(),
    });
  }

  return true;
};
