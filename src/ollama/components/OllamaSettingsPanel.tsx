import { useState, useEffect, useCallback } from 'react';
import type { OllamaSettings, OllamaFreedomLevel } from '../types';
import type { ElectronWindow, OllamaLocalStatus, OllamaLocalModel, OllamaPullProgress } from '../../types/electron';
import { getOllamaClient, type OllamaModelInfo } from '../utils/ollamaClient';

export interface OllamaSettingsPanelProps {
  settings: OllamaSettings;
  onUpdate: (updates: Partial<OllamaSettings>) => void;
}

function getElectronOllama() {
  if (typeof window === 'undefined') return undefined;
  return (window as ElectronWindow).electron?.ollamaLocal;
}

export function OllamaSettingsPanel({ settings, onUpdate }: OllamaSettingsPanelProps) {
  const [localStatus, setLocalStatus] = useState<OllamaLocalStatus | null>(null);
  const [localModels, setLocalModels] = useState<OllamaLocalModel[]>([]);
  const [pullModelName, setPullModelName] = useState('');
  const [pullProgress, setPullProgress] = useState<OllamaPullProgress | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState('');
  const [modelsDir, setModelsDir] = useState('');
  const [modelInfoCache, setModelInfoCache] = useState<Record<string, OllamaModelInfo>>({});

  const ollamaLocal = getElectronOllama();

  const refreshStatus = useCallback(async () => {
    if (!ollamaLocal) return;
    try {
      const status = await ollamaLocal.getStatus();
      console.log('[Ollama] Status:', status);
      setLocalStatus(status);
    } catch (e) {
      console.error('[Ollama] Failed to get status:', e);
      setLocalStatus(null);
    }
  }, [ollamaLocal]);

  const refreshModels = useCallback(async () => {
    if (!ollamaLocal) return;
    try {
      const result = await ollamaLocal.listModels();
      if (result.success) {
        console.log('[Ollama] Models:', result.models.length, 'found');
        setLocalModels(result.models);
      } else {
        console.error('[Ollama] List models failed:', result.error);
      }
    } catch (e) {
      console.error('[Ollama] List models exception:', e);
    }
  }, [ollamaLocal]);

  const refreshModelsDir = useCallback(async () => {
    if (!ollamaLocal) return;
    try {
      const result = await ollamaLocal.getModelsDir();
      console.log('[Ollama] Models directory:', result.path);
      setModelsDir(result.path);
    } catch (e) {
      console.error('[Ollama] Failed to get models dir:', e);
    }
  }, [ollamaLocal]);

  // Fetch detailed info (context window, etc.) for installed models
  const fetchModelDetails = useCallback(async (models: OllamaLocalModel[]) => {
    const endpoint = settings.useBundled ? 'http://127.0.0.1:11435' : settings.endpoint;
    const client = getOllamaClient(endpoint);
    const cache: Record<string, OllamaModelInfo> = {};

    for (const model of models) {
      try {
        const info = await client.showModel(model.name);
        if (info) cache[model.name] = info;
      } catch {
        // skip failures
      }
    }
    setModelInfoCache(cache);
  }, [settings.useBundled, settings.endpoint]);

  useEffect(() => {
    refreshStatus();
    refreshModels();
    refreshModelsDir();
  }, [refreshStatus, refreshModels, refreshModelsDir]);

  // Fetch model details when models list changes
  useEffect(() => {
    if (localModels.length > 0) {
      fetchModelDetails(localModels);
    }
  }, [localModels, fetchModelDetails]);

  // Listen for pull progress events
  useEffect(() => {
    if (!ollamaLocal) return;
    const cleanup = ollamaLocal.onPullProgress((progress: OllamaPullProgress) => {
      console.log('[Ollama] Download progress:', progress.status, 
        progress.total ? `${(progress.completed / progress.total * 100).toFixed(1)}%` : '');
      setPullProgress(progress);
      if (progress.done) {
        console.log('[Ollama] Download complete');
        setIsPulling(false);
        setPullProgress(null);
        refreshModels();
      }
    });
    return cleanup;
  }, [ollamaLocal, refreshModels]);

  const handlePullModel = async (modelName?: string) => {
    const name = modelName || pullModelName.trim();
    if (!ollamaLocal || !name) return;
    
    console.log('[Ollama] Starting model download:', name);
    setError('');
    setIsPulling(true);
    setPullModelName(name);
    setPullProgress({ model: name, status: 'Starting download...', total: 0, completed: 0, done: false });
    
    try {
      const result = await ollamaLocal.pullModel(name);
      console.log('[Ollama] Pull model result:', result);
      
      if (!result.success) {
        const errorMsg = result.error || 'Failed to pull model';
        console.error('[Ollama] Model download failed:', errorMsg);
        setError(errorMsg);
        setIsPulling(false);
        setPullProgress(null);
      } else {
        console.log('[Ollama] Model downloaded successfully:', name);
        setPullModelName('');
        refreshModels();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[Ollama] Model download exception:', errorMsg, e);
      setError(errorMsg);
      setIsPulling(false);
      setPullProgress(null);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!ollamaLocal) return;
    console.log('[Ollama] Deleting model:', modelName);
    try {
      const result = await ollamaLocal.deleteModel(modelName);
      if (!result.success) {
        console.error('[Ollama] Delete failed:', result.error);
        setError(result.error || 'Failed to delete model');
      } else {
        console.log('[Ollama] Model deleted successfully');
        refreshModels();
      }
    } catch (e) {
      console.error('[Ollama] Delete exception:', e);
      setError(e instanceof Error ? e.message : 'Failed to delete model');
    }
  };

  const handleBrowseModelsDir = async () => {
    if (!ollamaLocal) return;
    console.log('[Ollama] Browsing for models directory...');
    const result = await ollamaLocal.browseModelsDir();
    if (!result.canceled && result.path) {
      console.log('[Ollama] New models directory selected:', result.path);
      
      // Warn if they selected a very generic directory
      const pathLower = result.path.toLowerCase();
      const isRootLike = pathLower.match(/^[a-z]:\\?$/i) || 
                         pathLower.endsWith('\\omen') || 
                         pathLower.endsWith('\\users') ||
                         pathLower.endsWith('\\program files');
      
      if (isRootLike) {
        setError('Warning: Selected directory is very broad. Ollama will create many subdirectories (manifests, blobs, etc.). Consider creating a dedicated subfolder like "ollama-models" or "ai-models".');
      } else {
        setError('');
      }
      
      setModelsDir(result.path);
      // Note: Ollama server restart happens automatically in the backend
      // Wait a moment for restart to complete before refreshing
      setTimeout(async () => {
        await refreshStatus();
        await refreshModels();
      }, 5000);
    } else if (result.error) {
      console.error('[Ollama] Browse failed:', result.error);
      setError(result.error);
    }
  };

  const handleStartOllama = async () => {
    if (!ollamaLocal) return;
    console.log('[Ollama] Starting Ollama server...');
    try {
      const result = await ollamaLocal.start();
      console.log('[Ollama] Start result:', result);
      await refreshStatus();
      await refreshModels();
    } catch (e) {
      console.error('[Ollama] Failed to start:', e);
      setError('Failed to start Ollama server');
    }
  };

  const canUseLocalServer = !!ollamaLocal && !!localStatus?.available;
  const canDownloadModels = canUseLocalServer && !!localStatus?.running;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Curated list of models ranked by chat quality for Sigil.
  // Grouped: Recommended → Good → Lightweight. VRAM = approximate GPU memory needed.
  const availableModels = [
    // --- Recommended for Sigil (strong chat & reasoning) ---
    { name: 'qwen2.5:7b', size: '4.7 GB', vram: '~6 GB', description: '⭐ Recommended — Strong reasoning, great for RPR guidance' },
    { name: 'mistral', size: '4.1 GB', vram: '~6 GB', description: '⭐ Recommended — Fast responses, good instruction following' },
    { name: 'llama3.1:8b', size: '4.7 GB', vram: '~6 GB', description: '⭐ Recommended — Strong all-around chat quality' },
    // --- Upgrade picks (need more VRAM) ---
    { name: 'qwen2.5:14b', size: '9.0 GB', vram: '~12 GB', description: '🔥 Best quality — Superior reasoning (needs 12GB VRAM)' },
    { name: 'qwen2.5:32b', size: '19 GB', vram: '~24 GB', description: '🔥 Top tier — Near-GPT-4 quality (needs 24GB VRAM)' },
    { name: 'mistral-small', size: '14 GB', vram: '~16 GB', description: 'Excellent instruction following (needs 16GB VRAM)' },
    // --- Good alternatives ---
    { name: 'llama3.2', size: '2.0 GB', vram: '~4 GB', description: '✓ Good — Fast, decent chat quality' },
    { name: 'gemma2:9b', size: '5.5 GB', vram: '~8 GB', description: '✓ Good — Strong reasoning, detailed responses' },
    { name: 'command-r', size: '4.1 GB', vram: '~6 GB', description: '✓ Good — Built for conversational use and RAG' },
    // --- Lightweight (basic chat) ---
    { name: 'llama3.2:1b', size: '1.3 GB', vram: '~2 GB', description: '⚡ Fast — Very lightweight, basic responses' },
    { name: 'phi3', size: '2.3 GB', vram: '~4 GB', description: '⚡ Fast — Small but capable' },
    { name: 'gemma2:2b', size: '1.6 GB', vram: '~3 GB', description: '⚡ Fast — Compact, short responses' },
  ];

  const isModelInstalled = (name: string) =>
    localModels.some((m) => m.name === name || m.name === `${name}:latest` || m.name.startsWith(name + ':'));

  const freedomLevels: Array<{ value: OllamaFreedomLevel; label: string; description: string }> = [
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'Requires approval for all actions except reading data',
    },
    {
      value: 'balanced',
      label: 'Balanced',
      description: 'Smart approval - auto-approves safe actions, asks for significant changes',
    },
    {
      value: 'autonomous',
      label: 'Autonomous',
      description: 'Auto-approves everything - full control to AI (use cautiously)',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Sigil AI Assistant</h3>
        <p className="text-sm text-muted-foreground">
          Local AI assistance powered by Ollama.
          {ollamaLocal ? ' Ollama is bundled with this app.' : ' Requires Ollama running at the configured endpoint.'}
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">Enable Sigil</label>
          <p className="text-xs text-muted-foreground">
            Turn on AI assistance for character sheets, design help, and combat
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="w-4 h-4 cursor-pointer"
        />
      </div>

      {/* Bundled Ollama Section (Electron only) */}
      {ollamaLocal && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Bundled Ollama Server</h4>
              <p className="text-xs text-muted-foreground">
                Runs automatically with the app
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  localStatus?.running ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {localStatus?.running ? 'Running' : localStatus?.available ? 'Stopped' : 'Not available'}
              </span>
              {localStatus?.available && !localStatus?.running && (
                <button
                  onClick={handleStartOllama}
                  className="ml-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Start
                </button>
              )}
              {localStatus?.available && localStatus?.running && (
                <button
                  onClick={async () => {
                    if (!ollamaLocal) return;
                    console.log('[Ollama] Stopping server...');
                    await ollamaLocal.stop();
                    await refreshStatus();
                  }}
                  className="ml-2 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Use bundled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-medium">Use bundled server</label>
              <p className="text-xs text-muted-foreground">
                {settings.useBundled
                  ? `Endpoint: ${localStatus?.endpoint || 'http://127.0.0.1:11435'}`
                  : 'Using custom endpoint below'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.useBundled}
              onChange={(e) => onUpdate({ useBundled: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Models Storage Location */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Models Storage Location</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={modelsDir}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs font-mono text-muted-foreground truncate"
              />
              <button
                onClick={handleBrowseModelsDir}
                className="px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors whitespace-nowrap"
              >
                Browse...
              </button>
              {localStatus?.running && (
                <button
                  onClick={async () => {
                    if (!ollamaLocal) return;
                    console.log('[Ollama] Restarting to apply directory change...');
                    setError('Restarting Ollama server...');
                    await ollamaLocal.stop();
                    await new Promise((r) => setTimeout(r, 1500));
                    await ollamaLocal.start();
                    await new Promise((r) => setTimeout(r, 3000));
                    await refreshStatus();
                    await refreshModels();
                    setError('');
                  }}
                  className="px-3 py-2 text-xs bg-orange-600 hover:bg-orange-700 rounded transition-colors whitespace-nowrap"
                  title="Restart Ollama to apply directory change"
                >
                  Restart
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              AI models can be several GB. Choose a drive with enough space.
              <br />
              <strong>Recommended:</strong> Create a dedicated folder like <code className="px-1 py-0.5 rounded theme-bg-secondary">D:\ProjectOmen-Models</code>
              <br />
              <strong>Note:</strong> If downloads fail, click the orange Restart button above after changing directories.
            </p>
          </div>

          {/* Model Management */}
          {canUseLocalServer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Installed Models</h4>
                {localModels.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {localModels.length} model{localModels.length !== 1 ? 's' : ''} installed
                  </span>
                )}
              </div>

              {localModels.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No models installed. Download one below to get started.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Click <strong>Use</strong> to select which model to use for AI assistance.
                  </p>
                  <div className="space-y-1">
                    {localModels.map((model) => (
                      <div
                        key={model.name}
                        className="flex items-center justify-between px-3 py-2 bg-gray-900/50 rounded text-sm"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{model.name}</span>
                            <span className="text-xs text-muted-foreground">({formatBytes(model.size)})</span>
                          </div>
                          {modelInfoCache[model.name] && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>ctx: {modelInfoCache[model.name].contextWindow.toLocaleString()}</span>
                              <span className="opacity-50">·</span>
                              <span>{modelInfoCache[model.name].parameterSize}</span>
                              <span className="opacity-50">·</span>
                              <span>{modelInfoCache[model.name].quantization}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdate({ model: model.name })}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                              settings.model === model.name
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            }`}
                          >
                            {settings.model === model.name ? '✓ Active' : 'Use'}
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model.name)}
                            className="px-2 py-0.5 text-xs bg-red-900/50 hover:bg-red-800 text-red-300 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Download Progress (shown prominently when active) */}
              {pullProgress && (
                <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg space-y-3">
                  {/* Model name header */}
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">
                      {pullProgress.model}
                    </span>
                  </div>

                  {/* Download Progress Bar */}
                  {pullProgress.status.toLowerCase().includes('download') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-300">Downloading</span>
                        {pullProgress.total > 0 && (
                          <span className="text-xs font-mono text-blue-300">
                            {Math.round((pullProgress.completed / pullProgress.total) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
                          style={{
                            width: pullProgress.total > 0
                              ? `${Math.round((pullProgress.completed / pullProgress.total) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      {pullProgress.total > 0 && (
                        <div className="flex justify-end text-xs text-muted-foreground">
                          <span>
                            {formatBytes(pullProgress.completed)} / {formatBytes(pullProgress.total)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verify Progress Bar */}
                  {pullProgress.status.toLowerCase().includes('verifying') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-green-300">Verifying</span>
                        {pullProgress.total > 0 && (
                          <span className="text-xs font-mono text-green-300">
                            {Math.round((pullProgress.completed / pullProgress.total) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-300"
                          style={{
                            width: pullProgress.total > 0
                              ? `${Math.round((pullProgress.completed / pullProgress.total) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      {pullProgress.total > 0 && (
                        <div className="flex justify-end text-xs text-muted-foreground">
                          <span>
                            {formatBytes(pullProgress.completed)} / {formatBytes(pullProgress.total)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generic status for other phases (pulling manifest, writing, etc.) */}
                  {!pullProgress.status.toLowerCase().includes('download') && 
                   !pullProgress.status.toLowerCase().includes('verifying') && (
                    <div className="text-xs text-muted-foreground">
                      {pullProgress.status}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="text-xs text-red-400 p-3 bg-red-900/20 border border-red-800/50 rounded space-y-1">
                  {error.split('\n').map((line, i) => (
                    <p key={i} className={i === 0 ? 'font-semibold' : ''}>{line}</p>
                  ))}
                </div>
              )}

              {/* Available Models Catalog (visible even if server is stopped) */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Download Models</h4>
                <p className="text-xs text-muted-foreground">
                  Models ranked by <strong>chat quality</strong> for Sigil. Download multiple and switch between them.
                </p>

                {!localStatus?.running && (
                  <div className="text-xs text-muted-foreground p-3 bg-gray-900/30 border border-gray-700/50 rounded">
                    The bundled Ollama server is not running. Click <strong>Start</strong> above to enable downloads.
                  </div>
                )}

                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {availableModels.map((model, idx) => {
                    const installed = isModelInstalled(model.name);
                    const isDownloading = isPulling && pullModelName === model.name;
                    // Insert section headers based on description prefix patterns
                    const showRecommendedHeader = idx === 0;
                    const showUpgradeHeader = model.description.startsWith('🔥') && (idx === 0 || !availableModels[idx - 1].description.startsWith('🔥'));
                    const showGoodHeader = model.description.startsWith('✓') && (idx === 0 || !availableModels[idx - 1].description.startsWith('✓'));
                    const showLightHeader = model.description.startsWith('⚡') && (idx === 0 || !availableModels[idx - 1].description.startsWith('⚡'));
                    const sectionHeader = showRecommendedHeader ? 'Best for Sigil' : showUpgradeHeader ? 'Upgrade Picks (More VRAM)' : showGoodHeader ? 'Good Alternatives' : showLightHeader ? 'Lightweight (Basic Chat)' : null;

                    return (
                      <div key={model.name}>
                        {sectionHeader && (
                          <div className="text-[10px] font-semibold uppercase text-muted-foreground pt-2 pb-1 border-t border-gray-700/50 mt-1 first:mt-0 first:border-0">
                            {sectionHeader}
                          </div>
                        )}
                        <div
                          className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
                            isDownloading ? 'bg-blue-900/30 border border-blue-700/40' : 'bg-gray-900/50'
                          }`}
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">{model.name}</span>
                              <span className="text-xs text-muted-foreground">({model.size})</span>
                              <span className="text-[10px] text-muted-foreground opacity-60">VRAM {model.vram}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{model.description}</p>
                          </div>
                          {installed ? (
                            <span className="px-2 py-0.5 text-xs bg-green-900/50 text-green-400 rounded whitespace-nowrap">
                              Installed
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePullModel(model.name)}
                              disabled={isPulling || !canDownloadModels}
                              className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                                isDownloading
                                  ? 'bg-blue-800 text-blue-200 cursor-wait'
                                  : 'bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500'
                              }`}
                              title={!canDownloadModels ? 'Start the bundled Ollama server to download models' : undefined}
                            >
                              {isDownloading ? 'Downloading...' : canDownloadModels ? 'Download' : 'Start server'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom model input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Or download by name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pullModelName}
                    onChange={(e) => setPullModelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isPulling) handlePullModel();
                    }}
                    placeholder="e.g. llama3.2, mistral, phi3, etc."
                    disabled={isPulling}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handlePullModel()}
                    disabled={isPulling || !pullModelName.trim()}
                    className="px-4 py-2 text-sm bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded transition-colors"
                  >
                    {isPulling ? 'Downloading...' : 'Download'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Freedom Level */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Freedom Level</label>
        <div className="space-y-2">
          {freedomLevels.map((level) => (
            <label
              key={level.value}
              className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-700/30 transition-colors"
            >
              <input
                type="radio"
                name="freedomLevel"
                value={level.value}
                checked={settings.freedomLevel === level.value}
                onChange={(e) => onUpdate({ freedomLevel: e.target.value as OllamaFreedomLevel })}
                className="mt-1 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{level.label}</div>
                <div className="text-xs text-muted-foreground">{level.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Endpoint Configuration (only shown when not using bundled) */}
      {!settings.useBundled && (
        <div className="space-y-2">
          <label htmlFor="ollama-endpoint" className="text-sm font-medium">
            Ollama Endpoint
          </label>
          <input
            id="ollama-endpoint"
            type="text"
            value={settings.endpoint}
            onChange={(e) => onUpdate({ endpoint: e.target.value })}
            placeholder="http://localhost:11434"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-muted-foreground">
            Default: http://localhost:11434 (Ollama default port)
          </p>
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-2">
        <label htmlFor="ollama-model" className="text-sm font-medium">
          Model
        </label>
        {localModels.length > 0 ? (
          <>
            <select
              id="ollama-model"
              value={settings.model}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__custom__') {
                  // User chose custom, let them type
                  const customModel = prompt('Enter model name:', settings.model);
                  if (customModel) {
                    onUpdate({ model: customModel });
                  }
                } else {
                  onUpdate({ model: value });
                }
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              {localModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
              <option value="__custom__">Custom (type name)...</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Selected: {settings.model} • {localModels.length} model{localModels.length !== 1 ? 's' : ''} available
            </p>
          </>
        ) : (
          <>
            <input
              id="ollama-model"
              type="text"
              value={settings.model}
              onChange={(e) => onUpdate({ model: e.target.value })}
              placeholder="llama3.2:latest"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-muted-foreground">
              No models installed. Download one above, then select it here.
            </p>
          </>
        )}
      </div>

      {/* Temperature Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="ollama-temperature" className="text-sm font-medium">
            Temperature
          </label>
          <span className="text-sm text-muted-foreground">{settings.temperature.toFixed(1)}</span>
        </div>
        <input
          id="ollama-temperature"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Precise (0.0)</span>
          <span>Balanced (0.7)</span>
          <span>Creative (1.0)</span>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>⚡</span> Performance Tips
        </h4>
        <ul className="text-xs space-y-2 text-muted-foreground">
          <li>
            <strong>Use smaller models:</strong> llama3.2 (2GB), phi3 (2.3GB), or gemma2:2b (1.6GB) are much faster than larger models
          </li>
          <li>
            <strong>GPU acceleration:</strong> If you have an NVIDIA GPU, Ollama will use it automatically for 10-100x speedup
          </li>
          <li>
            <strong>Lower temperature:</strong> Set to 0.3-0.5 for faster, more focused responses
          </li>
          <li>
            <strong>RAM:</strong> Ensure model fits in memory (listed size + 2GB overhead)
          </li>
          <li>
            <strong>First response is slower:</strong> Model loads into memory on first use, then stays fast
          </li>
        </ul>
      </div>

      {/* Tool Calling Info */}
      <div className="p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>💬</span> What Sigil Can Do
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Sigil is your local AI advisor for RPR system design:
        </p>
        <ul className="text-xs space-y-1 text-muted-foreground">
          <li><strong>Explain:</strong> RPR concepts, table structures, formulas, design patterns</li>
          <li><strong>Brainstorm:</strong> Stat systems, ability sets, perk trees, combat balance</li>
          <li><strong>Write:</strong> Descriptions, flavor text, ability names, lore</li>
          <li><strong>Guide:</strong> How to use the editor UI to create and modify things</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Sigil runs entirely on your machine — no internet required, no data leaves your PC.
        </p>
      </div>

      {/* Chat Commands Info */}
      <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
        <h4 className="text-sm font-semibold mb-2">Available Commands</h4>
        <ul className="text-xs space-y-1 text-muted-foreground">
          <li>
            <strong>🧙 Wizard Mode:</strong> Detected automatically on empty systems - walks you through design
          </li>
          <li>
            <code className="px-1 py-0.5 bg-gray-800 rounded">/ollama [question]</code> - Ask AI for help
          </li>
          <li>
            <code className="px-1 py-0.5 bg-gray-800 rounded">/create-opponent [level] [role]</code> - Create AI
            character
          </li>
          <li>
            <code className="px-1 py-0.5 bg-gray-800 rounded">/spar [opponent-id]</code> - Start combat sparring
          </li>
          <li>
            <code className="px-1 py-0.5 bg-gray-800 rounded">/ai-turn</code> - Let AI take combat turn
          </li>
        </ul>
      </div>
    </div>
  );
}
