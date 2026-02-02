export type RprCategory =
  | 'Attributes'
  | 'Skills'
  | 'Perks'
  | 'Stats'
  | 'Runes'
  | 'Statuses'
  | 'Mutators'
  | 'Abilities'
  | (string & {});

export type ColumnType = string;

export interface SchemaColumn {
  index: number;
  name: string;
  type: ColumnType;
  default?: unknown;
  const?: unknown;
  enum?: Record<string, string>;
  sourceType?: string;
}

export interface TableUI {
  columns?: number;
  hidden?: string[];
  hiddenByTab?: Record<string, string[]>;
  displayOrder?: string[];
  labels?: Record<string, string>;
  tooltips?: Record<string, string>;
  input?: Record<string, string>;
  rows?: Record<string, number>;
  span?: Record<string, number>;
  scale?: Record<string, number>;
  layoutGrid?: Record<string, unknown>;
}

export interface TableSchema {
  columns: SchemaColumn[];
  ui?: TableUI;
}

export interface SchemaStructure {
  version?: string;
  notes?: string[];
  categories?: RprCategory[];
  tables: Record<string, TableSchema>;
}

export interface SchemaDataFile {
  schemaVersion?: string;
  data: Record<string, Array<Record<string, unknown>>>;
  tooltips?: Record<string, string>;
}

export type SchemaData = SchemaDataFile['data'];
