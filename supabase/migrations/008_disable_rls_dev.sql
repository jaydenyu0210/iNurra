-- Completely disable RLS on tables for development
-- WARNING: Only use this in development, not production!

-- Disable RLS on medications table
ALTER TABLE public.medications DISABLE ROW LEVEL SECURITY;

-- Disable RLS on calendar_events 
ALTER TABLE public.calendar_events DISABLE ROW LEVEL SECURITY;

-- Disable RLS on documents (for upload)
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;

-- Disable RLS on health_metrics
ALTER TABLE public.health_metrics DISABLE ROW LEVEL SECURITY;
