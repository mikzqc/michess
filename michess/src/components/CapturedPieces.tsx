import React from 'react';
import { getCustomPieces } from '../utils/themes';

interface CapturedPiecesProps {
  pieces: string[]; // e.g., ['q', 'p', 'p'] or ['Q', 'P', 'P']
  advantage: number; // e.g. +3
  pieceSet: string;
}

const PIECE_MAP: Record<string, string> = {
  'p': 'bP', 'n': 'bN', 'b': 'bB', 'r': 'bR', 'q': 'bQ',
  'P': 'wP', 'N': 'wN', 'B': 'wB', 'R': 'wR', 'Q': 'wQ'
};

const SORT_ORDER: Record<string, number> = {
  'q': 1, 'r': 2, 'b': 3, 'n': 4, 'p': 5,
  'Q': 1, 'R': 2, 'B': 3, 'N': 4, 'P': 5
};

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({ pieces, advantage, pieceSet }) => {
  const customPieces = getCustomPieces(pieceSet);
  
  if (pieces.length === 0 && advantage === 0) {
    return <div className="h-6"></div>;
  }

  // Sort pieces: Q, R, B, N, P
  const sortedPieces = [...pieces].sort((a, b) => SORT_ORDER[a] - SORT_ORDER[b]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 min-h-[1.5rem] max-w-[200px] sm:max-w-[300px] animate-fade-in">
      {sortedPieces.map((piece, i) => {
        const key = PIECE_MAP[piece];
        const PieceComp = customPieces ? customPieces[key] : null;
        
        return (
          <div key={`${piece}-${i}`} className="w-4 h-4 md:w-5 md:h-5">
            {PieceComp ? (
              <PieceComp squareWidth="100%" />
            ) : (
              <span className="text-sm">?</span>
            )}
          </div>
        );
      })}
      
      {advantage > 0 && (
        <span className="text-xs md:text-sm font-bold text-content-2 ml-1.5 opacity-90 transition-opacity">
          +{advantage}
        </span>
      )}
    </div>
  );
};
