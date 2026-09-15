-- =============================================
-- Phase 12: Time Control Migration
-- Run this on your EXISTING Supabase database.
-- Safe to run multiple times.
-- =============================================

-- 1. Add time control columns to link_games
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS time_control TEXT;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS initial_time_ms INTEGER;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS increment_ms INTEGER DEFAULT 0;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS white_time_ms INTEGER;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS black_time_ms INTEGER;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ;

-- 2. Updated Create Game RPC (accepts optional time control)
CREATE OR REPLACE FUNCTION public.create_link_game(
    p_invite_code text,
    p_creator_id text,
    p_is_white boolean,
    p_time_control text DEFAULT NULL,
    p_initial_time_ms integer DEFAULT NULL,
    p_increment_ms integer DEFAULT 0
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
BEGIN
    INSERT INTO public.link_games (
        invite_code, 
        white_player, 
        black_player, 
        status,
        time_control,
        initial_time_ms,
        increment_ms,
        white_time_ms,
        black_time_ms
    ) VALUES (
        p_invite_code,
        CASE WHEN p_is_white THEN p_creator_id ELSE NULL END,
        CASE WHEN p_is_white THEN NULL ELSE p_creator_id END,
        'waiting',
        p_time_control,
        p_initial_time_ms,
        p_increment_ms,
        p_initial_time_ms,
        p_initial_time_ms
    ) RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Updated Join Game RPC (starts clock on join)
CREATE OR REPLACE FUNCTION public.join_link_game(
    p_game_id uuid,
    p_joiner_id text
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'waiting' THEN
        RAISE EXCEPTION 'Game is no longer waiting';
    END IF;
    
    IF v_game.white_player IS NULL AND v_game.black_player != p_joiner_id THEN
        UPDATE public.link_games SET 
            white_player = p_joiner_id, 
            status = 'active',
            last_move_at = CASE WHEN initial_time_ms IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = p_game_id RETURNING * INTO v_game;
    ELSIF v_game.black_player IS NULL AND v_game.white_player != p_joiner_id THEN
        UPDATE public.link_games SET 
            black_player = p_joiner_id, 
            status = 'active',
            last_move_at = CASE WHEN initial_time_ms IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = p_game_id RETURNING * INTO v_game;
    ELSE
        RAISE EXCEPTION 'Cannot join this game';
    END IF;

    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Updated Update Game RPC (server-authoritative clock)
CREATE OR REPLACE FUNCTION public.update_link_game(
    p_game_id uuid,
    p_player_id text,
    p_fen text,
    p_pgn text,
    p_turn text,
    p_status text,
    p_winner text
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
    v_elapsed_ms integer;
    v_mover_time integer;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'active' AND p_status != 'abandoned' THEN
        RAISE EXCEPTION 'Game is not active';
    END IF;
    
    IF COALESCE(v_game.white_player, '') != p_player_id AND COALESCE(v_game.black_player, '') != p_player_id THEN
        RAISE EXCEPTION 'You are not a participant in this game';
    END IF;

    -- Server-authoritative clock logic for timed games
    IF v_game.initial_time_ms IS NOT NULL AND p_fen IS NOT NULL AND v_game.last_move_at IS NOT NULL THEN
        v_elapsed_ms := GREATEST(0, (extract(epoch from (CURRENT_TIMESTAMP - v_game.last_move_at)) * 1000)::integer);
        
        IF v_game.current_turn = 'w' THEN
            v_mover_time := v_game.white_time_ms - v_elapsed_ms;
            
            IF v_mover_time <= 0 THEN
                UPDATE public.link_games SET
                    status = 'completed',
                    winner = v_game.black_player,
                    white_time_ms = 0,
                    last_move_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = p_game_id RETURNING * INTO v_game;
                RETURN v_game;
            END IF;
            
            UPDATE public.link_games SET
                fen = p_fen,
                pgn = COALESCE(p_pgn, pgn),
                current_turn = COALESCE(p_turn, current_turn),
                status = COALESCE(p_status, status),
                winner = COALESCE(p_winner, winner),
                white_time_ms = v_mover_time + COALESCE(v_game.increment_ms, 0),
                last_move_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_game_id RETURNING * INTO v_game;
        ELSE
            v_mover_time := v_game.black_time_ms - v_elapsed_ms;
            
            IF v_mover_time <= 0 THEN
                UPDATE public.link_games SET
                    status = 'completed',
                    winner = v_game.white_player,
                    black_time_ms = 0,
                    last_move_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = p_game_id RETURNING * INTO v_game;
                RETURN v_game;
            END IF;
            
            UPDATE public.link_games SET
                fen = p_fen,
                pgn = COALESCE(p_pgn, pgn),
                current_turn = COALESCE(p_turn, current_turn),
                status = COALESCE(p_status, status),
                winner = COALESCE(p_winner, winner),
                black_time_ms = v_mover_time + COALESCE(v_game.increment_ms, 0),
                last_move_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_game_id RETURNING * INTO v_game;
        END IF;
        
        RETURN v_game;
    END IF;

    -- Untimed game or non-move update (resignation, abandon, etc.)
    UPDATE public.link_games SET
        fen = COALESCE(p_fen, fen),
        pgn = COALESCE(p_pgn, pgn),
        current_turn = COALESCE(p_turn, current_turn),
        status = COALESCE(p_status, status),
        winner = COALESCE(p_winner, winner),
        last_move_at = CASE WHEN p_status IN ('completed', 'abandoned') THEN NULL ELSE last_move_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id RETURNING * INTO v_game;

    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. New Claim Timeout RPC
CREATE OR REPLACE FUNCTION public.claim_timeout(
    p_game_id uuid,
    p_is_draw boolean DEFAULT false
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
    v_elapsed_ms integer;
    v_active_time integer;
    v_winner text;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'active' THEN
        RAISE EXCEPTION 'Game is not active';
    END IF;
    
    IF v_game.initial_time_ms IS NULL THEN
        RAISE EXCEPTION 'Game is not timed';
    END IF;
    
    IF v_game.last_move_at IS NULL THEN
        RAISE EXCEPTION 'Clock has not started';
    END IF;
    
    v_elapsed_ms := GREATEST(0, (extract(epoch from (CURRENT_TIMESTAMP - v_game.last_move_at)) * 1000)::integer);
    
    IF v_game.current_turn = 'w' THEN
        v_active_time := v_game.white_time_ms - v_elapsed_ms;
        v_winner := v_game.black_player;
    ELSE
        v_active_time := v_game.black_time_ms - v_elapsed_ms;
        v_winner := v_game.white_player;
    END IF;
    
    IF v_active_time > 0 THEN
        RAISE EXCEPTION 'Clock has not expired yet';
    END IF;
    
    IF p_is_draw THEN
        v_winner := NULL;
    END IF;
    
    UPDATE public.link_games SET
        status = 'completed',
        winner = v_winner,
        white_time_ms = CASE WHEN current_turn = 'w' THEN 0 ELSE white_time_ms END,
        black_time_ms = CASE WHEN current_turn = 'b' THEN 0 ELSE black_time_ms END,
        last_move_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Cancel Game RPC (unchanged, re-created for completeness)
CREATE OR REPLACE FUNCTION public.cancel_link_game(
    p_game_id uuid,
    p_player_id text
) RETURNS void AS $$
DECLARE
    v_game public.link_games;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'waiting' THEN
        RAISE EXCEPTION 'Can only cancel waiting games';
    END IF;
    
    IF COALESCE(v_game.white_player, '') != p_player_id AND COALESCE(v_game.black_player, '') != p_player_id THEN
        RAISE EXCEPTION 'Only the creator can cancel this game';
    END IF;

    DELETE FROM public.link_games WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
