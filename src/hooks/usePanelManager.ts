import { useCallback, useEffect, useRef, useState } from 'react';
import type { PanelId, PanelManagerState, PanelState } from '@/types/panel';
import { defaultPanelState } from '@/types/panel';

const STORAGE_KEY = 'project-omen:panels:v1';

function loadFromStorage(): Partial<PanelManagerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PanelManagerState>;
  } catch {
    return {};
  }
}

function saveToStorage(state: PanelManagerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function initState(defaults?: Partial<Record<PanelId, Partial<PanelState>>>): PanelManagerState {
  const stored = loadFromStorage();

  const build = (id: PanelId): PanelState => {
    const s = { ...defaultPanelState(defaults?.[id]), ...stored[id] };
    // Can't know if a popout window survived a reload — fall back to docked
    if (s.mode === 'popout') s.mode = 'docked';
    return s;
  };

  return {
    chat: build('chat'),
    'combat-log': build('combat-log'),
    'training-dummies': build('training-dummies'),
  };
}

export type PanelActions = {
  getState: (id: PanelId) => PanelState;
  show: (id: PanelId) => void;
  hide: (id: PanelId) => void;
  dock: (id: PanelId) => void;
  popout: (id: PanelId) => void;
  toggle: (id: PanelId) => void;
};

export function usePanelManager(
  defaults?: Partial<Record<PanelId, Partial<PanelState>>>,
): [PanelManagerState, PanelActions] {
  const [state, setState] = useState<PanelManagerState>(() => initState(defaults));
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track popout window references so we can detect when they close
  const popoutWindows = useRef<Partial<Record<PanelId, Window | null>>>({});

  // Persist on change (debounced)
  useEffect(() => {
    const handle = setTimeout(() => saveToStorage(state), 300);
    return () => clearTimeout(handle);
  }, [state]);

  // Poll for closed popout windows and auto-redock
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [id, win] of Object.entries(popoutWindows.current) as [PanelId, Window | null][]) {
        if (win && win.closed) {
          popoutWindows.current[id] = null;
          setState((prev) => {
            if (prev[id].mode === 'popout') {
              return { ...prev, [id]: { ...prev[id], mode: 'docked' } };
            }
            return prev;
          });
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const update = useCallback((id: PanelId, patch: Partial<PanelState>) => {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }, []);

  const getState = useCallback((id: PanelId) => stateRef.current[id], []);
  const show = useCallback((id: PanelId) => update(id, { mode: 'docked' }), [update]);
  const hide = useCallback((id: PanelId) => update(id, { mode: 'hidden' }), [update]);
  const dock = useCallback((id: PanelId) => update(id, { mode: 'docked' }), [update]);

  const popout = useCallback((id: PanelId) => {
    const url = `${window.location.origin}${window.location.pathname}?${id}=1`;
    const win = window.open(url, `project-omen-${id}`, 'width=420,height=600,menubar=no,toolbar=no');
    popoutWindows.current[id] = win;
    update(id, { mode: 'popout' });
  }, [update]);

  const toggle = useCallback((id: PanelId) => {
    const current = stateRef.current[id];
    if (current.mode === 'hidden') {
      update(id, { mode: 'docked' });
    } else {
      update(id, { mode: 'hidden' });
    }
  }, [update]);

  return [state, {
    getState,
    show,
    hide,
    dock,
    popout,
    toggle,
  }];
}
