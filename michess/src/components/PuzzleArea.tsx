import React from 'react';
import { Chessboard } from 'react-chessboard';
import { usePuzzle } from '../hooks/usePuzzle';
import { RefreshCw, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { useBoardHighlights } from '../hooks/useBoardHighlights';

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
        <div className="w-8 h-8 border-4 border-chess-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Loading puzzle...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative">
      <div className="lg:col-span-2 flex flex-col gap-3 relative">
        <div className="relative w-full max-w-[600px] aspect-square mx-auto rounded overflow-hidden shadow-2xl">
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
              lightSquareStyle: { backgroundColor: activeTheme.light }
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Training Puzzle</h2>
          <p className="text-slate-400">
            Find the best move for {boardOrientation === 'white' ? 'White' : 'Black'}.
          </p>
          
          {puzzle && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-900 border border-slate-700">
              <span className="text-chess-accent font-bold">Rating:</span>
              <span className="text-white font-mono">{puzzle.rating}</span>
            </div>
          )}
        </div>

        {isSolved && (
          <div className="bg-green-900/20 border border-green-500/50 rounded-xl p-6 text-center flex flex-col items-center gap-4 animate-fade-in">
            <CheckCircle size={48} className="text-green-400" />
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-1">Excellent!</h3>
              <p className="text-green-400/80 text-sm">You found the right sequence.</p>
            </div>
            <button
              onClick={nextPuzzle}
              className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
            >
              Next Puzzle <ArrowRight size={18} />
            </button>
          </div>
        )}

        {isFailed && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-center flex flex-col items-center gap-4 animate-fade-in">
            <XCircle size={48} className="text-red-400" />
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-1">Incorrect</h3>
              <p className="text-red-400/80 text-sm">That is not the best move.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                onClick={retry}
                className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={18} /> Retry
              </button>
              <button
                onClick={nextPuzzle}
                className="bg-transparent border border-slate-600 hover:bg-slate-800 text-slate-300 hover:text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
              >
                Skip <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto">
          <button
            onClick={onExit}
            className="w-full bg-transparent border border-slate-600 hover:bg-slate-800 py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-slate-300 hover:text-white transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
