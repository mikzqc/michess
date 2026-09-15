import React from 'react';
import { BarChart2, Home, RotateCcw } from 'lucide-react';

interface GameOverModalProps {
  result: string;
  onReview: () => void;
  onHome?: () => void;
  onRematch?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ result, onReview, onHome, onRematch }) => {
  let mainText = 'Game Over';
  let subText = result;
  
  if (result.includes('White wins by Checkmate') || result.includes('Black wins by Checkmate')) {
    mainText = 'Checkmate';
    subText = result.includes('White') ? 'White wins' : 'Black wins';
  } else if (result.includes('Draw')) {
    mainText = 'Draw';
    subText = result;
  } else if (result.includes('wins on time') || result.includes('Time forfeit')) {
    mainText = 'Time Expired';
    subText = result;
  } else if (result.includes('Resignation') || result.includes('resigned')) {
    mainText = 'Resignation';
    subText = result;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg animate-fade-in">
      <div className="bg-chess-panel border border-chess-border p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-[90%] w-[320px] animate-scale-in">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white tracking-tight">{mainText}</h2>
          <p className="text-slate-400 mt-1 font-medium">{subText}</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button 
            onClick={onReview}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-colors cursor-pointer shadow-lg"
          >
            <BarChart2 size={18} /> Review Game
          </button>
          
          {onRematch && (
              <button 
              onClick={onRematch}
              className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-lg"
            >
              <RotateCcw size={18} /> Play Again
            </button>
          )}

          {onHome && (
            <button 
              onClick={onHome}
              className="w-full bg-transparent border border-slate-600 hover:bg-slate-800 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Home size={18} /> Back to Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
