import React from 'react';
import { Move } from 'chess.js';

interface MoveHistoryProps {
  history: Move[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ history }) => {
  // Group moves into pairs (White, Black)
  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      white: history[i],
      black: history[i + 1] || null,
      moveNumber: Math.floor(i / 2) + 1,
    });
  }

  return (
    <div className="bg-chess-panel border border-chess-border rounded-lg overflow-hidden flex flex-col h-full">
      <div className="bg-chess-border py-2 px-4 font-semibold text-sm">
        Move History
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
        {movePairs.map((pair, idx) => (
          <div key={idx} className="flex text-sm hover:bg-chess-border/50 transition-colors rounded px-2 py-1 animate-fade-in">
            <span className="w-8 text-gray-500">{pair.moveNumber}.</span>
            <span className="w-20 font-medium">{pair.white.san}</span>
            <span className="w-20 font-medium">{pair.black?.san || ''}</span>
          </div>
        ))}
        {movePairs.length === 0 && (
          <div className="text-gray-500 text-sm text-center mt-4">No moves played yet.</div>
        )}
      </div>
    </div>
  );
};