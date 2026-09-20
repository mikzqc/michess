import { useContext } from 'react';
import type { AppTheme } from '../contexts/ThemeContext';
import { ThemeContext } from '../contexts/ThemeContext';

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}

export type { AppTheme };
