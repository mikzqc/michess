import React, { useMemo } from 'react';
import type { AnalyzedMove } from '../types/review';
import { MoveClassificationBadge } from './MoveClassificationBadge';
import { CLASSIFICATIONS, type MoveClassificationType } from '../types/classification';

interface ReviewStatsProps {
  analyzedMoves: AnalyzedMove[];
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  overallAccuracy: number | null;
  openingName?: string;
  openingEco?: string;
  onMoveSelect: (index: number) => void;
}

export const ReviewStats: React.FC<ReviewStatsProps> = ({ analyzedMoves, whiteAccuracy, blackAccuracy, overallAccuracy, openingName, openingEco, onMoveSelect }) => {
  const stats = useMemo<{ counts: Record<string, { w: number; b: number }>; biggestMistakeMove: AnalyzedMove | null }>(() => {
    const counts: Record<string, { w: number; b: number }> = {};
    Object.keys(CLASSIFICATIONS).forEach(key => {
      counts[key] = { w: 0, b: 0 };
    });

    let biggestMistakeMove: AnalyzedMove | null = null;
    let maxLoss = -1;

    analyzedMoves.forEach(m => {
      if (m.classification && counts[m.classification]) {
        counts[m.classification][m.color]++;
      }

      // Biggest Mistake
      if (m.evalLoss > maxLoss) {
        maxLoss = m.evalLoss;
        biggestMistakeMove = m;
      }
    });

    return { counts, biggestMistakeMove };
  }, [analyzedMoves]);

  return (
    <div className="bg-surface-2 border border-border-1 p-4 rounded-lg flex flex-col gap-4">
      {openingName && (
        <div className="text-center bg-surface-1/50 p-2 rounded border border-border-1/50">
          <div className="text-xs text-content-3 uppercase tracking-wider font-bold mb-1">Opening</div>
          <div className="text-sm font-semibold text-slate-200">{openingEco ? `${openingEco} ` : ''}{openingName}</div>
        </div>
      )}
      
      {/* Accuracy Section */}
      <div className="grid grid-cols-3 text-center divide-x divide-slate-700">
        <div className="flex flex-col">
          <span className="text-sm text-content-3">White</span>
          <span className="text-xl font-bold text-content-1">{whiteAccuracy?.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-content-3">Black</span>
          <span className="text-xl font-bold text-content-1">{blackAccuracy?.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-content-3">Overall</span>
          <span className="text-xl font-bold text-success">{overallAccuracy?.toFixed(1)}%</span>
        </div>
      </div>

      <div className="border-t border-border-1"></div>

      {/* Classifications */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 text-sm">
          {['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'].map((key) => (
            <div key={key} className="flex justify-between items-center text-content-2">
              <div className="flex items-center gap-2">
                <MoveClassificationBadge classification={key as MoveClassificationType} />
                <span className="hidden sm:inline">{CLASSIFICATIONS[key as MoveClassificationType].name}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-4 text-right">{stats.counts[key].w}</span>
                <span className="w-4 text-right text-content-3">{stats.counts[key].b}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Stats */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface-1/50 p-2 rounded border border-border-1 text-sm">
            <div className="text-content-3 mb-1">Total Moves</div>
            <div className="font-bold text-content-1">{analyzedMoves.length}</div>
          </div>

          {stats.biggestMistakeMove && stats.biggestMistakeMove.evalLoss > 50 && (
            <div 
              className="bg-error/10 p-2 rounded border border-error/50 text-sm cursor-pointer hover:bg-red-900/40 transition-colors"
              onClick={() => {
                const idx = analyzedMoves.indexOf(stats.biggestMistakeMove!);
                if (idx !== -1) onMoveSelect(idx);
              }}
            >
              <div className="text-error font-bold mb-1 flex items-center gap-1">
                Biggest Mistake
              </div>
              <div className="font-bold text-content-1">
                {stats.biggestMistakeMove.moveNumber}. {stats.biggestMistakeMove.color === 'b' ? '...' : ''} {stats.biggestMistakeMove.san}
              </div>
              <div className="text-content-2">
                Loss: {(stats.biggestMistakeMove.evalLoss / 100).toFixed(2)}
              </div>
              {stats.biggestMistakeMove.accuracy !== undefined && (
                <div className="text-content-2">
                  Accuracy: {stats.biggestMistakeMove.accuracy.toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
