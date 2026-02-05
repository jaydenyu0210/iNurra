-- Add indication column to medications table
ALTER TABLE medications ADD COLUMN IF NOT EXISTS indication TEXT;
