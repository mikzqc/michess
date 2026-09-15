import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

export interface UserProfile {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
  last_username_change: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error('No supabase client');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        setProfile(data as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const updateUsername = async (newUsername: string) => {
    if (!supabase) return { success: false, error: 'Database connection error.' };
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('update_username', { p_new_username: newUsername });
      if (error) throw error;
      if (data) setProfile(data as UserProfile);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    updateUsername,
    refreshProfile: fetchProfile,
    isOwner: profile?.username?.toLowerCase() === 'mikzqc',
  };
}
