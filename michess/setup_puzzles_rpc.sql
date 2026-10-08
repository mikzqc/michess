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
