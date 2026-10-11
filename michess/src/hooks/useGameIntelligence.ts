import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess, type Move } from 'chess.js';
import { useHistory } from './useHistory';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { supabase } from '../services/supabase';
import { stockfishEngine } from '../services/stockfish';
import { reviewCache } from '../services/reviewCache';
import { classifyMove } from '../utils/classification';
import { calculateAccuracy } from '../utils/accuracy';
import { getOpeningsDB, findOpening } from '../utils/openings';
import type { AnalyzedMove, EngineEvaluation } from '../types/review';
import type { HistoryGame } from '../types/history';
import type { GameIntelligenceAnalysis, IntelligenceSummary } from '../types/intelligence';
import { analyzeGameMovesForIntelligence, computeIntelligenceSummary } from '../utils/intelligence';

const ANALYSES_STORAGE_KEY = 'michess_game_analyses_v1';

export interface BatchProgress {
  currentGameIndex: number;
  totalGames: number;
  currentMoveIndex: number;
  totalMoves: number;
  gameTitle: string;
}

export function useGameIntelligence() {
  const { history, updateGameReviewStats } = useHistory();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [analyses, setAnalyses] = useState<GameIntelligenceAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorFilter, setColorFilter] = useState<'all' | 'white' | 'black'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'computer' | 'local' | 'import' | 'chesscom' | 'lichess'>('all');

  // Batch analysis state
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const cancelBatchRef = useRef(false);

  // 1. Load cached analyses from localStorage initially
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ANALYSES_STORAGE_KEY);
      if (stored) {
        setAnalyses(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse cached analyses from localStorage', e);
    }
  }, []);

  // 2. Fetch cloud analyses if user is logged in
  useEffect(() => {
    const client = supabase;
    if (!user || !client) {
      setLoading(false);
      return;
    }

    const fetchCloudAnalyses = async () => {
      try {
        const { data, error } = await client
          .from('game_analyses')
          .select('game_id, analysis_data')
          .eq('user_id', user.id);

        if (!error && data && data.length > 0) {
          const cloudAnalyses: GameIntelligenceAnalysis[] = data.map(d => d.analysis_data);
          setAnalyses(prev => {
            const merged = [...prev];
            cloudAnalyses.forEach(ca => {
              const idx = merged.findIndex(m => m.gameId === ca.gameId);
              if (idx >= 0) {
                merged[idx] = ca;
              } else {
                merged.push(ca);
              }
            });
            localStorage.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Failed to fetch cloud game analyses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCloudAnalyses();
  }, [user]);

  // Save analysis to local and cloud
  const saveAnalysis = useCallback(async (analysis: GameIntelligenceAnalysis) => {
    setAnalyses(prev => {
      const next = prev.filter(a => a.gameId !== analysis.gameId);
      next.unshift(analysis);
      localStorage.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    const client = supabase;
    if (user && client) {
      try {
        await client.from('game_analyses').upsert({
          user_id: user.id,
          game_id: analysis.gameId,
          analysis_data: analysis,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,game_id' });
      } catch (e) {
        console.warn('Failed to upsert game analysis to Supabase:', e);
      }
    }
  }, [user]);

  // Determine user's color in a game
  const detectUserColor = useCallback((game: HistoryGame): 'w' | 'b' => {
    let chesscomUser = profile?.chesscom_username?.trim().toLowerCase();
    let lichessUser = profile?.lichess_username?.trim().toLowerCase();
    if (!chesscomUser || !lichessUser) {
      try {
        const stored = localStorage.getItem('michess_linked_accounts_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!chesscomUser) chesscomUser = parsed.chesscomUsername?.trim().toLowerCase();
          if (!lichessUser) lichessUser = parsed.lichessUsername?.trim().toLowerCase();
        }
      } catch {}
    }

    const whiteLower = game.white?.trim().toLowerCase();
    const blackLower = game.black?.trim().toLowerCase();

    // Check external platform usernames first
    if (game.source === 'chesscom' && chesscomUser) {
      if (whiteLower === chesscomUser) return 'w';
      if (blackLower === chesscomUser) return 'b';
    }
    if (game.source === 'lichess' && lichessUser) {
      if (whiteLower === lichessUser) return 'w';
      if (blackLower === lichessUser) return 'b';
    }

    const currentUsername = profile?.username?.trim().toLowerCase();
    if (currentUsername) {
      if (whiteLower === currentUsername) return 'w';
      if (blackLower === currentUsername) return 'b';
    }

    // Check computer source
    if (game.source === 'computer') {
      const isBot = (name: string) => /computer|stockfish|bot|ai/i.test(name);
      if (isBot(blackLower) && !isBot(whiteLower)) return 'w';
      if (isBot(whiteLower) && !isBot(blackLower)) return 'b';
    }

    // Default to White
    return 'w';
  }, [profile?.username, profile?.chesscom_username, profile?.lichess_username]);

  // Determine game result from user's perspective
  const detectUserResult = useCallback((game: HistoryGame, userColor: 'w' | 'b'): 'win' | 'loss' | 'draw' | '*' => {
    const res = game.result?.trim();
    if (res === '1/2-1/2') return 'draw';
    if (res === '1-0') return userColor === 'w' ? 'win' : 'loss';
    if (res === '0-1') return userColor === 'b' ? 'win' : 'loss';
    return '*';
  }, []);

  // Helper to calculate loss
  const calculateLoss = (evalBefore: EngineEvaluation, evalAfter: EngineEvaluation, color: 'w' | 'b'): number => {
    if (evalAfter.score?.type === 'mate') {
      const playerMate = color === 'w' ? evalAfter.score.value : -evalAfter.score.value;
      if (playerMate > 0) return 0;
    }

    const getScore = (ev: EngineEvaluation) => {
      if (!ev.score) return 0;
      if (ev.score.type === 'mate') {
        return Math.sign(ev.score.value) * (10000 - Math.abs(ev.score.value) * 100);
      }
      return ev.score.value;
    };

    const s1 = getScore(evalBefore);
    const s2 = getScore(evalAfter);
    const playerBefore = color === 'w' ? s1 : -s1;
    const playerAfter = color === 'w' ? s2 : -s2;

    if (playerBefore >= 9000 && playerAfter >= 9000) return 0;
    return Math.max(0, playerBefore - playerAfter);
  };

  // Analyze a single game with Stockfish
  const analyzeGame = useCallback(async (
    game: HistoryGame,
    depth: number = 10,
    onMoveProgress?: (current: number, total: number) => void
  ): Promise<GameIntelligenceAnalysis | null> => {
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      const historyMoves = chess.history({ verbose: true }) as Move[];
      if (historyMoves.length === 0) return null;

      const userColor = detectUserColor(game);
      const userResult = detectUserResult(game, userColor);

      const positions: { fen: string; move?: Move }[] = [];
      const replayGame = new Chess();
      if (chess.header().FEN) {
        replayGame.load(chess.header().FEN as string);
      }
      positions.push({ fen: replayGame.fen() });

      for (let i = 0; i < historyMoves.length; i++) {
        replayGame.move(historyMoves[i]);
        positions.push({ fen: replayGame.fen(), move: historyMoves[i] });
      }

      const evaluations: EngineEvaluation[] = [];
      await stockfishEngine.newGame();

      for (let i = 0; i < positions.length; i++) {
        if (cancelBatchRef.current) return null;
        if (onMoveProgress) onMoveProgress(i + 1, positions.length);

        const { fen } = positions[i];
        let evaluation = reviewCache.get(fen, depth);

        if (!evaluation) {
          const tempChess = new Chess(fen);
          if (tempChess.isGameOver()) {
            let score: EngineEvaluation['score'];
            if (tempChess.isCheckmate()) {
              const sideToMove = fen.split(' ')[1];
              score = { type: 'mate', value: sideToMove === 'b' ? 1 : -1 };
            } else {
              score = { type: 'cp', value: 0 };
            }
            evaluation = { score, depth, pv: '', bestmove: '(none)' };
            reviewCache.set(fen, depth, evaluation);
          } else {
            try {
              let response = await stockfishEngine.analyzePosition(fen, { depth });
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
              evaluation = {};
            }
          }
        }

        evaluations.push(evaluation);
      }

      // Build AnalyzedMoves
      const analyzedMoves: AnalyzedMove[] = [];
      for (let i = 0; i < historyMoves.length; i++) {
        const move = historyMoves[i];
        const evalBefore = evaluations[i];
        const evalAfter = evaluations[i + 1];
        let loss = calculateLoss(evalBefore, evalAfter, move.color);
        if (move.san.includes('#')) loss = 0;

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

      // Detect opening
      let openingInfo: { name: string; eco: string } | undefined;
      const db = await getOpeningsDB();
      const sans = historyMoves.map(m => m.san);
      const match = findOpening(sans, db);
      if (match.opening) {
        openingInfo = { name: match.opening.name, eco: match.opening.eco };
      }

      const opponentName = userColor === 'w' ? (game.black || 'Opponent') : (game.white || 'Opponent');

      const intelligenceAnalysis = analyzeGameMovesForIntelligence(analyzedMoves, userColor, {
        gameId: game.id,
        pgn: game.pgn,
        date: game.date || new Date(game.timestamp).toISOString().split('T')[0],
        opponent: opponentName,
        result: userResult,
        source: game.source,
        opening: openingInfo
      });

      // Save analysis
      await saveAnalysis(intelligenceAnalysis);

      // Also update history game stats
      const counts: Record<string, number> = {};
      analyzedMoves.forEach(m => {
        if (m.classification) counts[m.classification] = (counts[m.classification] || 0) + 1;
      });

      const whiteMoves = analyzedMoves.filter(m => m.color === 'w');
      const blackMoves = analyzedMoves.filter(m => m.color === 'b');
      const whiteAcc = whiteMoves.length ? Math.round(whiteMoves.reduce((s, m) => s + (m.accuracy || 85), 0) / whiteMoves.length) : undefined;
      const blackAcc = blackMoves.length ? Math.round(blackMoves.reduce((s, m) => s + (m.accuracy || 85), 0) / blackMoves.length) : undefined;

      updateGameReviewStats(game.pgn, {
        whiteAccuracy: whiteAcc,
        blackAccuracy: blackAcc,
        overallAccuracy: intelligenceAnalysis.userAccuracy,
        classifications: counts
      });

      return intelligenceAnalysis;
    } catch (err) {
      console.error('Failed to analyze game:', err);
      return null;
    }
  }, [detectUserColor, detectUserResult, saveAnalysis, updateGameReviewStats]);

  // Batch analyze unanalyzed games
  const startBatchAnalysis = useCallback(async (limit: number = 5) => {
    if (isAnalyzingBatch) return;

    cancelBatchRef.current = false;
    setIsAnalyzingBatch(true);

    try {
      // Find games in history that don't have an intelligence analysis yet
      const existingIds = new Set(analyses.map(a => a.gameId));
      const unanalyzed = history.filter(g => !existingIds.has(g.id)).slice(0, limit);

      if (unanalyzed.length === 0) {
        setIsAnalyzingBatch(false);
        setBatchProgress(null);
        return;
      }

      for (let i = 0; i < unanalyzed.length; i++) {
        if (cancelBatchRef.current) break;

        const game = unanalyzed[i];
        const title = `${game.white || 'White'} vs ${game.black || 'Black'}`;

        setBatchProgress({
          currentGameIndex: i + 1,
          totalGames: unanalyzed.length,
          currentMoveIndex: 0,
          totalMoves: game.moveCount || 20,
          gameTitle: title
        });

        await analyzeGame(game, 10, (currMove, totalMoves) => {
          setBatchProgress({
            currentGameIndex: i + 1,
            totalGames: unanalyzed.length,
            currentMoveIndex: currMove,
            totalMoves,
            gameTitle: title
          });
        });
      }
    } finally {
      setIsAnalyzingBatch(false);
      setBatchProgress(null);
      stockfishEngine.stop();
    }
  }, [analyses, history, isAnalyzingBatch, analyzeGame]);

  const cancelBatchAnalysis = useCallback(() => {
    cancelBatchRef.current = true;
    stockfishEngine.stop();
    setIsAnalyzingBatch(false);
    setBatchProgress(null);
  }, []);

  // Filtered analyses based on color & source
  const filteredAnalyses = useMemo(() => {
    return analyses.filter(a => {
      if (colorFilter !== 'all' && a.userColor !== (colorFilter === 'white' ? 'w' : 'b')) {
        return false;
      }
      if (sourceFilter !== 'all' && a.source !== sourceFilter) {
        return false;
      }
      return true;
    });
  }, [analyses, colorFilter, sourceFilter]);

  // Aggregated Intelligence Summary
  const summary: IntelligenceSummary = useMemo(() => {
    return computeIntelligenceSummary(history.length, filteredAnalyses);
  }, [history.length, filteredAnalyses]);

  const unanalyzedCount = useMemo(() => {
    const existingIds = new Set(analyses.map(a => a.gameId));
    return history.filter(g => !existingIds.has(g.id)).length;
  }, [history, analyses]);

  return {
    history,
    analyses: filteredAnalyses,
    allAnalyses: analyses,
    summary,
    loading,
    colorFilter,
    setColorFilter,
    sourceFilter,
    setSourceFilter,
    isAnalyzingBatch,
    batchProgress,
    startBatchAnalysis,
    cancelBatchAnalysis,
    analyzeGame,
    unanalyzedCount,
    isInsufficientData: filteredAnalyses.length < 3,
    hasAnyGames: history.length > 0
  };
}
