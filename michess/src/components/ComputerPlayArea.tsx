import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { useComputerGame, type Difficulty, type PlayerColor } from '../hooks/useComputerGame';
import { MoveHistory } from './MoveHistory';
import { Copy, RotateCcw, Flag, Undo2, BrainCircuit, Eraser } from 'lucide-react';
import { EvaluationBar } from './EvaluationBar';
import { stockfishEngine } from '../services/stockfish';
import { useBoardHighlights } from '../hooks/useBoardHighlights';
import { useSettings } from '../hooks/useSettings';
import { copyToClipboard } from '../utils/clipboard';
import { useLocalClock } from '../hooks/useLocalClock';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { calculateMaterial } from '../utils/material';
import { CapturedPieces } from './CapturedPieces';
import { useToast } from './Toast';
import { ChessClock } from './ChessClock';
import { ConfirmModal } from './ConfirmModal';
import { PromotionDialog } from './PromotionDialog';
import { GameOverModal } from './GameOverModal';

interface ComputerPlayAreaProps {
  difficulty: Difficulty;
  playerColor: PlayerColor;
  onExit: () => void;
  onReview: (pgn: string) => void;
  onSaveGame?: (pgn: string, white: string, black: string, result: string, date: string, event: string) => void;
  initialTimeMs?: number | null;
  incrementMs?: number;
}

export const ComputerPlayArea: React.FC<ComputerPlayAreaProps> = ({ difficulty, playerColor, onExit, onReview, onSaveGame, initialTimeMs = null, incrementMs = 0 }) => {
  const { settings, updateSettings } = useSettings();
  const { addToast } = useToast();
  const [gameOverResult, setGameOverResult] = useState<string | null>(null);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(playerColor);
  const [hasSaved, setHasSaved] = useState(false);
  const [showConfirmResign, setShowConfirmResign] = useState(false);
  const [arrows, setArrows] = useState<any[]>([]);
  const [promotionState, setPromotionState] = useState<{ sourceSquare: string, targetSquare: string, color: 'w' | 'b' } | null>(null);
  const [timeoutResult, setTimeoutResult] = useState<string | null>(null);

  const handleGameOver = (result: string) => {
    setGameOverResult(result);
  };

  const handleComputerMove = () => {
    const compColor = playerColor === 'white' ? 'b' : 'w';
    clock.onMoveMade(compColor);
  };

  const { fen, history, makeMove, resetGame, getPgn, game, isThinking, engineInfo, triggerUndo } = useComputerGame({
    difficulty,
    playerColor,
    onGameOver: handleGameOver,
    onComputerMove: handleComputerMove
  });

  const isGameOver = gameOverResult !== null || timeoutResult !== null;
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
      setGameOverResult(winner);
      stockfishEngine.stop();
    }
  }, [clock.whiteTimeMs, clock.blackTimeMs, clock.isWhiteActive, clock.isTimed, isGameOver]);

  // Need useEffect because getPgn is returned by useComputerGame
  React.useEffect(() => {
    if (isGameOver && !hasSaved && onSaveGame) {
      let pgn = getPgn();
      let resStr = '*';
      const resultSource = timeoutResult || gameOverResult || '';
      
      if (resultSource.includes('White wins')) resStr = '1-0';
      else if (resultSource.includes('Black wins')) resStr = '0-1';
      else if (resultSource.includes('Draw')) resStr = '1/2-1/2';
      
      const whitePlayer = playerColor === 'white' ? 'Player 1' : 'Stockfish 18';
      const blackPlayer = playerColor === 'black' ? 'Player 1' : 'Stockfish 18';
      
      const eventLabel = clock.timeControl ? `Vs Computer (${difficulty}) [${clock.timeControl}]` : `Vs Computer (${difficulty})`;
      
      if (clock.timeControl) {
         const parts = clock.timeControl.split('+');
         const secs = parseInt(parts[0]) * 60;
         const inc = parts[1] || '0';
         pgn = `[TimeControl "${secs}+${inc}"]\n${pgn}`;
      }

      onSaveGame(pgn, whitePlayer, blackPlayer, resStr, new Date().toLocaleDateString(), eventLabel);
      setHasSaved(true);
    }
  }, [gameOverResult, timeoutResult, hasSaved, onSaveGame, getPgn, playerColor, difficulty, clock.timeControl, isGameOver]);

  const {
    squareStyles,
    handleSquareClick,
    handlePieceDrag,
    handlePieceDropEnd,
    clearSelection
  } = useBoardHighlights({
    game,
    history,
    playerColor,
    showLegalMoves: settings.showLegalMoves,
  });

  const toggleOrientation = () => {
    const newOrientation = boardOrientation === 'white' ? 'black' : 'white';
    setBoardOrientation(newOrientation);
    updateSettings({ boardOrientation: newOrientation });
  };

  const doMove = (from: string, to: string, promotion?: 'q'|'r'|'b'|'n') => {
    const currentColor = game.turn();
    const move = makeMove({ from, to, promotion });
    if (move) {
      clock.onMoveMade(currentColor);
    }
    return move;
  };

  const onDrop = (args: { sourceSquare: string, targetSquare: string | null }) => {
    handlePieceDropEnd();
    if (gameOverResult) return false;
    if (isThinking) return false; // Not allowed while computer is thinking
    if (!args.targetSquare) return false;
    
    const isPawn = game.get(args.sourceSquare as any)?.type === 'p';
    const isPromotion = isPawn && (args.targetSquare[1] === '8' || args.targetSquare[1] === '1');

    if (isPromotion) {
      if (settings.autoQueen) {
        return doMove(args.sourceSquare, args.targetSquare, 'q');
      } else {
        setPromotionState({ sourceSquare: args.sourceSquare, targetSquare: args.targetSquare, color: game.turn() });
        return false;
      }
    }

    return doMove(args.sourceSquare, args.targetSquare);
  };

  const copyPgn = async () => {
    let pgn = getPgn();
    if (clock.timeControl && !pgn.includes('TimeControl')) {
       const parts = clock.timeControl.split('+');
       const secs = parseInt(parts[0]) * 60;
       const inc = parts[1] || '0';
       pgn = `[TimeControl "${secs}+${inc}"]\n${pgn}`;
    }
    await copyToClipboard(pgn);
    addToast("PGN Copied to clipboard!", "success");
  };

  const handleResignClick = () => {
    if (gameOverResult) return;
    if (settings.confirmResignation) {
      setShowConfirmResign(true);
    } else {
      setGameOverResult(playerColor === 'white' ? 'Black wins by Resignation' : 'White wins by Resignation');
      stockfishEngine.stop();
    }
  };

  const handleNewGame = () => {
    setGameOverResult(null);
    setTimeoutResult(null);
    timeoutClaimedRef.current = false;
    clearSelection();
    setArrows([]);
    resetGame();
    clock.reset(initialTimeMs, incrementMs);
  };

  const compColor = playerColor === 'white' ? 'black' : 'white';
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
          message="Are you sure you want to resign against the computer?" 
          confirmText="Resign"
          onConfirm={() => { 
            setGameOverResult(playerColor === 'white' ? 'Black wins by Resignation' : 'White wins by Resignation');
            stockfishEngine.stop();
            setShowConfirmResign(false); 
          }}
          onCancel={() => setShowConfirmResign(false)}
        />
      )}

      {/* Left Column: Board and Eval */}
      <div className="lg:col-span-2 flex justify-center gap-4 relative">
        {/* Evaluation Bar */}
        <div className="hidden sm:block">
          <EvaluationBar score={engineInfo.score} orientation={boardOrientation} />
        </div>

        <div className="w-full max-w-[600px] flex flex-col relative">
          <div className={`flex justify-between items-center mb-2 px-1 border p-3 rounded-lg transition-colors ${topClockActive && !isGameOver ? 'bg-slate-800 border-chess-accent shadow-md' : 'bg-chess-panel border-chess-border'}`}>
            <div className="flex flex-col gap-1">
              <div className="font-bold text-gray-300 flex items-center gap-2">
                <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${topColor === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-black text-white border border-gray-600'}`}>
                  {topColor === 'white' ? 'W' : 'B'}
                </div>
                {topColor === compColor ? (
                  <><BotIcon /> Stockfish (Level {difficulty})</>
                ) : (
                  `Player (${topColor})`
                )}
                {isThinking && topColor === compColor && <span className="flex items-center gap-1 text-sm text-yellow-400 ml-2 animate-pulse"><BrainCircuit size={16} /> Thinking...</span>}
              </div>
              <CapturedPieces pieces={topCaptured} advantage={topAdvantage} pieceSet={settings.pieceSet} />
            </div>
            {clock.isTimed && (
              <ChessClock timeMs={topClockMs} isActive={topClockActive && !isGameOver} />
            )}
          </div>
          
          <div className="aspect-square rounded-lg overflow-hidden shadow-2xl relative">
            <Chessboard 
              options={{
                id: "ComputerBoard",
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
                  const move = handleSquareClick(args.square);
                  if (move && !gameOverResult && !isThinking) {
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
                 result={gameOverResult || timeoutResult || 'Game Over'}
                 onReview={() => onReview(getPgn())}
                 onRematch={handleNewGame}
                 onHome={onExit}
               />
            )}
          </div>
          
          <div className={`flex justify-between items-center mt-2 px-1 border p-3 rounded-lg transition-colors ${bottomClockActive && !isGameOver ? 'bg-slate-800 border-chess-accent shadow-md' : 'bg-chess-panel border-chess-border'}`}>
            <div className="flex flex-col gap-1">
              <div className="font-bold text-gray-300 flex items-center gap-2">
                <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${bottomColor === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-black text-white border border-gray-600'}`}>
                  {bottomColor === 'white' ? 'W' : 'B'}
                </div>
                {bottomColor === compColor ? (
                  <><BotIcon /> Stockfish (Level {difficulty})</>
                ) : (
                  `Player (${bottomColor})`
                )}
                {isThinking && bottomColor === compColor && <span className="flex items-center gap-1 text-sm text-yellow-400 ml-2 animate-pulse"><BrainCircuit size={16} /> Thinking...</span>}
              </div>
              <CapturedPieces pieces={bottomCaptured} advantage={bottomAdvantage} pieceSet={settings.pieceSet} />
            </div>
            {clock.isTimed && (
              <ChessClock timeMs={bottomClockMs} isActive={bottomClockActive && !isGameOver} />
            )}
          </div>
          
          {arrows.length > 0 && (
             <div className="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full z-10">
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
              Play vs Computer
              {clock.timeControl && (
                <span className="text-chess-accent font-mono text-sm">({clock.timeControl})</span>
              )}
            </h2>
            <p className={`text-sm ${gameOverResult ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
              {gameOverResult ? gameOverResult : game.turn() === 'w' ? "White to move" : "Black to move"}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <MoveHistory history={history} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={toggleOrientation}
            className="bg-chess-panel hover:bg-slate-700 border border-chess-border py-2 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
            title="Flip Board"
            aria-label="Flip Board"
          >
            <RotateCcw size={16} /> Flip Board
          </button>
          
          <button 
            onClick={triggerUndo}
            disabled={gameOverResult !== null || history.length === 0}
            className="bg-chess-panel hover:bg-slate-700 border border-chess-border py-2 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Undo2 size={16} /> Undo
          </button>

          {!isGameOver && (
            <button 
              onClick={handleResignClick}
              disabled={gameOverResult !== null}
              className="col-span-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50 py-3 rounded flex items-center justify-center gap-2 font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flag size={18} /> Resign
            </button>
          )}

          <button 
            onClick={handleNewGame}
            className="bg-chess-panel hover:bg-slate-700 border border-chess-border py-2 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw size={16} /> New Game
          </button>
          
          <button 
            onClick={copyPgn}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 rounded flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
          >
            <Copy size={16} /> Copy PGN
          </button>
          
          <button 
            onClick={onExit}
            className="col-span-2 bg-transparent border border-slate-600 hover:bg-slate-800 py-3 rounded flex items-center justify-center gap-2 font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Exit Match
          </button>
        </div>
      </div>
    </div>
  );
};

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
  </svg>
);
