import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export type PieceSet = 'default' | 'alpha' | 'california' | 'chess7' | 'chessnut' | 'companion' | 'dubrovnik' | 'fantasy' | 'fresca' | 'gioco' | 'governor' | 'horsey' | 'icpieces' | 'kosal' | 'leipzig' | 'letter' | 'libra' | 'maestro' | 'merida' | 'mono' | 'mpchess' | 'pirouetti' | 'pixel' | 'reillycraig' | 'riohacha' | 'shapes' | 'spatial' | 'staunty' | 'tatiana';

export interface AppSettings {
  soundEnabled: boolean;
  showLegalMoves: boolean;
  showCoordinates: boolean;
  showHistoryClassifications: boolean;
  showBoardAnnotation: boolean;
  boardOrientation: 'white' | 'black';
  pieceSet: PieceSet;
  boardTheme: 'slate' | 'purple' | 'wood' | 'green' | 'darkKnight';
  moveAnimations: boolean;
  confirmResignation: boolean;
  autoQueen: boolean;
}

const defaultSettings: AppSettings = {
  soundEnabled: true,
  showLegalMoves: true,
  showCoordinates: true,
  showHistoryClassifications: true,
  showBoardAnnotation: true,
  boardOrientation: 'white',
  pieceSet: 'default',
  boardTheme: 'slate',
  moveAnimations: true,
  confirmResignation: true,
  autoQueen: false,
};

export const useSettings = () => {
  const { user } = useAuth();
  const storageKey = user ? `michess_settings_${user.id}` : 'michess_settings';

  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
    return defaultSettings;
  };

  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    setSettingsState(loadSettings());
  }, [storageKey]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          setSettingsState({ ...defaultSettings, ...JSON.parse(e.newValue) });
        } catch (err) {}
      }
    };
    const handleCustomChange = () => {
      setSettingsState(loadSettings());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('michess_settings_changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('michess_settings_changed', handleCustomChange);
    };
  }, [storageKey]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('michess_settings_changed'));
      } catch (e) {
        console.warn('Failed to save settings', e);
      }
      return updated;
    });
  };

  return { settings, updateSettings };
};
