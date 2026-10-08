import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

export interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
  rating: number;
  rating_bullet: number;
  rating_blitz: number;
  rating_rapid: number;
  puzzle_rating: number;
  highest_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  longest_win_streak: number;
  fastest_win_ms?: number;
  longest_game_moves: number;
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
        // If no profile exists, but they have a username from signup metadata, auto-create it!
        if (user.user_metadata?.username) {
          const { data: newProfile, error: rpcError } = await supabase.rpc('update_username', { 
            p_new_username: user.user_metadata.username 
          });
          
          if (!rpcError && newProfile) {
            setProfile(newProfile as UserProfile);
            setLoading(false);
            return;
          }
        }
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

  const updateAvatar = async (avatarUrl: string) => {
    if (!supabase || !user) return { success: false, error: 'Not authenticated.' };
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id).select().single();
      if (error) throw error;
      if (data) setProfile(data as UserProfile);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!supabase || !user) return { success: false, error: 'Not authenticated.' };
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { data, error: updateError } = await supabase.from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;
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
    updateAvatar,
    uploadAvatar,
    refreshProfile: fetchProfile,
    isOwner: profile?.username?.toLowerCase() === 'mikzqc',
  };
}
