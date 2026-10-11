import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Play, 
  CheckCircle2, 
  TrendingDown
} from 'lucide-react';
import type { DetectedMistake, MistakeType } from '../../types/intelligence';

interface RecurringMistakesViewProps {
  mistakes: DetectedMistake[];
  blunderedPieces: Record<'q' | 'r' | 'b' | 'n' | 'p', number>;
  onPracticeMistake: (mistake: DetectedMistake) => void;
}

export const RecurringMistakesView: React.FC<RecurringMistakesViewProps> = ({
  mistakes,
  blunderedPieces,
  onPracticeMistake
}) => {
  const [filterType, setFilterType] = useState<MistakeType | 'all'>('all');

  const filtered = mistakes.filter(m => filterType === 'all' || m.type === filterType);

  const getMistakeTypeBadge = (type: MistakeType) => {
    switch (type) {
      case 'hanging_piece':
        return { label: 'Hanging Piece', bg: 'bg-red-950/60 text-red-300 border-red-800/60' };
      case 'missed_mate':
        return { label: 'Missed Checkmate', bg: 'bg-rose-950/60 text-rose-300 border-rose-800/60' };
      case 'missed_tactic':
        return { label: 'Missed Tactic', bg: 'bg-amber-950/60 text-amber-300 border-amber-800/60' };
      case 'opening_advantage_loss':
        return { label: 'Opening Advantage Loss', bg: 'bg-blue-950/60 text-blue-300 border-blue-800/60' };
      case 'endgame_mistake':
        return { label: 'Endgame Decision', bg: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' };
      default:
        return { label: 'Blunder', bg: 'bg-orange-950/60 text-orange-300 border-orange-800/60' };
    }
  };

  const totalHanging = Object.values(blunderedPieces).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* 1. Blundered Pieces Without Compensation Card */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-content-1 flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-400" />
              <span>Pieces Lost Without Compensation</span>
            </h3>
            <p className="text-xs text-content-3">
              Tracking hanging pieces left unprotected or surrendered to cheaper enemy attackers
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-3 py-1 rounded-full">
            {totalHanging} Total Hanging Pieces
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          {/* Queen */}
          <div className="bg-surface-3/60 border border-border-1 rounded-xl p-3 text-center">
            <span className="text-xs font-bold text-content-2 block mb-1">♛ Queen</span>
            <span className={`text-xl font-black font-mono block ${blunderedPieces.q > 0 ? 'text-red-400' : 'text-content-3'}`}>
              {blunderedPieces.q}
            </span>
            <span className="text-[10px] text-content-3">9 pts value</span>
          </div>

          {/* Rook */}
          <div className="bg-surface-3/60 border border-border-1 rounded-xl p-3 text-center">
            <span className="text-xs font-bold text-content-2 block mb-1">♜ Rook</span>
            <span className={`text-xl font-black font-mono block ${blunderedPieces.r > 0 ? 'text-red-400' : 'text-content-3'}`}>
              {blunderedPieces.r}
            </span>
            <span className="text-[10px] text-content-3">5 pts value</span>
          </div>

          {/* Bishop */}
          <div className="bg-surface-3/60 border border-border-1 rounded-xl p-3 text-center">
            <span className="text-xs font-bold text-content-2 block mb-1">♝ Bishop</span>
            <span className={`text-xl font-black font-mono block ${blunderedPieces.b > 0 ? 'text-red-400' : 'text-content-3'}`}>
              {blunderedPieces.b}
            </span>
            <span className="text-[10px] text-content-3">3 pts value</span>
          </div>

          {/* Knight */}
          <div className="bg-surface-3/60 border border-border-1 rounded-xl p-3 text-center">
            <span className="text-xs font-bold text-content-2 block mb-1">♞ Knight</span>
            <span className={`text-xl font-black font-mono block ${blunderedPieces.n > 0 ? 'text-red-400' : 'text-content-3'}`}>
              {blunderedPieces.n}
            </span>
            <span className="text-[10px] text-content-3">3 pts value</span>
          </div>

          {/* Pawn */}
          <div className="bg-surface-3/60 border border-border-1 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-content-2 block mb-1">♟ Pawn</span>
            <span className={`text-xl font-black font-mono block ${blunderedPieces.p > 0 ? 'text-amber-400' : 'text-content-3'}`}>
              {blunderedPieces.p}
            </span>
            <span className="text-[10px] text-content-3">1 pt value</span>
          </div>
        </div>
      </div>

      {/* 2. Recurring Mistakes Filter & Feed */}
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-content-1 flex items-center gap-2">
              <TrendingDown size={18} className="text-amber-400" />
              <span>Recurring Mistake Feed</span>
            </h3>
            <p className="text-xs text-content-3">
              Actual moments from your games where an advantage was squandered or tactical opportunity was missed
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
            {(['all', 'hanging_piece', 'missed_mate', 'missed_tactic', 'opening_advantage_loss', 'endgame_mistake'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  filterType === f
                    ? 'bg-accent text-white font-bold'
                    : 'bg-surface-3 text-content-2 hover:text-content-1'
                }`}
              >
                {f === 'all' ? 'All Mistakes' : f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 bg-surface-3/30 border border-border-1/40 rounded-xl">
            <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-content-1">No Mistakes Found In This Category</p>
            <p className="text-xs text-content-3 mt-1">
              Your analyzed games demonstrate solid precision in this area.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(m => {
              const badge = getMistakeTypeBadge(m.type);

              return (
                <div
                  key={m.id}
                  className="bg-surface-3/60 border border-border-1 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-accent/40 transition-colors"
                >
                  <div className="text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className="font-semibold text-content-1">vs {m.opponent}</span>
                      <span className="text-[11px] text-content-3">({m.date})</span>
                      <span className="font-mono text-content-3 font-semibold">Phase: {m.phase}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-mono">
                      <span className="text-red-400 font-bold">
                        Move {m.moveNumber}: {m.san}
                      </span>
                      <span className="text-content-3">→</span>
                      <span className="text-red-400/90 font-bold">
                        -{m.evalLoss} cp loss
                      </span>
                      {m.bestMove && m.bestMove !== '(none)' && (
                        <>
                          <span className="text-content-3">•</span>
                          <span className="text-green-400 font-bold">
                            Engine Best: {m.bestMove}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-content-3 text-[11px] pt-0.5">
                      {m.explanation}
                    </p>
                  </div>

                  <button
                    onClick={() => onPracticeMistake(m)}
                    className="self-end sm:self-center px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs transition-all shadow-sm hover:bg-accent-hover cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Play size={14} />
                    <span>Train This Move</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
