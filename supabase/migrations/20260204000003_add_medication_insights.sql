-- Add precaution and monitoring_recommendation columns to medications table
ALTER TABLE medications ADD COLUMN IF NOT EXISTS precaution TEXT;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS monitoring_recommendation TEXT;
