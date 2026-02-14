import { useState } from 'react';
import type { ApprovalRequest, ApprovalResponse } from '../types';

export interface ApprovalDialogProps {
  request: ApprovalRequest;
  onResponse: (response: ApprovalResponse) => void;
}

export function ApprovalDialog({ request, onResponse }: ApprovalDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleApprove = () => {
    onResponse({ approved: true, rememberChoice });
  };

  const handleDeny = () => {
    onResponse({ approved: false, rememberChoice });
  };

  const impactColor =
    request.impact === 'high'
      ? 'text-red-400'
      : request.impact === 'medium'
        ? 'text-yellow-400'
        : 'text-green-400';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-lg border theme-border theme-bg-elevated shadow-xl p-5 max-w-md w-full mx-4">
        <h3 className="text-base font-semibold theme-text mb-4">Action Approval</h3>

        <div className="space-y-3 mb-5">
          {/* Description */}
          <div>
            <p className="text-xs theme-text-muted mb-1">Sigil wants to:</p>
            <p className="text-sm font-medium theme-text">{request.description}</p>
          </div>

          {/* Function name */}
          <div>
            <p className="text-xs theme-text-muted mb-1">Function:</p>
            <code className="text-sm font-mono px-2 py-0.5 rounded theme-bg-muted theme-text">
              {request.functionName || '(unknown)'}
            </code>
          </div>

          {/* Arguments */}
          {request.args && Object.keys(request.args).length > 0 && (
            <div>
              <p className="text-xs theme-text-muted mb-1">Arguments:</p>
              <div className="rounded theme-bg-muted p-2 text-xs font-mono max-h-40 overflow-y-auto space-y-0.5">
                {Object.entries(request.args).map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <span className="text-blue-400 shrink-0">{key}:</span>
                    <span className="theme-text-muted break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact */}
          <div className="flex items-center gap-2">
            <span className="text-xs theme-text-muted">Impact:</span>
            <span className={`text-xs font-semibold ${impactColor}`}>{request.impact}</span>
          </div>

          {/* Remember checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs theme-text-muted">Remember this choice (future)</span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleDeny}
            className="flex-1 px-3 py-1.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 px-3 py-1.5 rounded theme-bg-accent theme-text-accent-on hover:theme-bg-accent-hover text-sm font-medium transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
