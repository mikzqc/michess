import React from 'react';
import { BarChart2, Home, RotateCcw, Check, X } from 'lucide-react';

interface GameOverModalProps {
  result: string;
  onReview?: () => void;
  onHome?: () => void;
  onRematch?: () => void;
  rematchOffer?: {
    byMe: boolean;
    byOpponent: boolean;
    onDecline: () => void;
  };
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ result, onReview, onHome, onRematch, rematchOffer }) => {
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
          {onReview && (
            <button 
              onClick={onReview}
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-colors cursor-pointer shadow-lg"
            >
              <BarChart2 size={18} /> Review Game
            </button>
          )}
          
          {onRematch && !rematchOffer?.byMe && !rematchOffer?.byOpponent && (
            <button 
              onClick={onRematch}
              className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-lg"
            >
              <RotateCcw size={18} /> Play Again
            </button>
          )}

          {rematchOffer?.byMe && (
            <button 
              disabled
              className="w-full bg-slate-700/50 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-slate-400 cursor-not-allowed shadow-lg border border-slate-600"
            >
              <RotateCcw size={18} /> Offer Sent...
            </button>
          )}

          {rematchOffer?.byOpponent && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <button 
                onClick={onRematch}
                className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-lg"
              >
                <Check size={18} /> Accept
              </button>
              <button 
                onClick={rematchOffer.onDecline}
                className="w-full bg-red-900/50 hover:bg-red-800 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-lg"
              >
                <X size={18} /> Decline
              </button>
            </div>
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
