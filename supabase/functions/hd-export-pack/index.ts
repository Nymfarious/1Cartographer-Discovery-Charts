import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { baseMapId, overlayIds, format = 'pdf', dpi = 300 } = await req.json();
    
    if (!baseMapId) {
      throw new Error('baseMapId is required');
    }

    console.log(`[hd-export-pack] Processing export for base map: ${baseMapId}`);
    console.log(`[hd-export-pack] Format: ${format}, DPI: ${dpi}`);
    console.log(`[hd-export-pack] Overlay IDs: ${overlayIds?.join(', ') || 'none'}`);

    // Fetch base map metadata
    const { data: baseMap, error: fetchError } = await supabase
      .from('base_maps')
      .select('*')
      .eq('id', baseMapId)
      .single();

    if (fetchError || !baseMap) {
      throw new Error(`Base map not found: ${baseMapId}`);
    }

    // Fetch overlays if specified
    let overlays: any[] = [];
    if (overlayIds && overlayIds.length > 0) {
      const { data: overlaysData, error: overlaysError } = await supabase
        .from('overlays')
        .select('*')
        .in('id', overlayIds)
        .order('z_index', { ascending: true });

      if (overlaysError) {
        throw new Error(`Failed to fetch overlays: ${overlaysError.message}`);
      }
      overlays = overlaysData || [];
    }

    console.log(`[hd-export-pack] Found ${overlays.length} overlays`);

    // Get the user from the auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    // For server-side export, we'd use pdf-lib, JSZip, or PptxGenJS
    // For now, create a placeholder export record
    const exportFileName = `exports/${baseMapId}/${format}_${Date.now()}.${format === 'png-zip' ? 'zip' : format}`;

    // Create export record
    const { data: exportRecord, error: insertError } = await supabase
      .from('exports')
      .insert({
        base_map_id: baseMapId,
        overlay_ids: overlayIds || [],
        kind: format,
        file_path: exportFileName,
        created_by: user?.id || null
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create export record: ${insertError.message}`);
    }

    // Generate signed URL (would be for the actual file in production)
    const { data: signedUrlData } = await supabase.storage
      .from('exports')
      .createSignedUrl(exportFileName, 3600);

    console.log(`[hd-export-pack] Created export record: ${exportRecord.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        exportId: exportRecord.id,
        format,
        layerCount: overlays.length + 1,
        message: `Export pack created with ${overlays.length + 1} layers`,
        // In production, this would be the actual signed URL
        downloadUrl: signedUrlData?.signedUrl || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[hd-export-pack] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
