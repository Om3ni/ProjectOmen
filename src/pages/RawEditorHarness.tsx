import { useState } from 'react';
import RawModal from '@/components/RawModal';
import type { RprCategory } from '@/models/schema';

/**
 * Harness page for testing the Raw Editor component in isolation.
 * Access via /?harness=raw
 */
export default function RawEditorHarness() {
  const [appliedText, setAppliedText] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  // Sample test data
  const sampleData = `SkillDef|t|1|Strength|STR|Physical power
SkillDef|t|2|Agility|AGI|Speed and reflexes
SkillDef|t|3|Intellect|INT|Mental acuity
AttributeDef|t|1|STR|Strength|0|20
AttributeDef|t|2|AGI|Agility|0|20
AttributeDef|t|3|INT|Intellect|0|20
SpellDef|t|1|Fireball|Fire|10|20
SpellEffect|t|1|1|damage|fire|2d6+INT
SpellReqDef|t|1|1|mana|10
SpellTargetCond|t|1|1|enemy|range|30
PerkDef|t|1|Strong|Increases strength|1
PerkEffect|t|1|1|STR|+2
RuneDef|t|1|Fire Rune|Adds fire damage
RuneCond|t|1|1|weapon|equipped
RuneEffect|t|1|1|damage|fire|1d4`;

  const handleApplyAll = (text: string) => {
    setAppliedText(text);
    console.log('Applied all:', text);
  };

  const handleApplySelection = (text: string, category: RprCategory) => {
    setAppliedText(text);
    console.log('Applied selection:', category, text);
  };

  const handleExportAll = () => sampleData;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportSelection = (_cat: RprCategory) => sampleData;

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-400">Raw Editor Harness</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            onClick={() => setIsOpen(true)}
          >
            Open Raw Editor
          </button>
          <a
            href="/"
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Back to App
          </a>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-slate-800 bg-slate-900/50 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Instructions
        </div>
        <ul className="space-y-1 text-sm text-slate-300">
          <li>• Click column headers to select entire columns</li>
          <li>• Click row numbers to select entire rows</li>
          <li>• After selecting, just start typing to edit all selected cells</li>
          <li>• Shift+click to extend selection</li>
          <li>• Ctrl+click to add/remove from selection</li>
          <li>• Press Escape to clear selection</li>
          <li>• Double-click a cell to open expanded editor</li>
        </ul>
      </div>

      {appliedText && (
        <div className="mb-4 rounded-md border border-emerald-700/50 bg-emerald-950/20 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Last Applied Output
          </div>
          <pre className="max-h-40 overflow-auto rounded-md bg-slate-950/60 p-2 font-mono text-xs text-slate-300">
            {appliedText}
          </pre>
        </div>
      )}

      {isOpen && (
        <RawModal
          mode="all"
          category="Skills"
          initialText={sampleData}
          onApplyAll={handleApplyAll}
          onApplySelection={handleApplySelection}
          onExportAll={handleExportAll}
          onExportSelection={handleExportSelection}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
