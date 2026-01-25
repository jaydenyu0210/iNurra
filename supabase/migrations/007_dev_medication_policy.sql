-- Add dev-friendly insert policy for medications (allows inserts in dev mode)
-- This should be applied AFTER the restrictive policies in 005_medication_updates.sql

-- Drop the restrictive insert policy if it exists
DROP POLICY IF EXISTS "Users can insert their own medications" ON public.medications;

-- Create a more permissive insert policy that works in dev mode
CREATE POLICY "Users can insert medications" 
ON public.medications 
FOR INSERT 
WITH CHECK (
    -- Allow if authenticated user matches
    auth.uid() = user_id 
    OR 
    -- Allow in dev mode (when there's a user_id but no auth.uid())
    (auth.uid() IS NULL AND user_id IS NOT NULL)
);
