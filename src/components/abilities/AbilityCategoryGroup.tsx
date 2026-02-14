import { useState, type ReactNode } from 'react';

type Props = {
  category: string;
  isSeparator: boolean;
  separatorLabel?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
};

/**
 * Collapsible category group for abilities.
 * Separators render as dividers, categories render as collapsible sections.
 */
export default function AbilityCategoryGroup({
  category,
  isSeparator,
  separatorLabel,
  defaultOpen = true,
  children
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Separator - just a visual divider
  if (isSeparator) {
    return (
      <div className="flex items-center gap-3 py-2 px-1">
        <div className="flex-1 h-px theme-bg-elevated" />
        {separatorLabel && (
          <span className="text-xs font-medium theme-text-muted uppercase tracking-wider">
            {separatorLabel}
          </span>
        )}
        <div className="flex-1 h-px theme-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2 py-2 theme-bg-elevated hover:theme-bg-surface rounded-md transition-colors cursor-pointer select-none"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className="text-sm theme-text-muted">
          {isOpen ? '▼' : '▶'}
        </span>
        <span className="text-sm font-medium theme-text">{category}</span>
      </button>

      {isOpen && (
        <div className="mt-1 space-y-2 pl-1">
          {children}
        </div>
      )}
    </div>
  );
}
