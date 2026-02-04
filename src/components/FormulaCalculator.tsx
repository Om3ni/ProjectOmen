import { useState } from 'react';
import FormulaEditorModal from './FormulaEditorModal';

type Props = {
  /** Label shown in the modal header */
  label?: string;
  /** Current formula value */
  value: string;
  /** Called when user applies changes from the modal */
  onChange: (value: string) => void;
};

/**
 * A button that opens the Formula Editor modal.
 * Based on the formula editor from References/index.html.
 */
export default function FormulaCalculator({ label = 'Formula', value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition"
        onClick={() => setIsOpen(true)}
      >
        Edit Formula
      </button>
      {isOpen && (
        <FormulaEditorModal
          label={label}
          value={value}
          onApply={onChange}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
