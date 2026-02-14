/**
 * Ollama Refinement Document Loader
 * Loads user's custom personality, style, and behavior instructions
 */

export interface RefinementConfig {
  personality?: string;
  responseStyle?: string;
  specialInstructions?: string;
  exampleInteractions?: string;
  domainKnowledge?: string;
}

const DEFAULT_REFINEMENT: RefinementConfig = {
  personality: `You are helpful, direct, and action-oriented. You don't wait for permission - you take initiative.`,
  
  responseStyle: `- Keep responses concise and practical
- Use bullet points for lists
- Include examples when helpful
- Acknowledge mistakes quickly and fix them`,
  
  specialInstructions: `When designing RPR systems:
- Always validate TotalNodes matches highest ID
- Prefer simple, balanced mechanics over complex ones
- Test your understanding by explaining back to the user
- Ask clarifying questions if requirements are ambiguous`,
  
  exampleInteractions: `Good: "I'll create that ability now." [calls createAbility()]
Bad: "I can help you create that ability if you'd like."

Good: "Created 3 stats: Health, Stamina, Mana. Health uses formula 1*10.0 for 10 HP per point."
Bad: "You should create stats like Health, Stamina, and Mana."`,
  
  domainKnowledge: `RPR-specific knowledge:
- TTRPG = Tabletop Role-Playing Game
- d20 = 20-sided die (D&D style)
- Dice pools = multiple dice, count successes (World of Darkness style)
- Point buy = spending points to increase attributes/skills`,
};

let cachedRefinement: RefinementConfig | null = null;
let refinementPath: string | null = null;

/**
 * Get path to refinement document
 */
export function getRefinementPath(): string {
  if (refinementPath) return refinementPath;
  
  // Try to use electron API if available
  if (typeof window !== 'undefined' && (window as any).electron?.ollamaLocal) {
    // Will be set via IPC
    return 'ollama-refinement.md';
  }
  
  return 'ollama-refinement.md';
}

/**
 * Load refinement configuration
 */
export async function loadRefinement(): Promise<RefinementConfig> {
  // Check cache first
  if (cachedRefinement) {
    return cachedRefinement;
  }
  
  try {
    // Try to load from electron if available
    if (typeof window !== 'undefined' && (window as any).electron?.ollamaLocal) {
      const electron = (window as any).electron;
      const result = await electron.ollamaLocal.getRefinement?.();
      
      if (result?.content) {
        cachedRefinement = parseRefinementMarkdown(result.content);
        return cachedRefinement;
      }
    }
    
    // Fall back to defaults
    console.log('[Ollama Refinement] Using default refinement config');
    cachedRefinement = DEFAULT_REFINEMENT;
    return cachedRefinement;
  } catch (error) {
    console.warn('[Ollama Refinement] Failed to load, using defaults:', error);
    cachedRefinement = DEFAULT_REFINEMENT;
    return cachedRefinement;
  }
}

/**
 * Parse markdown refinement document into structured config
 */
function parseRefinementMarkdown(markdown: string): RefinementConfig {
  const config: RefinementConfig = {};
  
  // Simple section parser
  const sections = markdown.split(/^##\s+/m).filter(s => s.trim());
  
  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0].trim().toLowerCase();
    const content = lines.slice(1).join('\n').trim();
    
    if (title.includes('personality')) {
      config.personality = content;
    } else if (title.includes('response style') || title.includes('writing style')) {
      config.responseStyle = content;
    } else if (title.includes('special') || title.includes('instruction')) {
      config.specialInstructions = content;
    } else if (title.includes('example')) {
      config.exampleInteractions = content;
    } else if (title.includes('domain') || title.includes('knowledge')) {
      config.domainKnowledge = content;
    }
  }
  
  return config;
}

/**
 * Build refined system prompt with user's refinements
 */
export function buildRefinedPrompt(basePrompt: string, refinement: RefinementConfig): string {
  let prompt = basePrompt;
  
  // Add refinements as separate sections
  if (refinement.personality) {
    prompt += `\n\n**Your Personality:**\n${refinement.personality}`;
  }
  
  if (refinement.responseStyle) {
    prompt += `\n\n**Response Style:**\n${refinement.responseStyle}`;
  }
  
  if (refinement.specialInstructions) {
    prompt += `\n\n**Special Instructions:**\n${refinement.specialInstructions}`;
  }
  
  if (refinement.exampleInteractions) {
    prompt += `\n\n**Example Interactions:**\n${refinement.exampleInteractions}`;
  }
  
  if (refinement.domainKnowledge) {
    prompt += `\n\n**Domain Knowledge:**\n${refinement.domainKnowledge}`;
  }
  
  return prompt;
}

/**
 * Clear cache to force reload
 */
export function clearRefinementCache(): void {
  cachedRefinement = null;
}

/**
 * Get default refinement as markdown for creating new file
 */
export function getDefaultRefinementMarkdown(): string {
  return `# Ollama Refinement Document

This document customizes how Ollama behaves in Project Omen. Edit any section to change Ollama's personality, style, or behavior. Changes are loaded automatically - no rebuild needed!

---

## Personality

${DEFAULT_REFINEMENT.personality}

---

## Response Style

${DEFAULT_REFINEMENT.responseStyle}

---

## Special Instructions

${DEFAULT_REFINEMENT.specialInstructions}

---

## Example Interactions

${DEFAULT_REFINEMENT.exampleInteractions}

---

## Domain Knowledge

${DEFAULT_REFINEMENT.domainKnowledge}

---

**Tips:**
- Be specific - Ollama follows instructions literally
- Use examples - Show good vs bad responses
- Keep it concise - Long prompts slow down responses
- Test changes - Chat with Ollama after editing to verify
`;
}
