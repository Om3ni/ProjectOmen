import type { SchemaData, TableSchema } from '@/models/schema';
import FieldEditor from '@/components/FieldEditor';
import DescriptionField from '@/components/DescriptionField';

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
 * Layout for Runes (RuneDef).
 * 
 * To reorder or change this page, just move the JSX around.
 */
export default function RunesLayout({ tableSchema, record, onChange }: Props) {
  const set = (field: string, value: unknown) => onChange({ ...record, [field]: value });

  const gameItemIdCol = col(tableSchema, 'Game Item ID');
  const runeSlotCol = col(tableSchema, 'Rune Slot');
  const broadcastCol = col(tableSchema, 'Broadcast Equip');
  const autoEquipAddCol = col(tableSchema, 'Auto Equip on Add');
  const autoEquipEquipCol = col(tableSchema, 'Auto Equip on Equip');
  const allIncludesCol = col(tableSchema, 'All Includes Must Match');
  const allExcludesCol = col(tableSchema, 'All Excludes Must Match');
  const descCol = col(tableSchema, 'Description');

  const baseTextarea =
    'w-full rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 min-h-20';

  return (
    <div className="space-y-4">
      {/* Row 1: Game Item ID */}
      {gameItemIdCol && (
        <FieldEditor
          column={gameItemIdCol}
          value={record['Game Item ID']}
          onChange={(v) => set('Game Item ID', v)}
          label="Game Item ID"
        />
      )}

      {/* Row 2: Broadcast + Auto Equip flags */}
      <div className="grid grid-cols-3 gap-4">
        {broadcastCol && (
          <FieldEditor column={broadcastCol} value={record['Broadcast Equip']} onChange={(v) => set('Broadcast Equip', v)} label="Broadcast Equip" />
        )}
        {autoEquipEquipCol && (
          <FieldEditor column={autoEquipEquipCol} value={record['Auto Equip on Equip']} onChange={(v) => set('Auto Equip on Equip', v)} label="Auto Equip (Equip)" />
        )}
        {autoEquipAddCol && (
          <FieldEditor column={autoEquipAddCol} value={record['Auto Equip on Add']} onChange={(v) => set('Auto Equip on Add', v)} label="Auto Equip (Add)" />
        )}
      </div>

      {/* Row 3: Rune Slot */}
      {runeSlotCol && (
        <FieldEditor column={runeSlotCol} value={record['Rune Slot']} onChange={(v) => set('Rune Slot', v)} label="Rune Slot" />
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

      {/* Row 5: Include/Exclude flags */}
      <div className="grid grid-cols-2 gap-4">
        {allIncludesCol && (
          <FieldEditor
            column={allIncludesCol}
            value={record['All Includes Must Match']}
            onChange={(v) => set('All Includes Must Match', v)}
            label="All Includes Must Match"
          />
        )}
        {allExcludesCol && (
          <FieldEditor
            column={allExcludesCol}
            value={record['All Excludes Must Match']}
            onChange={(v) => set('All Excludes Must Match', v)}
            label="All Excludes Must Match"
          />
        )}
      </div>
    </div>
  );
}
