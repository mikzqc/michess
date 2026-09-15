import { useState, useEffect, useCallback } from 'react';
import type { HistoryGame } from '../types/history';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

const HISTORY_KEY = 'michess_history';

// Fast string hash for generating unique IDs from PGNs if no ID exists
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'game_' + Math.abs(hash).toString(36);
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasMigratedPrompt, setHasMigratedPrompt] = useState(false);

  // 1. Load Local Storage initially
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Failed to load local history', err);
    }
  }, []);

  // 2. Sync Logic when User logs in
  useEffect(() => {
    if (!user || !supabase) return;

    const fetchAndSync = async () => {
      if (!supabase) return;
      setIsSyncing(true);
      try {
        // Fetch cloud games
        const { data: cloudGames, error } = await supabase
          .from('history_games')
          .select('*')
          .order('timestamp', { ascending: false });

        if (error) throw error;

        setHistory(prevLocal => {
          const newHistory = [...prevLocal];
          let localNeedsUpdate = false;

          // Merge cloud games into local
          if (cloudGames) {
            for (const cg of cloudGames) {
              const existingIdx = newHistory.findIndex(g => g.id === cg.game_id || g.cloudId === cg.id);
              const mappedGame: HistoryGame = {
                id: cg.game_id,
                cloudId: cg.id,
                pgn: cg.pgn,
                white: cg.white,
                black: cg.black,
                result: cg.result,
                date: cg.date,
                event: cg.event || undefined,
                opening: cg.opening || undefined,
                startingFen: cg.starting_fen || undefined,
                source: cg.source as any,
                timestamp: Number(cg.timestamp),
                reviewed: cg.reviewed,
                is_chaos: cg.is_chaos || false,
                whiteAccuracy: cg.white_accuracy || undefined,
                blackAccuracy: cg.black_accuracy || undefined,
                overallAccuracy: cg.overall_accuracy || undefined,
                moveCount: cg.move_count,
                classifications: cg.classifications || undefined,
                syncStatus: 'synced'
              };

              if (existingIdx >= 0) {
                // If local exists but not synced, overwrite with cloud truth
                if (newHistory[existingIdx].syncStatus !== 'synced') {
                  newHistory[existingIdx] = mappedGame;
                  localNeedsUpdate = true;
                }
              } else {
                newHistory.push(mappedGame);
                localNeedsUpdate = true;
              }
            }
          }

          // Identify local-only games to prompt for migration
          const localOnlyGames = newHistory.filter(g => !g.cloudId && g.syncStatus !== 'pending');
          if (localOnlyGames.length > 0 && !hasMigratedPrompt) {
            // We will handle the prompt in the UI, but mark them as pending for now if we want auto-sync, 
            // but requirements say: "prompt the user: Sync Games / Keep Local".
            // So we don't auto-push. We just let the UI know.
          } else {
            // Push any pending games to cloud
            const pendingGames = newHistory.filter(g => !g.cloudId && g.syncStatus === 'pending');
            for (const pg of pendingGames) {
              pushGameToCloud(pg, user.id).then(cloudId => {
                if (cloudId) {
                  setHistory(curr => {
                    const updated = curr.map(c => c.id === pg.id ? { ...c, cloudId, syncStatus: 'synced' as const } : c);
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
                    return updated;
                  });
                }
              });
            }
          }

          if (localNeedsUpdate) {
            newHistory.sort((a, b) => b.timestamp - a.timestamp);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
          }
          return newHistory;
        });
      } catch (err) {
        console.error('Error syncing history', err);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchAndSync();
  }, [user]);

  const pushGameToCloud = async (game: HistoryGame, userId: string): Promise<string | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('history_games').insert({
        user_id: userId,
        game_id: game.id,
        pgn: game.pgn,
        white: game.white,
        black: game.black,
        result: game.result,
        date: game.date,
        event: game.event,
        opening: game.opening,
        starting_fen: game.startingFen,
        source: game.source,
        timestamp: game.timestamp,
        reviewed: game.reviewed || false,
        white_accuracy: game.whiteAccuracy,
        black_accuracy: game.blackAccuracy,
        overall_accuracy: game.overallAccuracy,
        move_count: game.moveCount,
        classifications: game.classifications,
        is_chaos: game.is_chaos || false
      }).select('id').single();
      
      if (error) throw error;
      return data.id;
    } catch (err) {
      console.error('Push to cloud failed', err);
      return null;
    }
  };

  const updateGameInCloud = async (cloudId: string, updates: any) => {
    if (!supabase || !user) return;
    try {
      await supabase.from('history_games').update(updates).eq('id', cloudId).eq('user_id', user.id);
    } catch (err) {
      console.error('Update cloud failed', err);
    }
  };

  const deleteGameInCloud = async (cloudId: string) => {
    if (!supabase || !user) return;
    try {
      await supabase.from('history_games').delete().eq('id', cloudId).eq('user_id', user.id);
    } catch (err) {
      console.error('Delete cloud failed', err);
    }
  };

  const addGame = useCallback(async (game: Omit<HistoryGame, 'id' | 'timestamp' | 'reviewed' | 'syncStatus'> & { id?: string }) => {
    const id = game.id || hashString(game.pgn);
    const timestamp = Date.now();
    const newGame: HistoryGame = {
      ...game,
      id,
      timestamp,
      reviewed: false,
      syncStatus: user ? 'pending' : 'local'
    };

    let existingIdx = -1;
    let cloudIdToUpdate: string | undefined = undefined;

    setHistory(prev => {
      existingIdx = prev.findIndex(g => g.id === id || g.pgn === game.pgn);
      const newHistory = [...prev];

      if (existingIdx >= 0) {
        cloudIdToUpdate = newHistory[existingIdx].cloudId;
        newHistory[existingIdx] = {
          ...newHistory[existingIdx],
          ...game,
          id: newHistory[existingIdx].id,
          timestamp: newHistory[existingIdx].timestamp,
          syncStatus: user ? (cloudIdToUpdate ? 'synced' : 'pending') : 'local'
        };
      } else {
        newHistory.unshift(newGame);
      }
      
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });

    if (user && supabase) {
      if (cloudIdToUpdate) {
        // Just an update, no need to re-insert
      } else {
        const cloudId = await pushGameToCloud(newGame, user.id);
        if (cloudId) {
          setHistory(prev => {
            const updated = prev.map(c => c.id === id ? { ...c, cloudId, syncStatus: 'synced' as const } : c);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
            return updated;
          });
        }
      }
    }
  }, [user]);

  const removeGame = useCallback(async (id: string) => {
    let cloudId: string | undefined;
    setHistory(prev => {
      const game = prev.find(g => g.id === id);
      cloudId = game?.cloudId;
      const newHistory = prev.filter(g => g.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });

    if (cloudId && user && supabase) {
      await deleteGameInCloud(cloudId);
    }
  }, [user]);

  const clearHistory = useCallback(async () => {
    // If logged in, delete all user's games from cloud
    if (user && supabase) {
      try {
        await supabase.from('history_games').delete().eq('user_id', user.id);
      } catch (e) {
        console.error('Failed to clear cloud history', e);
      }
    }
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, [user]);

  const updateGameReviewStats = useCallback(async (pgn: string, stats: Partial<HistoryGame>) => {
    let cloudId: string | undefined;
    
    setHistory(prev => {
      const existingIndex = prev.findIndex(g => g.pgn === pgn);
      if (existingIndex < 0) return prev;

      cloudId = prev[existingIndex].cloudId;
      const newHistory = [...prev];
      newHistory[existingIndex] = {
        ...newHistory[existingIndex],
        ...stats,
        reviewed: true
      };
      
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });

    if (cloudId && user && supabase) {
      await updateGameInCloud(cloudId, {
        reviewed: true,
        white_accuracy: stats.whiteAccuracy,
        black_accuracy: stats.blackAccuracy,
        overall_accuracy: stats.overallAccuracy,
        classifications: stats.classifications
      });
    }
  }, [user]);

  const migrateLocalGames = async () => {
    if (!user || !supabase) return;
    setHasMigratedPrompt(true);
    setIsSyncing(true);

    const localGames = history.filter(g => !g.cloudId);
    let updatedHistory = [...history];

    for (const lg of localGames) {
      const cloudId = await pushGameToCloud(lg, user.id);
      if (cloudId) {
        const idx = updatedHistory.findIndex(h => h.id === lg.id);
        if (idx >= 0) {
          updatedHistory[idx] = { ...updatedHistory[idx], cloudId, syncStatus: 'synced' };
        }
      }
    }
    
    setHistory(updatedHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    setIsSyncing(false);
  };

  const skipMigration = () => {
    setHasMigratedPrompt(true);
    // Mark them as purely local so we don't ask again this session
  };

  return {
    history,
    addGame,
    removeGame,
    clearHistory,
    updateGameReviewStats,
    isSyncing,
    migrateLocalGames,
    skipMigration,
    needsMigration: !hasMigratedPrompt && user && history.some(g => !g.cloudId && g.syncStatus === 'local')
  };
}
