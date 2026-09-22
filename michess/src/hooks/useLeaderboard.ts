import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { UserProfile } from './useProfile';

export type LeaderboardCategory = 'overall' | 'bullet' | 'blitz' | 'rapid' | 'puzzle_rating' | 'games_played';

export function useLeaderboard(category: LeaderboardCategory = 'overall') {
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        let orderByField = 'rating';
        if (category === 'bullet') orderByField = 'rating_bullet';
        else if (category === 'blitz') orderByField = 'rating_blitz';
        else if (category === 'rapid') orderByField = 'rating_rapid';
        else if (category === 'puzzle_rating') orderByField = 'puzzle_rating';
        else if (category === 'games_played') orderByField = 'games_played';

        const { data, error } = await supabase!
          .from('profiles')
          .select('*')
          .order(orderByField, { ascending: false })
          .limit(50);
        
        if (error) throw error;
        setLeaderboard(data || []);
      } catch (err) {
        console.error('Error fetching leaderboard', err);
      } finally {
        setLoading(false);
      }
    };

    if (supabase) {
      fetchLeaderboard();
    }
  }, [category]);

  return { leaderboard, loading };
}
