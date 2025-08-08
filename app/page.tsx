'use client';

import { useState, useEffect } from 'react';
import { Plus, Camera, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TargetForm } from '@/components/target-form';
import { ScreenshotPreview } from '@/components/screenshot-preview';
import { ScreenshotTarget } from '@/lib/db';

export default function Dashboard() {
  const [targets, setTargets] = useState<ScreenshotTarget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ScreenshotTarget | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await fetch('/api/targets');
      const data = await response.json();
      setTargets(data);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTarget = async (targetData: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTarget) {
        const response = await fetch(`/api/targets/${editingTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetData),
        });
        if (response.ok) {
          fetchTargets();
        }
      } else {
        const response = await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetData),
        });
        if (response.ok) {
          fetchTargets();
        }
      }
    } catch (error) {
      console.error('Failed to save target:', error);
    }
  };

  const handleDeleteTarget = async (id: number) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    
    try {
      const response = await fetch(`/api/targets/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchTargets();
      }
    } catch (error) {
      console.error('Failed to delete target:', error);
    }
  };

  const handleRunScreenshots = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/screenshot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      console.log('Screenshot run completed:', result);
      alert(`Screenshots completed! ${result.successCount} successful, ${result.failureCount} failed.`);
      
      // Force a re-render to refresh screenshot previews
      window.location.reload();
    } catch (error) {
      console.error('Failed to run screenshots:', error);
      alert('Failed to run screenshots. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  const openAddForm = () => {
    setEditingTarget(undefined);
    setShowForm(true);
  };

  const openEditForm = (target: ScreenshotTarget) => {
    setEditingTarget(target);
    setShowForm(true);
  };



  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Orbis</h1>
          <p className="text-muted-foreground">Manage and capture website screenshots automatically</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRunScreenshots} disabled={isRunning || targets.length === 0}>
            <Camera className="w-4 h-4 mr-2" />
            {isRunning ? 'Running...' : 'Run Screenshots'}
          </Button>
          <Button onClick={openAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            Add Target
          </Button>
        </div>
      </div>

      {targets.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No screenshot targets</h3>
          <p className="text-muted-foreground mb-4">
            Get started by adding your first website to capture screenshots from.
          </p>
          <Button onClick={openAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Target
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {targets.map((target) => (
            <div key={target.id} className="border rounded-lg p-4 bg-card">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{target.name}</h3>
                    {target.requiresLogin && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Requires Login
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <ExternalLink className="w-4 h-4" />
                      <span>URLs ({target.urls?.length || 0}):</span>
                    </div>
                    {target.urls && target.urls.length > 0 ? (
                      <div className="pl-6 space-y-1">
                        {target.urls.map((url, index) => (
                          <div key={index}>
                            <a 
                              href={url.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-blue-600"
                            >
                              {url.name}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="pl-6 text-muted-foreground">No URLs configured</div>
                    )}
                  </div>
                  {target.requiresLogin && (
                    <div className="text-xs text-muted-foreground">
                      Login URL: {target.loginUrl} | 
                      Env Keys: {target.usernameEnvKey}, {target.passwordEnvKey}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <ScreenshotPreview 
                    targetId={target.id!} 
                    targetName={target.name} 
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openEditForm(target)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteTarget(target.id!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TargetForm
        target={editingTarget}
        open={showForm}
        onOpenChange={setShowForm}
        onSave={handleSaveTarget}
      />
    </div>
  );
}