'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Camera, Edit, Trash2, ExternalLink, Tag, Folder, CheckSquare, Square, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState, LoadingOverlay } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { TargetForm } from '@/components/target-form';
import { ScreenshotPreview } from '@/components/screenshot-preview';
import { TargetFilters } from '@/components/target-filters';
import { BulkOperations } from '@/components/bulk-operations';
import { CronJobManager } from '@/components/cron-job-manager';
import { ScreenshotTarget } from '@/lib/db';
import { 
  apiRequest, 
  FrontendError, 
  createErrorToast, 
  createSuccessToast,
  createWarningToast
} from '@/lib/error-handling';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'targets' | 'cron-jobs'>('targets');
  const [targets, setTargets] = useState<ScreenshotTarget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ScreenshotTarget | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [filters, setFilters] = useState<{
    query: string;
    category?: string;
    tags: string[];
  }>({
    query: '',
    category: undefined,
    tags: [],
  });
  
  const { addToast } = useToast();

  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query parameters using current filters
      const params = new URLSearchParams();
      if (filters.query) params.set('q', filters.query);
      if (filters.category) params.set('category', filters.category);
      if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
      
      const queryString = params.toString();
      const url = `/api/targets${queryString ? `?${queryString}` : ''}`;
      
      const data = await apiRequest<ScreenshotTarget[]>(url);
      setTargets(data);
      
      // Clear selection if targets changed
      setSelectedTargets(prev => prev.filter(id => data.some(t => t.id === id)));
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
  }, [addToast]); // Only depend on addToast, which should be stable

  useEffect(() => {
    fetchTargets();
  }, []); // Only run on initial load

  // Create a handler for filter changes that triggers fetch
  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    // Don't fetch immediately, let the next render cycle handle it
    setTimeout(() => {
      fetchTargets();
    }, 0);
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
      setSelectedTargets([]); // Clear selection after save
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
      setSelectedTargets(prev => prev.filter(selectedId => selectedId !== id)); // Remove from selection
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
          {activeTab === 'targets' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('targets')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'targets'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              Targets
            </button>
            <button
              onClick={() => setActiveTab('cron-jobs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cron-jobs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Scheduled Jobs
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'targets' && (
        <>
          {/* Search and Filters */}
          <div className="mb-6">
            <TargetFilters
              onFiltersChange={handleFiltersChange}
              initialFilters={filters}
            />
          </div>
        </>
      )}

      {activeTab === 'targets' && (
        <>
          {/* Bulk Operations */}
          {targets.length > 0 && (
            <div className="mb-4">
              <BulkOperations
                targets={targets}
                selectedTargets={selectedTargets}
                onSelectionChange={setSelectedTargets}
                onTargetsUpdated={fetchTargets}
              />
            </div>
          )}
        </>
      )}

      {/* Tab Content */}
      {activeTab === 'targets' && (
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
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => {
                          if (selectedTargets.includes(target.id!)) {
                            setSelectedTargets(prev => prev.filter(id => id !== target.id));
                          } else {
                            setSelectedTargets(prev => [...prev, target.id!]);
                          }
                        }}
                        className="mt-1 hover:bg-muted rounded p-1"
                      >
                        {selectedTargets.includes(target.id!) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{target.name}</h3>
                          {target.requiresLogin && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Requires Login
                            </span>
                          )}
                          {target.category && (
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              {target.category}
                            </span>
                          )}
                        </div>
                        {target.tags && target.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {target.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1"
                              >
                                <Tag className="h-3 w-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
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
      )}

      {activeTab === 'cron-jobs' && (
        <CronJobManager />
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