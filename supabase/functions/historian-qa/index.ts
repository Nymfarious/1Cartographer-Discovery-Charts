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
    const { region, baseYear, compareYears, question } = await req.json();
    console.log('Historian Q&A request:', { region, baseYear, compareYears, question });
    
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
    const rateCheck = await checkRateLimit(user.id, 'historian-qa', supabase);
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
    await logRequest(user.id, 'historian-qa', supabase);
    
    // Handle simple question-only mode for chat interface
    if (question && !region && !baseYear) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const simpleSystemPrompt = `You are a knowledgeable historian specializing in geography, cartography, and historical events. Answer questions with accuracy and provide interesting context about maps, territories, and historical changes.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: simpleSystemPrompt },
            { role: 'user', content: question }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.choices[0].message.content;

      return new Response(JSON.stringify({ answer }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Lovable API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch trusted sources
    const { data: trustedSources, error: sourcesError } = await supabase
      .from('trusted_sources')
      .select('domain, label');

    if (sourcesError) {
      console.error('Error fetching trusted sources:', sourcesError);
      throw sourcesError;
    }

    const trustedDomains = trustedSources?.map(s => `${s.label} (${s.domain})`).join(', ') || 'wikipedia.org, loc.gov';

    // Build system prompt for Historian Q&A agent
    const systemPrompt = `You are the Historian Q&A Agent. Your role is to provide accurate historical information about maps and geographical changes.

CRITICAL RULES:
- Use ONLY information from these trusted sources: ${trustedDomains}
- Always cite your sources with domain names
- Be concise and factual
- Focus on geographical and political changes
- Provide specific location references (cities, rivers, boundaries)

Return your response as JSON with these keys:
{
  "summary": ["bullet point 1", "bullet point 2", ...],
  "regions_changed": ["region 1", "region 2", ...],
  "geometry_hints": ["hint 1 like: line from Nice→Lyon→Dijon", ...],
  "citations": ["domain1", "domain2", ...]
}`;

    const userPrompt = `Base map: ${region} in ${baseYear}
Compare years: ${compareYears?.join(', ') || 'N/A'}
Question: ${question}

Provide 3-5 key changes with geometry hints for overlay creation.`;

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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('Historian response:', content);

    // Try to parse as JSON, or return as plain text
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // If not JSON, wrap in a basic structure
      result = {
        summary: [content],
        regions_changed: [],
        geometry_hints: [],
        citations: []
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[HISTORIAN] Error:', error instanceof Error ? error.name : 'Unknown');
    return new Response(
      JSON.stringify({ error: 'Unable to process historical query. Please try again.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
