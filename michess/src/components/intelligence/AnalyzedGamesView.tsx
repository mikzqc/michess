import React from 'react';
import { 
  Clock, 
  Sparkles, 
  Eye
} from 'lucide-react';
import type { GameIntelligenceAnalysis } from '../../types/intelligence';
import type { HistoryGame } from '../../types/history';

interface AnalyzedGamesViewProps {
  analyses: GameIntelligenceAnalysis[];
  allHistoryGames: HistoryGame[];
  onOpenReview: (pgn: string) => void;
  onAnalyzeGame: (game: HistoryGame) => void;
  isAnalyzingBatch: boolean;
}

export const AnalyzedGamesView: React.FC<AnalyzedGamesViewProps> = ({
  analyses,
  allHistoryGames,
  onOpenReview,
  onAnalyzeGame,
  isAnalyzingBatch
}) => {
  const analyzedMap = new Map<string, GameIntelligenceAnalysis>();
  analyses.forEach(a => analyzedMap.set(a.gameId, a));

  return (
    <div className="space-y-6">
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-content-1 mb-1">
          Games & Move-by-Move Evaluations
        </h3>
        <p className="text-xs text-content-3">
          Every game evaluated with Stockfish. Open any game in full interactive review to explore engine alternatives and the full evaluation graph.
        </p>
      </div>

      <div className="space-y-3">
        {allHistoryGames.length === 0 ? (
          <div className="bg-surface-2 border border-border-1 rounded-2xl p-8 text-center text-content-3 text-xs">
            No games in your match history yet. Play a game against the computer or online to generate analysis!
          </div>
        ) : (
          allHistoryGames.map((game) => {
            const analysis = analyzedMap.get(game.id);
            const isAnalyzed = !!analysis;

            return (
              <div
                key={game.id}
                className="bg-surface-2 border border-border-1 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-accent/40 transition-colors shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-content-1">
                      {game.white || 'White'} vs {game.black || 'Black'}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-3 text-content-2">
                      {game.result}
                    </span>
                    <span className="text-[11px] text-content-3 font-mono">
                      {game.date}
                    </span>
                    {analysis?.opening && (
                      <span className="text-[11px] font-mono text-accent font-semibold">
                        {analysis.opening.name} ({analysis.opening.eco})
                      </span>
                    )}
                  </div>

                  {isAnalyzed ? (
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-content-1 font-bold">
                        Accuracy: <span className="text-accent">{analysis.userAccuracy}%</span>
                      </span>
                      <span className="text-content-3">•</span>
                      <span className="text-content-2">
                        ACPL: <span className="text-content-1 font-bold">{analysis.userAcpl} cp</span>
                      </span>
                      <span className="text-content-3">•</span>
                      <span className="text-content-2">
                        Mistakes: <span className="text-amber-400 font-bold">{analysis.mistakes.length}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-content-3 font-mono">
                      <Clock size={13} />
                      <span>Pending Engine Review</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isAnalyzed ? (
                    <button
                      onClick={() => onOpenReview(game.pgn)}
                      className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <Eye size={14} />
                      <span>Interactive Review</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onAnalyzeGame(game)}
                      disabled={isAnalyzingBatch}
                      className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-surface-3/80 disabled:opacity-40 text-content-1 text-xs font-semibold transition-colors border border-border-1 cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles size={14} className="text-accent" />
                      <span>Analyze Now</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
