/**
 * Shared hook for building target dropdown option lists from SchemaData.
 * Used by SpellEffectEditor, PerkEffectEditor, and RuneEffectEditor.
 */

import { useMemo } from 'react';
import type { SchemaData } from '@/models/schema';

export type Opt = { value: string; label: string };

type Row = Record<string, unknown>;

function safeArray(data: SchemaData, table: string): Row[] {
  const arr = (data as Record<string, unknown>)[table];
  return Array.isArray(arr) ? (arr as Row[]) : [];
}

type LabelFormat = 'name-only' | 'id-name';

function buildOpts(
  rows: Row[],
  idField: string,
  format: LabelFormat,
): Opt[] {
  const mapped = rows.map((r) => {
    const id = String(r[idField] ?? '');
    const name = String(r.Name ?? '(unnamed)');
    return {
      value: id,
      label: format === 'id-name' ? `${id} – ${name}` : name,
    };
  });
  return format === 'id-name'
    ? mapped.sort((a, b) => Number(a.value) - Number(b.value))
    : mapped.sort((a, b) => a.label.localeCompare(b.label));
}

type Options = {
  /** Include skills filtered by TypeFlag='f' (default: false) */
  filteredSkills?: boolean;
  /** Include perk categories extracted from PerkDef.Category (default: false) */
  perkCategories?: boolean;
  /** Label format: 'name-only' (alphabetical) or 'id-name' (numeric sort) */
  labelFormat?: LabelFormat;
};

export function useEffectTargetLookups(allData: SchemaData, options: Options = {}) {
  const { filteredSkills = false, perkCategories = false, labelFormat = 'name-only' } = options;

  const skills = useMemo(() => {
    const rows = safeArray(allData, 'SkillDef');
    const filtered = filteredSkills
      ? rows.filter((r) => String(r.TypeFlag ?? '').toLowerCase() === 'f')
      : rows;
    return buildOpts(filtered, 'Node ID', labelFormat);
  }, [allData, filteredSkills, labelFormat]);

  const skillsAndAttrs = useMemo(() => {
    return buildOpts(safeArray(allData, 'SkillDef'), 'Node ID', labelFormat);
  }, [allData, labelFormat]);

  const perks = useMemo(() => {
    return buildOpts(safeArray(allData, 'PerkDef'), 'ID', labelFormat);
  }, [allData, labelFormat]);

  const stats = useMemo(() => {
    return buildOpts(safeArray(allData, 'Stat'), 'ID', labelFormat);
  }, [allData, labelFormat]);

  const abilities = useMemo(() => {
    return buildOpts(safeArray(allData, 'SpellDef'), 'ID', labelFormat);
  }, [allData, labelFormat]);

  const statuses = useMemo(() => {
    return buildOpts(safeArray(allData, 'StatusDef'), 'ID', labelFormat);
  }, [allData, labelFormat]);

  const perkCats = useMemo(() => {
    if (!perkCategories) return [];
    const arr = safeArray(allData, 'PerkDef');
    const cats = new Set<string>();
    arr.forEach((r) => {
      const c = String(r.Category ?? '').trim();
      if (c) cats.add(c);
    });
    return Array.from(cats).sort().map((c) => ({ value: c, label: c }));
  }, [allData, perkCategories]);

  const getTargetOptions = (
    targetSource: string | null,
  ): Opt[] => {
    switch (targetSource) {
      case 'skill': return skills;
      case 'skillAttr': return skillsAndAttrs;
      case 'perk': return perks;
      case 'stat': return stats;
      case 'ability': return abilities;
      case 'status': return statuses;
      case 'category': return perkCats;
      case 'item': return []; // Manual entry
      default: return [];
    }
  };

  return {
    skills,
    skillsAndAttrs,
    perks,
    stats,
    abilities,
    statuses,
    perkCategories: perkCats,
    getTargetOptions,
  };
}
