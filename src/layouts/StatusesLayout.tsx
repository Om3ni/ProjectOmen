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
 * Layout for Statuses (StatusDef).
 * 
 * To reorder or change this page, just move the JSX around.
 */
export default function StatusesLayout({ tableSchema, record, onChange, allowIdEdit = false }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const idCol = col(tableSchema, 'ID');
  const nameCol = col(tableSchema, 'Name');
  const colorCol = col(tableSchema, 'Color');
  const publicCol = col(tableSchema, 'Public');
  const categoryCol = col(tableSchema, 'Category');
  const dispellableCol = col(tableSchema, 'Dispellable');
  const descCol = col(tableSchema, 'Description');

  const hasIdEditor = Boolean(allowIdEdit && idCol);
  const row1Cols = hasIdEditor && nameCol ? 2 : 1;
  const row2Cols = [publicCol, colorCol, dispellableCol].filter(Boolean).length >= 2 ? 2 : 1;

  const baseTextarea =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 min-h-20';

  return (
    <div className="space-y-4">
      {/* Row 1: ID + Name */}
      <div className={`grid gap-4 ${row1Cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {allowIdEdit && idCol && (
          <FieldEditor column={idCol} value={record.ID} onChange={(v) => set('ID', v)} label="ID" />
        )}
        {nameCol && (
          <FieldEditor column={nameCol} value={record.Name} onChange={(v) => set('Name', v)} label="Name" />
        )}
      </div>

      {/* Row 2: Public / Color / Dispellable (depending on schema) */}
      {(publicCol || colorCol || dispellableCol) && (
        <div className={`grid gap-4 ${row2Cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {publicCol && (
            <FieldEditor column={publicCol} value={record.Public} onChange={(v) => set('Public', v)} label="Public" />
          )}
          {colorCol && (
            <FieldEditor column={colorCol} value={record.Color} onChange={(v) => set('Color', v)} label="Color" />
          )}
          {dispellableCol && (
            <FieldEditor column={dispellableCol} value={record.Dispellable} onChange={(v) => set('Dispellable', v)} label="Dispellable" />
          )}
        </div>
      )}

      {/* Row 3: Category */}
      {categoryCol && (
        <FieldEditor column={categoryCol} value={record.Category} onChange={(v) => set('Category', v)} label="Category" />
      )}

      {/* Row 4: Description */}
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
