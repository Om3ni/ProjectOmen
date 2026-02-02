import { useCallback, useMemo, useState } from 'react';

import type { RprCategory } from '@/models/schema';
import { stripRprPreviewPrefixes } from '@/utils/rprText';

export function parseLines(text: string): string[][] {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
    .map((line) => line.split('|'));
}

export function rowsToText(rows: string[][]): string {
  return rows.map((r) => r.join('|')).join('\n');
}

/**
 * Group rows by table type, keeping child tables underneath their parents.
 * This provides a cleaner appearance than native file order.
 */
export function groupRowsByTable(rows: string[][]): string[][] {
  const parentOrder = [
    'AttributeDef',
    'SkillDef',
    'Stat',
    'PerkDef',
    'SpellDef',
    'RuneDef',
    'StatusDef',
    'MutatorDef',
  ];

  const parentToChildren: Record<string, string[]> = {
    PerkDef: ['PerkAction'],
    SpellDef: ['SpellReqDef', 'SpellTargetCond', 'SpellEffect'],
    RuneDef: ['RuneCondition', 'RuneAction'],
    StatusDef: ['StatusAction'],
    MutatorDef: ['MutatorCondition', 'MutatorAction'],
  };

  const byToken: Record<string, string[][]> = {};
  for (const row of rows) {
    const token = row[0] ?? '';
    if (!byToken[token]) byToken[token] = [];
    byToken[token].push(row);
  }

  const result: string[][] = [];
  const seen = new Set<string>();

  for (const parent of parentOrder) {
    if (byToken[parent] && !seen.has(parent)) {
      result.push(...byToken[parent]);
      seen.add(parent);

      const children = parentToChildren[parent] ?? [];
      for (const child of children) {
        if (byToken[child] && !seen.has(child)) {
          result.push(...byToken[child]);
          seen.add(child);
        }
      }
    }
  }

  for (const token of Object.keys(byToken)) {
    if (!seen.has(token)) {
      result.push(...byToken[token]);
      seen.add(token);
    }
  }

  return result;
}

export type UseRawGridStateArgs = {
  initialText: string;
  initialCategory: RprCategory;
  mode: 'all' | 'selection';
};

/**
 * Owns the raw rows + parsing/grouping/category state.
 *
 * NOTE: `refreshFromCategory` takes the *source text* as an argument so this hook
 * doesn't need to know where the text came from (editor export vs paste vs file).
 */
export function useRawGridState({ initialText, initialCategory, mode }: UseRawGridStateArgs) {
  const [rawMode] = useState<'all' | 'selection'>(mode);
  const [rawCategory, setRawCategory] = useState<RprCategory>(initialCategory);

  const [rows, setRows] = useState<string[][]>(() => {
    const cleaned = stripRprPreviewPrefixes(initialText);
    return initialText.trim() ? parseLines(cleaned) : [];
  });

  const importFromText = useCallback((text: string) => {
    const cleaned = stripRprPreviewPrefixes(text);
    setRows(parseLines(cleaned));
  }, []);

  const refreshFromCategory = useCallback(
    (cat: RprCategory, sourceText: string) => {
      setRawCategory(cat);
      importFromText(sourceText);
    },
    [importFromText],
  );

  const rawText = useMemo(() => rowsToText(rows), [rows]);

  return {
    rawMode,
    rows,
    setRows,
    rawCategory,
    setRawCategory,
    rawText,
    refreshFromCategory,
    importFromText,
    groupRowsByTable,
    parseLines,
    rowsToText,
  };
}
