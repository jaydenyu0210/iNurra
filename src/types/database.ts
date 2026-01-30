// Database types generated from Supabase schema
// Run: npx supabase gen types typescript --local > src/types/database.ts

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    phone: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    settings: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    phone: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    settings?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    phone?: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    settings?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            documents: {
                Row: {
                    id: string;
                    user_id: string;
                    type: DocumentType;
                    content_labels: string[];
                    storage_path: string;
                    file_name: string | null;
                    mime_type: string | null;
                    raw_text: string | null;
                    summary: string | null;
                    title: string | null;
                    extracted_data: Json;
                    embedding: number[] | null;
                    processing_status: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    type: DocumentType;
                    content_labels?: string[];
                    storage_path: string;
                    file_name?: string | null;
                    mime_type?: string | null;
                    raw_text?: string | null;
                    summary?: string | null;
                    title?: string | null;
                    extracted_data?: Json;
                    embedding?: number[] | null;
                    processing_status?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    type?: DocumentType;
                    content_labels?: string[];
                    storage_path?: string;
                    file_name?: string | null;
                    mime_type?: string | null;
                    raw_text?: string | null;
                    summary?: string | null;
                    title?: string | null;
                    extracted_data?: Json;
                    embedding?: number[] | null;
                    processing_status?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            medications: {
                Row: {
                    id: string;
                    user_id: string;
                    document_id: string | null;
                    name: string;
                    dosage: string | null;
                    frequency: string | null;
                    instructions: string | null;
                    start_date: string | null;
                    end_date: string | null;
                    is_active: boolean;
                    quantity: number | null;
                    duration_days: number | null;
                    schedule: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    document_id?: string | null;
                    name: string;
                    dosage?: string | null;
                    frequency?: string | null;
                    instructions?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    is_active?: boolean;
                    quantity?: number | null;
                    duration_days?: number | null;
                    schedule?: Json | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    document_id?: string | null;
                    name?: string;
                    dosage?: string | null;
                    frequency?: string | null;
                    instructions?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    is_active?: boolean;
                    quantity?: number | null;
                    duration_days?: number | null;
                    schedule?: Json | null;
                    created_at?: string;
                };
            };
            health_metrics: {
                Row: {
                    id: string;
                    user_id: string;
                    source_document_id: string | null;
                    metric_type: string;
                    value: number;
                    unit: string;
                    recorded_at: string;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    source_document_id?: string | null;
                    metric_type: string;
                    value: number;
                    unit: string;
                    recorded_at: string;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    source_document_id?: string | null;
                    metric_type?: string;
                    value?: number;
                    unit?: string;
                    recorded_at?: string;
                    notes?: string | null;
                    created_at?: string;
                };
            };
            calendar_events: {
                Row: {
                    id: string;
                    user_id: string;
                    document_id: string | null;
                    medication_id: string | null;
                    todo_item_id: string | null;
                    title: string;
                    description: string | null;
                    type: EventType;
                    source_type: SourceType;
                    priority: Priority;
                    scheduled_at: string;
                    end_time: string | null;
                    duration_minutes: number | null;
                    reminder_at: string | null;
                    is_recurring: boolean;
                    recurrence_rule: string | null;
                    completed: boolean;
                    completed_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    document_id?: string | null;
                    medication_id?: string | null;
                    todo_item_id?: string | null;
                    title: string;
                    description?: string | null;
                    type: EventType;
                    source_type?: SourceType;
                    priority?: Priority;
                    scheduled_at: string;
                    end_time?: string | null;
                    duration_minutes?: number | null;
                    reminder_at?: string | null;
                    is_recurring?: boolean;
                    recurrence_rule?: string | null;
                    completed?: boolean;
                    completed_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    document_id?: string | null;
                    medication_id?: string | null;
                    todo_item_id?: string | null;
                    title?: string;
                    description?: string | null;
                    type?: EventType;
                    source_type?: SourceType;
                    priority?: Priority;
                    scheduled_at?: string;
                    end_time?: string | null;
                    duration_minutes?: number | null;
                    reminder_at?: string | null;
                    is_recurring?: boolean;
                    recurrence_rule?: string | null;
                    completed?: boolean;
                    completed_at?: string | null;
                    created_at?: string;
                };
            };
            chat_sessions: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string | null;
                    summary: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    title?: string | null;
                    summary?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    title?: string | null;
                    summary?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            chat_messages: {
                Row: {
                    id: string;
                    session_id: string;
                    role: MessageRole;
                    content: string;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    role: MessageRole;
                    content: string;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    role?: MessageRole;
                    content?: string;
                    metadata?: Json;
                    created_at?: string;
                };
            };
            emergency_contacts: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    phone: string | null;
                    email: string | null;
                    relationship: string | null;
                    is_doctor: boolean;
                    notify_on_alert: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    phone?: string | null;
                    email?: string | null;
                    relationship?: string | null;
                    is_doctor?: boolean;
                    notify_on_alert?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    phone?: string | null;
                    email?: string | null;
                    relationship?: string | null;
                    is_doctor?: boolean;
                    notify_on_alert?: boolean;
                    created_at?: string;
                };
            };
            body_conditions: {
                Row: {
                    id: string;
                    user_id: string;
                    document_id: string | null;
                    body_location: string;
                    location_description: string | null;
                    width_mm: number | null;
                    height_mm: number | null;
                    area_mm2: number | null;
                    depth_mm: number | null;
                    color: string | null;
                    texture: string | null;
                    shape: string | null;
                    severity: Severity | null;
                    condition_type: string | null;
                    annotated_image_path: string | null;
                    previous_observation_id: string | null;
                    observed_at: string;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    document_id?: string | null;
                    body_location: string;
                    location_description?: string | null;
                    width_mm?: number | null;
                    height_mm?: number | null;
                    area_mm2?: number | null;
                    depth_mm?: number | null;
                    color?: string | null;
                    texture?: string | null;
                    shape?: string | null;
                    severity?: Severity | null;
                    condition_type?: string | null;
                    annotated_image_path?: string | null;
                    previous_observation_id?: string | null;
                    observed_at?: string;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    document_id?: string | null;
                    body_location?: string;
                    location_description?: string | null;
                    width_mm?: number | null;
                    height_mm?: number | null;
                    area_mm2?: number | null;
                    depth_mm?: number | null;
                    color?: string | null;
                    texture?: string | null;
                    shape?: string | null;
                    severity?: Severity | null;
                    condition_type?: string | null;
                    annotated_image_path?: string | null;
                    previous_observation_id?: string | null;
                    observed_at?: string;
                    notes?: string | null;
                    created_at?: string;
                };
            };
            bodily_excretions: {
                Row: {
                    id: string;
                    user_id: string;
                    document_id: string | null;
                    excretion_type: ExcretionType;
                    color: string | null;
                    consistency: string | null;
                    volume_ml: number | null;
                    frequency_per_day: number | null;
                    blood_present: boolean;
                    pain_level: number | null;
                    abnormality_indicators: string[] | null;
                    observed_at: string;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    document_id?: string | null;
                    excretion_type: ExcretionType;
                    color?: string | null;
                    consistency?: string | null;
                    volume_ml?: number | null;
                    frequency_per_day?: number | null;
                    blood_present?: boolean;
                    pain_level?: number | null;
                    abnormality_indicators?: string[] | null;
                    observed_at?: string;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    document_id?: string | null;
                    excretion_type?: ExcretionType;
                    color?: string | null;
                    consistency?: string | null;
                    volume_ml?: number | null;
                    frequency_per_day?: number | null;
                    blood_present?: boolean;
                    pain_level?: number | null;
                    abnormality_indicators?: string[] | null;
                    observed_at?: string;
                    notes?: string | null;
                    created_at?: string;
                };
            };
            todo_items: {
                Row: {
                    id: string;
                    user_id: string;
                    document_id: string | null;
                    calendar_event_id: string | null;
                    title: string;
                    description: string | null;
                    priority: Priority;
                    due_date: string | null;
                    due_time: string | null;
                    scheduled_datetime: string | null;
                    is_recurring: boolean;
                    recurrence_rule: string | null;
                    completed: boolean;
                    completed_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    document_id?: string | null;
                    calendar_event_id?: string | null;
                    title: string;
                    description?: string | null;
                    priority?: Priority;
                    due_date?: string | null;
                    due_time?: string | null;
                    scheduled_datetime?: string | null;
                    is_recurring?: boolean;
                    recurrence_rule?: string | null;
                    completed?: boolean;
                    completed_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    document_id?: string | null;
                    calendar_event_id?: string | null;
                    title?: string;
                    description?: string | null;
                    priority?: Priority;
                    due_date?: string | null;
                    due_time?: string | null;
                    scheduled_datetime?: string | null;
                    is_recurring?: boolean;
                    recurrence_rule?: string | null;
                    completed?: boolean;
                    completed_at?: string | null;
                    created_at?: string;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {
            document_type: DocumentType;
            event_type: EventType;
            message_role: MessageRole;
            source_type: SourceType;
            priority: Priority;
            severity: Severity;
            excretion_type: ExcretionType;
        };
    };
};

// Enum types
export type DocumentType = 
    | 'prescription' 
    | 'test_result' 
    | 'discharge_summary' 
    | 'doctor_notes' 
    | 'health_metrics' 
    | 'audio_transcript' 
    | 'body_condition'
    | 'bodily_excretion'
    | 'todo_activity'
    | 'other';

export type EventType = 'medication' | 'appointment' | 'todo' | 'reminder';

export type MessageRole = 'user' | 'assistant' | 'system';

export type SourceType = 'prescription' | 'todo' | 'appointment' | 'manual';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Severity = 'mild' | 'moderate' | 'severe' | 'critical';

export type ExcretionType = 'stool' | 'urine' | 'vomit' | 'blood' | 'mucus' | 'discharge' | 'other';

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Convenience types
export type User = Tables<'users'>;
export type Document = Tables<'documents'>;
export type Medication = Tables<'medications'>;
export type HealthMetric = Tables<'health_metrics'>;
export type CalendarEvent = Tables<'calendar_events'>;
export type ChatSession = Tables<'chat_sessions'>;
export type ChatMessage = Tables<'chat_messages'>;
export type EmergencyContact = Tables<'emergency_contacts'>;
export type BodyCondition = Tables<'body_conditions'>;
export type BodilyExcretion = Tables<'bodily_excretions'>;
export type TodoItem = Tables<'todo_items'>;

// Extracted data types from document processing
export interface ExtractedMedication {
    name: string;
    dosage: string | null;
    quantity: number | null;
    frequencyHours: number | null;
    durationDays: number | null;
    startDate: string;
    endDate: string | null;
    instructions: string | null;
    schedule: string[];
    calendarEvents: {
        title: string;
        scheduledAt: string;
        reminderAt: string | null;
        isRecurring: boolean;
        recurrenceRule: string;
    }[];
}

export interface ExtractedMetric {
    name: string;
    value: number;
    unit: string;
    recordedAt: string;
    isAbnormal: boolean | null;
    referenceRange: string | null;
}

export interface ExtractedTodo {
    title: string;
    description: string | null;
    priority: Priority;
    dueDate: string | null;
    dueTime: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
    calendarEvent: {
        title: string;
        scheduledAt: string;
        reminderAt: string | null;
        type: 'todo';
    } | null;
}

export interface ExtractedBodyCondition {
    bodyLocation: string;
    locationDescription: string;
    conditionType: string;
    color: string | null;
    texture: string | null;
    shape: string | null;
    severity: Severity;
    dimensions: {
        widthMm: number | null;
        heightMm: number | null;
        areaMm2: number | null;
        depthMm: number | null;
        estimationMethod: string;
    };
    rulerAnnotation: {
        shouldAddRuler: boolean;
        suggestedScale: string;
        boundingBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    };
    notes: string | null;
}

export interface ExtractedBodilyExcretion {
    excretionType: ExcretionType;
    color: string | null;
    consistency: string | null;
    volumeMl: number | null;
    frequencyPerDay: number | null;
    bloodPresent: boolean;
    painLevel: number | null;
    abnormalityIndicators: string[];
    observedAt: string;
    notes: string | null;
}

export interface DocumentExtractedData {
    contentLabels: string[];
    primaryType: DocumentType;
    title: string;
    summary: string;
    medications?: ExtractedMedication[];
    metrics?: ExtractedMetric[];
    todos?: ExtractedTodo[];
    bodyConditions?: ExtractedBodyCondition[];
    bodilyExcretions?: ExtractedBodilyExcretion[];
    keyPoints?: string[];
    diagnoses?: string[];
    treatmentPlan?: string | null;
}
