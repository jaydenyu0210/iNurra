-- Add new columns to health_metrics table for enhanced health metric tracking
-- These fields provide AI-generated insights and normal range comparison

-- Measurement precautions - AI-generated paragraph about what to be careful of
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS measurement_precautions TEXT;

-- Monitoring guidance - AI-generated paragraph about how to monitor
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS monitoring_guidance TEXT;

-- Normal range bounds
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS normal_range_lower NUMERIC;
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS normal_range_upper NUMERIC;

-- Computed range status: 'normal', 'high', 'low'
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS range_status TEXT;

-- Add check constraint for range_status values
ALTER TABLE health_metrics DROP CONSTRAINT IF EXISTS check_range_status;
ALTER TABLE health_metrics ADD CONSTRAINT check_range_status 
  CHECK (range_status IS NULL OR range_status IN ('normal', 'high', 'low'));
