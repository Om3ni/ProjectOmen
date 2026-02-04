import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/hooks/useTheme'
import { ChatProvider } from '@/hooks/useChatState'

// Initialize platform adapter before rendering
import { setAdapter } from '@/services/PlatformAdapter'
import { BrowserAdapter } from '@/services/BrowserAdapter'
import { ElectronAdapter } from '@/services/ElectronAdapter'
import { isElectron as checkElectron } from '@/types/electron'

// Prefer Electron adapter when running in the desktop shell.
const isElectron = checkElectron()
setAdapter(isElectron ? new ElectronAdapter() : new BrowserAdapter())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ChatProvider>
        <App />
      </ChatProvider>
    </ThemeProvider>
  </StrictMode>,
)
