-- Add DELETE policies for documents, medications, and health_metrics tables
-- This allows users to delete their own data

-- Documents delete policy (for dev mode, allow all - should be user_id = auth.uid() in production)
CREATE POLICY "dev_allow_delete_documents" ON public.documents
    FOR DELETE
    USING (true);

-- Medications delete policy
CREATE POLICY "dev_allow_delete_medications" ON public.medications
    FOR DELETE
    USING (true);

-- Health metrics delete policy
CREATE POLICY "dev_allow_delete_health_metrics" ON public.health_metrics
    FOR DELETE
    USING (true);

-- Storage policy for deleting files
CREATE POLICY "dev_allow_delete_storage" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'documents');
