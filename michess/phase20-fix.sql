-- phase20-fix.sql

-- 1. Create a function to offer a draw
CREATE OR REPLACE FUNCTION public.offer_draw(
    p_game_id uuid,
    p_player_id text
) RETURNS public.link_games AS $$
DECLARE
    v_game public.link_games;
    v_offer_color text;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.status != 'active' THEN
        RAISE EXCEPTION 'Game is not active';
    END IF;
    
    IF v_game.white_player = p_player_id THEN
        v_offer_color := 'w';
    ELSIF v_game.black_player = p_player_id THEN
        v_offer_color := 'b';
    ELSE
        RAISE EXCEPTION 'Only active players can offer a draw';
    END IF;

    UPDATE public.link_games SET
        draw_offer_by = v_offer_color,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id RETURNING * INTO v_game;
    
    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Modify update_link_game to clear draw_offer_by on move/status change
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
    
    IF v_game.status != 'active' THEN
        RAISE EXCEPTION 'Game is already %', v_game.status;
    END IF;
    
    -- Ensure only the participant who is supposed to move (or just completed a move) can update
    IF p_status = 'active' THEN
        IF p_turn = 'w' AND v_game.black_player != p_player_id THEN
            RAISE EXCEPTION 'Invalid mover';
        END IF;
        IF p_turn = 'b' AND v_game.white_player != p_player_id THEN
            RAISE EXCEPTION 'Invalid mover';
        END IF;
    ELSE
        -- If completing the game (e.g. checkmate/draw accept), either player can trigger it
        IF v_game.white_player != p_player_id AND v_game.black_player != p_player_id THEN
            RAISE EXCEPTION 'Only participants can end the game';
        END IF;
    END IF;

    -- Time control logic
    IF v_game.initial_time_ms IS NOT NULL AND v_game.last_move_at IS NOT NULL THEN
        -- Calculate elapsed time
        v_elapsed_ms := GREATEST(0, (extract(epoch from (CURRENT_TIMESTAMP - v_game.last_move_at)) * 1000)::integer);
        
        -- Deduct from the mover's clock
        IF v_game.current_turn = 'w' THEN
            v_mover_time := v_game.white_time_ms - v_elapsed_ms;
            
            -- If flagged, override status (except if checkmate is already calculated, 
            -- but usually client checks time before move)
            IF v_mover_time <= 0 AND p_status = 'active' THEN
                p_status := 'completed';
                p_winner := v_game.black_player;
                v_mover_time := 0;
            END IF;
            
            -- Add increment if move was made (p_status = active or mate)
            IF v_mover_time > 0 THEN
                v_mover_time := v_mover_time + COALESCE(v_game.increment_ms, 0);
            END IF;
            
            UPDATE public.link_games SET
                fen = COALESCE(p_fen, fen),
                pgn = COALESCE(p_pgn, pgn),
                current_turn = COALESCE(p_turn, current_turn),
                status = COALESCE(p_status, status),
                winner = COALESCE(p_winner, winner),
                draw_offer_by = NULL, rematch_offer_by = NULL, -- ALWAYS CLEAR OFFERS
                white_time_ms = v_mover_time,
                last_move_at = CASE WHEN p_status = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_game_id RETURNING * INTO v_game;
            
        ELSE
            v_mover_time := v_game.black_time_ms - v_elapsed_ms;
            
            IF v_mover_time <= 0 AND p_status = 'active' THEN
                p_status := 'completed';
                p_winner := v_game.white_player;
                v_mover_time := 0;
            END IF;
            
            IF v_mover_time > 0 THEN
                v_mover_time := v_mover_time + COALESCE(v_game.increment_ms, 0);
            END IF;
            
            UPDATE public.link_games SET
                fen = COALESCE(p_fen, fen),
                pgn = COALESCE(p_pgn, pgn),
                current_turn = COALESCE(p_turn, current_turn),
                status = COALESCE(p_status, status),
                winner = COALESCE(p_winner, winner),
                draw_offer_by = NULL, rematch_offer_by = NULL, -- ALWAYS CLEAR OFFERS
                black_time_ms = v_mover_time,
                last_move_at = CASE WHEN p_status = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = p_game_id RETURNING * INTO v_game;
        END IF;
    ELSE
        -- Untimed game
        UPDATE public.link_games SET
            fen = COALESCE(p_fen, fen),
            pgn = COALESCE(p_pgn, pgn),
            current_turn = COALESCE(p_turn, current_turn),
            status = COALESCE(p_status, status),
            winner = COALESCE(p_winner, winner),
            draw_offer_by = NULL, rematch_offer_by = NULL, -- ALWAYS CLEAR OFFERS
            last_move_at = CASE WHEN p_status = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_game_id RETURNING * INTO v_game;
    END IF;

    RETURN v_game;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create a function to decline a draw
CREATE OR REPLACE FUNCTION public.decline_draw(
    p_game_id uuid,
    p_player_id text
) RETURNS void AS 
DECLARE
    v_game public.link_games;
BEGIN
    SELECT * INTO v_game FROM public.link_games WHERE id = p_game_id FOR UPDATE;
    
    IF v_game.white_player != p_player_id AND v_game.black_player != p_player_id THEN
        RAISE EXCEPTION 'Only active players can decline a draw';
    END IF;

    UPDATE public.link_games SET
        draw_offer_by = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id;
END;
 LANGUAGE plpgsql SECURITY DEFINER;
