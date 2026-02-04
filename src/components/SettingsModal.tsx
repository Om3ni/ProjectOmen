import { useCallback, useEffect, useState } from 'react';

import { useTheme, THEMES, type ThemeName } from '@/hooks/useTheme';
import {
  SettingsService,
  type Settings,
  type LLMProvider,
  type DiscordSettings,
  type LLMSettings,
} from '@/services/SettingsService';

// Type for partial nested updates
type PartialSettings = {
  discord?: Partial<DiscordSettings>;
  llm?: Partial<LLMSettings>;
  theme?: ThemeName;
  autoSave?: boolean;
  autoSaveInterval?: number;
};

type SettingsTab = 'general' | 'discord' | 'llm' | 'developer';

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'discord', label: 'Discord' },
  { id: 'llm', label: 'LLM' },
  { id: 'developer', label: 'Developer' },
];

const LLM_PROVIDERS: Array<{ id: LLMProvider; label: string }> = [
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'openai', label: 'OpenAI (GPT)' },
  { id: 'ollama', label: 'Ollama (Local)' },
  { id: 'custom', label: 'Custom Endpoint' },
];

type Props = {
  onClose: () => void;
  wipPasswordHash?: string;
};

export function SettingsModal({ onClose, wipPasswordHash }: Props) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<Settings>(() => SettingsService.load());
  const [testStatus, setTestStatus] = useState<{
    discord?: { testing: boolean; result?: { success: boolean; error?: string } };
    llm?: { testing: boolean; result?: { success: boolean; error?: string } };
  }>({});
  const [wipPassword, setWipPassword] = useState('');
  const [wipError, setWipError] = useState('');

  // Sync theme from settings on load
  useEffect(() => {
    if (settings.theme !== theme) {
      setTheme(settings.theme);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback((partial: PartialSettings) => {
    setSettings((prev) => {
      const next = { ...prev };
      // Deep merge for nested objects
      if (partial.discord) {
        next.discord = { ...prev.discord, ...partial.discord };
      }
      if (partial.llm) {
        next.llm = { ...prev.llm, ...partial.llm };
      }
      if (partial.theme !== undefined) next.theme = partial.theme;
      if (partial.autoSave !== undefined) next.autoSave = partial.autoSave;
      if (partial.autoSaveInterval !== undefined) next.autoSaveInterval = partial.autoSaveInterval;
      return next;
    });
  }, []);

  const handleSave = () => {
    SettingsService.save(settings);
    // Apply theme change
    if (settings.theme !== theme) {
      setTheme(settings.theme);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const testDiscord = async () => {
    setTestStatus((prev) => ({ ...prev, discord: { testing: true } }));
    const result = await SettingsService.testDiscordWebhook(settings.discord.webhookUrl);
    setTestStatus((prev) => ({ ...prev, discord: { testing: false, result } }));
  };

  const testLLM = async () => {
    setTestStatus((prev) => ({ ...prev, llm: { testing: true } }));
    const result = await SettingsService.testLLMConnection(settings.llm);
    setTestStatus((prev) => ({ ...prev, llm: { testing: false, result } }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="rounded-lg border theme-border theme-bg-base shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
          <h2 className="text-lg font-semibold theme-text">Settings</h2>
          <button
            type="button"
            className="theme-text-secondary hover:theme-text"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b theme-border px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--color-accent)] theme-text-accent'
                  : 'border-transparent theme-text-secondary hover:theme-text'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <GeneralTab
              settings={settings}
              onUpdateSettings={updateSettings}
            />
          )}
          {activeTab === 'discord' && (
            <DiscordTab
              settings={settings}
              onUpdateSettings={updateSettings}
              testStatus={testStatus.discord}
              onTest={testDiscord}
            />
          )}
          {activeTab === 'llm' && (
            <LLMTab
              settings={settings}
              onUpdateSettings={updateSettings}
              testStatus={testStatus.llm}
              onTest={testLLM}
            />
          )}
          {activeTab === 'developer' && (
            <DeveloperTab
              settings={settings}
              onUpdateSettings={updateSettings}
              wipPasswordHash={wipPasswordHash}
              wipPassword={wipPassword}
              setWipPassword={setWipPassword}
              wipError={wipError}
              setWipError={setWipError}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t theme-border">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium rounded-md theme-bg-secondary theme-text hover:theme-bg-hover"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium rounded-md theme-bg-accent theme-text-accent-on hover:theme-bg-accent-hover"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Tab Components ---

type TabProps = {
  settings: Settings;
  onUpdateSettings: (partial: PartialSettings) => void;
};

function GeneralTab({ settings, onUpdateSettings }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium theme-text mb-2">Theme</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                settings.theme === t.id
                  ? 'border-[var(--color-accent)] theme-bg-accent/10'
                  : 'theme-border theme-bg-secondary hover:theme-bg-hover'
              }`}
              onClick={() => onUpdateSettings({ theme: t.id as ThemeName })}
            >
              <span
                className="w-4 h-4 rounded-full border border-white/20"
                style={{ backgroundColor: t.accent }}
              />
              <span className="theme-text">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-save */}
      <div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => onUpdateSettings({ autoSave: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm theme-text">Auto-save changes</span>
        </label>
        <p className="mt-1 ml-7 text-xs theme-text-secondary">
          Automatically save your work to browser storage as you edit
        </p>
      </div>
    </div>
  );
}

type IntegrationTabProps = TabProps & {
  testStatus?: { testing: boolean; result?: { success: boolean; error?: string } };
  onTest: () => void;
};

function DiscordTab({ settings, onUpdateSettings, testStatus, onTest }: IntegrationTabProps) {
  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.discord.enabled}
            onChange={(e) => onUpdateSettings({ discord: { enabled: e.target.checked } })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm theme-text">Enable Discord integration</span>
        </label>
      </div>

      {settings.discord.enabled && (
        <>
          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium theme-text mb-2">Webhook URL</label>
            <input
              type="password"
              value={settings.discord.webhookUrl}
              onChange={(e) => onUpdateSettings({ discord: { webhookUrl: e.target.value } })}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <p className="mt-1 text-xs theme-text-secondary">
              Create a webhook in your Discord server's channel settings
            </p>
          </div>

          {/* Bot name */}
          <div>
            <label className="block text-sm font-medium theme-text mb-2">Bot Username (optional)</label>
            <input
              type="text"
              value={settings.discord.username || ''}
              onChange={(e) => onUpdateSettings({ discord: { username: e.target.value } })}
              placeholder="Project Omen"
              className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Test button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTest}
              disabled={!settings.discord.webhookUrl || testStatus?.testing}
              className="px-4 py-2 text-sm font-medium rounded-md theme-bg-secondary theme-text hover:theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus?.testing ? 'Testing...' : 'Test Connection'}
            </button>
            {testStatus?.result && (
              <span className={`text-sm ${testStatus.result.success ? 'text-green-400' : 'text-red-400'}`}>
                {testStatus.result.success ? 'Success!' : testStatus.result.error}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LLMTab({ settings, onUpdateSettings, testStatus, onTest }: IntegrationTabProps) {
  const showEndpoint = settings.llm.provider === 'ollama' || settings.llm.provider === 'custom';
  const showApiKey = settings.llm.provider !== 'ollama';

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.llm.enabled}
            onChange={(e) => onUpdateSettings({ llm: { enabled: e.target.checked } })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm theme-text">Enable LLM assistant</span>
        </label>
        <p className="mt-1 ml-7 text-xs theme-text-secondary">
          Use AI to help design RPR systems, perks, abilities, and more
        </p>
      </div>

      {settings.llm.enabled && (
        <>
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium theme-text mb-2">Provider</label>
            <select
              value={settings.llm.provider}
              onChange={(e) => onUpdateSettings({ llm: { provider: e.target.value as LLMProvider } })}
              className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {LLM_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          {showApiKey && (
            <div>
              <label className="block text-sm font-medium theme-text mb-2">API Key</label>
              <input
                type="password"
                value={settings.llm.apiKey || ''}
                onChange={(e) => onUpdateSettings({ llm: { apiKey: e.target.value } })}
                placeholder="sk-..."
                className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          )}

          {/* Custom Endpoint */}
          {showEndpoint && (
            <div>
              <label className="block text-sm font-medium theme-text mb-2">
                {settings.llm.provider === 'ollama' ? 'Ollama URL' : 'Custom Endpoint'}
              </label>
              <input
                type="url"
                value={settings.llm.endpoint || ''}
                onChange={(e) => onUpdateSettings({ llm: { endpoint: e.target.value } })}
                placeholder={settings.llm.provider === 'ollama' ? 'http://localhost:11434/api/generate' : 'https://api.example.com/v1/chat/completions'}
                className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          )}

          {/* Model */}
          <div>
            <label className="block text-sm font-medium theme-text mb-2">Model</label>
            <input
              type="text"
              value={settings.llm.model || ''}
              onChange={(e) => onUpdateSettings({ llm: { model: e.target.value } })}
              placeholder={
                settings.llm.provider === 'anthropic' ? 'claude-3-haiku-20240307' :
                settings.llm.provider === 'openai' ? 'gpt-4o-mini' :
                settings.llm.provider === 'ollama' ? 'llama2' : 'default'
              }
              className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium theme-text mb-2">
              Temperature: {settings.llm.temperature?.toFixed(1) ?? '0.7'}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.llm.temperature ?? 0.7}
              onChange={(e) => onUpdateSettings({ llm: { temperature: parseFloat(e.target.value) } })}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-700"
            />
            <div className="flex justify-between text-xs theme-text-secondary mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Test button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTest}
              disabled={testStatus?.testing || (!settings.llm.apiKey && settings.llm.provider !== 'ollama')}
              className="px-4 py-2 text-sm font-medium rounded-md theme-bg-secondary theme-text hover:theme-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus?.testing ? 'Testing...' : 'Test Connection'}
            </button>
            {testStatus?.result && (
              <span className={`text-sm ${testStatus.result.success ? 'text-green-400' : 'text-red-400'}`}>
                {testStatus.result.success ? 'Success!' : testStatus.result.error}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type DeveloperTabProps = TabProps & {
  wipPasswordHash?: string;
  wipPassword: string;
  setWipPassword: (value: string) => void;
  wipError: string;
  setWipError: (value: string) => void;
};

function DeveloperTab({
  wipPasswordHash,
  wipPassword,
  setWipPassword,
  wipError,
  setWipError,
}: DeveloperTabProps) {
  // Read wipUnlocked directly from service to ensure it's current
  const [wipUnlocked, setWipUnlocked] = useState(() => SettingsService.isWipUnlocked());

  const handleUnlock = () => {
    if (!wipPasswordHash) {
      setWipError('WIP password not configured in schema');
      return;
    }
    if (SettingsService.unlockWip(wipPassword, wipPasswordHash)) {
      setWipUnlocked(true);
      setWipPassword('');
      setWipError('');
    } else {
      setWipError('Incorrect password');
    }
  };

  const handleLock = () => {
    SettingsService.lockWip();
    setWipUnlocked(false);
  };

  return (
    <div className="space-y-6">
      {/* WIP Tables Access */}
      <div>
        <h3 className="text-sm font-medium theme-text mb-3">Work-in-Progress Tables</h3>
        <p className="text-xs theme-text-secondary mb-4">
          Some tables (DiceConfig, DiceRules, Gear) are still being decoded and are hidden by default.
          Enter the developer password to access these incomplete tables.
        </p>

        {wipUnlocked ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">WIP tables are unlocked</span>
            </div>
            <button
              type="button"
              onClick={handleLock}
              className="px-4 py-2 text-sm font-medium rounded-md theme-bg-secondary theme-text hover:theme-bg-hover"
            >
              Lock WIP Tables
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium theme-text mb-2">Developer Password</label>
              <input
                type="password"
                value={wipPassword}
                onChange={(e) => {
                  setWipPassword(e.target.value);
                  setWipError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlock();
                }}
                placeholder="Enter password to unlock"
                className="w-full px-3 py-2 rounded-md border theme-border theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
            {wipError && (
              <p className="text-sm text-red-400">{wipError}</p>
            )}
            <button
              type="button"
              onClick={handleUnlock}
              disabled={!wipPassword}
              className="px-4 py-2 text-sm font-medium rounded-md theme-bg-accent theme-text-accent-on hover:theme-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unlock WIP Tables
            </button>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="border-t theme-border pt-4">
        <h3 className="text-sm font-medium theme-text mb-2">About WIP Tables</h3>
        <ul className="text-xs theme-text-secondary space-y-1 list-disc list-inside">
          <li><strong>DiceConfig</strong> - 21 columns, not yet decoded</li>
          <li><strong>DiceRules</strong> - Dice system configuration (fully decoded)</li>
          <li><strong>Gear</strong> - Equipment/inventory system (not yet decoded)</li>
        </ul>
      </div>
    </div>
  );
}
