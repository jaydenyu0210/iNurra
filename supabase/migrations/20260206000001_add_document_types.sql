-- Add new document types to the document_type enum
-- These represent the KIND of document (not what was extracted from it)

DO $$
BEGIN
    -- Add prescription_label type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'prescription_label' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'prescription_label';
    END IF;
    
    -- Add prescription_paper type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'prescription_paper' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'prescription_paper';
    END IF;
    
    -- Add doctors_note type (if not already present as doctor_notes)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'doctors_note' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'doctors_note';
    END IF;
    
    -- Add lab_report type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lab_report' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'lab_report';
    END IF;
    
    -- Add imaging_report type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'imaging_report' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'imaging_report';
    END IF;
    
    -- Add health_device_reading type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'health_device_reading' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'health_device_reading';
    END IF;
    
    -- Add body_photo type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'body_photo' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'body_photo';
    END IF;
    
    -- Add stool_urine_photo type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'stool_urine_photo' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'stool_urine_photo';
    END IF;
    
    -- Add insurance_form type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'insurance_form' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'insurance_form';
    END IF;
    
    -- Add appointment_card type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'appointment_card' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'appointment_card';
    END IF;
    
    -- Add general_health_document type
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'general_health_document' AND enumtypid = 'document_type'::regtype) THEN
        ALTER TYPE document_type ADD VALUE 'general_health_document';
    END IF;
END $$;
