import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { supabase } from '../services/supabase';
import type { LinkGame } from '../types/linkGame';
import { generateUUID } from '../utils/uuid';
import { audioService } from '../services/audio';

export function useLinkGame(inviteCode: string | null, userId: string | undefined) {
  const [gameData, setGameData] = useState<LinkGame | null>(null);
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Manage Player Identity (Auth ID or Guest ID)
  const [guestId] = useState(() => {
    let id = localStorage.getItem('michess_guest_id');
    if (!id) {
      id = generateUUID();
      localStorage.setItem('michess_guest_id', id);
    }
    return id;
  });
  
  const playerId = userId || guestId;

  // To avoid duplicate updates
  const lastProcessedPgn = useRef('');

  const fetchGame = useCallback(async () => {
    if (!inviteCode || !supabase) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('link_games')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();
      
      if (fetchErr) throw fetchErr;
      
      setGameData(data);
      if (data.pgn !== lastProcessedPgn.current) {
        chess.loadPgn(data.pgn || '');
        setFen(chess.fen());
        lastProcessedPgn.current = data.pgn;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [inviteCode, chess]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Realtime subscription
  useEffect(() => {
    if (!inviteCode || !supabase || !gameData?.id) return;

    const channel = supabase.channel(`game_${gameData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'link_games',
          filter: `id=eq.${gameData.id}`
        },
        (payload) => {
          const newGame = payload.new as LinkGame;
          setGameData(newGame);
          
          if (newGame.pgn !== lastProcessedPgn.current) {
            chess.loadPgn(newGame.pgn || '');
            setFen(chess.fen());
            
            const history = chess.history({ verbose: true });
            const lastMove = history[history.length - 1];
            if (lastMove) {
               const amIWhite = newGame.white_player === playerId;
               const amIBlack = newGame.black_player === playerId;
               const didIMove = (lastMove.color === 'w' && amIWhite) || (lastMove.color === 'b' && amIBlack);
               
               if (!didIMove) {
                 audioService.playMove(lastMove);
               }
            }

            setFen(chess.fen());
            lastProcessedPgn.current = newGame.pgn;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setIsReconnecting(false);
          // Refetch to ensure we didn't miss events while disconnected
          fetchGame();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setIsReconnecting(true);
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [inviteCode, gameData?.id, chess, fetchGame]);

  const joinGame = async () => {
    if (!supabase || !gameData) return;
    if (gameData.status !== 'waiting') {
      setError('Game is no longer waiting for players.');
      return;
    }
    
    try {
      const { error } = await supabase.rpc('join_link_game', {
        p_game_id: gameData.id,
        p_joiner_id: playerId
      });
      
      if (error) throw error;
      fetchGame(); // refresh
    } catch (err: any) {
      setError(err.message || 'Failed to join game');
    }
  };

  const isMovingRef = useRef(false);

  const makeMove = async (move: { from: string; to: string; promotion?: string }) => {
    if (!supabase || !gameData) return false;
    if (gameData.status !== 'active') return false;
    if (isMovingRef.current) return false;

    // Verify it's the user's turn
    const isWhite = gameData.white_player === playerId;
    const isBlack = gameData.black_player === playerId;
    const turnColor = chess.turn();

    if ((turnColor === 'w' && !isWhite) || (turnColor === 'b' && !isBlack)) {
      return false; // Not your turn!
    }

    try {
      isMovingRef.current = true;
      const originalFen = chess.fen();
      const originalPgn = chess.pgn();
      
      const moveResult = chess.move(move);
      if (moveResult) {
        audioService.playMove(moveResult);
        setFen(chess.fen());
        lastProcessedPgn.current = chess.pgn();
        
        let newStatus: LinkGame['status'] = gameData.status;
        let winner = gameData.winner;

        if (chess.isGameOver()) {
          newStatus = 'completed';
          if (chess.isCheckmate()) {
            winner = turnColor === 'w' ? gameData.white_player : gameData.black_player;
          }
        }

        const updates: Partial<LinkGame> = {
          fen: chess.fen(),
          pgn: chess.pgn(),
          current_turn: chess.turn(),
          status: newStatus,
          winner,
          updated_at: new Date().toISOString()
        };

        // Optimistically update local state
        setGameData({ ...gameData, ...updates, draw_offer_by: null } as LinkGame);

        // Push to supabase
        const { error } = await supabase.rpc('update_link_game', {
          p_game_id: gameData.id,
          p_player_id: playerId,
          p_fen: updates.fen,
          p_pgn: updates.pgn,
          p_turn: updates.current_turn,
          p_status: updates.status,
          p_winner: updates.winner
        });
        
        // If there was a pending draw offer, clear it
        if (gameData.draw_offer_by) {
          await supabase.from('link_games').update({ draw_offer_by: null }).eq('id', gameData.id);
        }
        
        if (error) {
          console.error("Update failed", error);
          // Rollback local state
          chess.undo();
          setFen(originalFen);
          lastProcessedPgn.current = originalPgn;
          setGameData(gameData);
          console.warn("Network error: Move not sent. Board rolled back.");
          isMovingRef.current = false;
          return false;
        }

        isMovingRef.current = false;
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    isMovingRef.current = false;
    return false;
  };

  const resign = async () => {
    if (!supabase || !gameData) return;
    if (gameData.status !== 'active') return;

    const isWhite = gameData.white_player === playerId;
    const winner = isWhite ? gameData.black_player : gameData.white_player;
    
    const updates: Partial<LinkGame> = {
      status: 'completed',
      winner,
      updated_at: new Date().toISOString()
    };

    setGameData({ ...gameData, ...updates } as LinkGame);

    await supabase.rpc('update_link_game', {
      p_game_id: gameData.id,
      p_player_id: playerId,
      p_fen: null,
      p_pgn: null,
      p_turn: null,
      p_status: 'completed',
      p_winner: winner
    });
  };

  const cancelGame = async () => {
    if (!supabase || !gameData) return;
    if (gameData.status === 'waiting' && (gameData.white_player === playerId || gameData.black_player === playerId)) {
      await supabase.rpc('cancel_link_game', {
        p_game_id: gameData.id,
        p_player_id: playerId
      });
      setGameData(null);
      setError('Game cancelled');
    }
  };

  const abortGame = async () => {
    if (!supabase || !gameData) return;
    if (gameData.status !== 'active') return;

    const updates: Partial<LinkGame> = {
      status: 'abandoned',
      updated_at: new Date().toISOString()
    };

    setGameData({ ...gameData, ...updates } as LinkGame);

    await supabase.rpc('update_link_game', {
      p_game_id: gameData.id,
      p_player_id: playerId,
      p_fen: null,
      p_pgn: null,
      p_turn: null,
      p_status: 'abandoned',
      p_winner: null
    });
  };

  const claimTimeout = async (isDraw: boolean = false) => {
    if (!supabase || !gameData) return;
    if (gameData.status !== 'active') return;
    if (!gameData.initial_time_ms) return;

    try {
      const { error } = await supabase.rpc('claim_timeout', {
        p_game_id: gameData.id,
        p_is_draw: isDraw
      });
      if (error) {
        console.warn('Timeout claim rejected:', error.message);
      }
    } catch (err) {
      console.error('Failed to claim timeout:', err);
    }
  };

  const rematchGame = async () => {
    if (!supabase || !gameData) return;
    try {
      await supabase.rpc('rematch_link_game', {
        p_game_id: gameData.id,
        p_player_id: playerId
      });
    } catch (err) {
      console.error('Failed to rematch game:', err);
    }
  };

  const offerRematch = async () => {
    if (!supabase || !gameData) return;
    try {
      await supabase.rpc('offer_rematch', {
        p_game_id: gameData.id,
        p_player_id: playerId
      });
    } catch (err) {
      console.error('Failed to offer rematch:', err);
    }
  };

  const declineRematch = async () => {
    if (!supabase || !gameData) return;
    try {
      await supabase.rpc('decline_rematch', {
        p_game_id: gameData.id,
        p_player_id: playerId
      });
    } catch (err) {
      console.error('Failed to decline rematch:', err);
    }
  };

  const offerDraw = async () => {
    if (!supabase || !gameData) return;
    if (gameData.status !== 'active') return;
    
    // We must use an RPC because direct updates are blocked by RLS
    const { error } = await supabase.rpc('offer_draw', {
      p_game_id: gameData.id,
      p_player_id: playerId
    });
      
    if (error) console.error("Failed to offer draw:", error);
  };

  const acceptDraw = async () => {
    if (!supabase || !gameData) return;
    if (gameData.status !== 'active') return;
    
    const updates: Partial<LinkGame> = {
      status: 'completed',
      winner: null,
      draw_offer_by: null,
      updated_at: new Date().toISOString()
    };
    
    setGameData({ ...gameData, ...updates } as LinkGame);
    
    // Use RPC for standard status update, plus we must update draw_offer_by
    await supabase.rpc('update_link_game', {
      p_game_id: gameData.id,
      p_player_id: playerId,
      p_fen: gameData.fen,
      p_pgn: gameData.pgn,
      p_turn: gameData.current_turn,
      p_status: 'completed',
      p_winner: null
    });
    
    // Clear draw offer flag
    await supabase.from('link_games').update({ draw_offer_by: null }).eq('id', gameData.id);
  };

  const declineDraw = async () => {
    if (!supabase || !gameData) return;
    
    const { error } = await supabase.rpc('decline_draw', {
      p_game_id: gameData.id,
      p_player_id: playerId
    });
      
    if (error) console.error("Failed to decline draw:", error);
  };

  return {
    gameData,
    fen,
    chess,
    error,
    loading,
    makeMove,
    joinGame,
    resign,
    cancelGame,
    abortGame,
    claimTimeout,
    rematchGame,
    offerRematch,
    declineRematch,
    offerDraw,
    acceptDraw,
    declineDraw,
    playerId,
    isConnected,
    isReconnecting
  };
}
