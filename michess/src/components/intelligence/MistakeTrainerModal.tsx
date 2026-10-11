import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { X, CheckCircle2, AlertCircle, RotateCcw, Lightbulb, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import type { DetectedMistake } from '../../types/intelligence';
import { useSettings } from '../../hooks/useSettings';
import { useBoardHighlights } from '../../hooks/useBoardHighlights';
import { PREMIUM_ARROW_OPTIONS } from '../../utils/arrows';
import { BOARD_THEMES, getCustomPieces } from '../../utils/themes';
import { Button } from '../ui/Button';

interface MistakeTrainerModalProps {
  mistake: DetectedMistake;
  mistakesList?: DetectedMistake[];
  onClose: () => void;
  onSelectMistake?: (mistake: DetectedMistake) => void;
}

export const MistakeTrainerModal: React.FC<MistakeTrainerModalProps> = ({
  mistake,
  mistakesList = [],
  onClose,
  onSelectMistake
}) => {
  const { settings } = useSettings();
  const [chessInstance, setChessInstance] = useState(() => new Chess(mistake.fenBefore));
  const [fen, setFen] = useState(mistake.fenBefore);
  const [status, setStatus] = useState<'attempting' | 'solved' | 'failed'>('attempting');
  const [feedback, setFeedback] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const activeTheme = BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.slate;
  const boardOrientation = mistake.color === 'w' ? 'white' : 'black';

  const {
    squareStyles,
    handlePieceDrag,
    handlePieceDropEnd,
    handleSquareClick: highlightSquareClick,
    clearSelection
  } = useBoardHighlights({
    game: chessInstance,
    history: chessInstance.history({ verbose: true }) as any,
    playerColor: mistake.color === 'w' ? 'white' : 'black',
    showLegalMoves: settings.showLegalMoves !== false
  });

  // Reset when mistake changes
  useEffect(() => {
    const c = new Chess(mistake.fenBefore);
    setChessInstance(c);
    setFen(mistake.fenBefore);
    setStatus('attempting');
    setFeedback('');
    setShowHint(false);
    setShowSolution(false);
    clearSelection();
  }, [mistake]);

  // Derive the SAN for the bestMove
  const bestMoveSan = useMemo(() => {
    if (!mistake.bestMove || mistake.bestMove === '(none)') return 'N/A';
    try {
      const c = new Chess(mistake.fenBefore);
      const from = mistake.bestMove.slice(0, 2);
      const to = mistake.bestMove.slice(2, 4);
      const promotion = mistake.bestMove.slice(4, 5) || undefined;
      const m = c.move({ from, to, promotion });
      return m ? m.san : mistake.bestMove;
    } catch {
      return mistake.bestMove;
    }
  }, [mistake]);

  const handleReset = () => {
    const c = new Chess(mistake.fenBefore);
    setChessInstance(c);
    setFen(mistake.fenBefore);
    setStatus('attempting');
    setFeedback('');
    setShowHint(false);
    setShowSolution(false);
    clearSelection();
  };

  const executeAttempt = (from: string, to: string, promotionChoice?: string): boolean => {
    if (status === 'solved') return false;
    if (!to || from === to) return false;

    try {
      const testChess = new Chess(fen);
      const piece = testChess.get(from as any);
      if (!piece) return false;

      const isPromotion = promotionChoice || (
        piece.type === 'p' && (
          (piece.color === 'w' && to[1] === '8') ||
          (piece.color === 'b' && to[1] === '1')
        ) ? 'q' : undefined
      );

      const move = testChess.move({
        from,
        to,
        promotion: isPromotion
      });

      if (!move) return false;

      const playedUci = `${from}${to}${isPromotion || ''}`;
      const targetUci = mistake.bestMove || '';

      // Check if user played the best move
      const isCorrect = playedUci === targetUci || (targetUci.startsWith(from + to));

      if (isCorrect) {
        setChessInstance(testChess);
        setFen(testChess.fen());
        setStatus('solved');
        setFeedback(`Outstanding! You found the winning continuation: ${move.san}.`);
        clearSelection();
        return true;
      } else {
        setStatus('failed');
        setFeedback(`You played ${move.san}, which loses the advantage. Try again!`);
        clearSelection();
        return false;
      }
    } catch {
      clearSelection();
      return false;
    }
  };

  const handlePieceDrop = (args: any) => {
    handlePieceDropEnd();
    if (status === 'solved') return false;
    const sourceSquare = args?.sourceSquare;
    const targetSquare = args?.targetSquare;
    const piece = args?.piece;
    if (!targetSquare || sourceSquare === targetSquare) return false;

    const pieceStr = typeof piece === 'string' ? piece : piece?.pieceType;
    const isPromotion = (pieceStr === 'wP' && targetSquare[1] === '8') || (pieceStr === 'bP' && targetSquare[1] === '1');
    const promotionChoice = isPromotion ? 'q' : undefined;

    return executeAttempt(sourceSquare, targetSquare, promotionChoice);
  };

  const handleSquareClick = (square: string | null) => {
    if (status === 'solved' || !square) return;

    const move = highlightSquareClick(square);
    if (move) {
      executeAttempt(move.from, move.to);
    }
  };

  const handleRevealSolution = () => {
    if (!mistake.bestMove || mistake.bestMove === '(none)') return;
    try {
      const c = new Chess(mistake.fenBefore);
      const from = mistake.bestMove.slice(0, 2);
      const to = mistake.bestMove.slice(2, 4);
      const promotion = mistake.bestMove.slice(4, 5) || undefined;
      c.move({ from, to, promotion });
      setChessInstance(c);
      setFen(c.fen());
      setShowSolution(true);
      setStatus('solved');
      setFeedback(`Engine solution: ${bestMoveSan}`);
      clearSelection();
    } catch {}
  };

  const currentIndex = mistakesList.findIndex(m => m.id === mistake.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < mistakesList.length - 1;
  const hintPieceInfo = useMemo(() => {
    if (!mistake.bestMove || mistake.bestMove.length < 2) return null;
    const from = mistake.bestMove.slice(0, 2);
    try {
      const c = new Chess(mistake.fenBefore);
      const piece = c.get(from as any);
      if (!piece) return { from, name: 'piece' };
      const names: Record<string, string> = {
        p: 'Pawn',
        n: 'Knight',
        b: 'Bishop',
        r: 'Rook',
        q: 'Queen',
        k: 'King'
      };
      return { from, name: names[piece.type] || 'piece' };
    } catch {
      return { from, name: 'piece' };
    }
  }, [mistake.bestMove, mistake.fenBefore]);

  const handleToggleHint = () => {
    setShowHint(prev => !prev);
  };

  const arrows: any[] = useMemo(() => {
    if (showSolution && mistake.bestMove && mistake.bestMove.length >= 4) {
      return [{
        startSquare: mistake.bestMove.slice(0, 2),
        endSquare: mistake.bestMove.slice(2, 4),
        color: 'rgba(34, 197, 94, 0.9)'
      }];
    }
    return [];
  }, [showSolution, mistake.bestMove]);

  const combinedSquareStyles = useMemo(() => {
    const styles = { ...squareStyles };
    if (showHint && mistake.bestMove && mistake.bestMove.length >= 2) {
      const bestFrom = mistake.bestMove.slice(0, 2);
      styles[bestFrom] = {
        ...styles[bestFrom],
        backgroundColor: 'rgba(245, 158, 11, 0.45)',
        boxShadow: 'inset 0 0 0 3px rgba(245, 158, 11, 0.9)',
        transition: 'all 0.2s ease'
      };
    }
    return styles;
  }, [squareStyles, showHint, mistake.bestMove]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-2 border border-border-1 rounded-2xl w-full max-w-4xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-1 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-content-1 flex items-center gap-2">
                <span>Mistake Trainer: Retry Your Move</span>
                {mistakesList.length > 1 && (
                  <span className="text-xs font-mono font-normal text-content-3">
                    ({currentIndex + 1} of {mistakesList.length})
                  </span>
                )}
              </h3>
              <p className="text-xs text-content-2">
                Move {mistake.moveNumber} vs {mistake.opponent} • Played {mistake.date}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Interactive Chessboard */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-[400px] aspect-square rounded-xl overflow-hidden shadow-xl border border-border-1 bg-surface-1">
              <Chessboard
                options={{
                  id: "MistakeTrainerBoard",
                  position: fen,
                  showNotation: settings.showCoordinates,
                  animationDurationInMs: settings.moveAnimations ? 200 : 0,
                  pieces: getCustomPieces(settings.pieceSet),
                  boardOrientation: boardOrientation as any,
                  darkSquareStyle: { backgroundColor: activeTheme.dark },
                  lightSquareStyle: { backgroundColor: activeTheme.light },
                  darkSquareNotationStyle: { color: activeTheme.light },
                  lightSquareNotationStyle: { color: activeTheme.dark },
                  arrowOptions: PREMIUM_ARROW_OPTIONS as any,
                  arrows: arrows,
                  squareStyles: combinedSquareStyles,
                  canDragPiece: () => status !== 'solved',
                  onPieceDrop: handlePieceDrop,
                  onPieceDrag: (args: any) => {
                    if (status !== 'solved') handlePieceDrag(args);
                  },
                  onPieceDragCancel: handlePieceDropEnd,
                  onSquareClick: (args: any) => handleSquareClick(args?.square)
                }}
              />
            </div>
          </div>

          {/* Training Context & Actions */}
          <div className="lg:col-span-5 flex flex-col gap-4 text-left">
            <div className="bg-surface-3/80 border border-border-1 rounded-xl p-4">
              <span className="text-[11px] font-mono font-bold text-accent uppercase tracking-wider block mb-1">
                In Your Game
              </span>
              <p className="text-sm text-content-1 font-semibold mb-2">
                You played <span className="font-mono text-red-400 font-bold">{mistake.san}</span> ({mistake.classification.toUpperCase()})
              </p>
              <p className="text-xs text-content-2 leading-relaxed">
                {mistake.explanation}
              </p>
            </div>

            {/* Status message */}
            {feedback && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                status === 'solved'
                  ? 'bg-green-950/40 border-green-500/50 text-green-300'
                  : 'bg-red-950/40 border-red-500/50 text-red-300'
              }`}>
                {status === 'solved' ? (
                  <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{status === 'solved' ? 'Correct!' : 'Incorrect Move'}</p>
                  <p className="mt-0.5">{feedback}</p>
                </div>
              </div>
            )}

            {/* Move Hint Banner */}
            {showHint && status !== 'solved' && hintPieceInfo && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 animate-fade-in">
                <Lightbulb size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Move Hint</p>
                  <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                    Look for the winning move with your <span className="font-bold text-amber-300">{hintPieceInfo.name}</span> on <span className="font-mono font-bold text-amber-300">{hintPieceInfo.from}</span> (highlighted in gold).
                  </p>
                </div>
              </div>
            )}

            {/* Instruction Prompt */}
            {status === 'attempting' && !showHint && (
              <p className="text-xs text-content-3 italic">
                Drag a piece on the board to find the strongest continuation that preserves your advantage.
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                className="flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </Button>

              {status !== 'solved' && (
                <>
                  <Button
                    variant={showHint ? "primary" : "secondary"}
                    size="sm"
                    onClick={handleToggleHint}
                    className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
                      showHint ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-amber-400" : ""
                    }`}
                  >
                    <Lightbulb size={14} className={showHint ? "text-slate-950" : "text-amber-400"} />
                    <span>{showHint ? "Hide Hint" : "Hint"}</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevealSolution}
                    className="text-xs text-content-3 hover:text-content-1 cursor-pointer"
                  >
                    Show Solution
                  </Button>
                </>
              )}
            </div>

            {/* Navigation between multiple mistakes */}
            {mistakesList.length > 1 && onSelectMistake && (
              <div className="flex items-center justify-between pt-3 border-t border-border-1 mt-2">
                <button
                  onClick={() => hasPrev && onSelectMistake(mistakesList[currentIndex - 1])}
                  disabled={!hasPrev}
                  className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-3/80 disabled:opacity-30 disabled:pointer-events-none text-content-2 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => hasNext && onSelectMistake(mistakesList[currentIndex + 1])}
                  disabled={!hasNext}
                  className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  Next Mistake <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
