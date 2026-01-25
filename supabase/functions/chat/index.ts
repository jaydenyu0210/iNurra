import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
    corsHeaders,
    getSupabaseClient,
    getServiceClient,
    callGemini,
    callGeminiMultimodal,
    generateEmbedding,
} from '../_shared/utils.ts';

const SYSTEM_INSTRUCTION = `You are a helpful health assistant. You have access to the user's medical data (medications, metrics, documents) provided in the context.
RULES FOR USING CONTEXT:
1. **RELEVANCE IS KEY**: ONLY reference the user's medical data if the user's question is related to their health, medications, or documents.
2. **GREETINGS**: If the user asks a general question or greeting (e.g., "Hi", "How are you?"), respond socially, briefly, and politely WITHOUT mentioning their medical data unless they ask for a summary.
3. **UNKNOWN INFO**: If the user asks about a specific condition/medication NOT in the context, state clearly that you don't have that information in their records.
4. **NO DIAGNOSES**: Never provide medical diagnoses. Recommend consulting a doctor.

RESPONSE STYLE:
- Keep answers SHORT and CONCISE (2-3 sentences preferred for simple queries).
- Use simple, easy-to-understand language.`;

interface ChatRequest {
    sessionId?: string;
    message?: string;
    generateSuggestions?: boolean;
    transcribeAudio?: boolean;
    audio?: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('[Chat] Request received');

        const authHeader = req.headers.get('Authorization');
        console.log('[Chat] Auth header present:', !!authHeader);

        if (!authHeader) {
            console.error('[Chat] Missing auth header');
            return new Response(
                JSON.stringify({ error: 'No authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const body = await req.json();
        const { sessionId, message, generateSuggestions, transcribeAudio, audio } = body as ChatRequest;

        // Handle Audio Transcription
        if (transcribeAudio && audio) {
            console.log('Transcribing audio...');
            const transcript = await callGeminiMultimodal(
                [{ inline_data: { mime_type: "audio/mp4", data: audio } }],
                "Transcribe this audio exactly as spoken. Return ONLY the text, no other commentary."
            );
            console.log('Transcription result:', transcript);

            return new Response(
                JSON.stringify({ text: transcript }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[Chat] Body parsed, sessionId:', body.sessionId, 'generateSuggestions:', body.generateSuggestions);

        if (!message && !generateSuggestions) {
            console.error('[Chat] No message or suggestions request provided');
            return new Response(
                JSON.stringify({ error: 'Message or generateSuggestions required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = getSupabaseClient(authHeader);
        console.log('[Chat] Supabase client initialized');

        // Extract token
        const token = authHeader.replace('Bearer ', '');

        // Get current user
        console.log('[Chat] Fetching user...');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        console.log('[Chat] User fetch result - ID:', user?.id, 'Error:', userError?.message);

        if (userError || !user) {
            console.error('[Chat] Authentication failed:', userError);
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create or get chat session
        let currentSessionId = sessionId;
        if (!currentSessionId) {
            const { data: session, error: sessionError } = await supabase
                .from('chat_sessions')
                .insert({ user_id: user.id })
                .select()
                .single();

            if (sessionError) throw sessionError;
            currentSessionId = session.id;
        }

        // Save user message if provided
        if (message) {
            await supabase.from('chat_messages').insert({
                session_id: currentSessionId,
                role: 'user',
                content: message,
            });
        }

        // Use service client for data fetching (bypasses RLS)
        const serviceClient = getServiceClient();

        // Step 1: Generate embedding (use message or specific query for suggestions)
        const queryText = message || 'health summary important medical history';
        console.log('Generating embedding for:', queryText);
        const questionEmbedding = await generateEmbedding(queryText);

        // Step 2: Fetch user's current medications (using service client)
        console.log('Fetching user medications for user:', user.id);
        const { data: medications, error: medsError } = await serviceClient
            .from('medications')
            .select('name, dosage, frequency, quantity, duration_days, instructions, start_date, end_date')
            .eq('user_id', user.id);

        console.log('Medications found:', medications?.length || 0, medsError ? `Error: ${medsError.message}` : '');
        if (medications && medications.length > 0) {
            console.log('Medication names:', medications.map(m => m.name));
        }

        // Step 3: Fetch user's current health metrics (using service client)
        console.log('Fetching user health metrics...');
        const { data: healthMetrics, error: metricsError } = await serviceClient
            .from('health_metrics')
            .select('metric_type, value, unit, recorded_at')
            .eq('user_id', user.id)
            .order('recorded_at', { ascending: false })
            .limit(50);


        console.log('Health metrics found:', healthMetrics?.length || 0, metricsError ? `Error: ${metricsError.message}` : '');
        if (healthMetrics && healthMetrics.length > 0) {
            console.log('Metric types:', [...new Set(healthMetrics.map(m => m.metric_type))]);
        }

        // Step 4: Vector similarity search for relevant documents (using service client)
        console.log('Searching for relevant documents for user:', user.id);
        const { data: relevantDocs, error: searchError } = await serviceClient.rpc(
            'match_documents',
            {
                query_embedding: questionEmbedding,
                match_threshold: 0.5, // Increased from 0.3 to reduce noise
                match_count: 5,
                user_id_filter: user.id,
            }
        );

        if (searchError) {
            console.error('Document search error:', searchError.message);
        }
        console.log('Documents found:', relevantDocs?.length || 0);
        if (relevantDocs && relevantDocs.length > 0) {
            console.log('Document types:', relevantDocs.map((d: any) => d.type));
        }

        // Build context from user data
        let context = '';
        const sources: string[] = [];

        // Add medications to context
        if (medications && medications.length > 0) {
            context += '=== USER\'S CURRENT MEDICATIONS ===\n';
            for (const med of medications) {
                context += `- ${med.name}`;
                if (med.dosage) context += ` (${med.dosage})`;
                if (med.frequency) context += `, ${med.frequency}`;
                if (med.instructions) context += `, ${med.instructions}`;
                if (med.start_date) context += `, started: ${med.start_date}`;
                if (med.end_date) context += `, ends: ${med.end_date}`;
                context += '\n';
            }
            context += '\n';
            sources.push(`${medications.length} medication(s) on file`);
        } else {
            context += '=== USER\'S CURRENT MEDICATIONS ===\nNo medications currently on file.\n\n';
        }

        // Add health metrics to context
        if (healthMetrics && healthMetrics.length > 0) {
            context += '=== USER\'S HEALTH METRICS ===\n';
            // Group by metric type for clarity
            const metricsByType: Record<string, typeof healthMetrics> = {};
            for (const metric of healthMetrics) {
                if (!metricsByType[metric.metric_type]) {
                    metricsByType[metric.metric_type] = [];
                }
                metricsByType[metric.metric_type].push(metric);
            }
            for (const [type, metrics] of Object.entries(metricsByType)) {
                context += `${type}:\n`;
                for (const m of metrics.slice(0, 5)) { // Show last 5 of each type
                    context += `  - ${m.value} ${m.unit} (recorded: ${m.recorded_at})\n`;
                }
            }
            context += '\n';
            sources.push(`${healthMetrics.length} health metric(s) on file`);
        } else {
            context += '=== USER\'S HEALTH METRICS ===\nNo health metrics currently on file.\n\n';
        }

        // Add relevant documents to context
        if (relevantDocs && relevantDocs.length > 0) {
            context += '=== RELEVANT DOCUMENTS ===\n';
            for (const doc of relevantDocs) {
                context += `--- Document: ${doc.type} ---\n`;
                context += `Summary: ${doc.summary}\n`;
                if (doc.raw_text) {
                    context += `Content: ${doc.raw_text.slice(0, 1000)}...\n`;
                }
                context += '\n';
                sources.push(`${doc.type}: ${doc.summary?.slice(0, 50)}...`);
            }
        }

        // HANDLE SUGGESTION GENERATION
        if (generateSuggestions) {
            console.log('Generating suggestions based on context...');
            const suggestionPrompt = `${context}

Based on the user's health data above, generate 2 personalized questions they should ask their AI health assistant.
Focus on their active medications, recent health metrics, or recent documents (like discharge summaries).
Keep questions SHORT and CONCISE (under 15 words).
Return ONLY a JSON array of strings, like this: ["Question 1", "Question 2"]`;

            const suggestionsJson = await callGemini(suggestionPrompt, "You are a helpful assistant that generates questions.");
            console.log('Suggestions generated:', suggestionsJson);

            // Cleanup response to ensure it's valid JSON
            const cleanJson = suggestionsJson.replace(/```json/g, '').replace(/```/g, '').trim();
            const suggestions = JSON.parse(cleanJson);

            return new Response(
                JSON.stringify({ suggestions }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 3: Call Gemini with RAG context (Normal Chat)
        console.log('Calling Gemini with context...');
        const fullPrompt = `${context}\n\nUser question: ${message}`;
        const aiResponse = await callGemini(fullPrompt, SYSTEM_INSTRUCTION);

        // Save assistant response
        await supabase.from('chat_messages').insert({
            session_id: currentSessionId,
            role: 'assistant',
            content: aiResponse,
            metadata: { sources },
        });

        console.log('Response saved');

        return new Response(
            JSON.stringify({
                sessionId: currentSessionId,
                message: aiResponse,
                sources
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error in chat:', error);

        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
