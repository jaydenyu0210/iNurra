-- Rename frequency_hours to frequency_days for todo_items
ALTER TABLE public.todo_items 
RENAME COLUMN frequency_hours TO frequency_days;
