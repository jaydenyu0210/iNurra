-- Add schedule column to medications table to store AI-generated timestamps
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS schedule JSONB;

-- Add end_date column if not handled by app logic (schema already has it, checked previously)
-- We'll verify end_date exists. It does in initial schema?
-- Let's double check 001_initial_schema.sql or just add IF NOT EXISTS to be safe.
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS end_date DATE;
