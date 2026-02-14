/**
 * Recent Changes Context
 * Tracks Sigil's recent changes with undo capability
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type ChangeType = 'create' | 'update' | 'delete';
export type TableName = string;

export interface RecentChange {
  id: string; // Unique ID for this change
  type: ChangeType;
  table: TableName;
  data: Record<string, unknown>; // The record that was created/updated/deleted
  previousData?: Record<string, unknown>; // For undo (only for update/delete)
  description: string; // Human-readable description
  timestamp: number;
  undone: boolean; // If this change has been undone
}

interface RecentChangesContextValue {
  recentChanges: RecentChange[];
  addChange: (change: Omit<RecentChange, 'id' | 'timestamp' | 'undone'>) => string;
  undoChange: (id: string) => RecentChange | null;
  clearAll: () => void;
  getChangeById: (id: string) => RecentChange | undefined;
}

const RecentChangesContext = createContext<RecentChangesContextValue | null>(null);

export function RecentChangesProvider({ children }: { children: ReactNode }) {
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);

  const addChange = useCallback((change: Omit<RecentChange, 'id' | 'timestamp' | 'undone'>): string => {
    const newChange: RecentChange = {
      ...change,
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      undone: false,
    };
    setRecentChanges(prev => [...prev, newChange]);
    return newChange.id;
  }, []);

  const undoChange = useCallback((id: string): RecentChange | null => {
    let found: RecentChange | null = null;
    setRecentChanges(prev => {
      const index = prev.findIndex(c => c.id === id);
      if (index === -1) return prev;
      
      found = prev[index];
      const updated = [...prev];
      updated[index] = { ...found, undone: true };
      return updated;
    });
    return found;
  }, []);

  const clearAll = useCallback(() => {
    setRecentChanges([]);
  }, []);

  const getChangeById = useCallback((id: string): RecentChange | undefined => {
    return recentChanges.find(c => c.id === id);
  }, [recentChanges]);

  return (
    <RecentChangesContext.Provider
      value={{
        recentChanges,
        addChange,
        undoChange,
        clearAll,
        getChangeById,
      }}
    >
      {children}
    </RecentChangesContext.Provider>
  );
}

export function useRecentChanges() {
  const ctx = useContext(RecentChangesContext);
  if (!ctx) {
    throw new Error('useRecentChanges must be used within RecentChangesProvider');
  }
  return ctx;
}
