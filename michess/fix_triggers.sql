-- Run this in your Supabase SQL Editor to completely wipe out the triggers causing the crash

-- 1. Drop the achievements trigger completely
DROP TRIGGER IF EXISTS check_achievements_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.check_achievements();

-- 2. Recreate the protect_profile_fields function without any rating checks
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-attach only the clean protect trigger
DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_fields();
