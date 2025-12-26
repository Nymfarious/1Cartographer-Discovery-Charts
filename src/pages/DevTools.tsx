import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Upload, Home, Map, CheckCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AdminIngest from "./AdminIngest";

const DevTools = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  async function checkAdminStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!roles);
    setLoading(false);
    
    if (!roles) {
      navigate('/');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, hsl(var(--parchment)) 0%, hsl(var(--parchment-dark)) 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Decorative border */}
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
              <a href="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Dashboard
              </a>
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-[hsl(var(--gold))]" />
              <span className="text-xl font-bold text-[hsl(var(--parchment))]" 
                    style={{ fontFamily: 'Georgia, serif' }}>
                Developer Tools
              </span>
            </div>
          </div>
          <div className="px-4 py-2 rounded-full bg-gradient-to-r from-[hsl(var(--gold))] to-yellow-600 
                        border-2 border-yellow-800 shadow-lg flex items-center gap-2">
            <Shield className="w-4 h-4 text-[hsl(var(--leather))]" />
            <span className="text-sm font-bold text-[hsl(var(--leather))]">ADMIN</span>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        
        {/* HD Transparency Progress Checklist */}
        <Card className="bg-[hsl(var(--card))] border-2 border-[hsl(var(--brass))] shadow-xl">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Georgia, serif' }}>DiscoveryCharts Progress</CardTitle>
            <CardDescription>
              Implementation status of the HD layered transparency system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Completed Features */}
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Data model extended</span>
                  <p className="text-sm text-muted-foreground">Canonical dimensions, z_index, registration, year/theme metadata</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Layer Lab UI</span>
                  <p className="text-sm text-muted-foreground">Visibility toggles, opacity sliders, drag-to-reorder, time slider, theme filtering</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Text removal pipeline</span>
                  <p className="text-sm text-muted-foreground">OCR detection + inpainting to create clean base maps</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Export functionality</span>
                  <p className="text-sm text-muted-foreground">PDF (layered pages), PNG set (transparent), PPTX (one layer per slide)</p>
                </div>
              </div>

              {/* Completed - Registration marks */}
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Registration marks system</span>
                  <p className="text-sm text-muted-foreground">3-point alignment anchors, visual marks on canvas, display toggle in Layer Lab</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Overlay authoring tools</span>
                  <p className="text-sm text-muted-foreground">Vector drawing (line, rect, circle, text, arrow), SVG source saved, PNG export</p>
                </div>
              </div>

              {/* Backend APIs - Now Complete */}
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Backend APIs</span>
                  <p className="text-sm text-muted-foreground">hd-clean-base, hd-vectorize, hd-export-pack, hd-bake-overlay edge functions</p>
                </div>
              </div>
              
              {/* Recolor Regions - Now Complete */}
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Recolor regions tool</span>
                  <p className="text-sm text-muted-foreground">Magic wand selection, lasso polygon, choropleth fills</p>
                </div>
              </div>
              
              {/* Compare Modes - Now Complete */}
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Compare modes</span>
                  <p className="text-sm text-muted-foreground">Swipe, spyglass, blink modes for layer comparison</p>
                </div>
              </div>

              {/* Coming Soon Features */}
              <div className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">GeoJSON import pipeline</span>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
                <p className="text-sm text-muted-foreground w-full">MapLibre headless rendering, projection matching</p>
              </div>

              <div className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">Overlay upload interface</span>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
                <p className="text-sm text-muted-foreground w-full">Dimension validation, auto-naming, deduplication</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart Uploader Card */}
        <Card className="bg-[hsl(var(--card))] border-2 border-[hsl(var(--brass))] shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-[hsl(var(--brass))]" />
              <CardTitle style={{ fontFamily: 'Georgia, serif' }}>Historical Chart Uploader</CardTitle>
            </div>
            <CardDescription>
              Upload high-resolution historical maps and charts to your collection
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Admin Ingest Component */}
        <AdminIngest />
      </div>
    </div>
  );
};

export default DevTools;
