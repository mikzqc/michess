import React, { useState, useEffect } from 'react';
import { X, Crown, Users, Bot } from 'lucide-react';
import type { PlayerColor } from '../hooks/useComputerGame';
import type { Difficulty } from '../hooks/useComputerGame';

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
  { label: 'Bullet', presets: [{ m: 1, i: 0 }, { m: 1, i: 1 }] },
  { label: 'Blitz', presets: [{ m: 3, i: 0 }, { m: 3, i: 2 }, { m: 5, i: 0 }, { m: 5, i: 3 }] },
  { label: 'Rapid', presets: [{ m: 10, i: 0 }, { m: 10, i: 5 }, { m: 15, i: 10 }] },
];

export const GameSetupModal: React.FC<GameSetupModalProps> = ({
  mode,
  onClose,
  onStartComputer,
  onStartLocal,
  onStartLink
}) => {
  const [timeMode, setTimeMode] = useState<'realtime' | 'unlimited'>('realtime');
  const [minutes, setMinutes] = useState(5);
  const [increment, setIncrement] = useState(3);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const [difficulty, setDifficulty] = useState<Difficulty>(10);
  const [colorPref] = useState<'white' | 'black' | 'random'>('random');

  const getTimeControl = (): TimeControl | null => {
    if (timeMode === 'unlimited') return null;
    return { minutes, increment };
  };

  const getFinalColor = (): PlayerColor => {
    if (colorPref === 'black') return 'black';
    if (colorPref === 'random') return Math.random() < 0.5 ? 'white' : 'black';
    return 'white';
  };

  const handleSubmit = () => {
    const tc = getTimeControl();
    const finalColor = getFinalColor();

    if (mode === 'computer' && onStartComputer) {
      onStartComputer(finalColor, difficulty, tc);
    } else if (mode === 'local' && onStartLocal) {
      onStartLocal(tc);
    } else if (mode === 'link' && onStartLink) {
      onStartLink(finalColor, tc);
    }
  };

  const handleColorSubmit = (color: 'white' | 'black' | 'random') => {
    const tc = getTimeControl();
    let finalColor: PlayerColor = 'white';
    if (color === 'black') finalColor = 'black';
    else if (color === 'random') finalColor = Math.random() < 0.5 ? 'white' : 'black';
    
    if (mode === 'computer' && onStartComputer) {
      onStartComputer(finalColor, difficulty, tc);
    } else if (mode === 'link' && onStartLink) {
      onStartLink(finalColor, tc);
    }
  };

  const tcLabel = timeMode === 'unlimited' ? 'Unlimited' : `${minutes}+${increment}`;
  const tcDescription = timeMode === 'unlimited' 
    ? 'No time limit' 
    : `${minutes} minute${minutes !== 1 ? 's' : ''} + ${increment} second${increment !== 1 ? 's' : ''} per move`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-chess-panel border border-chess-border rounded-xl shadow-2xl w-full max-w-[500px] overflow-hidden text-slate-300 relative max-h-[90vh] overflow-y-auto animate-scale-in">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-normal text-white text-center mb-6">Game setup</h2>

          {/* Variant Selector */}
          <div className="mb-5 relative">
            <div className="bg-slate-800 border border-slate-700 rounded px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown size={20} className="text-slate-400" />
                <div>
                  <span className="font-bold text-white mr-2">Standard</span>
                  <span className="text-slate-500 text-sm">FIDE rules</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Mode Tabs */}
          <div className="flex border-b border-slate-700 mb-5">
            <button
              onClick={() => setTimeMode('realtime')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${timeMode === 'realtime' ? 'border-chess-accent text-chess-accent' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              Timed
            </button>
            <button
              onClick={() => setTimeMode('unlimited')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${timeMode === 'unlimited' ? 'border-chess-accent text-chess-accent' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              Unlimited
            </button>
          </div>

          {/* Time Controls */}
          {timeMode === 'realtime' && (
            <div className="mb-6">
              {/* Categorized Presets */}
              {TIME_PRESETS.map(category => (
                <div key={category.label} className="mb-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{category.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {category.presets.map(pt => {
                      const isActive = pt.m === minutes && pt.i === increment;
                      return (
                        <button
                          key={`${pt.m}+${pt.i}`}
                          onClick={() => { setMinutes(pt.m); setIncrement(pt.i); }}
                          className={`text-sm px-3 py-1.5 rounded transition-colors ${isActive ? 'bg-chess-accent text-white font-bold' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          {pt.m}+{pt.i}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Custom Controls */}
              <div className="mt-5 border-t border-slate-700 pt-4">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Custom</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Minutes (1–60)</label>
                    <input 
                      type="range" min="1" max="60" value={minutes} onChange={e => setMinutes(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-chess-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Increment (0–30)</label>
                    <input 
                      type="range" min="0" max="30" value={increment} onChange={e => setIncrement(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-chess-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Time Control Summary */}
              <div className="mt-4 bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white font-mono">{minutes}+{increment}</div>
                <div className="text-xs text-slate-400 mt-1">{tcDescription}</div>
              </div>
            </div>
          )}

          {timeMode === 'unlimited' && (
            <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-white">∞ Unlimited</div>
              <div className="text-xs text-slate-400 mt-1">No time limit — play at your own pace</div>
            </div>
          )}

          {/* Difficulty for Computer */}
          {mode === 'computer' && (
            <div className="mb-6 border-t border-slate-700 pt-5">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-medium">Computer Difficulty</div>
                <div className="font-bold text-white bg-slate-800 px-2 py-1 rounded text-sm">Level {difficulty}</div>
              </div>
              <input 
                type="range" min="1" max="20" step="1" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-chess-accent"
              />
            </div>
          )}

          {/* Create Button */}
          <div className="flex justify-center mt-6">
            <button
              onClick={handleSubmit}
              className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-lg flex items-center justify-center gap-3 font-bold text-white transition-all hover:scale-105 shadow-lg"
            >
              {mode === 'computer' && <Bot size={20} />}
              {mode === 'link' && <Users size={20} />}
              {mode === 'local' && <Users size={20} />}
              
              {mode === 'computer' ? 'Play against computer' : mode === 'link' ? 'Create lobby game' : 'Start local game'}
              
              {timeMode === 'realtime' && (
                <span className="text-indigo-200 text-sm font-mono ml-1">({tcLabel})</span>
              )}
            </button>
          </div>

        </div>
        
        {/* Color Selector (for Computer and Link only) */}
        {(mode === 'computer' || mode === 'link') && (
          <div className="bg-slate-900 border-t border-slate-700 flex h-14">
            <button 
              onClick={() => handleColorSubmit('white')}
              className="flex-1 hover:bg-slate-800 flex justify-center items-center transition-colors text-white"
            >
              <div className="w-8 h-8 rounded bg-white text-black font-bold flex items-center justify-center border border-gray-400 text-sm">W</div>
            </button>
            <button 
              onClick={() => handleColorSubmit('random')}
              className="flex-1 hover:bg-slate-800 flex justify-center items-center transition-colors text-white"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-white to-black flex items-center justify-center text-white border border-gray-600 font-bold text-xs">
                ?
              </div>
            </button>
            <button 
              onClick={() => handleColorSubmit('black')}
              className="flex-1 hover:bg-slate-800 flex justify-center items-center transition-colors text-white"
            >
              <div className="w-8 h-8 rounded bg-black text-white font-bold flex items-center justify-center border border-gray-600 text-sm">B</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
