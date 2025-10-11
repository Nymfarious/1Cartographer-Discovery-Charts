import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon } from 'lucide-react';

type Poster = {
  id: string;
  title: string;
  thumb_url?: string | null;
  credit?: string | null;
  license_status: string;
};

export default function PosterPicker({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosters();
  }, []);

  async function loadPosters() {
    setLoading(true);
    const { data, error } = await supabase
      .from('posters')
      .select('id, title, thumb_url, credit, license_status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading posters:', error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Loading posters...
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-12 space-y-3">
        <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">No posters yet</p>
        <p className="text-sm text-muted-foreground">
          Admin users can add posters via the Ingest page
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((poster) => (
        <Card key={poster.id} className="hover:bg-accent/50 transition-colors">
          <CardContent className="p-4">
            <button
              onClick={() => onOpen(poster.id)}
              className="w-full flex items-start gap-4 text-left"
            >
              {poster.thumb_url ? (
                <img
                  src={poster.thumb_url}
                  alt={poster.title}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{poster.title}</h3>
                {poster.credit && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {poster.credit}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 capitalize">
                  {poster.license_status.replace('_', ' ')}
                </p>
              </div>
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
