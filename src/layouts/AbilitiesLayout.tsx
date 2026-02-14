import { useMemo } from 'react';
import FormulaCalculator from '@/components/FormulaCalculator';
import type { SchemaData, TableSchema } from '@/models/schema';
import { str, col } from '@/utils/rprHelpers';
import FieldEditor from '@/components/FieldEditor';
import DescriptionField from '@/components/DescriptionField';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

type Opt = { value: string; label: string };

function boolVal(v: unknown): boolean {
  return String(v).toLowerCase() === 't';
}

/**
 * Layout for Abilities (SpellDef) with conditional field display.
 * 
 * CasterRollType controls what's shown:
 *   0 (Roll Skill) → show skill dropdown for RollStatSkillID
 *   1 (Roll Stat) → show stat dropdown for RollStatSkillID
 *   2 (Custom Formula) → show text field for CasterRollFormula
 * 
 * DCType controls what's shown:
 *   0 (Target Roll) → show skill dropdown for DCTypeFormula
 *   1 (Target Stat) / 3 (Target Roll Stat) → show stat dropdown for DCTypeFormula
 *   2 (Fixed) → show number input for FixedDCValue
 *   4 (Custom) → show text field for TargetDCFormula
 */
export default function AbilitiesLayout({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  // Build skill and stat option lists
  const skillOptions: Opt[] = useMemo(() => {
    const arr = Array.isArray(allData.SkillDef) ? (allData.SkillDef as Array<Record<string, unknown>>) : [];
    return arr
      .filter((s) => String(s.TypeFlag ?? 'f').toLowerCase() === 'f')
      .map((s) => {
        const id = s['Node ID'] ?? s.ID;
        return { value: String(id ?? ''), label: String(s.Name ?? `Skill ${id}`) };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const statOptions: Opt[] = useMemo(() => {
    const arr = Array.isArray(allData.Stat) ? (allData.Stat as Array<Record<string, unknown>>) : [];
    return arr
      .map((s) => ({ value: String(s.ID ?? ''), label: String(s.Name ?? `Stat ${s.ID}`) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  // Column definitions
  const nameCol = col(tableSchema, 'Name');
  const descCol = col(tableSchema, 'Description');
  const categoryCol = col(tableSchema, 'Category');
  const abilityIconCol = col(tableSchema, 'AbilityIcon');
  const targetTypeCol = col(tableSchema, 'TargetType');
  const targetsCol = col(tableSchema, '#Targets');
  const rangeCol = col(tableSchema, 'Range');
  const casterRollTypeCol = col(tableSchema, 'CasterRollType');
  const dcTypeCol = col(tableSchema, 'DCType');
  const cooldownCol = col(tableSchema, 'CooldownMinutes');
  const chatRadiusCol = col(tableSchema, 'ChatRadius');
  const commonAbilityCol = col(tableSchema, 'CommonAbility');
  const allowModsCol = col(tableSchema, 'AllowPlayerModifiers');
  const logUsageCol = col(tableSchema, 'LogUsage');
  const allowCommentCol = col(tableSchema, 'AllowPlayerComment');
  const enableCritsCol = col(tableSchema, 'EnableCriticalRolls');

  // Current values for conditional logic
  const casterRollType = Number(record.CasterRollType ?? 0);
  const dcType = Number(record.DCType ?? 0);

  const baseInput =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40';
  const baseTextarea = baseInput + ' min-h-24';
  const labelCls = 'text-xs font-semibold text-slate-400 uppercase tracking-wide';

  // Handle CasterRollType change - reset dependent fields
  const onCasterRollTypeChange = (val: string) => {
    const type = Number(val) || 0;
    const patch: Record<string, unknown> = { CasterRollType: type };
    if (type === 0) {
      // Roll Skill - keep RollStatSkillID if valid skill, otherwise reset
      const current = Number(record.RollStatSkillID);
      if (!skillOptions.some((opt) => opt.value === String(current))) {
        patch.RollStatSkillID = skillOptions[0]?.value ?? 0;
      }
      patch.CasterRollFormula = '';
    } else if (type === 1) {
      // Roll Stat - keep RollStatSkillID if valid stat, otherwise reset
      const current = Number(record.RollStatSkillID);
      if (!statOptions.some((opt) => opt.value === String(current))) {
        patch.RollStatSkillID = statOptions[0]?.value ?? 0;
      }
      patch.CasterRollFormula = '';
    } else if (type === 2) {
      // Custom Formula
      patch.RollStatSkillID = 0;
    }
    onChange({ ...record, ...patch });
  };

  // Handle DCType change - reset dependent fields
  const onDCTypeChange = (val: string) => {
    const type = Number(val) || 0;
    const patch: Record<string, unknown> = { DCType: type };
    if (type === 0) {
      // Target Roll - use skill
      const current = Number(record.DCTypeFormula);
      if (!skillOptions.some((opt) => opt.value === String(current))) {
        patch.DCTypeFormula = skillOptions[0]?.value ?? '';
      }
      patch.FixedDCValue = 0;
      patch.TargetDCFormula = '';
    } else if (type === 1 || type === 3) {
      // Target Stat / Target Roll Stat - use stat
      const current = Number(record.DCTypeFormula);
      if (!statOptions.some((opt) => opt.value === String(current))) {
        patch.DCTypeFormula = statOptions[0]?.value ?? '';
      }
      patch.FixedDCValue = 0;
      patch.TargetDCFormula = '';
    } else if (type === 2) {
      // Fixed DC
      patch.DCTypeFormula = '';
      patch.TargetDCFormula = '';
    } else if (type === 4) {
      // Custom
      patch.DCTypeFormula = '';
      patch.FixedDCValue = 0;
    }
    onChange({ ...record, ...patch });
  };

  // Render the Caster Roll detail field based on type
  const renderCasterDetail = () => {
    if (casterRollType === 0) {
      // Roll Skill → show skill dropdown
      return (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>Caster skill</div>
          <select
            className={baseInput}
            value={str(record.RollStatSkillID)}
            onChange={(e) => set('RollStatSkillID', Number(e.target.value) || 0)}
          >
            <option value="">—</option>
            {skillOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    if (casterRollType === 1) {
      // Roll Stat → show stat dropdown
      return (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>Caster stat</div>
          <select
            className={baseInput}
            value={str(record.RollStatSkillID)}
            onChange={(e) => set('RollStatSkillID', Number(e.target.value) || 0)}
          >
            <option value="">—</option>
            {statOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    if (casterRollType === 2) {
      // Custom Formula → show text input and calculator
      return (
        <div className="flex flex-col gap-2">
          <div className={labelCls}>Custom roll formula</div>
          <div className="flex gap-2">
            <input
              type="text"
              className={baseInput}
              value={str(record.CasterRollFormula)}
              onChange={(e) => set('CasterRollFormula', e.target.value)}
              placeholder="e.g. 1d20+5"
            />
            <FormulaCalculator
              label="Custom Roll Formula"
              value={str(record.CasterRollFormula)}
              onChange={(v) => set('CasterRollFormula', v)}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  // Render the DC detail field based on type
  const renderDCDetail = () => {
    if (dcType === 0) {
      // Target Roll → show skill dropdown (Target rolls)
      return (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>Target rolls</div>
          <select
            className={baseInput}
            value={str(record.DCTypeFormula)}
            onChange={(e) => set('DCTypeFormula', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">—</option>
            {skillOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    if (dcType === 1 || dcType === 3) {
      // Target Stat / Target Roll Stat → show stat dropdown
      return (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>Target stat</div>
          <select
            className={baseInput}
            value={str(record.DCTypeFormula)}
            onChange={(e) => set('DCTypeFormula', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">—</option>
            {statOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    if (dcType === 2) {
      // Fixed → show number input
      return (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>Fixed DC Value</div>
          <input
            type="number"
            className={baseInput}
            value={str(record.FixedDCValue)}
            onChange={(e) => set('FixedDCValue', Number(e.target.value) || 0)}
          />
        </div>
      );
    }
    if (dcType === 4) {
      // Custom → show text input and calculator
      return (
        <div className="flex flex-col gap-2">
          <div className={labelCls}>Target DC Formula</div>
          <div className="flex gap-2">
            <input
              type="text"
              className={baseInput}
              value={str(record.TargetDCFormula)}
              onChange={(e) => set('TargetDCFormula', e.target.value)}
              placeholder="e.g. 1d20+3"
            />
            <FormulaCalculator
              label="Target DC Formula"
              value={str(record.TargetDCFormula)}
              onChange={(v) => set('TargetDCFormula', v)}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  // Checkbox helper
  const renderCheckbox = (field: string, label: string, note?: string) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
        checked={boolVal(record[field])}
        onChange={(e) => set(field, e.target.checked ? 't' : 'f')}
      />
      <span className="text-sm text-slate-200">{label}</span>
      {note && <span className="text-xs text-slate-500">{note}</span>}
    </label>
  );

  return (
    <div className="space-y-4">
      {/* Row 1: Name */}
      {nameCol && (
        <FieldEditor
          column={nameCol}
          value={record.Name}
          label="Name"
          onFocus={() => {
            const autoName = typeof record.__autoName === 'string' ? record.__autoName : '';
            const alreadyCleared = record.__autoNameCleared === true;
            const current = String(record.Name ?? '');
            if (!alreadyCleared && autoName && current === autoName) {
              onChange({ ...record, Name: '', __autoNameCleared: true });
            }
          }}
          onChange={(v) => {
            const nextRecord: Record<string, unknown> = { ...record, Name: v, __autoNameCleared: true };
            const autoName = typeof record.__autoName === 'string' ? record.__autoName : '';
            const nextName = String(v ?? '');
            if (autoName && nextName !== autoName) delete nextRecord.__autoName;
            onChange(nextRecord);
          }}
        />
      )}

      {/* Row 2: Category + Select Icon */}
      <div className="grid grid-cols-3 gap-4">
        {categoryCol && (
          <FieldEditor column={categoryCol} value={record.Category} onChange={(v) => set('Category', v)} label="Category" />
        )}
        {abilityIconCol && (
          <FieldEditor column={abilityIconCol} value={record.AbilityIcon} onChange={(v) => set('AbilityIcon', v)} label="Select Icon" />
        )}
      </div>

      {/* Row 3: Description (full width) */}
      {descCol && (
        <div className="flex flex-col gap-1">
          <div className={labelCls}>Description</div>
          <DescriptionField
            value={str(record.Description)}
            onChange={(v) => set('Description', v)}
            placeholder="Describe how to use (or not to use) this ability. This will appear as a tooltip in the player's UI."
            className={baseTextarea}
          />
        </div>
      )}

      {/* Row 4: Caster roll type + Caster skill/stat/formula (conditional) */}
      <div className="grid grid-cols-2 gap-4">
        {casterRollTypeCol && (
          <div className="flex flex-col gap-1">
            <div className={labelCls}>Caster roll type</div>
            <select
              className={baseInput}
              value={str(record.CasterRollType)}
              onChange={(e) => onCasterRollTypeChange(e.target.value)}
            >
              {Object.entries(casterRollTypeCol.enum || {}).map(([k, v]) => (
                <option key={k} value={k}>{v as string}</option>
              ))}
            </select>
          </div>
        )}
        {renderCasterDetail()}
      </div>

      {/* Row 5: Target Type + # of Targets + In Range */}
      <div className="grid grid-cols-3 gap-4">
        {targetTypeCol && (
          <FieldEditor column={targetTypeCol} value={record.TargetType} onChange={(v) => set('TargetType', v)} label="Target Type" />
        )}
        {targetsCol && (
          <div className="flex flex-col gap-1">
            <div className={labelCls}># of Targets</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                min={0}
                max={10}
                step={1}
                value={Number(record['#Targets']) || 0}
                onChange={(e) => set('#Targets', Number(e.target.value))}
              />
              <span className="text-sm text-slate-300 w-8 text-right">{Number(record['#Targets']) || 0}</span>
            </div>
          </div>
        )}
        {rangeCol && (
          <div className="flex flex-col gap-1">
            <div className={labelCls}>In Range</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                min={0}
                max={20}
                step={0.5}
                value={Number(record.Range) || 0}
                onChange={(e) => set('Range', Number(e.target.value))}
              />
              <span className="text-sm text-slate-300 w-12 text-right">{Number(record.Range) || 0} tiles</span>
            </div>
          </div>
        )}
      </div>

      {/* Row 6: DC Type + Target rolls/stat/value (conditional) */}
      <div className="grid grid-cols-2 gap-4">
        {dcTypeCol && (
          <div className="flex flex-col gap-1">
            <div className={labelCls}>DC Type</div>
            <select
              className={baseInput}
              value={str(record.DCType)}
              onChange={(e) => onDCTypeChange(e.target.value)}
            >
              {Object.entries(dcTypeCol.enum || {}).map(([k, v]) => (
                <option key={k} value={k}>{v as string}</option>
              ))}
            </select>
          </div>
        )}
        {renderDCDetail()}
      </div>

      {/* Row 7: Cooldown + Chat Radius */}
      <div className="grid grid-cols-2 gap-4">
        {cooldownCol && (
          <div className="flex flex-col gap-1">
            <div className={labelCls}>Cooldown</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                min={0}
                max={10080}
                step={1}
                value={Number(record.CooldownMinutes) || 0}
                onChange={(e) => set('CooldownMinutes', Number(e.target.value))}
              />
              <span className="text-sm text-slate-300 w-20 text-right">{Number(record.CooldownMinutes) || 0} minutes</span>
            </div>
          </div>
        )}
        {chatRadiusCol && (
          <FieldEditor column={chatRadiusCol} value={record.ChatRadius} onChange={(v) => set('ChatRadius', v)} label="Chat radius" />
        )}
      </div>

      {/* Row 8: Checkboxes */}
      <div className="flex flex-col gap-2 py-2">
        {commonAbilityCol && renderCheckbox('CommonAbility', 'Common Ability')}
        {allowModsCol && renderCheckbox('AllowPlayerModifiers', 'Allow player modifiers')}
        {allowCommentCol && renderCheckbox('AllowPlayerComment', 'Allow player comment')}
        {enableCritsCol && renderCheckbox('EnableCriticalRolls', 'Enable Critical Rolls', 'd20 System only')}
        {logUsageCol && renderCheckbox('LogUsage', 'Log usage')}
      </div>
    </div>
  );
}
