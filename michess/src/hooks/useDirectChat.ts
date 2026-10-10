import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import type { DirectMessage, MessageReport } from '../types/chat';

export function useDirectChat(activeFriendId?: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [allRecentMessages, setAllRecentMessages] = useState<DirectMessage[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch blocked users
  const fetchBlockedUsers = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data, error: blockErr } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (blockErr) {
        // Table might not exist yet if migration pending; fail silently
        console.warn('Could not fetch blocked users:', blockErr.message);
        return;
      }
      if (data) {
        setBlockedUserIds(data.map(b => b.blocked_id));
      }
    } catch (err: any) {
      console.warn('Failed to load blocked users:', err?.message);
    }
  }, [user]);

  // Fetch recent messages across all conversations for unread counts & snippets
  const fetchRecentMessages = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data, error: recentErr } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
        .limit(200);

      if (recentErr) {
        console.warn('Could not fetch direct messages:', recentErr.message);
        return;
      }
      if (data) {
        setAllRecentMessages(data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch recent messages:', err?.message);
    }
  }, [user]);

  // Fetch messages for the currently active friend conversation
  const fetchConversationMessages = useCallback(async (friendId: string) => {
    if (!user || !supabase || !friendId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100);

      if (fetchErr) throw fetchErr;

      setMessages(data || []);

      // Auto-mark unread incoming messages as read
      const unreadIncoming = (data || []).filter(
        m => m.receiver_id === user.id && m.sender_id === friendId && !m.read
      );
      if (unreadIncoming.length > 0) {
        const unreadIds = unreadIncoming.map(m => m.id);
        await supabase
          .from('direct_messages')
          .update({ read: true })
          .in('id', unreadIds);

        setAllRecentMessages(prev =>
          prev.map(m => (unreadIds.includes(m.id) ? { ...m, read: true } : m))
        );
      }
    } catch (err: any) {
      console.error('Error fetching conversation:', err);
      setError(err?.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load initial data
  useEffect(() => {
    fetchBlockedUsers();
    fetchRecentMessages();
  }, [fetchBlockedUsers, fetchRecentMessages]);

  // When active friend changes, load that conversation
  useEffect(() => {
    if (activeFriendId) {
      fetchConversationMessages(activeFriendId);
    } else {
      setMessages([]);
    }
  }, [activeFriendId, fetchConversationMessages]);

  // Realtime subscription for incoming/outgoing direct messages
  useEffect(() => {
    if (!user || !supabase) return;

    const channelName = `dm_user_${user.id}_${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        payload => {
          const newMsg = payload.new as DirectMessage;
          setAllRecentMessages(prev => [...prev, newMsg]);

          if (activeFriendId && newMsg.sender_id === activeFriendId) {
            setMessages(prev => [...prev, { ...newMsg, read: true }]);
            // Mark as read in db immediately
            supabase
              .from('direct_messages')
              .update({ read: true })
              .eq('id', newMsg.id)
              .then(() => {});
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${user.id}`
        },
        payload => {
          const newMsg = payload.new as DirectMessage;
          setAllRecentMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (activeFriendId && newMsg.receiver_id === activeFriendId) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${user.id}`
        },
        payload => {
          const updated = payload.new as DirectMessage;
          setAllRecentMessages(prev =>
            prev.map(m => (m.id === updated.id ? updated : m))
          );
          setMessages(prev =>
            prev.map(m => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(subscription);
    };
  }, [user, activeFriendId]);

  // Unread count per friend
  const unreadCounts = useMemo(() => {
    if (!user) return {};
    const map: Record<string, number> = {};
    for (const msg of allRecentMessages) {
      if (msg.receiver_id === user.id && !msg.read) {
        map[msg.sender_id] = (map[msg.sender_id] || 0) + 1;
      }
    }
    return map;
  }, [allRecentMessages, user]);

  // Total unread messages across all friends
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((acc, count) => acc + count, 0);
  }, [unreadCounts]);

  // Last message snippet per friend
  const lastMessages = useMemo(() => {
    if (!user) return {};
    const map: Record<string, DirectMessage> = {};
    for (const msg of allRecentMessages) {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!map[otherId] || new Date(msg.created_at) > new Date(map[otherId].created_at)) {
        map[otherId] = msg;
      }
    }
    return map;
  }, [allRecentMessages, user]);

  // Send a message to a friend
  const sendMessage = async (friendId: string, content: string) => {
    if (!user || !supabase) {
      return { success: false, error: 'Not logged in' };
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return { success: false, error: 'Message cannot be empty' };
    }
    if (trimmed.length > 2000) {
      return { success: false, error: 'Message is too long (max 2000 characters)' };
    }
    if (blockedUserIds.includes(friendId)) {
      return { success: false, error: 'You have blocked this user' };
    }

    const optimisticMsg: DirectMessage = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sender_id: user.id,
      receiver_id: friendId,
      content: trimmed,
      read: false,
      created_at: new Date().toISOString()
    };

    // Optimistic UI update
    setMessages(prev => [...prev, optimisticMsg]);
    setAllRecentMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error: sendErr } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: friendId,
          content: trimmed
        })
        .select()
        .single();

      if (sendErr) throw sendErr;

      // Replace optimistic message with saved one
      if (data) {
        setMessages(prev =>
          prev.map(m => (m.id === optimisticMsg.id ? data : m))
        );
        setAllRecentMessages(prev =>
          prev.map(m => (m.id === optimisticMsg.id ? data : m))
        );
      }
      return { success: true };
    } catch (err: any) {
      console.error('Failed to send direct message:', err);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setAllRecentMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      return { success: false, error: err?.message || 'Failed to send message' };
    }
  };

  // Mark a conversation as read
  const markConversationAsRead = async (friendId: string) => {
    if (!user || !supabase || !friendId) return;

    setAllRecentMessages(prev =>
      prev.map(m =>
        m.receiver_id === user.id && m.sender_id === friendId
          ? { ...m, read: true }
          : m
      )
    );
    setMessages(prev =>
      prev.map(m =>
        m.receiver_id === user.id && m.sender_id === friendId
          ? { ...m, read: true }
          : m
      )
    );

    try {
      await supabase
        .from('direct_messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', friendId)
        .eq('read', false);
    } catch (err) {
      console.warn('Error marking messages as read:', err);
    }
  };

  // Block a user
  const blockUser = async (targetUserId: string) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    try {
      const { error: blockErr } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: targetUserId
        });

      if (blockErr && !blockErr.message.includes('duplicate')) throw blockErr;

      setBlockedUserIds(prev => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]));
      return { success: true };
    } catch (err: any) {
      console.error('Failed to block user:', err);
      return { success: false, error: err?.message || 'Failed to block user' };
    }
  };

  // Unblock a user
  const unblockUser = async (targetUserId: string) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    try {
      const { error: unblockErr } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId);

      if (unblockErr) throw unblockErr;

      setBlockedUserIds(prev => prev.filter(id => id !== targetUserId));
      return { success: true };
    } catch (err: any) {
      console.error('Failed to unblock user:', err);
      return { success: false, error: err?.message || 'Failed to unblock user' };
    }
  };

  // Report a message or user
  const reportMessage = async (report: Omit<MessageReport, 'reporter_id'>) => {
    if (!user || !supabase) return { success: false, error: 'Not logged in' };
    try {
      const { error: repErr } = await supabase
        .from('message_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: report.reported_user_id,
          message_id: report.message_id,
          message_type: report.message_type,
          reason: report.reason,
          details: report.details || ''
        });

      if (repErr) throw repErr;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      return { success: false, error: err?.message || 'Failed to submit report' };
    }
  };

  return {
    messages,
    loading,
    error,
    unreadCounts,
    totalUnreadCount,
    lastMessages,
    blockedUserIds,
    sendMessage,
    markConversationAsRead,
    blockUser,
    unblockUser,
    reportMessage,
    refreshMessages: () => {
      fetchRecentMessages();
      if (activeFriendId) fetchConversationMessages(activeFriendId);
    }
  };
}
