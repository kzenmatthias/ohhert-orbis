import * as cron from 'node-cron';
import { getDb, CronJob } from './db';
import { logger } from './logger';

interface ScheduledJob {
  cronJob: CronJob;
  task: cron.ScheduledTask;
}

export class CronScheduler {
  private static instance: CronScheduler;
  private scheduledJobs: Map<number, ScheduledJob> = new Map();

  private constructor() {}

  public static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  /**
   * Initialize the scheduler and start all enabled cron jobs
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing cron scheduler...');
      
      const db = getDb();
      const cronJobs = db.getAllCronJobs();
      
      for (const cronJob of cronJobs) {
        if (cronJob.enabled) {
          await this.scheduleCronJob(cronJob);
        }
      }
      
      logger.info(`Cron scheduler initialized with ${this.scheduledJobs.size} active jobs`);
    } catch (error) {
      logger.error('Failed to initialize cron scheduler', {}, error as Error);
      throw error;
    }
  }

  /**
   * Schedule a cron job
   */
  public async scheduleCronJob(cronJob: CronJob): Promise<void> {
    try {
      // Validate cron expression
      if (!cron.validate(cronJob.cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronJob.cronExpression}`);
      }

      // Remove existing job if it exists
      if (this.scheduledJobs.has(cronJob.id!)) {
        await this.unscheduleCronJob(cronJob.id!);
      }

      logger.info('Scheduling cron job', {
        cronJobId: cronJob.id,
        name: cronJob.name,
        expression: cronJob.cronExpression,
        enabled: cronJob.enabled
      });

      // Create the scheduled task
      const task = cron.schedule(cronJob.cronExpression, async () => {
        await this.executeCronJob(cronJob);
      }, {
        timezone: 'UTC'
      });

      // Calculate next run time
      const nextRun = this.calculateNextRun(cronJob.cronExpression);
      
      // Update database with next run time
      const db = getDb();
      db.updateCronJob(cronJob.id!, { nextRun });

      // Store the scheduled job
      this.scheduledJobs.set(cronJob.id!, {
        cronJob: { ...cronJob, nextRun },
        task
      });

      // Start the task
      task.start();

      logger.info('Cron job scheduled successfully', {
        cronJobId: cronJob.id,
        nextRun
      });
    } catch (error) {
      logger.error('Failed to schedule cron job', {
        cronJobId: cronJob.id,
        name: cronJob.name
      }, error as Error);
      throw error;
    }
  }

  /**
   * Unschedule a cron job
   */
  public async unscheduleCronJob(cronJobId: number): Promise<void> {
    try {
      const scheduledJob = this.scheduledJobs.get(cronJobId);
      if (scheduledJob) {
        logger.info('Unscheduling cron job', {
          cronJobId,
          name: scheduledJob.cronJob.name
        });

        scheduledJob.task.stop();
        scheduledJob.task.destroy();
        this.scheduledJobs.delete(cronJobId);

        logger.info('Cron job unscheduled successfully', { cronJobId });
      }
    } catch (error) {
      logger.error('Failed to unschedule cron job', { cronJobId }, error as Error);
      throw error;
    }
  }

  /**
   * Execute a cron job
   */
  private async executeCronJob(cronJob: CronJob): Promise<void> {
    try {
      const startTime = Date.now();
      logger.info('Executing cron job', {
        cronJobId: cronJob.id,
        name: cronJob.name,
        targetCount: cronJob.cronJobTargets?.length || 0
      });

      // Update last run time
      const lastRun = new Date().toISOString();
      const nextRun = this.calculateNextRun(cronJob.cronExpression);
      
      const db = getDb();
      db.updateCronJob(cronJob.id!, { lastRun, nextRun });

      // Execute screenshots for all associated targets
      if (cronJob.cronJobTargets && cronJob.cronJobTargets.length > 0) {
        const targetIds = cronJob.cronJobTargets.map(cjt => cjt.targetId);
        
        // Call the screenshot API for these specific targets
        const results = await this.executeScreenshotsForTargets(targetIds);
        
        const duration = Date.now() - startTime;
        logger.info('Cron job execution completed', {
          cronJobId: cronJob.id,
          name: cronJob.name,
          duration,
          targetCount: targetIds.length,
          successCount: results.successCount,
          failureCount: results.failureCount
        });
      } else {
        logger.warn('Cron job has no associated targets', {
          cronJobId: cronJob.id,
          name: cronJob.name
        });
      }
    } catch (error) {
      logger.error('Cron job execution failed', {
        cronJobId: cronJob.id,
        name: cronJob.name
      }, error as Error);
    }
  }

  /**
   * Execute screenshots for specific targets
   */
  private async executeScreenshotsForTargets(targetIds: number[]): Promise<{
    successCount: number;
    failureCount: number;
    results: Array<{ targetId: number; success: boolean; error?: string }>;
  }> {
    try {
      // This would typically call the screenshot service
      // For now, we'll simulate the execution
      logger.info('Executing screenshots for cron job targets', {
        targetIds: targetIds.join(',')
      });

      // TODO: Implement actual screenshot execution
      // This should call the same screenshot logic used by the /api/screenshot/run endpoint
      // but filtered for specific targets
      
      return {
        successCount: targetIds.length,
        failureCount: 0,
        results: targetIds.map(id => ({ targetId: id, success: true }))
      };
    } catch (error) {
      logger.error('Failed to execute screenshots for targets', {
        targetIds: targetIds.join(',')
      }, error as Error);
      
      return {
        successCount: 0,
        failureCount: targetIds.length,
        results: targetIds.map(id => ({ 
          targetId: id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      };
    }
  }

  /**
   * Calculate the next run time for a cron expression
   */
  private calculateNextRun(cronExpression: string): string {
    try {
      // Use node-cron to get the next execution time
      const task = cron.schedule(cronExpression, () => {});
      
      // Since node-cron doesn't provide a direct way to get next run time,
      // we'll use a simple approximation based on current time + 1 minute
      // In a production environment, you might want to use a more sophisticated
      // cron parser like 'cron-parser' package
      const now = new Date();
      const nextRun = new Date(now.getTime() + 60000); // Add 1 minute as approximation
      
      task.destroy();
      return nextRun.toISOString();
    } catch (error) {
      logger.error('Failed to calculate next run time', { cronExpression }, error as Error);
      // Return a default next run time (1 hour from now)
      const nextRun = new Date(Date.now() + 3600000);
      return nextRun.toISOString();
    }
  }

  /**
   * Get all currently scheduled jobs
   */
  public getScheduledJobs(): CronJob[] {
    return Array.from(this.scheduledJobs.values()).map(sj => sj.cronJob);
  }

  /**
   * Validate a cron expression
   */
  public static validateCronExpression(expression: string): boolean {
    return cron.validate(expression);
  }

  /**
   * Reload all cron jobs from database
   */
  public async reloadCronJobs(): Promise<void> {
    try {
      logger.info('Reloading cron jobs from database...');
      
      // Stop all current jobs
      for (const [cronJobId] of this.scheduledJobs) {
        await this.unscheduleCronJob(cronJobId);
      }
      
      // Reinitialize from database
      await this.initialize();
    } catch (error) {
      logger.error('Failed to reload cron jobs', {}, error as Error);
      throw error;
    }
  }

  /**
   * Shutdown the scheduler and stop all jobs
   */
  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down cron scheduler...');
      
      for (const [cronJobId] of this.scheduledJobs) {
        await this.unscheduleCronJob(cronJobId);
      }
      
      logger.info('Cron scheduler shutdown completed');
    } catch (error) {
      logger.error('Failed to shutdown cron scheduler', {}, error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const cronScheduler = CronScheduler.getInstance();