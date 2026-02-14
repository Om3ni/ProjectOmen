import { useCallback } from 'react';

import type { RprCategory, SchemaData, SchemaStructure } from '@/models/schema';
import { exportSchemaDataToRprText, stripRprPreviewPrefixes } from '@/utils/rprText';
import { parseRprTextToSchemaData } from '@/utils/rprImport';
import { CATEGORY_VIEWS } from '@/constants/categoryViews';
import { asRows } from '@/utils/editorHelpers';

export function useEditorRawIO(
  schema: SchemaStructure | null,
  data: SchemaData | null,
  setData: (d: SchemaData) => void,
  setError: (e: string | null) => void,
) {
  const exportSelectionToRaw = useCallback((cat: RprCategory): string => {
    if (!schema || !data) return '';
    const view = CATEGORY_VIEWS.find((v) => v.category === cat);
    if (!view) return '';

    const includeTables = new Set([view.table]);
    const filterRow = view.filter
      ? (t: string, row: Record<string, unknown>) => (t === view.table ? view.filter!(row) : false)
      : undefined;
    return exportSchemaDataToRprText(schema, data, { includeTables, filterRow });
  }, [schema, data]);

  const exportAllToRaw = useCallback((): string => {
    if (!schema || !data) return '';
    return exportSchemaDataToRprText(schema, data);
  }, [schema, data]);

  const applyRawToSelection = useCallback((rawText: string, rawCategory: RprCategory) => {
    console.log('[applyRawToSelection] Called with category:', rawCategory, ', text length:', rawText.length);
    if (!schema || !data) {
      console.warn('[applyRawToSelection] Early return - schema or data missing');
      return;
    }
    const view = CATEGORY_VIEWS.find((v) => v.category === rawCategory);
    if (!view) {
      console.warn('[applyRawToSelection] Early return - view not found for category:', rawCategory);
      return;
    }

    try {
      const cleaned = stripRprPreviewPrefixes(rawText);
      const parsedData = parseRprTextToSchemaData(schema, cleaned);
      const parsedRows = asRows(parsedData, view.table);

      if (view.table === 'SkillDef' && (rawCategory === 'Attributes' || rawCategory === 'Skills')) {
        const keep = asRows(data, 'SkillDef').filter((r) => {
          const isAttr = String(r.TypeFlag ?? 'f').toLowerCase() === 't';
          return rawCategory === 'Attributes' ? !isAttr : isAttr;
        });

        const flag = rawCategory === 'Attributes' ? 't' : 'f';
        const withFlag = parsedRows.map((r) => ({ ...r, TypeFlag: flag }));

        setData({
          ...data,
          SkillDef: keep.concat(withFlag),
        });
      } else {
        setData({
          ...data,
          [view.table]: parsedRows,
        });
      }
    } catch (e) {
      console.error('[applyRawToSelection] Import failed:', e);
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, [schema, data, setData, setError]);

  const applyRawToAll = useCallback((rawText: string) => {
    if (!schema || !data) return;
    try {
      const cleaned = stripRprPreviewPrefixes(rawText);
      const next = parseRprTextToSchemaData(schema, cleaned);
      setData(next);
      setError(null);
    } catch (e) {
      console.error('[applyRawToAll] Import failed:', e);
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, [schema, data, setData, setError]);

  return { exportSelectionToRaw, exportAllToRaw, applyRawToSelection, applyRawToAll };
}
