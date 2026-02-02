import type { DebugError } from '@/components/DebugOverlay';
import { getElectron } from '@/types/electron';

export function installGlobalErrorTrap(onError: (err: DebugError) => void): void {
  const toDebug = (message: string, stack?: string, source?: string): DebugError => ({
    message,
    stack,
    source,
    time: new Date().toISOString(),
  });

  window.addEventListener('error', (ev) => {
    const msg = ev.error instanceof Error ? ev.error.message : String(ev.message ?? 'Unknown error');
    const stack = ev.error instanceof Error ? ev.error.stack : undefined;
    onError(toDebug(msg, stack, ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined));

    // Forward to Electron main log if available
    try {
      const electron = getElectron();
      electron?.debug?.log?.({ kind: 'window.error', message: msg, stack, source: ev.filename, line: ev.lineno, col: ev.colno });
    } catch {
      // ignore
    }
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled promise rejection');
    const stack = reason instanceof Error ? reason.stack : undefined;
    onError(toDebug(msg, stack, 'unhandledrejection'));

    try {
      const electron = getElectron();
      electron?.debug?.log?.({ kind: 'unhandledrejection', message: msg, stack });
    } catch {
      // ignore
    }
  });
}
