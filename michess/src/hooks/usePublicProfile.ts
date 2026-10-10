import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { UserProfile } from './useProfile';

export function usePublicProfile(username: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      if (!username) {
        if (isMounted) {
          setProfile(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        if (!supabase) throw new Error('Database connection not available');
        const { data, error: err } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', username)
          .single();

        if (err) throw err;
        if (isMounted) {
          setProfile(data as UserProfile);
        }
      } catch (err: any) {
        console.error('Error fetching public profile:', err);
        if (isMounted) {
          setProfile(null);
          setError(err.message || 'Profile not found');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [username]);

  return { profile, loading, error };
}
