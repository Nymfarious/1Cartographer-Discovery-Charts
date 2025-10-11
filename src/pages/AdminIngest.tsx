import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminIngest() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [credit, setCredit] = useState('© Demo — Not for distribution');
  const [status, setStatus] = useState<'demo_only' | 'licensed' | 'public_domain'>('demo_only');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
    if (!roles) {
      toast.error('Admin access required');
      navigate('/');
    }
  }

  async function handleIngest() {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setLoading(true);
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

      toast.success('Poster ingested successfully!');
      setFile(null);
      setTitle('');
      setCredit('© Demo — Not for distribution');
      setStatus('demo_only');
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error('Ingest error:', error);
      toast.error(error.message || 'Failed to ingest poster');
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Shield className="w-5 h-5" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              Admin privileges required to access this page
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            <CardTitle>Admin Ingest</CardTitle>
          </div>
          <CardDescription>
            Upload and process high-resolution historical images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Medieval Europe Trade Routes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit">Credit / Attribution</Label>
            <Input
              id="credit"
              placeholder="© Source — License info"
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="license">License Status *</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger id="license">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo_only">Demo Only</SelectItem>
                <SelectItem value="licensed">Licensed</SelectItem>
                <SelectItem value="public_domain">Public Domain</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only use licensed/public domain for production
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Image File *</Label>
            <Input
              id="file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Button
            onClick={handleIngest}
            disabled={loading || !file || !title.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? 'Ingesting...' : 'Ingest Poster'}
          </Button>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Process Overview:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Image uploaded to secure storage</li>
              <li>Watermark applied to protect source</li>
              <li>Deep zoom tiles generated</li>
              <li>Poster added to library</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
