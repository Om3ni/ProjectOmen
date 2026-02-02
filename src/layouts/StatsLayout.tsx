import type { SchemaData, TableSchema } from '@/models/schema';
import FieldEditor from '@/components/FieldEditor';
import DescriptionField from '@/components/DescriptionField';
import AttributeBonusBuilder from '@/components/AttributeBonusBuilder';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

function col(schema: TableSchema, name: string) {
  return schema.columns.find((c) => c.name === name);
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Layout for Stats (Stat).
 * 
 * To reorder or change this page, just move the JSX around.
 */
export default function StatsLayout({ tableSchema, record, allData, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const nameCol = col(tableSchema, 'Name');
  const baseCol = col(tableSchema, 'Base');
  const bonusCol = col(tableSchema, 'Bonus');
  const publicCol = col(tableSchema, 'Public');
  const showCol = col(tableSchema, 'Show');
  const activeCol = col(tableSchema, 'Active');
  const trainableCol = col(tableSchema, 'Trainable');
  const displayCol = col(tableSchema, 'Display');
  const descCol = col(tableSchema, 'Description');

  const baseTextarea =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 min-h-20';

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

      {/* Bonus Builder (edits hidden Formula field) */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/20 p-3">
        <div className="mb-2 text-sm font-semibold">Bonus Builder</div>
        {/* Function and Final Multiplier row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold text-slate-200">Function</div>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
              value={String(record.BonusFunction ?? '0')}
              onChange={(e) => set('BonusFunction', e.target.value)}
            >
              <option value="0">Sum</option>
              <option value="1">Average</option>
              <option value="2">Take Min</option>
              <option value="3">Take Max</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold text-slate-200">Final Multiplier</div>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
              placeholder="Final Multiplier"
              value={String(record.Scale ?? 1)}
              onChange={(e) => set('Scale', Number(e.target.value) || 1)}
            />
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-200 mb-2">Sources</div>
        <AttributeBonusBuilder
          allData={allData}
          value={str(record.Formula)}
          onChange={(next) => set('Formula', next)}
          addButtonLabel="Add bonus source"
        />
      </div>

      {/* Row: Base + Min Value */}
      <div className="grid grid-cols-2 gap-4">
        {baseCol && (
          <FieldEditor column={baseCol} value={record.Base} onChange={(v) => set('Base', v)} label="Base Value" />
        )}
        {bonusCol && (
          <FieldEditor column={bonusCol} value={record.Bonus} onChange={(v) => set('Bonus', v)} label="Min Value" />
        )}
      </div>

      {/* Row: Flags - Public + Secret */}
      <div className="grid grid-cols-2 gap-4">
        {publicCol && (
          <FieldEditor column={publicCol} value={record.Public} onChange={(v) => set('Public', v)} label="Public" />
        )}
        {displayCol && (
          <FieldEditor column={displayCol} value={record.Display} onChange={(v) => set('Display', v)} label="Secret" />
        )}
      </div>

      {/* Row: Can Modify + Player Can Modify */}
      <div className="grid grid-cols-2 gap-4">
        {trainableCol && (
          <FieldEditor column={trainableCol} value={record.Trainable} onChange={(v) => set('Trainable', v)} label="Can Modify" />
        )}
        {activeCol && (
          <FieldEditor
            column={activeCol}
            value={record.Active}
            onChange={(v) => set('Active', v)}
            label="Player Can Modify"
            disabled={String(record.Trainable ?? 'f').toLowerCase() !== 't'}
          />
        )}
      </div>

      {/* Row: Player Can Reset (standalone) */}
      {showCol && (
        <FieldEditor column={showCol} value={record.Show} onChange={(v) => set('Show', v)} label="Player Can Reset" />
      )}

      {/* Description */}
      {descCol && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-200">Description</div>
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
