import { num } from '@/utils/rprHelpers';

export type FormulaContext = Record<string, number>;

type Row = Record<string, unknown>;

/**
 * Combat context for evaluating RPR formulas with {c.Name} and {t.Name} syntax
 */
export interface CombatFormulaContext {
  // Caster's stats (Stat ID -> value)
  casterStats: Map<number, number>;
  // Caster's skills (Skill ID -> total value)
  casterSkills: Map<number, number>;
  // Target's stats (Stat ID -> value)
  targetStats: Map<number, number>;
  // Target's skills (Skill ID -> total value)
  targetSkills: Map<number, number>;
  // Name lookup tables
  statNameToId: Map<string, number>;
  skillNameToId: Map<string, number>;
  // Names for message formatting
  casterName?: string;
  targetName?: string;
}

/**
 * Build name-to-ID lookup maps from schema data
 */
export function buildNameLookups(
  statRows: Row[],
  skillRows: Row[]
): { statNameToId: Map<string, number>; skillNameToId: Map<string, number> } {
  const statNameToId = new Map<string, number>();
  const skillNameToId = new Map<string, number>();

  for (const row of statRows) {
    const id = num(row.ID);
    const name = String(row.Name ?? '').trim().toLowerCase();
    if (id > 0 && name) {
      statNameToId.set(name, id);
    }
  }

  for (const row of skillRows) {
    const id = num(row.ID);
    const name = String(row.Name ?? '').trim().toLowerCase();
    if (id > 0 && name) {
      skillNameToId.set(name, id);
    }
  }

  return { statNameToId, skillNameToId };
}

/**
 * Resolve {c.Name} and {t.Name} variables to their numeric values
 * Returns a flat FormulaContext for use with evaluateFormulaForTest
 */
export function resolveCombatVariables(
  formula: string,
  context: CombatFormulaContext
): { resolvedFormula: string; variableValues: FormulaContext } {
  const variableValues: FormulaContext = {};

  // Match {c.Name} or {t.Name} patterns
  const COMBAT_VAR_PATTERN = /\{(c|t)\.([^}]+)\}/gi;

  const resolvedFormula = formula.replace(COMBAT_VAR_PATTERN, (_match, prefix, name) => {
    const isCaster = prefix.toLowerCase() === 'c';
    const lookupName = name.trim().toLowerCase();

    // Create a unique key for this variable
    const key = `${prefix.toLowerCase()}_${lookupName.replace(/\s+/g, '_')}`;

    let value = 0;

    // Try stat lookup first
    const statId = context.statNameToId.get(lookupName);
    if (statId !== undefined) {
      value = isCaster
        ? context.casterStats.get(statId) ?? 0
        : context.targetStats.get(statId) ?? 0;
    } else {
      // Try skill lookup
      const skillId = context.skillNameToId.get(lookupName);
      if (skillId !== undefined) {
        value = isCaster
          ? context.casterSkills.get(skillId) ?? 0
          : context.targetSkills.get(skillId) ?? 0;
      }
    }

    variableValues[key] = value;
    return `{${key}}`;
  });

  return { resolvedFormula, variableValues };
}

/**
 * Evaluate an RPR combat formula with {c.Name} and {t.Name} syntax
 */
export function evaluateCombatFormula(
  formula: string,
  context: CombatFormulaContext,
  rng?: () => number
): FormulaTestResult {
  const trimmed = String(formula ?? '').trim();
  // Some WHRpR datasets embed codex placeholders like "[codex:M19]" in fields that
  // otherwise hold numeric formulas. Those references aren't resolvable in this editor,
  // so surface a clear error message (callers should catch and display it).
  if (/^\[codex:[^\]]+\]$/i.test(trimmed)) {
    throw new Error(`Codex placeholder cannot be evaluated as a numeric formula: ${trimmed}`);
  }

  const { resolvedFormula, variableValues } = resolveCombatVariables(formula, context);
  return evaluateFormulaForTest(resolvedFormula, variableValues, rng);
}

export type DiceRollEntry = {
  operator: 'd' | 'h';
  count: number;
  sides: number;
  rolls: number[];
  kept: number[];
  notation: string;
  total: number;
};

export type FormulaTestResult = {
  value: number;
  rounded: number;
  rolls: DiceRollEntry[];
};

export function extractFormulaVariables(input: string): string[] {
  if (typeof input !== 'string' || !input.includes('{')) return [];
  const found = new Set<string>();
  const regex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    const key = (match[1] ?? '').trim();
    if (key) found.add(key);
  }
  return Array.from(found);
}

export function formatFormulaNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const rounded = Number(value.toFixed(3));
  if (Number.isInteger(rounded)) return String(rounded);
  const str = String(rounded);
  return str.includes('.') ? str.replace(/\.?0+$/, '') : str;
}

export function evaluateFormulaForTest(
  expression: string,
  variableValues: FormulaContext = {},
  rng: () => number = Math.random
): FormulaTestResult {
  if (typeof expression !== 'string') throw new Error('Formula is missing.');
  const trimmed = expression.trim();
  if (!trimmed) throw new Error('Enter a formula before testing.');

  const text = trimmed;
  const length = text.length;
  let index = 0;
  const rolls: DiceRollEntry[] = [];
  const random = typeof rng === 'function' ? rng : Math.random;

  const isDigit = (ch: string | null) => ch !== null && ch >= '0' && ch <= '9';
  const peek = () => (index < length ? text[index] : null);
  const advance = () => {
    if (index < length) index++;
  };
  const skipWhitespace = () => {
    while (index < length && /\s/.test(text[index]!)) index++;
  };
  const error = (message: string) => {
    const col = index + 1;
    return new Error(`${message} (position ${col})`);
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (true) {
      skipWhitespace();
      const ch = peek();
      if (ch === '+' || ch === '-') {
        advance();
        const rhs = parseTerm();
        value = ch === '+' ? value + rhs : value - rhs;
      } else {
        break;
      }
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (true) {
      skipWhitespace();
      const ch = peek();
      if (ch === '*' || ch === '/') {
        advance();
        const rhs = parseFactor();
        if (ch === '*') {
          value = value * rhs;
        } else {
          if (rhs === 0) throw error('Division by zero.');
          value = value / rhs;
        }
      } else {
        break;
      }
    }
    return value;
  };

  const parseFactor = (): number => {
    let value = parseUnary();
    while (true) {
      skipWhitespace();
      const ch = peek();
      if (ch === 'd' || ch === 'D' || ch === 'h' || ch === 'H') {
        advance();
        const operator = ch.toLowerCase() as 'd' | 'h';
        const rhs = parseUnary();
        value = applyDice(operator, value, rhs);
      } else {
        break;
      }
    }
    return value;
  };

  const parseUnary = (): number => {
    skipWhitespace();
    const ch = peek();
    if (ch === '+') {
      advance();
      return +parseUnary();
    }
    if (ch === '-') {
      advance();
      return -parseUnary();
    }
    return parsePrimary();
  };

  const looksLikeFunction = () => {
    if (index + 2 > length) return false;
    return text.slice(index, index + 2).toLowerCase() === 'f.';
  };

  const parsePrimary = (): number => {
    skipWhitespace();
    const ch = peek();
    if (ch === '(') {
      advance();
      const value = parseExpression();
      skipWhitespace();
      if (peek() !== ')') throw error('Missing closing parenthesis.');
      advance();
      return value;
    }
    if (ch === '{') {
      return parseVariable();
    }
    if (looksLikeFunction()) {
      return parseFunction();
    }
    if (ch === '.' || isDigit(ch)) {
      return parseNumber();
    }
    throw error(`Unexpected token "${ch ?? 'end'}".`);
  };

  const parseNumber = (): number => {
    skipWhitespace();
    const start = index;
    let seenDigit = false;
    let seenDot = false;
    while (index < length) {
      const ch = text[index]!;
      if (ch === '.') {
        if (seenDot) break;
        seenDot = true;
        advance();
        continue;
      }
      if (!isDigit(ch)) break;
      seenDigit = true;
      advance();
    }
    if (!seenDigit && !seenDot) throw error('Expected number.');
    const slice = text.slice(start, index);
    const numeric = Number(slice);
    if (!Number.isFinite(numeric)) throw error('Invalid number literal.');
    return numeric;
  };

  const parseVariable = (): number => {
    advance();
    const start = index;
    while (index < length && text[index] !== '}') advance();
    if (index >= length) throw error('Variable is missing closing brace.');
    const raw = text.slice(start, index).trim();
    advance();
    if (!raw) throw error('Variable name cannot be empty.');
    if (!Object.prototype.hasOwnProperty.call(variableValues || {}, raw)) {
      throw error(`Enter a value for {${raw}}.`);
    }
    const val = Number(variableValues[raw]);
    if (!Number.isFinite(val)) throw error(`Value for {${raw}} must be numeric.`);
    return val;
  };

  const parseFunction = (): number => {
    index += 2;
    const start = index;
    while (index < length) {
      const ch = text[index]!;
      if (!/[a-z]/i.test(ch)) break;
      advance();
    }
    if (start === index) throw error('Expected function name after f.');
    const name = text.slice(start, index).toLowerCase();
    skipWhitespace();
    if (peek() !== '[') throw error(`Expected "[" after f.${name}.`);
    advance();
    const args: number[] = [];
    skipWhitespace();
    if (peek() !== ']') {
      while (true) {
        const arg = parseExpression();
        args.push(arg);
        skipWhitespace();
        const next = peek();
        if (next === ',') {
          advance();
          skipWhitespace();
          continue;
        }
        if (next === ']') break;
        throw error(`Expected "," or "]" in f.${name} arguments.`);
      }
    }
    if (peek() !== ']') throw error(`Missing closing "]" in f.${name}.`);
    advance();
    return applyFunction(name, args);
  };

  const applyFunction = (name: string, args: number[]): number => {
    switch (name) {
      case 'max':
        if (!args.length) throw error('f.max needs at least one argument.');
        return Math.max(...args);
      case 'min':
        if (!args.length) throw error('f.min needs at least one argument.');
        return Math.min(...args);
      case 'clamp':
        if (args.length !== 3) throw error('f.clamp expects value, min, max.');
        return Math.min(Math.max(args[0]!, args[1]!), args[2]!);
      case 'abs':
        if (args.length !== 1) throw error('f.abs expects one value.');
        return Math.abs(args[0]!);
      case 'floor':
        if (args.length !== 1) throw error('f.floor expects one value.');
        return Math.floor(args[0]!);
      case 'ceil':
        if (args.length !== 1) throw error('f.ceil expects one value.');
        return Math.ceil(args[0]!);
      case 'round':
        if (args.length !== 1) throw error('f.round expects one value.');
        return Math.round(args[0]!);
      default:
        throw error(`Unknown function f.${name}.`);
    }
  };

  const applyDice = (operator: 'd' | 'h', leftValue: number, rightValue: number): number => {
    if (!Number.isFinite(leftValue)) throw error('Dice count must resolve to a number.');
    if (!Number.isFinite(rightValue)) throw error('Dice sides must resolve to a number.');
    const count = Math.max(0, Math.floor(Math.abs(leftValue)));
    const sides = Math.max(0, Math.floor(Math.abs(rightValue)));
    if (sides < 1) throw error('Dice sides must be at least 1.');
    if (count > 500) throw error('Dice count is limited to 500.');
    if (sides > 1000) throw error('Dice sides are limited to 1000.');

    const entry: DiceRollEntry = {
      operator,
      count,
      sides,
      rolls: [],
      kept: [],
      notation: `${count}${operator}${sides}`,
      total: 0,
    };

    if (count === 0) {
      rolls.push(entry);
      return 0;
    }

    for (let i = 0; i < count; i++) {
      const roll = 1 + Math.floor(random() * sides);
      entry.rolls.push(roll);
    }

    if (operator === 'h') {
      entry.kept = [...entry.rolls].sort((a, b) => b - a);
      entry.total = entry.kept.reduce((sum, val) => sum + val, 0);
    } else {
      entry.kept = [...entry.rolls];
      entry.total = entry.kept.reduce((sum, val) => sum + val, 0);
    }

    rolls.push(entry);
    return entry.total;
  };

  const value = parseExpression();
  skipWhitespace();
  if (index < length) throw error(`Unexpected trailing input "${text.slice(index)}".`);

  return {
    value,
    rounded: Math.round(value),
    rolls,
  };
}
