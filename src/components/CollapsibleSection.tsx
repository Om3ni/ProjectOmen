import { useState, type ReactNode } from 'react';

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function CollapsibleSection({ title, defaultOpen = true, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border theme-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 theme-bg-elevated hover:opacity-80 text-left cursor-pointer select-none transition-colors"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide theme-text-secondary">{title}</span>
        <span className="theme-text-muted text-xs font-mono">{isOpen ? '[-]' : '[+]'}</span>
      </button>
      {isOpen && <div className="p-3 border-t theme-border">{children}</div>}
    </div>
  );
}
