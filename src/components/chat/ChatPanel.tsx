import { useCallback, useRef, useState } from 'react';

import { CHAT_TABS, type ChatTab } from '@/types/chat';
import { useChatState } from '@/hooks/useChatState';
import { parseRollCommand, formatRollResult } from '@/utils/diceRoller';
import { SettingsService } from '@/services/SettingsService';
import { LLMService, type LLMMessage } from '@/services/LLMService';

import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

type Props = {
  onClose?: () => void;
  onPopOut?: () => void;
  className?: string;
  /** When true, renders as standalone window (no pop-out button) */
  isPopout?: boolean;
  /** Schema data to provide context to the LLM */
  schemaData?: Record<string, unknown[]>;
};

export function ChatPanel({ onClose, onPopOut, className = '', isPopout = false, schemaData }: Props) {
  const {
    activeTab,
    unreadCounts,
    setActiveTab,
    addMessage,
    clearHistory,
    getMessages,
  } = useChatState();

  const settings = SettingsService.load();
  const [isLLMLoading, setIsLLMLoading] = useState(false);

  // Keep track of LLM conversation history for context
  const llmHistoryRef = useRef<LLMMessage[]>([]);

  const handleSend = useCallback(
    async (content: string) => {
      // Check for roll command
      const rollResult = parseRollCommand(content);
      if (rollResult) {
        addMessage({
          tab: activeTab,
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

      // Regular text message
      addMessage({
        tab: activeTab,
        sender: 'user',
        content,
        type: 'text',
      });

      // If on LLM tab and LLM is enabled, send to LLM
      if (activeTab === 'llm' && settings.llm.enabled) {
        setIsLLMLoading(true);

        try {
          const response = await LLMService.chat(
            content,
            llmHistoryRef.current,
            schemaData
          );

          if (response.error) {
            addMessage({
              tab: 'llm',
              sender: 'system',
              content: `Error: ${response.error}`,
              type: 'error',
            });
          } else {
            // Add to conversation history for context
            llmHistoryRef.current = [
              ...llmHistoryRef.current,
              { role: 'user', content },
              { role: 'assistant', content: response.content },
            ];

            // Keep history manageable (last 10 exchanges = 20 messages)
            if (llmHistoryRef.current.length > 20) {
              llmHistoryRef.current = llmHistoryRef.current.slice(-20);
            }

            addMessage({
              tab: 'llm',
              sender: 'bot',
              content: response.content,
              type: 'llm-response',
              metadata: {
                model: response.model,
              },
            });
          }
        } catch (e) {
          addMessage({
            tab: 'llm',
            sender: 'system',
            content: `Error: ${e instanceof Error ? e.message : String(e)}`,
            type: 'error',
          });
        } finally {
          setIsLLMLoading(false);
        }
      }
    },
    [activeTab, addMessage, settings, schemaData]
  );

  const isTabEnabled = (tab: ChatTab): boolean => {
    switch (tab) {
      case 'local':
        return true;
      case 'llm':
        return settings.llm.enabled;
      default:
        return false;
    }
  };

  const getTabTooltip = (tab: ChatTab): string | undefined => {
    if (isTabEnabled(tab)) return undefined;
    switch (tab) {
      case 'llm':
        return 'Enable LLM in Settings';
      default:
        return undefined;
    }
  };

  const currentMessages = getMessages();

  return (
    <div className={`flex flex-col h-full theme-bg-base border-l theme-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b theme-border">
        <h3 className="font-semibold theme-text">Chat</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearHistory(activeTab);
              // Also clear LLM conversation history
              if (activeTab === 'llm') {
                llmHistoryRef.current = [];
              }
            }}
            className="text-xs theme-text-muted hover:theme-text"
            title="Clear history"
          >
            Clear
          </button>
          {!isPopout && onPopOut && (
            <button
              type="button"
              onClick={onPopOut}
              className="theme-text-secondary hover:theme-text"
              aria-label="Open in new window"
              title="Open in new window"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="theme-text-secondary hover:theme-text"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b theme-border">
        {CHAT_TABS.map((tab) => {
          const enabled = isTabEnabled(tab.id);
          const tooltip = getTabTooltip(tab.id);
          const unread = unreadCounts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => enabled && setActiveTab(tab.id)}
              disabled={!enabled}
              title={tooltip}
              className={`relative flex-1 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--color-accent)] theme-text-accent'
                  : enabled
                  ? 'border-transparent theme-text-secondary hover:theme-text'
                  : 'border-transparent theme-text-muted cursor-not-allowed opacity-50'
              }`}
            >
              {tab.label}
              {unread > 0 && activeTab !== tab.id && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold rounded-full bg-red-500 text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <ChatMessageList messages={currentMessages} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        placeholder={
          isLLMLoading
            ? 'Waiting for response...'
            : activeTab === 'llm'
            ? 'Ask the AI assistant...'
            : 'Type a message or /roll 2d6...'
        }
        disabled={!isTabEnabled(activeTab) || isLLMLoading}
      />
      {isLLMLoading && (
        <div className="px-4 py-2 text-xs theme-text-muted flex items-center gap-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Thinking...
        </div>
      )}
    </div>
  );
}
