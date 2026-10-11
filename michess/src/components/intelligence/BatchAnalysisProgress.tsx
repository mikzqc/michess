import React from 'react';
import { Loader2, X } from 'lucide-react';
import type { BatchProgress } from '../../hooks/useGameIntelligence';

interface BatchAnalysisProgressProps {
  progress: BatchProgress;
  onCancel: () => void;
}

export const BatchAnalysisProgress: React.FC<BatchAnalysisProgressProps> = ({ progress, onCancel }) => {
  const percent = progress.totalMoves > 0 
    ? Math.min(100, Math.round((progress.currentMoveIndex / progress.totalMoves) * 100))
    : 0;

  return (
    <div className="bg-surface-2 border-2 border-accent/40 rounded-2xl p-4 sm:p-5 shadow-2xl animate-fade-in relative overflow-hidden mb-6">
      <div className="absolute top-0 left-0 bottom-0 bg-accent/5 pointer-events-none" style={{ width: `${percent}%` }} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 text-accent flex items-center justify-center shrink-0">
            <Loader2 size={20} className="animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-content-1">
                Analyzing Game {progress.currentGameIndex} of {progress.totalGames}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold">
                {percent}%
              </span>
            </div>
            <p className="text-xs text-content-3 truncate max-w-xs sm:max-w-md">
              {progress.gameTitle} • Move {progress.currentMoveIndex}/{progress.totalMoves}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-red-950/40 text-content-3 hover:text-red-300 border border-border-1 hover:border-red-800/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <X size={14} />
          <span>Stop Analysis</span>
        </button>
      </div>

      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden mt-3.5 border border-border-1/40 relative z-10">
        <div 
          className="h-full bg-accent transition-all duration-300 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
