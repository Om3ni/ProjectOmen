import { useState } from 'react';

type SetupTab = 'chat' | 'discord' | 'llm';

const TABS: Array<{ id: SetupTab; label: string }> = [
  { id: 'chat', label: 'Chat & Dice' },
  { id: 'discord', label: 'Discord Backup' },
  { id: 'llm', label: 'LLM Assistant' },
];

type Props = {
  onClose: () => void;
  onOpenSettings: () => void;
};

export function SetupGuideModal({ onClose, onOpenSettings }: Props) {
  const [activeTab, setActiveTab] = useState<SetupTab>('chat');

  const handleOpenSettings = () => {
    onClose();
    onOpenSettings();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div
        className="rounded-lg border theme-border theme-bg-base shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b theme-border">
          <h2 className="text-lg font-semibold theme-text">Integration Setup Guide</h2>
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
          {activeTab === 'chat' && <ChatBasicsGuide />}
          {activeTab === 'discord' && <DiscordGuide />}
          {activeTab === 'llm' && <LLMGuide />}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t theme-border">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium rounded-md theme-bg-accent theme-text-accent-on hover:theme-bg-accent-hover"
            onClick={handleOpenSettings}
          >
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBasicsGuide() {
  return (
    <div className="space-y-4 text-sm theme-text">
      <h3 className="text-base font-semibold">Chat Panel Overview</h3>

      <p className="theme-text-secondary">
        The Chat panel lets you roll dice and interact with AI assistants to help design RPR content.
      </p>

      <div className="space-y-3">
        <h4 className="font-medium">Opening the Chat</h4>
        <ul className="list-disc list-inside space-y-1 theme-text-secondary ml-2">
          <li>Use the menu: <strong>Tools &rarr; Chat Panel</strong></li>
          <li>Keyboard shortcut: <code className="px-1 py-0.5 rounded theme-bg-secondary">Ctrl+Shift+C</code></li>
          <li>In browser mode: Click the <strong>Chat</strong> button in the header</li>
        </ul>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Dice Rolling</h4>
        <p className="theme-text-secondary">
          Use the <code className="px-1 py-0.5 rounded theme-bg-secondary">/roll</code> command to roll dice:
        </p>
        <div className="rounded-md theme-bg-secondary p-3 font-mono text-xs space-y-1">
          <div>/roll 1d20        <span className="theme-text-muted">- Roll a d20</span></div>
          <div>/roll 2d6+3       <span className="theme-text-muted">- Roll 2d6 and add 3</span></div>
          <div>/roll 4d6kh3      <span className="theme-text-muted">- Roll 4d6, keep highest 3</span></div>
          <div>/roll 2d20kl1     <span className="theme-text-muted">- Roll with disadvantage</span></div>
          <div>/roll 1d6!        <span className="theme-text-muted">- Exploding dice</span></div>
          <div>/r 1d20+5         <span className="theme-text-muted">- Short form</span></div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Pop-out Window</h4>
        <p className="theme-text-secondary">
          Click the <strong>pop-out</strong> icon (↗) in the chat header to open chat in a separate window.
          This is useful on smaller screens or when you want chat visible alongside other applications.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Chat Tabs</h4>
        <ul className="list-disc list-inside space-y-1 theme-text-secondary ml-2">
          <li><strong>Local</strong> - Private chat for dice rolls (always available)</li>
          <li><strong>LLM</strong> - Chat with an AI assistant to help design RPR content</li>
        </ul>
      </div>
    </div>
  );
}

function DiscordGuide() {
  return (
    <div className="space-y-4 text-sm theme-text">
      <h3 className="text-base font-semibold">Discord Backup Setup</h3>

      <p className="theme-text-secondary">
        Back up your RPR data to a Discord channel. Each backup uploads your current data as a text file,
        creating a version history you can restore from later.
      </p>

      <div className="space-y-3">
        <h4 className="font-medium">Step 1: Create a Webhook in Discord</h4>
        <ol className="list-decimal list-inside space-y-2 theme-text-secondary ml-2">
          <li>Open Discord and go to the server where you want to store backups</li>
          <li>Create a dedicated channel (e.g., #project-omen-backups)</li>
          <li>Right-click on the channel and select <strong>Edit Channel</strong></li>
          <li>Go to <strong>Integrations</strong> &rarr; <strong>Webhooks</strong></li>
          <li>Click <strong>New Webhook</strong></li>
          <li>Give it a name (e.g., "Project Omen Backup")</li>
          <li>Click <strong>Copy Webhook URL</strong></li>
        </ol>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Step 2: Configure in Project Omen</h4>
        <ol className="list-decimal list-inside space-y-2 theme-text-secondary ml-2">
          <li>Go to <strong>File &rarr; Settings</strong> (or press <code className="px-1 py-0.5 rounded theme-bg-secondary">Ctrl+,</code>)</li>
          <li>Select the <strong>Discord</strong> tab</li>
          <li>Check <strong>Enable Discord integration</strong></li>
          <li>Paste the webhook URL you copied</li>
          <li>Click <strong>Test Connection</strong> to verify it works</li>
          <li>Click <strong>Save</strong></li>
        </ol>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Step 3: Backup Your Data</h4>
        <ol className="list-decimal list-inside space-y-2 theme-text-secondary ml-2">
          <li>Go to <strong>Tools &rarr; Backup to Discord</strong></li>
          <li>Your current RPR data will be uploaded as a <code className="px-1 py-0.5 rounded theme-bg-secondary">.txt</code> file</li>
          <li>Check your Discord channel to see the backup</li>
        </ol>
      </div>

      <div className="rounded-md border border-amber-600/40 bg-amber-950/20 p-3">
        <h4 className="font-medium text-amber-300">Security Note</h4>
        <p className="theme-text-secondary mt-1">
          Keep your webhook URL private. Anyone with the URL can send files to your channel.
          If compromised, delete the webhook in Discord and create a new one.
        </p>
      </div>
    </div>
  );
}

function LLMGuide() {
  return (
    <div className="space-y-4 text-sm theme-text">
      <h3 className="text-base font-semibold">LLM Assistant Setup</h3>

      <p className="theme-text-secondary">
        The LLM Assistant can help you design RPR content like perks, abilities, and stats.
        It understands the schema and can suggest properly formatted data.
      </p>

      <div className="space-y-3">
        <h4 className="font-medium">Supported Providers</h4>
        <ul className="list-disc list-inside space-y-1 theme-text-secondary ml-2">
          <li><strong>Anthropic (Claude)</strong> - Requires API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">console.anthropic.com</a></li>
          <li><strong>OpenAI (GPT)</strong> - Requires API key from <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">platform.openai.com</a></li>
          <li><strong>Ollama (Local)</strong> - Free, runs locally. Install from <a href="https://ollama.ai/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">ollama.ai</a></li>
          <li><strong>Custom Endpoint</strong> - Any OpenAI-compatible API</li>
        </ul>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Anthropic Setup</h4>
        <ol className="list-decimal list-inside space-y-2 theme-text-secondary ml-2">
          <li>Create an account at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">console.anthropic.com</a></li>
          <li>Go to API Keys and create a new key</li>
          <li>In Project Omen Settings &rarr; LLM tab:</li>
          <li className="ml-4">Enable LLM assistant</li>
          <li className="ml-4">Select <strong>Anthropic (Claude)</strong></li>
          <li className="ml-4">Paste your API key</li>
          <li className="ml-4">Recommended model: <code className="px-1 py-0.5 rounded theme-bg-secondary">claude-3-haiku-20240307</code></li>
        </ol>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Ollama Setup (Free, Local)</h4>
        <ol className="list-decimal list-inside space-y-2 theme-text-secondary ml-2">
          <li>Download and install Ollama from <a href="https://ollama.ai/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">ollama.ai</a></li>
          <li>Open a terminal and run: <code className="px-1 py-0.5 rounded theme-bg-secondary">ollama pull llama2</code></li>
          <li>Keep Ollama running in the background</li>
          <li>In Project Omen Settings &rarr; LLM tab:</li>
          <li className="ml-4">Enable LLM assistant</li>
          <li className="ml-4">Select <strong>Ollama (Local)</strong></li>
          <li className="ml-4">Leave endpoint as default or set to <code className="px-1 py-0.5 rounded theme-bg-secondary">http://localhost:11434</code></li>
          <li className="ml-4">Set model to <code className="px-1 py-0.5 rounded theme-bg-secondary">llama2</code> (or another model you've pulled)</li>
        </ol>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Settings Explained</h4>
        <ul className="list-disc list-inside space-y-1 theme-text-secondary ml-2">
          <li><strong>Temperature</strong> - Higher = more creative, lower = more precise (0.7 is a good default)</li>
        </ul>
      </div>
    </div>
  );
}
