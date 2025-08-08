'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Camera, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState, LoadingOverlay } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { TargetForm } from '@/components/target-form';
import { ScreenshotPreview } from '@/components/screenshot-preview';
import { ScreenshotTarget } from '@/lib/db';
import { 
  apiRequest, 
  FrontendError, 
  createErrorToast, 
  createSuccessToast,
  createWarningToast
} from '@/lib/error-handling';

export default function Dashboard() {
  const [targets, setTargets] = useState<ScreenshotTarget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ScreenshotTarget | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { addToast } = useToast();

  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<ScreenshotTarget[]>('/api/targets');
      setTargets(data);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      if (error instanceof FrontendError) {
        addToast(createErrorToast(error));
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to load targets. Please refresh the page.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleSaveTarget = async (targetData: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTarget) {
        await apiRequest(`/api/targets/${editingTarget.id}`, {
          method: 'PUT',
          body: JSON.stringify(targetData),
        });
        addToast(createSuccessToast(`Target "${targetData.name}" updated successfully`));
      } else {
        await apiRequest('/api/targets', {
          method: 'POST',
          body: JSON.stringify(targetData),
        });
        addToast(createSuccessToast(`Target "${targetData.name}" created successfully`));
      }
      
      await fetchTargets();
      setRefreshKey(prev => prev + 1); // Force refresh of child components
    } catch (error) {
      console.error('Failed to save target:', error);
      if (error instanceof FrontendError) {
        addToast(createErrorToast(error));
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to save target. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDeleteTarget = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the target "${name}"?`)) return;
    
    try {
      await apiRequest(`/api/targets/${id}`, {
        method: 'DELETE',
      });
      
      addToast(createSuccessToast(`Target "${name}" deleted successfully`));
      await fetchTargets();
      setRefreshKey(prev => prev + 1); // Force refresh of child components
    } catch (error) {
      console.error('Failed to delete target:', error);
      if (error instanceof FrontendError) {
        addToast(createErrorToast(error));
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to delete target. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleRunScreenshots = async () => {
    if (targets.length === 0) {
      addToast(createWarningToast('No targets available to screenshot'));
      return;
    }

    setIsRunning(true);
    try {
      const result = await apiRequest<{
        success: boolean;
        totalTargets: number;
        successCount: number;
        failureCount: number;
        results: Array<{ target: string; success: boolean; error?: string }>;
      }>('/api/screenshot/run', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      console.log('Screenshot run completed:', result);
      
      if (result.failureCount === 0) {
        addToast(createSuccessToast(
          `All ${result.successCount} screenshots completed successfully!`
        ));
      } else if (result.successCount > 0) {
        addToast(createWarningToast(
          `Screenshots completed: ${result.successCount} successful, ${result.failureCount} failed`
        ));
      } else {
        addToast({
          title: 'Screenshots Failed',
          description: `All ${result.failureCount} screenshot attempts failed`,
          variant: 'destructive',
        });
      }
      
      // Refresh screenshot previews
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to run screenshots:', error);
      if (error instanceof FrontendError) {
        addToast(createErrorToast(error));
      } else {
        addToast({
          title: 'Screenshot Error',
          description: 'Failed to run screenshots. Please try again.',
          variant: 'destructive',
        });
      }
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
        <LoadingState message="Loading targets..." size="lg" className="min-h-[200px]" />
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
          <LoadingOverlay isLoading={isRunning} message="Running screenshots...">
            <Button onClick={handleRunScreenshots} disabled={isRunning || targets.length === 0}>
              <Camera className="w-4 h-4 mr-2" />
              {isRunning ? 'Running...' : 'Run Screenshots'}
            </Button>
          </LoadingOverlay>
          <Button onClick={openAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            Add Target
          </Button>
        </div>
      </div>

      <ErrorBoundary
        resetKeys={[targets.length]}
        resetOnPropsChange={true}
        onError={(error, errorInfo) => {
          console.error('Dashboard content error:', error, errorInfo);
          addToast({
            title: 'Display Error',
            description: 'There was an error displaying the targets. Please refresh the page.',
            variant: 'destructive',
          });
        }}
      >
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
              <ErrorBoundary
                key={target.id}
                resetKeys={[target.id || 0, refreshKey]}
                resetOnPropsChange={true}
                fallback={
                  <div className="border rounded-lg p-4 bg-muted/50 border-destructive/20">
                    <div className="text-destructive text-sm">
                      Error displaying target &quot;{target.name}&quot;. Please refresh the page.
                    </div>
                  </div>
                }
              >
                <div className="border rounded-lg p-4 bg-card">
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
                        key={`${target.id}-${refreshKey}`}
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
                          onClick={() => handleDeleteTarget(target.id!, target.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ErrorBoundary>
            ))}
          </div>
        )}
      </ErrorBoundary>

      <TargetForm
        target={editingTarget}
        open={showForm}
        onOpenChange={setShowForm}
        onSave={handleSaveTarget}
      />
    </div>
  );
}