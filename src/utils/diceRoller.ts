import type { RollResult } from '@/types/chat';

/**
 * Parse and roll dice notation
 * Supports:
 * - Basic: 1d20, 2d6, 4d6
 * - Modifiers: 1d20+5, 2d6-3
 * - Multiple dice groups: 2d6+1d4+3
 * - Keep highest: 2d20kh1 (advantage)
 * - Keep lowest: 2d20kl1 (disadvantage)
 * - Exploding dice: 4d6! (reroll and add on max)
 */

type DiceGroup = {
  count: number;
  sides: number;
  keep?: { type: 'h' | 'l'; count: number };
  exploding?: boolean;
};

type ParsedRoll = {
  groups: DiceGroup[];
  modifier: number;
  originalFormula: string;
};

const DICE_PATTERN = /(\d+)d(\d+)(kh\d+|kl\d+)?(!)?/gi;
const MODIFIER_PATTERN = /([+-]\d+)(?![d\d])/g;

export function parseDiceNotation(formula: string): ParsedRoll | null {
  const normalized = formula.replace(/\s+/g, '').toLowerCase();
  const groups: DiceGroup[] = [];
  let modifier = 0;

  // Extract dice groups
  const diceMatches = normalized.matchAll(DICE_PATTERN);
  for (const match of diceMatches) {
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const keepStr = match[3];
    const exploding = match[4] === '!';

    if (isNaN(count) || isNaN(sides) || count <= 0 || sides <= 0) {
      continue;
    }

    const group: DiceGroup = { count, sides, exploding };

    if (keepStr) {
      const keepType = keepStr[1] as 'h' | 'l';
      const keepCount = parseInt(keepStr.slice(2), 10);
      if (!isNaN(keepCount) && keepCount > 0) {
        group.keep = { type: keepType, count: keepCount };
      }
    }

    groups.push(group);
  }

  if (groups.length === 0) {
    return null;
  }

  // Extract modifiers (numbers with +/- not followed by 'd')
  const modMatches = normalized.matchAll(MODIFIER_PATTERN);
  for (const match of modMatches) {
    modifier += parseInt(match[1], 10);
  }

  // Check for standalone modifier at end like "+5" or "-3"
  const trailingMod = normalized.match(/([+-]\d+)$/);
  if (trailingMod && !normalized.match(/d\d+$/)) {
    // Already captured by MODIFIER_PATTERN
  }

  return {
    groups,
    modifier,
    originalFormula: formula.trim(),
  };
}

function rollSingleDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDiceGroup(group: DiceGroup): number[] {
  const rolls: number[] = [];

  for (let i = 0; i < group.count; i++) {
    let roll = rollSingleDie(group.sides);
    rolls.push(roll);

    // Handle exploding dice
    if (group.exploding) {
      while (roll === group.sides) {
        roll = rollSingleDie(group.sides);
        rolls.push(roll);
      }
    }
  }

  // Handle keep highest/lowest
  if (group.keep) {
    const sorted = [...rolls].sort((a, b) =>
      group.keep!.type === 'h' ? b - a : a - b
    );
    return sorted.slice(0, group.keep.count);
  }

  return rolls;
}

export function rollDice(formula: string): RollResult | null {
  const parsed = parseDiceNotation(formula);
  if (!parsed) {
    return null;
  }

  const allRolls: number[] = [];
  let subtotal = 0;

  for (const group of parsed.groups) {
    const groupRolls = rollDiceGroup(group);
    allRolls.push(...groupRolls);
    subtotal += groupRolls.reduce((sum, r) => sum + r, 0);
  }

  const total = subtotal + parsed.modifier;

  // Check for critical hit/fail on d20 rolls
  const hasSingleD20 =
    parsed.groups.length === 1 &&
    parsed.groups[0].count === 1 &&
    parsed.groups[0].sides === 20;

  let criticalHit: boolean | undefined;
  let criticalFail: boolean | undefined;

  if (hasSingleD20 && allRolls.length > 0) {
    criticalHit = allRolls[0] === 20;
    criticalFail = allRolls[0] === 1;
  }

  return {
    formula: parsed.originalFormula,
    rolls: allRolls,
    modifier: parsed.modifier,
    total,
    criticalHit,
    criticalFail,
  };
}

/**
 * Parse a chat command and handle dice rolls
 * Commands:
 * - /roll 2d6+3
 * - /r 1d20
 */
export function parseRollCommand(input: string): RollResult | null {
  const trimmed = input.trim();

  // Check for roll commands
  const rollMatch = trimmed.match(/^\/r(?:oll)?\s+(.+)$/i);
  if (rollMatch) {
    return rollDice(rollMatch[1]);
  }

  return null;
}

/**
 * Format a roll result for display
 */
export function formatRollResult(result: RollResult): string {
  const rollsStr = result.rolls.join(', ');
  let output = `${result.formula}: [${rollsStr}]`;

  if (result.modifier !== 0) {
    output += ` ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
  }

  output += ` = ${result.total}`;

  if (result.criticalHit) {
    output += ' (Critical Hit!)';
  } else if (result.criticalFail) {
    output += ' (Critical Fail!)';
  }

  return output;
}
