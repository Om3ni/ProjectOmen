import { useState, useRef, useCallback, useEffect, useMemo, type RefObject } from 'react';

type Props = {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
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

/**
 * Wrap selected text in the textarea with markdown syntax.
 * If nothing is selected, inserts the wrapper with placeholder text.
 */
function wrapSelection(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  setValue: (v: string) => void,
  prefix: string,
  suffix: string,
  placeholder: string
): void {
  const ta = textareaRef.current;
  if (!ta) return;

  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = value.slice(start, end);
  const replacement = selected || placeholder;
  const wrapped = prefix + replacement + suffix;

  const before = value.slice(0, start);
  const after = value.slice(end);
  const newValue = before + wrapped + after;
  setValue(newValue);

  // Re-focus and select the inner text (after React re-renders)
  requestAnimationFrame(() => {
    ta.focus();
    const innerStart = start + prefix.length;
    const innerEnd = innerStart + replacement.length;
    ta.setSelectionRange(innerStart, innerEnd);
  });
}

type FormatButton = {
  label: string;
  title: string;
  prefix: string;
  suffix: string;
  placeholder: string;
  shortcut: string; // e.g. "Ctrl+B"
  className?: string;
};

const FORMAT_BUTTONS: FormatButton[] = [
  { label: 'B', title: 'Bold', prefix: '**', suffix: '**', placeholder: 'bold text', shortcut: 'b', className: 'font-bold' },
  { label: 'I', title: 'Italic', prefix: '*', suffix: '*', placeholder: 'italic text', shortcut: 'i', className: 'italic' },
  { label: 'U', title: 'Underline', prefix: '__', suffix: '__', placeholder: 'underline text', shortcut: 'u', className: 'underline' },
  { label: 'S', title: 'Strikethrough', prefix: '~~', suffix: '~~', placeholder: 'struck text', shortcut: 's', className: 'line-through' },
];

const GENERATING_PHRASES = [
  'Generating response...',
  'Iterating...',
  'Thinking...',
  'Formulating...',
  'Drumming...',
  'Pondering...',
  'Crunching tokens...',
  'Consulting the oracle...',
];

export function ChatInput({ onSend, placeholder = 'Type a message...', disabled = false, isGenerating = false, onStop }: Props) {
  const [value, setValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(loadCommandHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Shuffle phrases on each generation start
  const shuffledPhrases = useMemo(() => {
    if (!isGenerating) return GENERATING_PHRASES;
    const arr = [...GENERATING_PHRASES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [isGenerating]);

  // Cycle through phrases while generating
  useEffect(() => {
    if (!isGenerating) {
      setPhraseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setPhraseIndex(i => (i + 1) % shuffledPhrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isGenerating, shuffledPhrases]);

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
    // Formatting shortcuts: Ctrl+B/I/U/S
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const fmt = FORMAT_BUTTONS.find(f => f.shortcut === e.key.toLowerCase());
      if (fmt) {
        e.preventDefault();
        wrapSelection(inputRef, value, setValue, fmt.prefix, fmt.suffix, fmt.placeholder);
        return;
      }
    }

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
    <div className="border-t theme-border p-3 flex-shrink-0">
      {/* Generating indicator */}
      {isGenerating && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <svg width="16" height="16" viewBox="0 0 24 24" className="text-blue-400 shrink-0" style={{ animation: 'diceRoll 1.2s ease-in-out infinite' }}>
            <style>{`
              @keyframes diceRoll {
                0% { transform: rotate(0deg) scale(1); }
                25% { transform: rotate(90deg) scale(0.9); }
                50% { transform: rotate(180deg) scale(1); }
                75% { transform: rotate(270deg) scale(0.9); }
                100% { transform: rotate(360deg) scale(1); }
              }
            `}</style>
            <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="16" cy="8" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="8" cy="16" r="1.5" fill="currentColor" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          </svg>
          <span className="text-xs theme-text-muted">{shuffledPhrases[phraseIndex]}</span>
        </div>
      )}
      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 mb-1.5">
        {FORMAT_BUTTONS.map((fmt) => (
          <button
            key={fmt.label}
            type="button"
            title={`${fmt.title} (Ctrl+${fmt.shortcut.toUpperCase()})`}
            onClick={() => wrapSelection(inputRef, value, setValue, fmt.prefix, fmt.suffix, fmt.placeholder)}
            disabled={disabled || isGenerating}
            className={`px-2 py-0.5 text-xs rounded theme-text-secondary hover:theme-bg-secondary hover:theme-text transition-colors disabled:opacity-30 ${fmt.className || ''}`}
          >
            {fmt.label}
          </button>
        ))}
        <div className="w-px h-4 theme-border mx-1" />
        <button
          type="button"
          title="Code (Ctrl+`)"
          onClick={() => wrapSelection(inputRef, value, setValue, '`', '`', 'code')}
          disabled={disabled || isGenerating}
          className="px-2 py-0.5 text-xs rounded font-mono theme-text-secondary hover:theme-bg-secondary hover:theme-text transition-colors disabled:opacity-30"
        >
          {'</>'}
        </button>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={isGenerating ? 'Waiting for response...' : placeholder}
          disabled={disabled}
          spellCheck
          rows={1}
          className="flex-1 px-3 py-2 rounded-md border theme-border theme-bg-input theme-text text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
          style={{ minHeight: '38px', maxHeight: '120px' }}
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="px-4 py-2 rounded-md theme-bg-accent theme-text-accent-on text-sm font-medium hover:theme-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
      <div className="mt-1 text-xs theme-text-muted">
        <code>/roll 2d6+3</code> to roll dice · <code>Shift+Enter</code> for newline
      </div>
    </div>
  );
}
