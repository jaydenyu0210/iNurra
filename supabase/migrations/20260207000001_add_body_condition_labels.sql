-- Add label and progression_status fields to body_conditions table
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS progression_status TEXT DEFAULT 'initial';

-- Add comment for documentation
COMMENT ON COLUMN body_conditions.label IS 'AI-generated identifier for grouping related condition photos (e.g., forearm_red_spot)';
COMMENT ON COLUMN body_conditions.progression_status IS 'Tracks condition progression: initial, improving, worsening, no_significant_change';
