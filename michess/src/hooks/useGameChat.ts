import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import type { GameMessage, MessageReport } from '../types/chat';

interface UseGameChatProps {
  gameId: string | undefined;
  playerId: string;
  playerName: string;
  isChatOpen: boolean;
}

export function useGameChat({ gameId, playerId, playerName, isChatOpen }: UseGameChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isChatOpenRef = useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  // Fetch existing game messages
  const fetchMessages = useCallback(async () => {
    if (!gameId || !supabase) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('game_messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (fetchErr) {
        console.warn('Could not fetch game messages:', fetchErr.message);
        return;
      }
      if (data) {
        setMessages(data);
      }
    } catch (err: any) {
      console.warn('Failed to load game chat:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for this game's chat
  useEffect(() => {
    if (!gameId || !supabase) return;

    const channelName = `game_chat_${gameId}_${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_messages',
          filter: `game_id=eq.${gameId}`
        },
        payload => {
          const newMsg = payload.new as GameMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // If the message is from the opponent and chat is closed, increment unreadCount
          if (newMsg.sender_id !== playerId && !isChatOpenRef.current) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(subscription);
    };
  }, [gameId, playerId]);

  // Send a message
  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return { success: false, error: 'Message cannot be empty' };
    if (trimmed.length > 500) return { success: false, error: 'Message too long (max 500 characters)' };
    if (!gameId || !supabase) return { success: false, error: 'Game not available' };

    const optimisticMsg: GameMessage = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      game_id: gameId,
      sender_id: playerId,
      sender_name: playerName || 'Player',
      content: trimmed,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error: sendErr } = await supabase
        .from('game_messages')
        .insert({
          game_id: gameId,
          sender_id: playerId,
          sender_name: playerName || 'Player',
          content: trimmed
        })
        .select()
        .single();

      if (sendErr) throw sendErr;

      if (data) {
        setMessages(prev =>
          prev.map(m => (m.id === optimisticMsg.id ? data : m))
        );
      }
      return { success: true };
    } catch (err: any) {
      console.error('Failed to send game message:', err);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setError(err?.message || 'Failed to send message');
      return { success: false, error: err?.message || 'Failed to send message' };
    }
  };

  // Report message
  const reportGameMessage = async (report: Omit<MessageReport, 'reporter_id'>) => {
    if (!user || !supabase) return { success: false, error: 'Must be logged in to report' };
    try {
      const { error: repErr } = await supabase
        .from('message_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: report.reported_user_id,
          message_id: report.message_id,
          message_type: 'game',
          reason: report.reason,
          details: report.details || ''
        });

      if (repErr) throw repErr;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to report game message:', err);
      return { success: false, error: err?.message || 'Failed to submit report' };
    }
  };

  return {
    messages,
    unreadCount,
    loading,
    error,
    sendMessage,
    reportGameMessage,
    clearUnread: () => setUnreadCount(0)
  };
}
