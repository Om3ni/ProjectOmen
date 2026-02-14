import { useState, useMemo, useCallback } from 'react';
import {
  extractFormulaVariables,
  evaluateFormulaForTest,
  formatFormulaNumber,
  type FormulaTestResult,
  type FormulaContext,
} from '@/utils/formulaParser';

type FormulaTestState = {
  inputs: FormulaContext;
  result: (FormulaTestResult & { run: number; timestamp: number; inputs: FormulaContext }) | null;
  error: string | null;
  lastFormula: string | null;
};

const createFormulaTestState = (): FormulaTestState => ({
  inputs: {},
  result: null,
  error: null,
  lastFormula: null,
});

type Props = {
  label: string;
  value: string;
  onApply: (value: string) => void;
  onClose: () => void;
};

export default function FormulaEditorModal({ label, value: initialValue, onApply, onClose }: Props) {
  const [value, setValue] = useState(initialValue);
  const [testState, setTestState] = useState<FormulaTestState>(createFormulaTestState);

  const variableNames = useMemo(() => extractFormulaVariables(value), [value]);

  // Derive test state from formula changes
  const derivedTestState = useMemo(() => {
    const prevInputs = testState.inputs || {};
    const prevKeys = Object.keys(prevInputs);
    const sameKeys =
      variableNames.length === prevKeys.length &&
      variableNames.every((name) => Object.prototype.hasOwnProperty.call(prevInputs, name));
    if (sameKeys && testState.lastFormula === value) return testState;
    const nextInputs: FormulaContext = {};
    variableNames.forEach((name) => {
      nextInputs[name] = prevInputs[name] ?? 0;
    });
    return {
      ...testState,
      inputs: nextInputs,
      result: null,
      error: null,
      lastFormula: value,
    };
  }, [value, variableNames, testState]);

  // Use derived state directly instead of syncing back
  const effectiveTestState = derivedTestState;

  const handleInputChange = useCallback((name: string, rawValue: string) => {
    setTestState((prev) => ({
      ...prev,
      inputs: { ...prev.inputs, [name]: rawValue === '' ? 0 : Number(rawValue) || 0 },
    }));
  }, []);

  const handleRoll = useCallback(() => {
    const expression = value.trim();
    if (!expression) {
      setTestState((prev) => ({ ...prev, error: 'Enter a formula before testing.', result: null }));
      return;
    }

    // Validate all variable inputs
    for (const variable of variableNames) {
      const val = effectiveTestState.inputs[variable];
      if (val === undefined || val === null) {
        setTestState((prev) => ({ ...prev, error: `Enter a value for {${variable}}.`, result: null }));
        return;
      }
      if (!Number.isFinite(val)) {
        setTestState((prev) => ({ ...prev, error: `Value for {${variable}} must be numeric.`, result: null }));
        return;
      }
    }

    const numericInputs: FormulaContext = {};
    variableNames.forEach((name) => {
      numericInputs[name] = effectiveTestState.inputs[name] ?? 0;
    });

    try {
      const evaluation = evaluateFormulaForTest(expression, numericInputs, Math.random);
      setTestState((prev) => ({
        ...prev,
        result: {
          ...evaluation,
          run: (prev.result?.run ?? 0) + 1,
          timestamp: Date.now(),
          inputs: { ...numericInputs },
        },
        error: null,
        lastFormula: expression,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTestState((prev) => ({ ...prev, error: message, result: null, lastFormula: expression }));
    }
  }, [value, variableNames, effectiveTestState.inputs]);

  const handleApply = () => {
    onApply(value);
    onClose();
  };

  const hasExpression = value.trim().length > 0;
  const hasVariables = variableNames.length > 0;
  const { result, error, inputs } = effectiveTestState;

  const inputCls =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';
  const labelCls = 'text-xs font-semibold text-slate-400 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4">
      <div
        className="mt-16 w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-950 p-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Formula Editor</h2>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Formula Input */}
        <div className="mb-4">
          <label className={labelCls}>Formula</label>
          <textarea
            className={`${inputCls} mt-1 h-24 font-mono`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 1d20 + {Strength} + 5"
          />
        </div>

        {/* Test Section */}
        <div className="mb-4 rounded-md border border-slate-800 bg-slate-900/50 p-3">
          <div className={`${labelCls} mb-2`}>Test Formula</div>

          {/* Variable Inputs */}
          {hasVariables ? (
            <div className={`grid gap-2 mb-3 ${variableNames.length > 2 ? 'sm:grid-cols-2' : ''}`}>
              {variableNames.map((name) => (
                <div key={name} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">{`{${name}}`}</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={inputs[name] ?? ''}
                    placeholder="Required"
                    onChange={(e) => handleInputChange(name, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 mb-3">
              {hasExpression
                ? 'No variables detected. Click Roll to test dice behavior.'
                : 'Enter a formula above to enable testing.'}
            </p>
          )}

          {/* Roll Button */}
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                hasExpression
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
              onClick={hasExpression ? handleRoll : undefined}
              disabled={!hasExpression}
            >
              {result ? 'Roll Again' : 'Roll Formula'}
            </button>
            {result && (
              <span className="text-xs text-slate-500 uppercase tracking-wide">Roll #{result.run}</span>
            )}
          </div>

          {/* Error Display */}
          {error && <div className="text-xs font-medium text-rose-400 mb-2">{error}</div>}

          {/* Result Display */}
          {result && (
            <div className="space-y-1 text-xs">
              {/* Timestamp */}
              <div className="text-slate-500">
                Roll #{result.run} at {new Date(result.timestamp).toLocaleTimeString()}
              </div>

              {/* Variable Values Used */}
              {hasVariables &&
                variableNames.map((name) => (
                  <div key={name} className="text-slate-300">
                    {`{${name}}`} = {formatFormulaNumber(result.inputs[name] ?? 0)}
                  </div>
                ))}

              {/* Dice Roll Details */}
              {result.rolls.length > 0 &&
                result.rolls.map((roll, idx) => {
                  const rawDisplay = roll.rolls.join(', ');
                  const keptDisplay = roll.kept.join(', ');
                  const detail =
                    roll.operator === 'h'
                      ? `${roll.notation} → rolled [${rawDisplay}] | sorted [${keptDisplay}] = ${formatFormulaNumber(roll.total)}`
                      : `${roll.notation} → [${keptDisplay}] = ${formatFormulaNumber(roll.total)}`;
                  return (
                    <div key={idx} className="text-slate-300 font-mono">
                      {detail}
                    </div>
                  );
                })}

              {/* Final Result */}
              <div className="text-slate-300">Before rounding: {formatFormulaNumber(result.value)}</div>
              <div className="text-sm font-semibold text-white">
                Final result: {formatFormulaNumber(result.rounded)}
              </div>
            </div>
          )}

          {!result && !error && hasExpression && (
            <p className="text-xs text-slate-500">
              Set any inputs and click Roll Formula to preview a result.
            </p>
          )}
        </div>

        {/* Help Section */}
        <details className="mb-4">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
            Formula Syntax Help
          </summary>
          <div className="mt-2 space-y-4 text-xs text-slate-400 bg-slate-900/50 rounded-md p-3 max-h-48 overflow-y-auto">
            {/* Math */}
            <div className="space-y-1">
              <div className="font-semibold text-slate-300">Math</div>
              <p>Simple mathematical operations are supported: +, -, /, *.</p>
              <p>
                You can use parentheses for order of operations:{' '}
                <code className="text-emerald-400">10 / 2 + 2 = 7</code>,{' '}
                <code className="text-emerald-400">10 / (2 + 2) = 2.5</code>.
              </p>
              <p>The final result of your formula is rounded to an integer (0.5 rounds up).</p>
            </div>

            {/* Dice */}
            <div className="space-y-1">
              <div className="font-semibold text-slate-300">Dice</div>
              <p>
                Roll dice inside a formula using the NdX format, e.g.,{' '}
                <code className="text-emerald-400">3d6</code>.
              </p>
              <p>
                Dice pools are supported, e.g., <code className="text-emerald-400">3h6</code> (rolls 3d6
                and keeps all, sorted highest first).
              </p>
              <p>
                You can substitute dice with variables:{' '}
                <code className="text-emerald-400">{'{c.Strength}'}d6</code>.
              </p>
            </div>

            {/* Variables */}
            <div className="space-y-1">
              <div className="font-semibold text-slate-300">Variables</div>
              <p>
                Wrap variable names in curly braces: <code className="text-emerald-400">{'{}'}</code>.
              </p>
              <p>Use the exact Skill, Attribute, or Stat name.</p>
              <p>
                Prefix with <code className="text-emerald-400">c.</code> to read from the caster (
                <code className="text-emerald-400">{'{c.Strength}'}</code>),{' '}
                <code className="text-emerald-400">t.</code> for the target (
                <code className="text-emerald-400">{'{t.Armor Class}'}</code>), and{' '}
                <code className="text-emerald-400">s.</code> for the source caster on auto-use abilities
                (<code className="text-emerald-400">{'{s.Spellcasting}'}</code>).
              </p>
            </div>

            {/* Functions */}
            <div className="space-y-1">
              <div className="font-semibold text-slate-300">Functions</div>
              <p>
                Functions accept plain numbers, expressions, dice rolls, or other functions. Parameters
                use square brackets. Wrap math expressions in parentheses before passing them.
              </p>
              <div className="space-y-1 mt-2">
                <p>
                  <code className="text-emerald-400">f.max[1, 2, 3, ...]</code> — returns the largest
                  value. Examples: <code className="text-slate-300">f.max[{'{c.Intelligence}'}, {'{c.Wisdom}'}]</code>,{' '}
                  <code className="text-slate-300">f.max[(1d4 + {'{t.Fire Resist}'}), 0]</code>
                </p>
                <p>
                  <code className="text-emerald-400">f.min[1, 2, 3, ...]</code> — returns the smallest
                  value. Example: <code className="text-slate-300">f.min[(-1d4 + {'{t.Damage Resist}'}), 0]</code>
                </p>
                <p>
                  <code className="text-emerald-400">f.clamp[value, min, max]</code> — constrains value
                  between min and max.
                </p>
                <p>
                  <code className="text-emerald-400">f.abs[value]</code> — absolute value (makes
                  negatives positive).
                </p>
                <p>
                  <code className="text-emerald-400">f.floor[value]</code> — rounds down.
                </p>
                <p>
                  <code className="text-emerald-400">f.ceil[value]</code> — rounds up.
                </p>
                <p>
                  <code className="text-emerald-400">f.round[value]</code> — rounds to the nearest
                  integer (0.5 rounds up).
                </p>
              </div>
            </div>
          </div>
        </details>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
