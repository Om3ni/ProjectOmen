import { useCallback, useRef, useState } from 'react';

import { useChatState } from '@/hooks/useChatState';
import { parseRollCommand, formatRollResult } from '@/utils/diceRoller';
import { SettingsService } from '@/services/SettingsService';
import { handleOllamaCommand, isOllamaEnabled, initializeOllama } from '@/ollama';
import { OllamaAgent, type ContextUsage } from '@/ollama/OllamaAgent';
import type { OllamaContext } from '@/ollama/types';
import { loadConversation, createConversation, saveConversation } from '@/ollama/utils/conversationManager';

import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ConversationSelector } from './ConversationSelector';

type Props = {
  className?: string;
  /** Editor state (for Ollama integration) */
  editorState?: any;
  /** Combat execution system (for Ollama integration) */
  combatExecution?: any;
  /** Training dummies system (for Ollama integration) */
  trainingDummies?: any;
  /** Recent changes handler (for tracking modifications) */
  recentChangesHandler?: (change: Omit<import('@/contexts/PendingChangesContext').RecentChange, 'id' | 'timestamp' | 'undone'>) => string;
};

export function ChatPanel({ className = '', editorState, combatExecution, trainingDummies, recentChangesHandler }: Props) {
  const chatState = useChatState();
  const { addMessage, updateMessage, clearHistory, getMessages } = chatState;

  const settings = SettingsService.load();
  const ollamaAgentRef = useRef<OllamaAgent | null>(null);

  // Conversation state
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(undefined);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Callback to update editor data through React state (proper re-render)
  const updateEditorData = useCallback((nextData: Record<string, unknown>) => {
    // Use the internal setData if available (passed from useEditorState)
    if (editorState?.setData) {
      editorState.setData(nextData);
    }
  }, [editorState]);

  // Load conversation and restore history
  const handleConversationSelect = useCallback(async (conversationId: string, title: string) => {
    const conversation = await loadConversation(conversationId);
    if (!conversation) {
      console.error('[ChatPanel] Failed to load conversation:', conversationId);
      return;
    }

    // Clear current chat
    clearHistory('local');

    // Create new agent with conversation
    const ollamaContext: OllamaContext = {
      editorState,
      combatExecution,
      trainingDummies,
      chatState,
      settings,
      recentChangesHandler,
      updateEditorData,
    };

    ollamaAgentRef.current = new OllamaAgent({
      settings: settings.ollama,
      context: ollamaContext,
      conversationId: conversation.metadata.id,
    });

    // Load conversation history
    ollamaAgentRef.current.loadConversationHistory(conversation);

    // Update state
    setCurrentConversationId(conversationId);

    console.log(`[ChatPanel] Loaded conversation: ${title}`);
  }, [editorState, combatExecution, trainingDummies, chatState, settings, clearHistory, recentChangesHandler, updateEditorData]);

  // Start new conversation
  const handleNewConversation = useCallback(() => {
    clearHistory('local');
    ollamaAgentRef.current = null;
    setCurrentConversationId(undefined);
  }, [clearHistory]);

  const handleSend = useCallback(
    async (content: string) => {
      const ollamaEnabled = isOllamaEnabled(settings);
      const ollamaContext: OllamaContext = {
        editorState,
        combatExecution,
        trainingDummies,
        chatState,
        settings,
        recentChangesHandler,
        updateEditorData,
      };

      // Check for slash commands first
      if (content.trimStart().startsWith('/')) {
        // Try Ollama commands (if enabled)
        if (ollamaEnabled) {
          try {
            const handled = await handleOllamaCommand(content, ollamaContext);
            if (handled) {
              return; // Ollama handled the command
            }
          } catch (error) {
            addMessage({
              tab: 'local',
              sender: 'system',
              content: `Sigil error: ${error instanceof Error ? error.message : String(error)}`,
              type: 'error',
            });
            return;
          }
        }

        // Check for roll command
        const rollResult = parseRollCommand(content);
        if (rollResult) {
          addMessage({
            tab: 'local',
            sender: 'user',
            content: formatRollResult(rollResult),
            type: 'roll',
            metadata: {
              formula: rollResult.formula,
              rollResult,
            },
          });
          return;
        }

        // Unknown command
        addMessage({
          tab: 'local',
          sender: 'system',
          content: `Unknown command: ${content.trim()}`,
          type: 'system',
        });
        return;
      }

      // Not a slash command - if Ollama is enabled, send to Ollama
      if (ollamaEnabled) {
        // Initialize Ollama if needed
        initializeOllama();

        // Get or create agent
        if (!ollamaAgentRef.current) {
          ollamaAgentRef.current = new OllamaAgent({
            settings: settings.ollama,
            context: ollamaContext,
            conversationId: currentConversationId,
          });
        } else {
          // Refresh context so agent sees current selected record, active tab, etc.
          ollamaAgentRef.current.updateContext(ollamaContext);
        }

        // Show user message
        addMessage({
          tab: 'local',
          sender: 'user',
          type: 'text',
          content,
        });

        // Create placeholder bot message immediately (streaming will fill it)
        const placeholder = addMessage({
          tab: 'local',
          sender: 'bot',
          type: 'llm-response',
          content: '',
        });

        setIsGenerating(true);
        let streamedContent = '';

        try {
          // Stream response — onChunk updates the placeholder message progressively
          const response = await ollamaAgentRef.current.sendMessageStreaming(
            content,
            (chunk: string) => {
              streamedContent += chunk;
              updateMessage(placeholder.id, 'local', { content: streamedContent });
            }
          );

          // Final update with complete content (may differ if output gate triggered a retry)
          updateMessage(placeholder.id, 'local', {
            content: response.content || streamedContent || '(No response)',
          });

          // Update context usage
          if (response.contextUsage) {
            setContextUsage(response.contextUsage);
          }
        } catch (error) {
          // Don't show error for user-initiated aborts
          if (error instanceof DOMException && error.name === 'AbortError') {
            updateMessage(placeholder.id, 'local', {
              content: streamedContent || 'Iteration interrupted.',
            });
          } else {
            updateMessage(placeholder.id, 'local', {
              content: `Sigil error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        } finally {
          setIsGenerating(false);
        }
        return;
      }

      // Check for roll without slash
      const rollResult = parseRollCommand(content);
      if (rollResult) {
        addMessage({
          tab: 'local',
          sender: 'user',
          content: formatRollResult(rollResult),
          type: 'roll',
          metadata: {
            formula: rollResult.formula,
            rollResult,
          },
        });
        return;
      }

      // Regular text message (Ollama not enabled)
      addMessage({
        tab: 'local',
        sender: 'user',
        content,
        type: 'text',
      });
    },
    [addMessage, updateMessage, settings, editorState, combatExecution, trainingDummies, chatState, currentConversationId, recentChangesHandler, updateEditorData]
  );

  const currentMessages = getMessages('local');
  const ollamaEnabled = isOllamaEnabled(settings);

  // Stop current generation
  const handleStop = useCallback(() => {
    if (ollamaAgentRef.current) {
      ollamaAgentRef.current.abort();
    }
  }, []);

  // Save current conversation
  const handleSaveConversation = useCallback(async () => {
    if (!ollamaAgentRef.current) return;

    const agent = ollamaAgentRef.current;
    let convId = currentConversationId || agent.getConversationId();

    // If no conversation ID yet, create one
    if (!convId) {
      const firstUserMsg = currentMessages.find(m => m.sender === 'user');
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        : 'Untitled Conversation';

      const conv = await createConversation(title, '');
      convId = conv.metadata.id;
      setCurrentConversationId(convId);
    }

    // Save via the agent's history
    const history = agent.getHistory();
    await saveConversation({
      metadata: {
        id: convId,
        title: currentConversationId
          ? 'Saved Conversation'
          : (currentMessages.find(m => m.sender === 'user')?.content.slice(0, 50) || 'Untitled'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: history.length,
      },
      messages: history,
      systemPrompt: history[0]?.content || '',
    });

    addMessage({
      tab: 'local',
      sender: 'system',
      type: 'system',
      content: 'Conversation saved.',
    });
  }, [currentConversationId, currentMessages, addMessage]);

  return (
    <div className={`flex flex-col h-full overflow-hidden theme-bg-base ${className}`}>
      {/* Header */}
      <div className="flex flex-col border-b theme-border">
        <div className="flex items-center justify-between px-3 py-2">
          {ollamaEnabled ? (
            <ConversationSelector
              currentConversationId={currentConversationId}
              onConversationSelect={handleConversationSelect}
              onNewConversation={handleNewConversation}
              systemPrompt={''}  // System prompt is built by OllamaAgent
              isWizardMode={ollamaAgentRef.current?.isWizardMode?.() || false}
            />
          ) : (
            <div className="text-sm font-semibold theme-text">Chat</div>
          )}
          <div className="flex items-center gap-1">
            {ollamaEnabled && ollamaAgentRef.current && (
              <button
                type="button"
                onClick={handleSaveConversation}
                className="px-2 py-1 text-xs theme-text-muted hover:theme-text"
                title="Save conversation"
              >
                💾
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const messages = currentMessages
                  .map(m => `[${m.sender}] ${m.content}`)
                  .join('\n\n');
                navigator.clipboard.writeText(messages);
              }}
              className="px-2 py-1 text-xs theme-text-muted hover:theme-text"
              title="Copy chat to clipboard"
            >
              📋
            </button>
          </div>
        </div>
        {/* Model info bar */}
        {ollamaEnabled && (
          <div className="flex flex-col gap-1 px-3 py-1.5 text-xs theme-text-muted border-t theme-border theme-bg-muted">
            <div className="flex items-center gap-2">
              <span className="font-mono">{settings.ollama?.model || 'No model'}</span>
              <span className="opacity-50">·</span>
              <span>{settings.ollama?.freedomLevel || 'balanced'}</span>
              {currentConversationId && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="text-green-500">saved</span>
                </>
              )}
            </div>
            {contextUsage && contextUsage.contextWindow > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      contextUsage.percentUsed > 90 ? 'bg-red-500' :
                      contextUsage.percentUsed > 70 ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(contextUsage.percentUsed, 100)}%` }}
                  />
                </div>
                <span className={`font-mono whitespace-nowrap ${
                  contextUsage.percentUsed > 90 ? 'text-red-400' :
                  contextUsage.percentUsed > 70 ? 'text-yellow-400' : ''
                }`}>
                  {contextUsage.promptTokens.toLocaleString()}/{contextUsage.contextWindow.toLocaleString()} ctx
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <ChatMessageList messages={currentMessages} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        placeholder={
          ollamaEnabled
            ? 'Ask Sigil anything, or /roll 2d6...'
            : 'Type a message or /roll 2d6...'
        }
        disabled={isGenerating}
        isGenerating={isGenerating}
        onStop={handleStop}
      />
    </div>
  );
}
