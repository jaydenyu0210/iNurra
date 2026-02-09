import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { text } = await req.json()

        if (!text) {
            throw new Error('Text input is required')
        }

        const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY')
        if (!apiKey) {
            throw new Error('GOOGLE_CLOUD_API_KEY is not set')
        }

        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text },
                    voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
                    audioConfig: { audioEncoding: 'MP3' },
                }),
            }
        )

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(JSON.stringify(errorData))
        }

        const data = await response.json()
        const audioContent = data.audioContent

        return new Response(
            JSON.stringify({ audioContent }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('TTS Function Error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message, details: error }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
