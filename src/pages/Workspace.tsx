import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, LogOut, Home, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import PosterPicker from "@/components/PosterPicker";
import HistoryViewer from "@/components/HistoryViewer";
import ImageEditor from "@/components/ImageEditor";
import ImageUploader from "@/components/ImageUploader";
import AssetGallery from "@/components/AssetGallery";
import HDAdmin from "@/pages/HDAdmin";
import LayerLab from "@/components/LayerLab";
import TextRemovalTool from "@/components/TextRemovalTool";
import ExportLayers from "@/components/ExportLayers";
import RegistrationEditor from "@/components/RegistrationEditor";
import { toast } from "sonner";

type Hotspot = {
  id: string;
  title: string;
  snippet: string | null;
  x: number;
  y: number;
  zoom: number | null;
  tags: string[] | null;
};

type Poster = {
  id: string;
  title: string;
  credit: string | null;
  license_status: string;
  dzi_path: string;
};

const Workspace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const posterId = searchParams.get('poster');
  
  const [query, setQuery] = useState("");
  const [poster, setPoster] = useState<Poster | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [dziUrl, setDziUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(posterId ? "viewer" : "library");
  const [isImageEditor, setIsImageEditor] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showLayerLab, setShowLayerLab] = useState(false);

  useEffect(() => {
    if (posterId && posterId !== poster?.id) {
      loadPoster(posterId);
      setActiveTab("viewer");
    }
  }, [posterId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  function handleOpenPoster(id: string) {
    setSearchParams({ poster: id });
  }

  async function handleSelectAsset(id: string) {
    setSelectedAssetId(id);
    setActiveTab("imageview");
    await loadAsset(id);
  }

  async function loadAsset(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('map_assets')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) throw new Error('Asset not found');

      const { data: publicUrlData } = supabase.storage
        .from('tiles')
        .getPublicUrl(data.file_path);

      setPoster({
        id: data.id,
        title: data.title,
        credit: data.description,
        license_status: 'open',
        dzi_path: data.file_path
      });
      setDziUrl(publicUrlData.publicUrl);
      setHotspots([]);
      setIsImageEditor(true);
    } catch (error: any) {
      console.error('Error loading asset:', error);
      toast.error(error.message || 'Failed to load image');
    } finally {
      setLoading(false);
    }
  }

  async function loadPoster(id: string) {
    setLoading(true);
    try {
      // Try base_maps first
      const { data: baseMapData, error: baseMapError } = await supabase
        .from('base_maps')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (baseMapData) {
        const { data: publicUrlData } = supabase.storage
          .from('tiles')
          .getPublicUrl(baseMapData.file_path);

        setPoster({
          id: baseMapData.id,
          title: baseMapData.title || 'Untitled',
          credit: baseMapData.attribution,
          license_status: baseMapData.license || 'open',
          dzi_path: baseMapData.file_path
        });
        setDziUrl(publicUrlData.publicUrl);
        setHotspots([]);
        setIsImageEditor(true);
        setShowLayerLab(true);
        setActiveTab("layers");
        setLoading(false);
        return;
      }

      // Try overlays
      const { data: overlayData, error: overlayError } = await supabase
        .from('overlays')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (overlayData) {
        const { data: publicUrlData } = supabase.storage
          .from('tiles')
          .getPublicUrl(overlayData.file_path);

        setPoster({
          id: overlayData.id,
          title: `${overlayData.theme} (${overlayData.year})`,
          credit: overlayData.notes,
          license_status: 'open',
          dzi_path: overlayData.file_path
        });
        setDziUrl(publicUrlData.publicUrl);
        setHotspots([]);
        setLoading(false);
        return;
      }

      // Fallback to posters table (legacy)
      const { data: posterData, error: posterError } = await supabase
        .from('posters')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (posterError || !posterData) {
        throw new Error('Poster not found');
      }

      setPoster(posterData);
      
      const { data: hotspotsData } = await supabase
        .from('hotspots')
        .select('*')
        .eq('poster_id', id);

      setHotspots(hotspotsData || []);

      // Try to get signed URL for DZI
      try {
        const { data: signedData, error: signedError } = await supabase.functions.invoke(
          'getSignedTile',
          { body: { path: posterData.dzi_path } }
        );
        if (signedError || signedData?.error) {
          console.warn('DZI not found:', signedData?.error || signedError);
          setDziUrl(''); // Clear URL so we show the "not available" state
          toast.error('Map tiles not available for this poster. The file may not have been uploaded yet.');
        } else if (signedData?.url) {
          setDziUrl(signedData.url);
        }
      } catch (err) {
        console.warn('Failed to get signed tile URL:', err);
        setDziUrl('');
        toast.error('Map tiles not available for this poster');
      }
    } catch (error: any) {
      console.error('Error loading poster:', error);
      toast.error(error.message || 'Failed to load poster');
    } finally {
      setLoading(false);
    }
  }

  const filteredHotspots = hotspots.filter(h =>
    query.trim() === "" || 
    h.title.toLowerCase().includes(query.toLowerCase()) ||
    (h.snippet && h.snippet.toLowerCase().includes(query.toLowerCase())) ||
    (h.tags && h.tags.join(' ').toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, hsl(var(--parchment)) 0%, hsl(var(--parchment-dark)) 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="fixed inset-0 pointer-events-none border-8 border-double opacity-30 z-50" 
           style={{ borderColor: 'hsl(var(--brass))' }} />
      
      {/* Header */}
      <div className="relative border-b-2 border-[hsl(var(--brass))] shadow-lg"
           style={{ 
             background: 'linear-gradient(to bottom, hsl(var(--leather)), hsl(var(--brass)/0.3))',
             boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
           }}>
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild size="sm"
                    className="text-[hsl(var(--parchment))] hover:bg-white/10">
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Home
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-[hsl(var(--gold))]" />
              <span className="text-xl font-bold text-[hsl(var(--parchment))]" 
                    style={{ fontFamily: 'Georgia, serif' }}>
                Workspace
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}
                  className="text-[hsl(var(--parchment))] hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-[hsl(var(--card))] border-2 border-[hsl(var(--brass))]">
            <TabsTrigger value="library" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
              <Library className="w-4 h-4" />
              Map Library
            </TabsTrigger>
            <TabsTrigger value="viewer" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
              <MapPin className="w-4 h-4" />
              Map Viewer
            </TabsTrigger>
            <TabsTrigger value="imageview" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
              <MapPin className="w-4 h-4" />
              Image View
            </TabsTrigger>
            <TabsTrigger value="layers" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
              <Library className="w-4 h-4" />
              Layer Lab
            </TabsTrigger>
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library">
            <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
              <CardHeader className="border-b border-[hsl(var(--border))]">
                <CardTitle className="flex items-center gap-2 text-2xl" style={{ fontFamily: 'Georgia, serif' }}>
                  <Library className="w-6 h-6 text-[hsl(var(--brass))]" />
                  Historical Map Collection
                </CardTitle>
                <CardDescription className="italic">
                  Browse and explore your collection of historical maps and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs defaultValue="browse" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="browse">Browse Collection</TabsTrigger>
                    <TabsTrigger value="upload">Upload Maps</TabsTrigger>
                    <TabsTrigger value="images">Upload Images</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="browse">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Maps & Documents</h3>
                        <PosterPicker onOpen={handleOpenPoster} />
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Map Assets & Images</h3>
                        <AssetGallery onSelect={handleSelectAsset} />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="upload">
                    <HDAdmin />
                  </TabsContent>
                  
                  <TabsContent value="images">
                    <ImageUploader />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Viewer Tab */}
          <TabsContent value="viewer">
            {loading ? (
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))] p-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--brass))]" />
                  <p className="text-muted-foreground">Loading map...</p>
                </div>
              </Card>
            ) : !poster ? (
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))] p-12">
                <div className="text-center">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground mb-4">No map selected</p>
                  <Button onClick={() => setActiveTab("library")} variant="brass">
                    Browse Library
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                {/* Main Viewer */}
                <div className="space-y-4">
                  <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
                    <CardHeader className="border-b border-[hsl(var(--border))]">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-[hsl(var(--brass))]" />
                        {poster.title}
                      </CardTitle>
                      {poster.credit && (
                        <CardDescription>{poster.credit}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-4">
                      {/* Search Bar */}
                      <div className="flex items-center gap-3 mb-4 p-3 bg-[hsl(var(--muted))] rounded-lg">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <Input
                          placeholder="Search locations..."
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          className="flex-1 border-none bg-transparent"
                        />
                        {query && (
                          <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                            Clear
                          </Button>
                        )}
                      </div>
                      
                      {/* Viewer */}
                      {dziUrl ? (
                        <div className="rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                          {dziUrl.endsWith('.dzi') ? (
                            <HistoryViewer 
                              dziUrl={dziUrl} 
                              hotspots={filteredHotspots} 
                              focus={filteredHotspots[0]} 
                            />
                          ) : (
                            <div className="relative w-full" style={{ minHeight: '70vh' }}>
                              <img 
                                src={dziUrl} 
                                alt={poster.title}
                                className="w-full h-auto object-contain"
                                style={{ maxHeight: '70vh' }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-12 text-center">
                          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground mb-2">Map tiles not available</p>
                          <p className="text-sm text-muted-foreground/70">
                            The DZI tiles for this poster haven't been uploaded yet.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Instructions */}
                  <Card className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-4">
                    <h3 className="font-semibold mb-2 text-sm">Navigation:</h3>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• <strong>Zoom:</strong> Mouse wheel or pinch gesture</li>
                      <li>• <strong>Pan:</strong> Click and drag</li>
                      <li>• <strong>Pins:</strong> Click red markers to jump to locations</li>
                    </ul>
                  </Card>
                </div>

                {/* Sidebar - Hotspots */}
                <aside className="space-y-4">
                  <Card className="border-2 border-[hsl(var(--brass))] bg-[hsl(var(--card))]">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Locations {query && `(${filteredHotspots.length})`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                        {filteredHotspots.length > 0 ? (
                          filteredHotspots.map(h => (
                            <div 
                              key={h.id} 
                              className="p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
                              onClick={() => {
                                const ev = new CustomEvent('jump-to-hotspot', { detail: h });
                                window.dispatchEvent(ev);
                              }}
                            >
                              <div className="font-medium text-sm mb-1">{h.title}</div>
                              {h.snippet && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {h.snippet}
                                </div>
                              )}
                              {h.tags && h.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {h.tags.map(tag => (
                                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--brass))]/20 text-[hsl(var(--brass))]">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No locations marked on this map
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </aside>
              </div>
            )}
          </TabsContent>

          {/* Layer Lab Tab */}
          <TabsContent value="layers">
            {!poster || !showLayerLab ? (
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))] p-12">
                <div className="text-center">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground mb-4">No base map selected</p>
                  <Button onClick={() => setActiveTab("library")} variant="brass">
                    Browse Library
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
                <CardContent className="pt-6">
                    <Tabs defaultValue="manage" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="manage">Manage Layers</TabsTrigger>
                        <TabsTrigger value="registration">Registration</TabsTrigger>
                        <TabsTrigger value="create">Create Overlay</TabsTrigger>
                        <TabsTrigger value="clean">Clean Base</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="manage">
                        <LayerLab baseMapId={poster.id} />
                      </TabsContent>
                      
                      <TabsContent value="registration">
                        {dziUrl && (
                          <RegistrationEditor 
                            baseMapId={poster.id}
                            imageUrl={dziUrl}
                            onSave={() => toast.success('Registration marks saved')}
                          />
                        )}
                      </TabsContent>
                      
                      <TabsContent value="create">
                        <div className="p-8 text-center space-y-4">
                          <p className="text-muted-foreground">Create vector overlays with drawing tools</p>
                          <Button 
                            variant="brass" 
                            onClick={() => navigate(`/overlay-creator?baseMapId=${poster.id}`)}
                          >
                            Open Overlay Creator
                          </Button>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="clean">
                        {dziUrl && (
                          <TextRemovalTool 
                            baseMapId={poster.id}
                            imageUrl={dziUrl}
                            title={poster.title}
                            onSaved={(cleanMapId) => {
                              toast.success('Clean base map created! Loading...');
                              loadPoster(cleanMapId);
                            }}
                          />
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Image View Tab */}
          <TabsContent value="imageview">
            {!poster ? (
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))] p-12">
                <div className="text-center">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground mb-4">No image selected</p>
                  <Button onClick={() => setActiveTab("library")} variant="brass">
                    Browse Library
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[hsl(var(--brass))]" />
                    {poster.title}
                  </CardTitle>
                  {poster.credit && (
                    <CardDescription>{poster.credit}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  {dziUrl && (
                    <ImageEditor imageUrl={dziUrl} title={poster.title} />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Workspace;
