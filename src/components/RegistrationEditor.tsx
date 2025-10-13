import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crosshair, Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RegistrationPoint = {
  x: number;
  y: number;
};

type RegistrationData = {
  tl: RegistrationPoint;  // top-left
  tr: RegistrationPoint;  // top-right
  bl: RegistrationPoint;  // bottom-left
};

interface RegistrationEditorProps {
  baseMapId: string;
  imageUrl: string;
  existingRegistration?: RegistrationData | null;
  onSave?: () => void;
}

export default function RegistrationEditor({ 
  baseMapId, 
  imageUrl, 
  existingRegistration,
  onSave 
}: RegistrationEditorProps) {
  const [points, setPoints] = useState<RegistrationData | null>(existingRegistration || null);
  const [currentPoint, setCurrentPoint] = useState<'tl' | 'tr' | 'bl' | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    loadImage();
  }, [imageUrl]);

  useEffect(() => {
    if (imgRef.current) {
      drawCanvas();
    }
  }, [points, currentPoint]);

  async function loadImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        drawCanvas();
      }
    };
  }

  function drawCanvas() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Draw existing points
    if (points) {
      drawPoint(ctx, points.tl, '1', currentPoint === 'tl');
      drawPoint(ctx, points.tr, '2', currentPoint === 'tr');
      drawPoint(ctx, points.bl, '3', currentPoint === 'bl');
    }

    // Draw preview for current point
    if (currentPoint && !points?.[currentPoint]) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Click to set point ${currentPoint === 'tl' ? '1' : currentPoint === 'tr' ? '2' : '3'}`, 20, 40);
    }
  }

  function drawPoint(ctx: CanvasRenderingContext2D, point: RegistrationPoint, label: string, isActive: boolean) {
    const size = 30;
    
    // Draw crosshair
    ctx.strokeStyle = isActive ? '#FFD700' : '#FF4444';
    ctx.lineWidth = 3;
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(point.x - size, point.y);
    ctx.lineTo(point.x + size, point.y);
    ctx.stroke();
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - size);
    ctx.lineTo(point.x, point.y + size);
    ctx.stroke();
    
    // Circle
    ctx.beginPath();
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = isActive ? '#FFD700' : '#FF4444';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(label, point.x + size + 5, point.y + 8);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!currentPoint || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setPoints(prev => ({
      ...prev,
      [currentPoint]: { x, y }
    } as RegistrationData));
    
    // Move to next point
    if (currentPoint === 'tl') setCurrentPoint('tr');
    else if (currentPoint === 'tr') setCurrentPoint('bl');
    else setCurrentPoint(null);
  }

  async function handleSave() {
    if (!points || !points.tl || !points.tr || !points.bl) {
      toast.error('Please set all 3 registration points');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('base_maps')
        .update({ registration: points })
        .eq('id', baseMapId);

      if (error) throw error;

      toast.success('Registration points saved');
      onSave?.();
    } catch (error: any) {
      console.error('Error saving registration:', error);
      toast.error(error.message || 'Failed to save registration points');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPoints(null);
    setCurrentPoint('tl');
  }

  const allPointsSet = points?.tl && points?.tr && points?.bl;

  return (
    <Card className="border-2 border-[hsl(var(--brass))] bg-[hsl(var(--card))]">
      <CardHeader className="border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-[hsl(var(--brass))]" />
              Set Registration Marks
            </CardTitle>
            <CardDescription className="mt-2">
              Click on the image to set 3 alignment points: top-left (1), top-right (2), bottom-left (3)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleReset}
              disabled={!points}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={!allPointsSet || saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Status indicators */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant={points?.tl ? "default" : currentPoint === 'tl' ? "outline" : "secondary"}>
              Point 1 (TL) {points?.tl ? '✓' : currentPoint === 'tl' ? '← Click image' : ''}
            </Badge>
            <Badge variant={points?.tr ? "default" : currentPoint === 'tr' ? "outline" : "secondary"}>
              Point 2 (TR) {points?.tr ? '✓' : currentPoint === 'tr' ? '← Click image' : ''}
            </Badge>
            <Badge variant={points?.bl ? "default" : currentPoint === 'bl' ? "outline" : "secondary"}>
              Point 3 (BL) {points?.bl ? '✓' : currentPoint === 'bl' ? '← Click image' : ''}
            </Badge>
          </div>

          {!currentPoint && !allPointsSet && (
            <Button onClick={() => setCurrentPoint('tl')} variant="brass">
              Start Setting Points
            </Button>
          )}

          {/* Canvas */}
          <div className="rounded-lg overflow-hidden border-2 border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-auto cursor-crosshair"
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
            />
          </div>

          {allPointsSet && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ All registration points set! Click Save to store them.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
