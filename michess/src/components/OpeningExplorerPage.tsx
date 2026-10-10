import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { 
  BookOpen, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ArrowUpDown, 
  Search, 
  TrendingUp, 
  Sparkles,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { BOARD_THEMES, getCustomPieces } from '../utils/themes';
import { useBoardHighlights } from '../hooks/useBoardHighlights';
import { PREMIUM_ARROW_OPTIONS } from '../utils/arrows';
import { Button } from './ui/Button';
import { 
  getOpeningsDB, 
  formatMovesToPGN, 
  findOpening, 
  getContinuations, 
  getMainLine, 
  searchOpenings,
  type OpeningsDB,
  type ContinuationMove,
  type MainLineInfo,
  type Opening
} from '../utils/openings';
import { copyToClipboard } from '../utils/clipboard';

interface OpeningExplorerPageProps {
  onExit: () => void;
}

export const OpeningExplorerPage: React.FC<OpeningExplorerPageProps> = ({ onExit }) => {
  const { settings } = useSettings();
  const [db, setDb] = useState<OpeningsDB>({});
  const [loadingDb, setLoadingDb] = useState(true);

  // Game state
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPgn, setCopiedPgn] = useState(false);

  // Load openings database
  useEffect(() => {
    let isMounted = true;
    getOpeningsDB().then((data) => {
      if (isMounted) {
        setDb(data);
        setLoadingDb(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeTheme = BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.slate;

  // Board highlights
  const {
    squareStyles,
    handlePieceDrag,
    handlePieceDropEnd,
    handleSquareClick: highlightSquareClick
  } = useBoardHighlights({
    game: chess,
    history: chess.history({ verbose: true }) as any
  });

  // Synchronize state when playing a move
  const applyMove = useCallback((moveSanOrObj: string | { from: string; to: string; promotion?: string }) => {
    try {
      const res = chess.move(moveSanOrObj);
      if (res) {
        setFen(chess.fen());
        setMoveHistory(chess.history());
        return true;
      }
    } catch {
      // Illegal move
    }
    return false;
  }, [chess]);

  // Jump to specific move index in history (0 = start)
  const jumpToMoveIndex = useCallback((index: number) => {
    chess.reset();
    for (let i = 0; i < index; i++) {
      chess.move(moveHistory[i]);
    }
    setFen(chess.fen());
    setMoveHistory(chess.history());
  }, [chess, moveHistory]);

  const handleReset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setMoveHistory([]);
  }, [chess]);

  const handleStepBack = useCallback(() => {
    if (moveHistory.length === 0) return;
    chess.undo();
    setFen(chess.fen());
    setMoveHistory(chess.history());
  }, [chess, moveHistory]);

  const handleStepForward = useCallback((nextSan: string) => {
    applyMove(nextSan);
  }, [applyMove]);

  // Handle piece drop on board
  const onDrop = (args: any) => {
    handlePieceDropEnd();
    if (!args.targetSquare || args.sourceSquare === args.targetSquare) return false;

    const legalMoves = chess.moves({ square: args.sourceSquare as any, verbose: true });
    const isPromotion = legalMoves.some(m => m.to === args.targetSquare && m.promotion);

    return applyMove({
      from: args.sourceSquare,
      to: args.targetSquare,
      promotion: isPromotion ? 'q' : undefined
    });
  };

  // Handle square clicks
  const onSquareClick = (square: string | null) => {
    if (!square) return;
    const move = highlightSquareClick(square);
    if (move) {
      const legalMoves = chess.moves({ square: move.from as any, verbose: true });
      const isPromotion = legalMoves.some(m => m.to === move.to && m.promotion);
      applyMove({
        from: move.from,
        to: move.to,
        promotion: isPromotion ? 'q' : undefined
      });
    }
  };

  // Current opening & ECO code
  const currentOpening = useMemo<{ opening: Opening | null; matchLength: number }>(() => {
    if (Object.keys(db).length === 0) return { opening: null, matchLength: 0 };
    return findOpening(moveHistory, db);
  }, [moveHistory, db]);

  // Continuations
  const continuations = useMemo<ContinuationMove[]>(() => {
    if (Object.keys(db).length === 0) return [];
    return getContinuations(moveHistory, db);
  }, [moveHistory, db]);

  // Main line
  const mainLine = useMemo<MainLineInfo | null>(() => {
    if (Object.keys(db).length === 0) return null;
    return getMainLine(moveHistory, db);
  }, [moveHistory, db]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || Object.keys(db).length === 0) return [];
    return searchOpenings(searchQuery, db, 15);
  }, [searchQuery, db]);

  // Load a searched opening directly onto the board
  const loadOpeningLine = (moves: string[]) => {
    chess.reset();
    for (const m of moves) {
      try {
        chess.move(m);
      } catch {
        break;
      }
    }
    setFen(chess.fen());
    setMoveHistory(chess.history());
    setSearchQuery('');
  };

  const handleCopyPgn = () => {
    const pgn = formatMovesToPGN(moveHistory);
    copyToClipboard(pgn || '1. ');
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  const currentPgn = formatMovesToPGN(moveHistory);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col gap-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-content-1 flex items-center gap-2">
              Opening Explorer
            </h1>
            <p className="text-sm text-content-3">
              Explore {Object.keys(db).length > 0 ? `${Object.keys(db).length.toLocaleString()}+` : '12,600+'} master opening variations, continuations, and theory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="text-content-2 hover:text-content-1"
          >
            Back to Home
          </Button>
        </div>
      </div>

      {/* Main Grid: Board + Explorer Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Top: Interactive Chessboard */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative w-full max-w-[580px] aspect-square mx-auto rounded-xl overflow-hidden shadow-md border border-border-1 bg-surface-2">
            <Chessboard
              options={{
                id: "OpeningExplorerBoard",
                position: fen,
                showNotation: settings.showCoordinates,
                animationDurationInMs: settings.moveAnimations ? 200 : 0,
                pieces: getCustomPieces(settings.pieceSet),
                onPieceDrop: onDrop,
                onPieceDrag: handlePieceDrag,
                onPieceDragCancel: handlePieceDropEnd,
                onSquareClick: (args: any) => onSquareClick(args.square),
                arrowOptions: PREMIUM_ARROW_OPTIONS as any,
                boardOrientation: boardOrientation,
                squareStyles: squareStyles,
                darkSquareStyle: { backgroundColor: activeTheme.dark },
                lightSquareStyle: { backgroundColor: activeTheme.light },
                darkSquareNotationStyle: { color: activeTheme.light },
                lightSquareNotationStyle: { color: activeTheme.dark }
              }}
            />
          </div>

          {/* Board Navigation Controls */}
          <div className="max-w-[580px] w-full mx-auto flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-2 rounded-xl border border-border-1">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={moveHistory.length === 0}
                title="Reset to start position"
                className="text-content-2 hover:text-content-1 disabled:opacity-40"
              >
                <ChevronsLeft size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStepBack}
                disabled={moveHistory.length === 0}
                title="Previous move"
                className="text-content-2 hover:text-content-1 disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </Button>
              {mainLine && mainLine.moves.length > moveHistory.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStepForward(mainLine.moves[moveHistory.length])}
                  title="Next main line move"
                  className="text-content-2 hover:text-content-1"
                >
                  <ChevronRight size={18} />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')}
                className="flex items-center gap-1.5 text-xs font-semibold"
                title="Flip board orientation"
              >
                <ArrowUpDown size={14} />
                Flip: {boardOrientation === 'white' ? 'White' : 'Black'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={moveHistory.length === 0}
                className="flex items-center gap-1.5 text-xs"
              >
                <RotateCcw size={14} />
                Reset
              </Button>
              {moveHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPgn}
                  className="flex items-center gap-1 text-xs text-content-3 hover:text-content-1"
                  title="Copy PGN line"
                >
                  {copiedPgn ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedPgn ? 'Copied' : 'PGN'}
                </Button>
              )}
            </div>
          </div>

          {/* Move Sequence Breadcrumbs */}
          <div className="max-w-[580px] w-full mx-auto p-3 bg-surface-1 rounded-xl border border-border-1 flex flex-wrap items-center gap-1.5 text-sm min-h-[48px]">
            <button
              onClick={handleReset}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                moveHistory.length === 0 ? 'bg-accent text-white' : 'text-content-3 hover:bg-surface-2 hover:text-content-1'
              }`}
            >
              Start
            </button>
            {moveHistory.map((move, idx) => {
              const isWhite = idx % 2 === 0;
              const moveNum = Math.floor(idx / 2) + 1;
              const isCurrent = idx === moveHistory.length - 1;
              return (
                <React.Fragment key={idx}>
                  {isWhite && (
                    <span className="text-xs font-mono text-content-3 ml-1">
                      {moveNum}.
                    </span>
                  )}
                  <button
                    onClick={() => jumpToMoveIndex(idx + 1)}
                    className={`px-2 py-0.5 rounded font-mono text-xs font-semibold transition-colors ${
                      isCurrent 
                        ? 'bg-accent text-white shadow-sm' 
                        : 'text-content-2 hover:bg-surface-2 hover:text-content-1'
                    }`}
                  >
                    {move}
                  </button>
                </React.Fragment>
              );
            })}
            {moveHistory.length === 0 && (
              <span className="text-xs text-content-3 italic ml-1">
                Make a move on the board or click a continuation below to begin.
              </span>
            )}
          </div>
        </div>

        {/* Right / Bottom: Explorer Details Panel */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Current Opening Info Card */}
          <div className="p-5 bg-surface-2 rounded-xl border border-border-1 shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-accent/15 text-accent text-xs font-mono font-bold rounded border border-accent/20">
                    {currentOpening.opening?.eco || 'A00'}
                  </span>
                  <span className="text-xs text-content-3 uppercase tracking-wider font-semibold">
                    {currentOpening.opening ? 'Identified Opening' : 'Starting Position'}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-content-1 truncate" title={currentOpening.opening?.name || 'Initial Position'}>
                  {currentOpening.opening?.name || 'Starting Position'}
                </h2>
              </div>
            </div>

            {currentPgn && (
              <div className="text-xs font-mono text-content-3 bg-surface-1/70 px-3 py-2 rounded-lg border border-border-1 break-all">
                {currentPgn}
              </div>
            )}

            {/* Main Line recommendation if present */}
            {mainLine && mainLine.moves.length > moveHistory.length && (
              <div className="pt-2 border-t border-border-1/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs text-accent font-semibold">
                  <Sparkles size={14} />
                  <span>Main Line Continuation</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {mainLine.moves.slice(moveHistory.length, moveHistory.length + 8).map((m, i) => (
                    <button
                      key={i}
                      onClick={() => applyMove(m)}
                      className="px-2 py-0.5 bg-surface-3 hover:bg-accent/20 text-content-2 hover:text-accent font-mono rounded border border-border-1 transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                  {mainLine.moves.length > moveHistory.length + 8 && (
                    <span className="text-content-3 text-xs">...</span>
                  )}
                </div>
                <div className="text-[11px] text-content-3 truncate">
                  Leads to: {mainLine.name}
                </div>
              </div>
            )}
          </div>

          {/* Search Openings Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3 pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Search openings (e.g. Sicilian, French, E60)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border-1 rounded-xl text-sm text-content-1 placeholder:text-content-3 focus:outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-3 hover:text-content-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Dropdown / Results View */}
          {searchQuery.trim().length > 0 ? (
            <div className="bg-surface-2 rounded-xl border border-border-1 overflow-hidden shadow-sm flex flex-col max-h-[420px]">
              <div className="p-3 border-b border-border-1 bg-surface-3/50 text-xs font-semibold text-content-2">
                Search Results ({searchResults.length})
              </div>
              <div className="overflow-y-auto divide-y divide-border-1/50">
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => loadOpeningLine(item.moves)}
                    className="p-3 hover:bg-surface-3/70 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-1.5 py-0.5 bg-accent/15 text-accent text-[11px] font-mono font-bold rounded">
                          {item.opening.eco}
                        </span>
                        <div className="text-sm font-semibold text-content-1 truncate">
                          {item.opening.name}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-content-3 truncate">
                        {item.pgn}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-content-3 shrink-0" />
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <div className="p-8 text-center text-sm text-content-3 italic">
                    No openings found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Continuations Table */
            <div className="bg-surface-2 rounded-xl border border-border-1 overflow-hidden shadow-sm flex flex-col">
              <div className="p-3.5 border-b border-border-1 flex items-center justify-between bg-surface-3/30">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-accent" />
                  <span className="text-sm font-bold text-content-1">
                    Continuations ({continuations.length})
                  </span>
                </div>
                <span className="text-xs text-content-3">
                  Theoretical variations
                </span>
              </div>

              {loadingDb ? (
                <div className="p-10 flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-content-3">Loading master opening database...</span>
                </div>
              ) : continuations.length > 0 ? (
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-3/50 sticky top-0 z-10 border-b border-border-1">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold text-content-2">Move</th>
                        <th className="py-2.5 px-3 font-semibold text-content-2">Variation Name</th>
                        <th className="py-2.5 px-3 font-semibold text-content-2 text-right">Variations</th>
                        <th className="py-2.5 px-3 font-semibold text-content-2 w-28 text-right">Frequency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-1/50">
                      {continuations.map((c) => (
                        <tr
                          key={c.san}
                          onClick={() => applyMove(c.san)}
                          className="hover:bg-accent/10 cursor-pointer transition-colors group"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-content-1 group-hover:text-accent">
                            {c.san}
                          </td>
                          <td className="py-2.5 px-3 text-content-2 max-w-[200px] truncate" title={c.openingName || c.sampleVariation}>
                            {c.openingName ? (
                              <span className="font-medium text-content-1">
                                {c.eco && <span className="text-accent text-[11px] font-mono mr-1">[{c.eco}]</span>}
                                {c.openingName}
                              </span>
                            ) : c.sampleVariation ? (
                              <span className="text-content-3 italic">
                                Leads to: {c.sampleVariation}
                              </span>
                            ) : (
                              <span className="text-content-3 italic">Sub-variation</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-content-3 font-mono">
                            {c.count}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-content-2 font-mono text-[11px]">
                                {c.frequencyPct}%
                              </span>
                              <div className="w-12 h-1.5 bg-surface-3 rounded-full overflow-hidden shrink-0">
                                <div
                                  className="h-full bg-accent rounded-full"
                                  style={{ width: `${c.frequencyPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-content-3">
                  <Info size={24} className="text-content-3/60" />
                  <p className="text-sm font-medium">No standard continuations found.</p>
                  <p className="text-xs max-w-xs">
                    You have moved beyond the scope of the master opening book.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="mt-2 text-xs"
                  >
                    Return to Start
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
