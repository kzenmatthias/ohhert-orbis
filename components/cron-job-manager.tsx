"use client";

import { useState, useEffect } from "react";
import { 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  Plus,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle,
  PlayCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CronJobForm } from "@/components/cron-job-form";
import { CronJob } from "@/lib/db";
import { apiRequest } from "@/lib/error-handling";
import { useToast } from "@/components/ui/toast";
import { createSuccessToast, createErrorToast, createWarningToast } from "@/lib/error-handling";

export function CronJobManager() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>();
  const [triggeringJobs, setTriggeringJobs] = useState<Set<number>>(new Set());
  
  const { addToast } = useToast();

  const fetchCronJobs = async () => {
    try {
      setLoading(true);
      const jobs = await apiRequest<CronJob[]>('/api/cron-jobs');
      setCronJobs(jobs);
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error);
      addToast(createErrorToast(error as Error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCronJobs();
  }, []);

  const handleCreateJob = () => {
    setEditingJob(undefined);
    setShowForm(true);
  };

  const handleEditJob = (job: CronJob) => {
    setEditingJob(job);
    setShowForm(true);
  };

  const handleSaveJob = async (jobData: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>) => {
    try {
      if (editingJob) {
        await apiRequest(`/api/cron-jobs/${editingJob.id}`, {
          method: 'PUT',
          body: JSON.stringify(jobData),
        });
        addToast(createSuccessToast(`Cron job "${jobData.name}" updated successfully`));
      } else {
        await apiRequest('/api/cron-jobs', {
          method: 'POST',
          body: JSON.stringify(jobData),
        });
        addToast(createSuccessToast(`Cron job "${jobData.name}" created successfully`));
      }
      
      await fetchCronJobs();
      setShowForm(false);
    } catch (error) {
      console.error('Failed to save cron job:', error);
      addToast(createErrorToast(error as Error));
    }
  };

  const handleToggleEnabled = async (job: CronJob, enabled: boolean) => {
    try {
      await apiRequest(`/api/cron-jobs/${job.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      
      addToast(createSuccessToast(
        `Cron job "${job.name}" ${enabled ? 'enabled' : 'disabled'} successfully`
      ));
      
      await fetchCronJobs();
    } catch (error) {
      console.error('Failed to toggle cron job:', error);
      addToast(createErrorToast(error as Error));
    }
  };

  const handleDeleteJob = async (job: CronJob) => {
    if (!confirm(`Are you sure you want to delete the cron job "${job.name}"?`)) {
      return;
    }

    try {
      await apiRequest(`/api/cron-jobs/${job.id}`, {
        method: 'DELETE',
      });
      
      addToast(createSuccessToast(`Cron job "${job.name}" deleted successfully`));
      await fetchCronJobs();
    } catch (error) {
      console.error('Failed to delete cron job:', error);
      addToast(createErrorToast(error as Error));
    }
  };

  const handleTriggerJob = async (job: CronJob) => {
    if (!job.cronJobTargets || job.cronJobTargets.length === 0) {
      addToast(createWarningToast('This cron job has no associated targets'));
      return;
    }

    setTriggeringJobs(prev => new Set(prev).add(job.id!));
    
    try {
      const result = await apiRequest(`/api/cron-jobs/${job.id}/trigger`, {
        method: 'POST',
      });
      
      addToast(createSuccessToast(
        `Cron job "${job.name}" executed successfully. ${(result as any).results.successCount} screenshots completed.`
      ));
      
      await fetchCronJobs();
    } catch (error) {
      console.error('Failed to trigger cron job:', error);
      addToast(createErrorToast(error as Error));
    } finally {
      setTriggeringJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id!);
        return newSet;
      });
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatCronExpression = (expression: string) => {
    // Simple cron expression descriptions
    const commonExpressions: Record<string, string> = {
      '0 9 * * 1-5': 'Weekdays at 9 AM',
      '0 */6 * * *': 'Every 6 hours',
      '0 0 * * *': 'Daily at midnight',
      '0 12 * * *': 'Daily at noon',
      '0 0 * * 0': 'Weekly on Sunday',
      '0 0 1 * *': 'Monthly on 1st',
    };

    return commonExpressions[expression] || expression;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading cron jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Scheduled Jobs</h2>
          <p className="text-muted-foreground">
            Manage automated screenshot schedules
          </p>
        </div>
        <Button onClick={handleCreateJob}>
          <Plus className="w-4 h-4 mr-2" />
          Create Job
        </Button>
      </div>

      {cronJobs.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No scheduled jobs</h3>
          <p className="text-muted-foreground mb-4">
            Create your first cron job to automate screenshot captures.
          </p>
          <Button onClick={handleCreateJob}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Job
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Targets</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cronJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {job.cronExpression}
                      </code>
                      <div className="text-xs text-muted-foreground">
                        {formatCronExpression(job.cronExpression)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      <span>{job.cronJobTargets?.length || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(enabled) => handleToggleEnabled(job, enabled)}
                      />
                      <Badge variant={job.enabled ? "default" : "secondary"}>
                        {job.enabled ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 mr-1" />
                            Paused
                          </>
                        )}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(job.lastRun)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(job.nextRun)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTriggerJob(job)}
                        disabled={triggeringJobs.has(job.id!) || !job.enabled}
                      >
                        {triggeringJobs.has(job.id!) ? (
                          <Clock className="w-3 h-3 animate-spin" />
                        ) : (
                          <PlayCircle className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditJob(job)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteJob(job)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CronJobForm
        job={editingJob}
        open={showForm}
        onOpenChange={setShowForm}
        onSave={handleSaveJob}
      />
    </div>
  );
}