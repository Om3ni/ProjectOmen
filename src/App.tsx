import { useEffect, useMemo, useState } from 'react';

import DebugOverlay, { type DebugError } from '@/components/DebugOverlay';
import ErrorBoundary from '@/components/ErrorBoundary';
import SchemaDataEditorPage from '@/pages/SchemaDataEditorPage';
import RawEditorPage from '@/pages/RawEditorPage';
import CharacterSheetPage from '@/pages/CharacterSheetPage';
import RawEditorHarness from '@/pages/RawEditorHarness';
import ChatPage from '@/pages/ChatPage';
import { installGlobalErrorTrap } from '@/utils/debugTrap';

function App() {
  const [debugError, setDebugError] = useState<DebugError | null>(null);

  // Check if this window was opened as a raw-editor child window
  const isRawEditorWindow = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('raw-editor');
    } catch {
      return false;
    }
  }, []);

  const isCharacterSheetWindow = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('sheet');
    } catch {
      return false;
    }
  }, []);

  const isHarnessWindow = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('harness') === 'raw';
    } catch {
      return false;
    }
  }, []);

  const isChatWindow = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('chat');
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    installGlobalErrorTrap((err) => {
      setDebugError(err);
    });
  }, []);

  const renderPage = () => {
    if (isRawEditorWindow) return <RawEditorPage />;
    if (isCharacterSheetWindow) return <CharacterSheetPage />;
    if (isHarnessWindow) return <RawEditorHarness />;
    if (isChatWindow) return <ChatPage />;
    return <SchemaDataEditorPage />;
  };

  return (
    <div className="relative h-full">
      <ErrorBoundary onError={setDebugError}>
        {renderPage()}
      </ErrorBoundary>
      <DebugOverlay error={debugError} onClose={() => setDebugError(null)} />
    </div>
  );
}

export default App
