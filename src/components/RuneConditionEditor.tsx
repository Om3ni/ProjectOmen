import type { SchemaData, TableSchema } from '@/models/schema';
import ConditionEditor from '@/components/ConditionEditor';
import { RUNE_CONDITION_CONFIG } from '@/constants/conditionConfigs';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

export default function RuneConditionEditor(props: Props) {
  return <ConditionEditor {...props} config={RUNE_CONDITION_CONFIG} />;
}
