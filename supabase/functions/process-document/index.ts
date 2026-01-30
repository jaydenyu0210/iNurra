import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
    corsHeaders,
    getServiceClient,
    extractTextWithVision,
    callGeminiMultimodal,
    generateEmbedding,
} from '../_shared/utils.ts';

const CLASSIFICATION_PROMPT = `
You are an expert medical document and health image analyzer. Your task is to perform MULTI-LABEL classification - identify ALL applicable content types present in the uploaded image/document.

## CONTENT LABELS (Select ALL that apply)

Analyze the image and select EVERY applicable label from this list:

1. **prescription** - Medications, pharmacy labels, pill bottles, Rx papers, dosage instructions
   - Look for: Drug names, dosages, "take X times daily", Rx symbols, NDC numbers, pharmacy info

2. **health_metrics** - Health measurements and vital signs
   - Look for: Blood pressure readings (120/80), weight, glucose levels, heart rate, temperature, device displays

3. **test_result** - Lab results, blood work, pathology reports, imaging results
   - Look for: Reference ranges, lab values, test names, diagnostic codes

4. **todo_activity** - Action items, follow-up instructions, appointments to schedule
   - Look for: "Follow up with...", "Schedule...", "Return in X weeks", checklists, action items

5. **body_condition** - Physical body marks, wounds, rashes, moles, bruises, skin conditions
   - Look for: Photos of skin, wounds, rashes, lesions, bruises, swelling, any visible body condition
   - IMPORTANT: If this is a photo of a body part showing any condition, mark/wound/rash, classify as body_condition

6. **bodily_excretion** - Photos or descriptions of bodily outputs
   - Look for: Stool, urine, vomit, blood, mucus, discharge - photos or descriptions
   - IMPORTANT: These are sensitive medical observations for tracking health

7. **doctor_notes** - Clinical notes, visit summaries, discharge summaries, referral letters
   - Look for: Medical terminology, clinical observations, diagnosis, treatment plans

8. **other** - ONLY if no other category applies (insurance forms, bills with no medical data)

## OUTPUT FORMAT

Return a JSON object with this EXACT structure:

{
  "contentLabels": ["label1", "label2", ...],  // Array of ALL applicable labels
  "primaryType": "string",  // The MOST relevant single type for backward compatibility
  "title": "string",  // Short descriptive title with date if found
  "summary": "string",  // Clear, simple summary of what's in the document/image
  
  // Include sections below ONLY if the corresponding label is present:
  
  // If "prescription" label:
  "medications": [{
    "name": "string",
    "dosage": "string|null",
    "quantity": "number|null",
    "frequencyHours": "number|null",  // Convert to hours: daily=24, BID=12, TID=8, QID=6
    "durationDays": "number|null",
    "startDate": "YYYY-MM-DD",  // Tomorrow's date
    "endDate": "YYYY-MM-DD|null",
    "instructions": "string|null",
    "schedule": ["ISO8601 timestamps for each dose..."],  // Full schedule starting tomorrow
    "calendarEvents": [{
      "title": "Take [medication name]",
      "scheduledAt": "ISO8601",
      "reminderAt": "ISO8601|null",
      "isRecurring": true,
      "recurrenceRule": "FREQ=DAILY;INTERVAL=1" // or appropriate iCal RRULE
    }]
  }],
  
  // If "health_metrics" or "test_result" label:
  "metrics": [{
    "name": "string",  // Standardized: "Systolic Blood Pressure", "Weight", "Glucose", etc.
    "value": "number",
    "unit": "string",
    "recordedAt": "ISO8601",
    "isAbnormal": "boolean|null",
    "referenceRange": "string|null"
  }],
  
  // If "todo_activity" label:
  "todos": [{
    "title": "string",
    "description": "string|null",
    "priority": "low|medium|high|urgent",
    "dueDate": "YYYY-MM-DD|null",
    "dueTime": "HH:MM|null",
    "isRecurring": false,
    "recurrenceRule": "string|null",
    "calendarEvent": {
      "title": "string",
      "scheduledAt": "ISO8601",
      "reminderAt": "ISO8601|null",
      "type": "todo"
    }
  }],
  
  // If "body_condition" label:
  "bodyConditions": [{
    "bodyLocation": "string",  // e.g., "left_forearm", "upper_back", "right_cheek"
    "locationDescription": "string",  // Detailed: "inner left forearm, approximately 5cm from wrist"
    "conditionType": "string",  // "rash", "wound", "bruise", "mole", "lesion", "burn", "bite", "swelling", "other"
    "color": "string|null",
    "texture": "string|null",  // "smooth", "rough", "scaly", "raised", "flat", "crusty"
    "shape": "string|null",  // "circular", "oval", "irregular", "linear"
    "severity": "mild|moderate|severe|critical",
    "dimensions": {
      "widthMm": "number|null",  // Estimated in millimeters
      "heightMm": "number|null",
      "areaMm2": "number|null",
      "depthMm": "number|null",
      "estimationMethod": "string"  // "visual_estimate", "reference_object", "ruler_in_image"
    },
    "rulerAnnotation": {
      "shouldAddRuler": true,
      "suggestedScale": "string",  // e.g., "1cm grid", "5mm marks"
      "boundingBox": {
        "x": "number",  // Percentage from left (0-100)
        "y": "number",  // Percentage from top (0-100)
        "width": "number",  // Percentage of image width
        "height": "number"  // Percentage of image height
      }
    },
    "notes": "string|null"
  }],
  
  // If "bodily_excretion" label:
  "bodilyExcretions": [{
    "excretionType": "stool|urine|vomit|blood|mucus|discharge|other",
    "color": "string|null",
    "consistency": "string|null",  // "solid", "soft", "liquid", "watery", "mucousy"
    "volumeMl": "number|null",
    "frequencyPerDay": "number|null",
    "bloodPresent": "boolean",
    "painLevel": "number|null",  // 0-10 scale
    "abnormalityIndicators": ["string"],  // ["foul_odor", "unusual_color", "blood_clots"]
    "observedAt": "ISO8601",
    "notes": "string|null"
  }],
  
  // If "doctor_notes" label:
  "keyPoints": ["string"],
  "diagnoses": ["string"],
  "treatmentPlan": "string|null"
}

## CRITICAL RULES

1. **MULTI-LABEL**: A single image can have MULTIPLE labels. A prescription with follow-up instructions has BOTH "prescription" AND "todo_activity".

2. **BODY CONDITION DIMENSIONS**: 
   - ALWAYS try to estimate dimensions for body conditions
   - Look for reference objects (coins, fingers, rulers) to estimate size
   - If a ruler is visible, use it for exact measurements
   - Provide estimation method used

3. **CALENDAR INTEGRATION**:
   - Prescriptions should generate calendar events for each dose
   - Todos should generate calendar events if they have due dates
   - Use iCal RRULE format for recurrence

4. **BLOOD PRESSURE**: Split "120/80" into TWO metrics: Systolic (120) and Diastolic (80)

5. **DATES**: 
   - If no year specified, use current year
   - Medication schedules start tomorrow
   - Use ISO 8601 format for all timestamps

6. **BE INCLUSIVE**: When in doubt, INCLUDE the label. It's better to have extra labels than miss important ones.

Return ONLY the raw JSON, no markdown code blocks.
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
            throw new Error(`Failed to update document status: ${initialUpdateError.message}`);
        }

        // Step 1: Extract text with Vision OCR (for text-based documents)
        console.log('[Step 3] Extracting text with Vision OCR...');
        let extractedText = '';
        try {
            extractedText = await extractTextWithVision(signedUrlData.signedUrl);
        } catch (ocrError) {
            console.log('[Step 3] OCR extraction failed or no text found, continuing with image analysis...');
        }

        // Step 2: Download image for multimodal analysis
        console.log('[Step 4] Downloading image for multimodal analysis...');
        const imageResponse = await fetch(signedUrlData.signedUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const uint8Array = new Uint8Array(imageBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        const base64Image = btoa(binary);

        // Determine mime type from storage path
        const ext = storagePath.split('.').pop()?.toLowerCase() || 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

        // Step 3: Classify with Gemini multimodal (image + text)
        console.log('[Step 5] Classifying document with Gemini multimodal...');
        const currentTimestamp = new Date().toISOString();
        const currentYear = new Date().getFullYear();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const contextPrompt = `
CONTEXT:
- CURRENT TIMESTAMP: ${currentTimestamp}
- CURRENT YEAR: ${currentYear}
- TOMORROW'S DATE (for medication start): ${tomorrowStr}
- If a date is found without a year, USE THE CURRENT YEAR (${currentYear}).
- If no date/time is found, USE "${currentTimestamp}" as the timestamp.

${extractedText ? `EXTRACTED TEXT FROM DOCUMENT:\n${extractedText}\n\n` : ''}
Analyze the image above along with any extracted text and provide the multi-label classification.`;

        const parts = [
            {
                inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                }
            },
            { text: contextPrompt }
        ];

        const classificationResponse = await callGeminiMultimodal(parts, CLASSIFICATION_PROMPT);

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
            console.log('Classification result - Content Labels:', extractedData.contentLabels);
            console.log('Classification result - Primary Type:', extractedData.primaryType);
            console.log('Classification result - Summary:', extractedData.summary);
        } catch {
            console.error('Failed to parse Gemini response:', classificationResponse);
            extractedData = {
                contentLabels: ['other'],
                primaryType: 'other',
                summary: 'Document processed but classification failed',
                medications: [],
                metrics: [],
                todos: [],
                bodyConditions: [],
                bodilyExcretions: [],
                keyPoints: [],
            };
        }

        // Ensure contentLabels is always an array
        if (!Array.isArray(extractedData.contentLabels)) {
            extractedData.contentLabels = extractedData.primaryType ? [extractedData.primaryType] : ['other'];
        }

        // Step 4: Generate embedding for RAG
        console.log('[Step 6] Generating embedding...');
        const textForEmbedding = [
            extractedData.summary || '',
            extractedData.title || '',
            extractedText || ''
        ].filter(Boolean).join('\n').slice(0, 5000);
        
        const embedding = textForEmbedding ? await generateEmbedding(textForEmbedding) : [];

        // Step 5: Update document in database with extracted data
        console.log('[Step 7] Saving extracted data...');
        const { error: updateError } = await supabase
            .from('documents')
            .update({
                raw_text: extractedText || null,
                summary: extractedData.summary,
                title: extractedData.title,
                type: extractedData.primaryType || 'other',
                content_labels: extractedData.contentLabels,
                extracted_data: extractedData,
                embedding: embedding.length > 0 ? embedding : null,
                processing_status: 'completed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        if (updateError) {
            throw new Error(`Failed to update document: ${updateError.message}`);
        }

        // Build response summary
        const response = {
            success: true,
            documentId,
            contentLabels: extractedData.contentLabels,
            primaryType: extractedData.primaryType,
            title: extractedData.title,
            summary: extractedData.summary,
            extractedData: extractedData,
            counts: {
                medications: extractedData.medications?.length || 0,
                metrics: extractedData.metrics?.length || 0,
                todos: extractedData.todos?.length || 0,
                bodyConditions: extractedData.bodyConditions?.length || 0,
                bodilyExcretions: extractedData.bodilyExcretions?.length || 0,
            }
        };

        return new Response(
            JSON.stringify(response),
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
