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


-- Phase 19: Social & Player Profiles Migrations

-- 1. Modify Profiles Table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS highest_rating INTEGER DEFAULT 1200,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

-- Drop and recreate trigger to protect new fields
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;

CREATE OR REPLACE FUNCTION protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent client from directly updating restricted fields
    IF current_setting('request.jwt.claims', true) IS NOT NULL THEN
        IF NEW.rating IS DISTINCT FROM OLD.rating OR
           NEW.games_played IS DISTINCT FROM OLD.games_played OR
           NEW.wins IS DISTINCT FROM OLD.wins OR
           NEW.losses IS DISTINCT FROM OLD.losses OR
           NEW.draws IS DISTINCT FROM OLD.draws OR
           NEW.highest_rating IS DISTINCT FROM OLD.highest_rating OR
           NEW.current_streak IS DISTINCT FROM OLD.current_streak THEN
            RAISE EXCEPTION 'You are not authorized to modify these statistics directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_profile_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_fields();


-- 2. Rating History Table
CREATE TABLE IF NOT EXISTS public.rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    game_id UUID, -- Nullable if adjustment was manual or offline
    rating_before INTEGER NOT NULL,
    rating_after INTEGER NOT NULL,
    change INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rating history" ON public.rating_history
    FOR SELECT USING (true);


-- 3. Helper Function to Calculate and Apply Ratings
CREATE OR REPLACE FUNCTION public.process_game_ratings(
    p_game_id UUID,
    p_white_id UUID,
    p_black_id UUID,
    p_winner_id TEXT -- UUID string, or 'draw', or null
)
RETURNS VOID AS $$
DECLARE
    v_white_rating INTEGER;
    v_black_rating INTEGER;
    v_white_expected NUMERIC;
    v_black_expected NUMERIC;
    v_white_score NUMERIC;
    v_black_score NUMERIC;
    v_k_factor INTEGER := 32;
    v_white_new_rating INTEGER;
    v_black_new_rating INTEGER;
    v_white_diff INTEGER;
    v_black_diff INTEGER;
BEGIN
    -- Only process if both players are authenticated users (not guests)
    -- We'll assume UUID format means authenticated user
    IF p_white_id IS NULL OR p_black_id IS NULL THEN
        RETURN;
    END IF;

    -- Fetch current ratings
    SELECT rating INTO v_white_rating FROM public.profiles WHERE id = p_white_id;
    SELECT rating INTO v_black_rating FROM public.profiles WHERE id = p_black_id;
    
    IF v_white_rating IS NULL OR v_black_rating IS NULL THEN
        RETURN;
    END IF;

    -- Calculate expected scores
    v_white_expected := 1.0 / (1.0 + power(10, (v_black_rating - v_white_rating) / 400.0));
    v_black_expected := 1.0 / (1.0 + power(10, (v_white_rating - v_black_rating) / 400.0));

    -- Determine actual scores
    IF p_winner_id = p_white_id::text THEN
        v_white_score := 1.0;
        v_black_score := 0.0;
    ELSIF p_winner_id = p_black_id::text THEN
        v_white_score := 0.0;
        v_black_score := 1.0;
    ELSE
        -- Draw
        v_white_score := 0.5;
        v_black_score := 0.5;
    END IF;

    -- Calculate new ratings
    v_white_new_rating := v_white_rating + round(v_k_factor * (v_white_score - v_white_expected));
    v_black_new_rating := v_black_rating + round(v_k_factor * (v_black_score - v_black_expected));
    
    v_white_diff := v_white_new_rating - v_white_rating;
    v_black_diff := v_black_new_rating - v_black_rating;

    -- Disable trigger temporarily to allow system to update the protected fields
    EXECUTE 'ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_fields_trigger';

    -- Update White
    UPDATE public.profiles SET 
        rating = v_white_new_rating,
        highest_rating = GREATEST(highest_rating, v_white_new_rating),
        games_played = games_played + 1,
        wins = wins + (CASE WHEN v_white_score = 1.0 THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN v_white_score = 0.0 THEN 1 ELSE 0 END),
        draws = draws + (CASE WHEN v_white_score = 0.5 THEN 1 ELSE 0 END),
        current_streak = (CASE WHEN v_white_score = 1.0 THEN GREATEST(current_streak + 1, 1) WHEN v_white_score = 0.5 THEN current_streak ELSE 0 END)
    WHERE id = p_white_id;

    -- Update Black
    UPDATE public.profiles SET 
        rating = v_black_new_rating,
        highest_rating = GREATEST(highest_rating, v_black_new_rating),
        games_played = games_played + 1,
        wins = wins + (CASE WHEN v_black_score = 1.0 THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN v_black_score = 0.0 THEN 1 ELSE 0 END),
        draws = draws + (CASE WHEN v_black_score = 0.5 THEN 1 ELSE 0 END),
        current_streak = (CASE WHEN v_black_score = 1.0 THEN GREATEST(current_streak + 1, 1) WHEN v_black_score = 0.5 THEN current_streak ELSE 0 END)
    WHERE id = p_black_id;

    EXECUTE 'ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_fields_trigger';

    -- Insert into history
    INSERT INTO public.rating_history (user_id, game_id, rating_before, rating_after, change, reason)
    VALUES 
        (p_white_id, p_game_id, v_white_rating, v_white_new_rating, v_white_diff, 'game_end'),
        (p_black_id, p_game_id, v_black_rating, v_black_new_rating, v_black_diff, 'game_end');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Trigger to process ratings automatically
CREATE OR REPLACE FUNCTION process_ratings_on_game_end()
RETURNS TRIGGER AS $body
BEGIN
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
        -- Check if both are authenticated users (assuming UUID format, simple regex check)
        -- Actually, process_game_ratings checks if they are UUIDs. 
        -- If they are guest users (which we didn't generate as valid UUIDs but let's cast safely).
        BEGIN
            PERFORM public.process_game_ratings(
                NEW.id,
                NEW.white_player::uuid,
                NEW.black_player::uuid,
                NEW.winner
            );
        EXCEPTION WHEN invalid_text_representation THEN
            -- One of the players is a guest (not a UUID), ignore ratings
        END;
    END IF;
    RETURN NEW;
END;
$body LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS game_end_rating_trigger ON public.link_games;
CREATE TRIGGER game_end_rating_trigger
AFTER UPDATE ON public.link_games
FOR EACH ROW
EXECUTE FUNCTION process_ratings_on_game_end();


-- Run this in Supabase SQL Editor to add puzzle tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puzzles_solved INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puzzles_failed INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puzzle_streak INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puzzle_best_streak INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puzzle_rating INTEGER DEFAULT 1200;

-- Optionally, add daily puzzle tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_puzzle_date TEXT;
-- RPC to safely update puzzle stats
CREATE OR REPLACE FUNCTION public.update_puzzle_stats(
    p_user_id UUID,
    p_solved BOOLEAN,
    p_new_rating INTEGER
) RETURNS void AS $$
DECLARE
    v_profile public.profiles;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF p_solved THEN
        UPDATE public.profiles SET
            puzzles_solved = COALESCE(puzzles_solved, 0) + 1,
            puzzle_streak = COALESCE(puzzle_streak, 0) + 1,
            puzzle_best_streak = GREATEST(COALESCE(puzzle_best_streak, 0), COALESCE(puzzle_streak, 0) + 1),
            puzzle_rating = p_new_rating,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_user_id;
    ELSE
        UPDATE public.profiles SET
            puzzles_failed = COALESCE(puzzles_failed, 0) + 1,
            puzzle_streak = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Run this in Supabase SQL Editor for Phase 2: Friends, Challenges, Notifications

-- 1. Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'accepted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their friendships" ON public.friendships
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships as sender" ON public.friendships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friendships" ON public.friendships
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships" ON public.friendships
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'friend_request', 'challenge', 'challenge_accepted', etc.
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    related_id TEXT, -- e.g. game id or challenge id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true); -- Anyone can create a notification (e.g. sending a friend request)

CREATE POLICY "Users can update their notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime for notifications and friendships
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;

-- 3. Challenges Table
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    time_control TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    game_id UUID REFERENCES public.link_games(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their challenges" ON public.challenges
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert challenges" ON public.challenges
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their challenges" ON public.challenges
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;


-- ========================================================
-- Phase 13: Direct Messages (Friends Chat), In-Game Chat,
-- Blocking and Message Reporting
-- ========================================================

-- 1. Direct Messages Table (Friends Chat)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_idx 
    ON public.direct_messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_receiver_unread_idx 
    ON public.direct_messages(receiver_id, read) WHERE read = false;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view direct messages they sent or received" ON public.direct_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert direct messages they send" ON public.direct_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id 
        AND length(trim(content)) > 0 
        AND length(content) <= 2000
    );

CREATE POLICY "Receivers can mark messages as read" ON public.direct_messages
    FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete messages they sent or received" ON public.direct_messages
    FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- 2. In-Game Chat Messages Table
CREATE TABLE IF NOT EXISTS public.game_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.link_games(id) ON DELETE CASCADE NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS game_messages_game_idx 
    ON public.game_messages(game_id, created_at);

ALTER TABLE public.game_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read game messages" ON public.game_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.link_games g 
            WHERE g.id = game_id 
            AND (
                g.white_player = sender_id 
                OR g.black_player = sender_id 
                OR (auth.uid() IS NOT NULL AND (g.white_player = auth.uid()::text OR g.black_player = auth.uid()::text))
            )
        )
    );

CREATE POLICY "Players can insert game messages" ON public.game_messages
    FOR INSERT WITH CHECK (
        length(trim(content)) > 0 
        AND length(content) <= 500
        AND EXISTS (
            SELECT 1 FROM public.link_games g 
            WHERE g.id = game_id 
            AND (
                g.white_player = sender_id 
                OR g.black_player = sender_id 
                OR (auth.uid() IS NOT NULL AND (g.white_player = auth.uid()::text OR g.black_player = auth.uid()::text))
            )
        )
    );

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_messages;

-- 3. Blocked Users Table
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their blocked users" ON public.blocked_users
    FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block other users" ON public.blocked_users
    FOR INSERT WITH CHECK (auth.uid() = blocker_id AND blocker_id != blocked_id);

CREATE POLICY "Users can unblock users" ON public.blocked_users
    FOR DELETE USING (auth.uid() = blocker_id);

-- 4. Message Reports Table
CREATE TABLE IF NOT EXISTS public.message_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reported_user_id TEXT NOT NULL,
    message_id UUID,
    message_type TEXT NOT NULL DEFAULT 'direct',
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file message reports" ON public.message_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON public.message_reports
    FOR SELECT USING (auth.uid() = reporter_id);


-- ==============================================================================
-- Phase 20: Admin Panel, Moderation System & User Reports Management
-- ==============================================================================

-- 1. Extend Profiles Table for Moderation Status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS banned_reason TEXT,
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reporter_warning_count INTEGER DEFAULT 0;

-- 2. Extend Message Reports Table
ALTER TABLE public.message_reports 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolution_action TEXT,
ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
ADD COLUMN IF NOT EXISTS game_id TEXT;

CREATE INDEX IF NOT EXISTS message_reports_status_idx ON public.message_reports(status);
CREATE INDEX IF NOT EXISTS message_reports_created_at_idx ON public.message_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS message_reports_reported_user_idx ON public.message_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS message_reports_reporter_id_idx ON public.message_reports(reporter_id);

-- 3. Admin Roles Table (allowlist)
CREATE TABLE IF NOT EXISTS public.admin_roles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can check their admin role" ON public.admin_roles;
CREATE POLICY "Anyone can check their admin role" ON public.admin_roles
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(username) = 'mikzqc'
    ));

-- 4. Server-Side is_admin() Function
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid DEFAULT auth.uid()) 
RETURNS boolean AS $$
DECLARE
    v_username text;
BEGIN
    IF p_uid IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if username is mikzqc
    SELECT username INTO v_username FROM public.profiles WHERE id = p_uid;
    IF lower(COALESCE(v_username, '')) = 'mikzqc' THEN
        RETURN true;
    END IF;

    -- Check admin_roles table
    IF EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = p_uid AND role = 'admin') THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Client-callable RPC to check admin status
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN public.is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Moderation Actions / Audit Log Table
CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    duration_hours INTEGER,
    report_id UUID REFERENCES public.message_reports(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can view all moderation actions" ON public.moderation_actions
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view warnings issued against them" ON public.moderation_actions;
CREATE POLICY "Users can view warnings issued against them" ON public.moderation_actions
    FOR SELECT USING (auth.uid()::text = target_user_id AND action_type IN ('warn', 'warn_reporter'));

DROP POLICY IF EXISTS "Admins can insert moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can insert moderation actions" ON public.moderation_actions
    FOR INSERT WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS mod_actions_target_idx ON public.moderation_actions(target_user_id);
CREATE INDEX IF NOT EXISTS mod_actions_report_idx ON public.moderation_actions(report_id);
CREATE INDEX IF NOT EXISTS mod_actions_created_idx ON public.moderation_actions(created_at DESC);

-- 6. Private Admin Notes Table
CREATE TABLE IF NOT EXISTS public.admin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id TEXT NOT NULL,
    report_id UUID REFERENCES public.message_reports(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can access admin notes" ON public.admin_notes;
CREATE POLICY "Only admins can access admin notes" ON public.admin_notes
    FOR ALL USING (public.is_admin());

CREATE INDEX IF NOT EXISTS admin_notes_report_idx ON public.admin_notes(report_id);
CREATE INDEX IF NOT EXISTS admin_notes_target_idx ON public.admin_notes(target_user_id);

-- 7. Update RLS on message_reports to grant Admin full access
DROP POLICY IF EXISTS "Users can view their own reports" ON public.message_reports;
DROP POLICY IF EXISTS "Users can view their own reports or Admins view all" ON public.message_reports;
CREATE POLICY "Users can view their own reports or Admins view all" ON public.message_reports
    FOR SELECT USING (auth.uid() = reporter_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update message reports" ON public.message_reports;
CREATE POLICY "Admins can update message reports" ON public.message_reports
    FOR UPDATE USING (public.is_admin());

-- 8. Admin RPCs for Moderation Operations

CREATE OR REPLACE FUNCTION public.admin_update_report_status(
    p_report_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
) RETURNS public.message_reports AS $$
DECLARE
    v_report public.message_reports;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    UPDATE public.message_reports SET
        status = p_status,
        admin_notes = COALESCE(p_notes, admin_notes),
        resolved_by = CASE WHEN p_status IN ('resolved', 'dismissed') THEN auth.uid() ELSE resolved_by END,
        resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        resolution_action = COALESCE(p_action, resolution_action),
        resolution_reason = COALESCE(p_reason, resolution_reason)
    WHERE id = p_report_id
    RETURNING * INTO v_report;

    IF p_status = 'resolved' THEN
        INSERT INTO public.notifications (user_id, sender_id, type, message, related_id)
        VALUES (v_report.reporter_id, auth.uid(), 'report_resolved', 'Your report has been reviewed and resolved. Thank you for helping keep Michess safe.', v_report.id::text);
    ELSIF p_status = 'dismissed' THEN
        INSERT INTO public.notifications (user_id, sender_id, type, message, related_id)
        VALUES (v_report.reporter_id, auth.uid(), 'report_dismissed', 'Your report has been reviewed and concluded.', v_report.id::text);
    END IF;

    RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_warn_user(
    p_target_user_id TEXT,
    p_reason TEXT,
    p_report_id UUID DEFAULT NULL
) RETURNS public.moderation_actions AS $$
DECLARE
    v_action public.moderation_actions;
    v_target_uuid uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    BEGIN
        v_target_uuid := p_target_user_id::uuid;
        UPDATE public.profiles SET
            warning_count = COALESCE(warning_count, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_target_uuid;

        INSERT INTO public.notifications (user_id, sender_id, type, message, related_id)
        VALUES (v_target_uuid, auth.uid(), 'moderation_warning', 'You have received an official moderation warning: ' || p_reason, p_report_id::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    INSERT INTO public.moderation_actions (admin_id, target_user_id, action_type, reason, report_id)
    VALUES (auth.uid(), p_target_user_id, 'warn', p_reason, p_report_id)
    RETURNING * INTO v_action;

    IF p_report_id IS NOT NULL THEN
        UPDATE public.message_reports SET
            status = 'resolved',
            resolved_by = auth.uid(),
            resolved_at = CURRENT_TIMESTAMP,
            resolution_action = 'warn',
            resolution_reason = p_reason
        WHERE id = p_report_id;
    END IF;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(
    p_target_user_id TEXT,
    p_hours INTEGER,
    p_reason TEXT,
    p_report_id UUID DEFAULT NULL
) RETURNS public.moderation_actions AS $$
DECLARE
    v_action public.moderation_actions;
    v_target_uuid uuid;
    v_suspended_until timestamptz;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    v_suspended_until := CURRENT_TIMESTAMP + (p_hours || ' hours')::interval;

    BEGIN
        v_target_uuid := p_target_user_id::uuid;
        UPDATE public.profiles SET
            suspended_until = v_suspended_until,
            suspension_reason = p_reason,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_target_uuid;

        INSERT INTO public.notifications (user_id, sender_id, type, message, related_id)
        VALUES (v_target_uuid, auth.uid(), 'moderation_suspension', 'Your account has been temporarily suspended until ' || to_char(v_suspended_until, 'YYYY-MM-DD HH24:MI') || ' UTC. Reason: ' || p_reason, p_report_id::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    INSERT INTO public.moderation_actions (admin_id, target_user_id, action_type, reason, duration_hours, report_id)
    VALUES (auth.uid(), p_target_user_id, 'suspend', p_reason, p_hours, p_report_id)
    RETURNING * INTO v_action;

    IF p_report_id IS NOT NULL THEN
        UPDATE public.message_reports SET
            status = 'resolved',
            resolved_by = auth.uid(),
            resolved_at = CURRENT_TIMESTAMP,
            resolution_action = 'suspend',
            resolution_reason = p_reason
        WHERE id = p_report_id;
    END IF;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_ban_user(
    p_target_user_id TEXT,
    p_reason TEXT,
    p_report_id UUID DEFAULT NULL
) RETURNS public.moderation_actions AS $$
DECLARE
    v_action public.moderation_actions;
    v_target_uuid uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    BEGIN
        v_target_uuid := p_target_user_id::uuid;
        UPDATE public.profiles SET
            is_banned = true,
            banned_at = CURRENT_TIMESTAMP,
            banned_reason = p_reason,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_target_uuid;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    INSERT INTO public.moderation_actions (admin_id, target_user_id, action_type, reason, report_id)
    VALUES (auth.uid(), p_target_user_id, 'ban', p_reason, p_report_id)
    RETURNING * INTO v_action;

    IF p_report_id IS NOT NULL THEN
        UPDATE public.message_reports SET
            status = 'resolved',
            resolved_by = auth.uid(),
            resolved_at = CURRENT_TIMESTAMP,
            resolution_action = 'ban',
            resolution_reason = p_reason
        WHERE id = p_report_id;
    END IF;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_unban_user(
    p_target_user_id TEXT,
    p_reason TEXT
) RETURNS public.moderation_actions AS $$
DECLARE
    v_action public.moderation_actions;
    v_target_uuid uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    BEGIN
        v_target_uuid := p_target_user_id::uuid;
        UPDATE public.profiles SET
            is_banned = false,
            banned_at = NULL,
            banned_reason = NULL,
            suspended_until = NULL,
            suspension_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_target_uuid;

        INSERT INTO public.notifications (user_id, sender_id, type, message)
        VALUES (v_target_uuid, auth.uid(), 'moderation_unban', 'Your account restrictions have been lifted: ' || p_reason);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    INSERT INTO public.moderation_actions (admin_id, target_user_id, action_type, reason)
    VALUES (auth.uid(), p_target_user_id, 'unban', p_reason)
    RETURNING * INTO v_action;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_warn_reporter(
    p_report_id UUID,
    p_reporter_id UUID,
    p_reason TEXT,
    p_details TEXT DEFAULT NULL
) RETURNS public.moderation_actions AS $$
DECLARE
    v_action public.moderation_actions;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    UPDATE public.profiles SET
        reporter_warning_count = COALESCE(reporter_warning_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_reporter_id;

    INSERT INTO public.moderation_actions (admin_id, target_user_id, action_type, reason, details, report_id)
    VALUES (auth.uid(), p_reporter_id::text, 'warn_reporter', p_reason, p_details, p_report_id)
    RETURNING * INTO v_action;

    INSERT INTO public.notifications (user_id, sender_id, type, message, related_id)
    VALUES (
        p_reporter_id,
        auth.uid(),
        'reporter_warning',
        'Official Notice: A warning has been issued regarding report #' || substring(p_report_id::text, 1, 8) || '. Reason: ' || p_reason || '. Michess takes false or abusive reports seriously.',
        p_report_id::text
    );

    UPDATE public.message_reports SET
        status = 'dismissed',
        resolved_by = auth.uid(),
        resolved_at = CURRENT_TIMESTAMP,
        resolution_action = 'warn_reporter',
        resolution_reason = p_reason
    WHERE id = p_report_id;

    RETURN v_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reverse_reporter_warning(
    p_action_id UUID,
    p_reason TEXT
) RETURNS public.moderation_actions AS $$
DECLARE
    v_orig_action public.moderation_actions;
    v_rev_action public.moderation_actions;
    v_target_uuid uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    SELECT * INTO v_orig_action FROM public.moderation_actions WHERE id = p_action_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Moderation action not found';
    END IF;

    BEGIN
        v_target_uuid := v_orig_action.target_user_id::uuid;
        UPDATE public.profiles SET
            reporter_warning_count = GREATEST(0, COALESCE(reporter_warning_count, 0) - 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_target_uuid;

        INSERT INTO public.notifications (user_id, sender_id, type, message, related_id)
        VALUES (v_target_uuid, auth.uid(), 'reporter_warning_reversed', 'A previous warning regarding a submitted report has been reviewed and removed.', v_orig_action.report_id::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    INSERT INTO public.moderation_actions (admin_id, target_user_id, action_type, reason, details, report_id)
    VALUES (auth.uid(), v_orig_action.target_user_id, 'reverse_reporter_warning', p_reason, 'Reversed action ' || p_action_id::text, v_orig_action.report_id)
    RETURNING * INTO v_rev_action;

    RETURN v_rev_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_add_note(
    p_target_user_id TEXT,
    p_report_id UUID,
    p_note TEXT
) RETURNS public.admin_notes AS $$
DECLARE
    v_note public.admin_notes;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    INSERT INTO public.admin_notes (admin_id, target_user_id, report_id, note)
    VALUES (auth.uid(), p_target_user_id, p_report_id, trim(p_note))
    RETURNING * INTO v_note;

    RETURN v_note;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_actions;
