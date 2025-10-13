import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Eye, EyeOff, Lock, Unlock, GripVertical, Download, Save, FileText, Calendar, Crosshair, Plus } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportLayers from "@/components/ExportLayers";
import { useNavigate } from "react-router-dom";

type Layer = {
  id: string;
  theme: string;
  year: number;
  file_path: string;
  z_index: number;
  width_px: number | null;
  height_px: number | null;
  format: string;
  notes: string | null;
  visible: boolean;
  opacity: number;
  locked: boolean;
  url?: string;
};

type BaseMap = {
  id: string;
  title: string;
  canonical_width: number | null;
  canonical_height: number | null;
  file_path: string;
  registration?: {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    bl: { x: number; y: number };
  } | null;
  url?: string;
};

interface LayerLabProps {
  baseMapId: string;
}

export default function LayerLab({ baseMapId }: LayerLabProps) {
  const navigate = useNavigate();
  const [baseMap, setBaseMap] = useState<BaseMap | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearRange, setYearRange] = useState<[number, number]>([0, 3000]);
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [showRegistrationMarks, setShowRegistrationMarks] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadBaseAndLayers();
  }, [baseMapId]);

  useEffect(() => {
    if (baseMap && layers.length > 0) {
      renderComposite();
    }
  }, [baseMap, layers]);

  async function loadBaseAndLayers() {
    setLoading(true);
    try {
      // Load base map
      const { data: baseData, error: baseError } = await supabase
        .from('base_maps')
        .select('*')
        .eq('id', baseMapId)
        .maybeSingle();

      if (baseError) throw baseError;
      if (!baseData) {
        toast.error('Base map not found');
        return;
      }

      const { data: baseUrl } = supabase.storage
        .from('tiles')
        .getPublicUrl(baseData.file_path);

      setBaseMap({ 
        ...baseData, 
        url: baseUrl.publicUrl,
        registration: baseData.registration as any
      });

      // Load overlays
      const { data: overlaysData, error: overlaysError } = await supabase
        .from('overlays')
        .select('*')
        .eq('base_map_id', baseMapId)
        .order('z_index', { ascending: true });

      if (overlaysError) throw overlaysError;

      const layersWithUrls = await Promise.all(
        (overlaysData || []).map(async (overlay) => {
          const { data: url } = supabase.storage
            .from('tiles')
            .getPublicUrl(overlay.file_path);

          return {
            ...overlay,
            url: url.publicUrl,
            visible: true,
            opacity: 1,
            locked: false,
          };
        })
      );

      setLayers(layersWithUrls);

      // Calculate year range and themes
      if (layersWithUrls.length > 0) {
        const years = layersWithUrls.map(l => l.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        setYearRange([minYear, maxYear]);

        const themes = [...new Set(layersWithUrls.map(l => l.theme))];
        setAvailableThemes(themes);
      }
    } catch (error: any) {
      console.error('Error loading layers:', error);
      toast.error(error.message || 'Failed to load layers');
    } finally {
      setLoading(false);
    }
  }

  async function renderComposite() {
    const canvas = canvasRef.current;
    if (!canvas || !baseMap?.url) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = baseMap.canonical_width || 2560;
    const height = baseMap.canonical_height || 1440;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw base map
    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.src = baseMap.url;

    await new Promise((resolve, reject) => {
      baseImg.onload = resolve;
      baseImg.onerror = reject;
    });

    ctx.drawImage(baseImg, 0, 0, width, height);

    // Draw visible layers in z-index order, filtered by year and theme
    const visibleLayers = layers
      .filter(l => l.visible && isLayerInRange(l))
      .sort((a, b) => a.z_index - b.z_index);

    for (const layer of visibleLayers) {
      if (!layer.url) continue;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = layer.url;

      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.globalAlpha = 1;
      } catch (err) {
        console.error(`Failed to load layer ${layer.theme}:`, err);
      }
    }

    // Draw registration marks if enabled
    if (showRegistrationMarks && baseMap.registration) {
      drawRegistrationMarks(ctx, baseMap.registration);
    }
  }

  function drawRegistrationMarks(ctx: CanvasRenderingContext2D, registration: any) {
    if (!registration || !registration.tl || !registration.tr || !registration.bl) return;

    const size = 30;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';

    // Draw each mark
    [
      { point: registration.tl, label: '1' },
      { point: registration.tr, label: '2' },
      { point: registration.bl, label: '3' }
    ].forEach(({ point, label }) => {
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(point.x - size, point.y);
      ctx.lineTo(point.x + size, point.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size);
      ctx.lineTo(point.x, point.y + size);
      ctx.stroke();

      // Circle
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Label
      ctx.fillText(label, point.x + size + 5, point.y + 5);
    });
  }

  function toggleVisibility(id: string) {
    setLayers(prev =>
      prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
    );
  }

  function toggleLock(id: string) {
    setLayers(prev =>
      prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l)
    );
  }

  function updateOpacity(id: string, opacity: number) {
    setLayers(prev =>
      prev.map(l => l.id === id ? { ...l, opacity } : l)
    );
  }

  function isLayerInRange(layer: Layer): boolean {
    const [minYear, maxYear] = yearRange;
    const themeMatch = selectedTheme === "all" || layer.theme === selectedTheme;
    return layer.year >= minYear && layer.year <= maxYear && themeMatch;
  }

  function handleTimeSliderChange(value: number[]) {
    setYearRange([value[0], value[1]]);
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;

    const items = Array.from(layers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update z_index values
    const updatedLayers = items.map((item, index) => ({
      ...item,
      z_index: index,
    }));

    setLayers(updatedLayers);

    // Save to database
    try {
      const updates = updatedLayers.map(layer =>
        supabase
          .from('overlays')
          .update({ z_index: layer.z_index })
          .eq('id', layer.id)
      );

      await Promise.all(updates);
      toast.success('Layer order saved');
    } catch (error: any) {
      console.error('Error updating z-index:', error);
      toast.error('Failed to save layer order');
    }
  }

  async function downloadComposite() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseMap?.title || 'composite'}_layers.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    });
  }

  async function saveAsGroup() {
    const title = prompt('Enter a name for this layer stack:');
    if (!title) return;

    try {
      const { error } = await supabase
        .from('overlay_groups')
        .insert({
          base_map_id: baseMapId,
          title,
          overlay_ids: layers.filter(l => l.visible).map(l => l.id),
        });

      if (error) throw error;
      toast.success('Layer stack saved');
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast.error(error.message || 'Failed to save layer stack');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading layers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Layer Controls */}
      <Card className="border-2 border-[hsl(var(--brass))] bg-[hsl(var(--card))]">
        <CardHeader className="border-b border-[hsl(var(--border))]">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Layers</span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowRegistrationMarks(!showRegistrationMarks)} 
                title="Toggle registration marks"
              >
                <Crosshair className={`w-4 h-4 ${showRegistrationMarks ? 'text-[hsl(var(--brass))]' : ''}`} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => navigate(`/overlay-creator?baseMapId=${baseMapId}`)} 
                title="Create overlay"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={saveAsGroup} title="Save stack">
                <Save className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={downloadComposite} title="Download">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Time Slider */}
          {layers.length > 0 && (
            <div className="mb-4 p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-[hsl(var(--brass))]" />
                <span className="text-sm font-medium">Timeline Filter</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Theme</label>
                  <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All themes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All themes</SelectItem>
                      {availableThemes.map(theme => (
                        <SelectItem key={theme} value={theme}>{theme}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">
                    Year Range: {yearRange[0]} - {yearRange[1]}
                  </label>
                  <Slider
                    value={yearRange}
                    onValueChange={handleTimeSliderChange}
                    min={Math.min(...layers.map(l => l.year))}
                    max={Math.max(...layers.map(l => l.year))}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1 max-h-[calc(100vh-500px)] overflow-y-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="layers">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {layers.map((layer, index) => {
                      const inRange = isLayerInRange(layer);
                      return (
                        <Draggable
                          key={layer.id}
                          draggableId={layer.id}
                          index={index}
                          isDragDisabled={layer.locked}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex flex-col gap-2 p-3 rounded-lg border bg-[hsl(var(--card))] mb-2 ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              } ${!inRange ? 'opacity-40' : ''}`}
                              style={{
                                ...provided.draggableProps.style,
                                borderColor: layer.visible && inRange ? 'hsl(var(--brass))' : 'hsl(var(--border))',
                              }}
                            >
                            <div className="flex items-center gap-2">
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleVisibility(layer.id)}
                                className="p-1"
                              >
                                {layer.visible ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleLock(layer.id)}
                                className="p-1"
                              >
                                {layer.locked ? (
                                  <Lock className="w-4 h-4" />
                                ) : (
                                  <Unlock className="w-4 h-4 text-muted-foreground" />
                                )}
                              </Button>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{layer.theme}</div>
                                <div className="text-xs text-muted-foreground">{layer.year}</div>
                              </div>
                              <div className="text-xs text-muted-foreground">z:{layer.z_index}</div>
                            </div>
                            <div className="flex items-center gap-2 ml-8">
                              <span className="text-xs text-muted-foreground w-12">
                                {Math.round(layer.opacity * 100)}%
                              </span>
                              <Slider
                                value={[layer.opacity * 100]}
                                onValueChange={(val) => updateOpacity(layer.id, val[0] / 100)}
                                max={100}
                                step={1}
                                className="flex-1"
                                disabled={layer.locked}
                              />
                            </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {layers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No overlay layers found for this base map
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Canvas Display */}
      <Card className="border-2 border-[hsl(var(--brass))] bg-[hsl(var(--card))]">
        <CardHeader className="border-b border-[hsl(var(--border))]">
          <CardTitle className="flex items-center gap-2">
            {baseMap?.title || 'Layer Composite'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: '70vh', objectFit: 'contain' }}
            />
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Export Section */}
    <ExportLayers 
      baseMap={baseMap ? { title: baseMap.title, url: baseMap.url } : null} 
      layers={layers} 
    />
  </div>
  );
}
