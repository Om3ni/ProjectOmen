import { useCallback } from 'react';

import type { SchemaData, SchemaStructure } from '@/models/schema';
import { SchemaService } from '@/services/SchemaService';
import { parseRprTextToSchemaData } from '@/utils/rprImport';
import { clearAutosave } from '@/utils/autosave';

export function useEditorFileIO(
  schema: SchemaStructure | null,
  ensureCoreTables: (schema: SchemaStructure, data: SchemaData) => SchemaData,
  setData: (d: SchemaData) => void,
  setSchemaVersion: (v: string | undefined) => void,
  setTooltips: (t: Record<string, string> | undefined) => void,
  setSelectedIndex: (i: number) => void,
  setError: (e: string | null) => void,
  fileInputRef: React.RefObject<HTMLInputElement | null>,
) {
  const newFile = useCallback(() => {
    if (!schema) return;
    const ok = window.confirm('Start a new file? This will clear the current data (and the autosave).');
    if (!ok) return;
    clearAutosave();
    setError(null);
    setData(ensureCoreTables(schema, {}));
    setTooltips({});
    setSchemaVersion(schema.version);
    setSelectedIndex(0);
  }, [schema, ensureCoreTables, setData, setSchemaVersion, setTooltips, setSelectedIndex, setError]);

  const requestLoadFile = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const onLoadFileSelected = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const filename = String(file.name ?? '').toLowerCase();

        if (filename.endsWith('.json') || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
          const json = JSON.parse(text) as unknown;
          const parsed = SchemaService.parseSchemaDataFile(json);
          clearAutosave();
          setError(null);
          setData(schema ? ensureCoreTables(schema, parsed.data) : parsed.data);
          setSchemaVersion(parsed.schemaVersion);
          setTooltips(parsed.tooltips as Record<string, string> | undefined);
          setSelectedIndex(0);
          return;
        }

        if (!schema) {
          throw new Error('Schema not loaded yet; cannot import .rpr');
        }

        const parsedData = parseRprTextToSchemaData(schema, text);
        clearAutosave();
        setError(null);
        setData(ensureCoreTables(schema, parsedData));
        setSelectedIndex(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, [schema, ensureCoreTables, setData, setSchemaVersion, setTooltips, setSelectedIndex, setError]);

  return { newFile, requestLoadFile, onLoadFileSelected };
}
