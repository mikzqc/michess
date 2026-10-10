import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import type { UserProfile } from './useProfile';

export interface Friendship {
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  friend_profile?: UserProfile;
}

export function useSocial() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = async () => {
    if (!user || !supabase) {
      setFriends([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch where user is either sender or receiver
      const { data, error: err } = await supabase
        .from('friendships')
        .select(`
          *,
          user_profile:profiles!friendships_user_id_fkey(*),
          friend_profile:profiles!friendships_friend_id_fkey(*)
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (err) throw err;

      // Map to a cleaner format where friend_profile is always the OTHER person
      const mapped = (data || []).map((f: any) => ({
        ...f,
        friend_profile: f.user_id === user.id ? f.friend_profile : f.user_profile
      }));

      setFriends(mapped);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [user]);

  const sendRequest = async (friendId: string) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    if (user.id === friendId) return { success: false, error: 'Cannot send friend request to yourself' };

    const existing = friends.find(f => 
      (f.user_id === user.id && f.friend_id === friendId) || 
      (f.user_id === friendId && f.friend_id === user.id)
    );
    if (existing) {
      return { 
        success: false, 
        error: existing.status === 'accepted' ? 'Already friends' : 'Friend request already sent' 
      };
    }

    try {
      const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
      });
      if (error) throw error;
      
      // Notify the receiver
      await supabase.from('notifications').insert({
        user_id: friendId,
        sender_id: user.id,
        type: 'friend_request',
        message: 'sent you a friend request'
      });

      fetchFriends();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const acceptRequest = async (friendId: string) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    try {
      const { error } = await supabase.from('friendships')
        .update({ status: 'accepted' })
        .match({ user_id: friendId, friend_id: user.id });
      if (error) throw error;

      // Notify the original sender
      await supabase.from('notifications').insert({
        user_id: friendId,
        sender_id: user.id,
        type: 'friend_accepted',
        message: 'accepted your friend request'
      });

      fetchFriends();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    try {
      const { error } = await supabase.from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
      if (error) throw error;
      fetchFriends();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return { friends, loading, error, sendRequest, acceptRequest, removeFriend, refreshFriends: fetchFriends };
}
