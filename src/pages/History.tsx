import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Upload, Download, LogOut, Cloud, Home } from "lucide-react";
import { toast } from "sonner";
import PosterPicker from "@/components/PosterPicker";

const History = () => {
  const [themeColor] = useState<string>("#d4eaf7");
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [credit, setCredit] = useState('© Demo — Not for distribution');
  const [status, setStatus] = useState<'demo_only' | 'licensed' | 'public_domain'>('demo_only');
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudTitle, setCloudTitle] = useState('');
  const [cloudCredit, setCloudCredit] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'demo_only' | 'licensed' | 'public_domain'>('demo_only');
  const [cloudLoading, setCloudLoading] = useState(false);
  
  const [refreshKey, setRefreshKey] = useState(0);

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

  async function handleLocalUpload() {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setUploadLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));

      const { data, error } = await supabase.functions.invoke('ingestPoster', {
        body: {
          title: title.trim(),
          credit: credit.trim() || null,
          license_status: status,
          filename: file.name,
          bytes,
        },
      });

      if (error) throw error;

      toast.success('Map uploaded successfully!');
      setFile(null);
      setTitle('');
      setCredit('© Demo — Not for distribution');
      setStatus('demo_only');
      setRefreshKey(prev => prev + 1);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload map');
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleCloudDownload() {
    if (!cloudUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    if (!cloudTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setCloudLoading(true);
    try {
      const response = await fetch(cloudUrl);
      if (!response.ok) throw new Error('Failed to fetch image from URL');
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      
      const urlParts = cloudUrl.split('/');
      const filename = urlParts[urlParts.length - 1] || 'downloaded-map.jpg';

      const { data, error } = await supabase.functions.invoke('ingestPoster', {
        body: {
          title: cloudTitle.trim(),
          credit: cloudCredit.trim() || null,
          license_status: cloudStatus,
          filename,
          bytes,
        },
      });

      if (error) throw error;

      toast.success('Map downloaded and imported successfully!');
      setCloudUrl('');
      setCloudTitle('');
      setCloudCredit('');
      setCloudStatus('demo_only');
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Cloud download error:', error);
      toast.error(error.message || 'Failed to download map from cloud');
    } finally {
      setCloudLoading(false);
    }
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
              <Link to="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-[hsl(var(--gold))]" />
              <span className="text-xl font-bold text-[hsl(var(--parchment))]" 
                    style={{ fontFamily: 'Georgia, serif' }}>
                Map Collection Library
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
        <Tabs defaultValue="library" className="w-full">
          <TabsList className="grid w-full mb-6 bg-[hsl(var(--card))] border-2 border-[hsl(var(--brass))]"
                    style={{ gridTemplateColumns: isAdmin ? '1fr 1fr 1fr' : '1fr' }}>
            <TabsTrigger value="library" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
              <MapPin className="w-4 h-4" />
              Map Library
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="upload" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
                  <Upload className="w-4 h-4" />
                  Local Upload
                </TabsTrigger>
                <TabsTrigger value="cloud" className="flex items-center gap-2 data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-[hsl(var(--leather))]">
                  <Cloud className="w-4 h-4" />
                  Cloud Download
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library">
            <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
              <CardHeader className="border-b border-[hsl(var(--border))]">
                <CardTitle className="flex items-center gap-2 text-2xl" style={{ fontFamily: 'Georgia, serif' }}>
                  <MapPin className="w-6 h-6 text-[hsl(var(--brass))]" />
                  Historical Map Collection
                </CardTitle>
                <CardDescription className="italic">
                  Browse and explore antique maps, atlases, and cartographic treasures
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <PosterPicker key={refreshKey} onOpen={handleOpenPoster} />
                  <div className="flex justify-end pt-4 border-t border-[hsl(var(--border))]">
                    <Button 
                      variant="outline" 
                      className="border-[hsl(var(--brass))] text-[hsl(var(--brass))] hover:bg-[hsl(var(--brass))] hover:text-[hsl(var(--parchment))]"
                      disabled
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Load Selected Map
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Upload Tab */}
          {isAdmin && (
            <TabsContent value="upload">
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-[hsl(var(--brass))]" />
                    <CardTitle style={{ fontFamily: 'Georgia, serif' }}>Upload Local Map</CardTitle>
                  </div>
                  <CardDescription className="italic">
                    Import high-resolution historical maps from your archive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="upload-title" className="font-semibold">Title *</Label>
                    <Input
                      id="upload-title"
                      placeholder="e.g., Medieval Europe Trade Routes"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="border-[hsl(var(--border))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upload-credit" className="font-semibold">Credit / Attribution</Label>
                    <Input
                      id="upload-credit"
                      placeholder="© Source — License info"
                      value={credit}
                      onChange={(e) => setCredit(e.target.value)}
                      className="border-[hsl(var(--border))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upload-license" className="font-semibold">License Status *</Label>
                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                      <SelectTrigger id="upload-license" className="border-[hsl(var(--border))]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo_only">🔒 Demo Only</SelectItem>
                        <SelectItem value="licensed">📜 Licensed</SelectItem>
                        <SelectItem value="public_domain">🌍 Public Domain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upload-file" className="font-semibold">Image File *</Label>
                    <Input
                      id="upload-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="border-[hsl(var(--border))]"
                    />
                    {file && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                   <Button
                    onClick={handleLocalUpload}
                    disabled={uploadLoading || !file || !title.trim()}
                    variant="brass"
                    size="lg"
                  >
                    {uploadLoading ? 'Uploading...' : 'Upload Map to Archive'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Cloud Download Tab */}
          {isAdmin && (
            <TabsContent value="cloud">
              <Card className="border-2 border-[hsl(var(--brass))] shadow-xl bg-[hsl(var(--card))]">
                <CardHeader className="border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-[hsl(var(--brass))]" />
                    <CardTitle style={{ fontFamily: 'Georgia, serif' }}>Download from Archives</CardTitle>
                  </div>
                  <CardDescription className="italic">
                    Import maps from online collections (Wikipedia, archive.org, libraries)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="cloud-url" className="font-semibold">Image URL *</Label>
                    <Input
                      id="cloud-url"
                      type="url"
                      placeholder="https://example.com/map.jpg"
                      value={cloudUrl}
                      onChange={(e) => setCloudUrl(e.target.value)}
                      className="border-[hsl(var(--border))]"
                    />
                    <p className="text-xs text-muted-foreground italic">
                      Direct link to the image file
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cloud-title" className="font-semibold">Title *</Label>
                    <Input
                      id="cloud-title"
                      placeholder="e.g., Ancient Rome City Plan"
                      value={cloudTitle}
                      onChange={(e) => setCloudTitle(e.target.value)}
                      className="border-[hsl(var(--border))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cloud-credit" className="font-semibold">Credit / Attribution</Label>
                    <Input
                      id="cloud-credit"
                      placeholder="© Source — License info"
                      value={cloudCredit}
                      onChange={(e) => setCloudCredit(e.target.value)}
                      className="border-[hsl(var(--border))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cloud-license" className="font-semibold">License Status *</Label>
                    <Select value={cloudStatus} onValueChange={(v: any) => setCloudStatus(v)}>
                      <SelectTrigger id="cloud-license" className="border-[hsl(var(--border))]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo_only">🔒 Demo Only</SelectItem>
                        <SelectItem value="licensed">📜 Licensed</SelectItem>
                        <SelectItem value="public_domain">🌍 Public Domain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                   <Button
                    onClick={handleCloudDownload}
                    disabled={cloudLoading || !cloudUrl.trim() || !cloudTitle.trim()}
                    variant="steel"
                    size="lg"
                  >
                    {cloudLoading ? 'Downloading...' : 'Download & Import'}
                  </Button>

                  <div className="bg-[hsl(var(--muted))] rounded-lg p-4 text-sm space-y-2 border border-[hsl(var(--border))]">
                    <p className="font-medium">📚 Suggested Historical Sources:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Wikimedia Commons (public domain)</li>
                      <li>Library of Congress Collections</li>
                      <li>Internet Archive</li>
                      <li>British Library Collections</li>
                      <li>David Rumsey Map Collection</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default History;
