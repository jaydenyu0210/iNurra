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
                    type: 'prescription' | 'test_result' | 'discharge_summary' | 'doctor_notes' | 'health_metrics' | 'audio_transcript' | 'other';
                    storage_path: string;
                    file_name: string | null;
                    mime_type: string | null;
                    raw_text: string | null;
                    summary: string | null;
                    extracted_data: Json;
                    embedding: number[] | null;
                    processing_status: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    type: 'prescription' | 'test_result' | 'discharge_summary' | 'doctor_notes' | 'health_metrics' | 'audio_transcript' | 'other';
                    storage_path: string;
                    file_name?: string | null;
                    mime_type?: string | null;
                    raw_text?: string | null;
                    summary?: string | null;
                    extracted_data?: Json;
                    embedding?: number[] | null;
                    processing_status?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    type?: 'prescription' | 'test_result' | 'discharge_summary' | 'doctor_notes' | 'health_metrics' | 'audio_transcript' | 'other';
                    storage_path?: string;
                    file_name?: string | null;
                    mime_type?: string | null;
                    raw_text?: string | null;
                    summary?: string | null;
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
                    title: string;
                    description: string | null;
                    type: 'medication' | 'appointment' | 'todo' | 'reminder';
                    scheduled_at: string;
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
                    title: string;
                    description?: string | null;
                    type: 'medication' | 'appointment' | 'todo' | 'reminder';
                    scheduled_at: string;
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
                    title?: string;
                    description?: string | null;
                    type?: 'medication' | 'appointment' | 'todo' | 'reminder';
                    scheduled_at?: string;
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
                    role: 'user' | 'assistant' | 'system';
                    content: string;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    role: 'user' | 'assistant' | 'system';
                    content: string;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    role?: 'user' | 'assistant' | 'system';
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
        };
        Views: {};
        Functions: {};
        Enums: {
            document_type: 'prescription' | 'test_result' | 'discharge_summary' | 'doctor_notes' | 'health_metrics' | 'audio_transcript' | 'other';
            event_type: 'medication' | 'appointment' | 'todo' | 'reminder';
            message_role: 'user' | 'assistant' | 'system';
        };
    };
};

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
