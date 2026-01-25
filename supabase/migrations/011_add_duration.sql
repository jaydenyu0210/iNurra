-- Add duration field to medications table (in days)
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS duration_days INTEGER;
