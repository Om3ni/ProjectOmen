import { SettingsService, type LLMSettings, type LLMProvider } from './SettingsService';

export type LLMMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type LLMResponse = {
  content: string;
  model?: string;
  error?: string;
};

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
};

type OpenAIResponse = {
  choices: Array<{ message: { content: string } }>;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

type OllamaResponse = {
  response: string;
  model: string;
};

// Build system prompt with schema knowledge
function buildSystemPrompt(schemaData?: Record<string, unknown[]>): string {
  const basePrompt = `You are a helpful assistant for Project Omen, an RPR (Role-Play Resource) editor for tabletop-style game data. You help users understand and work with game definitions like:

- **Attributes & Skills**: Character stats (SkillDef with TypeFlag 't' for attributes, 'f' for skills)
- **Perks**: Character abilities with costs and effects (PerkDef + PerkAction)
- **Stats**: Derived values with formulas and base values
- **Runes**: Equippable items with conditions and effects (RuneDef + RuneAction + RuneCondition)
- **Statuses**: Temporary or permanent character states (StatusDef + StatusAction)
- **Mutators**: Conditional modifiers (MutatorDef + MutatorAction + MutatorCondition)
- **Abilities/Spells**: Actions with requirements, targeting, and effects (SpellDef + SpellEffect + SpellReqDef + SpellTargetCond)

The RPR format uses pipe-delimited text files where each row starts with a literal identifier (e.g., "SkillDef|t|1|Strength|...").

Key concepts:
- Node IDs reference other definitions (e.g., a PerkAction's TargetID references a Stat ID)
- Formulas use semicolon-separated "ID*Multiplier" terms (e.g., "2*1.0;1*0.5")
- Boolean values use 't' for true, 'f' for false
- Enums are numeric codes with specific meanings per field

Answer questions about game mechanics, help design new content, explain field meanings, and assist with formula calculations.`;

  // If we have schema data loaded, we can provide context about what exists
  if (schemaData && Object.keys(schemaData).length > 0) {
    const summaryParts: string[] = [];

    // Count records by type
    const counts: Record<string, number> = {};
    for (const [tableName, records] of Object.entries(schemaData)) {
      if (Array.isArray(records)) {
        counts[tableName] = records.length;
      }
    }

    if (Object.keys(counts).length > 0) {
      summaryParts.push('\n\nCurrently loaded data:');
      for (const [table, count] of Object.entries(counts)) {
        if (count > 0) {
          summaryParts.push(`- ${table}: ${count} records`);
        }
      }
    }

    // Extract some named entities for context
    const attributes: string[] = [];
    const skills: string[] = [];
    const perks: string[] = [];
    const stats: string[] = [];

    const skillDefs = schemaData['SkillDef'] as Array<Record<string, unknown>> | undefined;
    if (skillDefs) {
      for (const record of skillDefs.slice(0, 20)) {
        const name = record['Name'] as string;
        const typeFlag = record['TypeFlag'] as string;
        if (name) {
          if (typeFlag === 't') attributes.push(name);
          else skills.push(name);
        }
      }
    }

    const perkDefs = schemaData['PerkDef'] as Array<Record<string, unknown>> | undefined;
    if (perkDefs) {
      for (const record of perkDefs.slice(0, 15)) {
        const name = record['Name'] as string;
        if (name) perks.push(name);
      }
    }

    const statDefs = schemaData['Stat'] as Array<Record<string, unknown>> | undefined;
    if (statDefs) {
      for (const record of statDefs.slice(0, 15)) {
        const name = record['Name'] as string;
        if (name) stats.push(name);
      }
    }

    if (attributes.length > 0) {
      summaryParts.push(`\nSample Attributes: ${attributes.join(', ')}`);
    }
    if (skills.length > 0) {
      summaryParts.push(`Sample Skills: ${skills.join(', ')}`);
    }
    if (perks.length > 0) {
      summaryParts.push(`Sample Perks: ${perks.join(', ')}`);
    }
    if (stats.length > 0) {
      summaryParts.push(`Sample Stats: ${stats.join(', ')}`);
    }

    return basePrompt + summaryParts.join('\n');
  }

  return basePrompt;
}

// Get default model for provider
function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-3-haiku-20240307';
    case 'openai':
      return 'gpt-4o-mini';
    case 'ollama':
      return 'llama3.2';
    case 'custom':
      return 'default';
  }
}

// Send message to Anthropic API
async function sendToAnthropic(
  settings: LLMSettings,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  const model = settings.model || getDefaultModel('anthropic');

  // Convert messages to Anthropic format (no system role in messages)
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      temperature: settings.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error: ${response.status} ${errorText || response.statusText}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const content = data.content?.[0]?.text || '';

  return {
    content,
    model: data.model,
  };
}

// Send message to OpenAI API
async function sendToOpenAI(
  settings: LLMSettings,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  const model = settings.model || getDefaultModel('openai');

  // Build OpenAI messages with system prompt first
  const openaiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      temperature: settings.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error: ${response.status} ${errorText || response.statusText}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    model: data.model,
  };
}

// Send message to Ollama API
async function sendToOllama(
  settings: LLMSettings,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  const model = settings.model || getDefaultModel('ollama');
  const endpoint = settings.endpoint || 'http://localhost:11434';

  // Build prompt from conversation history
  let prompt = systemPrompt + '\n\n';
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n`;
    }
  }
  prompt += 'Assistant: ';

  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: settings.temperature ?? 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Ollama API error: ${response.status} ${errorText || response.statusText}`);
  }

  const data = (await response.json()) as OllamaResponse;

  return {
    content: data.response || '',
    model: data.model,
  };
}

// Send message to custom OpenAI-compatible API
async function sendToCustom(
  settings: LLMSettings,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  if (!settings.endpoint) {
    throw new Error('Custom endpoint is required');
  }

  const model = settings.model || 'default';

  // Use OpenAI-compatible format
  const customMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: customMessages,
      temperature: settings.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Custom API error: ${response.status} ${errorText || response.statusText}`);
  }

  // Assume OpenAI-compatible response format
  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    model: data.model || model,
  };
}

export const LLMService = {
  /**
   * Send a message to the configured LLM and get a response
   */
  async chat(
    userMessage: string,
    conversationHistory: LLMMessage[] = [],
    schemaData?: Record<string, unknown[]>
  ): Promise<LLMResponse> {
    const settings = SettingsService.load();

    if (!settings.llm.enabled) {
      return { content: '', error: 'LLM is not enabled. Configure it in Settings.' };
    }

    if (!settings.llm.apiKey && settings.llm.provider !== 'ollama') {
      return { content: '', error: 'API key is required. Configure it in Settings.' };
    }

    const systemPrompt = buildSystemPrompt(schemaData);
    const messages: LLMMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    try {
      switch (settings.llm.provider) {
        case 'anthropic':
          return await sendToAnthropic(settings.llm, messages, systemPrompt);
        case 'openai':
          return await sendToOpenAI(settings.llm, messages, systemPrompt);
        case 'ollama':
          return await sendToOllama(settings.llm, messages, systemPrompt);
        case 'custom':
          return await sendToCustom(settings.llm, messages, systemPrompt);
        default:
          return { content: '', error: `Unknown provider: ${settings.llm.provider}` };
      }
    } catch (e) {
      return {
        content: '',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },

  /**
   * Get the default model for the current provider
   */
  getDefaultModel(provider?: LLMProvider): string {
    const settings = SettingsService.load();
    return getDefaultModel(provider || settings.llm.provider);
  },

  /**
   * Check if LLM is configured and ready to use
   */
  isReady(): boolean {
    const settings = SettingsService.load();
    if (!settings.llm.enabled) return false;
    if (settings.llm.provider === 'ollama') return true;
    return !!settings.llm.apiKey;
  },
};
