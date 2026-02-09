-- Multi-label content classification and new content types
-- This migration adds support for:
-- 1. Multi-label document classification (a document can have multiple content types)
-- 2. Body condition tracking with dimensions
-- 3. Bodily excretion observations
-- 4. Todo items with calendar integration

-- Add content_labels to documents for multi-label support
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS content_labels TEXT[] DEFAULT '{}';

-- Update document_type enum with new types
-- Note: ADD VALUE IF NOT EXISTS requires PostgreSQL 9.3+
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'body_condition' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'body_condition';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bodily_excretion' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'bodily_excretion';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'todo_activity' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'todo_activity';
    END IF;
END $$;

-- Body conditions table for tracking physical body marks/conditions with dimensions
CREATE TABLE IF NOT EXISTS public.body_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  
  -- Location information
  body_location TEXT NOT NULL, -- e.g., 'left_arm', 'back', 'right_leg', 'face', 'chest', 'abdomen'
  location_description TEXT, -- More specific description, e.g., "inner forearm, 5cm from wrist"
  
  -- Dimensions (in millimeters for precision)
  width_mm NUMERIC,
  height_mm NUMERIC,
  area_mm2 NUMERIC, -- Can be calculated or estimated from irregular shapes
  depth_mm NUMERIC, -- For wounds, lesions with depth
  
  -- Visual characteristics
  color TEXT, -- e.g., 'red', 'purple', 'brown', 'pink', 'dark_red'
  texture TEXT, -- e.g., 'smooth', 'rough', 'scaly', 'raised', 'flat', 'crusty'
  shape TEXT, -- e.g., 'circular', 'oval', 'irregular', 'linear'
  
  -- Medical classification
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  condition_type TEXT, -- e.g., 'rash', 'wound', 'bruise', 'mole', 'lesion', 'burn', 'bite', 'swelling'
  
  -- Image with ruler annotation
  annotated_image_path TEXT, -- Path to image with ruler/dimension overlay
  
  -- Progression tracking
  previous_observation_id UUID REFERENCES public.body_conditions(id),
  
  -- Timestamps and notes
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bodily excretions table for tracking bodily output observations
CREATE TABLE IF NOT EXISTS public.bodily_excretions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  
  -- Type classification
  excretion_type TEXT NOT NULL CHECK (excretion_type IN ('stool', 'urine', 'vomit', 'blood', 'mucus', 'discharge', 'other')),
  
  -- Visual characteristics
  color TEXT, -- e.g., 'brown', 'yellow', 'red', 'black', 'green', 'clear'
  consistency TEXT, -- e.g., 'solid', 'soft', 'liquid', 'watery', 'mucousy', 'bloody'
  
  -- Quantity and frequency
  volume_ml NUMERIC,
  frequency_per_day INTEGER,
  
  -- Health indicators
  blood_present BOOLEAN DEFAULT false,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  abnormality_indicators TEXT[], -- e.g., ['foul_odor', 'unusual_color', 'blood_clots', 'mucus']
  
  -- Timestamps and notes
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Todo items table with calendar integration
CREATE TABLE IF NOT EXISTS public.todo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  calendar_event_id UUID, -- Will add FK after calendar_events is updated
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Scheduling
  due_date DATE,
  due_time TIME,
  scheduled_datetime TIMESTAMPTZ, -- Combined for calendar integration
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- iCal RRULE format, e.g., 'FREQ=DAILY;COUNT=7'
  
  -- Status
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add source tracking and priority to calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- Add check constraint for source_type (done separately to handle existing data)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_source_type_check'
    ) THEN
        ALTER TABLE public.calendar_events 
        ADD CONSTRAINT calendar_events_source_type_check 
        CHECK (source_type IN ('prescription', 'todo', 'appointment', 'manual'));
    END IF;
END $$;

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_priority_check'
    ) THEN
        ALTER TABLE public.calendar_events 
        ADD CONSTRAINT calendar_events_priority_check 
        CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
    END IF;
END $$;

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS todo_item_id UUID;

-- Now add FK constraint for todo_items.calendar_event_id
ALTER TABLE public.todo_items
ADD CONSTRAINT todo_items_calendar_event_fkey 
FOREIGN KEY (calendar_event_id) REFERENCES public.calendar_events(id) ON DELETE SET NULL;

-- Add FK constraint for calendar_events.todo_item_id
ALTER TABLE public.calendar_events
ADD CONSTRAINT calendar_events_todo_item_fkey 
FOREIGN KEY (todo_item_id) REFERENCES public.todo_items(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_body_conditions_user ON public.body_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_body_conditions_location ON public.body_conditions(body_location);
CREATE INDEX IF NOT EXISTS idx_body_conditions_observed ON public.body_conditions(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_body_conditions_type ON public.body_conditions(condition_type);

CREATE INDEX IF NOT EXISTS idx_bodily_excretions_user ON public.bodily_excretions(user_id);
CREATE INDEX IF NOT EXISTS idx_bodily_excretions_type ON public.bodily_excretions(excretion_type);
CREATE INDEX IF NOT EXISTS idx_bodily_excretions_observed ON public.bodily_excretions(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_todo_items_user ON public.todo_items(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_due ON public.todo_items(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_items_completed ON public.todo_items(completed);
CREATE INDEX IF NOT EXISTS idx_todo_items_priority ON public.todo_items(priority);

CREATE INDEX IF NOT EXISTS idx_documents_content_labels ON public.documents USING GIN(content_labels);

-- Row Level Security
ALTER TABLE public.body_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodily_excretions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage own body conditions" ON public.body_conditions;
CREATE POLICY "Users can manage own body conditions" ON public.body_conditions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own excretions" ON public.bodily_excretions;
CREATE POLICY "Users can manage own excretions" ON public.bodily_excretions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own todos" ON public.todo_items;
CREATE POLICY "Users can manage own todos" ON public.todo_items
  FOR ALL USING (auth.uid() = user_id);

-- Service role bypass policies for edge functions
DROP POLICY IF EXISTS "Service role can manage body conditions" ON public.body_conditions;
CREATE POLICY "Service role can manage body conditions" ON public.body_conditions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can manage excretions" ON public.bodily_excretions;
CREATE POLICY "Service role can manage excretions" ON public.bodily_excretions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can manage todos" ON public.todo_items;
CREATE POLICY "Service role can manage todos" ON public.todo_items
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

