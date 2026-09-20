import React from 'react';
import { BarChart2, Home, RotateCcw, Check, X } from 'lucide-react';
import { Button } from './ui/Button';

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
      <div className="bg-surface-2 border border-border-1 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-[90%] w-[320px] animate-scale-in">
        <div className="text-center">
          <h2 className="text-3xl font-black text-content-1 tracking-tight">{mainText}</h2>
          <p className="text-content-3 mt-1 font-medium">{subText}</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {onReview && (
            <Button 
              onClick={onReview}
              className="bg-success hover:bg-success text-white shadow-lg border-transparent"
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
              <RotateCcw size={18} className="mr-2" /> Play Again
            </Button>
          )}

          {rematchOffer?.byMe && (
            <Button 
              disabled
              variant="secondary"
              fullWidth
            >
              <RotateCcw size={18} className="mr-2" /> Offer Sent...
            </Button>
          )}

          {rematchOffer?.byOpponent && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button 
                onClick={onRematch}
                className="bg-success hover:bg-success text-white shadow-lg border-transparent"
                fullWidth
              >
                <Check size={18} className="mr-2" /> Accept
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

          {onHome && (
            <Button 
              onClick={onHome}
              variant="outline"
              fullWidth
            >
              <Home size={18} className="mr-2" /> Back to Menu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
