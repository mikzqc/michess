-- phase20-rematch-fix.sql

-- 1. Add rematch_offer_by column
ALTER TABLE public.link_games ADD COLUMN IF NOT EXISTS rematch_offer_by text;

-- 2. Offer Rematch
CREATE OR REPLACE FUNCTION public.offer_rematch(
    p_game_id uuid,
    p_player_id text
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
    v_offer_color text;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'completed' AND v_game.status != 'abandoned' THEN
        RAISE EXCEPTION 'Can only rematch finished games';
    END IF;
    
    IF v_game.white_player = p_player_id THEN
        v_offer_color := 'w';
    ELSIF v_game.black_player = p_player_id THEN
        v_offer_color := 'b';
    ELSE
        RAISE EXCEPTION 'Only participants can offer a rematch';
    END IF;

    UPDATE public.link_games SET
        rematch_offer_by = v_offer_color,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Decline Rematch
CREATE OR REPLACE FUNCTION public.decline_rematch(
    p_game_id uuid,
    p_player_id text
) RETURNS void AS $$
DECLARE
    v_game public.link_games;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.white_player != p_player_id AND v_game.black_player != p_player_id THEN
        RAISE EXCEPTION 'Only active players can decline a rematch';
    END IF;

    UPDATE public.link_games SET
        rematch_offer_by = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Rematch (Accept) - Resets board and swaps colors
CREATE OR REPLACE FUNCTION public.rematch_link_game(
    p_game_id uuid,
    p_player_id text
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
BEGIN
    -- Lock the row for update
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'completed' AND v_game.status != 'abandoned' THEN
        RAISE EXCEPTION 'Can only rematch finished games';
    END IF;

    IF v_game.white_player != p_player_id AND v_game.black_player != p_player_id THEN
        RAISE EXCEPTION 'Only participants can request a rematch';
    END IF;

    -- Reset the game state and swap the colors
    UPDATE public.link_games SET
        status = 'active',
        fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn = '',
        current_turn = 'w',
        winner = NULL,
        draw_offer_by = NULL,
        rematch_offer_by = NULL, -- Clear rematch offer!
        white_time_ms = initial_time_ms,
        black_time_ms = initial_time_ms,
        last_move_at = NULL,
        white_player = v_game.black_player,
        black_player = v_game.white_player,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
