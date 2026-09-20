import { useState } from 'react';
import { supabase } from '../services/supabase';
import type { UserProfile } from './useProfile';

export function useSearch() {
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Database not configured');
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(10);
      
      if (err) throw err;
      setResults(data as UserProfile[]);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, searchUsers };
}
