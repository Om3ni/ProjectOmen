import type { RprCategory } from '@/models/schema';

export type CategoryView = {
  category: RprCategory;
  table: string;
  filter?: (row: Record<string, unknown>) => boolean;
};

export const CATEGORY_VIEWS: CategoryView[] = [
  // Dice System is a special combined settings view (DiceConfig + DiceRules + Gear)
  { category: 'Dice System', table: 'DiceConfig' },
  {
    category: 'Attributes',
    table: 'SkillDef',
    filter: (row) => String(row.TypeFlag ?? 'f').toLowerCase() === 't',
  },
  {
    category: 'Skills',
    table: 'SkillDef',
    filter: (row) => String(row.TypeFlag ?? 'f').toLowerCase() === 'f',
  },
  { category: 'Perks', table: 'PerkDef' },
  { category: 'Stats', table: 'Stat' },
  { category: 'Runes', table: 'RuneDef' },
  { category: 'Statuses', table: 'StatusDef' },
  { category: 'Mutators', table: 'MutatorDef' },
  { category: 'Abilities', table: 'SpellDef' },
];
