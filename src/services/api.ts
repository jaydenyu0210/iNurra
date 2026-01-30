import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

// Helper to get current user from Supabase or auth store (for dev mode)
export async function getCurrentUser() {
    // First try Supabase
    if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) return user;
    }

    // Fallback to auth store (for dev mock session)
    const storeUser = useAuthStore.getState().user;
    return storeUser;
}

// Document upload and processing
export async function uploadDocument(
    file: { uri: string; name: string; type: string },
    documentType: string
): Promise<{ documentId: string; storagePath: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // Read file as base64 using expo-file-system (reliable on React Native)
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
    });

    // Convert base64 to ArrayBuffer
    const arrayBuffer = decode(base64);

    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, arrayBuffer, {
            contentType: file.type,
        });

    if (uploadError) throw uploadError;

    // Create document record
    const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
            user_id: user.id,
            type: documentType,
            storage_path: fileName,
            file_name: file.name,
            mime_type: file.type,
            processing_status: 'pending',
        } as any)
        .select('id')
        .single();

    if (docError) throw docError;
    if (!doc) throw new Error('Failed to create document');

    return { documentId: (doc as any).id, storagePath: fileName };
}

// Trigger document processing Edge Function
export async function processDocument(documentId: string, storagePath: string) {
    const { data, error } = await supabase.functions.invoke('process-document', {
        body: { documentId, storagePath },
    });

    if (error) throw error;
    return data;
}

// Chat with AI assistant (with session history)
// Chat with AI assistant (with session history)
export async function sendChatMessage(
    message?: string,
    sessionId?: string,
    documentId?: string,
    generateSuggestions?: boolean
): Promise<{ sessionId?: string; message?: string; sources?: string[]; suggestions?: string[] }> {
    const { data, error } = await supabase.functions.invoke('chat', {
        body: {
            message,
            sessionId: sessionId?.startsWith('new-') ? undefined : sessionId,
            generateSuggestions,
        },
    });

    if (error) throw error;

    return data;
}

// Transcribe audio using AI
export async function transcribeAudio(base64Audio: string): Promise<{ text: string }> {
    const { data, error } = await supabase.functions.invoke('chat', {
        body: {
            transcribeAudio: true,
            audio: base64Audio,
        },
    });

    if (error) throw error;
    return data;
}

// Get user's documents
export async function getDocuments() {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// Get document by ID
export async function getDocument(id: string) {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

// Get user's medications
export async function getMedications() {
    const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// Get user's health metrics
export async function getHealthMetrics(metricType?: string, limit = 30) {
    let query = supabase
        .from('health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(limit);

    if (metricType) {
        query = query.eq('metric_type', metricType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

// Get chat sessions
export async function getChatSessions() {
    const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
}

// Get chat messages for a session
export async function getChatMessages(sessionId: string) {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}

// Get calendar events
export async function getCalendarEvents(startDate: string, endDate: string) {
    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('scheduled_at', startDate)
        .lte('scheduled_at', endDate)
        .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data;
}

// Delete a document (and its storage file)
export async function deleteDocument(documentId: string) {
    // First get the document to find storage path
    const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', documentId)
        .single<{ storage_path: string | null }>();

    if (fetchError) throw fetchError;

    // Delete from storage
    if (doc?.storage_path) {
        await supabase.storage.from('documents').remove([doc.storage_path]);
    }

    // Delete related records
    await supabase.from('health_metrics').delete().eq('source_document_id', documentId);
    await supabase.from('medications').delete().eq('source_document_id', documentId);

    // Delete the document record
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    if (error) throw error;
}

// Delete a medication
export async function deleteMedication(medicationId: string) {
    const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', medicationId);

    if (error) throw error;
}

// Delete a health metric
export async function deleteHealthMetric(metricId: string) {
    const { error } = await supabase
        .from('health_metrics')
        .delete()
        .eq('id', metricId);

    if (error) throw error;
}
