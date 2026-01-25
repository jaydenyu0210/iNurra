-- Change quantity to integer (or numeric if partials needed)
ALTER TABLE public.medications 
DROP COLUMN quantity,
ADD COLUMN quantity NUMERIC;

-- Change frequency to integer (representing hours between doses)
-- We'll drop the old text frequency and add a new integer one
-- OR we could try to convert, but it's mixed text data. Dropping/Adding is cleaner for dev.
ALTER TABLE public.medications 
DROP COLUMN frequency,
ADD COLUMN frequency INTEGER; 

-- Add default constraint or check? 
-- Let's just keep it simple for now.
