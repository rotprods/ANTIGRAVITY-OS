-- Add settings JSONB to profiles for agency configuration persistence
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

COMMENT ON COLUMN public.profiles.settings IS 'User/agency settings persisted from Settings module';
