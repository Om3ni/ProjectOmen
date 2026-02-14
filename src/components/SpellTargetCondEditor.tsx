import type { SchemaData, TableSchema } from '@/models/schema';
import ConditionEditor from '@/components/ConditionEditor';
import { SPELL_TARGET_COND_CONFIG } from '@/constants/conditionConfigs';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

export default function SpellTargetCondEditor(props: Props) {
  return <ConditionEditor {...props} config={SPELL_TARGET_COND_CONFIG} />;
}
