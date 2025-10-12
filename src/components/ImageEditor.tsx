import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, PencilBrush, FabricImage } from 'fabric';
import { Button } from '@/components/ui/button';
import { Eraser, Pencil, Download, Trash2, Loader2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers
env.allowLocalModels = false;
env.useBrowserCache = false;

const MAX_IMAGE_DIMENSION = 1024;

interface ImageEditorProps {
  imageUrl: string;
  title: string;
}

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

async function removeBackground(imageElement: HTMLImageElement): Promise<Blob> {
  const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
    device: 'webgpu',
  });
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  resizeImageIfNeeded(canvas, ctx, imageElement);
  const imageData = canvas.toDataURL('image/jpeg', 0.8);
  const result = await segmenter(imageData);
  
  if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
    throw new Error('Invalid segmentation result');
  }
  
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = canvas.width;
  outputCanvas.height = canvas.height;
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) throw new Error('Could not get output canvas context');
  
  outputCtx.drawImage(canvas, 0, 0);
  const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  const data = outputImageData.data;
  
  for (let i = 0; i < result[0].mask.data.length; i++) {
    const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
    data[i * 4 + 3] = alpha;
  }
  
  outputCtx.putImageData(outputImageData, 0, 0);
  
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      'image/png',
      1.0
    );
  });
}

export default function ImageEditor({ imageUrl, title }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'draw' | 'erase'>('draw');
  const [isProcessing, setIsProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      imageRef.current = img;
      
      const canvas = new FabricCanvas(canvasRef.current!, {
        width: Math.min(img.width, 1200),
        height: Math.min(img.height, 800),
        backgroundColor: '#ffffff',
      });

      // Load image as Fabric object
      const fabricImg = await FabricImage.fromURL(imageUrl, {
        crossOrigin: 'anonymous'
      });
      fabricImg.scaleToWidth(canvas.width!);
      fabricImg.scaleToHeight(canvas.height!);
      canvas.backgroundImage = fabricImg;

      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#ff0000';
      canvas.freeDrawingBrush.width = 3;

      setFabricCanvas(canvas);
      toast.success('Image loaded! Start annotating.');
      canvas.renderAll();
    };
    img.src = imageUrl;

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = true;
    
    if (activeTool === 'draw') {
      fabricCanvas.freeDrawingBrush.color = '#ff0000';
      fabricCanvas.freeDrawingBrush.width = 3;
    } else {
      fabricCanvas.freeDrawingBrush.color = '#ffffff';
      fabricCanvas.freeDrawingBrush.width = 20;
    }
  }, [activeTool, fabricCanvas]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.getObjects().forEach(obj => {
      if (obj.type !== 'image') {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    toast.success('Annotations cleared');
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
    const link = document.createElement('a');
    link.download = `${title}_annotated.png`;
    link.href = dataURL;
    link.click();
    toast.success('Image downloaded');
  };

  const handleRemoveBackground = async () => {
    if (!imageRef.current) {
      toast.error('Image not loaded yet');
      return;
    }

    setIsProcessing(true);
    toast.info('Removing background... This may take a moment.');

    try {
      const blob = await removeBackground(imageRef.current);
      const url = URL.createObjectURL(blob);
      
      if (fabricCanvas) {
        const fabricImg = await FabricImage.fromURL(url, {
          crossOrigin: 'anonymous'
        });
        fabricImg.scaleToWidth(fabricCanvas.width!);
        fabricImg.scaleToHeight(fabricCanvas.height!);
        fabricCanvas.backgroundImage = fabricImg;
        fabricCanvas.renderAll();
        toast.success('Background removed successfully!');
      }
    } catch (error: any) {
      console.error('Error removing background:', error);
      toast.error(error.message || 'Failed to remove background');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant={activeTool === 'draw' ? 'default' : 'outline'}
          onClick={() => setActiveTool('draw')}
          size="sm"
        >
          <Pencil className="w-4 h-4 mr-2" />
          Draw
        </Button>
        <Button
          variant={activeTool === 'erase' ? 'default' : 'outline'}
          onClick={() => setActiveTool('erase')}
          size="sm"
        >
          <Eraser className="w-4 h-4 mr-2" />
          Erase
        </Button>
        <Button variant="outline" onClick={handleClear} size="sm">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>
        <Button variant="outline" onClick={handleDownload} size="sm">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        <Button
          variant="outline"
          onClick={handleRemoveBackground}
          disabled={isProcessing}
          size="sm"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ImageOff className="w-4 h-4 mr-2" />
          )}
          Remove Background
        </Button>
      </div>

      <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden bg-[hsl(var(--muted))]">
        <canvas ref={canvasRef} />
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Draw:</strong> Annotate on the image with a red pen</p>
        <p><strong>Erase:</strong> Erase annotations or parts of the image</p>
        <p><strong>Remove Background:</strong> AI-powered background removal (may take 30-60 seconds)</p>
      </div>
    </div>
  );
}
