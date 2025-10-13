import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, PencilBrush, FabricImage, Rect } from 'fabric';
import { Button } from '@/components/ui/button';
import { Eraser, Download, Loader2, ScanText, Save, Undo } from 'lucide-react';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { supabase } from '@/integrations/supabase/client';

const MAX_IMAGE_DIMENSION = 2560;

interface TextRemovalToolProps {
  baseMapId: string;
  imageUrl: string;
  title: string;
  onSaved?: (cleanMapId: string) => void;
}

interface TextRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
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
  }
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  return { width, height };
}

// Simple inpainting using surrounding pixel averaging
function inpaintRegion(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const data = imageData.data;
  const imgWidth = imageData.width;
  const margin = 5;

  // For each pixel in the region
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (px < 0 || py < 0 || px >= imgWidth || py >= imageData.height) continue;

      let r = 0, g = 0, b = 0, count = 0;

      // Sample surrounding pixels (outside the text region)
      for (let dy = -margin; dy <= margin; dy++) {
        for (let dx = -margin; dx <= margin; dx++) {
          const sx = px + dx;
          const sy = py + dy;

          // Skip if inside the text region or out of bounds
          if (sx >= x && sx < x + width && sy >= y && sy < y + height) continue;
          if (sx < 0 || sy < 0 || sx >= imgWidth || sy >= imageData.height) continue;

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

export default function TextRemovalTool({ baseMapId, imageUrl, title, onSaved }: TextRemovalToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [textRegions, setTextRegions] = useState<TextRegion[]>([]);
  const [cleanedImageData, setCleanedImageData] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);

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

      const fabricImg = await FabricImage.fromURL(imageUrl, {
        crossOrigin: 'anonymous'
      });
      fabricImg.scaleToWidth(canvas.width!);
      fabricImg.scaleToHeight(canvas.height!);
      canvas.backgroundImage = fabricImg;

      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#ffffff';
      canvas.freeDrawingBrush.width = 20;
      canvas.isDrawingMode = false;

      setFabricCanvas(canvas);
      toast.success('Image loaded! Click "Detect Text" to start.');
      canvas.renderAll();
    };
    img.src = imageUrl;

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, [imageUrl]);

  const handleDetectText = async () => {
    if (!imageRef.current) {
      toast.error('Image not loaded yet');
      return;
    }

    setIsProcessing(true);
    toast.info('Detecting text regions... This may take a moment.');

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      resizeImageIfNeeded(canvas, ctx, imageRef.current);
      
      // Store original image data
      originalImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const result: any = await Tesseract.recognize(canvas, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const regions: TextRegion[] = [];
      if (result.data && result.data.words) {
        result.data.words
          .filter((w: any) => w.confidence > 60)
          .forEach((w: any) => {
            regions.push({
              x: w.bbox.x0,
              y: w.bbox.y0,
              width: w.bbox.x1 - w.bbox.x0,
              height: w.bbox.y1 - w.bbox.y0,
              text: w.text
            });
          });
      }

      setTextRegions(regions);
      
      // Visualize detected regions on canvas
      if (fabricCanvas) {
        fabricCanvas.getObjects().forEach(obj => {
          if (obj.type === 'rect' && (obj as any).textRegion) {
            fabricCanvas.remove(obj);
          }
        });

        const scaleX = fabricCanvas.width! / canvas.width;
        const scaleY = fabricCanvas.height! / canvas.height;

        regions.forEach((region) => {
          const rect = new Rect({
            left: region.x * scaleX,
            top: region.y * scaleY,
            width: region.width * scaleX,
            height: region.height * scaleY,
            fill: 'rgba(255, 0, 0, 0.3)',
            stroke: 'red',
            strokeWidth: 2,
            selectable: true,
          });
          (rect as any).textRegion = true;
          fabricCanvas.add(rect);
        });

        fabricCanvas.renderAll();
      }

      toast.success(`Detected ${regions.length} text regions. Click "Remove Text" to clean.`);
    } catch (error: any) {
      console.error('Error detecting text:', error);
      toast.error(error.message || 'Failed to detect text');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveText = async () => {
    if (textRegions.length === 0 || !originalImageDataRef.current) {
      toast.error('No text regions detected. Run "Detect Text" first.');
      return;
    }

    setIsProcessing(true);
    toast.info('Removing text and inpainting... This may take a moment.');

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      canvas.width = originalImageDataRef.current.width;
      canvas.height = originalImageDataRef.current.height;
      
      // Create a copy of the original image data
      const workingImageData = ctx.createImageData(
        originalImageDataRef.current.width,
        originalImageDataRef.current.height
      );
      workingImageData.data.set(originalImageDataRef.current.data);

      // Inpaint each text region
      textRegions.forEach(region => {
        inpaintRegion(workingImageData, region.x, region.y, region.width, region.height);
      });

      ctx.putImageData(workingImageData, 0, 0);
      const cleanedDataUrl = canvas.toDataURL('image/png', 1.0);
      setCleanedImageData(cleanedDataUrl);

      // Update the fabric canvas with cleaned image
      if (fabricCanvas) {
        // Remove text region overlays
        fabricCanvas.getObjects().forEach(obj => {
          if (obj.type === 'rect' && (obj as any).textRegion) {
            fabricCanvas.remove(obj);
          }
        });

        const fabricImg = await FabricImage.fromURL(cleanedDataUrl);
        fabricImg.scaleToWidth(fabricCanvas.width!);
        fabricImg.scaleToHeight(fabricCanvas.height!);
        fabricCanvas.backgroundImage = fabricImg;
        fabricCanvas.renderAll();
      }

      toast.success('Text removed! Use eraser for manual touch-ups if needed.');
    } catch (error: any) {
      console.error('Error removing text:', error);
      toast.error(error.message || 'Failed to remove text');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveClean = async () => {
    if (!cleanedImageData) {
      toast.error('No cleaned image to save. Remove text first.');
      return;
    }

    setIsSaving(true);
    toast.info('Saving cleaned base map...');

    try {
      // Convert data URL to blob
      const response = await fetch(cleanedImageData);
      const blob = await response.blob();

      // Get original base map data
      const { data: baseMap, error: fetchError } = await supabase
        .from('base_maps')
        .select('*')
        .eq('id', baseMapId)
        .single();

      if (fetchError || !baseMap) throw new Error('Failed to fetch base map');

      // Upload to storage
      const cleanFileName = baseMap.file_path.replace(/(\.[^.]+)$/, '_clean$1');
      const { error: uploadError } = await supabase.storage
        .from('base_maps')
        .upload(cleanFileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

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
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Clean base map saved successfully!');
      if (onSaved && newMap) {
        onSaved(newMap.id);
      }
    } catch (error: any) {
      console.error('Error saving clean map:', error);
      toast.error(error.message || 'Failed to save clean map');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEraser = () => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = !fabricCanvas.isDrawingMode;
    toast.info(fabricCanvas.isDrawingMode ? 'Eraser enabled' : 'Eraser disabled');
  };

  const handleDownload = () => {
    if (!cleanedImageData) {
      toast.error('No cleaned image to download');
      return;
    }
    const link = document.createElement('a');
    link.download = `${title}_clean.png`;
    link.href = cleanedImageData;
    link.click();
    toast.success('Image downloaded');
  };

  const handleUndo = () => {
    if (!fabricCanvas || !originalImageDataRef.current) return;
    
    // Reset to original image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = originalImageDataRef.current.width;
    canvas.height = originalImageDataRef.current.height;
    ctx.putImageData(originalImageDataRef.current, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    
    FabricImage.fromURL(dataUrl).then(fabricImg => {
      if (!fabricCanvas) return;
      fabricImg.scaleToWidth(fabricCanvas.width!);
      fabricImg.scaleToHeight(fabricCanvas.height!);
      fabricCanvas.backgroundImage = fabricImg;
      fabricCanvas.renderAll();
    });

    setCleanedImageData(null);
    setTextRegions([]);
    toast.info('Reset to original image');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant="default"
          onClick={handleDetectText}
          disabled={isProcessing || isSaving}
          size="sm"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ScanText className="w-4 h-4 mr-2" />
          )}
          Detect Text
        </Button>
        <Button
          variant="default"
          onClick={handleRemoveText}
          disabled={isProcessing || isSaving || textRegions.length === 0}
          size="sm"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Eraser className="w-4 h-4 mr-2" />
          )}
          Remove Text
        </Button>
        <Button
          variant="outline"
          onClick={handleToggleEraser}
          disabled={isProcessing || isSaving}
          size="sm"
        >
          <Eraser className="w-4 h-4 mr-2" />
          Manual Eraser
        </Button>
        <Button
          variant="outline"
          onClick={handleUndo}
          disabled={isProcessing || isSaving}
          size="sm"
        >
          <Undo className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={!cleanedImageData || isSaving}
          size="sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        <Button
          variant="default"
          onClick={handleSaveClean}
          disabled={!cleanedImageData || isSaving}
          size="sm"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save as Clean Base
        </Button>
      </div>

      <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden bg-[hsl(var(--muted))]">
        <canvas ref={canvasRef} />
      </div>

      <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-1">
        <p><strong>Detect Text:</strong> Run OCR to find text regions (red boxes)</p>
        <p><strong>Remove Text:</strong> Automatically inpaint detected text regions</p>
        <p><strong>Manual Eraser:</strong> Touch up remaining text manually</p>
        <p><strong>Save:</strong> Store the cleaned version as a new base map</p>
      </div>
    </div>
  );
}