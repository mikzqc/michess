import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useChess } from '../hooks/useChess';
import { useBoardHighlights } from '../hooks/useBoardHighlights';
import { MoveHistory } from './MoveHistory';
import { Copy, RotateCcw, Flag, Eraser } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { useSettings } from '../hooks/useSettings';
import { useLocalClock } from '../hooks/useLocalClock';
import { calculateMaterial } from '../utils/material';
import { CapturedPieces } from './CapturedPieces';
import { ChessClock } from './ChessClock';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { PromotionDialog } from './PromotionDialog';
import { ConfirmModal } from './ConfirmModal';
import { GameOverModal } from './GameOverModal';
import { useToast } from './Toast';

interface PlayAreaProps {
  onReview?: (pgn: string) => void;
  onSaveGame?: (pgn: string, white: string, black: string, result: string, date: string, event: string) => void;
  onHome?: () => void;
  initialTimeMs?: number | null;
  incrementMs?: number;
}

export const PlayArea: React.FC<PlayAreaProps> = ({ onReview, onSaveGame, onHome, initialTimeMs = null, incrementMs = 0 }) => {
  const { settings, updateSettings } = useSettings();
  const { addToast } = useToast();
  const { fen, history, makeMove, resetGame, getPgn, game } = useChess();
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(settings.boardOrientation);
  const [resignation, setResignation] = useState<'w' | 'b' | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [timeoutResult, setTimeoutResult] = useState<string | null>(null);
  const [arrows, setArrows] = useState<any[]>([]);
  const [promotionState, setPromotionState] = useState<{ sourceSquare: string, targetSquare: string, color: 'w' | 'b' } | null>(null);
  const [showConfirmResign, setShowConfirmResign] = useState(false);

  const isGameOver = game.isGameOver() || resignation !== null || timeoutResult !== null;
  const isGameStarted = history.length > 0;

  const clock = useLocalClock({
    initialTimeMs,
    incrementMs,
    turn: game.turn() as 'w' | 'b',
    isGameOver,
    isGameStarted
  });

  const timeoutClaimedRef = useRef(false);

  // Check for timeout
  useEffect(() => {
    if (!clock.isTimed || isGameOver || timeoutClaimedRef.current) return;

    const activeTimeMs = clock.isWhiteActive ? clock.whiteTimeMs : clock.blackTimeMs;
    
    if (activeTimeMs <= 0) {
      timeoutClaimedRef.current = true;
      const winner = clock.isWhiteActive ? 'Black wins on time' : 'White wins on time';
      setTimeoutResult(winner);
    }
  }, [clock.whiteTimeMs, clock.blackTimeMs, clock.isWhiteActive, clock.isTimed, isGameOver]);

  const toggleOrientation = () => {
    const newOrientation = boardOrientation === 'white' ? 'black' : 'white';
    setBoardOrientation(newOrientation);
    updateSettings({ boardOrientation: newOrientation });
  };
  
  useEffect(() => {
    if (isGameOver && !hasSaved && onSaveGame) {
      const pgn = getPgn();
      let result = '*';
      if (resignation === 'w') result = '0-1';
      else if (resignation === 'b') result = '1-0';
      else if (timeoutResult) {
        result = timeoutResult.includes('White') ? '1-0' : '0-1';
      }
      else if (game.isCheckmate()) result = game.turn() === 'w' ? '0-1' : '1-0';
      else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) result = '1/2-1/2';
      
      const eventLabel = clock.timeControl ? `Local Game (${clock.timeControl})` : 'Local Game';
      
      let finalPgn = pgn;
      if (clock.timeControl) {
         const parts = clock.timeControl.split('+');
         const secs = parseInt(parts[0]) * 60;
         const inc = parts[1] || '0';
         finalPgn = `[TimeControl "${secs}+${inc}"]\n${pgn}`;
      }

      onSaveGame(finalPgn, 'Player 1', 'Player 2', result, new Date().toLocaleDateString(), eventLabel);
      setHasSaved(true);
    }
  }, [isGameOver, hasSaved, onSaveGame, getPgn, resignation, game, timeoutResult, clock.timeControl]);

  const getStatusText = () => {
    if (resignation === 'w') return "Black wins — White resigned";
    if (resignation === 'b') return "White wins — Black resigned";
    if (timeoutResult) return timeoutResult;
    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        return game.turn() === 'w' ? "Black wins by checkmate" : "White wins by checkmate";
      }
      if (game.isDraw()) return "Game drawn";
      return "Game Over";
    }
    return game.turn() === 'w' ? "White to move" : "Black to move";
  };

  const getFinalPgn = () => {
    if (resignation || timeoutResult) {
      const gameCopy = new Chess();
      gameCopy.loadPgn(getPgn());
      if (resignation === 'w') {
        gameCopy.header('Result', '0-1', 'Termination', 'White resigned');
      } else if (resignation === 'b') {
        gameCopy.header('Result', '1-0', 'Termination', 'Black resigned');
      } else if (timeoutResult) {
        const resultStr = timeoutResult.includes('White') ? '1-0' : '0-1';
        gameCopy.header('Result', resultStr, 'Termination', 'Time forfeit');
      }
      
      if (clock.timeControl) {
         const parts = clock.timeControl.split('+');
         const secs = parseInt(parts[0]) * 60;
         const inc = parts[1] || '0';
         gameCopy.header('TimeControl', `${secs}+${inc}`);
      }
      return gameCopy.pgn();
    }
    
    let basePgn = getPgn();
    if (clock.timeControl && !basePgn.includes('TimeControl')) {
       const parts = clock.timeControl.split('+');
       const secs = parseInt(parts[0]) * 60;
       const inc = parts[1] || '0';
       basePgn = `[TimeControl "${secs}+${inc}"]\n${basePgn}`;
    }
    return basePgn;
  };

  const handleCopyPgn = async () => {
    let pgn = getPgn();
    if (initialTimeMs) {
       const secs = initialTimeMs / 1000;
       const inc = incrementMs / 1000;
       pgn = `[TimeControl "${secs}+${inc}"]\n${pgn}`;
    }
    const success = await copyToClipboard(pgn);
    if (success) {
      addToast("PGN copied to clipboard!", "success");
    }
  };

  const handleResetGame = () => {
    setResignation(null);
    setTimeoutResult(null);
    timeoutClaimedRef.current = false;
    clearSelection();
    setArrows([]);
    resetGame();
    clock.reset(initialTimeMs, incrementMs);
  };

  const {
    squareStyles,
    handleSquareClick,
    handlePieceDrag,
    handlePieceDropEnd,
    clearSelection
  } = useBoardHighlights({
    game,
    history,
    showLegalMoves: settings.showLegalMoves,
  });

  const doMove = (from: string, to: string, promotion?: 'q'|'r'|'b'|'n') => {
    const currentColor = game.turn();
    const move = makeMove({ from, to, promotion });
    if (move) {
      clock.onMoveMade(currentColor);
    }
    return move;
  };

  const onDrop = (args: { sourceSquare: string, targetSquare: string | null }) => {
    if (isGameOver) return false;
    handlePieceDropEnd();
    if (!args.targetSquare) return false;
    
    const isPawn = game.get(args.sourceSquare as any)?.type === 'p';
    const isPromotion = isPawn && (args.targetSquare[1] === '8' || args.targetSquare[1] === '1');

    if (isPromotion) {
      if (settings.autoQueen) {
        return doMove(args.sourceSquare, args.targetSquare, 'q');
      } else {
        setPromotionState({ sourceSquare: args.sourceSquare, targetSquare: args.targetSquare, color: game.turn() });
        return false; // Snap back pending dialog
      }
    }
    
    return doMove(args.sourceSquare, args.targetSquare);
  };



  const handleResignClick = () => {
    if (settings.confirmResignation) {
      setShowConfirmResign(true);
    } else {
      setResignation(game.turn());
    }
  };

  const topColor = boardOrientation === 'white' ? 'black' : 'white';
  const bottomColor = boardOrientation === 'white' ? 'white' : 'black';
  const topClockMs = topColor === 'white' ? clock.whiteTimeMs : clock.blackTimeMs;
  const bottomClockMs = bottomColor === 'white' ? clock.whiteTimeMs : clock.blackTimeMs;
  const topClockActive = topColor === 'white' ? clock.isWhiteActive : clock.isBlackActive;
  const bottomClockActive = bottomColor === 'white' ? clock.isWhiteActive : clock.isBlackActive;
  const activeTheme = BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.slate;

  const material = calculateMaterial(fen);
  const topCaptured = topColor === 'white' ? material.whiteCaptured : material.blackCaptured;
  const bottomCaptured = bottomColor === 'white' ? material.whiteCaptured : material.blackCaptured;
  const topAdvantage = topColor === 'white' ? material.whiteAdvantage : material.blackAdvantage;
  const bottomAdvantage = bottomColor === 'white' ? material.whiteAdvantage : material.blackAdvantage;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative">
      {showConfirmResign && (
        <ConfirmModal 
          title="Resign Game?" 
          message="Are you sure you want to resign? You will lose this game." 
          confirmText="Resign"
          onConfirm={() => { setResignation(game.turn()); setShowConfirmResign(false); }}
          onCancel={() => setShowConfirmResign(false)}
        />
      )}
      
      {/* Left Column: Board */}
      <div className="lg:col-span-2 flex justify-center gap-4 relative">
        <div className="w-full max-w-[600px] flex flex-col gap-3 relative">
          {/* Top Player Info + Clock */}
          <div className={`flex justify-between items-center border p-3 rounded-lg transition-colors ${topClockActive && !isGameOver ? 'bg-slate-800 border-chess-accent shadow-md' : 'bg-chess-panel border-chess-border'}`}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xl ${topColor === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-black text-white border border-gray-600'}`}>
                  {topColor === 'white' ? 'W' : 'B'}
                </div>
                <div className="font-bold text-white text-lg">Player 2</div>
              </div>
              <CapturedPieces pieces={topCaptured} advantage={topAdvantage} pieceSet={settings.pieceSet} />
            </div>
            {clock.isTimed && (
              <ChessClock timeMs={topClockMs} isActive={topClockActive && !isGameOver} />
            )}
          </div>

          <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl relative">
            <Chessboard 
              options={{
                id: "LocalBoard",
                position: fen,
                showNotation: settings.showCoordinates,
                animationDurationInMs: settings.moveAnimations ? 200 : 0,
                pieces: getCustomPieces(settings.pieceSet),
                allowDrawingArrows: true,
                arrows: arrows,
                onArrowsChange: ({ arrows }) => setArrows(arrows),
                arrowOptions: { color: 'rgba(255, 170, 0, 0.8)' } as any,
                onPieceDrop: onDrop,
                onSquareClick: (args) => {
                  if (isGameOver) return;
                  const move = handleSquareClick(args.square);
                  if (move) {
                    const isPawn = game.get(move.from as any)?.type === 'p';
                    const isPromotion = isPawn && (move.to[1] === '8' || move.to[1] === '1');
                    if (isPromotion && !settings.autoQueen) {
                      setPromotionState({ sourceSquare: move.from, targetSquare: move.to, color: game.turn() });
                    } else {
                      doMove(move.from, move.to, 'q');
                    }
                  }
                },
                onPieceDrag: handlePieceDrag,
                onPieceDragCancel: handlePieceDropEnd,
                squareStyles: squareStyles,
                boardOrientation: boardOrientation,
                darkSquareStyle: { backgroundColor: activeTheme.dark },
                lightSquareStyle: { backgroundColor: activeTheme.light }
              }}
            />
            {promotionState && (
              <PromotionDialog 
                color={promotionState.color}
                pieceSet={settings.pieceSet}
                onSelect={(piece) => {
                  doMove(promotionState.sourceSquare, promotionState.targetSquare, piece);
                  setPromotionState(null);
                }}
              />
            )}
            {isGameOver && (
               <GameOverModal 
                 result={getStatusText()}
                 onReview={() => onReview?.(getFinalPgn())}
                 onRematch={handleResetGame}
                 onHome={onHome}
               />
            )}
          </div>

          {/* Bottom Player Info + Clock */}
          <div className={`flex justify-between items-center border p-3 rounded-lg transition-colors ${bottomClockActive && !isGameOver ? 'bg-slate-800 border-chess-accent shadow-md' : 'bg-chess-panel border-chess-border'}`}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xl ${bottomColor === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-black text-white border border-gray-600'}`}>
                  {bottomColor === 'white' ? 'W' : 'B'}
                </div>
                <div className="font-bold text-white text-lg">Player 1</div>
              </div>
              <CapturedPieces pieces={bottomCaptured} advantage={bottomAdvantage} pieceSet={settings.pieceSet} />
            </div>
            {clock.isTimed && (
              <ChessClock timeMs={bottomClockMs} isActive={bottomClockActive && !isGameOver} />
            )}
          </div>
          
          {arrows.length > 0 && (
             <div className="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full">
               <button onClick={() => setArrows([])} className="bg-slate-800 hover:bg-slate-700 p-3 rounded-full shadow-lg border border-slate-700 text-slate-300 hover:text-orange-400 transition-colors" title="Clear Arrows">
                  <Eraser size={20} />
               </button>
             </div>
          )}
        </div>
      </div>

      {/* Right Column: Controls & History */}
      <div className="flex flex-col gap-4 h-[400px] lg:h-auto lg:min-h-[600px]">
        <div className="bg-chess-panel border border-chess-border p-4 rounded-lg flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              Local Game
              {clock.timeControl && (
                <span className="text-chess-accent font-mono text-sm">({clock.timeControl})</span>
              )}
            </h2>
            <p className={`text-sm ${timeoutResult || resignation ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
              {getStatusText()}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <MoveHistory history={history} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!isGameOver && (
            <button 
              onClick={handleResignClick}
              className="col-span-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 py-3 rounded flex items-center justify-center gap-2 font-bold transition-colors cursor-pointer mb-2"
            >
              <Flag size={18} /> Resign
            </button>
          )}

          <button 
            onClick={toggleOrientation}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 p-3 rounded-lg font-bold text-sm transition-colors"
            title="Flip Board"
            aria-label="Flip Board"
          >
            <RotateCcw size={16} /> Flip Board
          </button>
          <button 
            onClick={handleResetGame}
            className="bg-chess-panel hover:bg-slate-700 border border-chess-border py-2 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw size={16} /> New Game
          </button>
          <button 
            onClick={handleCopyPgn}
            className="col-span-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
          >
            <Copy size={16} /> Copy PGN
          </button>
        </div>
      </div>
    </div>
  );
};
