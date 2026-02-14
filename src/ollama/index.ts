/**
 * Ollama Integration Module
 * Public API exports for integrating Ollama AI assistance into the RPR Parser Editor.
 *
 * The local Ollama model handles "soft skills": explanations, brainstorming,
 * descriptions, flavor text, and RPR knowledge Q&A.
 *
 * Tool calling (schema mutations, character sheet changes) is preserved in
 * the functions/ directory for a future cloud LLM API integration.
 *
 * This module is designed to be completely removable - delete this folder and
 * remove imports from ChatPanel.tsx, SettingsModal.tsx, and CharacterSheetModal.tsx
 * to disable Ollama features.
 */

import type { Settings } from '@/services/SettingsService';
import type { OllamaContext, CommandHandler } from './types';
import {
  ollamaCommandHandler,
  sparCommandHandler,
  createOpponentCommandHandler,
  aiTurnCommandHandler,
} from './commands';

export * from './types';
export { documentationLoader, getDesignGuidance } from './utils/documentationLoader';
export * from './storage/AiCharacterStorage';

/**
 * Initialize Ollama module.
 * Tool registration is no longer needed for the local model (chat-only).
 * Function registry and tool definitions are preserved in functions/ for
 * future cloud LLM API integration.
 */
export function initializeOllama(): void {
  // No-op — local model is chat-only, no tool registration needed.
  // Tool definitions remain in src/ollama/functions/ for cloud LLM API use.
}

/**
 * Check if Ollama is enabled in settings
 */
export function isOllamaEnabled(settings: Settings): boolean {
  return settings.ollama?.enabled === true;
}

/**
 * Handle chat commands for Ollama
 * Returns true if command was handled, false otherwise
 */
export async function handleOllamaCommand(
  content: string,
  context: OllamaContext
): Promise<boolean> {
  // Safety check
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check if it's an Ollama command
  const lowerContent = content.toLowerCase();

  if (lowerContent.startsWith('/ollama ') || lowerContent === '/ollama') {
    return await ollamaCommandHandler(content, context);
  }

  if (lowerContent.startsWith('/spar') || lowerContent === '/spar') {
    return await sparCommandHandler(content, context);
  }

  if (lowerContent.startsWith('/create-opponent') || lowerContent === '/create-opponent') {
    return await createOpponentCommandHandler(content, context);
  }

  if (lowerContent.startsWith('/ai-turn') || lowerContent === '/ai-turn') {
    return await aiTurnCommandHandler(content, context);
  }

  return false;
}

/**
 * Register Ollama commands with the chat system
 */
export function registerOllamaCommands(
  addCommand: (name: string, handler: CommandHandler) => void
): void {
  addCommand('ollama', ollamaCommandHandler);
  addCommand('spar', sparCommandHandler);
  addCommand('create-opponent', createOpponentCommandHandler);
  addCommand('ai-turn', aiTurnCommandHandler);
}

// Component exports
export { OllamaSettingsPanel } from './components/OllamaSettingsPanel';
export { AiCharactersTab } from './components/AiCharactersTab';
