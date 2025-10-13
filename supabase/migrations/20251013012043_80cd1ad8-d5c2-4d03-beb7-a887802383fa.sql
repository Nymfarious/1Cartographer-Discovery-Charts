-- Add layered transparency fields to base_maps
ALTER TABLE public.base_maps
ADD COLUMN canonical_width integer,
ADD COLUMN canonical_height integer,
ADD COLUMN print_dpi integer DEFAULT 600,
ADD COLUMN projection text,
ADD COLUMN registration jsonb;

COMMENT ON COLUMN public.base_maps.canonical_width IS 'Standard width for all overlays aligned to this base';
COMMENT ON COLUMN public.base_maps.canonical_height IS 'Standard height for all overlays aligned to this base';
COMMENT ON COLUMN public.base_maps.print_dpi IS 'DPI for print exports (default 600)';
COMMENT ON COLUMN public.base_maps.projection IS 'Map projection (e.g., Web Mercator) or null for non-geo images';
COMMENT ON COLUMN public.base_maps.registration IS 'JSON with anchor points for alignment: {points: [{x,y,label}]}';

-- Add layered transparency fields to overlays
ALTER TABLE public.overlays
ADD COLUMN z_index integer DEFAULT 0,
ADD COLUMN width_px integer,
ADD COLUMN height_px integer,
ADD COLUMN format text DEFAULT 'png',
ADD COLUMN author uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.overlays.z_index IS 'Stacking order (higher = on top)';
COMMENT ON COLUMN public.overlays.width_px IS 'Overlay width in pixels (should match base canonical_width)';
COMMENT ON COLUMN public.overlays.height_px IS 'Overlay height in pixels (should match base canonical_height)';
COMMENT ON COLUMN public.overlays.format IS 'File format: png, svg, or geojson';
COMMENT ON COLUMN public.overlays.author IS 'User who created this overlay';

-- Create overlay_groups table for saved classroom stacks
CREATE TABLE public.overlay_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_map_id uuid REFERENCES public.base_maps(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  overlay_ids uuid[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.overlay_groups IS 'Saved stacks of overlays for classroom use';

-- Enable RLS on overlay_groups
ALTER TABLE public.overlay_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view overlay groups"
ON public.overlay_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert overlay groups"
ON public.overlay_groups FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update overlay groups"
ON public.overlay_groups FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete overlay groups"
ON public.overlay_groups FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create exports table for tracking generated exports
CREATE TABLE public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_map_id uuid REFERENCES public.base_maps(id) ON DELETE CASCADE,
  overlay_ids uuid[] DEFAULT '{}',
  kind text NOT NULL CHECK (kind IN ('pdf', 'png', 'pptx')),
  file_path text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.exports IS 'Tracks exported layer packs (PDF/PNG/PPTX)';

-- Enable RLS on exports
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exports"
ON public.exports FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can create exports"
ON public.exports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own exports"
ON public.exports FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Create index for overlay ordering queries
CREATE INDEX idx_overlays_base_map_z_index ON public.overlays(base_map_id, z_index);

-- Create index for overlay year queries (time slider)
CREATE INDEX idx_overlays_year ON public.overlays(base_map_id, year) WHERE year IS NOT NULL;