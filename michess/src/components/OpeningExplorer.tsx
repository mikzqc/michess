import React, { useMemo, useState } from 'react';
import type { HistoryGame } from '../types/history';
import { Chess } from 'chess.js';

interface OpeningExplorerProps {
  history: HistoryGame[];
  targetPlayerName: string;
}

interface MoveStats {
  san: string;
  games: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  winRateForTarget: number;
  fen: string;
}

export const OpeningExplorer: React.FC<OpeningExplorerProps> = ({ history, targetPlayerName }) => {
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Calculate stats for the current position
  const currentOptions = useMemo(() => {
    const nextMoves = new Map<string, MoveStats>();
    
    // We only analyze games that match the exact move sequence we've played so far
    const relevantGames = history.filter(g => g.source !== 'local' && g.pgn);
    
    let totalPositions = 0;
    
    for (const game of relevantGames) {
      const chess = new Chess();
      try {
        chess.loadPgn(game.pgn);
      } catch (e) {
        continue;
      }
      
      const gameMoves = chess.history();
      
      // Check if this game follows our current sequence
      let matches = true;
      for (let i = 0; i < moveHistory.length; i++) {
        if (gameMoves[i] !== moveHistory[i]) {
          matches = false;
          break;
        }
      }
      
      if (!matches) continue;
      totalPositions++;
      
      // If there's a next move in this game, record its stats
      const nextMove = gameMoves[moveHistory.length];
      if (!nextMove) continue;
      
      const isTargetWhite = game.white === targetPlayerName;
      const isTargetBlack = game.black === targetPlayerName;
      const won = (isTargetWhite && game.result === '1-0') || (isTargetBlack && game.result === '0-1');
      
      if (!nextMoves.has(nextMove)) {
        // Calculate the FEN if we play this move
        const tempChess = new Chess(currentFen);
        try {
          tempChess.move(nextMove);
          nextMoves.set(nextMove, {
            san: nextMove,
            games: 0,
            whiteWins: 0,
            blackWins: 0,
            draws: 0,
            winRateForTarget: 0,
            fen: tempChess.fen()
          });
        } catch(e) {
          continue;
        }
      }
      
      const stats = nextMoves.get(nextMove)!;
      stats.games++;
      if (game.result === '1-0') stats.whiteWins++;
      else if (game.result === '0-1') stats.blackWins++;
      else stats.draws++;
      
      if (isTargetWhite || isTargetBlack) {
          if (won) stats.winRateForTarget += 1; // Used as counter temporarily
      }
    }
    
    // Finalize win rate for target player
    const sortedOptions = Array.from(nextMoves.values()).map(opt => {
        const targetWins = opt.winRateForTarget; // Since we added 1 for each win
        
        return {
            ...opt,
            winRateForTarget: opt.games > 0 ? Math.round((targetWins / opt.games) * 100) : 0
        }
    }).sort((a, b) => b.games - a.games);
    
    return { options: sortedOptions, totalPositions };
  }, [history, moveHistory, targetPlayerName, currentFen]);

  const handleMoveClick = (san: string, fen: string) => {
    setMoveHistory([...moveHistory, san]);
    setCurrentFen(fen);
  };

  const handleBack = () => {
    if (moveHistory.length === 0) return;
    const newHistory = moveHistory.slice(0, -1);
    const chess = new Chess();
    for (const move of newHistory) {
      try { chess.move(move); } catch(e) { break; }
    }
    setMoveHistory(newHistory);
    setCurrentFen(chess.fen());
  };

  const handleReset = () => {
    setMoveHistory([]);
    setCurrentFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  }

  return (
    <div className="bg-surface-1 rounded-xl border border-border-1 p-4 md:p-6 shadow-sm overflow-hidden flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-content-1">Opening Explorer</h3>
          <p className="text-sm text-content-3">Explore lines played in {currentOptions.totalPositions} games</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleBack}
              disabled={moveHistory.length === 0}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-content-2 text-sm rounded-md font-bold transition-colors"
            >
              Back
            </button>
            <button 
              onClick={handleReset}
              disabled={moveHistory.length === 0}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-content-2 text-sm rounded-md font-bold transition-colors"
            >
              Reset
            </button>
        </div>
      </div>
      
      {moveHistory.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm font-mono p-3 bg-surface-2 rounded-lg border border-border-1">
          {moveHistory.map((m, i) => (
            <span key={i} className="text-content-2">
              {i % 2 === 0 ? <span className="text-content-3 mr-1">{Math.floor(i / 2) + 1}.</span> : null}
              {m}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-1">
              <th className="py-2 px-4 text-content-3 font-medium text-sm">Move</th>
              <th className="py-2 px-4 text-content-3 font-medium text-sm">Games</th>
              <th className="py-2 px-4 text-content-3 font-medium text-sm">Win % (Target)</th>
              <th className="py-2 px-4 text-content-3 font-medium text-sm w-48">Result Distribution (W/D/B)</th>
            </tr>
          </thead>
          <tbody>
            {currentOptions.options.map(opt => {
              const wPct = (opt.whiteWins / opt.games) * 100;
              const dPct = (opt.draws / opt.games) * 100;
              const bPct = (opt.blackWins / opt.games) * 100;

              return (
                <tr 
                  key={opt.san} 
                  onClick={() => handleMoveClick(opt.san, opt.fen)}
                  className="border-b border-border-1/50 hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-content-1">{opt.san}</td>
                  <td className="py-3 px-4 text-content-2">{opt.games}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      opt.winRateForTarget > 50 ? 'bg-emerald-500/20 text-emerald-400' :
                      opt.winRateForTarget < 40 ? 'bg-rose-500/20 text-rose-400' :
                      'bg-surface-3 text-content-2'
                    }`}>
                      {opt.winRateForTarget}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex h-2 rounded-full overflow-hidden w-full bg-surface-3">
                      <div style={{ width: `${wPct}%` }} className="bg-white/80" />
                      <div style={{ width: `${dPct}%` }} className="bg-content-3" />
                      <div style={{ width: `${bPct}%` }} className="bg-black/80" />
                    </div>
                  </td>
                </tr>
              );
            })}
            {currentOptions.options.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-content-3 italic">
                  No games found in this line.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
