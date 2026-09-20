import React from 'react';
import { getCustomPieces } from '../utils/themes';

interface PromotionDialogProps {
  color: 'w' | 'b';
  pieceSet: 'default' | 'alpha' | 'merida';
  onSelect: (piece: 'q' | 'r' | 'n' | 'b') => void;
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({ color, pieceSet, onSelect }) => {
  const pieces = getCustomPieces(pieceSet);
  
  const renderPiece = (type: 'Q' | 'R' | 'N' | 'B', internalName: 'q' | 'r' | 'n' | 'b') => {
    const key = `${color}${type}`;
    if (pieces && pieces[key]) {
      const PieceComp = pieces[key];
      return (
        <button 
          className="w-16 h-16 bg-surface-3 hover:bg-border-1 rounded-lg flex items-center justify-center p-2 transition-colors cursor-pointer"
          onClick={() => onSelect(internalName)}
        >
          <PieceComp squareWidth="100%" />
        </button>
      );
    }
    
    // Fallback if default (using standard unicode or text)
    const unicodeMap: any = {
      wQ: '♕', wR: '♖', wB: '♗', wN: '♘',
      bQ: '♛', bR: '♜', bB: '♝', bN: '♞',
    };
    return (
      <button 
        className="w-16 h-16 bg-surface-3 hover:bg-border-1 rounded-lg flex items-center justify-center text-4xl transition-colors cursor-pointer text-content-1"
        onClick={() => onSelect(internalName)}
      >
        {unicodeMap[key]}
      </button>
    );
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg animate-fade-in">
      <div className="bg-surface-2 border border-border-1 p-4 rounded-xl shadow-2xl flex gap-2 animate-scale-in">
        {renderPiece('Q', 'q')}
        {renderPiece('N', 'n')}
        {renderPiece('R', 'r')}
        {renderPiece('B', 'b')}
      </div>
    </div>
  );
};
