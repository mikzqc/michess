import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { useGameReview } from '../hooks/useGameReview';
import { EvaluationBar } from './EvaluationBar';
import { Bot, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Info, AlertTriangle, User, Copy } from 'lucide-react';
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
              <div className="font-bold text-gray-300 flex items-center gap-2">
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
          
          <div className="relative aspect-square rounded-lg shadow-2xl pointer-events-none">
            <Chessboard 
              options={{
                position: currentFen,
                showNotation: settings.showCoordinates,
                boardOrientation: boardOrientation,
                darkSquareStyle: { backgroundColor: activeTheme.dark },
                lightSquareStyle: { backgroundColor: activeTheme.light },
                animationDurationInMs: settings.moveAnimations ? 200 : 0,
                pieces: getCustomPieces(settings.pieceSet),
              }}
            />
            {settings.showBoardAnnotation && renderBoardAnnotation()}
          </div>
          
          <div className="flex justify-between items-center mt-2 px-1">
            <div className="flex flex-col gap-1">
              <div className="font-bold text-gray-300 flex items-center gap-2">
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
            <div className="flex justify-center items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700">
              <button onClick={goToFirst} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 text-slate-300 hover:text-white" title="Go to First Move (Home)" aria-label="Go to First Move"><ChevronsLeft /></button>
              <button onClick={goToPrev} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 text-slate-300 hover:text-white" title="Previous Move (Left Arrow)" aria-label="Previous Move"><ChevronLeft /></button>
              <button onClick={goToNext} disabled={currentMoveIndex >= analyzedMoves.length - 1} className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 text-slate-300 hover:text-white" title="Next Move (Right Arrow)" aria-label="Next Move"><ChevronRight /></button>
              <button onClick={goToLast} disabled={currentMoveIndex >= analyzedMoves.length - 1} className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 text-slate-300 hover:text-white" title="Go to Last Move (End)" aria-label="Go to Last Move"><ChevronsRight /></button>
            </div>
            
            <div className="flex justify-between items-center gap-2">
              <button 
                onClick={() => {
                  const newOrientation = boardOrientation === 'white' ? 'black' : 'white';
                  setBoardOrientation(newOrientation);
                  updateSettings({ boardOrientation: newOrientation });
                }} 
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 hover:bg-slate-700 font-bold text-sm text-gray-300 transition-colors"
                title="Flip Board"
                aria-label="Flip Board"
              >
                <RotateCcw size={16} /> Flip Board
              </button>
              <button onClick={async () => {
                await copyToClipboard(pgn);
                addToast("PGN copied to clipboard!", "success");
              }} className="flex-1 flex items-center justify-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 hover:bg-slate-700 font-bold text-sm text-gray-300 transition-colors" title="Copy PGN" aria-label="Copy PGN">
                <Copy size={16} /> Copy PGN
              </button>
            </div>
          </div>
          
          {/* Legend */}
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg text-xs flex flex-col gap-2 mt-2 mb-8">
            <h4 className="font-bold text-slate-400 mb-1">Classification Legend</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2">
              {Object.values(CLASSIFICATIONS).filter(c => c.id !== 'unclassified').map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  <MoveClassificationBadge classification={c.id as MoveClassificationType} />
                  <span className="text-gray-300">{c.name}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-500 mt-2 italic text-[10px]">
              * Michess classifications are engine-based estimates and are not official Chess.com or Lichess labels.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Review Queue, Move List & Details */}
      <div className="flex flex-col gap-4 h-full lg:h-[800px]">
        {/* Header / Queue Status */}
        <div className="bg-chess-panel border border-chess-border p-4 rounded-lg flex flex-col justify-between shrink-0">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-bold text-lg text-white flex items-center gap-2"><Info size={18} className="text-chess-accent" /> Game Review</h2>
            <button onClick={onExit} className="text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded transition-colors" title="Press Esc to exit">Exit (Esc)</button>
          </div>
          
          {isAnalyzing ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-yellow-400 font-bold">
                <span>Analyzing game...</span>
                <span>{progress} / {totalPositions}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded overflow-hidden">
                <div className="bg-yellow-400 h-full transition-all duration-300" style={{ width: `${(progress / totalPositions) * 100}%` }}></div>
              </div>
              <button onClick={cancelAnalysis} className="text-xs text-slate-400 hover:text-white mt-1 self-start font-bold">Cancel Analysis</button>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-900/20 p-2 rounded">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : (
            <div className="text-sm text-emerald-400 font-bold flex items-center gap-2 bg-emerald-900/20 p-2 rounded">
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
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg flex flex-col gap-3 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-chess-accent/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start border-b border-slate-700 pb-2 relative z-10">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Info size={16} className="text-chess-accent" /> Move Details
              </h3>
              {analyzedMoves[currentMoveIndex].classification && (
                <div className="flex items-center gap-2 text-sm font-bold text-white bg-slate-700 px-2 py-1 rounded shadow-md">
                  <MoveClassificationBadge classification={analyzedMoves[currentMoveIndex].classification} />
                  <span>{CLASSIFICATIONS[analyzedMoves[currentMoveIndex].classification].name}</span>
                </div>
              )}
            </div>

            {analyzedMoves[currentMoveIndex].classification && analyzedMoves[currentMoveIndex].classification !== 'unclassified' && (
              <div className="text-sm text-gray-300 italic mb-1 relative z-10">
                {getClassificationExplanation(analyzedMoves[currentMoveIndex].classification)}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-y-2 text-sm relative z-10">
              <div className="text-slate-400">Move:</div>
              <div className="font-bold text-white text-base">{analyzedMoves[currentMoveIndex].moveNumber}. {analyzedMoves[currentMoveIndex].color === 'b' && '...'} {analyzedMoves[currentMoveIndex].san}</div>
              
              <div className="text-slate-400">Evaluation:</div>
              <div className="font-bold text-white">
                {analyzedMoves[currentMoveIndex].evalAfter.score?.type === 'mate' 
                  ? `M${Math.abs(analyzedMoves[currentMoveIndex].evalAfter.score!.value)}` 
                  : `${((analyzedMoves[currentMoveIndex].evalAfter.score?.value || 0) / 100).toFixed(2)}`}
              </div>

              <div className="text-slate-400">Eval Loss:</div>
              <div className={`font-bold ${analyzedMoves[currentMoveIndex].evalLoss > 50 ? 'text-red-400' : 'text-gray-300'}`}>
                {(analyzedMoves[currentMoveIndex].evalLoss / 100).toFixed(2)}
              </div>
              
              {analyzedMoves[currentMoveIndex].accuracy !== undefined && (
                <>
                  <div className="text-slate-400">Accuracy:</div>
                  <div className="font-bold text-white">
                    {analyzedMoves[currentMoveIndex].accuracy?.toFixed(1)}%
                  </div>
                </>
              )}
              
              {analyzedMoves[currentMoveIndex].bestMove && (
                <>
                  <div className="text-slate-400">Engine Best:</div>
                  <div className="font-mono text-emerald-400 text-xs flex items-center bg-emerald-900/20 px-2 py-0.5 rounded">{analyzedMoves[currentMoveIndex].bestMove}</div>
                </>
              )}
            </div>
            
            {analyzedMoves[currentMoveIndex].pv && (
              <div className="mt-2 text-xs relative z-10">
                <div className="text-slate-400 mb-1">Engine Line (Depth {analyzedMoves[currentMoveIndex].depth}):</div>
                <div className="font-mono text-gray-300 break-words leading-relaxed opacity-70 bg-slate-900/50 p-2 rounded">
                  {analyzedMoves[currentMoveIndex].pv}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Move List */}
        <details className="bg-chess-panel border border-chess-border rounded-lg group flex-1 overflow-hidden flex flex-col" open>
          <summary className="font-bold text-white p-4 cursor-pointer select-none list-none flex justify-between items-center outline-none bg-slate-800/50 border-b border-chess-border shrink-0">
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
                    <div className="py-2.5 text-slate-500 font-bold text-right pr-3 bg-slate-800/30 border-r border-slate-700/50 my-0.5 rounded-l">{pair.moveNumber}.</div>
                    
                    <div 
                      onClick={() => pair.white && setCurrentMoveIndex(whiteIndex)}
                      className={`py-2 px-3 cursor-pointer font-bold flex justify-start items-center gap-2 my-0.5 transition-colors ${currentMoveIndex === whiteIndex ? 'bg-chess-accent text-white shadow-md z-10' : 'text-gray-300 hover:bg-slate-700'}`}
                    >
                      <span>{pair.white?.san}</span>
                      {settings.showHistoryClassifications && pair.white?.classification && <MoveClassificationBadge classification={pair.white.classification} />}
                    </div>
                    
                    <div 
                      onClick={() => pair.black && setCurrentMoveIndex(blackIndex)}
                      className={`py-2 px-3 cursor-pointer font-bold flex justify-start items-center gap-2 my-0.5 rounded-r transition-colors ${!pair.black ? '' : currentMoveIndex === blackIndex ? 'bg-chess-accent text-white shadow-md z-10' : 'text-gray-300 hover:bg-slate-700'}`}
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
