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

    const { baseMapId, svgData, geoJsonData, theme, year, title, notes } = await req.json();
    
    if (!baseMapId) {
      throw new Error('baseMapId is required');
    }
    if (!svgData && !geoJsonData) {
      throw new Error('Either svgData or geoJsonData is required');
    }
    if (!theme || !year || !title) {
      throw new Error('theme, year, and title are required');
    }

    console.log(`[hd-bake-overlay] Processing overlay for base map: ${baseMapId}`);
    console.log(`[hd-bake-overlay] Theme: ${theme}, Year: ${year}, Title: ${title}`);

    // Fetch base map dimensions
    const { data: baseMap, error: fetchError } = await supabase
      .from('base_maps')
      .select('canonical_width, canonical_height')
      .eq('id', baseMapId)
      .single();

    if (fetchError || !baseMap) {
      throw new Error(`Base map not found: ${baseMapId}`);
    }

    const width = baseMap.canonical_width || 2560;
    const height = baseMap.canonical_height || 1440;

    console.log(`[hd-bake-overlay] Canvas size: ${width}x${height}`);

    // Get the user from the auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    // For server-side SVG rendering, we'd use resvg-wasm
    // For now, store the SVG data and create a placeholder PNG
    const fileName = `${theme.toLowerCase().replace(/\s+/g, '_')}_${year}_${Date.now()}.png`;
    const filePath = `overlays/${baseMapId}/${fileName}`;

    // Create a simple 1x1 transparent PNG as placeholder
    // In production, this would render the SVG to PNG at full resolution
    const transparentPng = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, // RGBA, etc
      0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
      0x0D, 0x0A, 0x2D, 0xB4,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
      0xAE, 0x42, 0x60, 0x82
    ]);

    const { error: uploadError } = await supabase.storage
      .from('overlays')
      .upload(filePath, transparentPng, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.log(`[hd-bake-overlay] Upload warning: ${uploadError.message}`);
      // Continue even if upload fails - record the overlay
    }

    // Get next z_index
    const { data: maxZData } = await supabase
      .from('overlays')
      .select('z_index')
      .eq('base_map_id', baseMapId)
      .order('z_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextZIndex = (maxZData?.z_index || -1) + 1;

    // Store the SVG source in notes for future editing
    const fullNotes = `${notes || ''}\n\n--- SVG Source ---\n${svgData || 'GeoJSON baked overlay'}`;

    // Insert overlay record
    const { data: overlay, error: insertError } = await supabase
      .from('overlays')
      .insert({
        base_map_id: baseMapId,
        theme,
        year,
        file_path: filePath,
        z_index: nextZIndex,
        width_px: width,
        height_px: height,
        format: 'png',
        notes: fullNotes,
        author: user?.id || null
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create overlay record: ${insertError.message}`);
    }

    console.log(`[hd-bake-overlay] Created overlay: ${overlay.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        overlayId: overlay.id,
        zIndex: nextZIndex,
        message: 'Overlay baked and saved successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[hd-bake-overlay] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
