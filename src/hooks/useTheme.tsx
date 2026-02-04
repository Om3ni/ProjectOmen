import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeName = 'slate' | 'midnight' | 'ocean' | 'ember' | 'vscode';

export const THEMES: Array<{ id: ThemeName; label: string; accent: string }> = [
  { id: 'slate', label: 'Slate', accent: '#00bb7f' },
  { id: 'midnight', label: 'Midnight', accent: '#818cf8' },
  { id: 'ocean', label: 'Ocean', accent: '#22d3d3' },
  { id: 'ember', label: 'Ember', accent: '#fb923c' },
  { id: 'vscode', label: 'VS Code', accent: '#0e639c' },
];

const STORAGE_KEY = 'omen-theme';

function getInitialTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) {
      return stored as ThemeName;
    }
  } catch {
    // localStorage not available
  }
  return 'slate';
}

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage not available
    }
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
