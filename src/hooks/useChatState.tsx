import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  type ChatTab,
  type ChatMessage,
  type ChatState,
  createEmptyChatState,
  generateMessageId,
} from '@/types/chat';

const CHAT_STORAGE_KEY = 'project-omen:chat:v1';
const CHAT_BROADCAST_CHANNEL = 'project-omen:chat';

type BroadcastPayload =
  | { type: 'message'; message: ChatMessage }
  | { type: 'clear'; tab?: ChatTab };

function loadChatState(): ChatState {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatState>;
      // Merge with defaults to handle missing fields
      const state = createEmptyChatState();
      if (parsed.messages) {
        for (const tab of Object.keys(state.messages) as ChatTab[]) {
          if (Array.isArray(parsed.messages[tab])) {
            state.messages[tab] = parsed.messages[tab];
          }
        }
      }
      if (parsed.activeTab && ['local', 'llm'].includes(parsed.activeTab)) {
        state.activeTab = parsed.activeTab;
      }
      return state;
    }
  } catch {
    // Ignore parse errors
  }
  return createEmptyChatState();
}

function saveChatState(state: ChatState): void {
  try {
    // Only save last 100 messages per tab to prevent bloat
    const trimmed: ChatState = {
      ...state,
      messages: {
        local: state.messages.local.slice(-100),
        llm: state.messages.llm.slice(-100),
      },
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

type ChatContextValue = {
  // State
  activeTab: ChatTab;
  messages: ChatState['messages'];
  unreadCounts: ChatState['unreadCounts'];

  // Actions
  setActiveTab: (tab: ChatTab) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
  updateMessage: (id: string, tab: ChatTab, updates: Partial<Pick<ChatMessage, 'content' | 'metadata'>>) => void;
  sendUserMessage: (content: string, tab?: ChatTab) => ChatMessage;
  addSystemMessage: (content: string, tab?: ChatTab) => ChatMessage;
  clearHistory: (tab?: ChatTab) => void;
  getMessages: (tab?: ChatTab) => ChatMessage[];
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChatState>(loadChatState);

  // BroadcastChannel for live cross-window sync
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Guard to avoid re-processing our own broadcasts
  const ignoreNextBroadcast = useRef(false);

  useEffect(() => {
    const ch = new BroadcastChannel(CHAT_BROADCAST_CHANNEL);
    channelRef.current = ch;

    ch.onmessage = (ev: MessageEvent<BroadcastPayload>) => {
      if (ignoreNextBroadcast.current) {
        ignoreNextBroadcast.current = false;
        return;
      }
      const payload = ev.data;
      if (payload.type === 'message') {
        // Append message from another window
        setState((prev) => ({
          ...prev,
          messages: {
            ...prev.messages,
            [payload.message.tab]: [...prev.messages[payload.message.tab], payload.message],
          },
          unreadCounts: {
            ...prev.unreadCounts,
            [payload.message.tab]:
              prev.activeTab === payload.message.tab ? 0 : prev.unreadCounts[payload.message.tab] + 1,
          },
        }));
      } else if (payload.type === 'clear') {
        setState((prev) => {
          if (payload.tab) {
            return { ...prev, messages: { ...prev.messages, [payload.tab]: [] } };
          }
          return { ...prev, messages: createEmptyChatState().messages };
        });
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  // Persist to localStorage on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveChatState(state);
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const setActiveTab = useCallback((tab: ChatTab) => {
    setState((prev) => ({
      ...prev,
      activeTab: tab,
      // Clear unread count when switching to a tab
      unreadCounts: {
        ...prev.unreadCounts,
        [tab]: 0,
      },
    }));
  }, []);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const fullMessage: ChatMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
    };

    setState((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [message.tab]: [...prev.messages[message.tab], fullMessage],
      },
      // Increment unread if not on this tab
      unreadCounts: {
        ...prev.unreadCounts,
        [message.tab]:
          prev.activeTab === message.tab ? 0 : prev.unreadCounts[message.tab] + 1,
      },
    }));

    // Broadcast to other windows
    channelRef.current?.postMessage({ type: 'message', message: fullMessage } satisfies BroadcastPayload);

    return fullMessage;
  }, []);

  const updateMessage = useCallback((id: string, tab: ChatTab, updates: Partial<Pick<ChatMessage, 'content' | 'metadata'>>) => {
    setState((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        [tab]: prev.messages[tab].map((msg) =>
          msg.id === id ? { ...msg, ...updates } : msg
        ),
      },
    }));
  }, []);

  const sendUserMessage = useCallback(
    (content: string, tab?: ChatTab) => {
      const targetTab = tab ?? state.activeTab;
      return addMessage({
        tab: targetTab,
        sender: 'user',
        content,
        type: 'text',
      });
    },
    [state.activeTab, addMessage]
  );

  const addSystemMessage = useCallback(
    (content: string, tab?: ChatTab) => {
      const targetTab = tab ?? state.activeTab;
      return addMessage({
        tab: targetTab,
        sender: 'system',
        content,
        type: 'system',
      });
    },
    [state.activeTab, addMessage]
  );

  const clearHistory = useCallback((tab?: ChatTab) => {
    const targetTab = tab;
    setState((prev) => {
      if (targetTab) {
        return {
          ...prev,
          messages: {
            ...prev.messages,
            [targetTab]: [],
          },
        };
      }
      // Clear all
      return {
        ...prev,
        messages: createEmptyChatState().messages,
      };
    });

    // Broadcast to other windows
    channelRef.current?.postMessage({ type: 'clear', tab: targetTab } satisfies BroadcastPayload);
  }, []);

  const getMessages = useCallback(
    (tab?: ChatTab) => {
      const targetTab = tab ?? state.activeTab;
      return state.messages[targetTab];
    },
    [state.activeTab, state.messages]
  );

  const value: ChatContextValue = {
    // State
    activeTab: state.activeTab,
    messages: state.messages,
    unreadCounts: state.unreadCounts,

    // Actions
    setActiveTab,
    addMessage,
    updateMessage,
    sendUserMessage,
    addSystemMessage,
    clearHistory,
    getMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatState(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatState must be used within a ChatProvider');
  }
  return ctx;
}
