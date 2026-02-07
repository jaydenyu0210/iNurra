-- Add duration and frequency to todo_items for medication-like scheduling
ALTER TABLE public.todo_items 
ADD COLUMN IF NOT EXISTS frequency_hours INTEGER,
ADD COLUMN IF NOT EXISTS duration_days INTEGER;
