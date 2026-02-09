-- Add AI-generated insight fields for body conditions
-- These fields help users understand their conditions better

-- Possible condition (what it might be)
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS possible_condition TEXT;

-- Possible cause (what might have caused it)
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS possible_cause TEXT;

-- Care advice (how to care for it)
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS care_advice TEXT;

-- Precautions (what to be careful about)
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS precautions TEXT;

-- When to seek care (when to see a doctor)
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS when_to_seek_care TEXT;
