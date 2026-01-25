-- Add quantity to medications table
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS quantity TEXT;

-- Ensure RLS policies for medications allow Select/Insert/Update/Delete for owners
-- (Delete was added in 003, ensuring others here)

create policy "Users can view their own medications"
on public.medications for select
using (auth.uid() = user_id);

create policy "Users can insert their own medications"
on public.medications for insert
with check (auth.uid() = user_id);

create policy "Users can update their own medications"
on public.medications for update
using (auth.uid() = user_id);
