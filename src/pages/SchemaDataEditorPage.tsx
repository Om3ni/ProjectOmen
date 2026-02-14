import { useCallback, useEffect, useMemo, useState } from 'react';

import type { RprCategory, SchemaData } from '@/models/schema';
import { useEditorState } from '@/hooks/useEditorState';
import RecordEditor from '@/components/RecordEditor';
import ParentWithChildrenEditor from '@/components/ParentWithChildrenEditor';
import TopMenuBar from '@/components/TopMenuBar';
import CategoryTabs from '@/components/CategoryTabs';
import RecordListSidebar from '@/components/RecordListSidebar';
import RawModal from '@/components/RawModal';
import FormulaEditorModal from '@/components/FormulaEditorModal';
import { getElectron } from '@/types/electron';
import CharacterSheetModal from '@/components/CharacterSheetModal';
import type { PersistedCharacterSheetStateV1 } from '@/components/CharacterSheetModal';
import HelpPanel from '@/components/HelpPanel';
import { SettingsModal } from '@/components/SettingsModal';
import { SetupGuideModal } from '@/components/SetupGuideModal';
import { ChatPanel } from '@/components/chat';
import { PanelShell } from '@/components/panels';
import { usePanelManager } from '@/hooks/usePanelManager';
import { RecentChangesPanel } from '@/components/OllamaPreviewPanel';
import { useRecentChanges, type RecentChange } from '@/contexts/PendingChangesContext';

import { AttributesLayout, DiceSystemLayout, SkillsLayout, StatsLayout } from '@/layouts';
import { getAdapter } from '@/services/PlatformAdapter';
import { exportSchemaDataToRprText } from '@/utils/rprText';
import { isElectron } from '@/types/electron';
import { SettingsService } from '@/services/SettingsService';

export default function SchemaDataEditorPage() {
  const state = useEditorState();
  const { schema, data } = state;
  const { addChange } = useRecentChanges();

  const isDesktop = useMemo(() => isElectron(), []);

  const [allowIdEdit, setAllowIdEdit] = useState(false);

  const [rawOpen, setRawOpen] = useState(false);
  const [rawInitialMode, setRawInitialMode] = useState<'all' | 'selection'>('selection');
  const [rawInitialCategory, setRawInitialCategory] = useState<RprCategory>('Attributes');
  const [rawInitialText, setRawInitialText] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetPoppedOut, setSheetPoppedOut] = useState(false);
  const [sheetPersistedState, setSheetPersistedState] = useState<PersistedCharacterSheetStateV1 | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formulaCalcOpen, setFormulaCalcOpen] = useState(false);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);
  const [panelState, panelActions] = usePanelManager({ chat: { mode: 'hidden' } });
  const chatPanel = panelState.chat;
  const [wipUnlocked, setWipUnlocked] = useState(() => SettingsService.isWipUnlocked());

  // Handle undo for recent changes
  const handleUndo = useCallback((change: RecentChange) => {
    if (!data) return;

    const { type, table, data: recordData, previousData } = change;

    switch (type) {
      case 'create': {
        // Remove the created record from the table
        const tableRecords = data[table] || [];
        const filteredRecords = tableRecords.filter((r: any) => r.ID !== recordData.ID);
        state.setTableRows(table, filteredRecords);
        console.log(`[Undo] Removed created record ${recordData.ID} from ${table}`);
        break;
      }

      case 'update': {
        // Restore previous values
        if (!previousData) {
          console.error('[Undo] No previous data for update operation');
          return;
        }
        const tableRecords = data[table] || [];
        const updatedRecords = tableRecords.map((r: any) =>
          r.ID === recordData.ID ? { ...r, ...previousData } : r
        );
        state.setTableRows(table, updatedRecords);
        console.log(`[Undo] Restored previous values for ${recordData.ID} in ${table}`);
        break;
      }

      case 'delete': {
        // Re-add the deleted record
        if (!previousData) {
          console.error('[Undo] No previous data for delete operation');
          return;
        }
        const tableRecords = data[table] || [];
        const restoredRecords = [...tableRecords, previousData];
        state.setTableRows(table, restoredRecords);
        console.log(`[Undo] Restored deleted record ${previousData.ID} to ${table}`);
        break;
      }
    }
  }, [data, state]);

  const RPR_CHAR_LIMIT = 400_000;
  const [rprCharCount, setRprCharCount] = useState(0);

  // Debounced: exporting can be moderately expensive on every keystroke.
  useEffect(() => {
    if (!schema || !data) {
      setRprCharCount(0);
      return;
    }

    const handle = window.setTimeout(() => {
      try {
        const text = exportSchemaDataToRprText(schema, data);
        setRprCharCount(text.length);
      } catch {
        // ignore export errors; size meter is best-effort
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [schema, data]);

  const rprRatio = useMemo(() => {
    if (RPR_CHAR_LIMIT <= 0) return 0;
    return Math.max(0, rprCharCount / RPR_CHAR_LIMIT);
  }, [rprCharCount]);

  const rprPercent = useMemo(() => Math.min(100, Math.round(rprRatio * 100)), [rprRatio]);
  const rprWarn = rprRatio >= 0.95;
  const rprOver = rprRatio >= 1;

  // Open Raw editor - in Electron opens a separate window, in browser opens modal
  const openRawForCategory = useCallback(async (cat: RprCategory) => {
    const text = state.exportSelectionToRaw(cat);
    if (isDesktop) {
      try {
        const { getElectron } = await import('@/types/electron');
        const electron = getElectron();
        await electron?.rawWindow?.open?.({
          mode: 'selection',
          category: cat,
          initialText: text,
        });
      } catch {
        // Fallback to modal
        setRawInitialMode('selection');
        setRawInitialCategory(cat);
        setRawInitialText(text);
        setRawOpen(true);
      }
    } else {
      setRawInitialMode('selection');
      setRawInitialCategory(cat);
      setRawInitialText(text);
      setRawOpen(true);
    }
  }, [state, isDesktop]);

  const openRawAll = useCallback(async () => {
    const text = state.exportAllToRaw();
    if (isDesktop) {
      try {
        const { getElectron } = await import('@/types/electron');
        const electron = getElectron();
        await electron?.rawWindow?.open?.({
          mode: 'all',
          category: 'Attributes' as RprCategory,
          initialText: text,
        });
      } catch {
        // Fallback to modal
        setRawInitialMode('all');
        setRawInitialText(text);
        setRawOpen(true);
      }
    } else {
      setRawInitialMode('all');
      setRawInitialText(text);
      setRawOpen(true);
    }
  }, [state, isDesktop]);

  const {
    schemaVersion,
    tooltips,
    error,
    activeCategory,
    selectedIndex,
    fileInputRef,
    categories,
    activeView,
    tableSchema,
    filteredRows,
    selected,
    selectedLabel,
    hasEmbeddedChildren,
    setError,
    setActiveCategory,
    setSelectedIndex,
    updateSelectedRecord,
    setTableRows,
    reorderFilteredRows,
    addRecord,
    cloneSelectedRecord,
    deleteSelected,
    newFile,
    requestLoadFile,
    onLoadFileSelected,
    exportSelectionToRaw,
    exportAllToRaw,
    applyRawToSelection,
    applyRawToAll,
  } = state;

  const exportSchemaDataJson = useCallback(async () => {
    if (!schema || !data) return;
    const rprText = exportSchemaDataToRprText(schema, data);
    await getAdapter().writeFile('schema-data.txt', rprText + '\n', 'text/plain');
  }, [schema, data]);

  // Desktop: keep Character Sheet window live-updated with current data.
  useEffect(() => {
    if (!isDesktop) return;
    if (!data) return;

    const electron = getElectron();
    if (!electron?.send) return;

    const handle = window.setTimeout(() => {
      try {
        const settings = SettingsService.load();
        electron?.send?.('sheet:update', { data, settings });
      } catch {
        // ignore
      }
    }, 150);

    return () => {
      window.clearTimeout(handle);
    };
  }, [isDesktop, data]);

  // Desktop: also push settings updates to the Character Sheet window.
  useEffect(() => {
    if (!isDesktop) return;
    if (!data) return;

    const electron = getElectron();
    if (!electron?.send) return;

    const onSettingsChanged = () => {
      try {
        const settings = SettingsService.load();
        electron?.send?.('sheet:update', { data, settings });
      } catch {
        // ignore
      }
    };

    window.addEventListener('project-omen:settings-changed', onSettingsChanged as EventListener);
    window.addEventListener('storage', onSettingsChanged);

    return () => {
      window.removeEventListener('project-omen:settings-changed', onSettingsChanged as EventListener);
      window.removeEventListener('storage', onSettingsChanged);
    };
  }, [isDesktop, data]);

  // Desktop: respond to native menu actions.
  useEffect(() => {
    if (!isDesktop) return;
    const electron = getElectron();
    const unsub = electron?.menu?.onCommand?.(async (data: unknown) => {
      const payload = data as { command?: string };
      const command = String(payload?.command ?? '');
      try {
        if (command === 'file:new') {
          newFile();
          return;
        }
        if (command === 'file:open') {
          // Prefer native open dialog on desktop.
          const picked = await getAdapter().pickFile('application/json,text/plain,.json,.txt,.rpr');
          if (!picked) return;

          // Reuse existing parsing logic by faking a File.
          // We pass through the same JSON/.rpr detection rules via a tiny shim.
          const fake = new File([picked.content], picked.name, { type: 'text/plain' });
          onLoadFileSelected(fake);
          return;
        }
        if (command === 'file:save') {
          await exportSchemaDataJson();
          return;
        }
        if (command === 'tools:raw:all') {
          openRawAll();
          return;
        }
        if (command === 'tools:raw:category') {
          openRawForCategory(activeCategory);
          return;
        }
        if (command === 'tools:sheet') {
          if (isDesktop && data) {
            try {
              const { getElectron } = await import('@/types/electron');
              const electron = getElectron();
              const settings = SettingsService.load();
              const result = await electron?.sheetWindow?.open?.({ data, settings }) as { success: boolean; reused?: boolean } | undefined;
              console.log('[SchemaDataEditorPage] sheetWindow.open result:', result);
              if (result?.success) {
                setSheetPoppedOut(true);
                return;
              }
              console.warn('[SchemaDataEditorPage] sheetWindow.open failed, falling back to modal');
            } catch (err) {
              console.error('[SchemaDataEditorPage] sheetWindow.open error:', err);
              // fallback to modal
            }
          }
          setSheetOpen(true);
          return;
        }
        if (command === 'tools:formula') {
          setFormulaCalcOpen(true);
          return;
        }
        if (command === 'help:about') {
          setAboutOpen(true);
          return;
        }
        if (command === 'help:setup') {
          setSetupGuideOpen(true);
          return;
        }
        if (command === 'file:settings') {
          setSettingsOpen(true);
          return;
        }
        if (command === 'tools:chat') {
          panelActions.toggle('chat');
          return;
        }
        if (command === 'tools:discord-backup') {
          // Backup current data to Discord
          const settings = SettingsService.load();
          if (!settings.discord.enabled || !settings.discord.webhookUrl) {
            setError('Discord is not configured. Go to Settings → Discord to set up your webhook.');
            return;
          }
          if (!schema || !data || Object.keys(data).length === 0) {
            setError('No data to backup.');
            return;
          }
          try {
            const rprText = exportSchemaDataToRprText(schema, data as SchemaData);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `project-omen-backup-${timestamp}.txt`;

            // Count records for the message
            const recordCount = Object.values(data).reduce(
              (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
              0
            );

            const result = await SettingsService.uploadToDiscord(
              settings.discord.webhookUrl,
              filename,
              rprText,
              `📦 **Project Omen Backup** - ${recordCount} records`,
              settings.discord.username || 'Project Omen'
            );

            if (!result.success) {
              setError(`Backup failed: ${result.error}`);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      try {
        unsub?.();
      } catch {
        // ignore
      }
    };
  }, [
    isDesktop,
    activeCategory,
    data,
    schema,
    schemaVersion,
    tooltips,
    newFile,
    onLoadFileSelected,
    openRawAll,
    openRawForCategory,
    exportSchemaDataJson,
    setError,
  ]);

  // Desktop: keep the character sheet child window in sync with the latest schema data.
  // Otherwise, the sheet window only receives a one-time init payload, and edits won't
  // reflect until the user reopens the sheet or re-imports exported data.
  useEffect(() => {
    if (!isDesktop) return;
    if (!sheetPoppedOut) return;
    if (!data) return;

    const electron = getElectron();
    if (!electron?.sheetWindow?.update) return;

    const handle = window.setTimeout(() => {
      try {
        electron.sheetWindow?.update?.({ data });
      } catch {
        // ignore
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [isDesktop, sheetPoppedOut, data]);

  // Listen for raw editor apply results from child window
  useEffect(() => {
    if (!isDesktop) return;
    const electron = getElectron();
    const unsub = electron?.rawWindow?.onApplied?.((data: unknown) => {
      const payload = data as { type?: string; text?: string; category?: RprCategory };
      try {
        const type = String(payload?.type ?? '');
        const text = String(payload?.text ?? '');
        if (type === 'selection') {
          const category = (payload?.category as RprCategory) ?? 'Attributes';
          applyRawToSelection(text, category);
        } else if (type === 'all') {
          applyRawToAll(text);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      try {
        unsub?.();
      } catch {
        // ignore
      }
    };
  }, [isDesktop, applyRawToSelection, applyRawToAll, setError]);

  // Global hotkey: Ctrl+Delete deletes the selected record regardless of focus.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const key = String(e.key ?? '');
      if (!e.ctrlKey) return;
      if (key !== 'Delete') return;
      if (e.repeat) return;
      if (!selected) return;

      e.preventDefault();
      e.stopPropagation();
      deleteSelected();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [deleteSelected, selected]);

  return (
    <div className="h-full overflow-hidden theme-bg-base theme-text flex">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 pb-10">
      {!isDesktop ? (
        <TopMenuBar
        schema={schema}
        data={data}
        schemaVersion={schemaVersion}
        tooltips={tooltips}
        activeTable={activeView.table}
        filteredRowsCount={filteredRows.length}
        fileInputRef={fileInputRef}
        onNewFile={newFile}
        onLoadFile={requestLoadFile}
        onLoadFileSelected={onLoadFileSelected}
        onOpenCharacterSheet={() => setSheetOpen(true)}
        onOpenFormulaCalculator={() => setFormulaCalcOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleChat={() => panelActions.toggle('chat')}
        chatOpen={chatPanel.mode !== 'hidden'}
        onError={setError}
        wipUnlocked={wipUnlocked}
        />
      ) : null}

      <div className="flex-shrink-0 theme-bg-base px-4 pt-4">
        <div className={isDesktop ? 'w-full' : 'mx-auto max-w-[1560px] w-full'}>
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            columnCount={tableSchema?.columns?.length ?? 0}
            tableCount={schema ? Object.keys(schema.tables ?? {}).length : 0}
            onImportExport={openRawAll}
            onImportExportCategory={() => openRawForCategory(activeCategory)}
          />
        </div>
      </div>

      <div className={isDesktop ? 'flex-1 min-h-0 flex flex-col w-full px-4 pb-4' : 'flex-1 min-h-0 flex flex-col mx-auto max-w-[1560px] w-full px-4 pb-4'}>
        {/* Dice System tab - special full-width settings layout */}
        {activeCategory === 'Dice System' ? (
          schema && data ? (
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border theme-border theme-bg-muted">
              <DiceSystemLayout
                data={data}
                onChange={(tableName, record) => {
                  // For single-record tables like DiceConfig/DiceRules/Gear, replace the entire array
                  setTableRows(tableName, [record]);
                }}
              />
            </div>
          ) : (
            <div className="p-4 text-sm theme-text-secondary">Loading schema…</div>
          )
        ) : (
          /* Standard record list + editor layout */
          <>
            <div className="flex-shrink-0 mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addRecord}
                className="rounded-md theme-bg-accent px-3 py-2 text-sm font-medium theme-text-accent-on hover:theme-bg-accent-hover"
                disabled={!schema || !data || !tableSchema}
              >
                Add
              </button>
              <button
                type="button"
                onClick={cloneSelectedRecord}
                className="rounded-md border theme-border theme-bg-input px-3 py-2 text-sm theme-text-secondary hover:theme-bg-surface"
                disabled={!schema || !data || !tableSchema || !selected}
                title={!selected ? 'Select a record to clone' : 'Clone selected record'}
              >
                Clone
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="rounded-md border theme-border-danger theme-bg-danger px-3 py-2 text-sm theme-text-danger hover:theme-bg-danger-hover"
                disabled={!selected}
              >
                Delete
              </button>
            </div>

            <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[320px_1fr_280px]">
              <RecordListSidebar
                rows={filteredRows}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                onDeleteSelected={deleteSelected}
                title={String(activeCategory)}
                enableFilter={true}
                filterPlaceholder={`Search ${String(activeCategory).toLowerCase()}…`}
                onReorder={reorderFilteredRows}
              />

              <main className="rounded-lg border theme-border theme-bg-muted overflow-auto">
                {error ? (
                  <div className="p-4">
                    <div className="rounded-md border theme-border-danger theme-bg-danger p-3 text-sm theme-text-danger">
                      {error}
                    </div>
                    <p className="mt-2 text-xs theme-text-muted">
                      Ensure the dev server can fetch <code className="theme-text-secondary">/schema-structure.json</code>{' '}
                      and <code className="theme-text-secondary">/schema-data.json</code> from <code className="theme-text-secondary">public/</code>.
                    </p>
                  </div>
                ) : schema && data ? (
                  <div className="p-4">
                    <div className="mb-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          className={
                            allowIdEdit
                              ? 'rounded-md border border-amber-600/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-950/50'
                              : 'rounded-md border theme-border theme-bg-input px-3 py-1.5 text-xs theme-text-secondary hover:theme-bg-surface'
                          }
                          onClick={() => {
                            if (allowIdEdit) {
                              setAllowIdEdit(false);
                              return;
                            }
                            const ok = window.confirm(
                              'Unlock ID editing? Changing IDs can break references between tables.',
                            );
                            if (ok) setAllowIdEdit(true);
                          }}
                        >
                          {allowIdEdit ? 'Lock ID fields' : 'Unlock ID editing'}
                        </button>
                      </div>
                      <div className="text-xs theme-text-muted">
                        {selected ? (
                          <>
                            {selectedLabel}
                            {selected.ID !== undefined && selected.ID !== null && String(selected.ID).trim() !== '' ? (
                              <> · {String(selected.ID)}</>
                            ) : allowIdEdit && selected['Node ID'] !== undefined && selected['Node ID'] !== null ? (
                              <> · {String(selected['Node ID'])}</>
                            ) : null}
                          </>
                        ) : (
                          'No record selected'
                        )}
                      </div>
                    </div>

                    {tableSchema && selected ? (
                      hasEmbeddedChildren ? (
                        <ParentWithChildrenEditor
                          key={`${activeView.table}:${selected.ID ?? selectedIndex}`}
                          category={String(activeCategory)}
                          schema={schema}
                          data={data}
                          tableName={activeView.table}
                          tableSchema={tableSchema}
                          record={selected}
                          allowIdEdit={allowIdEdit}
                          onChangeRecord={updateSelectedRecord}
                          onSetTableRows={setTableRows}
                        />
                      ) : activeView.table === 'SkillDef' && activeCategory === 'Skills' ? (
                        <SkillsLayout
                          tableSchema={tableSchema}
                          record={selected}
                          allData={data}
                          onChange={updateSelectedRecord}
                        />
                      ) : activeView.table === 'SkillDef' && activeCategory === 'Attributes' ? (
                        <AttributesLayout
                          tableSchema={tableSchema}
                          record={selected}
                          allData={data}
                          onChange={updateSelectedRecord}
                          allowIdEdit={allowIdEdit}
                        />
                      ) : activeView.table === 'Stat' && activeCategory === 'Stats' ? (
                        <StatsLayout
                          key={`${activeView.table}:${selected.ID ?? selectedIndex}`}
                          tableSchema={tableSchema}
                          record={selected}
                          allData={data}
                          onChange={updateSelectedRecord}
                        />
                      ) : (
                        <RecordEditor
                          tableName={activeView.table}
                          tableSchema={tableSchema}
                          record={selected}
                          onChange={updateSelectedRecord}
                          tabName={String(activeCategory)}
                          allowIdEdit={allowIdEdit}
                        />
                      )
                    ) : (
                      <div className="text-sm theme-text-muted">No schema/record available for this view.</div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-sm theme-text-secondary">Loading schema…</div>
                )}
              </main>

              <HelpPanel category={activeCategory} />
            </div>
          </>
        )}
      </div>
      </div>

      {/* Chat Panel */}
      <PanelShell
        title="Chat"
        mode={chatPanel.mode}
        onPopout={() => panelActions.popout('chat')}
        onHide={() => panelActions.hide('chat')}
      >
        <ChatPanel
          className="flex-1 min-h-0"
          editorState={state}
          recentChangesHandler={addChange}
        />
      </PanelShell>

      {formulaCalcOpen && (
        <FormulaEditorModal
          label="Formula Calculator"
          value=""
          onApply={() => {}}
          onClose={() => setFormulaCalcOpen(false)}
        />
      )}

      {rawOpen && schema && data ? (
        <RawModal
          mode={rawInitialMode}
          category={rawInitialCategory}
          initialText={rawInitialText}
          onApplySelection={applyRawToSelection}
          onApplyAll={applyRawToAll}
          onExportSelection={exportSelectionToRaw}
          onExportAll={exportAllToRaw}
          onClose={() => setRawOpen(false)}
        />
      ) : null}

      {sheetOpen && data ? (
        <CharacterSheetModal
          data={data}
          onClose={() => setSheetOpen(false)}
          persistedState={sheetPersistedState}
          onPersistedStateChange={setSheetPersistedState}
        />
      ) : null}

      {aboutOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="rounded-lg border theme-border theme-bg-base p-6 shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold theme-text mb-4">About Project Omen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="theme-text-secondary">Schema:</span>
                <span className="theme-text font-mono">{schemaVersion || 'Not loaded'}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-md theme-bg-accent px-4 py-2 text-sm font-medium theme-text-accent-on hover:theme-bg-accent-hover"
                onClick={() => setAboutOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          onClose={() => {
            setSettingsOpen(false);
            // Refresh wipUnlocked state in case it changed
            const nowUnlocked = SettingsService.isWipUnlocked();
            setWipUnlocked(nowUnlocked);
            // Close chat if WIP was locked
            if (!nowUnlocked && chatPanel.mode !== 'hidden') {
              panelActions.hide('chat');
            }
          }}
          wipPasswordHash={schema?.wipPassword}
        />
      ) : null}

      {setupGuideOpen ? (
        <SetupGuideModal
          onClose={() => setSetupGuideOpen(false)}
          onOpenSettings={() => {
            setSetupGuideOpen(false);
            setSettingsOpen(true);
          }}
        />
      ) : null}

      {/* RPR size meter */}
      {schema && data ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t theme-border theme-bg-base">
          <div className="px-4 py-2 flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 w-full rounded theme-bg-muted overflow-hidden">
                <div
                  className={
                    rprOver
                      ? 'h-full bg-rose-600'
                      : rprWarn
                        ? 'h-full bg-amber-500'
                        : 'h-full bg-[var(--accent-primary)]'
                  }
                  style={{ width: `${Math.min(100, Math.max(0, rprPercent))}%` }}
                />
              </div>
            </div>

            <div className="text-xs whitespace-nowrap theme-text-secondary">
              RPR size: <span className="font-mono theme-text">{rprCharCount.toLocaleString()}</span> /{' '}
              <span className="font-mono">{RPR_CHAR_LIMIT.toLocaleString()}</span> ({rprPercent}%)
            </div>

            {rprWarn ? (
              <div
                className={
                  rprOver
                    ? 'text-xs font-semibold text-rose-300 whitespace-nowrap'
                    : 'text-xs font-semibold text-amber-300 whitespace-nowrap'
                }
                title="RPR has a 400,000 character save limit. Consider baking into a mod if you exceed it."
              >
                {rprOver
                  ? 'Over limit: RPR save will be rejected'
                  : 'Warning: near 400k — may need mod'}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Recent Changes Panel */}
      <RecentChangesPanel onUndo={handleUndo} />
    </div>
  );
}
