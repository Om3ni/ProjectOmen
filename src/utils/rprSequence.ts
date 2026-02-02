// Pure domain helper for re-sequencing Node IDs and updating references.
// Intentionally no React dependencies.

export function sequenceIds(rows: string[][]): string[][] {
  const skipTables = new Set([
    'DiceConfig',
    'DiceRules',
    'Gear',
    'LookupClimate',
    'LookupShelter',
    'LookupTimeOfDay',
    'LookupMainHand',
    'LookupOffHand',
    'LookupArmorClass',
  ]);

  const childTokens = new Set([
    'SpellReqDef',
    'SpellTargetCond',
    'SpellEffect',
    'RuneCondition',
    'RuneEffect',
    'RuneAction',
    'PerkAction',
    'StatusAction',
    'MutatorAction',
    'MutatorCondition',
  ]);

  const parentChildMap: Record<string, string[]> = {
    SpellDef: ['SpellReqDef', 'SpellTargetCond', 'SpellEffect'],
    RuneDef: ['RuneCondition', 'RuneEffect'],
    Rune: ['RuneAction'],
    PerkDef: ['PerkAction'],
    StatusDef: ['StatusAction'],
    MutatorDef: ['MutatorAction', 'MutatorCondition'],
  };

  const getIdColumn = (token: string): number => {
    if (token === 'SkillDef') return 2;
    return 1;
  };

  const remapId = (val: string, mapping: Map<number, number>): string => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return val;
    const mapped = mapping.get(num);
    return mapped !== undefined ? String(mapped) : val;
  };

  const remapFormula = (formula: string, idMapping: Map<number, number>): string => {
    if (!formula || !formula.trim()) return formula;
    return formula.replace(/(\d+)(\*[\d.]+)/g, (match, idStr, rest) => {
      const oldId = parseInt(idStr, 10);
      const newId = idMapping.get(oldId);
      return newId !== undefined ? `${newId}${rest}` : match;
    });
  };

  let minExistingId = Number.POSITIVE_INFINITY;

  for (let i = 0; i < rows.length; i++) {
    const token = rows[i][0];
    if (!token || skipTables.has(token) || childTokens.has(token)) continue;

    const idCol = getIdColumn(token);
    if (rows[i].length <= idCol) continue;

    const oldId = parseInt(rows[i][idCol] || '0', 10);
    if (Number.isFinite(oldId) && oldId > 0 && oldId < minExistingId) {
      minExistingId = oldId;
    }
  }

  if (!Number.isFinite(minExistingId)) {
    minExistingId = 1;
  }

  const firstId = Math.max(1, Math.floor(minExistingId));

  let nextId = firstId;
  const idMap = new Map<string, Map<number, number>>();

  const next = rows.map((r) => [...r]);

  // PASS 1: Sequence all parent tables and build ID mappings
  for (let i = 0; i < next.length; i++) {
    const token = next[i][0];
    if (!token || skipTables.has(token) || childTokens.has(token)) continue;

    const idCol = getIdColumn(token);
    if (next[i].length <= idCol) continue;

    if (!idMap.has(token)) idMap.set(token, new Map());
    const oldId = parseInt(next[i][idCol] || '0', 10);
    if (isNaN(oldId)) continue;

    idMap.get(token)!.set(oldId, nextId);
    next[i][idCol] = String(nextId);
    nextId++;
  }

  // PASS 2: Update child rows to use their parent's new ID (col 1)
  for (const [parent, children] of Object.entries(parentChildMap)) {
    const pMap = idMap.get(parent);
    if (!pMap) continue;

    for (let i = 0; i < next.length; i++) {
      const token = next[i][0];
      if (!children.includes(token)) continue;
      if (next[i].length <= 1) continue;

      const oldParentId = parseInt(next[i][1] || '0', 10);
      if (isNaN(oldParentId)) continue;

      const newParentId = pMap.get(oldParentId);
      if (newParentId !== undefined) {
        next[i][1] = String(newParentId);
      }
    }
  }

  const skillMap = idMap.get('SkillDef');
  const statMap = idMap.get('Stat');
  const perkMap = idMap.get('PerkDef');
  const spellMap = idMap.get('SpellDef');
  const statusMap = idMap.get('StatusDef');

  // PASS 3: Remap formula fields
  if (skillMap && skillMap.size > 0) {
    for (let i = 0; i < next.length; i++) {
      const token = next[i][0];
      if (token === 'SkillDef' && next[i].length > 7 && next[i][7]) {
        next[i][7] = remapFormula(next[i][7], skillMap);
      }
      if (token === 'Stat' && next[i].length > 4 && next[i][4]) {
        next[i][4] = remapFormula(next[i][4], skillMap);
      }
    }
  }

  // PASS 4: Remap TargetID columns in action/effect tables
  for (let i = 0; i < next.length; i++) {
    const token = next[i][0];

    if (token === 'PerkAction' && next[i].length > 4) {
      const func = parseInt(next[i][2] || '0', 10);
      if (!isNaN(func)) {
        if ((func === 0 || func === 1 || func === 4) && skillMap) {
          next[i][4] = remapId(next[i][4], skillMap);
        } else if ((func === 2 || func === 3 || func === 11) && perkMap) {
          next[i][4] = remapId(next[i][4], perkMap);
        } else if ((func === 6 || func === 7) && statMap) {
          next[i][4] = remapId(next[i][4], statMap);
        } else if (func === 8 && spellMap) {
          next[i][4] = remapId(next[i][4], spellMap);
        } else if ((func === 9 || func === 10) && statusMap) {
          next[i][4] = remapId(next[i][4], statusMap);
        }
      }
    }

    if (token === 'StatusAction' && next[i].length > 4) {
      const func = parseInt(next[i][4] || '0', 10);
      if (!isNaN(func)) {
        if (func === 0 && skillMap) {
          next[i][2] = remapId(next[i][2], skillMap);
        } else if (func === 1 && statMap) {
          next[i][2] = remapId(next[i][2], statMap);
        } else if (func === 2 && perkMap) {
          next[i][2] = remapId(next[i][2], perkMap);
        } else if (func === 3 && spellMap) {
          next[i][2] = remapId(next[i][2], spellMap);
        } else if (func === 4 && statusMap) {
          next[i][2] = remapId(next[i][2], statusMap);
        }
      }
    }

    if (token === 'MutatorAction' && next[i].length > 3) {
      const func = parseInt(next[i][2] || '0', 10);
      if (!isNaN(func)) {
        if (func === 0 && skillMap) {
          next[i][3] = remapId(next[i][3], skillMap);
        } else if (func === 1 && statMap) {
          next[i][3] = remapId(next[i][3], statMap);
        } else if (func === 2 && perkMap) {
          next[i][3] = remapId(next[i][3], perkMap);
        } else if (func === 3 && spellMap) {
          next[i][3] = remapId(next[i][3], spellMap);
        } else if ((func === 4 || func === 5) && statusMap) {
          next[i][3] = remapId(next[i][3], statusMap);
        }
      }
    }

    if (token === 'RuneAction' && next[i].length > 4) {
      const effect = parseInt(next[i][4] || '0', 10);
      if (!isNaN(effect)) {
        if (effect === 0 && skillMap) {
          next[i][2] = remapId(next[i][2], skillMap);
        } else if (effect === 1 && perkMap) {
          next[i][2] = remapId(next[i][2], perkMap);
        } else if (effect === 3 && statMap) {
          next[i][2] = remapId(next[i][2], statMap);
        } else if (effect === 4 && spellMap) {
          next[i][2] = remapId(next[i][2], spellMap);
        } else if ((effect === 5 || effect === 6) && statusMap) {
          next[i][2] = remapId(next[i][2], statusMap);
        }
      }
    }

    if (token === 'SpellEffect' && next[i].length > 5) {
      const effect = parseInt(next[i][3] || '0', 10);
      if (!isNaN(effect)) {
        if ((effect === 1 || effect === 5 || effect === 10) && statMap) {
          next[i][5] = remapId(next[i][5], statMap);
        } else if (effect === 4 && skillMap) {
          next[i][5] = remapId(next[i][5], skillMap);
        } else if (effect === 6 && perkMap) {
          next[i][5] = remapId(next[i][5], perkMap);
        } else if ((effect === 8 || effect === 9) && spellMap) {
          next[i][5] = remapId(next[i][5], spellMap);
        } else if ((effect === 11 || effect === 12) && statusMap) {
          next[i][5] = remapId(next[i][5], statusMap);
        }
      }
    }

    if (token === 'SpellReqDef' && next[i].length > 4) {
      const func = parseInt(next[i][2] || '0', 10);
      if (!isNaN(func)) {
        if (func === 0 && statMap) {
          next[i][4] = remapId(next[i][4], statMap);
        } else if ((func === 1 || func === 2) && skillMap) {
          next[i][4] = remapId(next[i][4], skillMap);
        } else if (func === 3 && perkMap) {
          next[i][4] = remapId(next[i][4], perkMap);
        }
      }
    }

    if (token === 'SpellTargetCond' && next[i].length > 5) {
      const func = parseInt(next[i][3] || '0', 10);
      if (!isNaN(func)) {
        if (func === 2 && skillMap) {
          next[i][5] = remapId(next[i][5], skillMap);
        } else if (func === 20 && statusMap) {
          next[i][5] = remapId(next[i][5], statusMap);
        }
      }
    }

    if (token === 'RuneCondition' && next[i].length > 5) {
      const cond = parseInt(next[i][3] || '0', 10);
      if (!isNaN(cond)) {
        if (cond === 2 && skillMap) {
          next[i][5] = remapId(next[i][5], skillMap);
        }
      }
    }

    if (token === 'MutatorCondition' && next[i].length > 5) {
      const cond = parseInt(next[i][3] || '0', 10);
      if (!isNaN(cond)) {
        if (cond === 0 && perkMap) {
          next[i][5] = remapId(next[i][5], perkMap);
        } else if (cond === 2 && skillMap) {
          next[i][5] = remapId(next[i][5], skillMap);
        } else if (cond === 20 && statusMap) {
          next[i][5] = remapId(next[i][5], statusMap);
        }
      }
    }

    if (token === 'RuneEffect' && next[i].length > 3 && statMap) {
      next[i][3] = remapId(next[i][3], statMap);
    }
  }

  return next;
}
