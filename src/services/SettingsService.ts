import type { ThemeName } from '@/hooks/useTheme';

// Settings types
export type LLMProvider = 'anthropic' | 'openai' | 'ollama' | 'custom';

export type DiscordSettings = {
  enabled: boolean;
  webhookUrl: string;
  username?: string;
};

export type LLMSettings = {
  enabled: boolean;
  provider: LLMProvider;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  temperature?: number;
};

export type OllamaFreedomLevel = 'conservative' | 'balanced' | 'autonomous';

export type OllamaSettings = {
  enabled: boolean;
  useBundled: boolean;
  freedomLevel: OllamaFreedomLevel;
  endpoint: string;
  model: string;
  temperature: number;
  contextSize: number;
};

export type Settings = {
  // Integrations
  discord: DiscordSettings;
  llm: LLMSettings;
  ollama: OllamaSettings;

  // UI
  ui: {
    chatLayout: 'below' | 'right' | 'floating';
  };

  // General
  theme: ThemeName;
  autoSave: boolean;
  autoSaveInterval: number; // ms

  // Developer features
  wipUnlocked: boolean;
};

const SETTINGS_KEY = 'project-omen:settings:v1';

const SETTINGS_CHANGED_EVENT = 'project-omen:settings-changed';

const DEFAULT_SETTINGS: Settings = {
  discord: {
    enabled: false,
    webhookUrl: '',
    username: '',
  },
  llm: {
    enabled: false,
    provider: 'anthropic',
    apiKey: '',
    endpoint: '',
    model: '',
    temperature: 0.7,
  },
  ollama: {
    enabled: true,
    useBundled: true,
    freedomLevel: 'balanced',
    endpoint: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    contextSize: 8192,
  },
  ui: {
    chatLayout: 'below',
  },
  theme: 'slate',
  autoSave: true,
  autoSaveInterval: 300, // 300ms debounce (matches current behavior)
  wipUnlocked: false,
};

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }
  return result;
}

export const SettingsService = {
  getDefaults(): Settings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings;
  },

  load(): Settings {
    if (!canUseLocalStorage()) {
      return this.getDefaults();
    }

    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return this.getDefaults();
      }

      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Merge with defaults to handle missing fields from older versions
      return deepMerge(this.getDefaults(), parsed);
    } catch {
      return this.getDefaults();
    }
  },

  save(settings: Settings): void {
    if (!canUseLocalStorage()) return;

    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      try {
        window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: settings }));
      } catch {
        // ignore
      }
    } catch {
      // localStorage can fail (quota, privacy mode)
    }
  },

  update(partial: Partial<Settings>): Settings {
    const current = this.load();
    const next = deepMerge(current, partial);
    this.save(next);
    return next;
  },

  // Utility to mask sensitive fields for display
  maskApiKey(key: string | undefined): string {
    if (!key || key.length < 8) return key ? '••••••••' : '';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  },

  // Simple hash for WIP password verification
  hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    // Create a longer hash by combining multiple transformations
    let extended = '';
    for (let i = 0; i < 4; i++) {
      const shifted = ((hash >>> (i * 8)) ^ (hash << (i * 4))) & 0xFFFFFFFF;
      extended += Math.abs(shifted).toString(16).padStart(8, '0');
    }
    return extended;
  },

  // Verify WIP password against schema hash
  verifyWipPassword(password: string, schemaHash: string): boolean {
    const inputHash = this.hashPassword(password);
    return inputHash === schemaHash;
  },

  // Unlock WIP tables (validates password and updates settings)
  unlockWip(password: string, schemaHash: string): boolean {
    if (this.verifyWipPassword(password, schemaHash)) {
      this.update({ wipUnlocked: true });
      return true;
    }
    return false;
  },

  // Lock WIP tables
  lockWip(): void {
    this.update({ wipUnlocked: false });
  },

  // Check if WIP is unlocked
  isWipUnlocked(): boolean {
    return this.load().wipUnlocked;
  },

  // Test webhook connectivity
  async testDiscordWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    if (!webhookUrl) {
      return { success: false, error: 'Webhook URL is required' };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '🎲 **Project Omen** - Connection test successful!',
          username: 'Project Omen',
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { success: false, error: `HTTP ${response.status}: ${text || response.statusText}` };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  // Upload a file to Discord webhook
  async uploadToDiscord(
    webhookUrl: string,
    filename: string,
    content: string,
    message?: string,
    username?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!webhookUrl) {
      return { success: false, error: 'Webhook URL is required' };
    }

    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, filename);

      if (message) {
        formData.append('payload_json', JSON.stringify({
          content: message,
          username: username || 'Project Omen',
        }));
      } else {
        formData.append('payload_json', JSON.stringify({
          username: username || 'Project Omen',
        }));
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { success: false, error: `HTTP ${response.status}: ${text || response.statusText}` };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async testLLMConnection(settings: LLMSettings): Promise<{ success: boolean; error?: string }> {
    if (!settings.enabled) {
      return { success: false, error: 'LLM is not enabled' };
    }

    if (!settings.apiKey && settings.provider !== 'ollama') {
      return { success: false, error: 'API key is required' };
    }

    try {
      // This is a simple test - actual implementation will vary by provider
      let endpoint = '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: object = {};

      switch (settings.provider) {
        case 'anthropic':
          endpoint = 'https://api.anthropic.com/v1/messages';
          headers['x-api-key'] = settings.apiKey || '';
          headers['anthropic-version'] = '2023-06-01';
          body = {
            model: settings.model || 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          };
          break;

        case 'openai':
          endpoint = 'https://api.openai.com/v1/chat/completions';
          headers['Authorization'] = `Bearer ${settings.apiKey}`;
          body = {
            model: settings.model || 'gpt-3.5-turbo',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          };
          break;

        case 'ollama':
          endpoint = settings.endpoint || 'http://localhost:11434/api/generate';
          body = {
            model: settings.model || 'llama2',
            prompt: 'Hi',
            stream: false,
          };
          break;

        case 'custom':
          if (!settings.endpoint) {
            return { success: false, error: 'Custom endpoint is required' };
          }
          endpoint = settings.endpoint;
          if (settings.apiKey) {
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
          }
          body = {
            model: settings.model || 'default',
            messages: [{ role: 'user', content: 'Hi' }],
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { success: false, error: `HTTP ${response.status}: ${text || response.statusText}` };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
