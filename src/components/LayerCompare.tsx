import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SplitSquareHorizontal, Circle, Zap, Pause, Play } from "lucide-react";

type CompareMode = 'single' | 'swipe' | 'spyglass' | 'blink';

interface Layer {
  id: string;
  theme: string;
  year: number;
  url?: string;
}

interface LayerCompareProps {
  baseMapUrl: string;
  layers: Layer[];
  width: number;
  height: number;
}

export default function LayerCompare({ baseMapUrl, layers, width, height }: LayerCompareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<CompareMode>('single');
  const [layerAId, setLayerAId] = useState<string>('base');
  const [layerBId, setLayerBId] = useState<string>(layers[0]?.id || '');
  const [swipePosition, setSwipePosition] = useState(50);
  const [spyglassPos, setSpyglassPos] = useState({ x: 0, y: 0 });
  const [spyglassSize, setSpyglassSize] = useState(150);
  const [blinkActive, setBlinkActive] = useState(false);
  const [blinkSpeed, setBlinkSpeed] = useState(500);
  const [showingA, setShowingA] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Load all images
  useEffect(() => {
    const imageMap = new Map<string, HTMLImageElement>();
    const loadPromises: Promise<void>[] = [];

    // Load base map
    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    loadPromises.push(new Promise((resolve) => {
      baseImg.onload = () => {
        imageMap.set('base', baseImg);
        resolve();
      };
      baseImg.onerror = () => resolve();
      baseImg.src = baseMapUrl;
    }));

    // Load layers
    layers.forEach(layer => {
      if (!layer.url) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      loadPromises.push(new Promise((resolve) => {
        img.onload = () => {
          imageMap.set(layer.id, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = layer.url!;
      }));
    });

    Promise.all(loadPromises).then(() => {
      setLoadedImages(imageMap);
    });
  }, [baseMapUrl, layers]);

  // Draw canvas based on mode
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const imgA = loadedImages.get(layerAId);
    const imgB = loadedImages.get(layerBId);

    if (mode === 'single') {
      if (imgA) ctx.drawImage(imgA, 0, 0, width, height);
    } else if (mode === 'swipe') {
      // Draw A on left side
      if (imgA) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, (swipePosition / 100) * width, height);
        ctx.clip();
        ctx.drawImage(imgA, 0, 0, width, height);
        ctx.restore();
      }

      // Draw B on right side
      if (imgB) {
        ctx.save();
        ctx.beginPath();
        ctx.rect((swipePosition / 100) * width, 0, width, height);
        ctx.clip();
        ctx.drawImage(imgB, 0, 0, width, height);
        ctx.restore();
      }

      // Draw divider line
      const dividerX = (swipePosition / 100) * width;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(dividerX, 0);
      ctx.lineTo(dividerX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw handle
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(dividerX, height / 2, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (mode === 'spyglass') {
      // Draw A as background
      if (imgA) ctx.drawImage(imgA, 0, 0, width, height);

      // Draw B in circular region
      if (imgB && spyglassPos.x > 0 && spyglassPos.y > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(spyglassPos.x, spyglassPos.y, spyglassSize, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(imgB, 0, 0, width, height);
        ctx.restore();

        // Draw spyglass border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(spyglassPos.x, spyglassPos.y, spyglassSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else if (mode === 'blink') {
      const img = showingA ? imgA : imgB;
      if (img) ctx.drawImage(img, 0, 0, width, height);
    }
  }, [mode, layerAId, layerBId, loadedImages, swipePosition, spyglassPos, spyglassSize, showingA, width, height]);

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Blink timer
  useEffect(() => {
    if (mode !== 'blink' || !blinkActive) return;

    const interval = setInterval(() => {
      setShowingA(prev => !prev);
    }, blinkSpeed);

    return () => clearInterval(interval);
  }, [mode, blinkActive, blinkSpeed]);

  // Mouse move for spyglass
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'spyglass') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    setSpyglassPos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const layerOptions = [
    { id: 'base', label: 'Base Map' },
    ...layers.map(l => ({ id: l.id, label: `${l.theme} (${l.year})` }))
  ];

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={mode === 'single' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('single')}
        >
          Single
        </Button>
        <Button
          variant={mode === 'swipe' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('swipe')}
        >
          <SplitSquareHorizontal className="w-4 h-4 mr-2" />
          Swipe
        </Button>
        <Button
          variant={mode === 'spyglass' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('spyglass')}
        >
          <Circle className="w-4 h-4 mr-2" />
          Spyglass
        </Button>
        <Button
          variant={mode === 'blink' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('blink')}
        >
          <Zap className="w-4 h-4 mr-2" />
          Blink
        </Button>
      </div>

      {/* Layer Selectors */}
      {mode !== 'single' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm mb-1 block">Layer A (Left/Base)</Label>
            <Select value={layerAId} onValueChange={setLayerAId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {layerOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm mb-1 block">Layer B (Right/Overlay)</Label>
            <Select value={layerBId} onValueChange={setLayerBId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {layerOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Mode-specific controls */}
      {mode === 'swipe' && (
        <div>
          <Label className="text-sm">Swipe Position: {swipePosition}%</Label>
          <Slider
            value={[swipePosition]}
            onValueChange={(v) => setSwipePosition(v[0])}
            min={0}
            max={100}
            step={1}
          />
        </div>
      )}

      {mode === 'spyglass' && (
        <div>
          <Label className="text-sm">Spyglass Size: {spyglassSize}px</Label>
          <Slider
            value={[spyglassSize]}
            onValueChange={(v) => setSpyglassSize(v[0])}
            min={50}
            max={300}
            step={10}
          />
          <p className="text-xs text-muted-foreground mt-1">Move mouse over canvas to reveal Layer B</p>
        </div>
      )}

      {mode === 'blink' && (
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label className="text-sm">Blink Speed: {blinkSpeed}ms</Label>
            <Slider
              value={[blinkSpeed]}
              onValueChange={(v) => setBlinkSpeed(v[0])}
              min={200}
              max={2000}
              step={100}
            />
          </div>
          <Button
            variant={blinkActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBlinkActive(!blinkActive)}
          >
            {blinkActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {blinkActive ? 'Pause' : 'Play'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Currently showing: {showingA ? 'Layer A' : 'Layer B'}
          </p>
        </div>
      )}

      {/* Canvas */}
      <div className="border-2 border-[hsl(var(--border))] rounded-lg overflow-hidden bg-[hsl(var(--muted))]">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          className="w-full"
          style={{ maxHeight: '60vh', cursor: mode === 'spyglass' ? 'none' : 'default' }}
        />
      </div>

      {/* Instructions */}
      <div className="text-sm text-muted-foreground">
        {mode === 'swipe' && <p>Drag slider to compare layers side-by-side</p>}
        {mode === 'spyglass' && <p>Hover over the canvas to reveal Layer B through the spyglass</p>}
        {mode === 'blink' && <p>Toggle play/pause to alternate between layers automatically</p>}
      </div>
    </div>
  );
}
