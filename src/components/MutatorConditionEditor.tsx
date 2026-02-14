import type { SchemaData, TableSchema } from '@/models/schema';
import ConditionEditor from '@/components/ConditionEditor';
import { MUTATOR_CONDITION_CONFIG } from '@/constants/conditionConfigs';

type Props = {
  tableSchema: TableSchema;
  record: Record<string, unknown>;
  allData: SchemaData;
  onChange: (next: Record<string, unknown>) => void;
};

export default function MutatorConditionEditor(props: Props) {
  return <ConditionEditor {...props} config={MUTATOR_CONDITION_CONFIG} />;
}
