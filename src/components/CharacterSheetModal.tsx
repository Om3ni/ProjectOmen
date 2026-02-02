import { useEffect, useMemo, useRef, useState } from 'react';

import type { SchemaData } from '@/models/schema';

type Row = Record<string, unknown>;

type WithAlloc = Row & { Allocation: number };
type StatWithValue = Row & { __value: number };

type Props = {
  data: SchemaData;
  onClose: () => void;
  isChildWindow?: boolean;
};

function tf(v: unknown): boolean {
  return String(v).toLowerCase() === 't' || v === true;
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseAttrList(value: unknown): Array<{ id: number; mult: number }> {
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

function computeStatValue(
  stat: Row,
  attrMap: Map<number, Row>,
  perkBonuses: Map<number, number>,
  statPerkBonuses: Map<number, number>,
) {
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

  const statId = Number(stat.ID ?? stat['Node ID']);
  const perkStatBonus = Number.isFinite(statId) ? (statPerkBonuses.get(statId) || 0) : 0;

  return (base + bonus + contrib + perkStatBonus) * (scale || 1);
}

function idOf(row: Row): number {
  return Number(row['Node ID'] ?? row.ID);
}

export default function CharacterSheetModal({ data, onClose, isChildWindow = false }: Props) {
  const [admin, setAdmin] = useState(false);

  // Track allocations by SkillDef (attributes + skills)
  const [allocations, setAllocations] = useState<Map<number, number>>(() => new Map());

  const skillRows = useMemo(() => (Array.isArray(data.SkillDef) ? (data.SkillDef as Row[]) : []), [data]);
  const statRows = useMemo(() => (Array.isArray(data.Stat) ? (data.Stat as Row[]) : []), [data]);
  const perkRows = useMemo(() => (Array.isArray(data.PerkDef) ? (data.PerkDef as Row[]) : []), [data]);
  const perkActs = useMemo(() => (Array.isArray(data.PerkAction) ? (data.PerkAction as Row[]) : []), [data]);

  const attributes = useMemo(
    () => skillRows.filter((r) => String(r.TypeFlag ?? 'f').toLowerCase() === 't'),
    [skillRows],
  );
  const skills = useMemo(
    () => skillRows.filter((r) => String(r.TypeFlag ?? 'f').toLowerCase() === 'f'),
    [skillRows],
  );

  const actsByPerk = useMemo(() => {
    const map = new Map<number, Row[]>();
    for (const act of perkActs) {
      const pid = Number(act.PerkID);
      if (!Number.isFinite(pid)) continue;
      const arr = map.get(pid) ?? [];
      arr.push(act);
      map.set(pid, arr);
    }
    return map;
  }, [perkActs]);

  const [chosen, setChosen] = useState<number[]>([]);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);

  const derivedPerkLists = useMemo(() => {
    const baseAvail = perkRows.filter((p) => tf(p.Public));
    const byId = new Map<number, Row>(perkRows.map((p) => [Number(p.ID), p]));

    const allowIDs = new Set<number>();
    const denyIDs = new Set<number>();
    const allowCats = new Set<string>();
    const denyCats = new Set<string>();
    const allowSkillIDs = new Set<number>();
    const denySkillIDs = new Set<number>();

    for (const pid of chosen) {
      const actions = actsByPerk.get(pid) ?? [];
      for (const a of actions) {
        const fn = Number(a.Function);
        if (fn === 2) {
          const id = Number(a.TargetID);
          if (Number.isFinite(id)) allowIDs.add(id);
        } else if (fn === 3) {
          const id = Number(a.TargetID);
          if (Number.isFinite(id)) denyIDs.add(id);
        } else if (fn === 13) {
          const cat = String(a.Modifier ?? '').trim();
          if (cat) allowCats.add(cat);
        } else if (fn === 14) {
          const cat = String(a.Modifier ?? '').trim();
          if (cat) denyCats.add(cat);
        } else if (fn === 0) {
          const id = Number(a.TargetID);
          if (Number.isFinite(id)) allowSkillIDs.add(id);
        } else if (fn === 1) {
          const id = Number(a.TargetID);
          if (Number.isFinite(id)) denySkillIDs.add(id);
        }
      }
    }

    const availSet = new Set<number>(baseAvail.map((p) => Number(p.ID)));
    for (const id of allowIDs) {
      if (byId.has(id)) availSet.add(id);
    }
    if (allowCats.size) {
      for (const p of perkRows) {
        if (allowCats.has(String(p.Category ?? ''))) availSet.add(Number(p.ID));
      }
    }

    const available = Array.from(availSet)
      .filter((id) => {
        const p = byId.get(id);
        if (!p) return false;
        if (denyIDs.has(id) && !chosenSet.has(id)) return false;
        if (denyCats.has(String(p.Category ?? '')) && !chosenSet.has(id)) return false;
        return true;
      })
      .map((id) => byId.get(id)!)
      .sort((a, b) => String(a.Name ?? '').localeCompare(String(b.Name ?? '')));

    const denyCatActive = (p: Row) => denyCats.has(String(p.Category ?? ''));

    return {
      available,
      denyCatActive,
      allowSkillIDs,
      denySkillIDs,
    };
  }, [perkRows, actsByPerk, chosen, chosenSet]);

  const statPerkBonuses = useMemo(() => {
    const bonuses = new Map<number, number>();
    for (const pid of chosen) {
      const actions = actsByPerk.get(pid) ?? [];
      for (const act of actions) {
        const fn = Number(act.Function);
        if (fn !== 7) continue; // Stat Modifier

        const statId = Number(act.TargetID);
        if (!Number.isFinite(statId)) continue;

        const candidates = [act.Value, act.TargetType, act.Modifier];
        let amount = 0;
        for (const candidate of candidates) {
          if (candidate === undefined || candidate === null) continue;
          if (typeof candidate === 'string' && candidate.trim() === '') continue;
          const n = Number(candidate);
          if (Number.isFinite(n)) {
            amount = n;
            break;
          }
        }

        bonuses.set(statId, (bonuses.get(statId) ?? 0) + amount);
      }
    }
    return bonuses;
  }, [chosen, actsByPerk]);

  const perkBonuses = useMemo(() => {
    const bonuses = new Map<number, number>();

    for (const pid of chosen) {
      const perk = perkRows.find((x) => Number(x.ID) === pid);
      if (!perk) continue;

      const desc = String(perk.Description ?? '');

      // Parse attribute bonuses: • +X Attribute
      const attrMatches = desc.matchAll(/• \+([0-9]+) ([A-Za-z ]+)/g);
      for (const m of attrMatches) {
        const bonus = Number(m[1]);
        const attrName = m[2].trim();
        const attr = attributes.find((a) => String(a.Name).toLowerCase() === attrName.toLowerCase());
        if (!attr) continue;
        const id = idOf(attr);
        if (!Number.isFinite(id)) continue;
        bonuses.set(id, (bonuses.get(id) ?? 0) + bonus);
      }

      // Parse skill bonuses: • Skill: X
      const skillMatches = desc.matchAll(/• ([A-Za-z ]+): ([0-9]+)/g);
      for (const m of skillMatches) {
        const skillName = m[1].trim();
        const bonus = Number(m[2]);
        const sk = skills.find((s) => String(s.Name).toLowerCase() === skillName.toLowerCase());
        if (!sk) continue;
        const id = idOf(sk);
        if (!Number.isFinite(id)) continue;
        bonuses.set(id, (bonuses.get(id) ?? 0) + bonus);
      }
    }

    return bonuses;
  }, [chosen, perkRows, attributes, skills]);

  const updateAllocation = (skillId: number, value: number) => {
    setAllocations((prev) => {
      const next = new Map(prev);
      next.set(skillId, value);
      return next;
    });
  };

  const attributesWithAlloc = useMemo<WithAlloc[]>(() => {
    return attributes.map((a) => {
      const id = idOf(a);
      return { ...a, Allocation: allocations.get(id) || 0 } as WithAlloc;
    });
  }, [attributes, allocations]);

  const attrMapWithAlloc = useMemo(() => {
    const m = new Map<number, WithAlloc>();
    for (const a of attributesWithAlloc) {
      const id = idOf(a);
      if (Number.isFinite(id)) m.set(id, a);
    }
    return m;
  }, [attributesWithAlloc]);

  const publicStatsWithAlloc = useMemo<StatWithValue[]>(() => {
    const raw = admin ? statRows : statRows.filter((s) => tf(s.Public));
    return raw
      .map(
        (s) =>
          ({
            ...s,
            __value: computeStatValue(s, attrMapWithAlloc, perkBonuses, statPerkBonuses),
          }) as StatWithValue,
      )
      .sort((a, b) => String(a.Name ?? '').localeCompare(String(b.Name ?? '')));
  }, [statRows, admin, attrMapWithAlloc, perkBonuses, statPerkBonuses]);

  function skillRefsAttr(skill: Row, attrId: number): boolean {
    const src = String(skill['Bonus Source'] ?? '');
    return src
      .split(/\s*;\s*/)
      .some((tok) => Number(tok.split('*')[0]) === attrId);
  }

  const visibleSkills = useMemo(() => {
    const out: Row[] = [];
    for (const sk of skills) {
      const id = idOf(sk);
      const isAllowed = derivedPerkLists.allowSkillIDs.has(id);
      const isDenied = derivedPerkLists.denySkillIDs.has(id);
      const basePublic = tf(sk.Public);
      if (isDenied && !isAllowed && !admin) continue;
      if (basePublic || admin || isAllowed) out.push(sk);
    }
    return out;
  }, [skills, derivedPerkLists.allowSkillIDs, derivedPerkLists.denySkillIDs, admin]);

  const grouped = useMemo(() => {
    return attributesWithAlloc
      .map((a) => {
        const attrId = idOf(a);
        const kids = visibleSkills.filter((s) => skillRefsAttr(s, attrId));
        const attrVisible = tf(a.Public) || admin || kids.length > 0;
        if (!attrVisible) return null;
        return { attr: a, skills: kids };
      })
      .filter(Boolean) as Array<{ attr: Row; skills: Row[] }>;
  }, [attributesWithAlloc, visibleSkills, admin]);

  const addPerk = (id: number) => {
    if (!chosenSet.has(id)) setChosen((prev) => [...prev, id]);
  };
  const removePerk = (id: number) => setChosen((prev) => prev.filter((x) => x !== id));

  // Basic modal UX: close on Escape.
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const perksListClass = isChildWindow
    ? 'space-y-2 pr-1'
    : 'space-y-2 max-h-[70vh] overflow-y-auto pr-1';

  const attrSkillsListClass = isChildWindow
    ? 'space-y-2 pr-1'
    : 'space-y-2 max-h-[60vh] overflow-y-auto pr-1';

  const inner = (
    <div
      className={
        isChildWindow
          ? 'w-full rounded-lg border border-slate-800 bg-slate-950 p-4'
          : 'w-full max-w-7xl rounded-lg border border-slate-800 bg-slate-950 p-4'
      }
      onClick={(e) => {
        if (!isChildWindow) e.stopPropagation();
      }}
    >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Character Sheet</div>
            <div className="text-xs text-slate-400">Perks · Stats · Attributes/Skills · Allocations</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                checked={admin}
                onChange={(e) => setAdmin(e.target.checked)}
              />
              <span>Admin mode</span>
            </label>
            <button
              type="button"
              className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-6">
          {/* Perks Sidebar */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-3 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Perks</h2>
              <span className="text-xs text-slate-400">{chosen.length} chosen</span>
            </div>

            <div className={perksListClass}>
              <div className="text-xs uppercase tracking-wide text-slate-400">Available</div>
              {derivedPerkLists.available.map((p) => {
                const id = Number(p.ID);
                const disabled = chosenSet.has(id) || derivedPerkLists.denyCatActive(p);
                return (
                  <div
                    key={String(p.ID)}
                    className="p-2 rounded bg-slate-800 border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{String(p.Name ?? `Perk ${p.ID}`)}</div>
                      <div className="text-xs text-slate-400">{String(p.Category ?? '')}</div>
                    </div>
                    <button
                      type="button"
                      className={
                        disabled
                          ? 'px-2 py-1 text-xs rounded bg-slate-700 text-slate-300 cursor-not-allowed'
                          : 'px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500'
                      }
                      onClick={() => addPerk(id)}
                      disabled={disabled}
                    >
                      {chosenSet.has(id) ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}

              <div className="text-xs uppercase tracking-wide text-slate-400 pt-2">Chosen</div>
              {chosen
                .map((id) => {
                  const p = perkRows.find((x) => Number(x.ID) === id);
                  if (!p) return null;
                  return (
                    <div
                      key={id}
                      className="p-2 rounded bg-slate-900 border border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-sm">{String(p.Name ?? `Perk ${id}`)}</div>
                        <div className="text-xs text-slate-500">{String(p.Category ?? '')}</div>
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500"
                        onClick={() => removePerk(id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
                .filter(Boolean)}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4 space-y-4">
            {/* Stats */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-3">
              <div className="font-semibold mb-2">Stats</div>
              <div className="grid grid-cols-1 gap-2">
                {publicStatsWithAlloc.map((s) => {
                  const isPrivate = !tf(s.Public);
                  const value = Number(s.__value);
                  const display = Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
                  return (
                    <div
                      key={String(s.ID ?? s.Name)}
                      className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-3 py-2"
                    >
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span>{String(s.Name ?? `Stat ${s.ID}`)}</span>
                          {isPrivate ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">private</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-slate-200 font-semibold">{display}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Attributes & Skills */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-3">
              <div className="font-semibold mb-2">Attributes &amp; Skills</div>
              <div className={attrSkillsListClass}>
                {grouped.map((g) => {
                  const attrId = idOf(g.attr);
                  const naturalBonus = num(g.attr['Natural Bonus'], 0);
                  const allocation = allocations.get(attrId) || 0;
                  const perkBonus = perkBonuses.get(attrId) || 0;
                  const total = naturalBonus + allocation + perkBonus;
                  const attrPrivate = !tf(g.attr.Public);

                  return (
                    <div key={String(attrId ?? g.attr.Name)} className="border border-slate-700 rounded">
                      <div className="px-3 py-2 bg-slate-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-2xl">{String(g.attr.Name ?? `Attribute ${attrId}`)}</div>
                          {attrPrivate ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">private</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">Base: {naturalBonus}</span>
                          <input
                            type="number"
                            className="w-16 px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-white"
                            value={allocation}
                            onChange={(e) => updateAllocation(attrId, Number(e.target.value) || 0)}
                            placeholder="Alloc"
                          />
                          <span className="text-sm text-emerald-400">{perkBonus > 0 ? `+${perkBonus}` : ''}</span>
                          <span className="text-lg font-semibold text-white">= {total}</span>
                        </div>
                      </div>

                      <ul className="divide-y divide-slate-800">
                        {g.skills.map((sk) => {
                          const skId = idOf(sk);
                          const skAlloc = allocations.get(skId) || 0;
                          const skPerkBonus = perkBonuses.get(skId) || 0;
                          const skTotal = skAlloc + skPerkBonus;
                          const skPrivate = !tf(sk.Public);

                          return (
                            <li
                              key={String(skId ?? sk.Name)}
                              className="flex items-center justify-between px-3 py-1.5"
                            >
                              <span className="text-sm">{String(sk.Name ?? `Skill ${skId}`)}</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  className="w-12 px-1 py-0.5 text-xs bg-slate-800 border border-slate-600 rounded text-white"
                                  value={skAlloc}
                                  onChange={(e) => updateAllocation(skId, Number(e.target.value) || 0)}
                                  placeholder="0"
                                />
                                <span className="text-xs text-emerald-400">
                                  {skPerkBonus > 0 ? `+${skPerkBonus}` : ''}
                                </span>
                                <span className="text-sm font-semibold">{skTotal > 0 ? `= ${skTotal}` : ''}</span>
                                {skPrivate ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">
                                    private
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
    </div>
  );

  if (isChildWindow) {
    return (
      <div className="h-full w-full overflow-auto bg-slate-950 p-4">
        {inner}
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      {inner}
    </div>
  );
}
