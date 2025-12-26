import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Wand2, Lasso, Paintbrush, Trash2, Download, Undo } from "lucide-react";
import { toast } from "sonner";

interface RecolorToolProps {
  imageUrl: string;
  width: number;
  height: number;
  onExport?: (dataUrl: string) => void;
}

type SelectionMode = 'none' | 'wand' | 'lasso';

export default function RecolorTool({ imageUrl, width, height, onExport }: RecolorToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SelectionMode>('none');
  const [tolerance, setTolerance] = useState(32);
  const [fillColor, setFillColor] = useState('#FF6B6B');
  const [fillOpacity, setFillOpacity] = useState(0.6);
  const [selectionMask, setSelectionMask] = useState<ImageData | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  // Load image
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext('2d');
    const overlayCtx = overlay.getContext('2d');
    if (!ctx || !overlayCtx) return;

    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      setImageData(ctx.getImageData(0, 0, width, height));
    };
    img.src = imageUrl;
  }, [imageUrl, width, height]);

  // Magic wand flood fill selection
  const floodFillSelect = useCallback((startX: number, startY: number) => {
    if (!imageData) return;

    const { data, width: imgWidth, height: imgHeight } = imageData;
    const visited = new Uint8Array(imgWidth * imgHeight);
    const mask = new Uint8ClampedArray(imgWidth * imgHeight * 4);
    
    const startIdx = (startY * imgWidth + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];

    const stack: [number, number][] = [[startX, startY]];
    
    const colorMatch = (idx: number) => {
      const dr = Math.abs(data[idx] - targetR);
      const dg = Math.abs(data[idx + 1] - targetG);
      const db = Math.abs(data[idx + 2] - targetB);
      return (dr + dg + db) / 3 <= tolerance;
    };

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const pixelIdx = y * imgWidth + x;
      
      if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight) continue;
      if (visited[pixelIdx]) continue;
      
      const colorIdx = pixelIdx * 4;
      if (!colorMatch(colorIdx)) continue;
      
      visited[pixelIdx] = 1;
      mask[colorIdx] = 255;
      mask[colorIdx + 1] = 255;
      mask[colorIdx + 2] = 255;
      mask[colorIdx + 3] = 255;
      
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    const maskData = new ImageData(mask, imgWidth, imgHeight);
    setSelectionMask(maskData);
    drawSelectionOverlay(maskData);
    toast.success('Region selected');
  }, [imageData, tolerance]);

  // Draw selection overlay (marching ants effect)
  const drawSelectionOverlay = (mask: ImageData) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Draw semi-transparent selection
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mask.width;
    tempCanvas.height = mask.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(mask, 0, 0);
    
    ctx.globalAlpha = 0.3;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.globalAlpha = 1;
    
    // Draw dotted border
    ctx.strokeStyle = '#000';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    
    // Simple edge detection for border
    for (let y = 1; y < mask.height - 1; y++) {
      for (let x = 1; x < mask.width - 1; x++) {
        const idx = (y * mask.width + x) * 4;
        if (mask.data[idx + 3] > 0) {
          // Check if edge pixel
          const above = ((y - 1) * mask.width + x) * 4;
          const below = ((y + 1) * mask.width + x) * 4;
          const left = (y * mask.width + (x - 1)) * 4;
          const right = (y * mask.width + (x + 1)) * 4;
          
          if (mask.data[above + 3] === 0 || mask.data[below + 3] === 0 ||
              mask.data[left + 3] === 0 || mask.data[right + 3] === 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  };

  // Lasso polygon selection
  const handleLassoClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'lasso') return;
    
    const canvas = overlayRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    const newPoints = [...lassoPoints, { x, y }];
    setLassoPoints(newPoints);
    
    // Draw lasso path
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    
    if (newPoints.length > 0) {
      ctx.moveTo(newPoints[0].x, newPoints[0].y);
      newPoints.forEach(p => ctx.lineTo(p.x, p.y));
    }
    ctx.stroke();
    
    // Draw points
    newPoints.forEach(p => {
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Close lasso and create selection
  const closeLasso = () => {
    if (lassoPoints.length < 3) {
      toast.error('Need at least 3 points for selection');
      return;
    }
    
    const mask = new Uint8ClampedArray(width * height * 4);
    
    // Point-in-polygon test for each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isPointInPolygon(x, y, lassoPoints)) {
          const idx = (y * width + x) * 4;
          mask[idx] = 255;
          mask[idx + 1] = 255;
          mask[idx + 2] = 255;
          mask[idx + 3] = 255;
        }
      }
    }
    
    const maskData = new ImageData(mask, width, height);
    setSelectionMask(maskData);
    drawSelectionOverlay(maskData);
    setLassoPoints([]);
    toast.success('Polygon selection created');
  };

  // Point-in-polygon using ray casting
  const isPointInPolygon = (x: number, y: number, polygon: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Apply fill to selection
  const applyFill = () => {
    if (!selectionMask || !imageData) {
      toast.error('No selection to fill');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Save to history
    setHistory(prev => [...prev, new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )]);
    
    // Parse fill color
    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);
    
    // Apply fill with opacity
    const newData = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < selectionMask.data.length; i += 4) {
      if (selectionMask.data[i + 3] > 0) {
        newData[i] = Math.round(newData[i] * (1 - fillOpacity) + r * fillOpacity);
        newData[i + 1] = Math.round(newData[i + 1] * (1 - fillOpacity) + g * fillOpacity);
        newData[i + 2] = Math.round(newData[i + 2] * (1 - fillOpacity) + b * fillOpacity);
      }
    }
    
    const newImageData = new ImageData(newData, imageData.width, imageData.height);
    ctx.putImageData(newImageData, 0, 0);
    setImageData(newImageData);
    
    // Clear selection
    clearSelection();
    toast.success('Fill applied');
  };

  // Clear selection
  const clearSelection = () => {
    setSelectionMask(null);
    setLassoPoints([]);
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  };

  // Undo
  const undo = () => {
    if (history.length === 0) {
      toast.error('Nothing to undo');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const prev = history[history.length - 1];
    ctx.putImageData(prev, 0, 0);
    setImageData(prev);
    setHistory(prev => prev.slice(0, -1));
    toast.success('Undone');
  };

  // Export as overlay
  const exportOverlay = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    if (onExport) {
      onExport(dataUrl);
    } else {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'choropleth_overlay.png';
      a.click();
    }
    toast.success('Exported');
  };

  // Handle canvas click for wand
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'wand') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      floodFillSelect(x, y);
    } else if (mode === 'lasso') {
      handleLassoClick(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tools */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={mode === 'wand' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode(mode === 'wand' ? 'none' : 'wand')}
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Magic Wand
        </Button>
        <Button
          variant={mode === 'lasso' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode(mode === 'lasso' ? 'none' : 'lasso')}
        >
          <Lasso className="w-4 h-4 mr-2" />
          Lasso
        </Button>
        {mode === 'lasso' && lassoPoints.length >= 3 && (
          <Button variant="default" size="sm" onClick={closeLasso}>
            Close Selection
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={clearSelection}>
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>
        <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0}>
          <Undo className="w-4 h-4 mr-2" />
          Undo
        </Button>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mode === 'wand' && (
          <div>
            <Label className="text-sm">Tolerance: {tolerance}</Label>
            <Slider
              value={[tolerance]}
              onValueChange={(v) => setTolerance(v[0])}
              min={0}
              max={128}
              step={1}
            />
          </div>
        )}
        <div>
          <Label className="text-sm">Fill Color</Label>
          <Input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="h-8 w-full"
          />
        </div>
        <div>
          <Label className="text-sm">Opacity: {Math.round(fillOpacity * 100)}%</Label>
          <Slider
            value={[fillOpacity * 100]}
            onValueChange={(v) => setFillOpacity(v[0] / 100)}
            min={10}
            max={100}
            step={5}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={applyFill}
            disabled={!selectionMask}
            className="flex-1"
          >
            <Paintbrush className="w-4 h-4 mr-2" />
            Fill
          </Button>
          <Button variant="outline" size="sm" onClick={exportOverlay}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-2 border-[hsl(var(--border))] rounded-lg overflow-hidden bg-[hsl(var(--muted))]">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full cursor-crosshair"
          style={{ maxHeight: '60vh' }}
        />
        <canvas
          ref={overlayRef}
          onClick={handleCanvasClick}
          className="absolute inset-0 w-full pointer-events-none"
          style={{ maxHeight: '60vh' }}
        />
      </div>

      {/* Instructions */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Magic Wand:</strong> Click to select similar colors</p>
        <p><strong>Lasso:</strong> Click to add points, then "Close Selection"</p>
        <p><strong>Fill:</strong> Apply color to selection for choropleth maps</p>
      </div>
    </div>
  );
}
