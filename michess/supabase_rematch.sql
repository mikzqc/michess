CREATE OR REPLACE FUNCTION public.rematch_link_game(p_game_id uuid, p_player_id text)
RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
BEGIN
    -- SECURITY PHASE: Protect registered users from impersonation
    IF EXISTS (SELECT 1 FROM auth.users WHERE id::text = p_player_id) THEN
        IF auth.uid()::text IS NULL OR auth.uid()::text != p_player_id THEN
            RAISE EXCEPTION 'Authentication required to rematch this game';
        END IF;
    END IF;

    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF COALESCE(v_game.white_player, '') != p_player_id AND COALESCE(v_game.black_player, '') != p_player_id AND v_game.owner_id != p_player_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.link_games SET
        fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn = '',
        current_turn = 'w',
        status = 'active',
        winner = null,
        white_time_ms = initial_time_ms,
        black_time_ms = initial_time_ms,
        last_move_at = null,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
