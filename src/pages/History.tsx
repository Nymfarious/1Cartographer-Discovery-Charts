import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Upload, LogOut } from "lucide-react";
import PosterPicker from "@/components/PosterPicker";

const History = () => {
  const [themeColor] = useState<string>("#d4eaf7");
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  async function checkAdminStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!roles);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  function handleOpenPoster(posterId: string) {
    navigate(`/history/view?id=${posterId}`);
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
        className="w-full opacity-92 p-4 pl-12 text-foreground text-xl font-bold ml-4 flex items-center justify-between border-b border-border"
        style={{ backgroundColor: themeColor }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="mr-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary">
              ← Dashboard
            </Link>
          </Button>
          <MapPin className="w-6 h-6" />
          History Discovery — Library
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" asChild size="sm">
              <Link to="/admin/ingest" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Ingest
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-8 ml-4 max-w-4xl mx-auto">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-6">Poster Library</h2>
          <PosterPicker onOpen={handleOpenPoster} />
        </Card>

        {/* Phase 2 Notice */}
        <Card className="p-4 bg-muted/50 mt-6">
          <p className="text-xs text-muted-foreground">
            <strong>Phase 2:</strong> Protected library with authentication. 
            Tiles served via signed URLs. Admin users can ingest new posters.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default History;
