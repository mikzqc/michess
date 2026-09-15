import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Trash2, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { reviewCache } from '../services/reviewCache';
import { audioService } from '../services/audio';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { settings, updateSettings } = useSettings();
  const [cleared, setCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleToggle = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    updateSettings({ [key]: newValue });
    
    // Sync with audioService if sound is toggled
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="bg-chess-panel border border-chess-border rounded-xl shadow-2xl w-full max-w-md flex flex-col animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex justify-between items-center p-4 border-b border-chess-border">
          <h2 id="settings-title" className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="text-chess-accent" />
            Settings
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-300"
            aria-label="Close Settings"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Appearance</h3>

            <div className="flex justify-between items-center">
              <span>Piece Set</span>
              <select 
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm focus:border-chess-accent focus:outline-none"
                value={settings.pieceSet}
                onChange={e => updateSettings({ pieceSet: e.target.value as any })}
              >
                <option value="default">Default</option>
                <option value="alpha">Alpha</option>
                <option value="merida">Merida</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <span>Board Theme</span>
              <select 
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm focus:border-chess-accent focus:outline-none"
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
              <span>Show Board Coordinates</span>
              <input 
                type="checkbox"
                checked={settings.showCoordinates}
                onChange={() => handleToggle('showCoordinates')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Gameplay</h3>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span>Sound Effects</span>
              <input 
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={() => handleToggle('soundEnabled')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span>Move Animations</span>
              <input 
                type="checkbox"
                checked={settings.moveAnimations}
                onChange={() => handleToggle('moveAnimations')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Legal Move Indicators</span>
              <input 
                type="checkbox"
                checked={settings.showLegalMoves}
                onChange={() => handleToggle('showLegalMoves')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span>Confirm Resignation</span>
              <input 
                type="checkbox"
                checked={settings.confirmResignation}
                onChange={() => handleToggle('confirmResignation')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>

            <div className="flex justify-between items-center">
              <span>Promotion Preference</span>
              <select 
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm focus:border-chess-accent focus:outline-none"
                value={settings.autoQueen ? 'auto' : 'ask'}
                onChange={e => updateSettings({ autoQueen: e.target.value === 'auto' })}
              >
                <option value="ask">Always ask</option>
                <option value="auto">Auto-queen</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Game Review</h3>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Classification in Move History</span>
              <input 
                type="checkbox"
                checked={settings.showHistoryClassifications}
                onChange={() => handleToggle('showHistoryClassifications')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Board Annotation Symbol</span>
              <input 
                type="checkbox"
                checked={settings.showBoardAnnotation}
                onChange={() => handleToggle('showBoardAnnotation')}
                className="w-4 h-4 cursor-pointer"
              />
            </label>

            <div className="pt-2">
              <button 
                onClick={handleClearCache}
                className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                  cleared 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : confirmClear 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
                aria-live="polite"
              >
                {cleared ? (
                  <>
                    <CheckCircle2 size={18} />
                    Cache Cleared
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    {confirmClear ? 'Are you sure?' : 'Clear Review Cache'}
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
