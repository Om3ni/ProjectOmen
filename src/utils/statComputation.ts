import { num } from '@/utils/rprHelpers';

type Row = Record<string, unknown>;

export function idOf(row: Row): number {
  const nodeIdRaw = row['Node ID'];
  const nodeId = typeof nodeIdRaw === 'string' && nodeIdRaw.trim() === '' ? NaN : Number(nodeIdRaw);
  if (Number.isFinite(nodeId) && nodeId !== 0) return nodeId;

  const idRaw = row.ID;
  const id = typeof idRaw === 'string' && idRaw.trim() === '' ? NaN : Number(idRaw);
  return id;
}

export function parseAttrList(value: unknown): Array<{ id: number; mult: number }> {
  const s = String(value ?? '').trim();
  if (!s) return [];
  return s
    .split(/\s*;\s*/)
    .map((it) => {
      const [id, mult = '1'] = it.split('*');
      return { id: Number(id), mult: Number(mult) };
    })
    .filter((x) => Number.isFinite(x.id) && Number.isFinite(x.mult));
}

/**
 * Compute the derived value for a stat from schema data.
 *
 * Per schema, Stat.Bonus is an additive term (e.g. Initiative has Bonus = -5).
 * Value = (Base + Bonus + attrContributions + perkStatBonuses) * Scale
 */
export function computeStatMax(
  stat: Row,
  attrMap: Map<number, Row>,
  perkBonuses: Map<number, number>,
  statPerkBonuses: Map<number, number>,
): number {
  const base = num(stat.Base, 0);
  const bonus = num(stat.Bonus, 0);
  const scale = num(stat.Scale, 1);
  const parts = parseAttrList(stat.Formula);

  let contrib = 0;
  for (const p of parts) {
    const attr = attrMap.get(p.id);
    if (!attr) continue;
    const naturalBonus = num(attr['Natural Bonus'], 0);
    const allocation = num(attr.Allocation, 0);
    const perkBonus = perkBonuses.get(p.id) || 0;
    const val = naturalBonus + allocation + perkBonus;
    contrib += val * p.mult;
  }

  const statId = idOf(stat);
  const perkStatBonus = Number.isFinite(statId) ? (statPerkBonuses.get(statId) || 0) : 0;

  return (base + bonus + contrib + perkStatBonus) * (scale || 1);
}

/** Dice rolling utility */
export function rollDice(numDice: number, sides: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}
