import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { UserProfile } from './useProfile';

export function usePublicProfile(username: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!username) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (!supabase) throw new Error('Database connection not available');
        const { data, error: err } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', username)
          .single();

        if (err) throw err;
        setProfile(data as UserProfile);
      } catch (err: any) {
        console.error('Error fetching public profile:', err);
        setError(err.message || 'Profile not found');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [username]);

  return { profile, loading, error };
}
