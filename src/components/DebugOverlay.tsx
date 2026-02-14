import { useMemo } from 'react';

export type DebugError = {
  type?: string;
  message: string;
  stack?: string;
  source?: string;
  time: string;
};

// Type guard for Electron window interface
interface ElectronWindow extends Window {
  electron?: unknown;
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as ElectronWindow).electron !== 'undefined';
}

export default function DebugOverlay({ error, onClose }: { error: DebugError | null; onClose: () => void }) {
  const isDesktop = useMemo(() => isElectron(), []);
  if (!error) return null;

  const details = [
    `Time: ${error.time}`,
    error.source ? `Source: ${error.source}` : null,
    `Message: ${error.message}`,
    error.stack ? `\n${error.stack}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const copy = async () => {
    await navigator.clipboard?.writeText(details);
  };

  const openDevTools = async () => {
    try {
      const electron = (window as ElectronWindow).electron as { debug?: { openDevTools?: () => Promise<void> } } | undefined;
      await electron?.debug?.openDevTools?.();
    } catch {
      // ignore
    }
  };

  const openLogFolder = async () => {
    try {
      const electron = (window as ElectronWindow).electron as { debug?: { openLogFolder?: () => Promise<void> } } | undefined;
      await electron?.debug?.openLogFolder?.();
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-3xl rounded-lg border border-red-700/50 bg-slate-950 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-red-200">Unhandled error</div>
            <div className="text-xs text-slate-400">The app can keep running, but something threw.</div>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-900/60"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            onClick={copy}
          >
            Copy details
          </button>
          {isDesktop && (
            <>
              <button
                type="button"
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                onClick={openDevTools}
              >
                Open DevTools
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-900/60"
                onClick={openLogFolder}
              >
                Open logs folder
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-900/60"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>

        <pre className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-100 whitespace-pre-wrap">
{details}
        </pre>

        {isDesktop && (
          <div className="mt-2 text-[11px] text-slate-400">
            Log file: <span className="text-slate-200">(click Open logs folder)</span>
          </div>
        )}
      </div>
    </div>
  );
}
