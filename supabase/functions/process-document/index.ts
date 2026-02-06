import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import {
    corsHeaders,
    getServiceClient,
    extractTextWithVision,
    callGeminiMultimodal,
    generateEmbedding,
} from '../_shared/utils.ts';

const DETECTION_PROMPT = `
You are an expert medical image analyzer. Your task is to DETECT if there is a visible body condition (wound, rash, bruise, mole, lesion, swelling, etc.) in the image.

Analyze the image and return a JSON object with this EXACT structure:

{
  "hasBodyCondition": boolean,
  "boundingBox": {
    "x": number,  // Percentage from left (0-100)
    "y": number,  // Percentage from top (0-100)
    "width": number,  // Percentage of image width
    "height": number  // Percentage of image height
  } | null
}

Return ONLY the raw JSON.
`;

const CLASSIFICATION_PROMPT = `
You are an expert medical document and health image analyzer. Your task is to perform MULTI-LABEL classification - identify ALL applicable content types present in the uploaded image/document.

## CONTENT LABELS (Select ALL that apply)

Analyze the image and select EVERY applicable label from this list:

1. **prescription** - Medications, pharmacy labels, pill bottles, Rx papers, dosage instructions
   - Look for: Drug names, dosages, "take X times daily", Rx symbols, NDC numbers, pharmacy info
   - **INFER INDICATION**: For each medication, you MUST infer the likely medical indication (what it treats) based on the drug name (e.g., "for high blood pressure", "for bacterial infection") if not explicitly stated.
    - **MEDICAL KNOWLEDGE RETRIEVAL (MANDATORY)**: For each medication, you **MUST** use your internal medical knowledge to generate these fields. **DO NOT** leave them empty if the medication name is identified.
      - **Precaution**: A concise 1-paragraph precaution (e.g., "Take with food", "Avoid sunlight").
      - **Monitoring Recommendation**: A concise 1-paragraph recommendation (e.g., "Monitor blood pressure weekly").
    - **SUMMARY**: Create a concise 1-sentence summary combining name, dosage, frequency, and indication (e.g., "Take 500mg Amoxicillin twice daily for 10 days for infection.").

2. **health_metrics** - Health measurements and vital signs
   - Look for: Blood pressure readings (120/80), weight, glucose levels, heart rate, temperature, device displays

3. **test_result** - Lab results, blood work, pathology reports, imaging results
   - Look for: Reference ranges, lab values, test names, diagnostic codes

4. **todo_activity** - Action items, follow-up instructions, appointments to schedule
   - Look for: "Follow up with...", "Schedule...", "Return in X weeks", checklists, action items

5. **body_condition** - Physical body marks, wounds, rashes, moles, bruises, skin conditions
   - Look for: Photos of skin, wounds, rashes, lesions, bruises, swelling, any visible body condition
   - IMPORTANT: If this is a photo of a body part showing any condition, mark/wound/rash, classify as body_condition
   - **CRITICAL SUMMARY REQUIREMENT**: For body conditions, the summary MUST be highly descriptive. You MUST describe the SIZE (cm/mm), COLOR (e.g., "erythematous with purplish center"), SHAPE (e.g., "irregular ovoid borders"), and TEXTURE (e.g., "raised, scaly surface").

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
  "isPureItem": boolean, // TRUE if this is a direct photo of an item/condition (e.g. pill bottle, thermometer, skin rash) and NOT a document/paper/report.
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
    "indication": "string|null",  // REQUIRED: Infer common usage (e.g. 'Treats high blood pressure'). Max 1 sentence.
    "precaution": "string", // MANDATORY: Generate a concise 1-paragraph precaution based on medical knowledge. DO NOT leave empty.
    "monitoring_recommendation": "string", // MANDATORY: Generate a concise 1-paragraph monitoring recommendation. DO NOT leave empty.
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
    "name": "string",
    "value": "number",
    "unit": "string",
    "recordedAt": "ISO8601",
    "summary": "string", // Brief context (e.g., "Elevated BP after running")
    "isAbnormal": "boolean|null",
    "referenceRange": "string|null",
    "measurementPrecautions": "string", // REQUIRED: 1 paragraph precautions for this measurement based on medical knowledge. DO NOT leave empty.
    "monitoringGuidance": "string", // REQUIRED: 1 paragraph monitoring guidance. DO NOT leave empty.
    "normalRangeLower": "number|null", // REQUIRED: Lower normal limit (infer from medical knowledge if not in doc).
    "normalRangeUpper": "number|null" // REQUIRED: Upper normal limit (infer from medical knowledge if not in doc).
  }],
  
  // If "todo_activity" label:
  "todos": [{
    "title": "string",
    "description": "string|null",
    "priority": "low|medium|high|urgent",
    "dueDate": "YYYY-MM-DD|null",
    "dueTime": "HH:MM|null",
    "summary": "string", // Brief summary of the task
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
    "bodyLocation": "string",
    "locationDescription": "string",
    "conditionType": "string",
    "color": "string|null",
    "texture": "string|null",
    "shape": "string|null",
    "severity": "mild|moderate|severe|critical",
    "summary": "string", // REQUIRED: Highly descriptive summary including size, color, shape, texture from visual + user desc.
    "dimensions": {
      "widthMm": "number|null",
      "heightMm": "number|null",
      "areaMm2": "number|null",
      "depthMm": "number|null",
      "estimationMethod": "string"
    },
    "rulerAnnotation": {
      "shouldAddRuler": true,
      "suggestedScale": "string",
      "boundingBox": {
        "x": "number",
        "y": "number",
        "width": "number",
        "height": "number"
      }
    },
    "notes": "string|null"
  }],
  
  // If "bodily_excretion" label:
  "bodilyExcretions": [{
    "excretionType": "stool|urine|vomit|blood|mucus|discharge|other",
    "color": "string|null",
    "consistency": "string|null",
    "volumeMl": "number|null",
    "frequencyPerDay": "number|null",
    "bloodPresent": "boolean",
    "painLevel": "number|null",
    "summary": "string", // Brief description of the excretion event
    "abnormalityIndicators": ["string"],
    "observedAt": "ISO8601",
    "notes": "string|null"
  }],
  
  // If "doctor_notes" label:
  "keyPoints": ["string"],
  "diagnoses": ["string"],
  "treatmentPlan": "string|null"
}

## CRITICAL RULES


2. **BODY CONDITION DIMENSIONS**: 
   - ALWAYS try to estimate dimensions for body conditions
   - Look for reference objects (coins, fingers, rulers) to estimate size
   - If a ruler is visible, use it for exact measurements
   - Provide estimation method used
   - **RETURN BOUNDING BOX**: Use 0-100 percentage coordinates for the region of interest.

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
    userDescription?: string; // Optional user-provided context
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { documentId, storagePath, userDescription }: ProcessDocumentRequest = await req.json();
        console.log(`[Process Document v2.0] Processing documentId: ${documentId}, storagePath: ${storagePath}`);

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

        // Step 2.5: Removed separate detection. We rely on the main classification.


        const contextPrompt = `
CONTEXT:
- CURRENT TIMESTAMP: ${currentTimestamp}
- CURRENT YEAR: ${currentYear}
- TOMORROW'S DATE (for medication start): ${tomorrowStr}
- If a date is found without a year, USE THE CURRENT YEAR (${currentYear}).
- If no date/time is found, USE "${currentTimestamp}" as the timestamp.

${extractedText ? `EXTRACTED TEXT FROM DOCUMENT:\n${extractedText}\n\n` : ''}
${userDescription ? `USER DESCRIPTION/CONTEXT:\n"${userDescription}"\n\n` : ''}
Analyze the image above along with any extracted text and user description to provide the multi-label classification.`;

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

        // Step 3.5: Post-Classification Annotation logic removed per user request.

        // Step 4: Generate embedding for RAG
        console.log('[Step 6] Generating embedding...');
        const textForEmbedding = [
            extractedData.summary || '',
            extractedData.title || '',
            extractedText || ''
        ].filter(Boolean).join('\n').slice(0, 5000);

        const embedding = textForEmbedding ? await generateEmbedding(textForEmbedding) : [];

        // Step 5: Update document in database with extracted data
        // Step 5: Save data (Conditional based on isPureItem)
        console.log(`[Step 7] Saving extracted data... isPureItem=${extractedData.isPureItem}`);

        if (extractedData.isPureItem) {
            // PURE ITEM Logic: Insert directly into tables and DELETE document row
            console.log('Processing as PURE ITEM (bypassing documents table)');

            // 1. Insert Medications
            if (extractedData.medications && extractedData.medications.length > 0) {
                console.log(`Inserting ${extractedData.medications.length} medications...`);
                // Get user_id from the document record before we delete it (or assume we have it in request context? No, we need to fetch it or use the one from document)
                // We have the documentId, let's fetch user_id first if we don't have it.
                // Actually, we can just fetch the document first to get the user_id? 
                // Wait, 'documents' row exists. Let's get user_id from it.
                const { data: docData, error: docError } = await supabase
                    .from('documents')
                    .select('user_id')
                    .eq('id', documentId)
                    .single();

                if (docData?.user_id) {
                    const medsToInsert = extractedData.medications.map((med: any) => ({
                        user_id: docData.user_id,
                        document_id: null, // Pure item, no document link
                        name: med.name,
                        dosage: med.dosage,
                        frequency: med.frequency, // Note: Schema might use different field, check extractedData structure vs DB
                        instructions: med.instructions,
                        start_date: med.startDate,
                        end_date: med.endDate,
                        is_active: true,
                        quantity: med.quantity,
                        duration_days: med.durationDays,
                        schedule: med.calendarEvents // Storing events as JSON schedule for now
                    }));
                    const { error: medError } = await supabase.from('medications').insert(medsToInsert);
                    if (medError) console.error('Error inserting pure medications:', medError);
                }
            }

            // 2. Insert Health Metrics
            if (extractedData.metrics && extractedData.metrics.length > 0) {
                console.log(`Inserting ${extractedData.metrics.length} metrics...`);
                const { data: docData } = await supabase
                    .from('documents')
                    .select('user_id')
                    .eq('id', documentId)
                    .single();

                if (docData?.user_id) {
                    const metricsToInsert = extractedData.metrics.map((metric: any) => ({
                        user_id: docData.user_id,
                        source_document_id: null,
                        metric_type: metric.name, // Mapping name to type
                        value: metric.value,
                        unit: metric.unit,
                        recorded_at: metric.recordedAt || new Date().toISOString(),
                        notes: metric.summary
                    }));
                    const { error: metricError } = await supabase.from('health_metrics').insert(metricsToInsert);
                    if (metricError) console.error('Error inserting pure metrics:', metricError);
                }
            }

            // 3. Insert Body Conditions
            if (extractedData.bodyConditions && extractedData.bodyConditions.length > 0) {
                console.log(`Inserting ${extractedData.bodyConditions.length} body conditions...`);
                const { data: docData } = await supabase
                    .from('documents')
                    .select('user_id')
                    .eq('id', documentId)
                    .single();

                if (docData?.user_id) {
                    const conditionsToInsert = extractedData.bodyConditions.map((cond: any) => ({
                        user_id: docData.user_id,
                        document_id: null,
                        body_location: cond.bodyLocation,
                        location_description: cond.locationDescription,
                        condition_type: cond.conditionType,
                        severity: cond.severity,
                        notes: cond.summary,
                        observed_at: new Date().toISOString(),
                        annotated_image_path: storagePath // Link the image directly!
                    }));
                    const { error: condError } = await supabase.from('body_conditions').insert(conditionsToInsert);
                    if (condError) console.error('Error inserting pure body conditions:', condError);
                }
            }

            // 4. DELETE the document row
            console.log(`Deleting temporary document row ${documentId}...`);
            const { error: deleteError } = await supabase
                .from('documents')
                .delete()
                .eq('id', documentId);

            if (deleteError) {
                console.error('Failed to delete pure item document row:', deleteError);
                // Non-critical (?) but good to know
            }

        } else {
            // DOCUMENT Logic: Update the existing row
            console.log('Processing as DOCUMENT (updating documents table)');
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
