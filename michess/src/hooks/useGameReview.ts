import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Move } from 'chess.js';
import { stockfishEngine } from '../services/stockfish';
import { reviewCache } from '../services/reviewCache';
import { classifyMove } from '../utils/classification';
import { calculateAccuracy } from '../utils/accuracy';
import type { AnalyzedMove, EngineEvaluation } from '../types/review';

interface UseGameReviewProps {
  pgn: string;
  depth?: number;
}

interface ReviewState {
  isAnalyzing: boolean;
  progress: number;
  totalPositions: number;
  analyzedMoves: AnalyzedMove[];
  error: string | null;
}

export function useGameReview({ pgn, depth = 12 }: UseGameReviewProps) {
  const [state, setState] = useState<ReviewState>({
    isAnalyzing: false,
    progress: 0,
    totalPositions: 0,
    analyzedMoves: [],
    error: null
  });
  
  const [gameMeta, setGameMeta] = useState<{ white: string, black: string, result: string, date: string }>({
    white: 'Unknown',
    black: 'Unknown',
    result: '*',
    date: ''
  });

  const cancelRef = useRef(false);

  const calculateLoss = (evalBefore: EngineEvaluation, evalAfter: EngineEvaluation, color: 'w' | 'b'): number => {
    // If player has forced checkmate after the move, loss is strictly 0!
    if (evalAfter.score?.type === 'mate') {
      const playerMate = color === 'w' ? evalAfter.score.value : -evalAfter.score.value;
      if (playerMate > 0) return 0;
    }

    // Normalizing mate scores for loss calculation
    const getScore = (ev: EngineEvaluation) => {
      if (!ev.score) return 0;
      if (ev.score.type === 'mate') {
        // Mate in 3 for white = +9700, mate in -3 (black) = -9700
        return Math.sign(ev.score.value) * (10000 - Math.abs(ev.score.value) * 100);
      }
      return ev.score.value; // centipawns
    };

    // Both scores are in White's perspective
    const s1 = getScore(evalBefore);
    const s2 = getScore(evalAfter);

    const playerBefore = color === 'w' ? s1 : -s1;
    const playerAfter = color === 'w' ? s2 : -s2;
    
    // If player maintains forced checkmate, loss is 0
    if (playerBefore >= 9000 && playerAfter >= 9000) {
      return 0;
    }

    // Loss is how much advantage was lost. 
    // If player improved their position, loss is clamped to 0.
    return Math.max(0, playerBefore - playerAfter);
  };

  const startAnalysis = useCallback(async () => {
    cancelRef.current = false;
    setState(prev => ({ ...prev, isAnalyzing: true, error: null, progress: 0, analyzedMoves: [] }));

    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      
      setGameMeta({
        white: chess.header().White || 'White',
        black: chess.header().Black || 'Black',
        result: chess.header().Result || '*',
        date: chess.header().Date || ''
      });

      const history = chess.history({ verbose: true }) as Move[];
      const totalPositions = history.length + 1; // Start pos + after each move
      
      setState(prev => ({ ...prev, totalPositions }));

      // Reconstruct FENs
      const positions: { fen: string, move?: Move, moveNumber: number }[] = [];
      
      const replayGame = new Chess();
      if (chess.header().FEN) {
        replayGame.load(chess.header().FEN as string);
      }
      
      positions.push({ fen: replayGame.fen(), moveNumber: 0 }); // Initial pos
      
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const currentFen = replayGame.fen();
        const moveNumber = parseInt(currentFen.split(' ')[5] || '1', 10);
        replayGame.move(move);
        positions.push({ 
          fen: replayGame.fen(), 
          move: move, 
          moveNumber: moveNumber
        });
      }

      const evaluations: EngineEvaluation[] = [];

      await stockfishEngine.newGame();

      for (let i = 0; i < positions.length; i++) {
        if (cancelRef.current) break;
        
        const { fen } = positions[i];
        
        let evaluation = reviewCache.get(fen, depth);
        
        if (!evaluation) {
          const tempChess = new Chess(fen);
          
          if (tempChess.isGameOver()) {
            let score: EngineEvaluation['score'];
            if (tempChess.isCheckmate()) {
              const sideToMove = fen.split(' ')[1];
              // From White's perspective: if Black is mated, White wins (+1 mate); if White is mated, (-1 mate)
              score = { type: 'mate', value: sideToMove === 'b' ? 1 : -1 };
            } else {
              score = { type: 'cp', value: 0 };
            }
            evaluation = {
              score,
              depth,
              pv: '',
              bestmove: '(none)'
            };
            reviewCache.set(fen, depth, evaluation);
          } else {
            try {
              let response = await stockfishEngine.analyzePosition(fen, { depth });
              
              // Validate that bestmove is legal in fen
              const legalMoves = tempChess.moves({ verbose: true });
              const isLegal = response.bestmove === '(none)' || legalMoves.some(m => {
                const uci = `${m.from}${m.to}${m.promotion || ''}`;
                return uci === response.bestmove || response.bestmove.startsWith(m.from + m.to);
              });

              if (!isLegal) {
                console.warn(`[Review] Stale bestmove "${response.bestmove}" for turn ${tempChess.turn()} in ${fen}. Resyncing engine and retrying...`);
                await stockfishEngine.newGame();
                response = await stockfishEngine.analyzePosition(fen, { depth });
              }

              // UCI outputs score from the perspective of the side to move.
              // Normalize it to ALWAYS be from White's perspective.
              let normalizedScore = response.info?.score;
              if (normalizedScore && fen.split(' ')[1] === 'b') {
                normalizedScore = {
                  type: normalizedScore.type,
                  value: -normalizedScore.value
                };
              }

              evaluation = {
                score: normalizedScore,
                depth: response.info?.depth ?? depth,
                pv: response.info?.pv,
                bestmove: response.bestmove
              };
              reviewCache.set(fen, depth, evaluation);
            } catch (err) {
              console.error("Stockfish analysis failed for FEN:", fen, err);
              evaluation = {}; // empty fallback
            }
          }
        }
        
        evaluations.push(evaluation);
        setState(prev => ({ ...prev, progress: i + 1 }));
      }

      if (cancelRef.current) {
        setState(prev => ({ ...prev, isAnalyzing: false }));
        return;
      }

      // Build AnalyzedMoves
      const analyzedMoves: AnalyzedMove[] = [];
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const evalBefore = evaluations[i];
        const evalAfter = evaluations[i + 1];
        
        let loss = calculateLoss(evalBefore, evalAfter, move.color);
        if (move.san.includes('#')) {
          loss = 0; // Checkmating the opponent is the ultimate best move, loss is 0
        }

        const analyzedMove: AnalyzedMove = {
          moveNumber: parseInt(positions[i].fen.split(' ')[5] || '1', 10),
          color: move.color,
          san: move.san,
          uci: `${move.from}${move.to}${move.promotion || ''}`,
          fenBefore: positions[i].fen,
          fenAfter: positions[i + 1].fen,
          evalBefore,
          evalAfter,
          evalLoss: loss,
          bestMove: evalBefore.bestmove,
          pv: evalBefore.pv,
          depth: evalBefore.depth
        };

        analyzedMove.classification = classifyMove(analyzedMove);
        analyzedMove.accuracy = calculateAccuracy(evalBefore, evalAfter, move.color, move.san.includes('#'), analyzedMove.classification === 'book');
        analyzedMoves.push(analyzedMove);
      }

      setState(prev => ({ ...prev, isAnalyzing: false, analyzedMoves }));

    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, isAnalyzing: false, error: 'Failed to parse game or analyze.' }));
    } finally {
      stockfishEngine.stop();
    }
  }, [pgn, depth]);

  const cancelAnalysis = useCallback(() => {
    cancelRef.current = true;
    stockfishEngine.stop();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      stockfishEngine.stop();
    };
  }, []);

  return {
    ...state,
    gameMeta,
    startAnalysis,
    cancelAnalysis
  };
}
