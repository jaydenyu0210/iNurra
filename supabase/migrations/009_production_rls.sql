-- Production-ready RLS policies for medications and calendar_events
-- Apply this BEFORE going to production!

-- Re-enable RLS on medications table
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Drop all existing medication policies to start fresh
DROP POLICY IF EXISTS "Users can view their own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert their own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update their own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert medications" ON public.medications;
DROP POLICY IF EXISTS "Users can manage own medications" ON public.medications;
DROP POLICY IF EXISTS "dev_allow_delete_medications" ON public.medications;

-- Create comprehensive policies for medications
CREATE POLICY "medications_select_own" ON public.medications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "medications_insert_own" ON public.medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medications_update_own" ON public.medications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "medications_delete_own" ON public.medications
  FOR DELETE USING (auth.uid() = user_id);

-- Re-enable RLS on calendar_events table
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Drop all existing calendar_events policies
DROP POLICY IF EXISTS "Users can manage own events" ON public.calendar_events;
DROP POLICY IF EXISTS "dev_allow_all_calendar_events" ON public.calendar_events;

-- Create comprehensive policies for calendar_events
CREATE POLICY "calendar_select_own" ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "calendar_insert_own" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_update_own" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "calendar_delete_own" ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);
