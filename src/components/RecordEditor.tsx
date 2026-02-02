import { useMemo } from 'react';

import type { SchemaColumn, TableSchema } from '@/models/schema';
import FieldEditor from '@/components/FieldEditor';

type Props = {
  tableName: string;
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  tabName?: string;
  hiddenFields?: string[];
  allowIdEdit?: boolean;
};

function getHiddenSet(schema: TableSchema, tabName?: string, hiddenFields?: string[]): Set<string> {
  const ui = schema.ui;
  const hidden = new Set<string>(Array.isArray(ui?.hidden) ? ui!.hidden! : []);
  if (tabName && ui?.hiddenByTab && typeof ui.hiddenByTab === 'object') {
    const extra = ui.hiddenByTab[tabName];
    if (Array.isArray(extra)) extra.forEach((name) => hidden.add(name));
  }
  if (Array.isArray(hiddenFields)) {
    hiddenFields.forEach((name) => hidden.add(name));
  }
  return hidden;
}

function orderedColumns(schema: TableSchema): SchemaColumn[] {
  const columns = Array.isArray(schema.columns) ? schema.columns : [];
  const order = schema.ui?.displayOrder;
  if (!Array.isArray(order) || order.length === 0) return columns;

  const byName = new Map(columns.map((c) => [c.name, c] as const));
  const picked: SchemaColumn[] = [];
  for (const name of order) {
    const col = byName.get(name);
    if (col) picked.push(col);
  }
  // Append any not explicitly ordered
  for (const col of columns) {
    if (!picked.includes(col)) picked.push(col);
  }
  return picked;
}

export default function RecordEditor({ tableName, tableSchema, record, onChange, tabName, hiddenFields, allowIdEdit = false }: Props) {
  const hidden = useMemo(() => {
    const set = getHiddenSet(tableSchema, tabName, hiddenFields);
    if (!allowIdEdit) {
      set.add('ID');
      set.add('Node ID');
    }
    return set;
  }, [tableSchema, tabName, hiddenFields, allowIdEdit]);
  const columns = useMemo(() => orderedColumns(tableSchema), [tableSchema]);
  const labels = tableSchema.ui?.labels ?? {};
  const tooltips = tableSchema.ui?.tooltips ?? {};

  const visibleColumns = columns.filter((c) => !hidden.has(c.name));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visibleColumns.map((col) => (
        <FieldEditor
          key={`${tableName}:${col.name}`}
          column={col}
          value={record[col.name]}
          label={labels[col.name] ?? col.name}
          tooltip={tooltips[col.name]}
          onFocus={() => {
            if (col.name !== 'Name') return;
            const autoName = typeof record.__autoName === 'string' ? record.__autoName : '';
            const alreadyCleared = record.__autoNameCleared === true;
            const current = String(record.Name ?? '');
            if (!alreadyCleared && autoName && current === autoName) {
              onChange({
                ...record,
                Name: '',
                __autoNameCleared: true,
              });
            }
          }}
          onChange={(next) => {
            const nextRecord: Record<string, unknown> = {
              ...record,
              [col.name]: next,
            };

            if (col.name === 'Name') {
              const autoName = typeof record.__autoName === 'string' ? record.__autoName : '';
              const nextName = String(next ?? '');
              // Once the user edits the Name, never auto-clear again.
              nextRecord.__autoNameCleared = true;
              if (autoName && nextName !== autoName) {
                delete nextRecord.__autoName;
              }
            }

            onChange(nextRecord);
          }}
        />
      ))}
    </div>
  );
}
