DO $$
DECLARE
    target_user_id UUID;
    i INTEGER;
    weight NUMERIC;
    sys NUMERIC;
    dia NUMERIC;
    ts TIMESTAMP;
BEGIN
    -- Dev User ID
    target_user_id := '00000000-0000-0000-0000-000000000001';
    
    -- target_user_id := auth.uid();
    -- IF target_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;

    -- Insert 10 Weight entries over last 10 days
    FOR i IN 1..10 LOOP
        weight := 150 + (random() * 5); -- Random weight 150-155
        ts := NOW() - (i || ' days')::INTERVAL;
        INSERT INTO public.health_metrics (user_id, metric_type, value, unit, recorded_at)
        VALUES (target_user_id, 'Weight', round(weight, 1), 'lbs', ts);
    END LOOP;

    -- Insert 10 BP entries over last 10 days
    FOR i IN 1..10 LOOP
        sys := 115 + (random() * 15); -- Systolic 115-130
        dia := 75 + (random() * 10);  -- Diastolic 75-85
        ts := NOW() - (i || ' days')::INTERVAL;
        
        INSERT INTO public.health_metrics (user_id, metric_type, value, unit, recorded_at)
        VALUES (target_user_id, 'Systolic Blood Pressure', round(sys, 0), 'mmHg', ts);
        
        INSERT INTO public.health_metrics (user_id, metric_type, value, unit, recorded_at)
        VALUES (target_user_id, 'Diastolic Blood Pressure', round(dia, 0), 'mmHg', ts);
    END LOOP;
END $$;
