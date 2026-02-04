import type { SchemaData, TableSchema } from '@/models/schema';
import FieldEditor from '@/components/FieldEditor';
import DescriptionField from '@/components/DescriptionField';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
  allowIdEdit?: boolean;
};

function col(schema: TableSchema, name: string) {
  return schema.columns.find((c) => c.name === name);
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Layout for Attributes (SkillDef where TypeFlag = 't').
 *
 * To reorder or change this page, just move the JSX around.
 */
export default function AttributesLayout({ tableSchema, record, onChange, allowIdEdit = false }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const nodeIdCol = col(tableSchema, 'Node ID');
  const nameCol = col(tableSchema, 'Name');
  const publicCol = col(tableSchema, 'Public');
  const maxAllocCol = col(tableSchema, 'Max Allocation');
  const naturalBonusCol = col(tableSchema, 'Natural Bonus');
  const descCol = col(tableSchema, 'Description');

  const baseInput =
    'w-full rounded-md border theme-border-muted theme-bg-input px-3 py-2 text-sm theme-text placeholder-current theme-text-muted focus:outline-none theme-ring';
  const baseTextarea = baseInput + ' min-h-28';

  return (
    <div className="space-y-4">
      {/* Row 1: Node ID + Name */}
      <div className="grid grid-cols-2 gap-4">
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
        {allowIdEdit && nodeIdCol && (
          <FieldEditor
            column={nodeIdCol}
            value={record['Node ID']}
            onChange={(v) => set('Node ID', v)}
            label="Node ID"
          />
        )}
      </div>
      {/* Row 2: Public */}
      {publicCol && (
        <FieldEditor column={publicCol} value={record.Public} onChange={(v) => set('Public', v)} label="Public" />
      )}

      {/* Row 3: Natural Bonus + Max Allocation */}
      <div className="grid grid-cols-4 gap-20">
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
            onChange={(v) => set('Max Allocation', v)}
            label="Max Allocation"
          />
        )}
      </div>

      {/* Row 4: Description */}
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
