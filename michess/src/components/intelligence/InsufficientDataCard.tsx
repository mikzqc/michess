import React from 'react';
import { Sparkles, Brain, Play, Upload } from 'lucide-react';
import { Button } from '../ui/Button';

interface InsufficientDataCardProps {
  analyzedCount: number;
  totalGames: number;
  onStartAnalysis: () => void;
  onPlayGame: () => void;
  onImportGame: () => void;
}

export const InsufficientDataCard: React.FC<InsufficientDataCardProps> = ({
  analyzedCount,
  totalGames,
  onStartAnalysis,
  onPlayGame,
  onImportGame
}) => {
  return (
    <div className="bg-surface-2 border border-border-1 rounded-2xl p-6 sm:p-8 text-center max-w-2xl mx-auto shadow-xl">
      <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto mb-5 shadow-sm">
        <Brain size={32} />
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-content-1 mb-2 tracking-tight">
        Engine Analysis Required
      </h2>

      <p className="text-sm text-content-2 max-w-lg mx-auto mb-6 leading-relaxed">
        To provide authentic, reliable game intelligence without fabricating guesses, Michess needs at least <strong>3 analyzed games</strong>. 
        Currently, you have <strong>{analyzedCount}</strong> analyzed out of <strong>{totalGames}</strong> games in your history.
      </p>

      {totalGames > 0 ? (
        <div className="bg-surface-3/70 border border-border-1 rounded-xl p-5 mb-6 text-left">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-content-2">Analysis Progress</span>
            <span className="text-accent font-bold">{analyzedCount} / 3 recommended</span>
          </div>
          <div className="w-full h-2.5 bg-surface-1 rounded-full overflow-hidden border border-border-1/60 mb-3">
            <div 
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, Math.round((analyzedCount / 3) * 100))}%` }}
            />
          </div>
          <p className="text-[12px] text-content-3">
            Stockfish will evaluate every position asynchronously, calculate your centipawn loss, identify hanging pieces, and detect your personal weaknesses.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {totalGames > 0 ? (
          <Button
            variant="primary"
            onClick={onStartAnalysis}
            className="w-full sm:w-auto px-6 py-3 text-sm font-bold shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            <span>Analyze My Games with Stockfish</span>
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={onPlayGame}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={16} />
              <span>Play a Game</span>
            </Button>
            <Button
              variant="secondary"
              onClick={onImportGame}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              <span>Import PGN</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
