import { useEffect, useRef } from 'react';

import type { ChatMessage as ChatMessageType } from '@/types/chat';
import { ChatMessage } from './ChatMessage';

type Props = {
  messages: ChatMessageType[];
};

export function ChatMessageList({ messages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      // Scroll the container itself instead of using scrollIntoView to avoid affecting parent scrolls
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center theme-text-muted">
          <div className="text-2xl mb-2">💬</div>
          <div className="text-sm">No messages yet</div>
          <div className="text-xs mt-1">
            Type a message or use <code className="theme-bg-secondary px-1 rounded">/roll 1d20</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-3"
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
