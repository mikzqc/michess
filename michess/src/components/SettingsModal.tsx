import React, { useState } from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { reviewCache } from '../services/reviewCache';
import { audioService } from '../services/audio';
import type { AppTheme } from '../hooks/useAppTheme';
import { useAppTheme } from '../hooks/useAppTheme';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useAppTheme();
  const [cleared, setCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleToggle = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    updateSettings({ [key]: newValue });
    
    if (key === 'soundEnabled') {
      audioService.setEnabled(newValue as boolean);
    }
  };

  const handleClearCache = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    
    reviewCache.clear();
    setCleared(true);
    setConfirmClear(false);
    
    setTimeout(() => {
      setCleared(false);
    }, 3000);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Settings" maxWidth="md">
      <div className="flex flex-col gap-6 p-5">
        
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold tracking-widest text-content-3 uppercase">Appearance</h3>

          <div className="flex justify-between items-center">
            <span className="text-content-1 font-medium">App Theme</span>
            <select 
              className="bg-surface-1 border border-border-1 rounded-md px-3 py-1.5 text-sm text-content-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              value={theme}
              onChange={e => setTheme(e.target.value as AppTheme)}
            >
              <option value="dark-blue">Dark Blue</option>
              <option value="dark">Dark</option>
              <option value="midnight">Midnight</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-content-1 font-medium">Piece Set</span>
            <select 
              className="bg-surface-1 border border-border-1 rounded-md px-3 py-1.5 text-sm text-content-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              value={settings.pieceSet}
              onChange={e => updateSettings({ pieceSet: e.target.value as any })}
            >
              <option value="default">Default</option>
              <option value="alpha">Alpha</option>
              <option value="merida">Merida</option>
            </select>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-content-1 font-medium">Board Theme</span>
            <select 
              className="bg-surface-1 border border-border-1 rounded-md px-3 py-1.5 text-sm text-content-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              value={settings.boardTheme}
              onChange={e => updateSettings({ boardTheme: e.target.value as any })}
            >
              <option value="slate">Slate</option>
              <option value="purple">Michess Purple</option>
              <option value="wood">Classic Wood</option>
              <option value="green">Chess.com Green</option>
              <option value="darkKnight">Dark Knight</option>
            </select>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Show Board Coordinates</span>
            <input 
              type="checkbox"
              checked={settings.showCoordinates}
              onChange={() => handleToggle('showCoordinates')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold tracking-widest text-content-3 uppercase">Gameplay</h3>
          
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Sound Effects</span>
            <input 
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={() => handleToggle('soundEnabled')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>
          
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Move Animations</span>
            <input 
              type="checkbox"
              checked={settings.moveAnimations}
              onChange={() => handleToggle('moveAnimations')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Show Legal Move Indicators</span>
            <input 
              type="checkbox"
              checked={settings.showLegalMoves}
              onChange={() => handleToggle('showLegalMoves')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>
          
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Confirm Resignation</span>
            <input 
              type="checkbox"
              checked={settings.confirmResignation}
              onChange={() => handleToggle('confirmResignation')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>

          <div className="flex justify-between items-center">
            <span className="text-content-1 font-medium">Promotion Preference</span>
            <select 
              className="bg-surface-1 border border-border-1 rounded-md px-3 py-1.5 text-sm text-content-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              value={settings.autoQueen ? 'auto' : 'ask'}
              onChange={e => updateSettings({ autoQueen: e.target.value === 'auto' })}
            >
              <option value="ask">Always ask</option>
              <option value="auto">Auto-queen</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold tracking-widest text-content-3 uppercase">Game Review</h3>
          
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Show Classification in Move History</span>
            <input 
              type="checkbox"
              checked={settings.showHistoryClassifications}
              onChange={() => handleToggle('showHistoryClassifications')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>
          
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-content-1 font-medium">Show Board Annotation Symbol</span>
            <input 
              type="checkbox"
              checked={settings.showBoardAnnotation}
              onChange={() => handleToggle('showBoardAnnotation')}
              className="w-4 h-4 cursor-pointer accent-accent"
            />
          </label>

          <div className="pt-2">
            <Button 
              variant={cleared ? 'primary' : confirmClear ? 'destructive' : 'secondary'}
              fullWidth
              onClick={handleClearCache}
              className={cleared ? 'bg-success hover:bg-success text-white border-transparent' : ''}
            >
              {cleared ? (
                <>
                  <CheckCircle2 size={18} className="mr-2" />
                  Cache Cleared
                </>
              ) : (
                <>
                  <Trash2 size={18} className="mr-2" />
                  {confirmClear ? 'Are you sure?' : 'Clear Review Cache'}
                </>
              )}
            </Button>
          </div>
        </div>
        
      </div>
    </Modal>
  );
};
