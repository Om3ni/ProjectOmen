import { useCallback, useRef, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  maxLength?: number;
};

/**
 * Description field component that:
 * - Displays line breaks as actual newlines in the UI
 * - Stores line breaks as `&brk;` in the data
 * - Enter key: commits/blurs the field
 * - Shift+Enter: inserts a new line (stored as &brk;)
 * - Character limit: 400
 */
export default function DescriptionField({
  value,
  onChange,
  onBlur,
  placeholder = 'Description',
  className = '',
  rows = 6,
  maxLength = 400,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convert storage format (&brk;) to display format (\n)
  const displayValue = value.replace(/&brk;/g, '\n');

  // Convert display format (\n) to storage format (&brk;)
  const handleChange = useCallback(
    (newValue: string) => {
      const storageValue = newValue.replace(/\n/g, '&brk;');
      // Enforce character limit on storage format
      if (storageValue.length <= maxLength) {
        onChange(storageValue);
      }
    },
    [onChange, maxLength]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          // Shift+Enter: insert newline (default behavior, will be converted to &brk;)
          // Nothing to do, let default happen
        } else {
          // Enter without Shift: commit and blur
          e.preventDefault();
          textareaRef.current?.blur();
        }
      }
    },
    []
  );

  const currentLength = value.length;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={textareaRef}
        className={className}
        rows={rows}
        placeholder={placeholder}
        value={displayValue}
        maxLength={maxLength}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
      />
      <div className="flex justify-end text-[10px] theme-text-faint">
        {currentLength} / {maxLength}
      </div>
    </div>
  );
}
