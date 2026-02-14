import type { ChatMessage as ChatMessageType } from '@/types/chat';
import { parseMarkdown, renderMarkdownNodes } from '@/utils/markdown';

type Props = {
  message: ChatMessageType;
};

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ChatMessage({ message }: Props) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system' || message.type === 'system';
  const isError = message.type === 'error';
  const isRoll = message.type === 'roll';

  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="text-xs theme-text-muted italic px-3 py-1 rounded-full theme-bg-secondary">
          {message.content}
        </div>
      </div>
    );
  }

  // Error messages
  if (isError) {
    return (
      <div className="flex justify-center my-2">
        <div className="text-xs text-red-400 px-3 py-1 rounded-md bg-red-950/30 border border-red-800/50">
          {message.content}
        </div>
      </div>
    );
  }

  // Ability execution result
  if (message.type === 'ability') {
    return (
      <div className="flex justify-end my-2">
        <div className="max-w-[80%] rounded-lg px-3 py-2 border border-purple-500/40 bg-purple-950/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">⚔️</span>
            <span className="text-xs font-semibold text-purple-300">
              {(message.metadata as Record<string,unknown>)?.abilityName as string ?? 'Ability'}
            </span>
          </div>
          <div className="text-sm theme-text whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="text-xs theme-text-muted mt-1">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // Roll result - render as text/markdown
  if (isRoll) {
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
        <div
          className={`max-w-[80%] rounded-lg px-3 py-2 ${
            isUser
              ? 'theme-bg-accent/20 border border-[var(--color-accent)]/30'
              : 'theme-bg-secondary border theme-border'
          }`}
        >
          <div className="text-sm theme-text whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="text-xs theme-text-muted mt-1">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // LLM response
  if (message.type === 'llm-response') {
    return (
      <div className="flex justify-start my-2">
        <div className="max-w-[85%] rounded-lg px-3 py-2 theme-bg-secondary border theme-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🤖</span>
            <span className="text-xs theme-text-secondary font-medium">
              {message.metadata?.model || 'Sigil'}
            </span>
          </div>
          <div className="text-sm theme-text">
            {message.content ? renderMarkdownNodes(parseMarkdown(message.content)) : '(Empty response)'}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs theme-text-muted">
            <span>{formatTimestamp(message.timestamp)}</span>
            {message.metadata?.tokensUsed && (
              <span className="theme-text-secondary">
                {message.metadata.tokensUsed} tokens
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular text message
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isUser
            ? 'theme-bg-accent/20 border border-[var(--color-accent)]/30'
            : 'theme-bg-secondary border theme-border'
        }`}
      >
        {message.senderName && !isUser && (
          <div className="text-xs font-medium theme-text-secondary mb-1">
            {message.senderName}
          </div>
        )}
        <div className="text-sm theme-text">
          {renderMarkdownNodes(parseMarkdown(message.content))}
        </div>
        <div className="text-xs theme-text-muted mt-1">
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
