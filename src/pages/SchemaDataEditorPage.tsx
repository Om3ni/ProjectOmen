import { useCallback, useEffect, useMemo, useState } from 'react';

import type { RprCategory } from '@/models/schema';
import { useEditorState } from '@/hooks/useEditorState';
import RecordEditor from '@/components/RecordEditor';
import ParentWithChildrenEditor from '@/components/ParentWithChildrenEditor';
import TopMenuBar from '@/components/TopMenuBar';
import CategoryTabs from '@/components/CategoryTabs';
import RecordListSidebar from '@/components/RecordListSidebar';
import RawModal from '@/components/RawModal';
import { getElectron } from '@/types/electron';
import CharacterSheetModal from '@/components/CharacterSheetModal';
import HelpPanel from '@/components/HelpPanel';

import { AttributesLayout, SkillsLayout, StatsLayout } from '@/layouts';
import { getAdapter } from '@/services/PlatformAdapter';
import { exportSchemaDataToRprText } from '@/utils/rprText';
import { isElectron } from '@/types/electron';

export default function SchemaDataEditorPage() {
  const state = useEditorState();

  const isDesktop = useMemo(() => isElectron(), []);

  const [allowIdEdit, setAllowIdEdit] = useState(false);

  const [rawOpen, setRawOpen] = useState(false);
  const [rawInitialMode, setRawInitialMode] = useState<'all' | 'selection'>('selection');
  const [rawInitialCategory, setRawInitialCategory] = useState<RprCategory>('Attributes');
  const [rawInitialText, setRawInitialText] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);

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
    schema,
    data,
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
        electron?.send?.('sheet:update', { data });
      } catch {
        // ignore
      }
    }, 150);

    return () => {
      window.clearTimeout(handle);
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
              await electron?.sheetWindow?.open?.({ data });
              return;
            } catch {
              // fallback to modal
            }
          }
          setSheetOpen(true);
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

  return (
    <div className="h-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {!isDesktop ? (
        <TopMenuBar
        schema={schema}
        data={data}
        schemaVersion={schemaVersion}
        tooltips={tooltips}
        activeCategory={activeCategory}
        activeTable={activeView.table}
        filteredRowsCount={filteredRows.length}
        fileInputRef={fileInputRef}
        onNewFile={newFile}
        onLoadFile={requestLoadFile}
        onLoadFileSelected={onLoadFileSelected}
        onOpenRawAll={openRawAll}
        onOpenRawForCategory={openRawForCategory}
        onOpenCharacterSheet={() => setSheetOpen(true)}
        onError={setError}
        />
      ) : null}

      <div className="flex-shrink-0 bg-slate-950 px-4 pt-4">
        <div className={isDesktop ? 'w-full' : 'mx-auto max-w-[1560px] w-full'}>
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            columnCount={tableSchema?.columns?.length ?? 0}
            tableCount={schema ? Object.keys(schema.tables ?? {}).length : 0}
          />
        </div>
      </div>

      <div className={isDesktop ? 'flex-1 min-h-0 flex flex-col w-full px-4 pb-4' : 'flex-1 min-h-0 flex flex-col mx-auto max-w-[1560px] w-full px-4 pb-4'}>
        <div className="flex-shrink-0 mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRecord}
            className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            disabled={!schema || !data || !tableSchema}
          >
            Add
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            className="rounded-md border border-red-700/60 bg-red-950/30 px-3 py-2 text-sm text-red-200 hover:bg-red-950/50"
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
            title={String(activeCategory)}
            enableFilter={true}
            filterPlaceholder={`Search ${String(activeCategory).toLowerCase()}…`}
            groupBy={activeCategory === 'Perks' || activeCategory === 'Abilities' ? 'Category' : undefined}
            onReorder={activeCategory === 'Perks' || activeCategory === 'Abilities' ? undefined : reorderFilteredRows}
          />

          <main className="rounded-lg border border-slate-800 bg-slate-900/20 overflow-auto">
            {error ? (
              <div className="p-4">
                <div className="rounded-md border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-200">
                  {error}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Ensure the dev server can fetch <code className="text-slate-200">/schema-structure.json</code>{' '}
                  and <code className="text-slate-200">/schema-data.json</code> from <code className="text-slate-200">public/</code>.
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
                          : 'rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-900/60'
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
                  <div className="text-xs text-slate-400">
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
                  <div className="text-sm text-slate-400">No schema/record available for this view.</div>
                )}
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-300">Loading schema…</div>
            )}
          </main>

          <HelpPanel category={activeCategory} />
        </div>
      </div>

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
        />
      ) : null}
    </div>
  );
}
