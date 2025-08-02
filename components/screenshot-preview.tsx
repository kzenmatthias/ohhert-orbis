'use client';

import { useState, useEffect } from 'react';
import { Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    fetchScreenshot();
  }, [targetId]);

  const fetchScreenshot = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/targets/${targetId}/screenshot`);
      const data = await response.json();
      setScreenshot(data.screenshot);
    } catch (error) {
      console.error('Failed to fetch screenshot:', error);
      setScreenshot(null);
    } finally {
      setLoading(false);
    }
  };

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

  if (!screenshot) {
    return (
      <div className="flex items-center justify-center w-16 h-12 bg-muted rounded border">
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  const formattedDate = new Date(screenshot.timestamp).toLocaleDateString();

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <div className="relative group cursor-pointer">
            <img
              src={screenshot.url}
              alt={`Screenshot of ${targetName}`}
              className="w-16 h-12 object-cover rounded border hover:opacity-80 transition-opacity"
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded flex items-center justify-center">
              <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Screenshot - {targetName}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {screenshot.filename} • {formattedDate}
            </p>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-120px)]">
            {imageError ? (
              <div className="flex items-center justify-center h-64 bg-muted rounded">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Failed to load image</p>
                </div>
              </div>
            ) : (
              <img
                src={screenshot.url}
                alt={`Full screenshot of ${targetName}`}
                className="w-full h-auto rounded border"
                onError={handleImageError}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="text-xs text-muted-foreground">
        <div>Latest: {formattedDate}</div>
      </div>
    </div>
  );
}