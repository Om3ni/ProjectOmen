type Props = {
  show: boolean;
  autoFocus: boolean;
  pasteText: string;
  canCancel?: boolean;
  onChangePasteText: (text: string) => void;
  onLoad: () => void;
  onCancel: () => void;
};

export function RawPastePanel({ show, autoFocus, pasteText, canCancel = true, onChangePasteText, onLoad, onCancel }: Props) {
  if (!show) return null;

  return (
    <div className="mt-4 rounded-md border border-emerald-700/50 bg-emerald-950/20 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        Paste raw RPR text
      </div>
      <textarea
        className="h-32 w-full rounded-md border border-slate-800 bg-slate-950/40 p-2 font-mono text-xs text-slate-100"
        spellCheck={false}
        autoFocus={autoFocus}
        value={pasteText}
        onChange={(e) => onChangePasteText(e.target.value)}
        placeholder="Paste pipe-delimited text here...&#10;SkillDef|t|1|Strength|...&#10;SkillDef|t|2|Agility|...&#10;AttributeDef|t|1|STR|..."
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          onClick={onLoad}
        >
          Load
        </button>
        {canCancel && (
          <button
            type="button"
            className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-900/60"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
