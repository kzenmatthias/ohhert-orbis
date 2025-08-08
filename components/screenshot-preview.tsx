'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ScreenshotData {
  filename: string;
  date: string;
  timestamp: string;
  url: string;
}

interface ScreenshotPreviewProps {
  targetId: number;
  targetName: string;
}

export function ScreenshotPreview({ targetId, targetName }: ScreenshotPreviewProps) {
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const fetchScreenshot = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/targets/${targetId}/screenshot`);
      const data = await response.json();
      setScreenshots(data.screenshots || []);
    } catch (error) {
      console.error('Failed to fetch screenshots:', error);
      setScreenshots([]);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchScreenshot();
  }, [fetchScreenshot]);

  const handleImageError = () => {
    setImageError(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-16 h-12 bg-muted rounded border">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <div className="flex items-center justify-center w-16 h-12 bg-muted rounded border">
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  const latestScreenshot = screenshots[0];
  const formattedDate = new Date(latestScreenshot.timestamp).toLocaleDateString();

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <div className="relative group cursor-pointer">
            <div className="flex gap-1">
              {screenshots.slice(0, 3).map((screenshot, index) => (
                <div key={index} className="relative">
                  <img
                    src={screenshot.url}
                    alt={`Screenshot ${index + 1} of ${targetName}`}
                    className="w-12 h-9 object-cover rounded border hover:opacity-80 transition-opacity"
                    onError={handleImageError}
                  />
                  {index === 0 && screenshots.length > 1 && (
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {screenshots.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded flex items-center justify-center">
              <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Screenshots - {targetName}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {screenshots.length} screenshots from latest session • {formattedDate}
            </p>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-120px)]">
            {imageError ? (
              <div className="flex items-center justify-center h-64 bg-muted rounded">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Failed to load images</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {screenshots.map((screenshot, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-sm font-medium">
                      {screenshot.filename}
                    </div>
                    <img
                      src={screenshot.url}
                      alt={`Screenshot ${index + 1} of ${targetName}`}
                      className="w-full h-auto"
                      onError={handleImageError}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="text-xs text-muted-foreground">
        <div>Latest: {formattedDate}</div>
        <div>{screenshots.length} screenshot{screenshots.length > 1 ? 's' : ''}</div>
      </div>
    </div>
  );
}