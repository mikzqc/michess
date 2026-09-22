import { useState, useEffect } from 'react';
import type { HistoryGame } from '../types/history';
import { supabase } from '../services/supabase';

export function usePublicHistory(userId?: string) {
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase!
          .from('history_games')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false });

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error('Error fetching public history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  return { history, loading };
}
