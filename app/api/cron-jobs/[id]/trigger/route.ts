import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddlewareParams } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError, createNotFoundError, createValidationError } from '@/lib/api-error';

export const POST = withApiMiddlewareParams<{ id: string }>(async (request, context, routeContext) => {
  const params = await routeContext.params;
  const id = parseInt(params.id, 10);
  
  if (isNaN(id) || id <= 0) {
    throw createValidationError('Invalid cron job ID');
  }

  logger.info('Manually triggering cron job', { 
    requestId: context.requestId,
    cronJobId: id
  });

  try {
    logger.databaseOperation('getCronJob', 'cron_jobs', { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    
    const db = getDb();
    const cronJob = db.getCronJob(id);
    
    if (!cronJob) {
      throw createNotFoundError('Cron job not found');
    }

    if (!cronJob.cronJobTargets || cronJob.cronJobTargets.length === 0) {
      throw createValidationError('Cron job has no associated targets');
    }

    const startTime = Date.now();
    
    // Get target IDs
    const targetIds = cronJob.cronJobTargets.map(cjt => cjt.targetId);
    
    logger.info('Executing screenshots for cron job targets', {
      requestId: context.requestId,
      cronJobId: id,
      targetIds: targetIds.join(',')
    });

    // Execute screenshots for the associated targets
    // This calls the same screenshot logic but filtered for specific targets
    const screenshotResult = await executeScreenshotsForTargets(targetIds);
    
    // Update last run time
    const lastRun = new Date().toISOString();
    db.updateCronJob(id, { lastRun });

    const duration = Date.now() - startTime;
    
    logger.info('Cron job manual execution completed', {
      requestId: context.requestId,
      cronJobId: id,
      duration,
      targetCount: targetIds.length,
      successCount: screenshotResult.successCount,
      failureCount: screenshotResult.failureCount
    });
    
    return NextResponse.json({
      success: true,
      cronJobId: id,
      cronJobName: cronJob.name,
      executedAt: lastRun,
      duration,
      results: {
        totalTargets: targetIds.length,
        successCount: screenshotResult.successCount,
        failureCount: screenshotResult.failureCount,
        details: screenshotResult.results
      }
    });
  } catch (error) {
    if ((error as any).name === 'NotFoundError' || (error as any).name === 'ValidationError') {
      throw error;
    }
    
    logger.databaseError('triggerCronJob', error as Error, { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    throw createDatabaseError('Failed to trigger cron job', error instanceof Error ? error.message : undefined);
  }
});

// Helper function to execute screenshots for specific targets
async function executeScreenshotsForTargets(targetIds: number[]): Promise<{
  successCount: number;
  failureCount: number;
  results: Array<{ targetId: number; success: boolean; error?: string }>;
}> {
  try {
    // This should ideally reuse the same screenshot logic from /api/screenshot/run
    // but filtered for specific targets. For now, we'll simulate the execution.
    
    const results: Array<{ targetId: number; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failureCount = 0;

    // TODO: Replace with actual screenshot execution logic
    // This is a placeholder that simulates screenshot execution
    for (const targetId of targetIds) {
      try {
        // Simulate screenshot execution
        // In real implementation, this would call the screenshot service
        // with the specific target
        
        results.push({ targetId, success: true });
        successCount++;
      } catch (error) {
        results.push({ 
          targetId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      results
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