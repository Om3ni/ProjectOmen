import { useState } from 'react';
import type { RefObject } from 'react';

import type { RprCategory, SchemaData, SchemaStructure } from '@/models/schema';
import { getAdapter } from '@/services/PlatformAdapter';
import { exportSchemaDataToRprText } from '@/utils/rprText';
import ThemeSwitcher from '@/components/ThemeSwitcher';

type Props = {
  schema: SchemaStructure | null;
  data: SchemaData | null;
  schemaVersion: string | undefined;
  tooltips: Record<string, string> | undefined;
  activeCategory: RprCategory;
  activeTable: string;
  filteredRowsCount: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onNewFile: () => void;
  onLoadFile: () => void;
  onLoadFileSelected: (file: File | null) => void;
  onOpenRawAll: () => void;
  onOpenRawForCategory: (cat: RprCategory) => void;
  onOpenCharacterSheet: () => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  onError: (msg: string) => void;
  wipUnlocked?: boolean;
};

export default function TopMenuBar({
  schema,
  data,
  activeCategory,
  activeTable,
  filteredRowsCount,
  fileInputRef,
  onNewFile,
  onLoadFile,
  onLoadFileSelected,
  onOpenRawAll,
  onOpenRawForCategory,
  onOpenCharacterSheet,
  onOpenSettings,
  onToggleChat,
  chatOpen,
  onError,
  wipUnlocked,
}: Props) {
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | null>(null);

  const downloadSchemaData = async (override?: { data: SchemaData }) => {
    if (!data && !override) return;
    if (!schema) {
      onError('Schema not loaded');
      return;
    }
    try {
      const rprText = exportSchemaDataToRprText(schema, override?.data ?? data!);
      await getAdapter().writeFile(
        'schema-data.txt',
        rprText + '\n',
        'text/plain;charset=utf-8',
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportPreserveIds = async () => {
    if (!data) return;
    await downloadSchemaData({ data });
  };

  return (
    <header
      className="flex-shrink-0 border-b theme-border theme-bg-base relative z-40"
      onClick={() => {
        if (openMenu) setOpenMenu(null);
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold theme-text">Project Omen</h1>
            <p className="text-xs theme-text-muted">
              Schema: {schema?.version ?? '…'} · Table: {activeTable} · Rows: {filteredRowsCount}
            </p>

            <div className="mt-2 flex items-center gap-3 text-sm">
              <ThemeSwitcher />
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md border theme-border theme-bg-input px-3 py-1.5 text-sm theme-text-secondary hover:theme-bg-surface"
                  onClick={() => setOpenMenu((m) => (m === 'file' ? null : 'file'))}
                >
                  File ▾
                </button>
                {openMenu === 'file' ? (
                  <div className="absolute left-0 z-50 mt-2 w-56 rounded-md border theme-border theme-bg-base p-1 shadow-xl">
                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        onNewFile();
                      }}
                    >
                      New File
                    </button>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        onLoadFile();
                      }}
                    >
                      Load File (import…)
                    </button>
                    <div className="my-1 border-t theme-border" />
                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        exportPreserveIds();
                      }}
                    >
                      Save File (export)
                    </button>
                    <div className="my-1 border-t theme-border" />
                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        onOpenSettings();
                      }}
                    >
                      Settings…
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-md border theme-border theme-bg-input px-3 py-1.5 text-sm theme-text-secondary hover:theme-bg-surface"
                  onClick={() => setOpenMenu((m) => (m === 'edit' ? null : 'edit'))}
                >
                  Edit ▾
                </button>
                {openMenu === 'edit' ? (
                  <div className="absolute left-0 z-50 mt-2 w-64 rounded-md border theme-border theme-bg-base p-1 shadow-xl">
                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        onOpenRawAll();
                      }}
                    >
                      Import from Raw…
                    </button>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        onOpenRawForCategory(activeCategory);
                      }}
                    >
                      Select Raw Category…
                    </button>
                    <div className="my-1 border-t theme-border" />

                    <button
                      type="button"
                      className="w-full rounded px-2 py-2 text-left text-sm theme-text hover:theme-bg-surface"
                      onClick={() => {
                        setOpenMenu(null);
                        onOpenCharacterSheet();
                      }}
                    >
                      Character Sheet…
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Chat Toggle Button - hidden behind dev password */}
              {wipUnlocked && (
                <button
                  type="button"
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    chatOpen
                      ? 'border-[var(--color-accent)] theme-bg-accent/20 theme-text-accent'
                      : 'theme-border theme-bg-input theme-text-secondary hover:theme-bg-surface'
                  }`}
                  onClick={onToggleChat}
                  title="Toggle Chat (Ctrl+Shift+C)"
                >
                  💬 Chat
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,text/plain,.json,.txt,.rpr"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.currentTarget.value = '';
          onLoadFileSelected(file);
        }}
      />
    </header>
  );
}
