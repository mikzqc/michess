import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Sparkles, 
  RefreshCw, 
  Target, 
  ShieldAlert, 
  Lightbulb, 
  Compass, 
  Eye, 
  Layers, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle
} from 'lucide-react';
import type { AnalyzedMove } from '../../types/review';
import type { CoachExplanation, CoachMoveEvidence } from '../../types/coach';
import { extractCoachMoveEvidence } from '../../utils/coachEvidence';
import { coachService } from '../../services/coachService';
import { MoveClassificationBadge } from '../MoveClassificationBadge';
import { CLASSIFICATIONS } from '../../types/classification';
import { Button } from '../ui/Button';

interface CoachPanelProps {
  currentMoveIndex: number;
  analyzedMoves: AnalyzedMove[];
  gameTitle?: string;
  openingName?: string;
  openingEco?: string;
  onSelectMove: (index: number) => void;
  onShowBestMoveArrow?: (show: boolean) => void;
  onExploreLine?: (pvMoves: string[]) => void;
  isExploringAlternative?: boolean;
  onExitExploration?: () => void;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({
  currentMoveIndex,
  analyzedMoves,
  gameTitle,
  openingName,
  openingEco,
  onSelectMove,
  onShowBestMoveArrow,
  onExploreLine,
  isExploringAlternative,
  onExitExploration
}) => {
  const [explanation, setExplanation] = useState<CoachExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoExplain, setAutoExplain] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const currentMove = currentMoveIndex >= 0 ? analyzedMoves[currentMoveIndex] : null;

  // Build verified evidence for the current move
  const currentEvidence: CoachMoveEvidence | null = currentMove ? (
    extractCoachMoveEvidence(currentMove, {
      gameTitle,
      openingName,
      openingEco
    })
  ) : null;

  // Load explanation for current move
  const fetchExplanation = useCallback(async (evidence: CoachMoveEvidence, forceRefresh = false) => {
    setIsLoading(true);
    setErrorNotice(null);

    try {
      const result = await coachService.getExplanation(evidence, { forceRefresh });
      setExplanation(result);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to load coach explanation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync when current move index changes
  useEffect(() => {
    if (!currentEvidence) {
      setExplanation(null);
      return;
    }

    // Check synchronous cache first
    const cached = coachService.getCachedExplanation(currentEvidence);
    if (cached) {
      setExplanation(cached);
      return;
    }

    if (autoExplain) {
      fetchExplanation(currentEvidence);
    } else {
      setExplanation(null);
    }
  }, [currentMoveIndex, autoExplain, fetchExplanation]);

  if (analyzedMoves.length === 0) {
    return (
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 text-center text-content-3 text-xs">
        <Bot size={28} className="text-accent mx-auto mb-2 opacity-60" />
        <p className="font-semibold text-content-2">AI Coach Standing By</p>
        <p className="mt-1">Analysis in progress. The coach will analyze every move once engine evaluation finishes.</p>
      </div>
    );
  }

  if (currentMoveIndex === -1) {
    return (
      <div className="bg-surface-2 border border-border-1 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-content-1 flex items-center gap-1.5">
                <span>AI Chess Coach</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent/10 text-accent border border-accent/20">
                  TokenReply
                </span>
              </h3>
              <p className="text-[11px] text-content-3">Initial Position</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-content-2 leading-relaxed">
          Welcome to Game Review! Click <span className="font-semibold text-content-1">Next Move</span> or select any move from the list or evaluation graph to view deep, move-by-move coaching explanations.
        </p>

        {analyzedMoves.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSelectMove(0)}
            className="w-full text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-2"
          >
            <span>Start Review with Move 1</span>
            <ChevronRight size={14} />
          </Button>
        )}
      </div>
    );
  }

  const hasBetterMove = !!currentEvidence?.bestMove && (
    currentEvidence.classification === 'blunder' ||
    currentEvidence.classification === 'mistake' ||
    currentEvidence.classification === 'inaccuracy' ||
    currentEvidence.classification === 'miss' ||
    (currentEvidence.evalLoss >= 100)
  );

  return (
    <div className="bg-surface-2 border border-border-1 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 transition-all">
      {/* 1. Header with Model Badge, Refresh, and Auto-Explain Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-border-1">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent">
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-content-1">AI Coach</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent/10 text-accent border border-accent/20">
                {explanation?.model || 'TokenReply'}
              </span>
              {explanation?.cached && (
                <span className="text-[10px] font-mono text-content-3" title="Retrieved from local cache">
                  (cached)
                </span>
              )}
            </div>
            <p className="text-[11px] text-content-3 font-mono">
              Move {currentEvidence?.moveNumber}: <span className="text-content-1 font-bold">{currentEvidence?.san}</span> ({currentEvidence?.playerColorName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => currentEvidence && fetchExplanation(currentEvidence, true)}
            disabled={isLoading || !currentEvidence}
            className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer disabled:opacity-40"
            title="Regenerate explanation"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-accent' : ''} />
          </button>

          <button
            onClick={() => setAutoExplain(!autoExplain)}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors cursor-pointer border ${
              autoExplain 
                ? 'bg-accent/10 border-accent/30 text-accent' 
                : 'bg-surface-3 border-border-1 text-content-3 hover:text-content-2'
            }`}
            title="Toggle automatic explanation on move change"
          >
            {autoExplain ? 'Auto: ON' : 'Auto: OFF'}
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {errorNotice && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0 text-rose-400" />
            <span>{errorNotice}</span>
          </div>
          <button
            onClick={() => currentEvidence && fetchExplanation(currentEvidence, true)}
            className="text-[11px] underline hover:text-white cursor-pointer ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Loading State Skeleton */}
      {isLoading ? (
        <div className="space-y-3 py-2 animate-pulse">
          <div className="h-4 bg-surface-3 rounded w-3/4"></div>
          <div className="h-12 bg-surface-3 rounded w-full"></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-14 bg-surface-3 rounded"></div>
            <div className="h-14 bg-surface-3 rounded"></div>
          </div>
          <div className="h-10 bg-surface-3 rounded w-full"></div>
        </div>
      ) : !explanation ? (
        /* Unexplained state if auto-explain is disabled */
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-content-3">
            Click below to generate a detailed coach breakdown for move {currentEvidence?.moveNumber}. {currentEvidence?.san}.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => currentEvidence && fetchExplanation(currentEvidence)}
            className="text-xs font-bold flex items-center gap-1.5 mx-auto cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Explain This Move</span>
          </Button>
        </div>
      ) : (
        /* 3. Explanation Body */
        <div className="space-y-3.5 animate-fade-in text-xs">
          {/* Summary Box */}
          <div className="p-3 rounded-xl bg-surface-3/80 border border-border-1/70">
            <div className="flex items-center gap-1.5 font-bold text-content-1 mb-1">
              {currentEvidence?.classification && (
                <div className="flex items-center gap-1">
                  <MoveClassificationBadge classification={currentEvidence.classification} />
                  <span className="font-semibold text-content-1">
                    {CLASSIFICATIONS[currentEvidence.classification]?.name}
                  </span>
                  <span className="text-content-3 font-normal">•</span>
                </div>
              )}
              <span className="text-content-2 font-medium">{explanation.summary}</span>
            </div>

            {explanation.move_purpose && (
              <p className="text-content-3 leading-relaxed mt-1 text-[11px]">
                <span className="font-semibold text-content-2">Purpose: </span>
                {explanation.move_purpose}
              </p>
            )}
          </div>

          {/* Tactical Consequences & Opponent Threat Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Tactical Consequences */}
            <div className="p-3 rounded-xl bg-surface-3/50 border border-border-1/50 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Target size={12} />
                  <span>Tactical Impact</span>
                </span>
                <p className="text-content-2 leading-relaxed text-[11px]">
                  {explanation.tactical_consequences || 'Solid positioning preserving current dynamics.'}
                </p>
              </div>
            </div>

            {/* Opponent Threat */}
            <div className="p-3 rounded-xl bg-surface-3/50 border border-border-1/50 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <ShieldAlert size={12} />
                  <span>Opponent Threat / Reply</span>
                </span>
                <p className="text-content-2 leading-relaxed text-[11px]">
                  {explanation.opponent_threat || 'Enemy counterplay is restricted.'}
                </p>
              </div>
            </div>
          </div>

          {/* Better Move Recommendation Card (if an error or stronger alternative exists) */}
          {(hasBetterMove || explanation.better_move) && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Compass size={13} className="text-amber-400" />
                  <span>Stronger Alternative</span>
                </span>
                {currentEvidence?.bestMoveSan && (
                  <span className="font-mono font-black text-amber-300 text-xs px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40">
                    Engine Best: {currentEvidence.bestMoveSan}
                  </span>
                )}
              </div>

              {explanation.why_better && (
                <p className="text-amber-200/90 leading-relaxed text-[11px]">
                  {explanation.why_better}
                </p>
              )}

              {/* Action buttons for best move */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                {onShowBestMoveArrow && (
                  <button
                    onClick={() => onShowBestMoveArrow(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Highlight best move arrow on board"
                  >
                    <Eye size={12} />
                    <span>Show Arrow</span>
                  </button>
                )}

                {currentEvidence?.pv && onExploreLine && (
                  <button
                    onClick={() => {
                      const pvTokens = currentEvidence.pv?.split(' ').filter(Boolean) || [];
                      onExploreLine(pvTokens);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Explore engine continuation"
                  >
                    <Layers size={12} />
                    <span>Preview Line ({currentEvidence.pv.split(' ').length} moves)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Key Coach Lesson */}
          {explanation.lesson && (
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 flex items-start gap-2">
              <Lightbulb size={16} className="text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-[11px] text-teal-200 uppercase tracking-wide">Coach Lesson</span>
                <p className="text-teal-100/90 leading-relaxed text-[11px] mt-0.5">
                  {explanation.lesson}
                </p>
              </div>
            </div>
          )}

          {/* Model info or Fallback Notice Banner */}
          {explanation.fallback ? (
            <div className="p-2.5 rounded-lg bg-surface-3/50 border border-border-1 text-[11px] text-content-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-amber-400 shrink-0" />
                <span>
                  {explanation.fallbackAttempts && explanation.fallbackAttempts.length > 0
                    ? `LLM unavailable (${explanation.fallbackAttempts.map(a => a.model).join(', ')} failed). Deterministic Stockfish analysis active.`
                    : 'Deterministic Stockfish analysis active. Configure TOKENREPLY_API_KEY for dynamic LLM coaching.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[10px] text-content-3 font-mono px-1">
              <span>
                Model: {explanation.model || 'z-ai/glm-5.3-flash'}
                {explanation.fallbackAttempts && explanation.fallbackAttempts.length > 0 && (
                  <span className="text-amber-400/90 ml-1">
                    (fallback from {explanation.fallbackAttempts[0].model})
                  </span>
                )}
              </span>
              {explanation.cached && <span className="text-accent/80">cached</span>}
            </div>
          )}
        </div>
      )}

      {/* 4. Synchronized Move Navigation Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border-1 text-xs">
        <button
          onClick={() => onSelectMove(Math.max(-1, currentMoveIndex - 1))}
          disabled={currentMoveIndex <= -1}
          className="px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-3/80 text-content-2 hover:text-content-1 font-semibold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Previous</span>
        </button>

        <span className="font-mono text-[11px] text-content-3">
          {currentMoveIndex + 1} / {analyzedMoves.length}
        </span>

        <button
          onClick={() => onSelectMove(Math.min(analyzedMoves.length - 1, currentMoveIndex + 1))}
          disabled={currentMoveIndex >= analyzedMoves.length - 1}
          className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
        >
          <span>Next</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* 5. Alternative Exploration Active Banner */}
      {isExploringAlternative && onExitExploration && (
        <div className="p-2.5 rounded-xl bg-accent/15 border border-accent/40 text-accent text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-1.5 font-bold">
            <Layers size={14} />
            <span>Exploring Alternative Variation</span>
          </div>
          <button
            onClick={onExitExploration}
            className="px-2.5 py-1 rounded-lg bg-accent text-white font-bold text-[11px] hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Return to Game
          </button>
        </div>
      )}
    </div>
  );
};
