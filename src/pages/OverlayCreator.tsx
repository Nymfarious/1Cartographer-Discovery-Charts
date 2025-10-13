import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Canvas as FabricCanvas, PencilBrush, Rect, Circle, Line, IText, Path } from "fabric";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Home, Pencil, Square, CircleIcon, Minus, Type, ArrowRight, Save, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type DrawTool = 'select' | 'pencil' | 'rectangle' | 'circle' | 'line' | 'text' | 'arrow';

export default function OverlayCreator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const baseMapId = searchParams.get('baseMapId');

  const [baseMap, setBaseMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<DrawTool>('select');
  const [strokeColor, setStrokeColor] = useState('#FF0000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  
  const [theme, setTheme] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!baseMapId) {
      toast.error('No base map selected');
      navigate('/workspace');
      return;
    }
    loadBaseMap();
  }, [baseMapId]);

  useEffect(() => {
    if (baseMap && canvasRef.current && !fabricCanvas) {
      initializeFabricCanvas();
    }
  }, [baseMap]);

  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = activeTool === 'pencil';
    if (activeTool === 'pencil' && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = strokeColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }
  }, [activeTool, strokeColor, strokeWidth, fabricCanvas]);

  async function loadBaseMap() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('base_maps').select('*').eq('id', baseMapId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Base map not found');
      setBaseMap(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load base map');
      navigate('/workspace');
    } finally {
      setLoading(false);
    }
  }

  function initializeFabricCanvas() {
    if (!canvasRef.current || !baseMap) return;
    const width = baseMap.canonical_width || 2560;
    const height = baseMap.canonical_height || 1440;
    const canvas = new FabricCanvas(canvasRef.current, { width, height, backgroundColor: 'transparent' });
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    setFabricCanvas(canvas);
  }

  function handleToolClick(tool: DrawTool) {
    setActiveTool(tool);
    if (!fabricCanvas) return;
    if (tool === 'rectangle') fabricCanvas.add(new Rect({ left: 100, top: 100, width: 200, height: 150, fill: fillColor === 'transparent' ? 'rgba(0,0,0,0)' : fillColor, stroke: strokeColor, strokeWidth }));
    else if (tool === 'circle') fabricCanvas.add(new Circle({ left: 100, top: 100, radius: 75, fill: fillColor === 'transparent' ? 'rgba(0,0,0,0)' : fillColor, stroke: strokeColor, strokeWidth }));
    else if (tool === 'line') fabricCanvas.add(new Line([50, 50, 200, 50], { stroke: strokeColor, strokeWidth }));
    else if (tool === 'text') fabricCanvas.add(new IText('Click to edit', { left: 100, top: 100, fill: strokeColor, fontSize: 24 }));
    else if (tool === 'arrow') fabricCanvas.add(new Path('M 0 0 L 150 0 L 140 -10 M 150 0 L 140 10', { left: 100, top: 100, stroke: strokeColor, strokeWidth, fill: '' }));
  }

  async function handleSave() {
    if (!fabricCanvas || !baseMap || !theme || !year || !title) { toast.error('Please fill in theme, year, and title'); return; }
    setSaving(true);
    try {
      const svg = fabricCanvas.toSVG();
      const dataUrl = fabricCanvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `${theme.toLowerCase().replace(/\s+/g, '_')}_${year}_${Date.now()}.png`;
      const filePath = `overlays/${baseMapId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('overlays').upload(filePath, blob, { contentType: 'image/png' });
      if (uploadError) throw uploadError;
      const { data: maxZData } = await supabase.from('overlays').select('z_index').eq('base_map_id', baseMapId).order('z_index', { ascending: false }).limit(1).maybeSingle();
      const nextZIndex = (maxZData?.z_index || -1) + 1;
      const { error: dbError } = await supabase.from('overlays').insert({ base_map_id: baseMapId, theme, year, file_path: filePath, z_index: nextZIndex, width_px: baseMap.canonical_width, height_px: baseMap.canonical_height, format: 'png', notes: `${notes}\n\n--- SVG Source ---\n${svg}` });
      if (dbError) throw dbError;
      toast.success('Overlay saved successfully');
      navigate(`/workspace?poster=${baseMapId}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save overlay');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen p-6">
      <Button onClick={() => navigate('/workspace')} className="mb-4"><Home className="w-4 h-4 mr-2" />Back</Button>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] max-w-7xl mx-auto">
        <div className="space-y-4">
          <Card><CardHeader><CardTitle>Tools</CardTitle></CardHeader><CardContent className="space-y-2">{['select', 'pencil', 'line', 'rectangle', 'circle', 'text', 'arrow'].map(t => <Button key={t} variant={activeTool === t ? 'default' : 'outline'} onClick={() => t === 'select' ? setActiveTool('select') : handleToolClick(t as DrawTool)} className="w-full justify-start">{t}</Button>)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Style</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label>Stroke</Label><Input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} /></div><div><Label>Fill</Label><Input type="color" value={fillColor === 'transparent' ? '#000000' : fillColor} onChange={(e) => setFillColor(e.target.value)} /><Button variant="ghost" size="sm" onClick={() => setFillColor('transparent')} className="w-full">Transparent</Button></div><div><Label>Width: {strokeWidth}px</Label><Slider value={[strokeWidth]} onValueChange={(v) => setStrokeWidth(v[0])} min={1} max={20} /></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Info</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={theme} onValueChange={setTheme}><SelectTrigger><SelectValue placeholder="Theme" /></SelectTrigger><SelectContent>{['Boundaries', 'Routes', 'Battles', 'Trade', 'Cities', 'Annotations'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} placeholder="Year" /><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" /><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} /></CardContent></Card>
          <Button onClick={handleSave} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save'}</Button>
        </div>
        <Card><CardHeader><CardTitle>Canvas</CardTitle><CardDescription>{baseMap?.canonical_width || 2560}×{baseMap?.canonical_height || 1440}px</CardDescription></CardHeader><CardContent><div className="border-2 rounded-lg bg-white"><canvas ref={canvasRef} className="w-full" /></div></CardContent></Card>
      </div>
    </div>
  );
}
