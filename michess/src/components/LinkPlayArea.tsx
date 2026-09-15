import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { useLinkGame } from '../hooks/useLinkGame';
import { useAuth } from '../hooks/useAuth';
import { useChessClock } from '../hooks/useChessClock';
import { MoveHistory } from './MoveHistory';
import { ChessClock } from './ChessClock';
import { Copy, Flag, Check, ShieldAlert, RotateCcw, Eraser } from 'lucide-react';
import { useBoardHighlights } from '../hooks/useBoardHighlights';
import { copyToClipboard } from '../utils/clipboard';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { useToast } from './Toast';
import { useSettings } from '../hooks/useSettings';
import { calculateMaterial } from '../utils/material';
import { CapturedPieces } from './CapturedPieces';
import { ConfirmModal } from './ConfirmModal';
import { PromotionDialog } from './PromotionDialog';
import { GameOverModal } from './GameOverModal';
import { Chess } from 'chess.js';
import { OwnerPanel } from './OwnerPanel';
import { moveInFen, removeInFen, putInFen, switchTurnInFen, type PieceSymbol } from '../utils/fenUtils';

interface LinkPlayAreaProps {
  inviteCode: string;
  onExit: () => void;
  onReview?: (pgn: string) => void;
  onSaveGame?: (pgn: string, white: string, black: string, result: string, date: string, event: string, is_chaos?: boolean) => void;
  onRequireAuth: () => void;
}

/**
 * Checks if a side has sufficient mating material.
 * Used for timeout draws: if the winning side can't possibly checkmate, result is a draw.
 */
function hasSufficientMaterial(fen: string, color: 'w' | 'b'): boolean {
  const testChess = new Chess(fen);
  const board = testChess.board();
  const pieces: string[] = [];
  
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.color === color && sq.type !== 'k') {
        pieces.push(sq.type);
      }
    }
  }
  
  // No pieces besides king = insufficient
  if (pieces.length === 0) return false;
  // Single bishop or knight = insufficient
  if (pieces.length === 1 && (pieces[0] === 'b' || pieces[0] === 'n')) return false;
  // Any other combination (pawn, rook, queen, two bishops, etc.) = sufficient
  return true;
}

export const LinkPlayArea: React.FC<LinkPlayAreaProps> = ({ inviteCode, onExit, onReview, onSaveGame, onRequireAuth }) => {
  const { user } = useAuth();
  const { gameData, fen, chess, error, loading, makeMove, joinGame, resign, cancelGame, abortGame, claimTimeout, playerId, rematchGame, activateChaosMode, chaosUpdateGame, chaosClockAction } = useLinkGame(inviteCode, user?.id);
  const clockState = useChessClock(gameData);
  const [copied, setCopied] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [abortTimer, setAbortTimer] = useState<number | null>(null);
  const timeoutClaimedRef = useRef(false);
  
  const {
    squareStyles,
    handlePieceDrag,
    handlePieceDropEnd,
    handleSquareClick
  } = useBoardHighlights({
    game: chess,
    history: chess.history({ verbose: true }) as any,
  });

  // Use the same board theme and settings from local PlayArea
  const { settings } = useSettings();
  const { addToast } = useToast();
  const [arrows, setArrows] = useState<any[]>([]);
  const [promotionState, setPromotionState] = useState<{ sourceSquare: string, targetSquare: string, color: 'w' | 'b' } | null>(null);
  const [showConfirmResign, setShowConfirmResign] = useState(false);
  
  // Chaos State
  const [chaosAction, setChaosAction] = useState<'none'|'spawn'|'remove'|'replace'>('none');
  const [spawnPiece, setSpawnPiece] = useState<{type: PieceSymbol, color: 'w'|'b'}>({ type: 'q', color: 'w' });
  const [freeMoveActive, setFreeMoveActive] = useState(false);
  const [ignoreTurnActive, setIgnoreTurnActive] = useState(false);
  const isChaos = gameData?.is_chaos ?? false;

  const doMove = (from: string, to: string, promotion?: 'q'|'r'|'b'|'n') => {
    makeMove({ from, to, promotion });
    return true;
  };

  const onDrop = (args: { sourceSquare: string, targetSquare: string | null }) => {
    if (gameData?.status !== 'active') return false;
    handlePieceDropEnd();
    if (!args.targetSquare) return false;
    
    if (isChaos && freeMoveActive) {
      const newFen = moveInFen(fen, args.sourceSquare, args.targetSquare);
      const finalFen = ignoreTurnActive ? newFen : switchTurnInFen(newFen);
      chaosUpdateGame({ fen: finalFen, current_turn: finalFen.split(' ')[1] as 'w'|'b' });
      return true;
    }

    const isPawn = chess.get(args.sourceSquare as any)?.type === 'p';
    const isPromotion = isPawn && (args.targetSquare[1] === '8' || args.targetSquare[1] === '1');

    if (isPromotion) {
      if (settings.autoQueen) {
        return doMove(args.sourceSquare, args.targetSquare, 'q');
      } else {
        setPromotionState({ sourceSquare: args.sourceSquare, targetSquare: args.targetSquare, color: chess.turn() });
        return false;
      }
    }

    return doMove(args.sourceSquare, args.targetSquare);
  };

  const handleChaosSquareClick = (square: string) => {
    if (!isChaos || chaosAction === 'none') return false;
    
    if (chaosAction === 'spawn') {
      const newFen = putInFen(fen, square, spawnPiece.type, spawnPiece.color);
      chaosUpdateGame({ fen: newFen });
    } else if (chaosAction === 'remove') {
      const newFen = removeInFen(fen, square);
      chaosUpdateGame({ fen: newFen });
    } else if (chaosAction === 'replace') {
      const newFen = putInFen(fen, square, spawnPiece.type, spawnPiece.color);
      chaosUpdateGame({ fen: newFen });
    }
    
    setChaosAction('none');
    return true;
  };

  const inviteUrl = `${window.location.origin}/play/link/${inviteCode}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(inviteUrl);
    if (success) {
      setCopied(true);
      addToast("Invite link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPgn = async () => {
    const pgn = gameData?.pgn || chess.pgn();
    let fullPgn = pgn;
    if (gameData?.time_control) {
      const tc = gameData.time_control;
      const parts = tc.split('+');
      const secs = parseInt(parts[0]) * 60;
      const inc = parts[1] || '0';
      fullPgn = `[TimeControl "${secs}+${inc}"]\n${pgn}`;
    }
    const success = await copyToClipboard(fullPgn);
    if (success) addToast("PGN copied to clipboard!", "success");
  };

  const handleResignClick = () => {
    if (settings.confirmResignation) {
      setShowConfirmResign(true);
    } else {
      resign();
    }
  };

  const isPlayer = gameData ? (gameData.white_player === playerId || gameData.black_player === playerId) : false;

  // Auto-abort timer logic
  useEffect(() => {
    // Disable if not active, or if in chaos mode
    if (gameData?.status !== 'active' || isChaos) {
      setAbortTimer(null);
      return;
    }
    
    // Only apply for the first 2 plies (White's first move and Black's first move)
    const plies = chess.history().length;
    if (plies >= 2) {
      setAbortTimer(null);
      return;
    }

    setAbortTimer(15);
    const interval = setInterval(() => {
      setAbortTimer(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameData?.status, chess.history().length, isChaos]);

  useEffect(() => {
    if (abortTimer === 0 && gameData?.status === 'active' && isPlayer) {
      abortGame();
    }
  }, [abortTimer, gameData?.status, isPlayer, abortGame]);

  // Phase 12: Timeout detection
  useEffect(() => {
    if (!clockState.isTimed || gameData?.status !== 'active') {
      timeoutClaimedRef.current = false;
      return;
    }

    const activeTimeMs = clockState.isWhiteActive ? clockState.whiteTimeMs : clockState.blackTimeMs;
    
    if (activeTimeMs <= 0 && !timeoutClaimedRef.current) {
      timeoutClaimedRef.current = true;
      
      const winnerColor = clockState.isWhiteActive ? 'b' : 'w'; 
      const isDraw = !hasSufficientMaterial(chess.fen(), winnerColor);
      
      claimTimeout(isDraw);
    }
  }, [clockState.whiteTimeMs, clockState.blackTimeMs, clockState.isWhiteActive, clockState.isTimed, gameData?.status, chess, claimTimeout]);

  // Auto-save when game completes
  useEffect(() => {
    if (gameData?.status === 'completed' && !hasSaved && onSaveGame && user) {
      let resStr = '*';
      if (gameData.winner) {
        resStr = gameData.winner === gameData.white_player ? '1-0' : '0-1';
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        resStr = '1/2-1/2';
      } else if (gameData.initial_time_ms && (gameData.white_time_ms === 0 || gameData.black_time_ms === 0) && !gameData.winner) {
        resStr = '1/2-1/2';
      }
      
      const whitePlayer = 'Player (White)';
      const blackPlayer = 'Player (Black)';
      const eventLabel = gameData.time_control ? `Link Game (${gameData.time_control})` : 'Link Game';
      onSaveGame(gameData.pgn, whitePlayer, blackPlayer, resStr, new Date().toLocaleDateString(), eventLabel, isChaos);
      setHasSaved(true);
    }
  }, [gameData?.status, gameData?.winner, gameData?.pgn, hasSaved, onSaveGame, chess, user, isChaos]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 mt-20 animate-fade-in">
        <div className="w-12 h-12 border-4 border-chess-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-bold">Loading game...</p>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 mt-20 animate-fade-in">
        <ShieldAlert size={48} className="text-red-500" />
        <h2 className="text-2xl font-bold text-white">Oops!</h2>
        <p className="text-slate-400">{error || 'Game not found.'}</p>
        <button onClick={onExit} className="px-6 py-2 bg-slate-800 rounded-lg text-white font-bold mt-4">
          Back to Home
        </button>
      </div>
    );
  }

  const playerColor = gameData.white_player === playerId ? 'white' : 'black';
  const baseOrientation = isPlayer ? playerColor : 'white';
  const boardOrientation = isFlipped ? (baseOrientation === 'white' ? 'black' : 'white') : baseOrientation;

  if (gameData.status === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 mt-20 animate-fade-in">
        <div className="w-16 h-16 border-4 border-chess-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-3xl font-bold text-white">Waiting for opponent...</h2>
        
        {gameData.time_control && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-center">
            <span className="text-chess-accent font-bold font-mono text-lg">{gameData.time_control}</span>
            <span className="text-slate-400 text-sm ml-2">time control</span>
          </div>
        )}
        
        {isPlayer ? (
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl max-w-md w-full text-center">
            <p className="text-slate-300 mb-4 font-medium">Share this invite link with your friend:</p>
            <div className="flex items-center gap-2 mb-6">
              <input 
                type="text" 
                readOnly 
                value={inviteUrl} 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-400 focus:outline-none"
              />
              <button 
                onClick={handleCopy}
                className="bg-chess-accent hover:bg-indigo-500 p-3 rounded-lg text-white transition-colors relative group"
                title="Copy Link"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied && <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-100 transition-opacity">Copied!</span>}
              </button>
            </div>
            
            <button 
              onClick={cancelGame}
              className="px-6 py-3 border border-red-900/50 hover:bg-red-900/30 text-red-400 font-bold rounded-lg transition-colors w-full"
            >
              Cancel Game
            </button>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl max-w-md w-full text-center">
            <p className="text-slate-300 mb-6 font-medium">You have been invited to a chess match!</p>
            
            {!user && (
              <div className="mb-4 text-sm text-slate-400 flex flex-col items-center gap-2">
                <span>Playing as Guest</span>
                <button onClick={onRequireAuth} className="text-chess-accent hover:underline text-xs">
                  Sign in to save this game to your history
                </button>
              </div>
            )}
            
            <button 
              onClick={joinGame}
              className="w-full py-4 bg-chess-accent hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors text-lg shadow-lg"
            >
              Join Game
            </button>
            <button onClick={onExit} className="mt-4 w-full py-3 text-slate-400 hover:text-white font-bold">
              No Thanks
            </button>
          </div>
        )}
      </div>
    );
  }

  const topColor = boardOrientation === 'white' ? 'black' : 'white';
  const bottomColor = boardOrientation === 'white' ? 'white' : 'black';
  const topLabel = isPlayer ? 'Opponent' : (topColor === 'white' ? 'White (Anonymous)' : 'Black (Anonymous)');
  const bottomLabel = isPlayer ? 'You' : (bottomColor === 'white' ? 'White (Anonymous)' : 'Black (Anonymous)');

  const topClockMs = topColor === 'white' ? clockState.whiteTimeMs : clockState.blackTimeMs;
  const bottomClockMs = bottomColor === 'white' ? clockState.whiteTimeMs : clockState.blackTimeMs;
  const topClockActive = topColor === 'white' ? clockState.isWhiteActive : clockState.isBlackActive;
  const bottomClockActive = bottomColor === 'white' ? clockState.isWhiteActive : clockState.isBlackActive;
  const activeTheme = BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.slate;

  const material = calculateMaterial(fen);
  const topCaptured = topColor === 'white' ? material.whiteCaptured : material.blackCaptured;
  const bottomCaptured = bottomColor === 'white' ? material.whiteCaptured : material.blackCaptured;
  const topAdvantage = topColor === 'white' ? material.whiteAdvantage : material.blackAdvantage;
  const bottomAdvantage = bottomColor === 'white' ? material.whiteAdvantage : material.blackAdvantage;

  const isTimeout = gameData.status === 'completed' && gameData.initial_time_ms && 
    (gameData.white_time_ms === 0 || gameData.black_time_ms === 0);
    
  let gameEndReason = 'Game Over';
  if (gameData.status === 'completed') {
    if (gameData.winner) {
      gameEndReason = `${gameData.winner === gameData.white_player ? 'White' : 'Black'} wins`;
    } else {
      gameEndReason = 'Game drawn';
    }
  } else if (gameData.status === 'abandoned') {
    gameEndReason = 'Game Abandoned';
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative">
      {showConfirmResign && (
        <ConfirmModal 
          title="Resign Game?" 
          message="Are you sure you want to resign? This will end the match immediately." 
          confirmText="Resign"
          onConfirm={() => { resign(); setShowConfirmResign(false); }}
          onCancel={() => setShowConfirmResign(false)}
        />
      )}

      <div className="lg:col-span-2 flex flex-col gap-3 relative">
        {/* Top Player Info + Clock */}
        <div className={`flex justify-between items-center border p-3 rounded-lg transition-colors ${topClockActive && gameData.status === 'active' ? 'bg-slate-800 border-chess-accent shadow-md' : 'bg-chess-panel border-chess-border'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xl ${topColor === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-black text-white border border-gray-600'}`}>
                {topColor === 'white' ? 'W' : 'B'}
              </div>
              <div className="font-bold text-white text-lg">{topLabel}</div>
            </div>
            <CapturedPieces pieces={topCaptured} advantage={topAdvantage} pieceSet={settings.pieceSet} />
          </div>
          {clockState.isTimed && (
            <ChessClock timeMs={topClockMs} isActive={topClockActive && gameData.status === 'active'} />
          )}
        </div>

        <div className="relative w-full max-w-[600px] aspect-square mx-auto rounded overflow-hidden shadow-2xl">
          <Chessboard
            options={{
              id: `LinkBoard-${inviteCode}`,
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
                if (gameData.status !== 'active') return;
                if (handleChaosSquareClick(args.square)) return;
                const move = handleSquareClick(args.square);
                if (move) {
                  if (isChaos && freeMoveActive) {
                     const newFen = moveInFen(fen, move.from, move.to);
                     const finalFen = ignoreTurnActive ? newFen : switchTurnInFen(newFen);
                     chaosUpdateGame({ fen: finalFen, current_turn: finalFen.split(' ')[1] as 'w'|'b' });
                     return;
                  }
                  
                  const isPawn = chess.get(move.from as any)?.type === 'p';
                  const isPromotion = isPawn && (move.to[1] === '8' || move.to[1] === '1');
                  if (isPromotion && !settings.autoQueen) {
                    setPromotionState({ sourceSquare: move.from, targetSquare: move.to, color: chess.turn() });
                  } else {
                    doMove(move.from, move.to, 'q');
                  }
                }
              },
              onPieceDrag: handlePieceDrag,
              onPieceDragCancel: handlePieceDropEnd,
              squareStyles: squareStyles,
              boardOrientation: boardOrientation as any,
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
          {gameData.status === 'completed' && (
             <GameOverModal 
               result={isTimeout ? 'Time Expired' : gameEndReason}
               onReview={isChaos ? undefined : (() => onReview?.(gameData.pgn || chess.pgn())) as any}
               onRematch={rematchGame}
               onHome={onExit}
             />
          )}
        </div>

        {/* Bottom Player Info + Clock */}
        <div className={`flex justify-between items-center border p-3 rounded-lg transition-colors ${bottomClockActive && gameData.status === 'active' ? 'bg-slate-800 border-chess-accent shadow-md' : 'bg-chess-panel border-chess-border'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xl ${bottomColor === 'white' ? 'bg-white text-black border border-gray-400' : 'bg-black text-white border border-gray-600'}`}>
                {bottomColor === 'white' ? 'W' : 'B'}
              </div>
              <div className="font-bold text-white text-lg">{bottomLabel}</div>
            </div>
            <CapturedPieces pieces={bottomCaptured} advantage={bottomAdvantage} pieceSet={settings.pieceSet} />
          </div>
          {clockState.isTimed && (
            <ChessClock timeMs={bottomClockMs} isActive={bottomClockActive && gameData.status === 'active'} />
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

      <div className="flex flex-col gap-4 h-[400px] lg:h-auto lg:min-h-[600px]">
        {gameData.time_control && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-center gap-2">
            <span className="text-chess-accent font-bold font-mono">{gameData.time_control}</span>
            <span className="text-slate-500 text-xs">time control</span>
          </div>
        )}

        {isTimeout && (
          <div className="bg-red-900/20 text-red-400 border border-red-900/50 p-3 rounded text-center text-sm font-bold">
            ⏱ {gameData.winner 
              ? `${gameData.winner === gameData.white_player ? 'White' : 'Black'} wins on time` 
              : 'Draw — insufficient material'}
          </div>
        )}

        {abortTimer !== null && abortTimer > 0 && gameData.status === 'active' && (
          <div className="bg-red-900/20 text-red-400 border border-red-900/50 p-3 rounded text-center text-sm font-bold animate-pulse">
            Auto-abort in {abortTimer}s if no move is made...
          </div>
        )}
        
        {gameData.status === 'abandoned' && (
          <div className="bg-orange-900/20 text-orange-400 border border-orange-900/50 p-3 rounded text-center text-sm font-bold">
            Game Abandoned
          </div>
        )}

        <OwnerPanel 
          isChaos={isChaos}
          onToggleChaos={async () => {
            if (!isChaos) await activateChaosMode();
          }}
          onSpawnPiece={() => setChaosAction(prev => prev === 'spawn' ? 'none' : 'spawn')}
          onRemovePiece={() => setChaosAction(prev => prev === 'remove' ? 'none' : 'remove')}
          onReplacePiece={() => setChaosAction(prev => prev === 'replace' ? 'none' : 'replace')}
          onFreeMoveToggle={(val) => setFreeMoveActive(val)}
          onIgnoreTurnToggle={(val) => setIgnoreTurnActive(val)}
          onSwitchTurn={() => {
             const newFen = switchTurnInFen(fen);
             chaosUpdateGame({ fen: newFen, current_turn: newFen.split(' ')[1] as 'w'|'b' });
          }}
          onClearBoard={() => {
             chaosUpdateGame({ fen: '8/8/8/8/8/8/8/8 w - - 0 1' });
          }}
          onResetPosition={() => {
             chaosUpdateGame({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', current_turn: 'w' });
          }}
          onPauseClock={() => chaosClockAction('pause', clockState.whiteTimeMs, clockState.blackTimeMs)}
          onResumeClock={() => chaosClockAction('resume')}
          onResetClock={() => chaosClockAction('reset')}
          freeMoveActive={freeMoveActive}
          ignoreTurnActive={ignoreTurnActive}
          chaosAction={chaosAction}
          spawnPiece={spawnPiece}
          setSpawnPiece={setSpawnPiece}
        />

        <div className="flex-1 min-h-0 overflow-hidden">
          <MoveHistory history={chess.history({ verbose: true })} />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setIsFlipped(!isFlipped)}
            className="flex items-center justify-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 hover:bg-slate-700 font-bold text-sm text-gray-300 transition-colors"
          >
            <RotateCcw size={16} /> Flip Board
          </button>
          <button 
            onClick={handleCopyPgn}
            className="flex items-center justify-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 hover:bg-slate-700 font-bold text-sm text-gray-300 transition-colors relative"
          >
            <Copy size={16} /> Copy PGN
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {gameData.status === 'active' && isPlayer && (
            <button 
              onClick={handleResignClick}
              className="col-span-2 bg-slate-700 hover:bg-red-900/50 hover:text-red-400 text-slate-300 py-3 rounded flex items-center justify-center gap-2 font-bold transition-colors border border-transparent hover:border-red-900"
            >
              <Flag size={18} /> Resign
            </button>
          )}
          {gameData.status !== 'active' && (
            <button 
              onClick={onExit}
              className="col-span-2 bg-transparent border border-slate-600 hover:bg-slate-800 py-3 rounded flex items-center justify-center gap-2 font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
