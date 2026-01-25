import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
    corsHeaders,
    getServiceClient,
    extractTextWithVision,
    callGemini,
    generateEmbedding,
} from '../_shared/utils.ts';

const CLASSIFICATION_PROMPT = `
You are an expert medical document analyzer. Analyze the text extracted from this document and provide a structured JSON response.

Document Types to Identify (CHOOSE THE MOST SPECIFIC TYPE - NEVER use 'other' if a more specific type applies):

1. prescription: ANY document related to medications. This includes:
   - Pharmacy labels, pill bottle labels, medication packaging
   - Prescription papers from doctors
   - Medication instruction sheets
   - ANY text mentioning drug names, dosages, "take X times daily", "Rx", NDC numbers
   - IMPORTANT: If you see ANY medication name (e.g. Tylenol, Ibuprofen, Metformin, Lisinopril, etc.), classify as 'prescription'

2. health_metrics: ANY document showing health measurements. This includes:
   - Digital device displays (scales, BP monitors, glucometers, thermometers)
   - Handwritten or printed logs of blood pressure, weight, glucose, temperature
   - Photos of fitness trackers, smartwatch health data
   - IMPORTANT: If you see numbers that look like weight (e.g. 126.4, 180 lbs), blood pressure (e.g. 120/80), glucose, heart rate - classify as 'health_metrics'
   - OCR ERROR HANDLING: If you see a number like "1264" on a scale, it likely means missing decimal "126.4"

3. test_result: Lab results, blood work, pathology reports, imaging results

4. doctor_notes: Clinical notes, visit summaries, referral letters

5. other: ONLY use this for documents that clearly do NOT fit any above category (e.g. insurance forms, bills, appointment reminders with no medical data)

CRITICAL: When in doubt between 'prescription' and 'other', choose 'prescription'.
CRITICAL: When in doubt between 'health_metrics' and 'other', choose 'health_metrics'.

Extract specific data:
- title: string (Generate a short, descriptive title for the document, e.g. "Blood Test Results - Oct 2023" or "Hospital Discharge Summary". Infer date if possible.)
- summary: string (Write a short, detailed, concise, accurate, simple, and easy-to-understand summary of the document. Focus on key information and main points. Use clear, plain language that anyone can understand. Keep it brief but informative.)

Extract specific data based on type:

For 'prescription':
- medications: Array of objects. ALWAYS include ALL of the following fields for EACH medication identified:
  - name: string (Medication name) - REQUIRED, must always be present. If cannot determine, use null.
  - dosage: string (e.g. "500mg", "10ml") - If not found or unclear, use null.
  - quantity: number (Total count of tablets/pills/units, e.g. 30) - If not found or unclear, use null.
  - frequencyHours: number (Interval in hours between doses. IMPORTANT: Convert natural language to hours)
    * "once daily" / "daily" / "once a day" / "QD" → 24
    * "twice daily" / "twice a day" / "BID" → 12
    * "three times daily" / "3 times a day" / "TID" → 8
    * "four times daily" / "4 times a day" / "QID" → 6
    * "every 8 hours" / "q8h" → 8
    * "every 12 hours" / "q12h" → 12
    * If not found or unclear, use null.
  - durationDays: number (Total days. If not explicit, CALCULATE: quantity / (24 / frequencyHours). Round up.)
  - endDate: string (Calculated end date YYYY-MM-DD based on start date being tomorrow + duration)
  - schedule: string[] (List of proposed ISO 8601 timestamps for EVERY dose for the full duration. Assume start date is tomorrow. E.g. ["2024-01-25T08:00:00Z", "2024-01-25T16:00:00Z", ...]. Start times at 08:00 if not specified.)
  - instructions: string (e.g. "Take with food", "Before bedtime") - If not found, use empty string "" or null.

For 'test_result' or 'health_metrics':
- metrics: Array of objects with:
  - name: string (Standardized. e.g. "Systolic Blood Pressure", "Diastolic Blood Pressure", "Heart Rate", "Glucose", "Total Cholesterol", "Weight")
  - value: number (Extract numeric value. CRITICAL: If composite like "120/80", SPLIT into two separate metrics: one for Systolic (120) and one for Diastolic (80))
  - unit: string (e.g. "mmHg", "mg/dL", "bpm", "lbs", "kg")
  - recordedAt: string (ISO 8601 timestamp. Extract date/time from document if present. If not found, use current timestamp.)

For 'doctor_notes':
- keyPoints: Array of strings
- todos: Array of { task, dueDate }

Also provide a brief 'summary'.

Return ONLY raw JSON, no markdown.
`;

interface ProcessDocumentRequest {
    documentId: string;
    storagePath: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, storagePath }: ProcessDocumentRequest = await req.json();

        if (!documentId || !storagePath) {
            return new Response(
                JSON.stringify({ error: 'documentId and storagePath required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check for required secrets
        const missingSecrets: string[] = [];
        if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) missingSecrets.push('SUPABASE_SERVICE_ROLE_KEY');
        if (!Deno.env.get('GOOGLE_CLOUD_API_KEY')) missingSecrets.push('GOOGLE_CLOUD_API_KEY');
        if (!Deno.env.get('GEMINI_API_KEY')) missingSecrets.push('GEMINI_API_KEY');

        if (missingSecrets.length > 0) {
            console.error('Missing secrets:', missingSecrets);
            return new Response(
                JSON.stringify({ error: `Server configuration error: Missing secrets: ${missingSecrets.join(', ')}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = getServiceClient();

        // Get signed URL for the document
        console.log(`[Step 1] Creating signed URL for ${storagePath}`);
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(storagePath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
            throw new Error(`Failed to get signed URL: ${signedUrlError?.message}`);
        }

        // Update status to processing
        console.log(`[Step 2] Updating status to processing for ${documentId}`);
        const { error: initialUpdateError } = await supabase
            .from('documents')
            .update({ processing_status: 'processing' })
            .eq('id', documentId);

        if (initialUpdateError) {
            console.error('Failed to update status:', initialUpdateError);
            // Verify if the document exists and RLS allows service role
            throw new Error(`Failed to update document status: ${initialUpdateError.message}`);
        }

        // Step 1: Extract text with Vision OCR
        console.log('[Step 3] Extracting text with Vision OCR...');
        const extractedText = await extractTextWithVision(signedUrlData.signedUrl);

        if (!extractedText) {
            throw new Error('No text could be extracted from the document');
        }

        // Step 2: Classify and extract data with Gemini
        console.log('[Step 4] Classifying document with Gemini...');
        const currentTimestamp = new Date().toISOString();
        const currentYear = new Date().getFullYear();

        const promptWithContext = `${CLASSIFICATION_PROMPT}
CONTEXT:
- CURRENT TIMESTAMP: ${currentTimestamp}
- CURRENT YEAR: ${currentYear}
- If a date is found without a year (e.g. "Jan 24"), USE THE CURRENT YEAR (${currentYear}).
- If no date/time is found in the document, USE "${currentTimestamp}" EXACTLY as the recordedAt timestamp.


Text to analyze:
${extractedText}`;

        const classificationResponse = await callGemini(promptWithContext);

        console.log('Gemini raw response:', classificationResponse);

        // Parse the JSON response
        let extractedData;
        try {
            // Remove markdown code blocks if present
            const jsonStr = classificationResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            extractedData = JSON.parse(jsonStr);
            console.log('Classification result - Type:', extractedData.type);
            console.log('Classification result - Summary:', extractedData.summary);
        } catch {
            console.error('Failed to parse Gemini response:', classificationResponse);
            extractedData = {
                type: 'other',
                summary: 'Document processed but classification failed',
                medications: [],
                metrics: [],
                keyPoints: [],
            };
        }

        // Step 3: Generate embedding for RAG
        console.log('[Step 5] Generating embedding...');
        const embedding = await generateEmbedding(extractedText.slice(0, 5000)); // Limit text length

        // Step 4: Update document in database with extracted data BUT DO NOT CREATE CHILD RECORDS YET
        console.log('[Step 6] Saving extracted data...');
        const { error: updateError } = await supabase
            .from('documents')
            .update({
                raw_text: extractedText,
                summary: extractedData.summary,
                title: extractedData.title,
                type: extractedData.type || extractedData.documentType || 'other',
                extracted_data: extractedData,
                embedding: embedding,
                processing_status: 'completed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        if (updateError) {
            throw new Error(`Failed to update document: ${updateError.message}`);
        }

        // RETURN DATA TO FRONTEND FOR CONFIRMATION - REMOVED AUTO INSERTION STEPS 5 & 6

        return new Response(
            JSON.stringify({
                success: true,
                documentId,
                type: extractedData.type,
                summary: extractedData.summary,
                extractedData: extractedData, // Include full data for frontend
                medicationsExtracted: extractedData.medications?.length || 0,
                metricsExtracted: extractedData.metrics?.length || 0,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Error processing document:', error);

        return new Response(
            JSON.stringify({
                error: error.message,
                details: error.stack
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
