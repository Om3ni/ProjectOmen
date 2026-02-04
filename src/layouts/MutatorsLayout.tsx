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
 * Layout for Mutators (MutatorDef).
 * 
 * To reorder or change this page, just move the JSX around.
 */
export default function MutatorsLayout({ tableSchema, record, onChange, allowIdEdit = false }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const idCol = col(tableSchema, 'ID');
  const nameCol = col(tableSchema, 'Name');
  const priorityCol = col(tableSchema, 'Priority');
  const condModeCol = col(tableSchema, 'ConditionMode');
  const descCol = col(tableSchema, 'Description');

  const baseTextarea =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 min-h-20';

  return (
    <div className="space-y-4">
      {/* Row 1: ID + Name */}
      <div className="grid grid-cols-2 gap-4">
        {allowIdEdit && idCol && (
          <FieldEditor column={idCol} value={record.ID} onChange={(v) => set('ID', v)} label="ID" />
        )}
        {nameCol && (
          <FieldEditor column={nameCol} value={record.Name} onChange={(v) => set('Name', v)} label="Name" />
        )}
      </div>

      {/* Row 2: Priority + Condition Mode */}
      <div className="grid grid-cols-2 gap-4">
        {priorityCol && (
          <FieldEditor column={priorityCol} value={record.Priority} onChange={(v) => set('Priority', v)} label="Priority" />
        )}
        {condModeCol && (
          <FieldEditor column={condModeCol} value={record.ConditionMode} onChange={(v) => set('ConditionMode', v)} label="Condition Mode" />
        )}
      </div>

      {/* Row 3: Description */}
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
