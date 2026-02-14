import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SchemaData } from '@/models/schema';
import { ChatPanel } from '@/components/chat';
import { PanelShell } from '@/components/panels';
import { useChatState } from '@/hooks/useChatState';
import { usePanelManager } from '@/hooks/usePanelManager';
import { AbilitiesTab } from '@/components/abilities';
import { evaluateActiveMutators } from '@/utils/mutatorEvaluator';
import StatusPanel from '@/components/StatusPanel';
import { AiCharactersTab } from '@/ollama/components/AiCharactersTab';
import { num, tf } from '@/utils/rprHelpers';
import { idOf, computeStatMax, rollDice } from '@/utils/statComputation';
import { useSchemaArrays } from '@/hooks/useSchemaArrays';

type CharacterSheetTab = 'character' | 'abilities' | 'ai-characters';

type Row = Record<string, unknown>;

type WithAlloc = Row & { Allocation: number };
type StatWithValue = Row & { __max: number; __min: number };

type RollModifier = 'none' | 'advantage' | 'disadvantage';

export type PersistedCharacterSheetStateV1 = {
  version: 1;
  admin: boolean;
  characterName: string;
  activeTab?: CharacterSheetTab;
  chosen: number[];
  allocations: Array<[number, number]>;
  rollInputs: Array<[number, { modifier: number; comment: string; rollMod: RollModifier }]>;
  zoom?: number;
};

type Props = {
  data: SchemaData;
  onClose: () => void;
  isChildWindow?: boolean;
  persistedState?: PersistedCharacterSheetStateV1 | null;
  onPersistedStateChange?: (next: PersistedCharacterSheetStateV1 | null) => void;
};
export default function CharacterSheetModal({
  data,
  onClose,
  isChildWindow = false,
  persistedState,
  onPersistedStateChange,
}: Props) {
  const [panelState, panelActions] = usePanelManager({ chat: { mode: 'docked' } });
  const chatPanel = panelState.chat;
  const [admin, setAdmin] = useState(() => persistedState?.admin ?? false);
  const [characterName, setCharacterName] = useState(() => persistedState?.characterName ?? 'Player');
  const [activeTab, setActiveTab] = useState<CharacterSheetTab>(() => persistedState?.activeTab ?? 'character');

  const [sheetZoom, setSheetZoom] = useState(() => {
    const z = persistedState?.zoom;
    return typeof z === 'number' && Number.isFinite(z) ? z : 1;
  });

  // Track allocations by SkillDef (attributes + skills)
  const [allocations, setAllocations] = useState<Map<number, number>>(() => new Map(persistedState?.allocations ?? []));

  // Extract schema arrays from data
  const {
    diceConfig, diceRules, skillRows, statRows, perkRows, perkActs,
    spellRows, spellReqRows, statusRows, mutatorActionRows, statusActionRows,
    mutatorDefRows, mutatorCondRows, attributes, skills,
  } = useSchemaArrays(data);

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
  // Note: if maxAlloc is 0 or missing, treat as unlimited (99) since 0 makes no sense
  const attributePointsAvailable = useMemo(() => num(diceConfig.AttributePoints, 0), [diceConfig]);
  const skillPointsAvailable = useMemo(() => num(diceConfig.SkillPoints, 0), [diceConfig]);
  const minAttrAlloc = useMemo(() => num(diceConfig.MinAttributeAllocation, 0), [diceConfig]);
  const maxAttrAlloc = useMemo(() => num(diceConfig.MaxAttributeAllocation, 10), [diceConfig]);
  const minSkillAlloc = useMemo(() => num(diceConfig.MinSkillAllocation, 0), [diceConfig]);
  const maxSkillAlloc = useMemo(() => num(diceConfig.MaxSkillAllocation, 10), [diceConfig]);
  const attrPointBuy = useMemo(() => tf(diceConfig.AttributePointBuy), [diceConfig]);
  const skillPointBuy = useMemo(() => tf(diceConfig.SkillPointBuy), [diceConfig]);
  const perkPointsAvailable = useMemo(() => num(diceConfig.PerkPoints, 0), [diceConfig]);

  // Initialize allocations to minimum values for any skill/attr not yet in the map
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
  const [rollInputs, setRollInputs] = useState<Map<number, { modifier: number; comment: string; rollMod: RollModifier }>>(
    () => new Map(persistedState?.rollInputs ?? []),
  );

  // Derived dice settings
  const diceEnabled = useMemo(() => {
    const val = diceConfig.EnableDiceCheck;
    return String(val ?? 't').toLowerCase() === 't' || val === true;
  }, [diceConfig]);

  const numDice = useMemo(() => num(diceRules['Number of Dice'], 1), [diceRules]);
  const diceSides = useMemo(() => num(diceRules['Sides of Dice'], 20), [diceRules]);
  const diceSystem = useMemo(() => num(diceRules['Dice System'], 0), [diceRules]);
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

  const [chosen, setChosen] = useState<number[]>(() => persistedState?.chosen ?? []);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);

  // Track manually toggled statuses (e.g. "In Combat")
  const [activeStatusIds, setActiveStatusIds] = useState<Set<number>>(new Set());

  // Track current stat values (separate from max). Key = stat ID, value = current value.
  // Undefined means "at max". Managed by combat effects and manual adjustment.
  const [statCurrentValues, setStatCurrentValues] = useState<Map<number, number>>(() => new Map());

  // Track which category each status was granted under (for Dispel Buff matching)
  const [statusCategoryMap, setStatusCategoryMap] = useState<Map<number, string>>(() => new Map());

  // Build set of active status categories from toggled statuses
  const activeStatusCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const sid of activeStatusIds) {
      // Use the category the status was granted under (from SpellEffect)
      const grantCat = statusCategoryMap.get(sid);
      if (grantCat) cats.add(grantCat);
      // Also use the status Name as a fallback category — RPR uses Name-based matching
      const status = statusRows.find((s) => idOf(s) === sid);
      if (status) {
        const name = String(status.Name ?? '').trim();
        if (name) cats.add(name);
      }
    }
    return cats;
  }, [activeStatusIds, statusRows, statusCategoryMap]);

  // Evaluate which mutators are active based on perks + statuses
  const activeMutatorIds = useMemo(() => {
    return evaluateActiveMutators(mutatorDefRows, mutatorCondRows, {
      chosenPerkIds: chosenSet,
      activeStatusIds,
      activeStatusCategories,
      skillAllocations: allocations,
      chosenPerks: perkRows.filter((p) => chosenSet.has(idOf(p))),
    });
  }, [mutatorDefRows, mutatorCondRows, chosenSet, activeStatusIds, activeStatusCategories, allocations, perkRows]);

  const perkPointsSpent = useMemo(() => {
    return chosen.reduce((sum, pid) => {
      const perk = perkRows.find((p) => idOf(p) === pid);
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

  // Prune persisted state when underlying data changes (e.g. load a different file).
  useEffect(() => {
    const validSkillIds = new Set<number>();
    for (const r of skillRows) {
      const id = idOf(r);
      if (Number.isFinite(id)) validSkillIds.add(id);
    }

    setAllocations((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const k of next.keys()) {
        if (!validSkillIds.has(k)) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const validPerkIds = new Set<number>(perkRows.map((p) => idOf(p)).filter((x) => Number.isFinite(x)));
    setChosen((prev) => {
      const filtered = prev.filter((id) => validPerkIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });

    setRollInputs((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const k of next.keys()) {
        if (!validSkillIds.has(k)) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [skillRows, perkRows]);

  // Persist sheet state upward so closing/reopening keeps the same state.
  useEffect(() => {
    if (!onPersistedStateChange) return;
    onPersistedStateChange({
      version: 1,
      admin,
      characterName,
      activeTab,
      chosen,
      allocations: Array.from(allocations.entries()),
      rollInputs: Array.from(rollInputs.entries()),
      zoom: sheetZoom,
    });
  }, [admin, characterName, activeTab, chosen, allocations, rollInputs, sheetZoom, onPersistedStateChange]);

  const derivedPerkLists = useMemo(() => {
    const baseAvail = perkRows.filter((p) => tf(p.Public));
    const byId = new Map<number, Row>(perkRows.map((p) => [idOf(p), p]));

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

    const availSet = new Set<number>(baseAvail.map((p) => idOf(p)));
    for (const id of allowIDs) {
      if (byId.has(id)) availSet.add(id);
    }
    if (allowCats.size) {
      for (const p of perkRows) {
        if (allowCats.has(String(p.Category ?? ''))) availSet.add(idOf(p));
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

      const computeSpent = (allocMap: Map<number, number>, rows: Row[], pointBuyEnabled: boolean, minAlloc: number) => {
        let spent = 0;
        for (const r of rows) {
          const id = idOf(r);
          const alloc = allocMap.get(id) ?? minAlloc;
          if (pointBuyEnabled) {
            spent += calculatePointBuyCost(minAlloc, alloc);
          } else {
            spent += alloc - minAlloc;
          }
        }
        return spent;
      };

      // Calculate point cost difference
      const pointBuyEnabled = isAttribute ? attrPointBuy : skillPointBuy;
      const currentPoints = isAttribute
        ? computeSpent(prev, attributes, attrPointBuy, minAttrAlloc)
        : computeSpent(prev, skills, skillPointBuy, minSkillAlloc);
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

  // Separate allocation handler for Stat modifications (no point budget, uses stat buff/debuff limits)
  const maxStatBuff = useMemo(() => num(diceConfig.MaxStatBuff, 99), [diceConfig]);
  const maxStatDebuff = useMemo(() => num(diceConfig.MaxStatDebuff, -99), [diceConfig]);
  void maxStatBuff; void maxStatDebuff;

  // Set the current value of a stat (clamped between its min and max)
  const setStatCurrentValue = (statId: number, value: number, statMax: number, statMin: number) => {
    const clamped = Math.max(statMin, Math.min(statMax, Math.round(value * 100) / 100));
    setStatCurrentValues((prev) => {
      const next = new Map(prev);
      next.set(statId, clamped);
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
    // Dice System 0 = Roll, 1 = Dice Pool
    if (diceSystem === 1) {
      // Dice Pool: number of dice is derived from the bonus (plus optional modifier input).
      // Uses existing schema fields:
      // - Critical Success Threshold => "+hit" threshold (>=)
      // - Critical Failure Threshold => "-hit" threshold (<=)
      const baseDiceCount = Math.max(0, Math.floor(baseModifier));
      const adjustedDiceCount = Math.max(0, baseDiceCount + Math.trunc(input.modifier));
      const rolls = rollDice(adjustedDiceCount, diceSides);

      let successes = 0;
      let failures = 0;
      for (const r of rolls) {
        if (r >= critSuccessThreshold) successes += 1;
        if (r <= critFailThreshold) failures += 1;
      }

      const hits = successes - failures;

      const formula = `${adjustedDiceCount}d${diceSides}`;
      let rollText = `${characterName} has rolled ${skillName}`;
      rollText += `\nResult: ${hits}=${successes}+(-${failures}) [Dice Pool ${formula}, >=${critSuccessThreshold}:+1, <=${critFailThreshold}:-1]`;
      if (input.comment) rollText += ` (${input.comment})`;

      addMessage({
        tab: 'local',
        sender: 'user',
        content: rollText,
        type: 'roll',
        metadata: {
          formula,
          rollResult: {
            formula,
            rolls,
            modifier: input.modifier,
            total: hits,
          },
        },
      });
      setExpandedRollId(null);
      return;
    }

    // Roll system
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
    let rollText = `${characterName} has rolled ${skillName}`;
    if (input.rollMod !== 'none') {
      rollText += ` [${input.rollMod === 'advantage' ? 'ADV' : 'DIS'}]`;
    }
    rollText += `\nResult: ${total}=${effectiveRoll}${totalModifier >= 0 ? '+' : ''}${totalModifier}`;
    if (input.comment) rollText += ` (${input.comment})`;
    if (isCritSuccess) rollText += ' [CRIT]';
    if (isCritFail) rollText += ' [FUMBLE]';

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
          criticalFail: isCritFail,
        },
      },
    });
    
    setExpandedRollId(null); // Close the roll input panel
  }, [rollInputs, diceSystem, enable5eAdvantage, numDice, diceSides, critSuccessThreshold, critFailThreshold, addMessage, characterName]);

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
      
      const statId = idOf(s);
      const isPublic = tf(s.Public);
      const isGranted = grantedStatIDs.has(statId);
      
      // Show if: admin, OR public, OR granted by perk/ability
      return admin || isPublic || isGranted;
    });
    return raw.map(
      (s) =>
        ({
          ...s,
          __max: computeStatMax(s, attrMapWithAlloc, perkBonuses, statPerkBonuses),
          // No explicit per-stat minimum exists in the Stat schema.
          // Keep UI clamping conservative at 0 for editable stats.
          __min: 0,
        }) as StatWithValue,
    );
  }, [statRows, admin, attrMapWithAlloc, perkBonuses, statPerkBonuses, grantedStatIDs]);

  // Map of all stat MAX values for ability requirement checking (includes non-visible stats)
  const allStatValues = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of statRows) {
      const statId = idOf(s);
      if (Number.isFinite(statId) && statId > 0) {
        // Use current value if tracked, otherwise max
        const max = computeStatMax(s, attrMapWithAlloc, perkBonuses, statPerkBonuses);
        const current = statCurrentValues.get(statId);
        map.set(statId, current !== undefined ? current : max);
      }
    }
    return map;
  }, [statRows, attrMapWithAlloc, perkBonuses, statPerkBonuses, statCurrentValues]);

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

  const formatSigned = useCallback((n: number) => (n >= 0 ? `+${n}` : String(n)), []);

  const skillById = useMemo(() => {
    const m = new Map<number, Row>();
    for (const r of skillRows) {
      const id = idOf(r);
      if (Number.isFinite(id)) m.set(id, r);
    }
    return m;
  }, [skillRows]);

  const statById = useMemo(() => {
    const m = new Map<number, Row>();
    for (const r of statRows) {
      const id = idOf(r);
      if (Number.isFinite(id)) m.set(id, r);
    }
    return m;
  }, [statRows]);

  const perkById = useMemo(() => new Map<number, Row>(perkRows.map((p) => [idOf(p), p])), [perkRows]);
  const spellById = useMemo(() => new Map<number, Row>(spellRows.map((s) => [idOf(s), s])), [spellRows]);
  const statusById = useMemo(() => new Map<number, Row>(statusRows.map((s) => [idOf(s), s])), [statusRows]);

  const describePerk = useCallback((pid: number): { about: string; effects: string[] } => {
    const perk = perkById.get(pid);
    const about = String(perk?.Description ?? '').trim();
    const effects: string[] = [];

    const actions = actsByPerk.get(pid) ?? [];
    for (const act of actions) {
      const fn = Number(act.Function);

      // PerkAction|PerkID|Function|Value|TargetID|...
      // In our import/export mapping, TargetType column often holds the "Value".
      if (fn === 4) {
        const amount = Number(act.TargetType);
        const targetId = Number(act.TargetID);
        if (!Number.isFinite(amount) || !Number.isFinite(targetId)) continue;
        const target = skillById.get(targetId);
        const targetName = String(target?.Name ?? `SkillDef ${targetId}`);
        effects.push(`${targetName} ${formatSigned(amount)}`);
      } else if (fn === 7) {
        const amount = Number(act.TargetType);
        const statId = Number(act.TargetID);
        if (!Number.isFinite(amount) || !Number.isFinite(statId)) continue;
        const stat = statById.get(statId);
        const statName = String(stat?.Name ?? `Stat ${statId}`);
        effects.push(`${statName} ${formatSigned(amount)}`);
      } else if (fn === 6) {
        const statId = Number(act.TargetID);
        if (!Number.isFinite(statId)) continue;
        const stat = statById.get(statId);
        const statName = String(stat?.Name ?? `Stat ${statId}`);
        effects.push(`Grants ${statName}`);
      // fn 0/1 (Allow/Deny Skill), 2/3 (Allow/Deny Perk) — backend gating, skip
      } else if (fn === 8) {
        const id = Number(act.TargetID);
        if (!Number.isFinite(id)) continue;
        effects.push(`Grants ability ${String(spellById.get(id)?.Name ?? `Ability ${id}`)}`);
      } else if (fn === 9) {
        const id = Number(act.TargetID);
        if (!Number.isFinite(id)) continue;
        effects.push(`Grants status ${String(statusById.get(id)?.Name ?? `Status ${id}`)}`);
      } else if (fn === 10) {
        const id = Number(act.TargetID);
        if (!Number.isFinite(id)) continue;
        effects.push(`Unlocks status ${String(statusById.get(id)?.Name ?? `Status ${id}`)}`);
      }
      // fn 13/14 (Allow/Deny Category) — backend gating, skip
    }

    // Also parse legacy descriptions for bullet-style bonuses.
    if (about) {
      const attrMatches = about.matchAll(/• \+([0-9]+) ([A-Za-z ]+)/g);
      for (const m of attrMatches) {
        const bonus = Number(m[1]);
        const name = String(m[2] ?? '').trim();
        if (Number.isFinite(bonus) && name) effects.push(`${name} ${formatSigned(bonus)}`);
      }

      const skillMatches = about.matchAll(/• ([A-Za-z ]+): ([0-9]+)/g);
      for (const m of skillMatches) {
        const name = String(m[1] ?? '').trim();
        const bonus = Number(m[2]);
        if (Number.isFinite(bonus) && name) effects.push(`${name} ${formatSigned(bonus)}`);
      }
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const uniq = effects.filter((e) => {
      const k = e.trim();
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return { about, effects: uniq };
  }, [actsByPerk, formatSigned, perkById, skillById, statById, spellById, statusById]);

  const resetCharacterSheet = useCallback(() => {
    setAdmin(false);
    setCharacterName('Player');
    setActiveTab('character');
    setChosen([]);
    setSheetZoom(1);
    // Reset allocations to minimum values
    const initial = new Map<number, number>();
    for (const attr of attributes) {
      initial.set(idOf(attr), minAttrAlloc);
    }
    for (const skill of skills) {
      initial.set(idOf(skill), minSkillAlloc);
    }
    setAllocations(initial);
    setExpandedRollId(null);
    setRollInputs(new Map());
    setActiveStatusIds(new Set());
    setStatCurrentValues(new Map());
    setStatusCategoryMap(new Map());
    onPersistedStateChange?.(null);
  }, [attributes, skills, minAttrAlloc, minSkillAlloc]);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sheetViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sheetViewportRef.current;
    if (!el) return;

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const round1 = (v: number) => Math.round(v * 10) / 10;

    const onWheel = (e: WheelEvent) => {
      // Use Ctrl+wheel (or Meta+wheel) to avoid breaking normal scrolling.
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();

      const step = 0.1;
      const dir = e.deltaY < 0 ? 1 : -1;
      setSheetZoom((prev) => {
        const next = round1(prev + dir * step);
        return clamp(next, 0.5, 2.5);
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel as EventListener);
    };
  }, []);

  const perksListClass = isChildWindow
    ? 'space-y-2 pr-1'
    : 'space-y-2 max-h-[70vh] overflow-y-auto pr-1';

  const attrSkillsListClass = isChildWindow
    ? 'space-y-2 pr-1'
    : 'space-y-2 max-h-[60vh] overflow-y-auto pr-1';

  const inner = (
    <div
      ref={sheetViewportRef}
      className={
        isChildWindow
          ? 'relative w-full'
          : 'relative w-full max-w-7xl max-h-[90vh] overflow-y-auto'
      }
      onClick={(e) => {
        if (!isChildWindow) e.stopPropagation();
      }}
    >
      <div
        className={
          isChildWindow
            ? 'relative w-full rounded-lg border theme-border theme-bg-base p-4'
            : 'relative w-full rounded-lg border theme-border theme-bg-base p-4'
        }
        // `zoom` is non-standard but works well in Chromium/Electron and preserves scroll sizing.
        style={{ zoom: sheetZoom } as React.CSSProperties}
      >
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold theme-text">Character Sheet</div>
            <div className="text-xs theme-text-muted">Perks · Stats · Attributes/Skills · Abilities</div>
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
              className={`rounded-md border theme-border px-3 py-2 text-sm ${
                chatPanel.mode !== 'hidden'
                  ? 'theme-bg-accent theme-text-accent-on hover:theme-bg-accent-hover'
                  : 'theme-bg-input theme-text-secondary hover:theme-bg-elevated'
              }`}
              onClick={() => panelActions.toggle('chat')}
              title={chatPanel.mode !== 'hidden' ? 'Hide chat' : 'Show chat'}
            >
              {chatPanel.mode !== 'hidden' ? 'Chat \u2715' : 'Chat'}
            </button>
            <button
              type="button"
              className="rounded-md border theme-border theme-bg-input px-3 py-2 text-sm theme-text-secondary hover:theme-bg-elevated"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="mt-3 flex gap-1 border-b theme-border">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'character'
                ? 'theme-text border-b-2 border-[var(--accent-primary)]'
                : 'theme-text-muted hover:theme-text'
            }`}
            onClick={() => setActiveTab('character')}
          >
            Character
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'abilities'
                ? 'theme-text border-b-2 border-[var(--accent-primary)]'
                : 'theme-text-muted hover:theme-text'
            }`}
            onClick={() => setActiveTab('abilities')}
          >
            Abilities
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'ai-characters'
                ? 'theme-text border-b-2 border-[var(--accent-primary)]'
                : 'theme-text-muted hover:theme-text'
            }`}
            onClick={() => setActiveTab('ai-characters')}
          >
            AI Characters
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-8">
          {/* Left Sidebar — Perks (character tab) or Active Statuses (abilities tab) */}
          <div className="rounded-lg border theme-border theme-bg-muted p-3 lg:col-span-2">

            {activeTab === 'abilities' ? (
              /* Active Statuses sidebar for Abilities tab */
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold theme-text">Active Statuses</h2>
                  <span className="text-xs theme-text-muted">{activeStatusIds.size} active</span>
                </div>
                <div className={perksListClass}>
                  {activeStatusIds.size === 0 ? (
                    <div className="text-xs theme-text-muted text-center py-4">
                      No active statuses. Toggle statuses on the Character tab.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {statusRows
                        .filter((s) => activeStatusIds.has(idOf(s)) && !String(s.Name ?? '').startsWith('====='))
                        .map((s) => {
                          const sid = idOf(s);
                          const name = String(s.Name ?? `Status ${sid}`);
                          const colorStr = String(s.Color ?? '').trim();
                          const parts = colorStr.split(',').map((v) => parseFloat(v.trim()));
                          const cssColor =
                            parts.length >= 3 && parts.every((p) => Number.isFinite(p))
                              ? `rgba(${Math.round(parts[0] * 255)},${Math.round(parts[1] * 255)},${Math.round(parts[2] * 255)},${parts[3] ?? 1})`
                              : 'rgba(128,128,128,1)';
                          return (
                            <div
                              key={sid}
                              className="flex items-center gap-2 p-2 rounded theme-bg-surface border theme-border-muted"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                                style={{ backgroundColor: cssColor }}
                              />
                              <span className="text-sm theme-text truncate flex-1">{name}</span>
                              <button
                                type="button"
                                className="text-xs theme-text-muted hover:text-red-400 shrink-0"
                                onClick={() => {
                                  setActiveStatusIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(sid);
                                    return next;
                                  });
                                }}
                                title="Remove status"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Perks sidebar for Character tab */
              <>
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

              {chosen.length > 0 && (
                <button
                  type="button"
                  className="w-full mb-3 px-3 py-2 text-sm rounded bg-rose-700 hover:bg-rose-600 text-white"
                  onClick={resetCharacterSheet}
                  title="Clears chosen perks, allocations, and roll inputs"
                >
                  Reset character sheet
                </button>
              )}

              {/* Chosen perks */}
              {chosen.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-wide theme-text-muted mb-2">Chosen</div>
                  {chosen.map((pid) => {
                    const perk = perkRows.find((x) => Number(x.ID) === pid);
                    if (!perk) return null;
                    const details = describePerk(pid);
                    return (
                      <div
                        key={pid}
                        className="p-2 rounded theme-bg-surface border theme-border-muted mb-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm theme-text">{String(perk.Name ?? `Perk ${pid}`)}</div>
                            <div className="text-xs theme-text-muted">{String(perk.Category ?? '')}</div>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 ml-2 px-2 py-0.5 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white"
                            onClick={() => removePerk(pid)}
                          >
                            ✕
                          </button>
                        </div>
                        {details.effects.length > 0 && (
                          <div className="text-xs theme-text-secondary mt-1 space-y-0.5">
                            {details.effects.map((e, i) => (
                              <div key={i}>• {e}</div>
                            ))}
                          </div>
                        )}
                        {details.about && (
                          <div className="text-xs theme-text-muted mt-1 line-clamp-3">{details.about}</div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Available perks */}
              {derivedPerkLists.available.filter((p) => !chosenSet.has(idOf(p))).length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-wide theme-text-muted mb-2 mt-3">Available</div>
                  {derivedPerkLists.available.filter((p) => !chosenSet.has(idOf(p))).map((p) => {
                    const id = idOf(p);
                    const cost = num(p.Cost, 0);
                    const disabled = derivedPerkLists.denyCatActive(p) || (cost > (perkPointsAvailable - perkPointsSpent));
                    const details = describePerk(id);

                    return (
                      <div
                        key={String(id)}
                        className="p-2 rounded theme-bg-elevated border theme-border-muted mb-2"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <div className="font-medium text-sm theme-text">{String(p.Name ?? `Perk ${p.ID}`)}</div>
                            <div className="text-xs theme-text-muted">{String(p.Category ?? '')}</div>
                          </div>
                          <div className="text-xs font-semibold theme-text-secondary ml-2">Cost {cost}</div>
                        </div>
                        {details.effects.length > 0 && (
                          <div className="text-xs theme-text-secondary mb-1 space-y-0.5">
                            {details.effects.map((e, i) => (
                              <div key={i}>• {e}</div>
                            ))}
                          </div>
                        )}
                        {details.about && (
                          <div className="text-xs theme-text-muted mb-2 line-clamp-2">{details.about}</div>
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

                </div>
              </>
            )}
          </div>

          {/* Main Content */}
          <div className="space-y-4 lg:col-span-6">
            {/* Character Tab Content */}
            {activeTab === 'character' && (
              <>
            {/* Stats (collapsible) */}
            {publicStatsWithAlloc.length > 0 && (
              <details className="rounded-lg border theme-border theme-bg-muted" open>
                <summary className="font-semibold p-3 cursor-pointer hover:theme-bg-elevated transition-colors select-none theme-text">
                  Stats ({publicStatsWithAlloc.length})
                </summary>
                <div className="px-3 pb-3 grid grid-cols-1 gap-2">
                  {publicStatsWithAlloc.map((s) => {
                    const isPrivate = !tf(s.Public);
                    const canModify = tf(s.Trainable) || tf(s.Active) || admin;
                    const statId = idOf(s);
                    const statMax = Math.round(Number(s.__max) * 100) / 100;
                    const statMin = Number(s.__min);
                    // Current defaults to max if not explicitly set
                    const current = statCurrentValues.has(statId) ? statCurrentValues.get(statId)! : statMax;
                    const displayMax = Number.isFinite(statMax) ? String(statMax) : '0';
                    const displayCurrent = Number.isFinite(current) ? String(Math.round(current * 100) / 100) : '0';
                    
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
                            <>
                              <button
                                type="button"
                                className="w-6 h-6 rounded theme-bg-elevated border theme-border-muted text-xs font-bold theme-text hover:bg-red-500/20"
                                onClick={() => setStatCurrentValue(statId, current - 1, statMax, statMin)}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                className="w-14 px-1 py-1 text-sm text-center theme-bg-elevated border theme-border-muted rounded theme-text"
                                value={displayCurrent}
                                onChange={(e) => setStatCurrentValue(statId, Number(e.target.value) || 0, statMax, statMin)}
                              />
                              <button
                                type="button"
                                className="w-6 h-6 rounded theme-bg-elevated border theme-border-muted text-xs font-bold theme-text hover:bg-green-500/20"
                                onClick={() => setStatCurrentValue(statId, current + 1, statMax, statMin)}
                              >
                                +
                              </button>
                            </>
                          )}
                          <div className="theme-text-secondary font-semibold text-sm whitespace-nowrap">
                            / {displayMax}
                          </div>
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
                  const attrMaxAlloc = num(g.attr['Max Allocation'], -1);
                  const attrEffectiveMax = attrMaxAlloc === -1 ? maxAttrAlloc : attrMaxAlloc;
                  const attrEffectiveMin = minAttrAlloc;
                  const canDecAttr = allocation > attrEffectiveMin;
                  const nextAttrInc = Math.max(attrEffectiveMin, Math.min(attrEffectiveMax, allocation + 1));
                  const canIncAttr = (() => {
                    if (nextAttrInc === allocation) return false;
                    const oldCost = attrPointBuy
                      ? calculatePointBuyCost(attrEffectiveMin, allocation)
                      : allocation - attrEffectiveMin;
                    const newCost = attrPointBuy
                      ? calculatePointBuyCost(attrEffectiveMin, nextAttrInc)
                      : nextAttrInc - attrEffectiveMin;
                    const costChange = newCost - oldCost;
                    return attrPointsSpent + costChange <= attributePointsAvailable;
                  })();
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
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className={
                                canDecAttr
                                  ? 'w-7 h-7 rounded theme-bg-elevated hover:theme-bg-surface theme-text'
                                  : 'w-7 h-7 rounded theme-bg-elevated theme-text-muted cursor-not-allowed'
                              }
                              onClick={() => updateAllocation(attrId, allocation - 1, true)}
                              disabled={!canDecAttr}
                              aria-label="Decrease allocation"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm theme-text" title="Allocated points">
                              {allocation}
                            </span>
                            <button
                              type="button"
                              className={
                                canIncAttr
                                  ? 'w-7 h-7 rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)]'
                                  : 'w-7 h-7 rounded theme-bg-elevated theme-text-muted cursor-not-allowed'
                              }
                              onClick={() => updateAllocation(attrId, allocation + 1, true)}
                              disabled={!canIncAttr}
                              aria-label="Increase allocation"
                            >
                              +
                            </button>
                          </div>
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
                          {enable5eAdvantage && diceSystem === 0 && (
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
                          const skMaxAlloc = num(sk['Max Allocation'], -1);
                          const skEffectiveMax = skMaxAlloc === -1 ? maxSkillAlloc : skMaxAlloc;
                          const skEffectiveMin = minSkillAlloc;
                          const canDecSkill = skAlloc > skEffectiveMin;
                          const nextSkillInc = Math.max(skEffectiveMin, Math.min(skEffectiveMax, skAlloc + 1));
                          const canIncSkill = (() => {
                            if (nextSkillInc === skAlloc) return false;
                            const oldCost = skillPointBuy
                              ? calculatePointBuyCost(skEffectiveMin, skAlloc)
                              : skAlloc - skEffectiveMin;
                            const newCost = skillPointBuy
                              ? calculatePointBuyCost(skEffectiveMin, nextSkillInc)
                              : nextSkillInc - skEffectiveMin;
                            const costChange = newCost - oldCost;
                            return skillPointsSpent + costChange <= skillPointsAvailable;
                          })();

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
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      className={
                                        canDecSkill
                                          ? 'w-6 h-6 rounded theme-bg-elevated hover:theme-bg-surface theme-text text-xs'
                                          : 'w-6 h-6 rounded theme-bg-elevated theme-text-muted cursor-not-allowed text-xs'
                                      }
                                      onClick={() => updateAllocation(skId, skAlloc - 1, false)}
                                      disabled={!canDecSkill}
                                      aria-label="Decrease skill allocation"
                                    >
                                      −
                                    </button>
                                    <span className="w-7 text-center text-xs theme-text" title="Allocated points">
                                      {skAlloc}
                                    </span>
                                    <button
                                      type="button"
                                      className={
                                        canIncSkill
                                          ? 'w-6 h-6 rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:bg-[var(--accent-primary-hover)] text-xs'
                                          : 'w-6 h-6 rounded theme-bg-elevated theme-text-muted cursor-not-allowed text-xs'
                                      }
                                      onClick={() => updateAllocation(skId, skAlloc + 1, false)}
                                      disabled={!canIncSkill}
                                      aria-label="Increase skill allocation"
                                    >
                                      +
                                    </button>
                                  </div>
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
                                  {enable5eAdvantage && diceSystem === 0 && (
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

            {/* Status Tracker */}
            <StatusPanel
              statusRows={statusRows}
              statusActionRows={statusActionRows}
              skillById={skillById}
              statById={statById}
              spellById={spellById}
              activeStatusIds={activeStatusIds}
              onToggleStatus={(sid, active) => {
                setActiveStatusIds((prev) => {
                  const next = new Set(prev);
                  if (active) next.add(sid);
                  else next.delete(sid);
                  return next;
                });
              }}
            />

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

                    const details = describePerk(pid);

                    return (
                      <div
                        key={pid}
                        className="theme-bg-surface border theme-border-muted rounded px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm theme-text">
                            {String(perk.Category ?? 'Perk')}: {String(perk.Name ?? `Perk ${pid}`)}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white"
                            onClick={() => removePerk(pid)}
                          >
                            Remove
                          </button>
                        </div>

                        {details.effects.length > 0 && (
                          <div className="text-xs theme-text-secondary mt-1">
                            <div className="font-semibold theme-text-muted">Bonuses</div>
                            <div className="mt-1 space-y-0.5">
                              {details.effects.map((e) => (
                                <div key={e}>• {e}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {details.about && (
                          <div className="text-xs theme-text-muted mt-2 whitespace-pre-wrap">
                            {details.about}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
              </>
            )}

            {/* Abilities Tab Content */}
            {activeTab === 'abilities' && (
              <div className="h-[70vh] relative">
                <AbilitiesTab
                  spellDefs={spellRows}
                  spellReqDefs={spellReqRows}
                  perkActions={perkActs}
                  mutatorActions={mutatorActionRows}
                  statusActions={statusActionRows}
                  schemaData={data as Record<string, Row[]>}
                  chosenPerkIds={chosenSet}
                  activeStatusIds={activeStatusIds}
                  activeMutatorIds={activeMutatorIds}
                  adminMode={admin}
                  allocations={allocations}
                  perkBonuses={perkBonuses}
                  statValues={allStatValues}
                  activeStatusCategories={activeStatusCategories}
                  statusCategoryMap={statusCategoryMap}
                  characterName={characterName}
                  numDice={numDice}
                  diceSides={diceSides}
                  onAbilityResult={(result, messages) => {
                    // Log ability execution to chat
                    addMessage({
                      tab: 'local',
                      sender: 'user',
                      content: messages.join('\n'),
                      type: 'ability',
                      metadata: {
                        abilityId: result.spellId,
                        abilityName: result.spellName,
                      },
                    });

                    // Propagate effects to the character sheet ONLY when they applied to the caster.
                    // Target effects should never mutate the player's tracked stats/statuses.
                    const casterEffects = result.effects.filter((e) => e.appliedToId === 0);

                    // Propagate status grants/removals from effects to character sheet
                    const grantedStatuses = casterEffects
                      .filter((e) => e.statusGranted !== undefined)
                      .map((e) => ({ id: e.statusGranted!, category: e.statusGrantCategory }));
                    const removedStatuses = casterEffects
                      .flatMap((e) => e.statusRemoved ?? []);

                    if (grantedStatuses.length > 0 || removedStatuses.length > 0) {
                      setActiveStatusIds((prev) => {
                        const next = new Set(prev);
                        for (const s of grantedStatuses) next.add(s.id);
                        for (const s of removedStatuses) next.delete(s);
                        return next;
                      });
                      // Track categories for granted statuses
                      setStatusCategoryMap((prev) => {
                        const next = new Map(prev);
                        for (const s of grantedStatuses) {
                          if (s.category) next.set(s.id, s.category);
                        }
                        for (const s of removedStatuses) {
                          next.delete(s);
                        }
                        return next;
                      });
                    }

                    // Propagate caster stat changes into the sheet's current values.
                    // This is how action economy counters (often Function 10 SetStat) stay in sync.
                    const statChanges = casterEffects.filter(
                      (e) => e.statChanged && (e.function === 1 || e.function === 5 || e.function === 10)
                    );
                    if (statChanges.length > 0) {
                      setStatCurrentValues((prev) => {
                        const next = new Map(prev);
                        for (const e of statChanges) {
                          if (e.statChanged) {
                            next.set(e.statChanged.statId, e.statChanged.newValue);
                          }
                        }
                        return next;
                      });
                    }
                  }}
                />
              </div>
            )}

            {/* AI Characters Tab Content */}
            {activeTab === 'ai-characters' && (
              <div className="lg:col-span-8">
                <AiCharactersTab
                  schemaData={data}
                  onCreateNew={() => {
                    // Switch to chat panel and suggest command
                    if (panelActions.show) {
                      panelActions.show('chat');
                    }
                    addMessage({
                      tab: 'local',
                      sender: 'system',
                      content: 'Use /create-opponent [level] [role] to create a new AI character.\nExample: /create-opponent 5 warrior',
                      type: 'system',
                    });
                  }}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );

  // Chat panel managed by PanelShell
  const chatPanelElement = (
    <PanelShell
      title="Chat"
      mode={chatPanel.mode}
      onPopout={() => panelActions.popout('chat')}
      onHide={() => panelActions.hide('chat')}
    >
      <ChatPanel
        className="flex-1 min-h-0"
      />
    </PanelShell>
  );

  if (isChildWindow) {
    return (
      <div className="h-full w-full overflow-auto theme-bg-base p-4 flex gap-4">
        <div className="flex-1 min-w-0">{inner}</div>
        {chatPanelElement}
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-auto p-4"
    >
      <div className="my-auto flex gap-4 items-start">
        {inner}
        {chatPanelElement}
      </div>
    </div>
  );
}
