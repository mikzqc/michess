import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useHistory } from './useHistory';
import { useToast } from '../components/Toast';
import type { LinkedAccountsConfig, LinkedAccountPlatform } from '../types/linkedAccounts';
import {
  validateChesscomUser,
  validateLichessUser,
  fetchRecentChesscomGames,
  fetchRecentLichessGames
} from '../services/linkedAccountsService';

const STORAGE_KEY = 'michess_linked_accounts_v1';

const DEFAULT_CONFIG: LinkedAccountsConfig = {
  chesscomUsername: null,
  lichessUsername: null,
  autoSync: true,
  lastSyncChesscom: null,
  lastSyncLichess: null
};

export function useLinkedAccounts() {
  const { user } = useAuth();
  const { profile, updateLinkedAccounts } = useProfile();
  const { history, addGame } = useHistory();
  const { addToast } = useToast();

  const [config, setConfig] = useState<LinkedAccountsConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const syncLockRef = useRef(false);
  const isMountedRef = useRef(true);

  // Sync state between profile (cloud) and localStorage
  useEffect(() => {
    if (profile) {
      setConfig(prev => {
        const next: LinkedAccountsConfig = {
          ...prev,
          chesscomUsername: profile.chesscom_username ?? prev.chesscomUsername,
          lichessUsername: profile.lichess_username ?? prev.lichessUsername,
          autoSync: profile.sync_external_games ?? prev.autoSync,
          lastSyncChesscom: profile.last_external_sync ? new Date(profile.last_external_sync).getTime() : prev.lastSyncChesscom,
          lastSyncLichess: profile.last_external_sync ? new Date(profile.last_external_sync).getTime() : prev.lastSyncLichess,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [profile]);

  const saveConfig = useCallback(async (newConfig: LinkedAccountsConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch {}

    if (user && updateLinkedAccounts) {
      await updateLinkedAccounts({
        chesscom_username: newConfig.chesscomUsername,
        lichess_username: newConfig.lichessUsername,
        sync_external_games: newConfig.autoSync,
        last_external_sync: new Date().toISOString()
      });
    }
  }, [user, updateLinkedAccounts]);

  /**
   * Link an external account after validating username with API
   */
  const linkAccount = useCallback(async (platform: LinkedAccountPlatform, username: string): Promise<{ success: boolean; error?: string }> => {
    const clean = username.trim();
    if (!clean) return { success: false, error: 'Please enter a valid username.' };

    setIsSyncing(true);
    try {
      if (platform === 'chesscom') {
        const validation = await validateChesscomUser(clean);
        if (!validation.valid) {
          return { success: false, error: validation.error || 'User not found on Chess.com' };
        }
        const updated: LinkedAccountsConfig = {
          ...config,
          chesscomUsername: validation.profile?.username || clean
        };
        await saveConfig(updated);
        addToast(`Linked Chess.com account: @${validation.profile?.username || clean}`, 'success');
      } else {
        const validation = await validateLichessUser(clean);
        if (!validation.valid) {
          return { success: false, error: validation.error || 'User not found on Lichess' };
        }
        const updated: LinkedAccountsConfig = {
          ...config,
          lichessUsername: validation.profile?.username || clean
        };
        await saveConfig(updated);
        addToast(`Linked Lichess account: @${validation.profile?.username || clean}`, 'success');
      }

      // Immediately trigger initial sync
      setTimeout(() => syncGames({ showToast: true }), 100);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to link account.' };
    } finally {
      setIsSyncing(false);
    }
  }, [config, saveConfig, addToast]);

  /**
   * Unlink an account
   */
  const unlinkAccount = useCallback(async (platform: LinkedAccountPlatform) => {
    const updated: LinkedAccountsConfig = {
      ...config,
      ...(platform === 'chesscom' ? { chesscomUsername: null, lastSyncChesscom: null } : { lichessUsername: null, lastSyncLichess: null })
    };
    await saveConfig(updated);
    addToast(`Unlinked ${platform === 'chesscom' ? 'Chess.com' : 'Lichess'} account.`, 'info');
  }, [config, saveConfig, addToast]);

  /**
   * Toggle auto-sync
   */
  const setAutoSync = useCallback(async (enabled: boolean) => {
    const updated = { ...config, autoSync: enabled };
    await saveConfig(updated);
  }, [config, saveConfig]);

  /**
   * Synchronize games from all linked platforms
   */
  const syncGames = useCallback(async (options?: { showToast?: boolean; force?: boolean }): Promise<{ chesscomCount: number; lichessCount: number; newAdded: number; error?: string }> => {
    if (syncLockRef.current) {
      return { chesscomCount: 0, lichessCount: 0, newAdded: 0 };
    }

    if (!config.chesscomUsername && !config.lichessUsername) {
      return { chesscomCount: 0, lichessCount: 0, newAdded: 0 };
    }

    syncLockRef.current = true;
    setIsSyncing(true);

    let chesscomCount = 0;
    let lichessCount = 0;
    let newAdded = 0;
    let syncError: string | undefined = undefined;

    try {
      const existingIds = new Set(history.map(g => g.id));
      const existingPgns = new Set(history.map(g => g.pgn.trim()));

      // 1. Fetch Chess.com games
      if (config.chesscomUsername) {
        try {
          const chesscomGames = await fetchRecentChesscomGames(config.chesscomUsername, 25);
          chesscomCount = chesscomGames.length;

          for (const game of chesscomGames) {
            if (!existingIds.has(game.id) && !existingPgns.has(game.pgn.trim())) {
              await addGame({
                id: game.id,
                pgn: game.pgn,
                white: game.white,
                black: game.black,
                result: game.result,
                date: game.date,
                event: game.event,
                opening: game.opening,
                startingFen: game.startingFen,
                source: 'chesscom',
                moveCount: game.moveCount,
                externalUrl: game.externalUrl
              });
              existingIds.add(game.id);
              existingPgns.add(game.pgn.trim());
              newAdded++;
            }
          }
        } catch (e: any) {
          console.warn('Error syncing Chess.com games:', e);
          syncError = e.message;
        }
      }

      // 2. Fetch Lichess games
      if (config.lichessUsername) {
        try {
          const lichessGames = await fetchRecentLichessGames(config.lichessUsername, 25);
          lichessCount = lichessGames.length;

          for (const game of lichessGames) {
            if (!existingIds.has(game.id) && !existingPgns.has(game.pgn.trim())) {
              await addGame({
                id: game.id,
                pgn: game.pgn,
                white: game.white,
                black: game.black,
                result: game.result,
                date: game.date,
                event: game.event,
                opening: game.opening,
                startingFen: game.startingFen,
                source: 'lichess',
                moveCount: game.moveCount,
                externalUrl: game.externalUrl
              });
              existingIds.add(game.id);
              existingPgns.add(game.pgn.trim());
              newAdded++;
            }
          }
        } catch (e: any) {
          console.warn('Error syncing Lichess games:', e);
          syncError = syncError ? `${syncError}; ${e.message}` : e.message;
        }
      }

      // Update last sync timestamps
      const now = Date.now();
      const updatedConfig: LinkedAccountsConfig = {
        ...config,
        lastSyncChesscom: config.chesscomUsername ? now : config.lastSyncChesscom,
        lastSyncLichess: config.lichessUsername ? now : config.lastSyncLichess
      };
      await saveConfig(updatedConfig);

      if (options?.showToast) {
        if (newAdded > 0) {
          addToast(`Synced ${newAdded} new game${newAdded > 1 ? 's' : ''} into Michess!`, 'success');
        } else {
          addToast('All games are already up to date.', 'info');
        }
      }
    } catch (err: any) {
      console.error('External games sync failed:', err);
      syncError = err.message;
    } finally {
      syncLockRef.current = false;
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }

    return { chesscomCount, lichessCount, newAdded, error: syncError };
  }, [config, history, addGame, saveConfig, addToast]);

  // Periodic and tab visibility synchronization
  useEffect(() => {
    isMountedRef.current = true;

    if (!config.autoSync || (!config.chesscomUsername && !config.lichessUsername)) {
      return;
    }

    // Auto-sync on visibility change (when player finishes game on Chess.com / Lichess and returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastSync = Math.max(config.lastSyncChesscom || 0, config.lastSyncLichess || 0);
        // If last sync was more than 20 seconds ago, sync immediately
        if (Date.now() - lastSync > 20_000) {
          syncGames({ showToast: false });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic sync every 60 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncGames({ showToast: false });
      }
    }, 60_000);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [config.autoSync, config.chesscomUsername, config.lichessUsername, config.lastSyncChesscom, config.lastSyncLichess, syncGames]);

  return {
    config,
    isSyncing,
    linkAccount,
    unlinkAccount,
    setAutoSync,
    syncGames,
    isLinked: !!(config.chesscomUsername || config.lichessUsername)
  };
}
