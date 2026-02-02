import type { ReactNode } from 'react';
import React from 'react';

import type { DebugError } from '@/components/DebugOverlay';

type Props = {
  children: ReactNode;
  onError: (err: DebugError) => void;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    this.props.onError({
      type: 'react-error-boundary',
      message,
      stack,
      source: 'ErrorBoundary',
      time: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-slate-200">
          <div className="font-semibold text-red-200">UI crashed while rendering.</div>
          <div className="mt-1 text-slate-400">You can reload, or open DevTools to inspect logs.</div>
          <button
            type="button"
            className="mt-3 rounded-md border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-900/60"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
