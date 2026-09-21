import React, { useState } from 'react';
import { Trash2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { reviewCache } from '../services/reviewCache';
import { audioService } from '../services/audio';
import type { AppTheme } from '../hooks/useAppTheme';
import { useAppTheme } from '../hooks/useAppTheme';
import { getCustomPieces } from '../utils/themes';
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
  const [showPiecePreview, setShowPiecePreview] = useState(false);
  
  const currentPieces = getCustomPieces(settings.pieceSet);

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
              <option value="mocha">Mocha</option>
              <option value="ocean">Ocean</option>
              <option value="forest">Forest</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-content-1 font-medium">Piece Set</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowPiecePreview(!showPiecePreview)}
                  className="p-1.5 rounded-md hover:bg-surface-3 text-content-2 hover:text-content-1 transition-colors"
                  title="Preview Piece Set"
                >
                  {showPiecePreview ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <select 
                  className="bg-surface-1 border border-border-1 rounded-md px-3 py-1.5 text-sm text-content-1 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                  value={settings.pieceSet}
                  onChange={e => updateSettings({ pieceSet: e.target.value as any })}
                  >
                    <option value="default">Default</option>
                    <option value="alpha">Alpha</option>
                    <option value="california">California</option>
                    <option value="chess7">Chess7</option>
                    <option value="chessnut">Chessnut</option>
                    <option value="companion">Companion</option>
                    <option value="dubrovnik">Dubrovnik</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="fresca">Fresca</option>
                    <option value="gioco">Gioco</option>
                    <option value="governor">Governor</option>
                    <option value="horsey">Horsey</option>
                    <option value="icpieces">IcPpieces</option>
                    <option value="kosal">Kosal</option>
                    <option value="leipzig">Leipzig</option>
                    <option value="letter">Letter</option>
                    <option value="libra">Libra</option>
                    <option value="maestro">Maestro</option>
                    <option value="merida">Merida</option>
                    <option value="mono">Mono</option>
                    <option value="mpchess">Mpchess</option>
                    <option value="pirouetti">Pirouetti</option>
                    <option value="pixel">Pixel</option>
                    <option value="reillycraig">Reillycraig</option>
                    <option value="riohacha">Riohacha</option>
                    <option value="shapes">Shapes</option>
                    <option value="spatial">Spatial</option>
                    <option value="staunty">Staunty</option>
                    <option value="tatiana">Tatiana</option>
                  </select>
              </div>
            </div>
            
            {showPiecePreview && (
              <div className="flex justify-center items-center gap-1 bg-surface-3 p-3 rounded-md border border-border-2 animate-fade-in mt-1">
                {['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bN'].map(p => {
                  const Piece = currentPieces[p];
                  return (
                    <div key={p} className="w-8 h-8 flex items-center justify-center">
                      <Piece squareWidth={32} />
                    </div>
                  );
                })}
              </div>
            )}
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
