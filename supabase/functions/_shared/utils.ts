// Shared utilities for Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function getSupabaseClient(authHeader: string) {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: {
                headers: { Authorization: authHeader },
            },
        }
    );
}

export function getServiceClient() {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
}

// Google Cloud Vision OCR
export async function extractTextWithVision(imageUrl: string): Promise<string> {
    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY not set');

    console.log('[Vision OCR] Starting extraction for URL:', imageUrl.substring(0, 100) + '...');

    // Download the image and convert to base64 (more reliable than URL)
    console.log('[Vision OCR] Downloading image...');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    console.log('[Vision OCR] Image downloaded, size:', imageBuffer.byteLength, 'bytes');

    // Convert to base64 using chunked approach (avoids stack overflow on large images)
    const uint8Array = new Uint8Array(imageBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    const base64Image = btoa(binary);
    console.log('[Vision OCR] Base64 encoded, length:', base64Image.length);

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [
                    {
                        image: { content: base64Image },
                        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
                    },
                ],
            }),
        }
    );

    const data = await response.json();

    console.log('[Vision OCR] Response status:', response.status);

    if (data.responses?.[0]?.error) {
        console.error('[Vision OCR] API Error:', JSON.stringify(data.responses[0].error));
        throw new Error(`Vision API Error: ${data.responses[0].error.message}`);
    }

    const annotation = data.responses?.[0]?.fullTextAnnotation;
    const extractedText = annotation?.text || '';

    console.log('[Vision OCR] Text extracted:', extractedText ? `${extractedText.length} characters` : 'NO TEXT FOUND');

    return extractedText;
}

// Gemini API helper
// Gemini API helper (Text only)
export async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    return callGeminiMultimodal([{ text: prompt }], systemInstruction);
}

// Gemini API helper (Multimodal)
export async function callGeminiMultimodal(parts: any[], systemInstruction?: string): Promise<string> {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[Gemini] Making API call (Multimodal)...');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                systemInstruction: systemInstruction
                    ? { parts: [{ text: systemInstruction }] }
                    : undefined,
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    const data = await response.json();

    console.log('[Gemini] Response status:', response.status);

    // Log error if present
    if (data.error) {
        console.error('[Gemini] API Error:', JSON.stringify(data.error));
        throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[Gemini] Response text length:', text.length);

    return text;
}

// Generate embeddings using Gemini
export async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text }] },
            }),
        }
    );

    const data = await response.json();
    return data.embedding?.values || [];
}
