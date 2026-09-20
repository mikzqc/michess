import React, { useState } from 'react';
import { Crown, Users } from 'lucide-react';
import type { PlayerColor } from '../hooks/useComputerGame';
import type { Difficulty } from '../hooks/useComputerGame';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export type SetupMode = 'computer' | 'local' | 'link';

export interface TimeControl {
  minutes: number;
  increment: number;
}

interface GameSetupModalProps {
  mode: SetupMode;
  onClose: () => void;
  onStartComputer?: (color: PlayerColor, difficulty: Difficulty, timeControl: TimeControl | null) => void;
  onStartLocal?: (timeControl: TimeControl | null) => void;
  onStartLink?: (color: PlayerColor, timeControl: TimeControl | null) => void;
}

const TIME_PRESETS = [
  { label: 'Bullet', presets: [{m: 1, i: 0}, {m: 1, i: 1}, {m: 2, i: 1}] },
  { label: 'Blitz', presets: [{m: 3, i: 0}, {m: 3, i: 2}, {m: 5, i: 0}, {m: 5, i: 3}] },
  { label: 'Rapid', presets: [{m: 10, i: 0}, {m: 15, i: 10}, {m: 30, i: 0}] }
];

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ mode, onClose, onStartComputer, onStartLocal, onStartLink }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>(5);
  const [timeMode, setTimeMode] = useState<'realtime' | 'unlimited'>('realtime');
  const [minutes, setMinutes] = useState(10);
  const [increment, setIncrement] = useState(0);

  const tcDescription = increment === 0 ? `${minutes} minutes per side` : `${minutes} minutes + ${increment}s increment`;
  const tcLabel = `${minutes}+${increment}`;

  const handleSubmit = () => {
    const timeControl = timeMode === 'realtime' ? { minutes, increment } : null;
    if (mode === 'local' && onStartLocal) {
      onStartLocal(timeControl);
    } else if (mode === 'computer' || mode === 'link') {
      // Delay to force color selection if not chosen directly
      // But actually, we just default to random if they click the main button
      handleColorSubmit('random');
    }
  };

  const handleColorSubmit = (color: 'white' | 'black' | 'random') => {
    const timeControl = timeMode === 'realtime' ? { minutes, increment } : null;
    let finalColor: 'white' | 'black' = color === 'random' 
      ? (Math.random() > 0.5 ? 'white' : 'black') 
      : color;
      
    if (mode === 'computer' && onStartComputer) {
      onStartComputer(finalColor, difficulty, timeControl);
    } else if (mode === 'link' && onStartLink) {
      onStartLink(finalColor, timeControl);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Game setup" maxWidth="md">
      <div className="flex flex-col">
        <div className="p-5 flex flex-col gap-5">
          {/* Variant Selector */}
          <div className="bg-surface-1 border border-border-1 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown size={20} className="text-content-3" />
              <div>
                <span className="font-bold text-content-1 mr-2">Standard</span>
                <span className="text-content-3 text-sm">FIDE rules</span>
              </div>
            </div>
          </div>

          {/* Time Mode Tabs */}
          <div className="flex border-b border-border-1">
            <button
              onClick={() => setTimeMode('realtime')}
              className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${timeMode === 'realtime' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-content-1'}`}
            >
              Timed
            </button>
            <button
              onClick={() => setTimeMode('unlimited')}
              className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${timeMode === 'unlimited' ? 'border-accent text-accent' : 'border-transparent text-content-3 hover:text-content-1'}`}
            >
              Unlimited
            </button>
          </div>

          {/* Time Controls */}
          {timeMode === 'realtime' && (
            <div className="flex flex-col gap-4">
              {/* Categorized Presets */}
              {TIME_PRESETS.map(category => (
                <div key={category.label}>
                  <div className="text-xs font-bold text-content-3 uppercase tracking-wider mb-2">{category.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {category.presets.map(pt => {
                      const isActive = pt.m === minutes && pt.i === increment;
                      return (
                        <button
                          key={`${pt.m}+${pt.i}`}
                          onClick={() => { setMinutes(pt.m); setIncrement(pt.i); }}
                          className={`text-sm px-3 py-1.5 rounded-md transition-colors font-bold ${isActive ? 'bg-accent text-white' : 'bg-surface-3 text-content-2 hover:bg-border-1 hover:text-content-1'}`}
                        >
                          {pt.m}+{pt.i}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Custom Controls */}
              <div className="mt-2 border-t border-border-1 pt-4">
                <div className="text-xs font-bold text-content-3 uppercase tracking-wider mb-3">Custom</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-content-2 block mb-2">Minutes (1–60)</label>
                    <input 
                      type="range" min="1" max="60" value={minutes} onChange={e => setMinutes(Number(e.target.value))}
                      className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-content-2 block mb-2">Increment (0–30)</label>
                    <input 
                      type="range" min="0" max="30" value={increment} onChange={e => setIncrement(Number(e.target.value))}
                      className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Time Control Summary */}
              <div className="bg-surface-1 border border-border-1 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-content-1 font-mono">{minutes}+{increment}</div>
                <div className="text-xs text-content-3 mt-1">{tcDescription}</div>
              </div>
            </div>
          )}

          {timeMode === 'unlimited' && (
            <div className="bg-surface-1 border border-border-1 rounded-lg p-5 text-center flex flex-col gap-1">
              <div className="text-lg font-bold text-content-1">∞ Unlimited</div>
              <div className="text-sm text-content-3">No time limit — play at your own pace</div>
            </div>
          )}

          {/* Difficulty for Computer */}
          {mode === 'computer' && (
            <div className="border-t border-border-1 pt-5">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-bold text-content-2">Computer Difficulty</div>
                <div className="font-bold text-content-1 bg-surface-3 px-3 py-1 rounded-md text-sm">Level {difficulty}</div>
              </div>
              <input 
                type="range" min="1" max="20" step="1" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          )}

          {/* Create Button */}
          {mode === 'local' && (
            <div className="pt-2">
              <Button onClick={handleSubmit} fullWidth size="lg">
                <Users size={20} className="mr-2" /> Start local game
                {timeMode === 'realtime' && <span className="opacity-80 text-sm font-mono ml-2">({tcLabel})</span>}
              </Button>
            </div>
          )}
        </div>
        
        {/* Color Selector (for Computer and Link only) */}
        {(mode === 'computer' || mode === 'link') && (
          <div className="bg-surface-3 border-t border-border-1 flex h-14 mt-auto">
            <button 
              onClick={() => handleColorSubmit('white')}
              className="flex-1 hover:bg-border-1 flex justify-center items-center transition-colors group"
              title="Play as White"
            >
              <div className="w-8 h-8 rounded bg-white text-black font-bold flex items-center justify-center border border-gray-400 text-sm shadow-sm group-hover:scale-105 transition-transform">W</div>
            </button>
            <button 
              onClick={() => handleColorSubmit('random')}
              className="flex-1 hover:bg-border-1 flex justify-center items-center transition-colors border-x border-border-1 group"
              title="Random Color"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-white to-black flex items-center justify-center text-white border border-gray-600 font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
                ?
              </div>
            </button>
            <button 
              onClick={() => handleColorSubmit('black')}
              className="flex-1 hover:bg-border-1 flex justify-center items-center transition-colors group"
              title="Play as Black"
            >
              <div className="w-8 h-8 rounded bg-black text-white font-bold flex items-center justify-center border border-gray-600 text-sm shadow-sm group-hover:scale-105 transition-transform">B</div>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
