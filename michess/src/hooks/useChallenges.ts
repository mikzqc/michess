import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import type { UserProfile } from './useProfile';

export interface Challenge {
  id: string;
  sender_id: string;
  receiver_id: string;
  time_control: string;
  status: 'pending' | 'accepted' | 'declined';
  game_id?: string;
  created_at: string;
  sender_profile?: UserProfile;
  receiver_profile?: UserProfile;
}

export function useChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = async () => {
    if (!user || !supabase) {
      setChallenges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          sender_profile:profiles!challenges_sender_id_fkey(*),
          receiver_profile:profiles!challenges_receiver_id_fkey(*)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChallenges(data as any);
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();

    if (!user || !supabase) return;

    const subscription = supabase
      .channel(`challenges_channel_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenges',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchChallenges();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenges',
          filter: `sender_id=eq.${user.id}`
        },
        () => {
          fetchChallenges();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(subscription);
    };
  }, [user]);

  const sendChallenge = async (receiverId: string, timeControl: string) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    if (user.id === receiverId) return { success: false, error: 'Cannot challenge yourself' };

    const existing = challenges.find(c => 
      c.status === 'pending' && 
      c.sender_id === user.id && 
      c.receiver_id === receiverId
    );
    if (existing) {
      return { success: false, error: 'Challenge already pending' };
    }

    try {
      // 1. Create the challenge
      const { data: challenge, error } = await supabase.from('challenges').insert({
        sender_id: user.id,
        receiver_id: receiverId,
        time_control: timeControl,
        status: 'pending'
      }).select().single();
      
      if (error) throw error;

      // 2. Create notification for the receiver
      await supabase.from('notifications').insert({
        user_id: receiverId,
        sender_id: user.id,
        type: 'challenge',
        message: 'challenged you to a game',
        related_id: challenge.id
      });

      fetchChallenges();
      return { success: true, challenge };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const respondToChallenge = async (challengeId: string, accept: boolean, gameId?: string) => {
    if (!user || !supabase) return { success: false };
    try {
      const status = accept ? 'accepted' : 'declined';
      
      const { data: challenge, error } = await supabase
        .from('challenges')
        .update({ status, game_id: gameId })
        .eq('id', challengeId)
        .select()
        .single();
        
      if (error) throw error;

      // Notify the sender
      await supabase.from('notifications').insert({
        user_id: challenge.sender_id,
        sender_id: user.id,
        type: accept ? 'challenge_accepted' : 'challenge_declined',
        message: accept ? 'accepted your challenge' : 'declined your challenge',
        related_id: gameId || challengeId
      });

      fetchChallenges();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    challenges,
    loading,
    sendChallenge,
    respondToChallenge,
    refreshChallenges: fetchChallenges
  };
}
