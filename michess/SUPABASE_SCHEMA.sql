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

- -   P h a s e   1 9 :   S o c i a l   &   P l a y e r   P r o f i l e s   M i g r a t i o n s  
  
 - -   1 .   M o d i f y   P r o f i l e s   T a b l e  
 A L T E R   T A B L E   p u b l i c . p r o f i l e s    
 A D D   C O L U M N   I F   N O T   E X I S T S   h i g h e s t _ r a t i n g   I N T E G E R   D E F A U L T   1 2 0 0 ,  
 A D D   C O L U M N   I F   N O T   E X I S T S   c u r r e n t _ s t r e a k   I N T E G E R   D E F A U L T   0 ;  
  
 - -   D r o p   a n d   r e c r e a t e   t r i g g e r   t o   p r o t e c t   n e w   f i e l d s  
 D R O P   T R I G G E R   I F   E X I S T S   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r   O N   p u b l i c . p r o f i l e s ;  
  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p r o t e c t _ p r o f i l e _ f i e l d s ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
         - -   P r e v e n t   c l i e n t   f r o m   d i r e c t l y   u p d a t i n g   r e s t r i c t e d   f i e l d s  
         I F   c u r r e n t _ s e t t i n g ( ' r e q u e s t . j w t . c l a i m s ' ,   t r u e )   I S   N O T   N U L L   T H E N  
                 I F   N E W . r a t i n g   I S   D I S T I N C T   F R O M   O L D . r a t i n g   O R  
                       N E W . g a m e s _ p l a y e d   I S   D I S T I N C T   F R O M   O L D . g a m e s _ p l a y e d   O R  
                       N E W . w i n s   I S   D I S T I N C T   F R O M   O L D . w i n s   O R  
                       N E W . l o s s e s   I S   D I S T I N C T   F R O M   O L D . l o s s e s   O R  
                       N E W . d r a w s   I S   D I S T I N C T   F R O M   O L D . d r a w s   O R  
                       N E W . h i g h e s t _ r a t i n g   I S   D I S T I N C T   F R O M   O L D . h i g h e s t _ r a t i n g   O R  
                       N E W . c u r r e n t _ s t r e a k   I S   D I S T I N C T   F R O M   O L D . c u r r e n t _ s t r e a k   T H E N  
                         R A I S E   E X C E P T I O N   ' Y o u   a r e   n o t   a u t h o r i z e d   t o   m o d i f y   t h e s e   s t a t i s t i c s   d i r e c t l y . ' ;  
                 E N D   I F ;  
         E N D   I F ;  
         R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 C R E A T E   T R I G G E R   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r  
 B E F O R E   U P D A T E   O N   p u b l i c . p r o f i l e s  
 F O R   E A C H   R O W  
 E X E C U T E   F U N C T I O N   p r o t e c t _ p r o f i l e _ f i e l d s ( ) ;  
  
  
 - -   2 .   F r i e n d s h i p s   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . f r i e n d s h i p s   (  
         u s e r _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
         f r i e n d _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
         s t a t u s   T E X T   N O T   N U L L   C H E C K   ( s t a t u s   I N   ( ' p e n d i n g ' ,   ' a c c e p t e d ' ) ) ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         P R I M A R Y   K E Y   ( u s e r _ i d ,   f r i e n d _ i d )  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . f r i e n d s h i p s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   f r i e n d s h i p s   i n v o l v i n g   t h e m "   O N   p u b l i c . f r i e n d s h i p s    
         F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d   O R   a u t h . u i d ( )   =   f r i e n d _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   i n s e r t   f r i e n d s h i p s   w h e r e   t h e y   a r e   t h e   u s e r "   O N   p u b l i c . f r i e n d s h i p s  
         F O R   I N S E R T   W I T H   C H E C K   ( a u t h . u i d ( )   =   u s e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   u p d a t e   t h e i r   f r i e n d s h i p s "   O N   p u b l i c . f r i e n d s h i p s  
         F O R   U P D A T E   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d   O R   a u t h . u i d ( )   =   f r i e n d _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   d e l e t e   t h e i r   f r i e n d s h i p s "   O N   p u b l i c . f r i e n d s h i p s  
         F O R   D E L E T E   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d   O R   a u t h . u i d ( )   =   f r i e n d _ i d ) ;  
  
  
 - -   3 .   R a t i n g   H i s t o r y   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . r a t i n g _ h i s t o r y   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
         u s e r _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L ,  
         g a m e _ i d   U U I D ,   - -   N u l l a b l e   i f   a d j u s t m e n t   w a s   m a n u a l   o r   o f f l i n e  
         r a t i n g _ b e f o r e   I N T E G E R   N O T   N U L L ,  
         r a t i n g _ a f t e r   I N T E G E R   N O T   N U L L ,  
         c h a n g e   I N T E G E R   N O T   N U L L ,  
         r e a s o n   T E X T ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . r a t i n g _ h i s t o r y   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " A n y o n e   c a n   r e a d   r a t i n g   h i s t o r y "   O N   p u b l i c . r a t i n g _ h i s t o r y  
         F O R   S E L E C T   U S I N G   ( t r u e ) ;  
  
  
 - -   4 .   C h a l l e n g e s   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . c h a l l e n g e s   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
         c h a l l e n g e r _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L ,  
         c h a l l e n g e d _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L ,  
         t i m e _ c o n t r o l _ m i n u t e s   I N T E G E R ,  
         t i m e _ c o n t r o l _ i n c r e m e n t   I N T E G E R ,  
         s t a t u s   T E X T   N O T   N U L L   C H E C K   ( s t a t u s   I N   ( ' p e n d i n g ' ,   ' a c c e p t e d ' ,   ' d e c l i n e d ' ,   ' c a n c e l l e d ' ) ) ,  
         i n v i t e _ c o d e   T E X T ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . c h a l l e n g e s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   c h a l l e n g e s   i n v o l v i n g   t h e m "   O N   p u b l i c . c h a l l e n g e s  
         F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   c h a l l e n g e r _ i d   O R   a u t h . u i d ( )   =   c h a l l e n g e d _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   c r e a t e   c h a l l e n g e s   a s   c h a l l e n g e r "   O N   p u b l i c . c h a l l e n g e s  
         F O R   I N S E R T   W I T H   C H E C K   ( a u t h . u i d ( )   =   c h a l l e n g e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   u p d a t e   c h a l l e n g e s   i n v o l v i n g   t h e m "   O N   p u b l i c . c h a l l e n g e s  
         F O R   U P D A T E   U S I N G   ( a u t h . u i d ( )   =   c h a l l e n g e r _ i d   O R   a u t h . u i d ( )   =   c h a l l e n g e d _ i d ) ;  
  
  
 - -   5 .   H e l p e r   F u n c t i o n   t o   C a l c u l a t e   a n d   A p p l y   R a t i n g s  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . p r o c e s s _ g a m e _ r a t i n g s (  
         p _ g a m e _ i d   U U I D ,  
         p _ w h i t e _ i d   U U I D ,  
         p _ b l a c k _ i d   U U I D ,  
         p _ w i n n e r _ i d   T E X T   - -   U U I D   s t r i n g ,   o r   ' d r a w ' ,   o r   n u l l  
 )  
 R E T U R N S   V O I D   A S   $ $  
 D E C L A R E  
         v _ w h i t e _ r a t i n g   I N T E G E R ;  
         v _ b l a c k _ r a t i n g   I N T E G E R ;  
         v _ w h i t e _ e x p e c t e d   N U M E R I C ;  
         v _ b l a c k _ e x p e c t e d   N U M E R I C ;  
         v _ w h i t e _ s c o r e   N U M E R I C ;  
         v _ b l a c k _ s c o r e   N U M E R I C ;  
         v _ k _ f a c t o r   I N T E G E R   : =   3 2 ;  
         v _ w h i t e _ n e w _ r a t i n g   I N T E G E R ;  
         v _ b l a c k _ n e w _ r a t i n g   I N T E G E R ;  
         v _ w h i t e _ d i f f   I N T E G E R ;  
         v _ b l a c k _ d i f f   I N T E G E R ;  
 B E G I N  
         - -   O n l y   p r o c e s s   i f   b o t h   p l a y e r s   a r e   a u t h e n t i c a t e d   u s e r s   ( n o t   g u e s t s )  
         - -   W e ' l l   a s s u m e   U U I D   f o r m a t   m e a n s   a u t h e n t i c a t e d   u s e r  
         I F   p _ w h i t e _ i d   I S   N U L L   O R   p _ b l a c k _ i d   I S   N U L L   T H E N  
                 R E T U R N ;  
         E N D   I F ;  
  
         - -   F e t c h   c u r r e n t   r a t i n g s  
         S E L E C T   r a t i n g   I N T O   v _ w h i t e _ r a t i n g   F R O M   p u b l i c . p r o f i l e s   W H E R E   i d   =   p _ w h i t e _ i d ;  
         S E L E C T   r a t i n g   I N T O   v _ b l a c k _ r a t i n g   F R O M   p u b l i c . p r o f i l e s   W H E R E   i d   =   p _ b l a c k _ i d ;  
          
         I F   v _ w h i t e _ r a t i n g   I S   N U L L   O R   v _ b l a c k _ r a t i n g   I S   N U L L   T H E N  
                 R E T U R N ;  
         E N D   I F ;  
  
         - -   C a l c u l a t e   e x p e c t e d   s c o r e s  
         v _ w h i t e _ e x p e c t e d   : =   1 . 0   /   ( 1 . 0   +   p o w e r ( 1 0 ,   ( v _ b l a c k _ r a t i n g   -   v _ w h i t e _ r a t i n g )   /   4 0 0 . 0 ) ) ;  
         v _ b l a c k _ e x p e c t e d   : =   1 . 0   /   ( 1 . 0   +   p o w e r ( 1 0 ,   ( v _ w h i t e _ r a t i n g   -   v _ b l a c k _ r a t i n g )   /   4 0 0 . 0 ) ) ;  
  
         - -   D e t e r m i n e   a c t u a l   s c o r e s  
         I F   p _ w i n n e r _ i d   =   p _ w h i t e _ i d : : t e x t   T H E N  
                 v _ w h i t e _ s c o r e   : =   1 . 0 ;  
                 v _ b l a c k _ s c o r e   : =   0 . 0 ;  
         E L S I F   p _ w i n n e r _ i d   =   p _ b l a c k _ i d : : t e x t   T H E N  
                 v _ w h i t e _ s c o r e   : =   0 . 0 ;  
                 v _ b l a c k _ s c o r e   : =   1 . 0 ;  
         E L S E  
                 - -   D r a w  
                 v _ w h i t e _ s c o r e   : =   0 . 5 ;  
                 v _ b l a c k _ s c o r e   : =   0 . 5 ;  
         E N D   I F ;  
  
         - -   C a l c u l a t e   n e w   r a t i n g s  
         v _ w h i t e _ n e w _ r a t i n g   : =   v _ w h i t e _ r a t i n g   +   r o u n d ( v _ k _ f a c t o r   *   ( v _ w h i t e _ s c o r e   -   v _ w h i t e _ e x p e c t e d ) ) ;  
         v _ b l a c k _ n e w _ r a t i n g   : =   v _ b l a c k _ r a t i n g   +   r o u n d ( v _ k _ f a c t o r   *   ( v _ b l a c k _ s c o r e   -   v _ b l a c k _ e x p e c t e d ) ) ;  
          
         v _ w h i t e _ d i f f   : =   v _ w h i t e _ n e w _ r a t i n g   -   v _ w h i t e _ r a t i n g ;  
         v _ b l a c k _ d i f f   : =   v _ b l a c k _ n e w _ r a t i n g   -   v _ b l a c k _ r a t i n g ;  
  
         - -   D i s a b l e   t r i g g e r   t e m p o r a r i l y   t o   a l l o w   s y s t e m   t o   u p d a t e   t h e   p r o t e c t e d   f i e l d s  
         E X E C U T E   ' A L T E R   T A B L E   p u b l i c . p r o f i l e s   D I S A B L E   T R I G G E R   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r ' ;  
  
         - -   U p d a t e   W h i t e  
         U P D A T E   p u b l i c . p r o f i l e s   S E T    
                 r a t i n g   =   v _ w h i t e _ n e w _ r a t i n g ,  
                 h i g h e s t _ r a t i n g   =   G R E A T E S T ( h i g h e s t _ r a t i n g ,   v _ w h i t e _ n e w _ r a t i n g ) ,  
                 g a m e s _ p l a y e d   =   g a m e s _ p l a y e d   +   1 ,  
                 w i n s   =   w i n s   +   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   1 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 l o s s e s   =   l o s s e s   +   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   0 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 d r a w s   =   d r a w s   +   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   0 . 5   T H E N   1   E L S E   0   E N D ) ,  
                 c u r r e n t _ s t r e a k   =   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   1 . 0   T H E N   G R E A T E S T ( c u r r e n t _ s t r e a k   +   1 ,   1 )   W H E N   v _ w h i t e _ s c o r e   =   0 . 5   T H E N   c u r r e n t _ s t r e a k   E L S E   0   E N D )  
         W H E R E   i d   =   p _ w h i t e _ i d ;  
  
         - -   U p d a t e   B l a c k  
         U P D A T E   p u b l i c . p r o f i l e s   S E T    
                 r a t i n g   =   v _ b l a c k _ n e w _ r a t i n g ,  
                 h i g h e s t _ r a t i n g   =   G R E A T E S T ( h i g h e s t _ r a t i n g ,   v _ b l a c k _ n e w _ r a t i n g ) ,  
                 g a m e s _ p l a y e d   =   g a m e s _ p l a y e d   +   1 ,  
                 w i n s   =   w i n s   +   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   1 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 l o s s e s   =   l o s s e s   +   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   0 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 d r a w s   =   d r a w s   +   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   0 . 5   T H E N   1   E L S E   0   E N D ) ,  
                 c u r r e n t _ s t r e a k   =   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   1 . 0   T H E N   G R E A T E S T ( c u r r e n t _ s t r e a k   +   1 ,   1 )   W H E N   v _ b l a c k _ s c o r e   =   0 . 5   T H E N   c u r r e n t _ s t r e a k   E L S E   0   E N D )  
         W H E R E   i d   =   p _ b l a c k _ i d ;  
  
         E X E C U T E   ' A L T E R   T A B L E   p u b l i c . p r o f i l e s   E N A B L E   T R I G G E R   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r ' ;  
  
         - -   I n s e r t   i n t o   h i s t o r y  
         I N S E R T   I N T O   p u b l i c . r a t i n g _ h i s t o r y   ( u s e r _ i d ,   g a m e _ i d ,   r a t i n g _ b e f o r e ,   r a t i n g _ a f t e r ,   c h a n g e ,   r e a s o n )  
         V A L U E S    
                 ( p _ w h i t e _ i d ,   p _ g a m e _ i d ,   v _ w h i t e _ r a t i n g ,   v _ w h i t e _ n e w _ r a t i n g ,   v _ w h i t e _ d i f f ,   ' g a m e _ e n d ' ) ,  
                 ( p _ b l a c k _ i d ,   p _ g a m e _ i d ,   v _ b l a c k _ r a t i n g ,   v _ b l a c k _ n e w _ r a t i n g ,   v _ b l a c k _ d i f f ,   ' g a m e _ e n d ' ) ;  
  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
 - -   P h a s e   1 9 :   S o c i a l   &   P l a y e r   P r o f i l e s   M i g r a t i o n s  
  
 - -   1 .   M o d i f y   P r o f i l e s   T a b l e  
 A L T E R   T A B L E   p u b l i c . p r o f i l e s    
 A D D   C O L U M N   I F   N O T   E X I S T S   h i g h e s t _ r a t i n g   I N T E G E R   D E F A U L T   1 2 0 0 ,  
 A D D   C O L U M N   I F   N O T   E X I S T S   c u r r e n t _ s t r e a k   I N T E G E R   D E F A U L T   0 ;  
  
 - -   D r o p   a n d   r e c r e a t e   t r i g g e r   t o   p r o t e c t   n e w   f i e l d s  
 D R O P   T R I G G E R   I F   E X I S T S   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r   O N   p u b l i c . p r o f i l e s ;  
  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p r o t e c t _ p r o f i l e _ f i e l d s ( )  
 R E T U R N S   T R I G G E R   A S   $ $  
 B E G I N  
         - -   P r e v e n t   c l i e n t   f r o m   d i r e c t l y   u p d a t i n g   r e s t r i c t e d   f i e l d s  
         I F   c u r r e n t _ s e t t i n g ( ' r e q u e s t . j w t . c l a i m s ' ,   t r u e )   I S   N O T   N U L L   T H E N  
                 I F   N E W . r a t i n g   I S   D I S T I N C T   F R O M   O L D . r a t i n g   O R  
                       N E W . g a m e s _ p l a y e d   I S   D I S T I N C T   F R O M   O L D . g a m e s _ p l a y e d   O R  
                       N E W . w i n s   I S   D I S T I N C T   F R O M   O L D . w i n s   O R  
                       N E W . l o s s e s   I S   D I S T I N C T   F R O M   O L D . l o s s e s   O R  
                       N E W . d r a w s   I S   D I S T I N C T   F R O M   O L D . d r a w s   O R  
                       N E W . h i g h e s t _ r a t i n g   I S   D I S T I N C T   F R O M   O L D . h i g h e s t _ r a t i n g   O R  
                       N E W . c u r r e n t _ s t r e a k   I S   D I S T I N C T   F R O M   O L D . c u r r e n t _ s t r e a k   T H E N  
                         R A I S E   E X C E P T I O N   ' Y o u   a r e   n o t   a u t h o r i z e d   t o   m o d i f y   t h e s e   s t a t i s t i c s   d i r e c t l y . ' ;  
                 E N D   I F ;  
         E N D   I F ;  
         R E T U R N   N E W ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 C R E A T E   T R I G G E R   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r  
 B E F O R E   U P D A T E   O N   p u b l i c . p r o f i l e s  
 F O R   E A C H   R O W  
 E X E C U T E   F U N C T I O N   p r o t e c t _ p r o f i l e _ f i e l d s ( ) ;  
  
  
 - -   2 .   F r i e n d s h i p s   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . f r i e n d s h i p s   (  
         u s e r _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
         f r i e n d _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E ,  
         s t a t u s   T E X T   N O T   N U L L   C H E C K   ( s t a t u s   I N   ( ' p e n d i n g ' ,   ' a c c e p t e d ' ) ) ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         P R I M A R Y   K E Y   ( u s e r _ i d ,   f r i e n d _ i d )  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . f r i e n d s h i p s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   f r i e n d s h i p s   i n v o l v i n g   t h e m "   O N   p u b l i c . f r i e n d s h i p s    
         F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d   O R   a u t h . u i d ( )   =   f r i e n d _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   i n s e r t   f r i e n d s h i p s   w h e r e   t h e y   a r e   t h e   u s e r "   O N   p u b l i c . f r i e n d s h i p s  
         F O R   I N S E R T   W I T H   C H E C K   ( a u t h . u i d ( )   =   u s e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   u p d a t e   t h e i r   f r i e n d s h i p s "   O N   p u b l i c . f r i e n d s h i p s  
         F O R   U P D A T E   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d   O R   a u t h . u i d ( )   =   f r i e n d _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   d e l e t e   t h e i r   f r i e n d s h i p s "   O N   p u b l i c . f r i e n d s h i p s  
         F O R   D E L E T E   U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d   O R   a u t h . u i d ( )   =   f r i e n d _ i d ) ;  
  
  
 - -   3 .   R a t i n g   H i s t o r y   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . r a t i n g _ h i s t o r y   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
         u s e r _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L ,  
         g a m e _ i d   U U I D ,   - -   N u l l a b l e   i f   a d j u s t m e n t   w a s   m a n u a l   o r   o f f l i n e  
         r a t i n g _ b e f o r e   I N T E G E R   N O T   N U L L ,  
         r a t i n g _ a f t e r   I N T E G E R   N O T   N U L L ,  
         c h a n g e   I N T E G E R   N O T   N U L L ,  
         r e a s o n   T E X T ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . r a t i n g _ h i s t o r y   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " A n y o n e   c a n   r e a d   r a t i n g   h i s t o r y "   O N   p u b l i c . r a t i n g _ h i s t o r y  
         F O R   S E L E C T   U S I N G   ( t r u e ) ;  
  
  
 - -   4 .   C h a l l e n g e s   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . c h a l l e n g e s   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
         c h a l l e n g e r _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L ,  
         c h a l l e n g e d _ i d   U U I D   R E F E R E N C E S   p u b l i c . p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E   N O T   N U L L ,  
         t i m e _ c o n t r o l _ m i n u t e s   I N T E G E R ,  
         t i m e _ c o n t r o l _ i n c r e m e n t   I N T E G E R ,  
         s t a t u s   T E X T   N O T   N U L L   C H E C K   ( s t a t u s   I N   ( ' p e n d i n g ' ,   ' a c c e p t e d ' ,   ' d e c l i n e d ' ,   ' c a n c e l l e d ' ) ) ,  
         i n v i t e _ c o d e   T E X T ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P ,  
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   C U R R E N T _ T I M E S T A M P  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . c h a l l e n g e s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   c h a l l e n g e s   i n v o l v i n g   t h e m "   O N   p u b l i c . c h a l l e n g e s  
         F O R   S E L E C T   U S I N G   ( a u t h . u i d ( )   =   c h a l l e n g e r _ i d   O R   a u t h . u i d ( )   =   c h a l l e n g e d _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   c r e a t e   c h a l l e n g e s   a s   c h a l l e n g e r "   O N   p u b l i c . c h a l l e n g e s  
         F O R   I N S E R T   W I T H   C H E C K   ( a u t h . u i d ( )   =   c h a l l e n g e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   u p d a t e   c h a l l e n g e s   i n v o l v i n g   t h e m "   O N   p u b l i c . c h a l l e n g e s  
         F O R   U P D A T E   U S I N G   ( a u t h . u i d ( )   =   c h a l l e n g e r _ i d   O R   a u t h . u i d ( )   =   c h a l l e n g e d _ i d ) ;  
  
  
 - -   5 .   H e l p e r   F u n c t i o n   t o   C a l c u l a t e   a n d   A p p l y   R a t i n g s  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . p r o c e s s _ g a m e _ r a t i n g s (  
         p _ g a m e _ i d   U U I D ,  
         p _ w h i t e _ i d   U U I D ,  
         p _ b l a c k _ i d   U U I D ,  
         p _ w i n n e r _ i d   T E X T   - -   U U I D   s t r i n g ,   o r   ' d r a w ' ,   o r   n u l l  
 )  
 R E T U R N S   V O I D   A S   $ $  
 D E C L A R E  
         v _ w h i t e _ r a t i n g   I N T E G E R ;  
         v _ b l a c k _ r a t i n g   I N T E G E R ;  
         v _ w h i t e _ e x p e c t e d   N U M E R I C ;  
         v _ b l a c k _ e x p e c t e d   N U M E R I C ;  
         v _ w h i t e _ s c o r e   N U M E R I C ;  
         v _ b l a c k _ s c o r e   N U M E R I C ;  
         v _ k _ f a c t o r   I N T E G E R   : =   3 2 ;  
         v _ w h i t e _ n e w _ r a t i n g   I N T E G E R ;  
         v _ b l a c k _ n e w _ r a t i n g   I N T E G E R ;  
         v _ w h i t e _ d i f f   I N T E G E R ;  
         v _ b l a c k _ d i f f   I N T E G E R ;  
 B E G I N  
         - -   O n l y   p r o c e s s   i f   b o t h   p l a y e r s   a r e   a u t h e n t i c a t e d   u s e r s   ( n o t   g u e s t s )  
         - -   W e ' l l   a s s u m e   U U I D   f o r m a t   m e a n s   a u t h e n t i c a t e d   u s e r  
         I F   p _ w h i t e _ i d   I S   N U L L   O R   p _ b l a c k _ i d   I S   N U L L   T H E N  
                 R E T U R N ;  
         E N D   I F ;  
  
         - -   F e t c h   c u r r e n t   r a t i n g s  
         S E L E C T   r a t i n g   I N T O   v _ w h i t e _ r a t i n g   F R O M   p u b l i c . p r o f i l e s   W H E R E   i d   =   p _ w h i t e _ i d ;  
         S E L E C T   r a t i n g   I N T O   v _ b l a c k _ r a t i n g   F R O M   p u b l i c . p r o f i l e s   W H E R E   i d   =   p _ b l a c k _ i d ;  
          
         I F   v _ w h i t e _ r a t i n g   I S   N U L L   O R   v _ b l a c k _ r a t i n g   I S   N U L L   T H E N  
                 R E T U R N ;  
         E N D   I F ;  
  
         - -   C a l c u l a t e   e x p e c t e d   s c o r e s  
         v _ w h i t e _ e x p e c t e d   : =   1 . 0   /   ( 1 . 0   +   p o w e r ( 1 0 ,   ( v _ b l a c k _ r a t i n g   -   v _ w h i t e _ r a t i n g )   /   4 0 0 . 0 ) ) ;  
         v _ b l a c k _ e x p e c t e d   : =   1 . 0   /   ( 1 . 0   +   p o w e r ( 1 0 ,   ( v _ w h i t e _ r a t i n g   -   v _ b l a c k _ r a t i n g )   /   4 0 0 . 0 ) ) ;  
  
         - -   D e t e r m i n e   a c t u a l   s c o r e s  
         I F   p _ w i n n e r _ i d   =   p _ w h i t e _ i d : : t e x t   T H E N  
                 v _ w h i t e _ s c o r e   : =   1 . 0 ;  
                 v _ b l a c k _ s c o r e   : =   0 . 0 ;  
         E L S I F   p _ w i n n e r _ i d   =   p _ b l a c k _ i d : : t e x t   T H E N  
                 v _ w h i t e _ s c o r e   : =   0 . 0 ;  
                 v _ b l a c k _ s c o r e   : =   1 . 0 ;  
         E L S E  
                 - -   D r a w  
                 v _ w h i t e _ s c o r e   : =   0 . 5 ;  
                 v _ b l a c k _ s c o r e   : =   0 . 5 ;  
         E N D   I F ;  
  
         - -   C a l c u l a t e   n e w   r a t i n g s  
         v _ w h i t e _ n e w _ r a t i n g   : =   v _ w h i t e _ r a t i n g   +   r o u n d ( v _ k _ f a c t o r   *   ( v _ w h i t e _ s c o r e   -   v _ w h i t e _ e x p e c t e d ) ) ;  
         v _ b l a c k _ n e w _ r a t i n g   : =   v _ b l a c k _ r a t i n g   +   r o u n d ( v _ k _ f a c t o r   *   ( v _ b l a c k _ s c o r e   -   v _ b l a c k _ e x p e c t e d ) ) ;  
          
         v _ w h i t e _ d i f f   : =   v _ w h i t e _ n e w _ r a t i n g   -   v _ w h i t e _ r a t i n g ;  
         v _ b l a c k _ d i f f   : =   v _ b l a c k _ n e w _ r a t i n g   -   v _ b l a c k _ r a t i n g ;  
  
         - -   D i s a b l e   t r i g g e r   t e m p o r a r i l y   t o   a l l o w   s y s t e m   t o   u p d a t e   t h e   p r o t e c t e d   f i e l d s  
         E X E C U T E   ' A L T E R   T A B L E   p u b l i c . p r o f i l e s   D I S A B L E   T R I G G E R   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r ' ;  
  
         - -   U p d a t e   W h i t e  
         U P D A T E   p u b l i c . p r o f i l e s   S E T    
                 r a t i n g   =   v _ w h i t e _ n e w _ r a t i n g ,  
                 h i g h e s t _ r a t i n g   =   G R E A T E S T ( h i g h e s t _ r a t i n g ,   v _ w h i t e _ n e w _ r a t i n g ) ,  
                 g a m e s _ p l a y e d   =   g a m e s _ p l a y e d   +   1 ,  
                 w i n s   =   w i n s   +   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   1 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 l o s s e s   =   l o s s e s   +   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   0 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 d r a w s   =   d r a w s   +   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   0 . 5   T H E N   1   E L S E   0   E N D ) ,  
                 c u r r e n t _ s t r e a k   =   ( C A S E   W H E N   v _ w h i t e _ s c o r e   =   1 . 0   T H E N   G R E A T E S T ( c u r r e n t _ s t r e a k   +   1 ,   1 )   W H E N   v _ w h i t e _ s c o r e   =   0 . 5   T H E N   c u r r e n t _ s t r e a k   E L S E   0   E N D )  
         W H E R E   i d   =   p _ w h i t e _ i d ;  
  
         - -   U p d a t e   B l a c k  
         U P D A T E   p u b l i c . p r o f i l e s   S E T    
                 r a t i n g   =   v _ b l a c k _ n e w _ r a t i n g ,  
                 h i g h e s t _ r a t i n g   =   G R E A T E S T ( h i g h e s t _ r a t i n g ,   v _ b l a c k _ n e w _ r a t i n g ) ,  
                 g a m e s _ p l a y e d   =   g a m e s _ p l a y e d   +   1 ,  
                 w i n s   =   w i n s   +   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   1 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 l o s s e s   =   l o s s e s   +   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   0 . 0   T H E N   1   E L S E   0   E N D ) ,  
                 d r a w s   =   d r a w s   +   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   0 . 5   T H E N   1   E L S E   0   E N D ) ,  
                 c u r r e n t _ s t r e a k   =   ( C A S E   W H E N   v _ b l a c k _ s c o r e   =   1 . 0   T H E N   G R E A T E S T ( c u r r e n t _ s t r e a k   +   1 ,   1 )   W H E N   v _ b l a c k _ s c o r e   =   0 . 5   T H E N   c u r r e n t _ s t r e a k   E L S E   0   E N D )  
         W H E R E   i d   =   p _ b l a c k _ i d ;  
  
         E X E C U T E   ' A L T E R   T A B L E   p u b l i c . p r o f i l e s   E N A B L E   T R I G G E R   p r o t e c t _ p r o f i l e _ f i e l d s _ t r i g g e r ' ;  
  
         - -   I n s e r t   i n t o   h i s t o r y  
         I N S E R T   I N T O   p u b l i c . r a t i n g _ h i s t o r y   ( u s e r _ i d ,   g a m e _ i d ,   r a t i n g _ b e f o r e ,   r a t i n g _ a f t e r ,   c h a n g e ,   r e a s o n )  
         V A L U E S    
                 ( p _ w h i t e _ i d ,   p _ g a m e _ i d ,   v _ w h i t e _ r a t i n g ,   v _ w h i t e _ n e w _ r a t i n g ,   v _ w h i t e _ d i f f ,   ' g a m e _ e n d ' ) ,  
                 ( p _ b l a c k _ i d ,   p _ g a m e _ i d ,   v _ b l a c k _ r a t i n g ,   v _ b l a c k _ n e w _ r a t i n g ,   v _ b l a c k _ d i f f ,   ' g a m e _ e n d ' ) ;  
  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
  
 - -   6 .   T r i g g e r   t o   p r o c e s s   r a t i n g s   a u t o m a t i c a l l y  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p r o c e s s _ r a t i n g s _ o n _ g a m e _ e n d ( )  
 R E T U R N S   T R I G G E R   A S   $ b o d y  
 B E G I N  
         I F   O L D . s t a t u s   =   ' a c t i v e '   A N D   N E W . s t a t u s   =   ' c o m p l e t e d '   T H E N  
                 - -   C h e c k   i f   b o t h   a r e   a u t h e n t i c a t e d   u s e r s   ( a s s u m i n g   U U I D   f o r m a t ,   s i m p l e   r e g e x   c h e c k )  
                 - -   A c t u a l l y ,   p r o c e s s _ g a m e _ r a t i n g s   c h e c k s   i f   t h e y   a r e   U U I D s .    
                 - -   I f   t h e y   a r e   g u e s t   u s e r s   ( w h i c h   w e   d i d n ' t   g e n e r a t e   a s   v a l i d   U U I D s   b u t   l e t ' s   c a s t   s a f e l y ) .  
                 B E G I N  
                         P E R F O R M   p u b l i c . p r o c e s s _ g a m e _ r a t i n g s (  
                                 N E W . i d ,  
                                 N E W . w h i t e _ p l a y e r : : u u i d ,  
                                 N E W . b l a c k _ p l a y e r : : u u i d ,  
                                 N E W . w i n n e r  
                         ) ;  
                 E X C E P T I O N   W H E N   i n v a l i d _ t e x t _ r e p r e s e n t a t i o n   T H E N  
                         - -   O n e   o f   t h e   p l a y e r s   i s   a   g u e s t   ( n o t   a   U U I D ) ,   i g n o r e   r a t i n g s  
                 E N D ;  
         E N D   I F ;  
         R E T U R N   N E W ;  
 E N D ;  
 $ b o d y   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
  
 D R O P   T R I G G E R   I F   E X I S T S   g a m e _ e n d _ r a t i n g _ t r i g g e r   O N   p u b l i c . l i n k _ g a m e s ;  
 C R E A T E   T R I G G E R   g a m e _ e n d _ r a t i n g _ t r i g g e r  
 A F T E R   U P D A T E   O N   p u b l i c . l i n k _ g a m e s  
 F O R   E A C H   R O W  
 E X E C U T E   F U N C T I O N   p r o c e s s _ r a t i n g s _ o n _ g a m e _ e n d ( ) ;  
  
 -- Run this in Supabase SQL Editor to add puzzle tracking
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
