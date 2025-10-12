import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Brain, Palette, Download, ExternalLink } from 'lucide-react';
import { overlayCreatorSchema } from '@/lib/validation';

interface HistorianResponse {
  summary: string[];
  regions_changed: string[];
  geometry_hints: string[];
  citations: string[];
}

interface OverlayArtistResponse {
  drawing_instructions: string[];
  color_suggestions: Record<string, string>;
  opacity_levels: Record<string, number>;
  layer_order: string[];
}

export default function OverlayCreator() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [baseMapFile, setBaseMapFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [baseMapId, setBaseMapId] = useState<string>('');
  
  const [region, setRegion] = useState('');
  const [baseYear, setBaseYear] = useState('');
  const [compareYears, setCompareYears] = useState('');
  const [question, setQuestion] = useState('');
  
  const [historianLoading, setHistorianLoading] = useState(false);
  const [historianData, setHistorianData] = useState<HistorianResponse | null>(null);
  
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayData, setOverlayData] = useState<OverlayArtistResponse | null>(null);
  
  const [theme, setTheme] = useState('');

  const handleFileUpload = async () => {
    if (!baseMapFile) return;
    
    setUploading(true);
    try {
      const fileExt = baseMapFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `base_maps/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('base_maps')
        .upload(filePath, baseMapFile);
      
      if (uploadError) throw uploadError;
      
      const { data: mapData, error: insertError } = await supabase
        .from('base_maps')
        .insert({
          title: baseMapFile.name,
          region: region || 'Unknown',
          file_path: filePath,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      setBaseMapId(mapData.id);
      toast({ title: 'Base map uploaded successfully!' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleHistorianQuery = async () => {
    // Validate input
    const validation = overlayCreatorSchema.safeParse({
      region,
      baseYear,
      compareYears,
      question,
      theme: theme || 'default'
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({ title: 'Validation Error', description: firstError.message, variant: 'destructive' });
      return;
    }
    
    setHistorianLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('historian-qa', {
        body: {
          region,
          baseYear: parseInt(baseYear),
          compareYears: compareYears.split(',').map(y => parseInt(y.trim())),
          question,
        },
      });
      
      if (error) throw error;
      setHistorianData(data);
      toast({ title: 'Historical analysis complete!' });
    } catch (error: any) {
      toast({ title: 'Historian query failed', description: error.message, variant: 'destructive' });
    } finally {
      setHistorianLoading(false);
    }
  };

  const handleGenerateOverlay = async () => {
    if (!historianData || !theme) {
      toast({ title: 'Please complete historian query first', variant: 'destructive' });
      return;
    }
    
    setOverlayLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('overlay-artist', {
        body: {
          historianData,
          theme,
          year: parseInt(baseYear),
        },
      });
      
      if (error) throw error;
      setOverlayData(data);
      
      // Save overlay metadata to database
      if (baseMapId) {
        await supabase.from('overlays').insert({
          base_map_id: baseMapId,
          theme,
          year: parseInt(baseYear),
          file_path: 'pending', // Will be updated when actual image is created
          notes: JSON.stringify(data),
        });
      }
      
      toast({ title: 'Overlay design generated!' });
    } catch (error: any) {
      toast({ title: 'Overlay generation failed', description: error.message, variant: 'destructive' });
    } finally {
      setOverlayLoading(false);
    }
  };

  const exportToCanva = () => {
    if (!overlayData) return;
    
    // Create a Canva deep link with overlay instructions
    const instructions = encodeURIComponent(
      `Historical Overlay for ${theme} (${baseYear})\n\n` +
      `Instructions:\n${overlayData.drawing_instructions.join('\n')}\n\n` +
      `Colors:\n${Object.entries(overlayData.color_suggestions).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n` +
      `Layer Order: ${overlayData.layer_order.join(' → ')}`
    );
    
    // Open Canva with a new design (transparent background)
    window.open(`https://www.canva.com/create?instructions=${instructions}`, '_blank');
  };

  const downloadInstructions = () => {
    if (!overlayData) return;
    
    const content = {
      historian_analysis: historianData,
      overlay_design: overlayData,
      metadata: { region, baseYear, theme },
    };
    
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overlay-${theme}-${baseYear}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Overlay Creator</h1>
            <p className="text-muted-foreground mt-2">Dual-agent historical overlay generation</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Gallery
          </Button>
        </div>

        {/* Step 1: Upload Base Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Step 1: Upload Base Map
            </CardTitle>
            <CardDescription>Upload the historical map you want to overlay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g., France, Europe, Asia"
              />
            </div>
            <div>
              <Label htmlFor="file">Base Map Image</Label>
              <Input
                id="file"
                type="file"
                accept="image/*"
                onChange={(e) => setBaseMapFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button onClick={handleFileUpload} disabled={!baseMapFile || uploading}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload Base Map
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Historian Q&A */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Step 2: Historian Q&A Agent
            </CardTitle>
            <CardDescription>Ask about historical changes and geography</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baseYear">Base Year</Label>
                <Input
                  id="baseYear"
                  value={baseYear}
                  onChange={(e) => setBaseYear(e.target.value)}
                  placeholder="e.g., 1789"
                />
              </div>
              <div>
                <Label htmlFor="compareYears">Compare Years (comma-separated)</Label>
                <Input
                  id="compareYears"
                  value={compareYears}
                  onChange={(e) => setCompareYears(e.target.value)}
                  placeholder="e.g., 1815, 1848, 1871"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="question">Historical Question</Label>
              <Textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What were the territorial changes in France between these periods?"
                rows={3}
              />
            </div>
            <Button onClick={handleHistorianQuery} disabled={historianLoading}>
              {historianLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Query Historian
            </Button>
            
            {historianData && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Summary:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {historianData.summary.map((item, i) => (
                      <li key={i} className="text-sm">{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Regions Changed:</h4>
                  <p className="text-sm">{historianData.regions_changed.join(', ')}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Geometry Hints:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {historianData.geometry_hints.map((hint, i) => (
                      <li key={i} className="text-sm">{hint}</li>
                    ))}
                  </ul>
                </div>
                {historianData.citations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Sources:</h4>
                    <p className="text-sm text-muted-foreground">{historianData.citations.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Overlay Artist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Step 3: Overlay Artist Agent
            </CardTitle>
            <CardDescription>Generate visual overlay instructions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="theme">Overlay Theme</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g., Territorial Changes, Political Boundaries, Trade Routes"
              />
            </div>
            <Button 
              onClick={handleGenerateOverlay} 
              disabled={!historianData || overlayLoading}
            >
              {overlayLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate Overlay Design
            </Button>
            
            {overlayData && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Drawing Instructions:</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {overlayData.drawing_instructions.map((inst, i) => (
                      <li key={i} className="text-sm">{inst}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Color Palette:</h4>
                  <div className="flex gap-3 flex-wrap">
                    {Object.entries(overlayData.color_suggestions).map(([name, color]) => (
                      <div key={name} className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Layer Order:</h4>
                  <p className="text-sm">{overlayData.layer_order.join(' → ')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Export */}
        {overlayData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Step 4: Export Overlay
              </CardTitle>
              <CardDescription>Export your overlay design to Canva or download instructions</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button onClick={exportToCanva} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Open in Canva
              </Button>
              <Button onClick={downloadInstructions} variant="outline" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Instructions (JSON)
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
