import React, { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { supabase } from '../services/supabase';
import { useLinkGame } from '../hooks/useLinkGame';
import { useAuth } from '../hooks/useAuth';
import { useChessClock } from '../hooks/useChessClock';
import { MoveHistory } from './MoveHistory';
import { ChessClock } from './ChessClock';
import { Copy, Flag, Check, ShieldAlert, RotateCcw, Eraser, Handshake } from 'lucide-react';
import { useBoardHighlights } from '../hooks/useBoardHighlights';
import { copyToClipboard } from '../utils/clipboard';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { useToast } from './Toast';
import { useSettings } from '../hooks/useSettings';
import { calculateMaterial, hasSufficientMaterial } from '../utils/material';
import { CapturedPieces } from './CapturedPieces';
import { PlayerAvatar } from './PlayerAvatar';
import { audioService } from '../services/audio';
import { ConfirmModal } from './ConfirmModal';
import { PromotionDialog } from './PromotionDialog';
import { GameOverModal } from './GameOverModal';
import { PREMIUM_ARROW_OPTIONS } from '../utils/arrows';

interface LinkPlayAreaProps {
  inviteCode: string;
  onExit: () => void;
  onReview?: (pgn: string) => void;
  onSaveGame?: (pgn: string, white: string, black: string, result: string, date: string, event: string) => void;
  onRequireAuth: () => void;
}

export const LinkPlayArea: React.FC<LinkPlayAreaProps> = ({ inviteCode, onExit, onReview, onSaveGame, onRequireAuth }) => {
  const { user } = useAuth();
  const { 
    gameData, fen, chess, error, loading, makeMove, joinGame, resign, 
    cancelGame, abortGame, claimTimeout, playerId, rematchGame, offerRematch, declineRematch, 
    offerDraw, acceptDraw, declineDraw, isReconnecting
  } = useLinkGame(inviteCode, user?.id);
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
  const [ratingChange, setRatingChange] = useState<{ diff: number, newRating: number } | undefined>(undefined);
  const [showGameOverModal, setShowGameOverModal] = useState(true);

  useEffect(() => {
    setArrows([]);
  }, [fen]);

  useEffect(() => {
    if (gameData?.status === 'completed' && user && gameData.id) {
      if (supabase) {
        supabase.from('rating_history')
          .select('change, rating_after')
          .eq('game_id', gameData.id)
          .eq('user_id', user.id)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setRatingChange({ diff: data[0].change, newRating: data[0].rating_after });
            }
          });
      }
    }
  }, [gameData?.status, gameData?.id, user]);
  
  const doMove = (from: string, to: string, promotion?: 'q'|'r'|'b'|'n') => {
    setArrows([]);
    makeMove({ from, to, promotion });
    return true;
  };

  const onDrop = (args: { sourceSquare: string, targetSquare: string | null }) => {
    if (gameData?.status !== 'active') return false;
    handlePieceDropEnd();
    if (!args.targetSquare) return false;

    const legalMoves = chess.moves({ square: args.sourceSquare as any, verbose: true });
    const isPromotion = legalMoves.some(m => m.to === args.targetSquare && m.promotion);

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
    if (gameData?.status !== 'active') {
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
  }, [gameData?.status, chess.history().length]);

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

  // Audio Effects
  const prevStatus = useRef(gameData?.status);
  useEffect(() => {
    if (gameData?.status === 'completed' && prevStatus.current === 'active') {
      if (gameData.winner === playerId) audioService.playVictory();
      else if (gameData.winner) audioService.playDefeat();
      else audioService.playDraw();
    }
    prevStatus.current = gameData?.status;
  }, [gameData?.status, gameData?.winner, playerId]);

  const prevRematchOffer = useRef(gameData?.rematch_offer_by);
  const prevDrawOffer = useRef(gameData?.draw_offer_by);
  useEffect(() => {
    if (gameData?.rematch_offer_by && gameData.rematch_offer_by !== prevRematchOffer.current) {
      if (gameData.rematch_offer_by !== (gameData.white_player === playerId ? 'w' : 'b')) {
        audioService.playNotify();
      }
    }
    if (gameData?.draw_offer_by && gameData.draw_offer_by !== prevDrawOffer.current) {
      if (gameData.draw_offer_by !== (gameData.white_player === playerId ? 'w' : 'b')) {
        audioService.playNotify();
      }
    }
    prevRematchOffer.current = gameData?.rematch_offer_by;
    prevDrawOffer.current = gameData?.draw_offer_by;
  }, [gameData?.rematch_offer_by, gameData?.draw_offer_by, gameData?.white_player, playerId]);

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
      onSaveGame(gameData.pgn, whitePlayer, blackPlayer, resStr, new Date().toLocaleDateString(), eventLabel);
      setHasSaved(true);
    }
  }, [gameData?.status, gameData?.winner, gameData?.pgn, hasSaved, onSaveGame, chess, user]);

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
  const topPlayerId = topColor === 'white' ? gameData.white_player : gameData.black_player;
  const bottomPlayerId = bottomColor === 'white' ? gameData.white_player : gameData.black_player;
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
      if (chess.isCheckmate()) {
        gameEndReason = `${gameData.winner === gameData.white_player ? 'White' : 'Black'} wins by Checkmate`;
      } else if (isTimeout) {
        gameEndReason = `${gameData.winner === gameData.white_player ? 'White' : 'Black'} wins on time`;
      } else {
        gameEndReason = `${gameData.winner === gameData.white_player ? 'Black' : 'White'} resigned`;
      }
    } else {
      if (chess.isStalemate()) gameEndReason = 'Draw by Stalemate';
      else if (chess.isThreefoldRepetition()) gameEndReason = 'Draw by Repetition';
      else if (chess.isInsufficientMaterial()) gameEndReason = 'Draw by Insufficient Material';
      else gameEndReason = 'Game drawn';
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

      <div className="lg:col-span-2 flex justify-center gap-4 relative">
        <div className="w-full max-w-[600px] flex flex-col gap-3 relative">
          {/* Top Player Info + Clock */}
          <div className={`flex justify-between items-center border p-3 rounded-lg transition-colors ${topClockActive && gameData.status === 'active' ? 'bg-surface-3 border-accent shadow-md' : 'bg-surface-2 border-border-1 shadow-sm'}`}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <PlayerAvatar 
                  userId={topPlayerId} 
                  color={topColor} 
                  className="w-10 h-10 rounded shadow-sm text-xl"
                />
                <div className="font-bold text-content-1 text-lg">{topLabel}</div>
              </div>
              <CapturedPieces pieces={topCaptured} advantage={topAdvantage} pieceSet={settings.pieceSet} />
            </div>
            {clockState.isTimed && (
              <ChessClock timeMs={topClockMs} isActive={topClockActive && gameData.status === 'active'} />
            )}
          </div>
  
          <div className="relative w-full aspect-square rounded overflow-hidden shadow-sm border border-border-1">
            <Chessboard
              options={{
                id: `LinkBoard-${inviteCode}`,
                position: fen,
                showNotation: settings.showCoordinates,
                animationDurationInMs: settings.moveAnimations ? 200 : 0,
                pieces: getCustomPieces(settings.pieceSet),
                allowDrawingArrows: true,
                arrows: arrows,
                arrowOptions: PREMIUM_ARROW_OPTIONS as any,
                onArrowsChange: ({ arrows }) => setArrows(arrows),
                onPieceDrop: onDrop,
                onSquareClick: (args) => {
                  if (gameData.status !== 'active') return;
                  const move = handleSquareClick(args.square);
                  if (move) {
                    const legalMoves = chess.moves({ square: move.from as any, verbose: true });
                    const isPromotion = legalMoves.some(m => m.to === move.to && m.promotion);
                    if (isPromotion && !settings.autoQueen) {
                      setPromotionState({ sourceSquare: move.from, targetSquare: move.to, color: chess.turn() });
                    } else {
                      doMove(move.from, move.to, isPromotion ? 'q' : undefined);
                    }
                  }
                },
                onPieceDrag: handlePieceDrag,
                onPieceDragCancel: handlePieceDropEnd,
                squareStyles: squareStyles,
                boardOrientation: boardOrientation as any,
                darkSquareStyle: { backgroundColor: activeTheme.dark },
                lightSquareStyle: { backgroundColor: activeTheme.light },
                darkSquareNotationStyle: { color: activeTheme.light },
                lightSquareNotationStyle: { color: activeTheme.dark }
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
                onCancel={() => setPromotionState(null)}
              />
            )}
            {gameData.status === 'completed' && showGameOverModal && (
               <GameOverModal 
                   result={isTimeout ? 'Time Expired' : gameEndReason}
                   playerColor={gameData.white_player === playerId ? 'white' : 'black'}
                   onReview={(() => onReview?.(gameData.pgn || chess.pgn())) as any}
                   onRematch={gameData.rematch_offer_by === (gameData.white_player === playerId ? 'b' : 'w') ? rematchGame : offerRematch}
                   rematchOffer={{
                     byMe: gameData.rematch_offer_by === (gameData.white_player === playerId ? 'w' : 'b'),
                     byOpponent: gameData.rematch_offer_by === (gameData.white_player === playerId ? 'b' : 'w'),
                     onDecline: declineRematch
                   }}
                   ratingChange={ratingChange}
                   onViewBoard={() => setShowGameOverModal(false)}
                   onHome={onExit}
                 />
            )}
          </div>
  
          {/* Bottom Player Info + Clock */}
          <div className={`flex justify-between items-center border p-3 rounded-lg transition-colors ${bottomClockActive && gameData.status === 'active' ? 'bg-surface-3 border-accent shadow-md' : 'bg-surface-2 border-border-1 shadow-sm'}`}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <PlayerAvatar 
                  userId={bottomPlayerId} 
                  color={bottomColor} 
                  className="w-10 h-10 rounded shadow-sm text-xl"
                />
                <div className="font-bold text-content-1 text-lg">{bottomLabel}</div>
              </div>
              <CapturedPieces pieces={bottomCaptured} advantage={bottomAdvantage} pieceSet={settings.pieceSet} />
            </div>
            {clockState.isTimed && (
              <ChessClock timeMs={bottomClockMs} isActive={bottomClockActive && gameData.status === 'active'} />
            )}
          </div>
          
          {arrows.length > 0 && (
             <div className="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full z-10">
               <button onClick={() => setArrows([])} className="bg-surface-2 hover:bg-surface-3 p-3 rounded-full shadow-lg border border-border-1 text-content-3 hover:text-warning transition-colors" title="Clear Arrows">
                  <Eraser size={20} />
               </button>
             </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 h-[400px] lg:h-auto lg:min-h-[600px]">
        {isReconnecting && (
          <div className="bg-amber-900/40 border border-amber-500/50 rounded-lg px-3 py-2 flex items-center justify-center gap-2 text-amber-400">
            <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="font-bold text-sm">Reconnecting...</span>
          </div>
        )}
        
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
            <>
              <button 
                onClick={handleResignClick}
                className={`${gameData.draw_offer_by ? 'col-span-1' : 'col-span-1'} bg-slate-700 hover:bg-red-900/50 hover:text-red-400 text-slate-300 py-3 rounded flex items-center justify-center gap-2 font-bold transition-colors border border-transparent hover:border-red-900`}
              >
                <Flag size={18} /> Resign
              </button>
              
              {gameData.draw_offer_by === (gameData.white_player === playerId ? 'b' : 'w') ? (
                <div className="col-span-1 grid grid-cols-2 gap-1">
                  <button onClick={acceptDraw} title="Accept Draw" className="bg-green-700/50 hover:bg-green-600 text-white py-3 rounded flex items-center justify-center transition-colors">
                    <Check size={18} />
                  </button>
                  <button onClick={declineDraw} title="Decline Draw" className="bg-red-900/50 hover:bg-red-800 text-white py-3 rounded flex items-center justify-center transition-colors">
                    X
                  </button>
                </div>
              ) : (
                <button 
                  onClick={offerDraw}
                  disabled={gameData.draw_offer_by === (gameData.white_player === playerId ? 'w' : 'b')}
                  className="col-span-1 bg-slate-700 hover:bg-chess-accent hover:text-white text-slate-300 py-3 rounded flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Handshake size={18} /> 
                  {gameData.draw_offer_by === (gameData.white_player === playerId ? 'w' : 'b') ? 'Sent...' : 'Draw'}
                </button>
              )}
            </>
          )}
          {gameData.status === 'completed' && !showGameOverModal && (
            <div className="col-span-2 bg-surface-3 border border-border-1 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-content-1">{isTimeout ? 'Time Expired' : gameEndReason}</span>
                <button 
                  onClick={() => setShowGameOverModal(true)}
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  Show Outcome
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => onReview?.(gameData.pgn || chess.pgn())}
                  className="bg-accent hover:bg-accent-hover text-white py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  Review Game
                </button>
                <button 
                  onClick={gameData.rematch_offer_by === (gameData.white_player === playerId ? 'b' : 'w') ? rematchGame : offerRematch}
                  className="bg-surface-2 hover:bg-surface-1 border border-border-1 text-content-1 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  {gameData.rematch_offer_by === (gameData.white_player === playerId ? 'b' : 'w') ? 'Accept Rematch' : 'Rematch'}
                </button>
              </div>
            </div>
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
