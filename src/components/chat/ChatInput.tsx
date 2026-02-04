import { useState, useRef, useCallback, useEffect } from 'react';

type Props = {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function loadCommandHistory(): string[] {
  try {
    const saved = localStorage.getItem('project-omen:chat-history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

export function ChatInput({ onSend, placeholder = 'Type a message...', disabled = false }: Props) {
  const [value, setValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(loadCommandHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSend(trimmed);

    // Add to history (avoid duplicates)
    setCommandHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 50);
      try {
        localStorage.setItem('project-omen:chat-history', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    setValue('');
    setHistoryIndex(-1);
  }, [value, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Up arrow for command history
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      // Only navigate history if at start of input or input is empty
      const isAtStart = inputRef.current?.selectionStart === 0;
      if (value === '' || isAtStart) {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setValue(commandHistory[nextIndex]);
        }
      }
      return;
    }

    // Down arrow for command history
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      if (historyIndex >= 0) {
        e.preventDefault();
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setValue(nextIndex >= 0 ? commandHistory[nextIndex] : '');
      }
      return;
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className="border-t theme-border p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 px-3 py-2 rounded-md border theme-border theme-bg-input theme-text text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
          style={{ minHeight: '38px', maxHeight: '120px' }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-4 py-2 rounded-md theme-bg-accent theme-text-accent-on text-sm font-medium hover:theme-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
      <div className="mt-1 text-xs theme-text-muted">
        <code>/roll 2d6+3</code> to roll dice · <code>Shift+Enter</code> for newline
      </div>
    </div>
  );
}
