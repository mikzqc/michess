-- Run this in your Supabase SQL Editor to remove the old broken trigger
DROP TRIGGER IF EXISTS check_achievements_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.check_achievements();
