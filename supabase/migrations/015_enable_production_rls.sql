-- Comprehensive RLS enablement for all tables
-- Run this migration to enable production-ready Row Level Security

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

-- Re-enable RLS on medications table
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Re-enable RLS on calendar_events table  
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Re-enable RLS on documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Re-enable RLS on health_metrics table
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MEDICATIONS POLICIES
-- =============================================

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert their own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update their own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert medications" ON public.medications;
DROP POLICY IF EXISTS "Users can manage own medications" ON public.medications;
DROP POLICY IF EXISTS "dev_allow_delete_medications" ON public.medications;
DROP POLICY IF EXISTS "medications_select_own" ON public.medications;
DROP POLICY IF EXISTS "medications_insert_own" ON public.medications;
DROP POLICY IF EXISTS "medications_update_own" ON public.medications;
DROP POLICY IF EXISTS "medications_delete_own" ON public.medications;

-- Create comprehensive policies for medications
CREATE POLICY "medications_select_own" ON public.medications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "medications_insert_own" ON public.medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medications_update_own" ON public.medications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "medications_delete_own" ON public.medications
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CALENDAR EVENTS POLICIES
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own events" ON public.calendar_events;
DROP POLICY IF EXISTS "dev_allow_all_calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_select_own" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_insert_own" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_update_own" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_delete_own" ON public.calendar_events;

-- Create comprehensive policies for calendar_events
CREATE POLICY "calendar_select_own" ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "calendar_insert_own" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_update_own" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "calendar_delete_own" ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- DOCUMENTS POLICIES
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;

-- Create comprehensive policies for documents
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_own" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- HEALTH METRICS POLICIES
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own metrics" ON public.health_metrics;
DROP POLICY IF EXISTS "health_metrics_select_own" ON public.health_metrics;
DROP POLICY IF EXISTS "health_metrics_insert_own" ON public.health_metrics;
DROP POLICY IF EXISTS "health_metrics_update_own" ON public.health_metrics;
DROP POLICY IF EXISTS "health_metrics_delete_own" ON public.health_metrics;

-- Create comprehensive policies for health_metrics
CREATE POLICY "health_metrics_select_own" ON public.health_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "health_metrics_insert_own" ON public.health_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_metrics_update_own" ON public.health_metrics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "health_metrics_delete_own" ON public.health_metrics
  FOR DELETE USING (auth.uid() = user_id);
