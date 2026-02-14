import type { SchemaData, TableSchema } from '@/models/schema';
import { str, col } from '@/utils/rprHelpers';
import FieldEditor from '@/components/FieldEditor';
import DescriptionField from '@/components/DescriptionField';
import AttributeBonusBuilder from '@/components/AttributeBonusBuilder';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

/**
 * Layout for Skills (SkillDef where TypeFlag = 'f').
 * 
 * To reorder or change this page, just move the JSX around.
 */
export default function SkillsLayout({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const nameCol = col(tableSchema, 'Name');
  const publicCol = col(tableSchema, 'Public');
  const trainedCol = col(tableSchema, 'Trained');
  const maxAllocCol = col(tableSchema, 'Max Allocation');
  const naturalBonusCol = col(tableSchema, 'Natural Bonus');
  const descCol = col(tableSchema, 'Description');
  const bonusFnCol = col(tableSchema, 'Bonus Function');

  const baseInput =
    'w-full rounded-md border theme-border-muted theme-bg-input px-3 py-2 text-sm theme-text placeholder-current theme-text-muted focus:outline-none theme-ring';
  const baseTextarea = baseInput + ' min-h-28';

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

      {/* Bonus Builder section */}
      <div className="rounded-lg border theme-border theme-bg-input p-3">
        <div className="mb-2 text-sm font-semibold theme-text">Bonus</div>

        {/* Function dropdown */}
        {bonusFnCol && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold theme-text-secondary">Function</div>
            <select
              className={baseInput}
              value={str(record['Bonus Function'] ?? '0')}
              onChange={(e) => set('Bonus Function', e.target.value)}
            >
              {Object.entries(bonusFnCol.enum ?? {}).map(([k, v]) => (
                <option key={k} value={k}>
                  {String(v)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sources builder */}
        <div className="mt-3">
          <div className="text-xs font-semibold theme-text-secondary mb-2">Sources</div>
          <AttributeBonusBuilder
            allData={allData}
            value={str(record['Bonus Source'])}
            onChange={(next: string) => set('Bonus Source', next)}
            addButtonLabel="Add bonus source"
          />
        </div>
      </div>

      {/* Row: Trained + Public */}
      <div className="grid grid-cols-2 gap-4">
        {trainedCol && (
          <FieldEditor column={trainedCol} value={record.Trained} onChange={(v) => set('Trained', v)} label="Trained only" />
        )}
        {publicCol && (
          <FieldEditor column={publicCol} value={record.Public} onChange={(v) => set('Public', v)} label="Public" />
        )}
      </div>

      {/* Row: Natural Bonus + Max Allocation */}
      <div className="grid grid-cols-2 gap-4">
        {naturalBonusCol && (
          <FieldEditor
            column={naturalBonusCol}
            value={record['Natural Bonus']}
            onChange={(v) => set('Natural Bonus', v)}
            label="Natural Bonus"
          />
        )}
        {maxAllocCol && (
          <FieldEditor
            column={maxAllocCol}
            value={record['Max Allocation']}
            onChange={(v) => set('Max All', v)}
            label="Max Allocation"
          />
        )}
      </div>

      {/* Description (full width) */}
      {descCol && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold theme-text-secondary">Description</div>
          <DescriptionField
            value={str(record.Description)}
            onChange={(v) => set('Description', v)}
            placeholder="Description"
            className={baseTextarea}
          />
        </div>
      )}
    </div>
  );
}
