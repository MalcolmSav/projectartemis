import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { ColorTokens, lightColors, nightColors, motion, radii, shadows, spacing, type as typeTokens, layout } from './tokens';

export type ThemeMode = 'light' | 'night';
export type PrimaryHue = 'forest' | 'midnight' | 'plum';

export interface Theme {
  mode: ThemeMode;
  hue: PrimaryHue;
  colors: ColorTokens;
  radii: typeof radii;
  spacing: typeof spacing;
  shadows: typeof shadows;
  type: typeof typeTokens;
  motion: typeof motion;
  layout: typeof layout;
}

interface ThemeContextValue extends Theme {
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setHue: (h: PrimaryHue) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initialMode = 'light' }: { children: React.ReactNode; initialMode?: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [hue, setHue] = useState<PrimaryHue>('forest');

  const toggleMode = useCallback(() => setMode((m) => (m === 'light' ? 'night' : 'light')), []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    hue,
    colors: mode === 'light' ? lightColors : nightColors,
    radii,
    spacing,
    shadows,
    type: typeTokens,
    motion,
    layout,
    setMode,
    toggleMode,
    setHue,
  }), [mode, hue, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
