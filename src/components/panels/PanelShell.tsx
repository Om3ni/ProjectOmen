import type { ReactNode } from 'react';
import type { PanelMode } from '@/types/panel';

type Props = {
  title: string;
  mode: PanelMode;
  onPopout: () => void;
  onHide: () => void;
  /** Width when docked (default 380px) */
  dockedWidth?: number;
  children: ReactNode;
};

/** Icon: pop out to new window */
function PopoutIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="15 3 21 3 21 9" />
      <line strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/** Icon: close (X) */
function CloseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function HeaderButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      className="theme-text-secondary hover:theme-text p-0.5"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function PanelShell({
  title,
  mode,
  onPopout,
  onHide,
  dockedWidth = 380,
  children,
}: Props) {
  if (mode !== 'docked') return null;

  return (
    <div
      className="flex-shrink-0 border-l theme-border theme-bg-base flex flex-col h-full"
      style={{ width: dockedWidth }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b theme-border theme-bg-elevated text-xs">
        <span className="theme-text-secondary font-medium">{title}</span>
        <div className="flex items-center gap-1">
          <HeaderButton title="Open in new window" onClick={onPopout}>
            <PopoutIcon />
          </HeaderButton>
          <HeaderButton title="Hide" onClick={onHide}>
            <CloseIcon />
          </HeaderButton>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  );
}
