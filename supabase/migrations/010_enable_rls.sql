-- Re-enable RLS after fixing auth to use real Supabase sessions
-- Apply this after setting up proper dev auth

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
