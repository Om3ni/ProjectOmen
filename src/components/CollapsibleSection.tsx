import { useState, type ReactNode } from 'react';

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function CollapsibleSection({ title, defaultOpen = true, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800/60 hover:bg-slate-800 text-left cursor-pointer select-none transition-colors"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</span>
        <span className="text-slate-400 text-xs font-mono">{isOpen ? '[-]' : '[+]'}</span>
      </button>
      {isOpen && <div className="p-3 border-t border-slate-800">{children}</div>}
    </div>
  );
}
