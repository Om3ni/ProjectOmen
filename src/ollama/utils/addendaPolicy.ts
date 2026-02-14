/**
 * Deterministic selection of which addenda to inject.
 * No LLM calls. Runs on every user message.
 */

/** Tab names that have addenda files. Lowercase, matches filename suffix. */
export type AddendaTab =
  | 'dice_system'
  | 'attributes'
  | 'skills'
  | 'stats'
  | 'perks'
  | 'abilities'
  | 'statuses'
  | 'runes'
  | 'mutators';

/**
 * Map editor activeCategory (from useEditorState) to AddendaTab.
 * The editor uses capitalized names: 'Attributes', 'Perks', 'Abilities', etc.
 * Returns undefined if no mapping exists.
 */
export function categoryToTab(activeCategory: string): AddendaTab | undefined {
  const mapping: Record<string, AddendaTab> = {
    'Dice System': 'dice_system',
    'Attributes': 'attributes',
    'Skills': 'skills',
    'Stats': 'stats',
    'Perks': 'perks',
    'Abilities': 'abilities',
    'Statuses': 'statuses',
    'Runes': 'runes',
    'Mutators': 'mutators',
  };
  return mapping[activeCategory];
}

/**
 * Infer which tab the user is asking about from their message text.
 * Returns undefined if no clear topic detected.
 * Uses keyword matching — keep patterns simple and fast.
 */
export function inferTabFromMessage(message: string): AddendaTab | undefined {
  const lower = message.toLowerCase();

  // Check in priority order (most specific first)
  if (/\b(dice|point budget|allocation)\b/i.test(lower)) return 'dice_system';
  if (/\b(attribute|separator)\b/i.test(lower)) return 'attributes';
  if (/\b(skill|proficiency|bonus source)\b/i.test(lower)) return 'skills';
  if (/\b(stat|formula|derived)\b/i.test(lower)) return 'stats';
  if (/\b(perk|feat|perk ?action|perkaction)\b/i.test(lower)) return 'perks';
  if (/\b(abilit|spell|spelldef|spelleffect)\b/i.test(lower)) return 'abilities';
  if (/\b(status|condition|statusaction)\b/i.test(lower)) return 'statuses';
  if (/\b(rune|equipment|runeaction)\b/i.test(lower)) return 'runes';
  if (/\b(mutator|conditional|mutatorcond)\b/i.test(lower)) return 'mutators';

  return undefined;
}

/**
 * Determine if the user's message warrants loading tab help addenda.
 * True when:
 *   - Message contains explain-type signals (what, how, explain, help, etc.)
 *   - User is in a complex tab AND appears to be editing/creating
 */
export function isHelpQuery(message: string): boolean {
  const lower = message.toLowerCase();

  // Check for help/explanation signals
  const helpSignals = [
    /\bwhat (does|is|are)\b/,
    /\bhow (does|do|to)\b/,
    /\bexplain\b/,
    /\bhelp\b/,
    /\bmeaning\b/,
    /\bdifference\b/,
    /\bwhen should\b/,
    /\bwhy\b/,
    /\bdefine\b/,
    /\btell me about\b/,
    /\bguide\b/,
    /\bdescribe\b/,
  ];

  return helpSignals.some(pattern => pattern.test(lower));
}

/**
 * Select which addenda to load for this message.
 * @param activeCategory - from editorState.activeCategory (e.g., 'Attributes')
 * @param userMessage - the user's message text
 * @returns array of 0-2 AddendaTab names to load
 *
 * Rules:
 * 1. If isHelpQuery(message), include tab from activeCategory (if mapped)
 * 2. If inferTabFromMessage finds a different tab, include that too
 * 3. For complex tabs (abilities, runes, mutators, perks), include their
 *    addendum even for non-help queries if the user is on that tab
 * 4. Cap at 2 addenda max
 * 5. Deduplicate
 */
export function selectAddenda(
  activeCategory: string | undefined,
  userMessage: string
): AddendaTab[] {
  const result: AddendaTab[] = [];
  const complexTabs: AddendaTab[] = ['abilities', 'runes', 'mutators', 'perks'];

  const currentTab = activeCategory ? categoryToTab(activeCategory) : undefined;
  const inferredTab = inferTabFromMessage(userMessage);
  const isHelp = isHelpQuery(userMessage);

  // Rule 1: Include current tab if help query
  if (isHelp && currentTab) {
    result.push(currentTab);
  }

  // Rule 3: Include complex tabs even for non-help queries if user is on that tab
  if (!isHelp && currentTab && complexTabs.includes(currentTab)) {
    result.push(currentTab);
  }

  // Rule 2: Include inferred tab if different
  if (inferredTab && !result.includes(inferredTab)) {
    result.push(inferredTab);
  }

  // Rule 4 & 5: Cap at 2, deduplicate (already done via includes check)
  return result.slice(0, 2);
}
