import { useState } from 'react';
import type { ImportedGameMeta } from '../utils/importUtils';

export function useImportQueue() {
  const [queue, setQueue] = useState<ImportedGameMeta[]>(() => {
    try {
      const stored = localStorage.getItem('michess_import_queue');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse import queue', e);
    }
    return [];
  });

  const addGames = (games: ImportedGameMeta[]) => {
    setQueue(prev => {
      const newQueue = [...prev];
      let added = 0;
      for (const g of games) {
        if (!newQueue.find(existing => existing.id === g.id)) {
          newQueue.push(g);
          added++;
        }
      }
      if (added > 0) {
        localStorage.setItem('michess_import_queue', JSON.stringify(newQueue));
      }
      return newQueue;
    });
  };

  const removeGame = (id: string) => {
    setQueue(prev => {
      const newQueue = prev.filter(g => g.id !== id);
      localStorage.setItem('michess_import_queue', JSON.stringify(newQueue));
      return newQueue;
    });
  };

  const clearQueue = () => {
    setQueue([]);
    localStorage.removeItem('michess_import_queue');
  };

  return { queue, addGames, removeGame, clearQueue };
}
