-- Add missing columns just in case
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 1200,
ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0;

-- Achievements Trigger
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS trigger AS $$
BEGIN
    -- Check first game
    IF NEW.games_played >= 1 THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, 'first_game') ON CONFLICT DO NOTHING;
    END IF;
    -- Check 10 games
    IF NEW.games_played >= 10 THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, '10_games') ON CONFLICT DO NOTHING;
    END IF;
    -- Check 50 games
    IF NEW.games_played >= 50 THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, '50_games') ON CONFLICT DO NOTHING;
    END IF;
    -- Check 100 games
    IF NEW.games_played >= 100 THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, '100_games') ON CONFLICT DO NOTHING;
    END IF;
    -- Check wins
    IF NEW.wins >= 1 THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, 'first_win') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Check rating (overall or specific time controls)
    -- Assuming we care about highest_rating or current overall rating
    IF (NEW.rating >= 1000 OR NEW.highest_rating >= 1000) THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, 'rating_1000') ON CONFLICT DO NOTHING;
    END IF;
    IF (NEW.rating >= 1250 OR NEW.highest_rating >= 1250) THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, 'rating_1250') ON CONFLICT DO NOTHING;
    END IF;
    IF (NEW.rating >= 1500 OR NEW.highest_rating >= 1500) THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, 'rating_1500') ON CONFLICT DO NOTHING;
    END IF;
    
    -- Check win streak
    IF (NEW.longest_win_streak >= 5 OR NEW.current_streak >= 5) THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.id, 'win_streak_5') ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_achievements_trigger ON public.profiles;
CREATE TRIGGER check_achievements_trigger
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_achievements();

-- Grant initial achievements for existing users based on their current stats!
-- We can do this with an anonymous block:
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM public.profiles
    LOOP
        IF r.games_played >= 1 THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, 'first_game') ON CONFLICT DO NOTHING;
        END IF;
        IF r.games_played >= 10 THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, '10_games') ON CONFLICT DO NOTHING;
        END IF;
        IF r.games_played >= 50 THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, '50_games') ON CONFLICT DO NOTHING;
        END IF;
        IF r.games_played >= 100 THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, '100_games') ON CONFLICT DO NOTHING;
        END IF;
        IF r.wins >= 1 THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, 'first_win') ON CONFLICT DO NOTHING;
        END IF;
        IF (r.rating >= 1000 OR r.highest_rating >= 1000) THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, 'rating_1000') ON CONFLICT DO NOTHING;
        END IF;
        IF (r.rating >= 1250 OR r.highest_rating >= 1250) THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, 'rating_1250') ON CONFLICT DO NOTHING;
        END IF;
        IF (r.rating >= 1500 OR r.highest_rating >= 1500) THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, 'rating_1500') ON CONFLICT DO NOTHING;
        END IF;
        IF (r.longest_win_streak >= 5 OR r.current_streak >= 5) THEN
            INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (r.id, 'win_streak_5') ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$;
