import { useMemo } from 'react';
import type { HistoryGame } from '../types/history';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgAccuracy: number;
  totalBlunders: number;
  totalMistakes: number;
  totalInaccuracies: number;
  mostCommonResult: string;
}

export interface OpeningStat {
  name: string;
  eco?: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export function useStatistics(history: HistoryGame[], targetPlayerName: string) {
  const stats = useMemo(() => {
    const s: PlayerStats = {
      gamesPlayed: history.length,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      avgAccuracy: 0,
      totalBlunders: 0,
      totalMistakes: 0,
      totalInaccuracies: 0,
      mostCommonResult: 'N/A'
    };

    if (history.length === 0) return s;

    let accuracySum = 0;
    let accuracyCount = 0;
    const resultTypes: Record<string, number> = {};

    history.forEach(game => {
      const isWhite = game.white === targetPlayerName;
      const isBlack = game.black === targetPlayerName;
      
      if (!isWhite && !isBlack) return;

      const won = (isWhite && game.result === '1-0') || (isBlack && game.result === '0-1');
      const lost = (isWhite && game.result === '0-1') || (isBlack && game.result === '1-0');
      const draw = game.result === '1/2-1/2';

      if (won) s.wins++;
      else if (lost) s.losses++;
      else if (draw) s.draws++;

      resultTypes[game.result] = (resultTypes[game.result] || 0) + 1;

      // Accuracy
      const myAccuracy = isWhite ? game.whiteAccuracy : game.blackAccuracy;
      if (myAccuracy !== undefined) {
        accuracySum += myAccuracy;
        accuracyCount++;
      }

      // Blunders/Mistakes (Assuming classifications is a record mapping moves to symbols, 
      // but in history_games it's actually just `{ '?': 2, '??': 1 }` from our Phase 19/21 implementation)
      if (game.classifications) {
        s.totalBlunders += (game.classifications['??'] || 0);
        s.totalMistakes += (game.classifications['?'] || 0);
        s.totalInaccuracies += (game.classifications['?!'] || 0);
      }
    });

    s.winRate = Math.round((s.wins / s.gamesPlayed) * 100);
    s.avgAccuracy = accuracyCount > 0 ? Math.round(accuracySum / accuracyCount) : 0;

    const topResult = Object.entries(resultTypes).sort((a, b) => b[1] - a[1])[0];
    if (topResult) {
      if (topResult[0] === '1-0' || topResult[0] === '0-1') {
        s.mostCommonResult = 'Decisive';
      } else {
        s.mostCommonResult = 'Draw';
      }
    }

    return s;
  }, [history, targetPlayerName]);

  const openingStats = useMemo(() => {
    const openings: Record<string, OpeningStat> = {};

    history.forEach(game => {
      if (!game.opening) return;
      const isWhite = game.white === targetPlayerName;
      const isBlack = game.black === targetPlayerName;
      
      const won = (isWhite && game.result === '1-0') || (isBlack && game.result === '0-1');
      const lost = (isWhite && game.result === '0-1') || (isBlack && game.result === '1-0');

      if (!openings[game.opening]) {
        openings[game.opening] = {
          name: game.opening,
          games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0
        };
      }

      openings[game.opening].games++;
      if (won) openings[game.opening].wins++;
      else if (lost) openings[game.opening].losses++;
      else openings[game.opening].draws++;
    });

    // Calculate win rates and sort
    const sorted = Object.values(openings).map(o => ({
      ...o,
      winRate: Math.round((o.wins / o.games) * 100)
    })).sort((a, b) => b.games - a.games);

    return sorted;
  }, [history, targetPlayerName]);

  return { stats, openingStats };
}
