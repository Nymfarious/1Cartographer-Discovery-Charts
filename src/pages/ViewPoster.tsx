import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Search, ArrowLeft, Loader2 } from "lucide-react";
import HistoryViewer from "@/components/HistoryViewer";
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

const ViewPoster = () => {
  const [searchParams] = useSearchParams();
  const posterId = searchParams.get('id');
  
  const [themeColor] = useState<string>("#d4eaf7");
  const [query, setQuery] = useState("");
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [dziUrl, setDziUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (posterId) {
      loadPoster(posterId);
    }
  }, [posterId]);

  async function loadPoster(id: string) {
    setLoading(true);
    try {
      // Load poster details
      const { data: posterData, error: posterError } = await supabase
        .from('posters')
        .select('*')
        .eq('id', id)
        .single();

      if (posterError) throw posterError;
      setPoster(posterData);

      // Load hotspots
      const { data: hotspotsData, error: hotspotsError } = await supabase
        .from('hotspots')
        .select('*')
        .eq('poster_id', id);

      if (hotspotsError) throw hotspotsError;
      setHotspots(hotspotsData || []);

      // Get signed URL for DZI
      const { data: signedData, error: signedError } = await supabase.functions.invoke(
        'getSignedTile',
        { body: { path: posterData.dzi_path } }
      );

      if (signedError) throw signedError;
      setDziUrl(signedData.url);
    } catch (error: any) {
      console.error('Error loading poster:', error);
      toast.error(error.message || 'Failed to load poster');
    } finally {
      setLoading(false);
    }
  }

  // Search/filter hotspots
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hotspots;
    return hotspots.filter(h =>
      h.title.toLowerCase().includes(q) || 
      (h.snippet && h.snippet.toLowerCase().includes(q)) ||
      (h.tags && h.tags.join(' ').toLowerCase().includes(q))
    );
  }, [query, hotspots]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading poster...</p>
        </div>
      </div>
    );
  }

  if (!poster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-6 max-w-md text-center">
          <p className="text-muted-foreground mb-4">Poster not found</p>
          <Button asChild>
            <Link to="/history">Back to Library</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-4 opacity-90 z-10"
        style={{ backgroundColor: themeColor }}
      />
      
      {/* Header */}
      <div 
        className="w-full opacity-92 p-4 pl-12 text-foreground text-xl font-bold ml-4 flex items-center gap-3 border-b border-border"
        style={{ backgroundColor: themeColor }}
      >
        <Button variant="ghost" asChild className="mr-4">
          <Link to="/history" className="flex items-center gap-2 text-foreground hover:text-primary">
            <ArrowLeft className="w-4 h-4" />
            Library
          </Link>
        </Button>
        <MapPin className="w-6 h-6" />
        {poster.title}
      </div>

      {/* Main Layout */}
      <div className="p-4 md:p-6 ml-4 grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Left: Viewer */}
        <div className="space-y-4">
          {/* Search Bar */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
              />
              {query && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setQuery('')}
                >
                  Clear
                </Button>
              )}
            </div>
            {query && (
              <p className="text-xs text-muted-foreground mt-2">
                {results.length} match{results.length !== 1 ? 'es' : ''} found
              </p>
            )}
          </Card>

          {/* Viewer */}
          {dziUrl && (
            <Card className="p-3">
              <HistoryViewer 
                dziUrl={dziUrl} 
                hotspots={results} 
                focus={results[0]} 
              />
            </Card>
          )}

          {/* Instructions */}
          <Card className="p-4 bg-muted/50">
            <h3 className="font-semibold mb-2 text-sm">How to use:</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• <strong>Zoom:</strong> Mouse wheel or pinch gesture</li>
              <li>• <strong>Pan:</strong> Click and drag</li>
              <li>• <strong>Pins:</strong> Click red pins to jump to location</li>
              <li>• <strong>Search:</strong> Find locations by name or tag</li>
            </ul>
          </Card>
        </div>

        {/* Right: Hotspots List */}
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Locations {query && `(${results.length})`}
            </h2>
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {results.length > 0 ? (
                results.map(h => (
                  <div 
                    key={h.id} 
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedHotspot?.id === h.id 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-card hover:bg-accent border-border'
                    }`}
                    onClick={() => setSelectedHotspot(h)}
                  >
                    <div className="font-medium text-sm mb-1">{h.title}</div>
                    {h.snippet && (
                      <div className="text-xs text-muted-foreground mb-2">
                        {h.snippet}
                      </div>
                    )}
                    {h.tags && h.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {h.tags.map(tag => (
                          <span 
                            key={tag} 
                            className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        const ev = new CustomEvent('jump-to-hotspot', { detail: h });
                        window.dispatchEvent(ev);
                      }}
                    >
                      Jump to Location
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hotspots for this poster yet
                </p>
              )}
            </div>
          </Card>

          {/* Poster Info */}
          {poster.credit && (
            <Card className="p-4 bg-muted/50">
              <p className="text-xs text-muted-foreground">
                <strong>Credit:</strong> {poster.credit}
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ViewPoster;
