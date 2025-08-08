"use client";

import { useState, useEffect } from "react";
import { Clock, Info, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CronJob, CronJobTarget, ScreenshotTarget } from "@/lib/db";
import { apiRequest } from "@/lib/error-handling";
import { useToast } from "@/components/ui/toast";
import { createErrorToast } from "@/lib/error-handling";

interface CronJobFormProps {
  job?: CronJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (job: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>) => void;
}

export function CronJobForm({ job, open, onOpenChange, onSave }: CronJobFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    cronExpression: '0 9 * * 1-5', // Default: weekdays at 9 AM
    enabled: true,
  });
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [availableTargets, setAvailableTargets] = useState<ScreenshotTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [validatingCron, setValidatingCron] = useState(false);
  const [cronError, setCronError] = useState<string>('');

  const { addToast } = useToast();

  // Common cron expression presets
  const cronPresets = [
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Weekly on Monday', value: '0 9 * * 1' },
    { label: 'Monthly on 1st', value: '0 9 1 * *' },
  ];

  // Reset form when job changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (job) {
        setFormData({
          name: job.name,
          cronExpression: job.cronExpression,
          enabled: job.enabled,
        });
        setSelectedTargets(job.cronJobTargets?.map(cjt => cjt.targetId) || []);
      } else {
        setFormData({
          name: '',
          cronExpression: '0 9 * * 1-5',
          enabled: true,
        });
        setSelectedTargets([]);
      }
      setCronError('');
      fetchAvailableTargets();
    }
  }, [job, open]);

  const fetchAvailableTargets = async () => {
    try {
      const targets = await apiRequest<ScreenshotTarget[]>('/api/targets');
      setAvailableTargets(targets);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      addToast(createErrorToast(error as Error));
    }
  };

  const validateCronExpression = async (expression: string) => {
    if (!expression.trim()) {
      setCronError('Cron expression is required');
      return false;
    }

    setValidatingCron(true);
    setCronError('');

    try {
      // Simple client-side validation for cron format
      const parts = expression.trim().split(/\s+/);
      if (parts.length !== 5) {
        setCronError('Cron expression must have 5 parts: minute hour day month weekday');
        return false;
      }

      // Additional validation could be added here
      return true;
    } catch (error) {
      setCronError('Invalid cron expression format');
      return false;
    } finally {
      setValidatingCron(false);
    }
  };

  const handleCronExpressionChange = (value: string) => {
    setFormData(prev => ({ ...prev, cronExpression: value }));
    validateCronExpression(value);
  };

  const handleTargetToggle = (targetId: number) => {
    setSelectedTargets(prev => 
      prev.includes(targetId)
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setCronError('Job name is required');
      return;
    }

    if (selectedTargets.length === 0) {
      setCronError('At least one target must be selected');
      return;
    }

    const isValidCron = await validateCronExpression(formData.cronExpression);
    if (!isValidCron) {
      return;
    }

    setLoading(true);

    try {
      const cronJobData: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'> = {
        name: formData.name.trim(),
        cronExpression: formData.cronExpression.trim(),
        enabled: formData.enabled,
        cronJobTargets: selectedTargets.map(targetId => ({ targetId } as CronJobTarget)),
      };

      await onSave(cronJobData);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save cron job:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Clock className="w-5 h-5 inline mr-2" />
            {job ? 'Edit Cron Job' : 'Create Cron Job'}
          </DialogTitle>
          <DialogDescription>
            Set up automated screenshot schedules using cron expressions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Name */}
          <div className="space-y-2">
            <Label htmlFor="job-name">Job Name</Label>
            <Input
              id="job-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter job name (e.g., Daily Screenshots)"
              required
            />
          </div>

          {/* Cron Expression */}
          <div className="space-y-4">
            <Label htmlFor="cron-expression">Schedule (Cron Expression)</Label>
            
            {/* Presets */}
            <div className="grid grid-cols-2 gap-2">
              {cronPresets.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCronExpressionChange(preset.value)}
                  className="justify-start text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <Input
              id="cron-expression"
              value={formData.cronExpression}
              onChange={(e) => handleCronExpressionChange(e.target.value)}
              placeholder="0 9 * * 1-5"
              required
              className={cronError ? 'border-destructive' : ''}
            />
            
            {cronError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Info className="w-4 h-4" />
                {cronError}
              </p>
            )}

            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="font-medium mb-1">Cron Format: minute hour day month weekday</p>
              <p>Examples:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code>0 9 * * 1-5</code> - Weekdays at 9:00 AM</li>
                <li><code>*/15 * * * *</code> - Every 15 minutes</li>
                <li><code>0 */6 * * *</code> - Every 6 hours</li>
                <li><code>0 0 * * 0</code> - Weekly on Sunday at midnight</li>
              </ul>
            </div>
          </div>

          {/* Target Selection */}
          <div className="space-y-4">
            <Label>Select Targets</Label>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {availableTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No targets available. Create some targets first.
                </p>
              ) : (
                <div className="space-y-2 p-4">
                  {availableTargets.map((target) => (
                    <div
                      key={target.id}
                      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTargets.includes(target.id!)}
                          onChange={() => handleTargetToggle(target.id!)}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium">{target.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {target.urls?.length || 0} URLs
                            {target.category && (
                              <span className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">
                                {target.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedTargets.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedTargets.length} target{selectedTargets.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="job-enabled">Enable Job</Label>
              <p className="text-sm text-muted-foreground">
                Start this job immediately after creation
              </p>
            </div>
            <Switch
              id="job-enabled"
              checked={formData.enabled}
              onCheckedChange={(enabled) => setFormData(prev => ({ ...prev, enabled }))}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || validatingCron || cronError !== '' || selectedTargets.length === 0}
          >
            {loading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}