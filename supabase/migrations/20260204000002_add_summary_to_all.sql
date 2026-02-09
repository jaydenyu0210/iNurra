-- Add summary column to health_metrics
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add summary column to body_conditions
ALTER TABLE body_conditions ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add summary column to bodily_excretions
ALTER TABLE bodily_excretions ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add summary column to tasks (if it exists, verify table name later or assume tasks/todos)
-- Checked previous logs, we haven't seen a 'tasks' table explicitly but 'calendar_events' is used for scheduling. 
-- User mentioned "todo items". Often these are just calendar events or a specific table. 
-- I will assume standard tables for now. If there is a separate todos table, I'll add it.
