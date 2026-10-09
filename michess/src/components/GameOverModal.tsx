import React from 'react';
import { BarChart2, Home, RotateCcw, Check, X, Eye, Trophy, Award, Minus } from 'lucide-react';
import { Button } from './ui/Button';

interface GameOverModalProps {
  result: string;
  onReview?: () => void;
  onHome?: () => void;
  onRematch?: () => void;
  onViewBoard?: () => void;
  rematchOffer?: {
    byMe: boolean;
    byOpponent: boolean;
    onDecline: () => void;
  };
  ratingChange?: {
    diff: number;
    newRating: number;
  };
  playerColor?: 'white' | 'black';
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ 
  result, 
  onReview, 
  onHome, 
  onRematch, 
  onViewBoard,
  rematchOffer, 
  ratingChange,
  playerColor 
}) => {
  let mainText = 'Game Over';
  let subText = result;
  let outcomeType: 'win' | 'loss' | 'draw' | 'neutral' = 'neutral';
  let reasonBadge = '';

  const lower = result.toLowerCase();

  if (lower.includes('checkmate')) {
    mainText = 'Checkmate';
    reasonBadge = 'Checkmate';
    if (lower.includes('white wins')) {
      subText = 'White wins by Checkmate';
      outcomeType = playerColor ? (playerColor === 'white' ? 'win' : 'loss') : 'neutral';
    } else if (lower.includes('black wins')) {
      subText = 'Black wins by Checkmate';
      outcomeType = playerColor ? (playerColor === 'black' ? 'win' : 'loss') : 'neutral';
    }
  } else if (lower.includes('stalemate')) {
    mainText = 'Draw';
    subText = 'Game drawn by Stalemate';
    reasonBadge = 'Stalemate';
    outcomeType = 'draw';
  } else if (lower.includes('threefold') || lower.includes('repetition')) {
    mainText = 'Draw';
    subText = 'Game drawn by Threefold Repetition';
    reasonBadge = 'Threefold Repetition';
    outcomeType = 'draw';
  } else if (lower.includes('50') || lower.includes('fifty')) {
    mainText = 'Draw';
    subText = 'Game drawn by 50-Move Rule';
    reasonBadge = '50-Move Rule';
    outcomeType = 'draw';
  } else if (lower.includes('insufficient')) {
    mainText = 'Draw';
    subText = 'Game drawn by Insufficient Material';
    reasonBadge = 'Insufficient Material';
    outcomeType = 'draw';
  } else if (lower.includes('agreement') || (lower.includes('draw') && !lower.includes('wins'))) {
    mainText = 'Draw';
    subText = result.includes('agreement') ? 'Draw agreed by mutual agreement' : result;
    reasonBadge = 'Draw Agreement';
    outcomeType = 'draw';
  } else if (lower.includes('time') || lower.includes('clock')) {
    mainText = 'Time Forfeit';
    reasonBadge = 'Time Expired';
    if (lower.includes('white wins') || lower.includes('black wins')) {
      subText = result;
      const winnerIsWhite = lower.includes('white wins');
      outcomeType = playerColor ? (playerColor === (winnerIsWhite ? 'white' : 'black') ? 'win' : 'loss') : 'neutral';
    } else {
      subText = 'Draw — timeout with insufficient material';
      outcomeType = 'draw';
    }
  } else if (lower.includes('resign')) {
    mainText = 'Resignation';
    reasonBadge = 'Resignation';
    if (lower.includes('white') && (lower.includes('win') || lower.includes('won'))) {
      subText = 'White wins by Resignation';
      outcomeType = playerColor ? (playerColor === 'white' ? 'win' : 'loss') : 'neutral';
    } else if (lower.includes('black') && (lower.includes('win') || lower.includes('won'))) {
      subText = 'Black wins by Resignation';
      outcomeType = playerColor ? (playerColor === 'black' ? 'win' : 'loss') : 'neutral';
    } else if (lower.includes('white resigned')) {
      subText = 'White resigned — Black wins';
      outcomeType = playerColor ? (playerColor === 'black' ? 'win' : 'loss') : 'neutral';
    } else if (lower.includes('black resigned')) {
      subText = 'Black resigned — White wins';
      outcomeType = playerColor ? (playerColor === 'white' ? 'win' : 'loss') : 'neutral';
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg animate-fade-in p-4">
      <div className="glass-panel border-none ring-1 ring-border-1/50 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-5 max-w-[92%] w-[340px] animate-scale-in relative">
        
        {/* Close / Dismiss button to inspect board */}
        {onViewBoard && (
          <button 
            onClick={onViewBoard}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors"
            title="Inspect Board"
          >
            <X size={18} />
          </button>
        )}

        {/* Outcome Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-2">
            {outcomeType === 'win' ? (
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Trophy size={24} />
              </div>
            ) : outcomeType === 'loss' ? (
              <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Award size={24} />
              </div>
            ) : outcomeType === 'draw' ? (
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Minus size={24} />
              </div>
            ) : null}
          </div>

          <h2 className="text-2xl font-black text-content-1 tracking-tight">{mainText}</h2>
          <p className="text-content-3 text-sm mt-1 font-medium">{subText}</p>

          {reasonBadge && (
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-3 text-content-2 border border-border-1">
              {reasonBadge}
            </span>
          )}
          
          {ratingChange && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-lg font-bold text-content-1">{ratingChange.newRating}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                ratingChange.diff > 0 ? 'bg-success/20 text-success' : 
                ratingChange.diff < 0 ? 'bg-error/20 text-error' : 
                'bg-surface-3 text-content-3'
              }`}>
                {ratingChange.diff > 0 ? '+' : ''}{ratingChange.diff}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 w-full">
          {onReview && (
            <Button 
              onClick={onReview}
              className="bg-accent hover:bg-accent-hover text-white shadow-md border-transparent font-bold"
              fullWidth
            >
              <BarChart2 size={18} className="mr-2" /> Review Game
            </Button>
          )}
          
          {onRematch && !rematchOffer?.byMe && !rematchOffer?.byOpponent && (
            <Button 
              onClick={onRematch}
              variant="primary"
              fullWidth
            >
              <RotateCcw size={18} className="mr-2" /> Rematch
            </Button>
          )}

          {rematchOffer?.byMe && (
            <Button 
              disabled
              variant="secondary"
              fullWidth
            >
              <RotateCcw size={18} className="mr-2 animate-spin" /> Rematch Requested...
            </Button>
          )}

          {rematchOffer?.byOpponent && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button 
                onClick={onRematch}
                className="bg-success hover:bg-success text-white shadow-md border-transparent"
                fullWidth
              >
                <Check size={18} className="mr-2" /> Accept Rematch
              </Button>
              <Button 
                onClick={rematchOffer.onDecline}
                variant="destructive"
                fullWidth
              >
                <X size={18} className="mr-2" /> Decline
              </Button>
            </div>
          )}

          {onViewBoard && (
            <Button 
              onClick={onViewBoard}
              variant="secondary"
              fullWidth
            >
              <Eye size={18} className="mr-2" /> View Board
            </Button>
          )}

          {onHome && (
            <Button 
              onClick={onHome}
              variant="outline"
              fullWidth
            >
              <Home size={18} className="mr-2" /> Main Menu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
