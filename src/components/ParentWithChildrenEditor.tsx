import { useMemo } from 'react';

import type { SchemaData, SchemaStructure, TableSchema } from '@/models/schema';
import RecordEditor from '@/components/RecordEditor';
import ChildTableSection from '@/components/ChildTableSection';
import { CHILDREN_BY_PARENT } from '@/components/childrenConfigs';
import {
  PerksLayout,
  RunesLayout,
  StatusesLayout,
  MutatorsLayout,
  AbilitiesLayout,
} from '@/layouts';

type Props = {
  category: string;
  schema: SchemaStructure;
  data: SchemaData;
  tableName: string;
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allowIdEdit?: boolean;
  onChangeRecord: (next: Record<string, unknown>) => void;
  onSetTableRows: (table: string, nextRows: Array<Record<string, unknown>>) => void;
};

// children configs live in a separate module (keeps react-refresh lint happy)

function parentId(record: Record<string, unknown>): number | null {
  const id = Number(record.ID);
  // Child tables link via FK to the parent's numeric ID.
  // Treat non-positive IDs as unset so we don't accidentally link multiple
  // parents through FK=0 (which looks like broken linking).
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function ParentWithChildrenEditor({
  category,
  schema,
  data,
  tableName,
  tableSchema,
  record,
  allowIdEdit = false,
  onChangeRecord,
  onSetTableRows,
}: Props) {
  const children = useMemo(() => CHILDREN_BY_PARENT[tableName] ?? [], [tableName]);
  const id = parentId(record);

  // Render the parent record using category-specific layouts
  const renderParentEditor = () => {
    const layoutProps = { tableSchema, record, allData: data, onChange: onChangeRecord, allowIdEdit };
    
    switch (tableName) {
      case 'SpellDef':
        return <AbilitiesLayout {...layoutProps} />;
      case 'PerkDef':
        return <PerksLayout {...layoutProps} />;
      case 'RuneDef':
        return <RunesLayout {...layoutProps} />;
      case 'StatusDef':
        return <StatusesLayout {...layoutProps} />;
      case 'MutatorDef':
        return <MutatorsLayout {...layoutProps} />;
      default:
        return (
          <RecordEditor
            tableName={tableName}
            tableSchema={tableSchema}
            record={record}
            onChange={onChangeRecord}
            tabName={category}
            allowIdEdit={allowIdEdit}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {renderParentEditor()}

      {id === null ? (
        <div className="rounded-md border border-slate-800 bg-slate-950/20 p-3 text-sm text-slate-400">
          Set an ID before editing child rows.
        </div>
      ) : (
        children.map((child) => (
          <ChildTableSection
            key={`${tableName}:${child.table}:${id}`}
            schema={schema}
            data={data}
            parent={record}
            parentId={id}
            child={child}
            tabName={category}
            allowIdEdit={allowIdEdit}
            onChangeParent={onChangeRecord}
            onSetTableRows={onSetTableRows}
          />
        ))
      )}
    </div>
  );
}
