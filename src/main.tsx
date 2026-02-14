import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/hooks/useTheme'
import { ChatProvider } from '@/hooks/useChatState'
import { RecentChangesProvider } from '@/contexts/PendingChangesContext'

// Initialize platform adapter before rendering
import { setAdapter } from '@/services/PlatformAdapter'
import { BrowserAdapter } from '@/services/BrowserAdapter'
import { ElectronAdapter } from '@/services/ElectronAdapter'
import { isElectron as checkElectron } from '@/types/electron'

// Prefer Electron adapter when running in the desktop shell.
const isElectron = checkElectron()
setAdapter(isElectron ? new ElectronAdapter() : new BrowserAdapter())

// Pre-warm Ollama model into VRAM at startup (if enabled).
// This way the model is loaded and ready before the user opens chat.
import { SettingsService } from '@/services/SettingsService'
import { prewarmOllamaModel } from '@/ollama/utils/ollamaClient'

const settings = SettingsService.load()
if (settings.ollama.enabled && settings.ollama.model) {
  const endpoint = settings.ollama.useBundled
    ? 'http://127.0.0.1:11435'
    : settings.ollama.endpoint
  prewarmOllamaModel(endpoint, settings.ollama.model)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ChatProvider>
        <RecentChangesProvider>
          <App />
        </RecentChangesProvider>
      </ChatProvider>
    </ThemeProvider>
  </StrictMode>,
)
