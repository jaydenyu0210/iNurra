-- Calendar scheduling enhancements

-- Add medication_id and duration to calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- RLS policies for calendar_events
CREATE POLICY "dev_allow_all_calendar_events" ON public.calendar_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Index for faster event queries by date
CREATE INDEX IF NOT EXISTS idx_calendar_events_scheduled_at 
ON public.calendar_events(user_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_medication 
ON public.calendar_events(medication_id);
