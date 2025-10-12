import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { checkRateLimit, logRequest } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { historianData, theme, year } = await req.json();
    console.log('Overlay Artist request:', { theme, year });

    // Initialize Supabase client and verify authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateCheck = await checkRateLimit(user.id, 'overlay-artist', supabase);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please try again later.',
        remaining: 0
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log this request
    await logRequest(user.id, 'overlay-artist', supabase);

    // Get Lovable API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build system prompt for Overlay Artist agent
    const systemPrompt = `You are the Overlay Artist Agent. Your role is to translate historical geographical data into visual overlay instructions.

Your task is to:
1. Interpret the historian's geographical hints
2. Convert them into drawable vector instructions for overlays
3. Provide specific coordinate hints and visual guidance
4. Ensure overlays will be transparent PNG compatible

Focus on:
- Boundaries (borders, territories)
- Key cities and landmarks
- Rivers and natural features
- Historical routes or connections

Return JSON with:
{
  "drawing_instructions": ["instruction 1", "instruction 2", ...],
  "color_suggestions": {"theme": "color_hex"},
  "opacity_levels": {"element": opacity_value},
  "layer_order": ["bottom_layer", "middle_layer", "top_layer"]
}`;

    const userPrompt = `Historical Data:
Summary: ${JSON.stringify(historianData.summary)}
Regions Changed: ${JSON.stringify(historianData.regions_changed)}
Geometry Hints: ${JSON.stringify(historianData.geometry_hints)}

Theme: ${theme}
Year: ${year}

Create drawing instructions for a transparent overlay showing ${theme} for year ${year}.`;

    // Call Lovable AI Gateway  
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.error('[OVERLAY-ARTIST] AI gateway error:', response.status);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('Overlay Artist response:', content);

    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = {
        drawing_instructions: [content],
        color_suggestions: { boundaries: "#8B4513" },
        opacity_levels: { boundaries: 0.7 },
        layer_order: ["base", "overlay"]
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[OVERLAY-ARTIST] Error:', error instanceof Error ? error.name : 'Unknown');
    return new Response(
      JSON.stringify({ error: 'Unable to generate overlay design. Please try again.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
