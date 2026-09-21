import React from 'react';
import { Chessboard } from 'react-chessboard';
import { usePuzzle } from '../hooks/usePuzzle';
import { RefreshCw, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { useBoardHighlights } from '../hooks/useBoardHighlights';
import { Button } from './ui/Button';

interface PuzzleAreaProps {
  onExit: () => void;
}

export const PuzzleArea: React.FC<PuzzleAreaProps> = ({ onExit }) => {
  const { fen, puzzle, isSolved, isFailed, isLoading, makeMove, nextPuzzle, retry, orientation, chess } = usePuzzle();
  const { settings } = useSettings();
  
  const {
    squareStyles,
    handlePieceDrag,
    handlePieceDropEnd,
    handleSquareClick: highlightSquareClick
  } = useBoardHighlights({
    game: chess,
    history: chess.history({ verbose: true }) as any
  });

  const activeTheme = BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.slate;
  const boardOrientation = orientation === 'w' ? 'white' : 'black';

  const onDrop = (args: any) => {
    handlePieceDropEnd();
    if (!args.targetSquare) return false;
    const pieceStr = typeof args.piece === 'string' ? args.piece : 'wP';
    const promotion = pieceStr[1].toLowerCase() ?? 'q';
    return makeMove({
      from: args.sourceSquare,
      to: args.targetSquare,
      promotion: promotion !== 'p' && promotion !== 'k' ? promotion : undefined
    });
  };

  const onSquareClick = (square: string | null) => {
    if (isSolved || isFailed || !square) return;
    const move = highlightSquareClick(square as any);
    if (move) {
      makeMove({
        from: move.from,
        to: move.to,
        promotion: 'q'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-content-3 font-medium">Loading puzzle...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative">
      <div className="lg:col-span-2 flex flex-col gap-3 relative">
        <div className="relative w-full max-w-[600px] aspect-square mx-auto rounded overflow-hidden shadow-sm border border-border-1">
          <Chessboard
            options={{
              id: "PuzzleBoard",
              position: fen,
              showNotation: settings.showCoordinates,
              animationDurationInMs: settings.moveAnimations ? 200 : 0,
              pieces: getCustomPieces(settings.pieceSet),
              onPieceDrop: onDrop,
              onPieceDrag: handlePieceDrag,
              onPieceDragCancel: handlePieceDropEnd,
              onSquareClick: (args: any) => onSquareClick(args.square),
              boardOrientation: boardOrientation as any,
              squareStyles: squareStyles,
              darkSquareStyle: { backgroundColor: activeTheme.dark },
              lightSquareStyle: { backgroundColor: activeTheme.light },
              darkSquareNotationStyle: { color: activeTheme.light },
              lightSquareNotationStyle: { color: activeTheme.dark }
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-surface-2 border border-border-1 rounded-xl p-6 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-content-1 mb-2">Training Puzzle</h2>
          <p className="text-content-3">
            Find the best move for {boardOrientation === 'white' ? 'White' : 'Black'}.
          </p>
          
          {puzzle && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded bg-surface-3 border border-border-1">
              <span className="text-accent font-bold">Rating:</span>
              <span className="text-content-1 font-mono">{puzzle.rating}</span>
            </div>
          )}
        </div>

        {isSolved && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-6 text-center flex flex-col items-center gap-4 animate-fade-in shadow-sm">
            <CheckCircle size={48} className="text-success" />
            <div>
              <h3 className="text-xl font-bold text-success mb-1">Excellent!</h3>
              <p className="text-success/80 text-sm">You found the right sequence.</p>
            </div>
            <Button
              onClick={nextPuzzle}
              className="w-full bg-success hover:bg-success/90 text-white"
            >
              Next Puzzle <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        )}

        {isFailed && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-6 text-center flex flex-col items-center gap-4 animate-fade-in shadow-sm">
            <XCircle size={48} className="text-error" />
            <div>
              <h3 className="text-xl font-bold text-error mb-1">Incorrect</h3>
              <p className="text-error/80 text-sm">That is not the best move.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="secondary"
                onClick={retry}
              >
                <RefreshCw size={18} className="mr-2" /> Retry
              </Button>
              <Button
                variant="outline"
                onClick={nextPuzzle}
              >
                Skip <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-auto">
          <Button
            variant="outline"
            onClick={onExit}
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};
