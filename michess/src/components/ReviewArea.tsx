import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useGameReview } from '../hooks/useGameReview';
import { EvaluationBar } from './EvaluationBar';
import { Bot, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Info, AlertTriangle, User, Copy, Sparkles, Eraser } from 'lucide-react';
import { CLASSIFICATIONS, type MoveClassificationType } from '../types/classification';
import { getClassificationExplanation } from '../utils/classification';
import { EvaluationGraph } from './EvaluationGraph';
import { ReviewStats } from './ReviewStats';
import { MoveClassificationBadge } from './MoveClassificationBadge';
import { copyToClipboard } from '../utils/clipboard';
import { useSettings } from '../hooks/useSettings';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { calculateMaterial } from '../utils/material';
import { CapturedPieces } from './CapturedPieces';
import { useToast } from './Toast';
import { getOpeningsDB, findOpening } from '../utils/openings';

interface ReviewAreaProps {
  pgn: string;
  onExit: () => void;
  onReviewComplete?: (pgn: string, stats: any) => void;
}

export const ReviewArea: React.FC<ReviewAreaProps> = ({ pgn, onExit, onReviewComplete }) => {
  const { settings, updateSettings } = useSettings();
  const { addToast } = useToast();
  const { isAnalyzing, progress, totalPositions, analyzedMoves, error, gameMeta, startAnalysis, cancelAnalysis } = useGameReview({ pgn, depth: 10 });
  
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(settings.boardOrientation);
  const [openingName, setOpeningName] = useState<string | null>(null);
  const [openingEco, setOpeningEco] = useState<string | null>(null);
  
  // Best moves indicator and arrow states
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [userArrows, setUserArrows] = useState<any[]>([]);

  useEffect(() => {
    setSelectedSquare(null);
    setUserArrows([]);
  }, [currentMoveIndex]);

  useEffect(() => {
    startAnalysis();
    return () => cancelAnalysis();
  }, [startAnalysis, cancelAnalysis]);

  useEffect(() => {
    if (analyzedMoves.length === 0) return;
    getOpeningsDB().then(db => {
      const sans = analyzedMoves.map(m => m.san);
      const match = findOpening(sans, db);
      if (match.opening) {
        setOpeningName(match.opening.name);
        setOpeningEco(match.opening.eco);
      }
    });
  }, [analyzedMoves.length]);

  const goToFirst = useCallback(() => setCurrentMoveIndex(-1), []);
  const goToLast = useCallback(() => setCurrentMoveIndex(analyzedMoves.length - 1), [analyzedMoves.length]);
  const goToNext = useCallback(() => setCurrentMoveIndex(prev => Math.min(analyzedMoves.length - 1, prev + 1)), [analyzedMoves.length]);
  const goToPrev = useCallback(() => setCurrentMoveIndex(prev => Math.max(-1, prev - 1)), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowRight':
          goToNext();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'Home':
          goToFirst();
          break;
        case 'End':
          goToLast();
          break;
        case 'Escape':
          onExit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, goToFirst, goToLast, onExit]);

  // Get current position data
  let currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  let currentEval = undefined;
  
  if (analyzedMoves.length > 0) {
    if (currentMoveIndex === -1) {
      currentFen = analyzedMoves[0].fenBefore;
      currentEval = analyzedMoves[0].evalBefore;
    } else {
      currentFen = analyzedMoves[currentMoveIndex].fenAfter;
      currentEval = analyzedMoves[currentMoveIndex].evalAfter;
    }
  }

  // Format move list nicely
  const movePairs: { white?: any, black?: any, moveNumber: number }[] = [];
  analyzedMoves.forEach(m => {
    if (m.color === 'w') {
      movePairs.push({ moveNumber: m.moveNumber, white: m });
    } else {
      if (movePairs.length === 0) {
        movePairs.push({ moveNumber: m.moveNumber, black: m });
      } else {
        movePairs[movePairs.length - 1].black = m;
      }
    }
  });

  // Calculate Accuracy
  let whiteAccuracy: number | null = null;
  let blackAccuracy: number | null = null;
  let overallAccuracy: number | null = null;

  if (analyzedMoves.length > 0 && !isAnalyzing) {
    const whiteMoves = analyzedMoves.filter(m => m.color === 'w');
    const blackMoves = analyzedMoves.filter(m => m.color === 'b');
    
    if (whiteMoves.length > 0) {
      whiteAccuracy = whiteMoves.reduce((sum, m) => sum + (m.accuracy || 0), 0) / whiteMoves.length;
    }
    if (blackMoves.length > 0) {
      blackAccuracy = blackMoves.reduce((sum, m) => sum + (m.accuracy || 0), 0) / blackMoves.length;
    }
    
    if (whiteAccuracy !== null && blackAccuracy !== null) {
      overallAccuracy = (whiteAccuracy + blackAccuracy) / 2;
    } else {
      overallAccuracy = whiteAccuracy || blackAccuracy;
    }
  }

  useEffect(() => {
    if (!isAnalyzing && analyzedMoves.length > 0 && onReviewComplete) {
      const counts: Record<string, number> = {};
      analyzedMoves.forEach(m => {
        if (m.classification) {
          counts[m.classification] = (counts[m.classification] || 0) + 1;
        }
      });
      
      onReviewComplete(pgn, {
        whiteAccuracy: whiteAccuracy || undefined,
        blackAccuracy: blackAccuracy || undefined,
        overallAccuracy: overallAccuracy || undefined,
        classifications: counts
      });
    }
  }, [isAnalyzing, analyzedMoves.length, onReviewComplete, pgn, whiteAccuracy, blackAccuracy, overallAccuracy]);

  const renderBoardAnnotation = () => {
    if (currentMoveIndex < 0 || !analyzedMoves[currentMoveIndex]) return null;
    const move = analyzedMoves[currentMoveIndex];
    if (!move.classification || move.classification === 'unclassified') return null;
    
    const uci = move.uci; // e.g., 'e2e4'
    if (!uci || uci.length < 4) return null;
    const dest = uci.substring(2, 4); // 'e4'
    const colChar = dest.charAt(0);
    const rowChar = dest.charAt(1);
    
    const colIdx = colChar.charCodeAt(0) - 'a'.charCodeAt(0);
    const rowIdx = parseInt(rowChar) - 1;
    
    let left = 0;
    let top = 0;
    
    if (boardOrientation === 'white') {
      left = colIdx * 12.5;
      top = (7 - rowIdx) * 12.5;
    } else {
      left = (7 - colIdx) * 12.5;
      top = rowIdx * 12.5;
    }
    
    return (
      <div 
        className="absolute z-10 pointer-events-none flex items-center justify-center"
        style={{
          left: `${left + 12.5}%`,
          top: `${top}%`,
          width: '40px',
          height: '40px',
          marginLeft: '-20px',
          marginTop: '-20px'
        }}
      >
        <MoveClassificationBadge 
          classification={move.classification} 
          size="lg"
          className="drop-shadow-md max-w-none" 
        />
      </div>
    );
  };

  // Helper to format UCI move to SAN
  const getMoveSan = (fenBefore?: string, uciMove?: string): string => {
    if (!fenBefore || !uciMove || uciMove.length < 4) return uciMove || '';
    try {
      const c = new Chess(fenBefore);
      const m = c.move({
        from: uciMove.substring(0, 2),
        to: uciMove.substring(2, 4),
        promotion: uciMove.length === 5 ? uciMove[4] : undefined
      });
      return m ? m.san : uciMove;
    } catch {
      return uciMove;
    }
  };

  // Calculate arrows for Best Move and clicked Piece candidate moves
  const boardArrows = useMemo(() => {
    const list: any[] = [...userArrows];

    // 1. Engine Best Move Indicator
    if (showBestMoveArrow) {
      if (currentMoveIndex >= 0 && analyzedMoves[currentMoveIndex]) {
        const move = analyzedMoves[currentMoveIndex];
        const best = move.bestMove;

        if (best && best.length >= 4) {
          const bestFrom = best.substring(0, 2);
          const bestTo = best.substring(2, 4);

          const isUserBest = move.uci === best;

          if (isUserBest) {
            // Player found the best move!
            list.push({
              startSquare: bestFrom,
              endSquare: bestTo,
              color: 'rgba(34, 197, 94, 0.85)' // Emerald green
            });
          } else {
            // Best move in vibrant green
            list.push({
              startSquare: bestFrom,
              endSquare: bestTo,
              color: 'rgba(34, 197, 94, 0.9)'
            });

            // If player played an inaccuracy/mistake/blunder, show what they played
            if (move.uci && move.uci.length >= 4) {
              const playedFrom = move.uci.substring(0, 2);
              const playedTo = move.uci.substring(2, 4);
              const isSevere = move.classification === 'blunder' || move.classification === 'mistake';
              list.push({
                startSquare: playedFrom,
                endSquare: playedTo,
                color: isSevere ? 'rgba(239, 68, 68, 0.75)' : 'rgba(245, 158, 11, 0.75)'
              });
            }
          }
        }
      } else if (currentMoveIndex === -1 && analyzedMoves[0]?.bestMove) {
        // Initial position best move (e.g. e4)
        const initialBest = analyzedMoves[0].bestMove;
        if (initialBest.length >= 4) {
          list.push({
            startSquare: initialBest.substring(0, 2),
            endSquare: initialBest.substring(2, 4),
            color: 'rgba(34, 197, 94, 0.85)'
          });
        }
      }
    }

    // 2. Candidate moves for clicked piece (matching screenshot with yellow arrows)
    if (selectedSquare) {
      try {
        const tempChess = new Chess(currentFen);
        const piece = tempChess.get(selectedSquare as any);
        if (piece) {
          // Temporarily ensure turn matches piece to generate its candidate moves
          const fenTokens = currentFen.split(' ');
          fenTokens[1] = piece.color;
          const pieceChess = new Chess(fenTokens.join(' '));
          const pMoves = pieceChess.moves({ square: selectedSquare as any, verbose: true });
          
          pMoves.forEach((pm: any) => {
            list.push({
              startSquare: pm.from,
              endSquare: pm.to,
              color: 'rgba(245, 158, 11, 0.85)' // Warm amber/yellow arrow like in screenshot
            });
          });
        }
      } catch (err) {
        console.warn("Error calculating candidate arrows", err);
      }
    }

    return list;
  }, [userArrows, showBestMoveArrow, currentMoveIndex, analyzedMoves, selectedSquare, currentFen]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(245, 158, 11, 0.35)',
        boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.85)'
      };
    }
    return styles;
  }, [selectedSquare]);

  const activeTheme = BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.slate;
  const material = calculateMaterial(currentFen);

  return (
    <div className="w-full h-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 animate-fade-in">
      
      {/* LEFT COLUMN: Board & Eval */}
      <div className="lg:col-span-2 flex justify-center gap-4 relative">
        {/* Eval Bar */}
        <div className="hidden sm:block">
          <EvaluationBar score={currentEval?.score} orientation={boardOrientation} />
        </div>

        <div className="w-full max-w-[600px] flex flex-col relative">
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex flex-col gap-1">
              <div className="font-bold text-content-2 flex items-center gap-2">
                {boardOrientation === 'white' ? (
                  <>{gameMeta.black === 'Stockfish' ? <Bot size={20} /> : <User size={20} />} {gameMeta.black}</>
                ) : (
                  <>{gameMeta.white === 'Stockfish' ? <Bot size={20} /> : <User size={20} />} {gameMeta.white}</>
                )}
              </div>
              <CapturedPieces 
                pieces={boardOrientation === 'white' ? material.blackCaptured : material.whiteCaptured} 
                advantage={boardOrientation === 'white' ? material.blackAdvantage : material.whiteAdvantage} 
                pieceSet={settings.pieceSet} 
              />
            </div>
            <div className="text-sm text-gray-400 font-bold tracking-widest">{gameMeta.result}</div>
          </div>
          
          <div className="relative aspect-square rounded-lg shadow-2xl">
            <Chessboard 
              options={{
                  position: currentFen,
                  showNotation: settings.showCoordinates,
                  boardOrientation: boardOrientation,
                  darkSquareStyle: { backgroundColor: activeTheme.dark },
                  lightSquareStyle: { backgroundColor: activeTheme.light },
                  darkSquareNotationStyle: { color: activeTheme.light },
                  lightSquareNotationStyle: { color: activeTheme.dark },
                  animationDurationInMs: settings.moveAnimations ? 200 : 0,
                  pieces: getCustomPieces(settings.pieceSet),
                  allowDragging: false,
                  canDragPiece: () => false,
                  allowDrawingArrows: true,
                  arrows: boardArrows,
                  onArrowsChange: ({ arrows }) => setUserArrows(arrows),
                  arrowOptions: { color: 'rgba(245, 158, 11, 0.85)' } as any,
                  squareStyles: squareStyles,
                  onSquareClick: (args: any) => {
                    const square = args?.square;
                    if (!square) return;
                    if (selectedSquare === square) {
                      setSelectedSquare(null);
                    } else {
                      const tempChess = new Chess(currentFen);
                      const piece = tempChess.get(square as any);
                      if (piece) {
                        setSelectedSquare(square);
                      } else {
                        setSelectedSquare(null);
                      }
                    }
                  }
                }}
            />
            {settings.showBoardAnnotation && renderBoardAnnotation()}
          </div>
          
          <div className="flex justify-between items-center mt-2 px-1">
            <div className="flex flex-col gap-1">
              <div className="font-bold text-content-2 flex items-center gap-2">
                {boardOrientation === 'white' ? (
                  <>{gameMeta.white === 'Stockfish' ? <Bot size={20} /> : <User size={20} />} {gameMeta.white}</>
                ) : (
                  <>{gameMeta.black === 'Stockfish' ? <Bot size={20} /> : <User size={20} />} {gameMeta.black}</>
                )}
              </div>
              <CapturedPieces 
                pieces={boardOrientation === 'white' ? material.whiteCaptured : material.blackCaptured} 
                advantage={boardOrientation === 'white' ? material.whiteAdvantage : material.blackAdvantage} 
                pieceSet={settings.pieceSet} 
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 mt-6">
            <div className="flex justify-center items-center gap-4 bg-surface-2 p-3 rounded-lg border border-border-1">
              <button onClick={goToFirst} disabled={currentMoveIndex === -1} className="p-2 hover:bg-surface-3 rounded transition-colors disabled:opacity-50 text-content-2 hover:text-content-1" title="Go to First Move (Home)" aria-label="Go to First Move"><ChevronsLeft /></button>
              <button onClick={goToPrev} disabled={currentMoveIndex === -1} className="p-2 hover:bg-surface-3 rounded transition-colors disabled:opacity-50 text-content-2 hover:text-content-1" title="Previous Move (Left Arrow)" aria-label="Previous Move"><ChevronLeft /></button>
              <button onClick={goToNext} disabled={currentMoveIndex >= analyzedMoves.length - 1} className="p-2 hover:bg-surface-3 rounded transition-colors disabled:opacity-50 text-content-2 hover:text-content-1" title="Next Move (Right Arrow)" aria-label="Next Move"><ChevronRight /></button>
              <button onClick={goToLast} disabled={currentMoveIndex >= analyzedMoves.length - 1} className="p-2 hover:bg-surface-3 rounded transition-colors disabled:opacity-50 text-content-2 hover:text-content-1" title="Go to Last Move (End)" aria-label="Go to Last Move"><ChevronsRight /></button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setShowBestMoveArrow(prev => !prev)}
                className={`flex items-center justify-center gap-1.5 p-3 rounded-lg border font-bold text-xs sm:text-sm transition-all ${
                  showBestMoveArrow 
                    ? 'bg-accent/20 border-accent text-accent shadow-sm' 
                    : 'bg-surface-2 border-border-1 text-content-2 hover:bg-surface-3'
                }`}
                title="Toggle Engine Best Move Indicator Arrow"
              >
                <Sparkles size={16} className={showBestMoveArrow ? "text-accent animate-pulse" : ""} /> 
                <span className="hidden sm:inline">Best Move</span>
                <span>{showBestMoveArrow ? 'ON' : 'OFF'}</span>
              </button>
              <button 
                onClick={() => {
                  const newOrientation = boardOrientation === 'white' ? 'black' : 'white';
                  setBoardOrientation(newOrientation);
                  updateSettings({ boardOrientation: newOrientation });
                }} 
                className="flex items-center justify-center gap-1.5 bg-surface-2 p-3 rounded-lg border border-border-1 hover:bg-surface-3 font-bold text-xs sm:text-sm text-content-2 transition-colors"
                title="Flip Board"
                aria-label="Flip Board"
              >
                <RotateCcw size={16} /> Flip
              </button>
              <button onClick={async () => {
                await copyToClipboard(pgn);
                addToast("PGN copied to clipboard!", "success");
              }} className="flex items-center justify-center gap-1.5 bg-surface-2 p-3 rounded-lg border border-border-1 hover:bg-surface-3 font-bold text-xs sm:text-sm text-content-2 transition-colors" title="Copy PGN" aria-label="Copy PGN">
                <Copy size={16} /> PGN
              </button>
            </div>

            {(userArrows.length > 0 || selectedSquare) && (
              <button
                onClick={() => {
                  setUserArrows([]);
                  setSelectedSquare(null);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-surface-3 hover:bg-border-1 text-content-2 rounded-lg text-xs font-semibold transition-colors mt-1"
              >
                <Eraser size={14} /> Clear Selection & Custom Arrows
              </button>
            )}
          </div>
          
          {/* Legend */}
          <div className="bg-surface-2 border border-border-1 p-4 rounded-lg text-xs flex flex-col gap-2 mt-2 mb-8">
            <h4 className="font-bold text-content-3 mb-1">Classification Legend</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2">
              {Object.values(CLASSIFICATIONS).filter(c => c.id !== 'unclassified').map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  <MoveClassificationBadge classification={c.id as MoveClassificationType} />
                  <span className="text-content-2">{c.name}</span>
                </div>
              ))}
            </div>
            <p className="text-content-3 mt-2 italic text-[10px]">
              * Michess classifications are engine-based estimates and are not official Chess.com or Lichess labels.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Review Queue, Move List & Details */}
      <div className="flex flex-col gap-4 h-full lg:h-[800px]">
        {/* Header / Queue Status */}
        <div className="bg-surface-2 border border-border-1 p-4 rounded-lg flex flex-col justify-between shrink-0">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-bold text-lg text-content-1 flex items-center gap-2"><Info size={18} className="text-accent" /> Game Review</h2>
            <button onClick={onExit} className="text-xs font-bold bg-surface-3 hover:bg-surface-3 text-content-2 hover:text-content-1 px-3 py-1.5 rounded transition-colors" title="Press Esc to exit">Exit (Esc)</button>
          </div>
          
          {isAnalyzing ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-warning font-bold">
                <span>Analyzing game...</span>
                <span>{progress} / {totalPositions}</span>
              </div>
              <div className="w-full bg-surface-3 h-2 rounded overflow-hidden">
                <div className="bg-warning h-full transition-all duration-300" style={{ width: `${(progress / totalPositions) * 100}%` }}></div>
              </div>
              <button onClick={cancelAnalysis} className="text-xs text-content-3 hover:text-content-1 mt-1 self-start font-bold">Cancel Analysis</button>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-error text-sm font-bold bg-error/10 p-2 rounded">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : (
            <div className="text-sm text-success font-bold flex items-center gap-2 bg-success/10 p-2 rounded">
              Analysis Complete
            </div>
          )}
        </div>

        {/* Game Stats & Graph */}
        {!isAnalyzing && analyzedMoves.length > 0 && (
          <div className="flex flex-col gap-4 shrink-0">
            <ReviewStats 
              analyzedMoves={analyzedMoves}
              whiteAccuracy={whiteAccuracy}
              blackAccuracy={blackAccuracy}
              overallAccuracy={overallAccuracy}
              openingName={openingName || undefined}
              openingEco={openingEco || undefined}
              onMoveSelect={setCurrentMoveIndex}
            />
            <EvaluationGraph 
              analyzedMoves={analyzedMoves}
              currentMoveIndex={currentMoveIndex}
              onMoveSelect={setCurrentMoveIndex}
            />
          </div>
        )}

        {/* Move Details Pane */}
        {currentMoveIndex >= 0 && analyzedMoves[currentMoveIndex] && (
          <div className="bg-surface-2 border border-border-1 p-4 rounded-lg flex flex-col gap-3 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start border-b border-border-1 pb-2 relative z-10">
              <h3 className="font-bold flex items-center gap-2 text-content-1">
                <Info size={16} className="text-accent" /> Move Details
              </h3>
              {analyzedMoves[currentMoveIndex].classification && (
                <div className="flex items-center gap-2 text-sm font-bold text-content-1 bg-surface-3 px-2 py-1 rounded shadow-md">
                  <MoveClassificationBadge classification={analyzedMoves[currentMoveIndex].classification} />
                  <span>{CLASSIFICATIONS[analyzedMoves[currentMoveIndex].classification].name}</span>
                </div>
              )}
            </div>

            {analyzedMoves[currentMoveIndex].classification && analyzedMoves[currentMoveIndex].classification !== 'unclassified' && (
              <div className="text-sm text-content-2 italic mb-1 relative z-10">
                {getClassificationExplanation(analyzedMoves[currentMoveIndex].classification)}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-y-2 text-sm relative z-10">
              <div className="text-content-3">Move:</div>
              <div className="font-bold text-content-1 text-base">{analyzedMoves[currentMoveIndex].moveNumber}. {analyzedMoves[currentMoveIndex].color === 'b' && '...'} {analyzedMoves[currentMoveIndex].san}</div>
              
              <div className="text-content-3">Evaluation:</div>
              <div className="font-bold text-content-1">
                {analyzedMoves[currentMoveIndex].evalAfter.score?.type === 'mate' 
                  ? `M${Math.abs(analyzedMoves[currentMoveIndex].evalAfter.score!.value)}` 
                  : `${((analyzedMoves[currentMoveIndex].evalAfter.score?.value || 0) / 100).toFixed(2)}`}
              </div>

              <div className="text-content-3">Eval Loss:</div>
              <div className={`font-bold ${analyzedMoves[currentMoveIndex].evalLoss > 50 ? 'text-error' : 'text-content-2'}`}>
                {(analyzedMoves[currentMoveIndex].evalLoss / 100).toFixed(2)}
              </div>
              
              {analyzedMoves[currentMoveIndex].accuracy !== undefined && (
                <>
                  <div className="text-content-3">Accuracy:</div>
                  <div className="font-bold text-content-1">
                    {analyzedMoves[currentMoveIndex].accuracy?.toFixed(1)}%
                  </div>
                </>
              )}
              
              {analyzedMoves[currentMoveIndex].bestMove && (
                <>
                  <div className="text-content-3">Engine Best:</div>
                  <div className="font-mono text-success text-xs flex items-center bg-success/10 px-2 py-0.5 rounded gap-1.5 font-bold">
                    <Sparkles size={12} className="text-success shrink-0" />
                    <span>{getMoveSan(analyzedMoves[currentMoveIndex].fenBefore, analyzedMoves[currentMoveIndex].bestMove)}</span>
                    <span className="text-[10px] opacity-60 font-sans font-normal">({analyzedMoves[currentMoveIndex].bestMove})</span>
                  </div>
                </>
              )}
            </div>
            
            {analyzedMoves[currentMoveIndex].pv && (
              <div className="mt-2 text-xs relative z-10">
                <div className="text-content-3 mb-1">Engine Line (Depth {analyzedMoves[currentMoveIndex].depth}):</div>
                <div className="font-mono text-content-2 break-words leading-relaxed opacity-70 bg-surface-1/50 p-2 rounded">
                  {analyzedMoves[currentMoveIndex].pv}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Move List */}
        <details className="bg-surface-2 border border-border-1 rounded-lg group flex-1 overflow-hidden flex flex-col" open>
          <summary className="font-bold text-content-1 p-4 cursor-pointer select-none list-none flex justify-between items-center outline-none bg-surface-2/50 border-b border-border-1 shrink-0">
            <span>Moves Played</span>
            <ChevronDown size={18} className="group-open:rotate-180 transition-transform" />
          </summary>
          <div className="overflow-y-auto p-2 h-full flex-1">
            <div className="grid grid-cols-[40px_1fr_1fr] text-sm text-left">
              {movePairs.map((pair, idx) => {
                const whiteIndex = idx * 2;
                const blackIndex = idx * 2 + 1;
                
                return (
                  <React.Fragment key={pair.moveNumber}>
                    <div className="py-2.5 text-content-3 font-bold text-right pr-3 bg-slate-800/30 border-r border-border-1/50 my-0.5 rounded-l">{pair.moveNumber}.</div>
                    
                    <div 
                      onClick={() => pair.white && setCurrentMoveIndex(whiteIndex)}
                      className={`py-2 px-3 cursor-pointer font-bold flex justify-start items-center gap-2 my-0.5 transition-colors ${currentMoveIndex === whiteIndex ? 'bg-accent text-content-1 shadow-md z-10' : 'text-content-2 hover:bg-surface-3'}`}
                    >
                      <span>{pair.white?.san}</span>
                      {settings.showHistoryClassifications && pair.white?.classification && <MoveClassificationBadge classification={pair.white.classification} />}
                    </div>
                    
                    <div 
                      onClick={() => pair.black && setCurrentMoveIndex(blackIndex)}
                      className={`py-2 px-3 cursor-pointer font-bold flex justify-start items-center gap-2 my-0.5 rounded-r transition-colors ${!pair.black ? '' : currentMoveIndex === blackIndex ? 'bg-accent text-content-1 shadow-md z-10' : 'text-content-2 hover:bg-surface-3'}`}
                    >
                      <span>{pair.black?.san}</span>
                      {settings.showHistoryClassifications && pair.black?.classification && <MoveClassificationBadge classification={pair.black.classification} />}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </details>

      </div>
    </div>
  );
};
