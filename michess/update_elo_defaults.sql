-- Update column defaults to 100 for future users
ALTER TABLE public.profiles ALTER COLUMN highest_rating SET DEFAULT 100;
ALTER TABLE public.profiles ALTER COLUMN rating_bullet SET DEFAULT 100;
ALTER TABLE public.profiles ALTER COLUMN rating_blitz SET DEFAULT 100;
ALTER TABLE public.profiles ALTER COLUMN rating_rapid SET DEFAULT 100;
ALTER TABLE public.profiles ALTER COLUMN puzzle_rating SET DEFAULT 100;

-- Optional: Reset existing users who have exactly 1200 (the old default)
-- to 100, assuming they haven't actually played and earned 1200.
UPDATE public.profiles SET highest_rating = 100 WHERE highest_rating = 1200;
UPDATE public.profiles SET rating_bullet = 100 WHERE rating_bullet = 1200;
UPDATE public.profiles SET rating_blitz = 100 WHERE rating_blitz = 1200;
UPDATE public.profiles SET rating_rapid = 100 WHERE rating_rapid = 1200;
UPDATE public.profiles SET puzzle_rating = 100 WHERE puzzle_rating = 1200;
