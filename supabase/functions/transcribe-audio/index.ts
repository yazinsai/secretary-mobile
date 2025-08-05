import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not configured')
    }

    // Get the form data
    const formData = await req.formData()
    const base64Audio = formData.get('file') as string
    const filename = formData.get('filename') as string || 'audio.m4a'
    
    if (!base64Audio) {
      throw new Error('No audio file provided')
    }

    // Convert base64 to blob
    const binaryString = atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const audioBlob = new Blob([bytes], { type: 'audio/mp4' })

    // Create form data for Groq API
    const groqFormData = new FormData()
    groqFormData.append('file', audioBlob, filename)
    groqFormData.append('model', 'whisper-large-v3-turbo')
    groqFormData.append('response_format', 'json')
    groqFormData.append('language', 'en')

    // Send to Groq API
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Transcription failed: ${error}`)
    }

    const result = await response.json()
    
    return new Response(
      JSON.stringify({ transcript: result.text || '' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Transcribe audio error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})