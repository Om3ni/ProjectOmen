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
 * Layout for Perks (PerkDef).
 * 
 * To reorder or change this page, just move the JSX around.
 */
export default function PerksLayout({ tableSchema, record, onChange, allowIdEdit = false }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const labels = tableSchema.ui?.labels ?? {};
  const tooltips = tableSchema.ui?.tooltips ?? {};

  const idCol = col(tableSchema, 'ID');
  const nameCol = col(tableSchema, 'Name');
  const publicCol = col(tableSchema, 'Public');
  const categoryCol = col(tableSchema, 'Category');
  const costCol = col(tableSchema, 'Cost');
  const descCol = col(tableSchema, 'Description');

  const baseTextarea =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 min-h-20';

  return (
    <div className="space-y-4">
      {/* Row 1: Name + Public (+ optional ID when unlocked) */}
      <div className={allowIdEdit ? 'grid grid-cols-3 gap-4' : 'grid grid-cols-2 gap-4'}>
        {allowIdEdit && idCol ? (
          <FieldEditor
            column={idCol}
            value={record.ID}
            onChange={(v) => set('ID', v)}
            label={labels.ID ?? 'ID'}
            tooltip={tooltips.ID}
          />
        ) : null}
        {nameCol ? (
          <FieldEditor
            column={nameCol}
            value={record.Name}
            onChange={(v) => set('Name', v)}
            label={labels.Name ?? 'Name'}
            tooltip={tooltips.Name}
          />
        ) : null}
        {publicCol ? (
          <FieldEditor
            column={publicCol}
            value={record.Public}
            onChange={(v) => set('Public', v)}
            label={labels.Public ?? 'Public'}
            tooltip={tooltips.Public}
          />
        ) : null}
      </div>

      {/* Row 2: Category + Cost */}
      <div className="grid grid-cols-2 gap-4">
        {categoryCol ? (
          <FieldEditor
            column={categoryCol}
            value={record.Category}
            onChange={(v) => set('Category', v)}
            label={labels.Category ?? 'Category'}
            tooltip={tooltips.Category}
          />
        ) : null}
        {costCol ? (
          <FieldEditor
            column={costCol}
            value={record.Cost}
            onChange={(v) => set('Cost', v)}
            label={labels.Cost ?? 'Cost'}
            tooltip={tooltips.Cost}
          />
        ) : null}
      </div>

      {/* Row 3: Description (bigger, native-style) */}
      {descCol ? (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-200">{labels.Description ?? 'Description'}</div>
          {tooltips.Description ? (
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{tooltips.Description}</div>
          ) : null}
          <DescriptionField
            value={str(record.Description)}
            onChange={(v) => set('Description', v)}
            placeholder={labels.Description ?? 'Description'}
            className={baseTextarea}
            rows={6}
          />
        </div>
      ) : null}
    </div>
  );
}
