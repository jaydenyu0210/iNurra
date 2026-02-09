-- Function to generate calendar events for the CURRENT user's medications
-- Usage: SELECT generate_my_medication_events();

CREATE OR REPLACE FUNCTION generate_my_medication_events()
RETURNS VOID AS $$
DECLARE
    target_user_id UUID;
    med RECORD;
    day_offset INTEGER;
    hour_offset INTEGER;
    event_ts TIMESTAMP WITH TIME ZONE;
    med_duration INTEGER;
    med_frequency INTEGER;
    start_ts TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current user ID
    target_user_id := auth.uid();
    
    -- In dev mode with disabled RLS/Auth, we might need a fallback or this will return null
    -- Note: If using the mock auth store logic, auth.uid() is null in Postgres.
    -- For the strictly secure version, we rely on auth.uid().
    -- If you are using the '002_dev_user.sql' approach where you fake 'auth.uid', it's fine.
    
    IF target_user_id IS NULL THEN
        -- Fallback for specific dev user if needed, or raise error. 
        -- For now, let's assume valid auth or manual ID passed if debugging.
        -- Checks for the well-known dev ID '00000000-0000-0000-0000-000000000001' if passed via a different param?
        -- To be safe given the context of "broken auth" earlier:
        -- Let's stick to taking an argument BUT verify it matches auth.uid() OR allow it if RLS is disabled.
        -- Actually, cleanest is to just use the one argument version that can be called from frontend safely?
        -- No, let's stick to auth.uid() and assume the auth fix I did earlier works.
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Clear existing future medication events for this user to prevent duplicates
    DELETE FROM public.calendar_events 
    WHERE user_id = target_user_id 
    AND type = 'medication' 
    AND scheduled_at > NOW();


    -- Loop through all active medications for the user
    FOR med IN 
        SELECT * FROM public.medications 
        WHERE user_id = target_user_id 
        AND is_active = true
    LOOP
        -- Skip if no frequency (cannot schedule)
        IF med.frequency IS NULL OR med.frequency <= 0 THEN
            CONTINUE;
        END IF;

        med_frequency := med.frequency;
        -- Default duration to 7 days if not set, or use medication's duration
        med_duration := COALESCE(med.duration_days, 7);
        
        -- Start scheduling from now, rounded up to next :00 or :30
        start_ts := date_trunc('hour', NOW()) +
            CASE
                WHEN EXTRACT(MINUTE FROM NOW()) = 0 THEN INTERVAL '0 minutes'
                WHEN EXTRACT(MINUTE FROM NOW()) <= 30 THEN INTERVAL '30 minutes'
                ELSE INTERVAL '1 hour'
            END;

        -- Loop for each day of duration
        FOR day_offset IN 0..(med_duration - 1) LOOP
            
            -- Schedule times for the day based on frequency
            hour_offset := 0;
            WHILE hour_offset < 24 LOOP
                
                -- Construct timestamp
                event_ts := (start_ts::DATE + make_interval(days => day_offset) + make_interval(hours => hour_offset));
                
                -- Skip events before the start time (relevant for day 0)
                IF event_ts < start_ts THEN
                    hour_offset := hour_offset + med_frequency;
                    CONTINUE;
                END IF;

                -- Insert event
                INSERT INTO public.calendar_events (
                    user_id,
                    document_id,
                    medication_id,
                    title,
                    description,
                    type,
                    scheduled_at,
                    duration_minutes,
                    completed
                ) VALUES (
                    target_user_id,
                    med.document_id,
                    med.id,
                    concat('💊 ', med.name, ' ', COALESCE(med.dosage, '')),
                    concat('Take medication - Every ', med_frequency, ' hours'),
                    'medication',
                    event_ts,
                    15,
                    false
                );

                hour_offset := hour_offset + med_frequency;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
