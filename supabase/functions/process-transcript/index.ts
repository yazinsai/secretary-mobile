import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Get request body
    const { transcript, userId } = await req.json()
    
    if (!transcript) {
      throw new Error('No transcript provided')
    }

    // Get user's dictionary if userId provided
    let dictionary: string[] = []
    if (userId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('dictionary')
        .eq('id', userId)
        .single()

      if (profile?.dictionary) {
        dictionary = profile.dictionary
      }
    }

    // Create prompt for title generation and correction
    const prompt = `Given this transcript, perform two tasks:

1. Generate a concise 3-5 word title that captures the main topic
2. Correct the transcript for proper capitalization and spelling${dictionary.length > 0 ? ` of these dictionary terms: ${dictionary.join(', ')}` : ''}

Transcript: "${transcript}"

Return JSON in this exact format:
{
  "title": "Generated Title Here",
  "corrected": "Corrected transcript here"
}`

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates titles and corrects transcripts. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Processing failed: ${error}`)
    }

    const result = await response.json()
    const processed = JSON.parse(result.choices[0].message.content)

    return new Response(
      JSON.stringify({
        title: processed.title || 'Untitled Recording',
        correctedTranscript: processed.corrected || transcript,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        title: 'Untitled Recording',
        correctedTranscript: transcript || '',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})