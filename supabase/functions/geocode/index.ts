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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const { latitude, longitude } = await req.json()
    
    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const openCageApiKey = Deno.env.get('OPENCAGE_API_KEY')
    
    if (!openCageApiKey) {
      console.error('OpenCage API key not configured')
      return new Response(
        JSON.stringify({ error: 'Geocoding service not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Geocoding request for coordinates: ${latitude}, ${longitude}`)

    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${openCageApiKey}&limit=1`
    )

    if (!response.ok) {
      console.error(`OpenCage API error: ${response.status} ${response.statusText}`)
      throw new Error(`Geocoding API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.results && data.results[0]) {
      const result = {
        address: data.results[0].formatted,
        country: data.results[0].components?.country || '',
        state: data.results[0].components?.state || data.results[0].components?.province || ''
      }
      
      console.log(`Geocoding successful for ${latitude}, ${longitude}`)
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      console.warn(`No geocoding results found for ${latitude}, ${longitude}`)
      return new Response(
        JSON.stringify({ 
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          country: '',
          state: ''
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return new Response(
      JSON.stringify({ error: 'Geocoding service unavailable' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})