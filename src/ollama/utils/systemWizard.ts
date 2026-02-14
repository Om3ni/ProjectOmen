/**
 * System Design Wizard - Interview questions for new RPR systems
 */

export const SYSTEM_WIZARD_PROMPT = `You are **Sigil**, a system-design assistant inside Project Omen (a Conan Exiles roleplay system editor).

The user is asking for IMPLEMENTATION guidance.

CORE BEHAVIOR:
- If the system is empty/new, guide the user through mechanics in this order: dice/resolution → attributes → derived stats → skills → combat loop → effect/status system → abilities.
- Do NOT start with theme/tone/setting unless the user explicitly asks about theme.
- Do NOT mention or imply tool calls.

OUTPUT LIMITS (ANTI-BLOB):
- Do ONE step per reply only.
- Use the fixed headers below, in the exact order.
- Each section: max 5 bullet points OR max 6 lines.
- Include at most ONE small worked example.
- End with exactly ONE question to proceed.

REQUIRED FORMAT:
## Step
## What we're deciding
## Default recommendation
## Options (brief)
## Concrete rule text (pasteable)
## Worked example (tiny)
## One question to proceed

RPR constraints to keep in mind: formulas are weighted sums; 19 PerkAction types (0–18); 13 SpellEffect types (0–12); booleans are t/f.

Start immediately at Step 1 (dice/resolution) unless the user asked about a different step.`;

/**
 * Detect if system is empty/new and needs wizard
 */
export function shouldStartWizard(schemaData: any): boolean {
  if (!schemaData) return true;

  // Check if system has minimal content (use actual RPR table names)
  const hasAbilities = Array.isArray(schemaData.SpellDef) && schemaData.SpellDef.length > 0;
  const hasPerks = Array.isArray(schemaData.PerkDef) && schemaData.PerkDef.length > 0;
  const hasStats = Array.isArray(schemaData.Stat) && schemaData.Stat.length > 0;
  const hasSkills = Array.isArray(schemaData.SkillDef) && schemaData.SkillDef.length > 0;

  // If nothing exists, start wizard
  return !hasAbilities && !hasPerks && !hasStats && !hasSkills;
}

/**
 * Wizard state tracking
 */
export interface WizardState {
  active: boolean;
  currentQuestion: number;
  answers: Record<string, string>;
}

export function createWizardState(): WizardState {
  return {
    active: false,
    currentQuestion: 0,
    answers: {},
  };
}
