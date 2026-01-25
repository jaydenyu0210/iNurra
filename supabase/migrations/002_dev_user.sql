-- Create a dev user for testing without phone auth
-- This user ID matches DEV_USER_ID in authStore.ts

-- First insert into auth.users (this requires running as service role or via Supabase Dashboard)
-- For local dev, we can insert directly if using local Supabase

-- Insert the dev user into public.users table
INSERT INTO public.users (id, phone, display_name, settings)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '+15550000001',
    'Dev User',
    '{"notifications": true, "language": "en"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
