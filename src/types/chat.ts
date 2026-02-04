export type ChatTab = 'local' | 'llm';

export type ChatMessageType = 'text' | 'roll' | 'ability' | 'error' | 'llm-response' | 'system';

export type RollResult = {
  formula: string;
  rolls: number[];
  modifier: number;
  total: number;
  criticalHit?: boolean;
  criticalFail?: boolean;
};

export type ChatMessage = {
  id: string;
  tab: ChatTab;
  timestamp: number;
  sender: 'user' | 'system' | 'bot' | 'webhook';
  senderName?: string;
  content: string;
  type: ChatMessageType;
  metadata?: {
    // For rolls
    formula?: string;
    rollResult?: RollResult;
    // For abilities
    abilityId?: number;
    abilityName?: string;
    // For LLM
    model?: string;
    tokensUsed?: number;
  };
};

export type ChatState = {
  messages: Record<ChatTab, ChatMessage[]>;
  activeTab: ChatTab;
  unreadCounts: Record<ChatTab, number>;
};

export const CHAT_TABS: Array<{ id: ChatTab; label: string }> = [
  { id: 'local', label: 'Local' },
  { id: 'llm', label: 'LLM' },
];

export function createEmptyChatState(): ChatState {
  return {
    messages: {
      local: [],
      llm: [],
    },
    activeTab: 'local',
    unreadCounts: {
      local: 0,
      llm: 0,
    },
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
