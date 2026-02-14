import { useMemo } from 'react';
import type { SchemaData } from '@/models/schema';

type Row = Record<string, unknown>;

function rows(data: SchemaData, table: string): Row[] {
  const arr = (data as Record<string, unknown>)[table];
  return Array.isArray(arr) ? (arr as Row[]) : [];
}

/**
 * Memoize schema array extraction from SchemaData.
 * Returns stable references for each table array, plus derived attributes/skills.
 */
export function useSchemaArrays(data: SchemaData) {
  const diceConfig = useMemo(() => rows(data, 'DiceConfig')[0] ?? {}, [data]);
  const diceRules = useMemo(() => rows(data, 'DiceRules')[0] ?? {}, [data]);

  const skillRows = useMemo(() => rows(data, 'SkillDef'), [data]);
  const statRows = useMemo(() => rows(data, 'Stat'), [data]);
  const perkRows = useMemo(() => rows(data, 'PerkDef'), [data]);
  const perkActs = useMemo(() => rows(data, 'PerkAction'), [data]);
  const spellRows = useMemo(() => rows(data, 'SpellDef'), [data]);
  const spellReqRows = useMemo(() => rows(data, 'SpellReqDef'), [data]);
  const statusRows = useMemo(() => rows(data, 'StatusDef'), [data]);
  const mutatorActionRows = useMemo(() => rows(data, 'MutatorAction'), [data]);
  const statusActionRows = useMemo(() => rows(data, 'StatusAction'), [data]);
  const mutatorDefRows = useMemo(() => rows(data, 'MutatorDef'), [data]);
  const mutatorCondRows = useMemo(() => rows(data, 'MutatorCondition'), [data]);

  const attributes = useMemo(
    () => skillRows.filter((r) => String(r.TypeFlag ?? 'f').toLowerCase() === 't'),
    [skillRows],
  );
  const skills = useMemo(
    () => skillRows.filter((r) => String(r.TypeFlag ?? 'f').toLowerCase() === 'f'),
    [skillRows],
  );

  return {
    diceConfig,
    diceRules,
    skillRows,
    statRows,
    perkRows,
    perkActs,
    spellRows,
    spellReqRows,
    statusRows,
    mutatorActionRows,
    statusActionRows,
    mutatorDefRows,
    mutatorCondRows,
    attributes,
    skills,
  };
}
