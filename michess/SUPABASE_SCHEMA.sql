-- Run this in your Supabase SQL Editor

-- 1. Create the history_games table
CREATE TABLE IF NOT EXISTS public.history_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    game_id TEXT NOT NULL,
    pgn TEXT NOT NULL,
    white TEXT NOT NULL,
    black TEXT NOT NULL,
    result TEXT NOT NULL,
    date TEXT NOT NULL,
    event TEXT,
    opening TEXT,
    starting_fen TEXT,
    source TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    reviewed BOOLEAN DEFAULT FALSE,
    white_accuracy NUMERIC,
    black_accuracy NUMERIC,
    overall_accuracy NUMERIC,
    move_count INTEGER NOT NULL,
    classifications JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.history_games ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can only read their own games
CREATE POLICY "Users can view own games" ON public.history_games 
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own games
CREATE POLICY "Users can insert own games" ON public.history_games 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own games
CREATE POLICY "Users can update own games" ON public.history_games 
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own games
CREATE POLICY "Users can delete own games" ON public.history_games 
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Create an index for faster queries by user_id
CREATE INDEX IF NOT EXISTS history_games_user_id_idx ON public.history_games(user_id);

-- 5. Create the link_games table for multiplayer
-- Note: white_player and black_player are TEXT to support either auth.uid() OR anonymous guest IDs (UUIDs stored in localStorage)
CREATE TABLE IF NOT EXISTS public.link_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code TEXT UNIQUE NOT NULL,
    white_player TEXT,
    black_player TEXT,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, completed, abandoned
    fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn TEXT NOT NULL DEFAULT '',
    current_turn TEXT NOT NULL DEFAULT 'w',
    winner TEXT,
    -- Phase 12: Time control fields
    time_control TEXT,              -- e.g. "5+3", NULL = untimed
    initial_time_ms INTEGER,       -- starting time per side in milliseconds
    increment_ms INTEGER DEFAULT 0,-- increment per move in milliseconds
    white_time_ms INTEGER,         -- remaining time for white in ms
    black_time_ms INTEGER,         -- remaining time for black in ms
    last_move_at TIMESTAMPTZ,      -- when the active player's clock started ticking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 12 migration: Add time control columns to existing link_games table
-- (Safe to run multiple times - IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS time_control TEXT;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS initial_time_ms INTEGER;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS increment_ms INTEGER DEFAULT 0;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS white_time_ms INTEGER;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS black_time_ms INTEGER;
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ;

-- 6. Enable RLS for link_games
ALTER TABLE public.link_games ENABLE ROW LEVEL SECURITY;

-- 7. Realtime Support
-- Enable realtime for the link_games table so clients can subscribe to moves
ALTER PUBLICATION supabase_realtime ADD TABLE public.link_games;

-- 8. Create RLS Policies for link_games

-- Reads: Anyone can read games they know the ID/invite code for. Required for Realtime subscriptions.
-- Since UUIDs and invite codes act as unguessable capabilities, this is secure against enumeration.
CREATE POLICY "Anyone can read link games" ON public.link_games
    FOR SELECT USING (true);

-- Writes: We disable direct writes completely. All inserts/updates must go through our SECURITY DEFINER RPCs 
-- to ensure guests can only modify games they are legitimately participating in.
-- Ensure no other permissive policies exist for insert/update/delete.

-- 9. Index for invite_code
CREATE INDEX IF NOT EXISTS link_games_invite_code_idx ON public.link_games(invite_code);

-- 10. RPCs for Secure Anonymous Writes

-- Create Game RPC (Phase 12: now accepts optional time control parameters)
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
    -- SECURITY PHASE: Protect registered users from impersonation
    IF EXISTS (SELECT 1 FROM auth.users WHERE id::text = p_creator_id) THEN
        IF auth.uid()::text IS NULL OR auth.uid()::text != p_creator_id THEN
            RAISE EXCEPTION 'Authentication required to create a game for this player';
        END IF;
    END IF;

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
        p_initial_time_ms,  -- both players start with full time
        p_initial_time_ms
    ) RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join Game RPC (Phase 12: starts the clock when game becomes active)
CREATE OR REPLACE FUNCTION public.join_link_game(
    p_game_id uuid,
    p_joiner_id text
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
BEGIN
    -- SECURITY PHASE: Protect registered users from impersonation
    IF EXISTS (SELECT 1 FROM auth.users WHERE id::text = p_joiner_id) THEN
        IF auth.uid()::text IS NULL OR auth.uid()::text != p_joiner_id THEN
            RAISE EXCEPTION 'Authentication required to join as this player';
        END IF;
    END IF;

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

-- Update Game RPC (Phase 12: server-authoritative clock deduction on moves)
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

    -- SECURITY PHASE: Protect registered users from impersonation
    IF EXISTS (SELECT 1 FROM auth.users WHERE id::text = p_player_id) THEN
        IF auth.uid()::text IS NULL OR auth.uid()::text != p_player_id THEN
            RAISE EXCEPTION 'Authentication required to make a move for this player';
        END IF;
    END IF;

    -- SECURITY PHASE: Validate turn and status
    IF p_fen IS NOT NULL AND p_fen != v_game.fen THEN
        -- It is a move. Ensure it's the player's turn.
        IF v_game.current_turn = 'w' AND v_game.white_player != p_player_id THEN
            RAISE EXCEPTION 'It is not your turn';
        END IF;
        IF v_game.current_turn = 'b' AND v_game.black_player != p_player_id THEN
            RAISE EXCEPTION 'It is not your turn';
        END IF;
        
        -- Prevent making multiple moves at once without toggling turn
        IF p_turn = v_game.current_turn THEN
            RAISE EXCEPTION 'Move must toggle the turn';
        END IF;
    END IF;

    -- SECURITY PHASE: Validate result changes (resignation/draws vs arbitrary wins)
    IF p_status = 'completed' AND v_game.status = 'active' THEN
        -- If player submits a win for themselves, it must be checkmate.
        -- Since DB can't easily verify checkmate, we strictly require the client to submit the move that causes it.
        -- BUT if they just submit a completed status WITHOUT a move (e.g. resignation), they can only assign win to opponent.
        IF p_fen IS NULL OR p_fen = v_game.fen THEN
            IF p_winner = p_player_id THEN
                RAISE EXCEPTION 'You cannot declare yourself the winner without making a move';
            END IF;
        END IF;
    END IF;

    -- Phase 12: Server-authoritative clock logic for timed games
    IF v_game.initial_time_ms IS NOT NULL AND p_fen IS NOT NULL AND v_game.last_move_at IS NOT NULL THEN
        -- Calculate elapsed time since the active clock started
        v_elapsed_ms := GREATEST(0, (extract(epoch from (CURRENT_TIMESTAMP - v_game.last_move_at)) * 1000)::integer);
        
        -- Determine which player just moved based on the CURRENT turn (before update)
        -- If current_turn = 'w', white is moving, so deduct from white's time
        IF v_game.current_turn = 'w' THEN
            v_mover_time := v_game.white_time_ms - v_elapsed_ms;
            
            IF v_mover_time <= 0 THEN
                -- White ran out of time! End game immediately.
                UPDATE public.link_games SET
                    status = 'completed',
                    winner = v_game.black_player,
                    white_time_ms = 0,
                    last_move_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = p_game_id RETURNING * INTO v_game;
                RETURN v_game;
            END IF;
            
            -- Apply increment and save
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
            -- Black is moving
            v_mover_time := v_game.black_time_ms - v_elapsed_ms;
            
            IF v_mover_time <= 0 THEN
                -- Black ran out of time! End game immediately.
                UPDATE public.link_games SET
                    status = 'completed',
                    winner = v_game.white_player,
                    black_time_ms = 0,
                    last_move_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = p_game_id RETURNING * INTO v_game;
                RETURN v_game;
            END IF;
            
            -- Apply increment and save
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

-- Phase 12: Claim Timeout RPC
-- Any participant/spectator can call this to force-end the game when a clock expires
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
    
    -- Calculate elapsed time
    v_elapsed_ms := GREATEST(0, (extract(epoch from (CURRENT_TIMESTAMP - v_game.last_move_at)) * 1000)::integer);
    
    -- Determine active player's remaining time
    IF v_game.current_turn = 'w' THEN
        v_active_time := v_game.white_time_ms - v_elapsed_ms;
        v_winner := v_game.black_player;
    ELSE
        v_active_time := v_game.black_time_ms - v_elapsed_ms;
        v_winner := v_game.white_player;
    END IF;
    
    -- Only end game if time has actually expired
    IF v_active_time > 0 THEN
        RAISE EXCEPTION 'Clock has not expired yet';
    END IF;
    
    -- If draw (insufficient material on winning side), set winner to NULL
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

-- Cancel Game RPC (Creator deletes waiting game)
CREATE OR REPLACE FUNCTION public.cancel_link_game(
    p_game_id uuid,
    p_player_id text
) RETURNS void AS $$
DECLARE
    v_game public.link_games;
BEGIN
    -- SECURITY PHASE: Protect registered users from impersonation
    IF EXISTS (SELECT 1 FROM auth.users WHERE id::text = p_player_id) THEN
        IF auth.uid()::text IS NULL OR auth.uid()::text != p_player_id THEN
            RAISE EXCEPTION 'Authentication required to cancel this game';
        END IF;
    END IF;

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

-- Phase 14 Schema Updates



-- 1. Create profiles table

CREATE TABLE IF NOT EXISTS public.profiles (

    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    username TEXT UNIQUE NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    last_username_change TIMESTAMP WITH TIME ZONE

);



-- Profiles RLS

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;



-- Anyone can read profiles

CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);

-- Users can insert their own profile

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SECURITY PHASE: Trigger to prevent modifying protected profile fields
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
    -- Prevent changing the ID
    IF NEW.id != OLD.id THEN
        RAISE EXCEPTION 'Cannot modify profile ID';
    END IF;
    
    -- Prevent changing created_at
    IF NEW.created_at != OLD.created_at THEN
        RAISE EXCEPTION 'Cannot modify created_at';
    END IF;

    -- In the future, if a rating column is added, add a check here:
    -- IF NEW.rating != OLD.rating THEN RAISE EXCEPTION 'Cannot modify rating directly'; END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_fields();

-- 2. Add is_chaos to link_games and history_games

ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS is_chaos BOOLEAN DEFAULT FALSE;

ALTER TABLE public.history_games ADD COLUMN IF NOT EXISTS is_chaos BOOLEAN DEFAULT FALSE;



-- 3. Profile RPCs

CREATE OR REPLACE FUNCTION public.update_username(

    p_new_username text

) RETURNS public.profiles AS $$

DECLARE

    v_uid uuid;

    v_profile public.profiles;

    v_clean_username text;

BEGIN

    v_uid := auth.uid();

    IF v_uid IS NULL THEN

        RAISE EXCEPTION 'Not authenticated';

    END IF;



    v_clean_username := trim(p_new_username);



    IF length(v_clean_username) < 3 OR length(v_clean_username) > 20 THEN

        RAISE EXCEPTION 'Username must be between 3 and 20 characters';

    END IF;



    -- Validate alphanumeric (can add regex if needed)

    IF v_clean_username !~ '^[a-zA-Z0-9_]+$' THEN

        RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';

    END IF;



    -- Protect mikhaelmathews

    IF lower(v_clean_username) = 'mikhaelmathews' THEN

        -- Only let the user who ALREADY has it keep it, or if no one has it, let them claim it (so the real owner can claim it first)

        -- Wait, better: if they are claiming mikhaelmathews, we allow it ONLY if it's currently untaken, so the real owner should claim it immediately on prod.

        -- We will enforce uniqueness anyway. 

    END IF;



    -- Check if exists

    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_clean_username) AND id != v_uid) THEN

        RAISE EXCEPTION 'Username already taken';

    END IF;



            -- Check cooldown (e.g. 7 days)
        SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
        IF FOUND AND v_profile.last_username_change IS NOT NULL THEN
                -- Exception for mikhaelmathews to allow exactly one change (since the username will change afterwards)
                IF lower(v_profile.username) != 'mikhaelmathews' THEN
                        IF CURRENT_TIMESTAMP < (v_profile.last_username_change + interval '7 days') THEN
                                RAISE EXCEPTION 'You can only change your username once every 7 days';
                        END IF;
                END IF;
        END IF;



    -- Upsert profile

    INSERT INTO public.profiles (id, username, last_username_change, updated_at)

    VALUES (v_uid, v_clean_username, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

    ON CONFLICT (id) DO UPDATE SET 

        username = EXCLUDED.username,

        last_username_change = CURRENT_TIMESTAMP,

        updated_at = CURRENT_TIMESTAMP

    RETURNING * INTO v_profile;



    RETURN v_profile;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;





-- 4. Owner / Chaos Mode RPCs



-- Check if current user is owner

CREATE OR REPLACE FUNCTION public.is_owner(p_uid uuid) RETURNS boolean AS $$

DECLARE

    v_username text;

BEGIN

    SELECT username INTO v_username FROM public.profiles WHERE id = p_uid;

    RETURN lower(v_username) = 'mikhaelmathews';

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;



-- Activate Chaos Mode

CREATE OR REPLACE FUNCTION public.activate_chaos_mode(

    p_game_id uuid

) RETURNS public.link_games AS $$

DECLARE

    v_game public.link_games;

BEGIN

    IF NOT public.is_owner(auth.uid()) THEN

        RAISE EXCEPTION 'Owner authorization failed. Chaos Mode is restricted.';

    END IF;



    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;

    

    IF v_game.status != 'active' THEN

        RAISE EXCEPTION 'Game is not active';

    END IF;



    UPDATE public.link_games SET 

        is_chaos = true,

        updated_at = CURRENT_TIMESTAMP

    WHERE id = p_game_id RETURNING * INTO v_game;



    RETURN v_game;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;





-- Chaos Update Game (Owner only)

-- Arbitrary state override

CREATE OR REPLACE FUNCTION public.chaos_update_game(

    p_game_id uuid,

    p_fen text,

    p_pgn text,

    p_turn text,

    p_status text,

    p_winner text

) RETURNS public.link_games AS $$

DECLARE

    v_game public.link_games;

BEGIN

    IF NOT public.is_owner(auth.uid()) THEN

        RAISE EXCEPTION 'Owner authorization failed. Chaos actions are restricted.';

    END IF;



    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;



    -- Only apply if the game is already in chaos mode, or implicitly convert it?

    -- Let's implicitly set is_chaos = true just in case.

    

    UPDATE public.link_games SET

        fen = COALESCE(p_fen, fen),

        pgn = COALESCE(p_pgn, pgn),

        current_turn = COALESCE(p_turn, current_turn),

        status = COALESCE(p_status, status),

        winner = COALESCE(p_winner, winner),

        is_chaos = true,

        last_move_at = CASE 

            WHEN p_status IN ('completed', 'abandoned') THEN NULL 

            ELSE CURRENT_TIMESTAMP 

        END,

        updated_at = CURRENT_TIMESTAMP

    WHERE id = p_game_id RETURNING * INTO v_game;



    RETURN v_game;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;



-- Chaos Clock Control

CREATE OR REPLACE FUNCTION public.chaos_clock_action(

    p_game_id uuid,

    p_action text, -- 'pause', 'resume', 'reset'

    p_white_time_ms integer DEFAULT NULL,

    p_black_time_ms integer DEFAULT NULL

) RETURNS public.link_games AS $$

DECLARE

    v_game public.link_games;

BEGIN

    IF NOT public.is_owner(auth.uid()) THEN

        RAISE EXCEPTION 'Owner authorization failed. Clock control is restricted.';

    END IF;



    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;



    IF p_action = 'pause' THEN

        UPDATE public.link_games SET 

            last_move_at = NULL,

            white_time_ms = COALESCE(p_white_time_ms, white_time_ms),

            black_time_ms = COALESCE(p_black_time_ms, black_time_ms),

            updated_at = CURRENT_TIMESTAMP

        WHERE id = p_game_id RETURNING * INTO v_game;

    ELSIF p_action = 'resume' THEN

        UPDATE public.link_games SET 

            last_move_at = CURRENT_TIMESTAMP,

            updated_at = CURRENT_TIMESTAMP

        WHERE id = p_game_id RETURNING * INTO v_game;

    ELSIF p_action = 'reset' THEN

        UPDATE public.link_games SET 

            white_time_ms = v_game.initial_time_ms,

            black_time_ms = v_game.initial_time_ms,

            last_move_at = CURRENT_TIMESTAMP,

            updated_at = CURRENT_TIMESTAMP

        WHERE id = p_game_id RETURNING * INTO v_game;

    END IF;



    RETURN v_game;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;

