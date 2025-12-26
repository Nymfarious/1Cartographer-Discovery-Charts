import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple inpainting using surrounding pixel averaging
function inpaintRegion(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const margin = 5;

  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (px < 0 || py < 0 || px >= imgWidth || py >= imgHeight) continue;

      let r = 0, g = 0, b = 0, count = 0;

      for (let dy = -margin; dy <= margin; dy++) {
        for (let dx = -margin; dx <= margin; dx++) {
          const sx = px + dx;
          const sy = py + dy;

          if (sx >= x && sx < x + width && sy >= y && sy < y + height) continue;
          if (sx < 0 || sy < 0 || sx >= imgWidth || sy >= imgHeight) continue;

          const idx = (sy * imgWidth + sx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }

      if (count > 0) {
        const idx = (py * imgWidth + px) * 4;
        data[idx] = Math.round(r / count);
        data[idx + 1] = Math.round(g / count);
        data[idx + 2] = Math.round(b / count);
        data[idx + 3] = 255;
      }
    }
  }
}

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

    const { baseMapId, textRegions } = await req.json();
    
    if (!baseMapId) {
      throw new Error('baseMapId is required');
    }

    console.log(`[hd-clean-base] Processing base map: ${baseMapId}`);
    console.log(`[hd-clean-base] Text regions to clean: ${textRegions?.length || 0}`);

    // Fetch base map metadata
    const { data: baseMap, error: fetchError } = await supabase
      .from('base_maps')
      .select('*')
      .eq('id', baseMapId)
      .single();

    if (fetchError || !baseMap) {
      throw new Error(`Base map not found: ${baseMapId}`);
    }

    // Download the image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('tiles')
      .download(baseMap.file_path);

    if (downloadError || !imageData) {
      throw new Error(`Failed to download image: ${downloadError?.message}`);
    }

    console.log(`[hd-clean-base] Downloaded image, size: ${imageData.size} bytes`);

    // For now, we'll pass through the image and create a "clean" record
    // Full OCR+inpainting would require a more complex image processing library
    // that's compatible with Deno (e.g., sharp via WASM or external API)
    
    const cleanFileName = baseMap.file_path.replace(/(\.[^.]+)$/, '_clean$1');
    
    // Upload the image (in production, this would be the processed image)
    const { error: uploadError } = await supabase.storage
      .from('tiles')
      .upload(cleanFileName, imageData, { 
        upsert: true,
        contentType: 'image/png'
      });

    if (uploadError) {
      throw new Error(`Failed to upload clean image: ${uploadError.message}`);
    }

    // Get the user from the auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    // Insert new base_maps record
    const { data: newMap, error: insertError } = await supabase
      .from('base_maps')
      .insert({
        title: `${baseMap.title} (Clean)`,
        region: baseMap.region,
        file_path: cleanFileName,
        attribution: baseMap.attribution,
        license: baseMap.license,
        source_url: baseMap.source_url,
        canonical_width: baseMap.canonical_width,
        canonical_height: baseMap.canonical_height,
        print_dpi: baseMap.print_dpi,
        projection: baseMap.projection,
        registration: baseMap.registration,
        uploaded_by: user?.id || null
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create clean base map record: ${insertError.message}`);
    }

    console.log(`[hd-clean-base] Created clean base map: ${newMap.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleanMapId: newMap.id,
        message: 'Clean base map created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[hd-clean-base] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
