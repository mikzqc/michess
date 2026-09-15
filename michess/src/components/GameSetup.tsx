import React, { useState } from 'react';
import type { Difficulty, PlayerColor } from '../hooks/useComputerGame';
import { Bot, User, HelpCircle } from 'lucide-react';

interface GameSetupProps {
  onStart: (color: PlayerColor, difficulty: Difficulty) => void;
  onCancel: () => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStart, onCancel }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>(10);
  const [colorPref, setColorPref] = useState<'white' | 'black' | 'random'>('random');

  const handleStart = () => {
    let finalColor: PlayerColor = 'white';
    if (colorPref === 'black') {
      finalColor = 'black';
    } else if (colorPref === 'random') {
      finalColor = Math.random() < 0.5 ? 'white' : 'black';
    }
    
    onStart(finalColor, difficulty);
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-chess-panel border border-chess-border rounded-lg p-6 shadow-xl text-white">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 border-b border-chess-border pb-4">
        <Bot className="text-chess-accent" />
        Play vs Computer
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Difficulty</label>
          <div className="flex flex-col gap-4 bg-slate-800 p-4 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg text-white">
                Stockfish Level {difficulty}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDifficulty(Math.max(1, difficulty - 1))}
                className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-xl transition-colors"
                disabled={difficulty <= 1}
              >
                −
              </button>
              
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-chess-accent"
              />
              
              <button
                type="button"
                onClick={() => setDifficulty(Math.min(20, difficulty + 1))}
                className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-xl transition-colors"
                disabled={difficulty >= 20}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Play as</label>
          <div className="flex gap-2">
            <button
              onClick={() => setColorPref('white')}
              className={`flex-1 py-3 flex flex-col items-center justify-center gap-2 rounded-md transition-colors ${
                colorPref === 'white' ? 'bg-chess-accent text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <User size={24} className="text-white" />
              <span className="text-sm font-medium">White</span>
            </button>
            <button
              onClick={() => setColorPref('random')}
              className={`flex-1 py-3 flex flex-col items-center justify-center gap-2 rounded-md transition-colors ${
                colorPref === 'random' ? 'bg-chess-accent text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <HelpCircle size={24} />
              <span className="text-sm font-medium">Random</span>
            </button>
            <button
              onClick={() => setColorPref('black')}
              className={`flex-1 py-3 flex flex-col items-center justify-center gap-2 rounded-md transition-colors ${
                colorPref === 'black' ? 'bg-chess-accent text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <User size={24} className="text-gray-900 fill-current" />
              <span className="text-sm font-medium">Black</span>
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg font-bold text-gray-300 bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="flex-1 py-3 rounded-lg font-bold text-white bg-chess-accent hover:bg-indigo-500 transition-colors"
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
};
