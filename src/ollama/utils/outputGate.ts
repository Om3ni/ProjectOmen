/**
 * Output Gate — Detects when the model dumps raw RPR pipe-delimited data
 * or schema JSON instead of using tool calls to mutate the UI.
 *
 * When detected, the orchestrator rejects the output and forces a retry.
 */

/** Known RPR table prefixes that appear at the start of pipe-delimited rows */
const PIPE_TABLE_PREFIX = /^(SkillDef|PerkDef|PerkAction|Stat|RuneDef|RuneAction|StatusDef|StatusAction|MutatorDef|MutatorAction|SpellDef|SpellEffect|SpellReqDef|SpellTargetCond|RuneCondition|MutatorCondition|DiceConfig)\|/m;

/**
 * Detect if content looks like raw RPR pipe-delimited output or schema dumps.
 * Returns a reason string if rejected, or null if content is fine.
 */
export function detectRawRprOutput(content: string): string | null {
  if (!content || content.length < 20) return null;

  // Check for pipe-delimited table rows (e.g., "SkillDef|1|Strength|...")
  if (PIPE_TABLE_PREFIX.test(content)) {
    return 'Output contains raw RPR pipe-delimited table rows';
  }

  // Check for high pipe density (3+ lines with 4+ pipes each)
  const lines = content.split('\n');
  let pipeHeavyLines = 0;
  for (const line of lines) {
    const pipeCount = (line.match(/\|/g) ?? []).length;
    if (pipeCount >= 4) {
      pipeHeavyLines++;
      if (pipeHeavyLines >= 3) {
        return 'Output contains multiple pipe-heavy lines (likely raw RPR data)';
      }
    }
  }

  return null;
}

/** System message injected when output is rejected, forcing tool-call retry */
export const OUTPUT_REJECTION_MESSAGE =
  'Your previous output was REJECTED because it contained raw RPR pipe-delimited data or schema dumps. ' +
  'You MUST use tool calls (createSkill, createAbility, createPerk, createStat, createRune, createStatus, createMutator, etc.) to modify the editor. ' +
  'NEVER output pipe-delimited rows. Call the appropriate create/update function NOW.';
