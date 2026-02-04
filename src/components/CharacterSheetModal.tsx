import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SchemaData } from '@/models/schema';
import { ChatPanel } from '@/components/chat';
import { useChatState } from '@/hooks/useChatState';

type Row = Record<string, unknown>;

type WithAlloc = Row & { Allocation: number };
type StatWithValue = Row & { __value: number };

type RollModifier = 'none' | 'advantage' | 'disadvantage';

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

// Dice rolling utility
function rollDice(numDice: number, sides: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

export default function CharacterSheetModal({ data, onClose, isChildWindow = false }: Props) {
  const [admin, setAdmin] = useState(false);
  const [characterName, setCharacterName] = useState('Player');

  // Track allocations by SkillDef (attributes + skills)
  const [allocations, setAllocations] = useState<Map<number, number>>(() => new Map());

  // Read dice configuration from data (MUST be defined before using)
  const diceConfig = useMemo(() => {
    const rows = Array.isArray(data.DiceConfig) ? (data.DiceConfig as Row[]) : [];
    return rows[0] ?? {};
  }, [data]);

  const diceRules = useMemo(() => {
    const rows = Array.isArray(data.DiceRules) ? (data.DiceRules as Row[]) : [];
    return rows[0] ?? {};
  }, [data]);

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

  // Point buy cost calculation
  const calculatePointBuyCost = useCallback((fromValue: number, toValue: number): number => {
    let cost = 0;
    for (let i = fromValue; i < toValue; i++) {
      // 0→1=1, 1→2=1, 2→3=2, 3→4=3, ...
      cost += Math.max(1, i);
    }
    return cost;
  }, []);

  // Allocation limits from DiceConfig
  const attributePointsAvailable = useMemo(() => num(diceConfig.AttributePoints, 0), [diceConfig]);
  const skillPointsAvailable = useMemo(() => num(diceConfig.SkillPoints, 0), [diceConfig]);
  const minAttrAlloc = useMemo(() => num(diceConfig.MinAttributeAllocation, 0), [diceConfig]);
  const maxAttrAlloc = useMemo(() => num(diceConfig.MaxAttributeAllocation, 10), [diceConfig]);
  const minSkillAlloc = useMemo(() => num(diceConfig.MinSkillAllocation, 0), [diceConfig]);
  const maxSkillAlloc = useMemo(() => num(diceConfig.MaxSkillAllocation, 10), [diceConfig]);
  const attrPointBuy = useMemo(() => tf(diceConfig.AttributePointBuy), [diceConfig]);
  const skillPointBuy = useMemo(() => tf(diceConfig.SkillPointBuy), [diceConfig]);
  const perkPointsAvailable = useMemo(() => num(diceConfig.PerkPoints, 0), [diceConfig]);

  // Calculate spent points
  const { attrPointsSpent, skillPointsSpent } = useMemo(() => {
    let attrSpent = 0;
    let skillSpent = 0;

    for (const attr of attributes) {
      const id = idOf(attr);
      const alloc = allocations.get(id) || 0;
      if (attrPointBuy) {
        attrSpent += calculatePointBuyCost(minAttrAlloc, alloc);
      } else {
        attrSpent += alloc - minAttrAlloc;
      }
    }

    for (const skill of skills) {
      const id = idOf(skill);
      const alloc = allocations.get(id) || 0;
      if (skillPointBuy) {
        skillSpent += calculatePointBuyCost(minSkillAlloc, alloc);
      } else {
        skillSpent += alloc - minSkillAlloc;
      }
    }

    return { attrPointsSpent: attrSpent, skillPointsSpent: skillSpent };
  }, [allocations, attributes, skills, attrPointBuy, skillPointBuy, minAttrAlloc, minSkillAlloc, calculatePointBuyCost]);

  // Dice rolling state - use chat for displaying results
  const { addMessage } = useChatState();
  const [expandedRollId, setExpandedRollId] = useState<number | null>(null);
  const [rollInputs, setRollInputs] = useState<Map<number, { modifier: number; comment: string; rollMod: RollModifier }>>(() => new Map());

  // Derived dice settings
  const diceEnabled = useMemo(() => {
    const val = diceConfig.EnableDiceCheck;
    return String(val ?? 't').toLowerCase() === 't' || val === true;
  }, [diceConfig]);

  const numDice = useMemo(() => num(diceRules['Number of Dice'], 1), [diceRules]);
  const diceSides = useMemo(() => num(diceRules['Sides of Dice'], 20), [diceRules]);
  const critSuccessThreshold = useMemo(() => num(diceRules['Critical Success Threshold'], 20), [diceRules]);
  const critFailThreshold = useMemo(() => num(diceRules['Critical Failure Threshold'], 1), [diceRules]);
  const enable5eAdvantage = useMemo(() => {
    const val = diceRules['Enable D8D 5e Advantage Modifiers'];
    return String(val ?? 'f').toLowerCase() === 't' || val === true;
  }, [diceRules]);

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

  // Calculate perk points spent
  const perkPointsSpent = useMemo(() => {
    return chosen.reduce((sum, pid) => {
      const perk = perkRows.find(p => Number(p.ID) === pid);
      return sum + num(perk?.Cost, 0);
    }, 0);
  }, [chosen, perkRows]);

  // Initialize allocations to minimum values
  useEffect(() => {
    setAllocations((prev) => {
      const next = new Map(prev);
      let changed = false;
      
      // Set attributes to min
      for (const attr of attributes) {
        const id = idOf(attr);
        if (!next.has(id)) {
          next.set(id, minAttrAlloc);
          changed = true;
        }
      }
      
      // Set skills to min
      for (const skill of skills) {
        const id = idOf(skill);
        if (!next.has(id)) {
          next.set(id, minSkillAlloc);
          changed = true;
        }
      }
      
      return changed ? next : prev;
    });
  }, [attributes, skills, minAttrAlloc, minSkillAlloc]);

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

        // Data format: PerkAction|PerkID|Function|Value|TargetID|...
        // So TargetType field (column 3) actually contains the Value
        const amount = Number(act.TargetType);
        const statId = Number(act.TargetID);
        
        if (!Number.isFinite(statId) || !Number.isFinite(amount)) continue;

        bonuses.set(statId, (bonuses.get(statId) ?? 0) + amount);
      }
    }
    return bonuses;
  }, [chosen, actsByPerk]);

  // Track stats granted or revealed by perks (function 6 = Grant Stat, function 7 = Stat Modifier)
  const grantedStatIDs = useMemo(() => {
    const ids = new Set<number>();
    for (const pid of chosen) {
      const actions = actsByPerk.get(pid) ?? [];
      for (const act of actions) {
        const fn = Number(act.Function);
        // 6 = Grant Stat, 7 = Stat Modifier - both reveal the stat
        if (fn === 6 || fn === 7) {
          const statId = Number(act.TargetID);
          if (Number.isFinite(statId)) ids.add(statId);
        }
      }
    }
    return ids;
  }, [chosen, actsByPerk]);

  const perkBonuses = useMemo(() => {
    const bonuses = new Map<number, number>();

    for (const pid of chosen) {
      // Process PerkAction entries (Function 4 = Dice Modifier for attributes/skills)
      const actions = actsByPerk.get(pid) ?? [];
      for (const act of actions) {
        const fn = Number(act.Function);
        if (fn === 4) { // Dice Modifier
          // Data format: PerkAction|PerkID|Function|Value|TargetID|...
          // So TargetType field (column 3) actually contains the Value
          const amount = Number(act.TargetType);
          const targetId = Number(act.TargetID);
          
          if (!Number.isFinite(targetId) || !Number.isFinite(amount)) continue;

          bonuses.set(targetId, (bonuses.get(targetId) ?? 0) + amount);
        }
      }

      // Also parse description text for legacy perks
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
  }, [chosen, perkRows, attributes, skills, actsByPerk]);

  const updateAllocation = (skillId: number, value: number, isAttribute: boolean) => {
    const skill = skillRows.find(r => idOf(r) === skillId);
    if (!skill) return;

    // Check individual max allocation (can be overridden per skill)
    const skillMaxAlloc = num(skill['Max Allocation'], -1);
    const effectiveMax = skillMaxAlloc === -1 
      ? (isAttribute ? maxAttrAlloc : maxSkillAlloc)
      : skillMaxAlloc;
    const effectiveMin = isAttribute ? minAttrAlloc : minSkillAlloc;

    // Clamp to min/max
    const clamped = Math.max(effectiveMin, Math.min(effectiveMax, Math.floor(value)));

    setAllocations((prev) => {
      const oldValue = prev.get(skillId) || effectiveMin;
      if (oldValue === clamped) return prev;

      // Calculate point cost difference
      const pointBuyEnabled = isAttribute ? attrPointBuy : skillPointBuy;
      const currentPoints = isAttribute ? attrPointsSpent : skillPointsSpent;
      const availablePoints = isAttribute ? attributePointsAvailable : skillPointsAvailable;

      let costChange: number;
      if (pointBuyEnabled) {
        const oldCost = calculatePointBuyCost(effectiveMin, oldValue);
        const newCost = calculatePointBuyCost(effectiveMin, clamped);
        costChange = newCost - oldCost;
      } else {
        costChange = (clamped - effectiveMin) - (oldValue - effectiveMin);
      }

      // Check if we have enough points
      if (currentPoints + costChange > availablePoints) {
        return prev; // Can't afford
      }

      const next = new Map(prev);
      next.set(skillId, clamped);
      return next;
    });
  };

  // Get or initialize roll input for a skill/attribute
  const getRollInput = useCallback((id: number) => {
    return rollInputs.get(id) ?? { modifier: 0, comment: '', rollMod: 'none' as RollModifier };
  }, [rollInputs]);

  const updateRollInput = useCallback((id: number, updates: Partial<{ modifier: number; comment: string; rollMod: RollModifier }>) => {
    setRollInputs((prev) => {
      const next = new Map(prev);
      const current = prev.get(id) ?? { modifier: 0, comment: '', rollMod: 'none' as RollModifier };
      next.set(id, { ...current, ...updates });
      return next;
    });
  }, []);

  // Execute a dice roll
  const executeRoll = useCallback((skillName: string, skillId: number, baseModifier: number) => {
    const input = rollInputs.get(skillId) ?? { modifier: 0, comment: '', rollMod: 'none' as RollModifier };
    const totalModifier = baseModifier + input.modifier;
    
    let rolls: number[];
    let effectiveRoll: number;
    
    if (enable5eAdvantage && input.rollMod !== 'none') {
      // Roll twice for advantage/disadvantage
      const roll1 = rollDice(numDice, diceSides);
      const roll2 = rollDice(numDice, diceSides);
      const sum1 = roll1.reduce((a, b) => a + b, 0);
      const sum2 = roll2.reduce((a, b) => a + b, 0);
      
      if (input.rollMod === 'advantage') {
        effectiveRoll = Math.max(sum1, sum2);
        rolls = sum1 >= sum2 ? roll1 : roll2;
      } else {
        effectiveRoll = Math.min(sum1, sum2);
        rolls = sum1 <= sum2 ? roll1 : roll2;
      }
    } else {
      rolls = rollDice(numDice, diceSides);
      effectiveRoll = rolls.reduce((a, b) => a + b, 0);
    }
    
    const total = effectiveRoll + totalModifier;
    const isCritSuccess = effectiveRoll >= critSuccessThreshold;
    const isCritFail = effectiveRoll <= critFailThreshold;
    
    // Format roll result for chat
    const formula = `${numDice}d${diceSides}${totalModifier >= 0 ? '+' : ''}${totalModifier}`;
    let rollText = `${characterName} has rolled ${skillName} (${formula}) for a total of ${total}`;
    if (input.rollMod !== 'none') {
      rollText += ` [${input.rollMod === 'advantage' ? 'ADV' : 'DIS'}]`;
    }
    if (isCritSuccess) rollText += ' 🎯 CRIT!';
    if (isCritFail) rollText += ' 💀 FUMBLE!';
    if (input.comment) rollText += `\n"${input.comment}"`;
    
    addMessage({
      tab: 'local',
      sender: 'user',
      content: rollText,
      type: 'roll',
      metadata: {
        formula: `${numDice}d${diceSides}${totalModifier >= 0 ? '+' : ''}${totalModifier}`,
        rollResult: { 
          formula: `${numDice}d${diceSides}`,
          rolls, 
          modifier: totalModifier,
          total, 
          criticalHit: isCritSuccess, 
          criticalFail: isCritFail 
        },
      },
    });
    
    setExpandedRollId(null); // Close the roll input panel
  }, [rollInputs, enable5eAdvantage, numDice, diceSides, critSuccessThreshold, critFailThreshold, addMessage, characterName]);

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
    // Visibility rules:
    // - Display=t ("Secret") means internal only, never shown on character sheet
    // - Public stats are always shown
    // - Stats granted/modified by perks, abilities, or mutators are shown
    const raw = statRows.filter((s) => {
      const isSecret = tf(s.Display); // "Secret" field - internal stat, never shown
      if (isSecret) return false;
      
      const statId = Number(s.ID ?? s['Node ID']);
      const isPublic = tf(s.Public);
      const isGranted = grantedStatIDs.has(statId);
      
      // Show if: admin, OR public, OR granted by perk/ability
      return admin || isPublic || isGranted;
    });
    return raw.map(
      (s) =>
        ({
          ...s,
          __value: computeStatValue(s, attrMapWithAlloc, perkBonuses, statPerkBonuses),
        }) as StatWithValue,
    );
  }, [statRows, admin, attrMapWithAlloc, perkBonuses, statPerkBonuses, grantedStatIDs]);

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

  const overlayRef = useRef<HTMLDivElement | null>(null);

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
          ? 'w-full rounded-lg border theme-border theme-bg-base p-4'
          : 'w-full max-w-7xl max-h-[90vh] overflow-y-auto rounded-lg border theme-border theme-bg-base p-4'
      }
      onClick={(e) => {
        if (!isChildWindow) e.stopPropagation();
      }}
    >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold theme-text">Character Sheet</div>
            <div className="text-xs theme-text-muted">Perks · Stats · Attributes/Skills · Allocations</div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="px-3 py-2 rounded theme-bg-input border theme-border theme-text text-sm min-w-[150px]"
              placeholder="Character Name"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm theme-text-secondary">
              <input
                type="checkbox"
                className="h-4 w-4 rounded theme-border theme-bg-surface accent-[var(--accent-primary)]"
                checked={admin}
                onChange={(e) => setAdmin(e.target.checked)}
              />
              <span>Admin mode</span>
            </label>
            <button
              type="button"
              className="rounded-md border theme-border theme-bg-input px-3 py-2 text-sm theme-text-secondary hover:theme-bg-elevated"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-8">
          {/* Perks Sidebar */}
          <div className="rounded-lg border theme-border theme-bg-muted p-3 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold theme-text">Perks</h2>
              <span className="text-xs theme-text-muted">{chosen.length} chosen</span>
            </div>

            <div className={perksListClass}>
              {/* Available Points */}
              <div className="mb-3 p-2 rounded theme-bg-surface border theme-border">
                <div className="text-xs font-semibold theme-text mb-1">Available Points</div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between theme-text-secondary">
                    <span>Attributes:</span>
                    <span className="font-mono">{attributePointsAvailable - attrPointsSpent} / {attributePointsAvailable}</span>
                  </div>
                  <div className="flex justify-between theme-text-secondary">
                    <span>Skills:</span>
                    <span className="font-mono">{skillPointsAvailable - skillPointsSpent} / {skillPointsAvailable}</span>
                  </div>
                  <div className="flex justify-between theme-text-secondary">
                    <span>Perks:</span>
                    <span className="font-mono">{perkPointsAvailable - perkPointsSpent} / {perkPointsAvailable}</span>
                  </div>
                </div>
              </div>

              {derivedPerkLists.available.filter(p => !chosenSet.has(Number(p.ID))).length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-wide theme-text-muted mb-2">Available</div>
                  {derivedPerkLists.available.filter(p => !chosenSet.has(Number(p.ID))).map((p) => {
                    const id = Number(p.ID);
                    const cost = num(p.Cost, 0);
                    const disabled = derivedPerkLists.denyCatActive(p) || (cost > (perkPointsAvailable - perkPointsSpent));
                    const desc = String(p.Description ?? '');
                    
                    // Parse bonuses from description
                    const bonuses: string[] = [];
                    const attrMatches = desc.matchAll(/• \+([0-9]+) ([A-Za-z ]+)/g);
                    for (const m of attrMatches) {
                      bonuses.push(`${m[2]} +${m[1]}`);
                    }
                    const skillMatches = desc.matchAll(/• ([A-Za-z ]+): ([0-9]+)/g);
                    for (const m of skillMatches) {
                      bonuses.push(`${m[1]} +${m[2]}`);
                    }
                    
                    return (
                      <div
                        key={String(p.ID)}
                        className="p-2 rounded theme-bg-elevated border theme-border-muted mb-2"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <div className="font-medium text-sm theme-text">{String(p.Name ?? `Perk ${p.ID}`)}</div>
                            <div className="text-xs theme-text-muted">{String(p.Category ?? '')}</div>
                          </div>
                          <div className="text-xs font-semibold theme-text-secondary ml-2">Cost {cost}</div>
                        </div>
                        {bonuses.length > 0 && (
                          <div className="text-xs theme-text-secondary mb-2 space-y-0.5">
                            {bonuses.map((bonus, idx) => (
                              <div key={idx}>• {bonus}</div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className={
                            disabled
                              ? 'w-full px-2 py-1 text-xs rounded theme-bg-elevated theme-text-muted cursor-not-allowed'
                              : 'w-full px-2 py-1 text-xs rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]'
                          }
                          onClick={() => addPerk(id)}
                          disabled={disabled}
                        >
                          Add
                        </button>
                      </div>
                    );
                  })}
                </>
              )}

              {chosen.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-wide theme-text-muted pt-3 mb-2">Chosen</div>
                  {chosen
                    .map((id) => {
                      const p = perkRows.find((x) => Number(x.ID) === id);
                      if (!p) return null;
                      const cost = num(p.Cost, 0);
                      const desc = String(p.Description ?? '');
                      
                      // Parse bonuses from description
                      const bonuses: string[] = [];
                      const attrMatches = desc.matchAll(/• \+([0-9]+) ([A-Za-z ]+)/g);
                      for (const m of attrMatches) {
                        bonuses.push(`${m[2]} +${m[1]}`);
                      }
                      const skillMatches = desc.matchAll(/• ([A-Za-z ]+): ([0-9]+)/g);
                      for (const m of skillMatches) {
                        bonuses.push(`${m[1]} +${m[2]}`);
                      }
                      
                      return (
                        <div
                          key={id}
                          className="p-2 rounded theme-bg-surface border theme-border-muted mb-2"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <div className="font-medium text-sm theme-text">{String(p.Name ?? `Perk ${id}`)}</div>
                              <div className="text-xs theme-text-faint">{String(p.Category ?? '')}</div>
                            </div>
                            <div className="text-xs font-semibold theme-text-secondary ml-2">Cost {cost}</div>
                          </div>
                          {bonuses.length > 0 && (
                            <div className="text-xs theme-text-secondary mb-2 space-y-0.5">
                              {bonuses.map((bonus, idx) => (
                                <div key={idx}>• {bonus}</div>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            className="w-full px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white"
                            onClick={() => removePerk(id)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                </>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4 space-y-4">
            {/* Stats (collapsible) */}
            {publicStatsWithAlloc.length > 0 && (
              <details className="rounded-lg border theme-border theme-bg-muted" open>
                <summary className="font-semibold p-3 cursor-pointer hover:theme-bg-elevated transition-colors select-none theme-text">
                  Stats ({publicStatsWithAlloc.length})
                </summary>
                <div className="px-3 pb-3 grid grid-cols-1 gap-2">
                  {publicStatsWithAlloc.map((s) => {
                    const isPrivate = !tf(s.Public);
                    const canModify = tf(s.Trainable); // Trainable field = "Can Modify" label
                    const statId = Number(s.ID ?? s['Node ID']);
                    const value = Number(s.__value);
                    const statAlloc = allocations.get(statId) || 0;
                    const computedValue = value + statAlloc;
                    const display = Number.isFinite(computedValue) ? String(Math.round(computedValue * 100) / 100) : '0';
                    
                    return (
                      <div
                        key={String(s.ID ?? s.Name)}
                        className="flex items-center justify-between theme-bg-surface border theme-border-muted rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className="theme-text">{String(s.Name ?? `Stat ${s.ID}`)}</span>
                            {isPrivate && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full theme-bg-elevated theme-text-secondary">private</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canModify && (
                            <input
                              type="number"
                              className="w-16 px-2 py-1 text-sm theme-bg-elevated border theme-border-muted rounded theme-text"
                              value={statAlloc}
                              onChange={(e) => updateAllocation(statId, Number(e.target.value) || 0, false)}
                              placeholder="Mod"
                            />
                          )}
                          <div className="theme-text-secondary font-semibold">{display}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {/* Attributes & Skills */}
            <div className="rounded-lg border theme-border theme-bg-muted p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold theme-text">Attributes &amp; Skills</div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="theme-text-muted">Attr:</span>
                    <span className={attrPointsSpent > attributePointsAvailable ? 'text-red-400' : 'theme-text'}>
                      {attrPointsSpent}/{attributePointsAvailable}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="theme-text-muted">Skills:</span>
                    <span className={skillPointsSpent > skillPointsAvailable ? 'text-red-400' : 'theme-text'}>
                      {skillPointsSpent}/{skillPointsAvailable}
                    </span>
                  </div>
                  {diceEnabled && (
                    <div className="theme-text-muted">
                      {numDice}d{diceSides} {enable5eAdvantage ? '(5E)' : ''}
                    </div>
                  )}
                </div>
              </div>
              <div className={attrSkillsListClass}>
                {grouped.map((g) => {
                  const attrId = idOf(g.attr);
                  const naturalBonus = num(g.attr['Natural Bonus'], 0);
                  const allocation = allocations.get(attrId) || 0;
                  const perkBonus = perkBonuses.get(attrId) || 0;
                  const total = naturalBonus + allocation + perkBonus;
                  const attrPrivate = !tf(g.attr.Public);
                  const attrName = String(g.attr.Name ?? `Attribute ${attrId}`);
                  const attrRollInput = getRollInput(attrId);
                  const isAttrExpanded = expandedRollId === attrId;

                  return (
                    <div key={String(attrId ?? g.attr.Name)} className="border theme-border-muted rounded">
                      <div className="px-3 py-2 theme-bg-surface flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-2xl theme-text">{attrName}</div>
                          {attrPrivate ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full theme-bg-elevated theme-text-secondary">private</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm theme-text-muted">Base: {naturalBonus}</span>
                          <input
                            type="number"
                            className="w-16 px-2 py-1 text-sm theme-bg-elevated border theme-border-muted rounded theme-text"
                            value={allocation}
                            onChange={(e) => updateAllocation(attrId, Number(e.target.value) || 0, true)}
                            placeholder="Alloc"
                          />
                          <span className="text-sm text-[var(--accent-primary)]">{perkBonus > 0 ? `+${perkBonus}` : ''}</span>
                          <span className="text-lg font-semibold theme-text">= {total}</span>
                          {diceEnabled && (
                            <>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]"
                                onClick={() => executeRoll(attrName, attrId, total)}
                              >
                                Roll
                              </button>
                              <button
                                type="button"
                                className={`px-2 py-1 text-xs rounded ${isAttrExpanded ? 'theme-bg-surface' : 'theme-bg-elevated'} hover:theme-bg-surface theme-text`}
                                onClick={() => setExpandedRollId(isAttrExpanded ? null : attrId)}
                                title="Roll options"
                              >
                                ⚡
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Attribute roll options panel */}
                      {diceEnabled && isAttrExpanded && (
                        <div className="px-3 py-2 theme-bg-elevated border-t theme-border-muted flex items-center gap-3">
                          <input
                            type="number"
                            className="w-14 px-2 py-1 text-xs theme-bg-surface border theme-border-muted rounded theme-text"
                            value={attrRollInput.modifier}
                            onChange={(e) => updateRollInput(attrId, { modifier: Number(e.target.value) || 0 })}
                            placeholder="+0"
                          />
                          {enable5eAdvantage && (
                            <select
                              className="px-2 py-1 text-xs theme-bg-surface border theme-border-muted rounded theme-text"
                              value={attrRollInput.rollMod}
                              onChange={(e) => updateRollInput(attrId, { rollMod: e.target.value as RollModifier })}
                            >
                              <option value="none">None</option>
                              <option value="advantage">Advantage (+)</option>
                              <option value="disadvantage">Disadvantage (−)</option>
                            </select>
                          )}
                          <input
                            type="text"
                            className="flex-1 px-2 py-1 text-xs theme-bg-surface border theme-border-muted rounded theme-text"
                            value={attrRollInput.comment}
                            onChange={(e) => updateRollInput(attrId, { comment: e.target.value.slice(0, 50) })}
                            placeholder="Comment"
                            maxLength={50}
                          />
                          <span className="text-[10px] theme-text-faint">{attrRollInput.comment.length}/50</span>
                        </div>
                      )}

                      <ul className="divide-y theme-border">
                        {g.skills.map((sk) => {
                          const skId = idOf(sk);
                          const skAlloc = allocations.get(skId) || 0;
                          const skPerkBonus = perkBonuses.get(skId) || 0;
                          const skTotal = total + skAlloc + skPerkBonus;
                          const skPrivate = !tf(sk.Public);
                          const skName = String(sk.Name ?? `Skill ${skId}`);
                          const skRollInput = getRollInput(skId);
                          const isSkillExpanded = expandedRollId === skId;

                          return (
                            <li key={String(skId ?? sk.Name)} className="px-3 py-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm theme-text">{skName}</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="w-12 px-1 py-0.5 text-xs theme-bg-elevated border theme-border-muted rounded theme-text"
                                    value={skAlloc}
                                    onChange={(e) => updateAllocation(skId, Number(e.target.value) || 0, false)}
                                    placeholder="0"
                                  />
                                  {skPerkBonus > 0 && (
                                    <span className="text-xs text-[var(--accent-primary)]">+{skPerkBonus}</span>
                                  )}
                                  <span className="text-xs theme-text-muted">
                                    {skAlloc + skPerkBonus}+{total} =
                                  </span>
                                  <span className={`text-sm font-semibold ${ skTotal >= 0 ? 'text-[var(--accent-primary)]' : 'text-red-400'}`}>
                                    {skTotal >= 0 ? `+${skTotal}` : skTotal}
                                  </span>
                                  {skPrivate ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full theme-bg-elevated theme-text-secondary">
                                      private
                                    </span>
                                  ) : null}
                                  {diceEnabled && (
                                    <>
                                      <button
                                        type="button"
                                        className="px-2 py-1 text-xs rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]"
                                        onClick={() => executeRoll(skName, skId, skTotal)}
                                      >
                                        Roll
                                      </button>
                                      <button
                                        type="button"
                                        className={`px-2 py-1 text-xs rounded ${isSkillExpanded ? 'theme-bg-surface' : 'theme-bg-elevated'} hover:theme-bg-surface theme-text`}
                                        onClick={() => setExpandedRollId(isSkillExpanded ? null : skId)}
                                        title="Roll options"
                                      >
                                        ⚡
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Skill roll options panel */}
                              {diceEnabled && isSkillExpanded && (
                                <div className="mt-2 px-2 py-2 theme-bg-elevated rounded flex items-center gap-3">
                                  <input
                                    type="number"
                                    className="w-14 px-2 py-1 text-xs theme-bg-surface border theme-border-muted rounded theme-text"
                                    value={skRollInput.modifier}
                                    onChange={(e) => updateRollInput(skId, { modifier: Number(e.target.value) || 0 })}
                                    placeholder="+0"
                                  />
                                  {enable5eAdvantage && (
                                    <select
                                      className="px-2 py-1 text-xs theme-bg-surface border theme-border-muted rounded theme-text"
                                      value={skRollInput.rollMod}
                                      onChange={(e) => updateRollInput(skId, { rollMod: e.target.value as RollModifier })}
                                    >
                                      <option value="none">None</option>
                                      <option value="advantage">Advantage (+)</option>
                                      <option value="disadvantage">Disadvantage (−)</option>
                                    </select>
                                  )}
                                  <input
                                    type="text"
                                    className="flex-1 px-2 py-1 text-xs theme-bg-surface border theme-border-muted rounded theme-text"
                                    value={skRollInput.comment}
                                    onChange={(e) => updateRollInput(skId, { comment: e.target.value.slice(0, 50) })}
                                    placeholder="Comment"
                                    maxLength={50}
                                  />
                                  <span className="text-[10px] theme-text-faint">{skRollInput.comment.length}/50</span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Perks (collapsible) */}
            {chosen.length > 0 && (
              <details className="rounded-lg border theme-border theme-bg-muted" open>
                <summary className="font-semibold p-3 cursor-pointer hover:theme-bg-elevated transition-colors select-none theme-text">
                  Perks ({chosen.length})
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {chosen.map((pid) => {
                    const perk = perkRows.find((x) => Number(x.ID) === pid);
                    if (!perk) return null;

                    // Extract bonus effects from Description
                    const desc = String(perk.Description ?? '');
                    const effects: string[] = [];
                    
                    // Parse "• +X Attribute" style bonuses
                    const attrMatches = desc.matchAll(/• \+([0-9]+) ([A-Za-z ]+)/g);
                    for (const m of attrMatches) {
                      effects.push(`${m[2].trim()} +${m[1]}`);
                    }
                    
                    // Parse "• Skill: X" style bonuses
                    const skillMatches = desc.matchAll(/• ([A-Za-z ]+): ([0-9]+)/g);
                    for (const m of skillMatches) {
                      effects.push(`${m[1].trim()} +${m[2]}`);
                    }

                    // If no parsed effects, show raw description bullets
                    if (effects.length === 0) {
                      const bullets = desc.match(/• [^•]+/g);
                      if (bullets) {
                        for (const b of bullets) {
                          effects.push(b.replace(/^• /, '').trim());
                        }
                      }
                    }

                    return (
                      <div
                        key={pid}
                        className="theme-bg-surface border theme-border-muted rounded px-3 py-2"
                      >
                        <div className="font-medium text-sm theme-text">
                          {String(perk.Category ?? 'Perk')}: {String(perk.Name ?? `Perk ${pid}`)}
                        </div>
                        {effects.length > 0 && (
                          <div className="text-xs theme-text-muted mt-1">
                            {effects.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>

          {/* Chat Panel for rolls */}
          <div className="lg:col-span-2 rounded-lg border theme-border overflow-hidden h-[70vh]">
            <ChatPanel 
              className="h-full"
              schemaData={data as Record<string, unknown[]>}
            />
          </div>
        </div>
    </div>
  );

  if (isChildWindow) {
    return (
      <div className="h-full w-full overflow-auto theme-bg-base p-4">
        {inner}
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-auto p-4"
    >
      <div className="my-auto">
        {inner}
      </div>
    </div>
  );
}
