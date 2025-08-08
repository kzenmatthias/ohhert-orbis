import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddlewareParams, parseJsonBody } from '@/lib/api-middleware';
import { validateRequest, cronJobValidationSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { createDatabaseError, createNotFoundError, createValidationError } from '@/lib/api-error';
import { cronScheduler } from '@/lib/cron-scheduler';

export const GET = withApiMiddlewareParams<{ id: string }>(async (request, context, routeContext) => {
  const params = await routeContext.params;
  const id = parseInt(params.id, 10);
  
  if (isNaN(id) || id <= 0) {
    throw createValidationError('Invalid cron job ID');
  }

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
    
    logger.info('Successfully fetched cron job', { 
      requestId: context.requestId,
      cronJobId: id
    });
    
    return NextResponse.json(cronJob);
  } catch (error) {
    if ((error as any).name === 'NotFoundError') {
      throw error;
    }
    
    logger.databaseError('getCronJob', error as Error, { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    throw createDatabaseError('Failed to fetch cron job', error instanceof Error ? error.message : undefined);
  }
});

export const PUT = withApiMiddlewareParams<{ id: string }>(async (request, context, routeContext) => {
  const params = await routeContext.params;
  const id = parseInt(params.id, 10);
  
  if (isNaN(id) || id <= 0) {
    throw createValidationError('Invalid cron job ID');
  }

  const body = await parseJsonBody(request);
  
  // Create a partial validation schema for updates (no required fields)
  const updateSchema = { ...cronJobValidationSchema };
  Object.keys(updateSchema).forEach(key => {
    updateSchema[key] = { ...updateSchema[key], required: false };
  });
  
  validateRequest(updateSchema)(body);
  
  const cronJobData = body as {
    name?: string;
    cronExpression?: string;
    enabled?: boolean;
    cronJobTargets?: Array<{ targetId: number }>;
  };

  logger.info('Updating cron job', { 
    requestId: context.requestId,
    cronJobId: id,
    updates: Object.keys(cronJobData).join(',')
  });

  try {
    logger.databaseOperation('updateCronJob', 'cron_jobs', { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    
    const db = getDb();
    const cronJob = db.updateCronJob(id, {
      ...cronJobData,
      cronJobTargets: cronJobData.cronJobTargets?.map(target => ({ 
        targetId: target.targetId,
        cronJobId: id 
      }))
    });
    
    if (!cronJob) {
      throw createNotFoundError('Cron job not found');
    }

    // Update scheduling if cron job is enabled and expression or enabled status changed
    if (cronJobData.enabled !== undefined || cronJobData.cronExpression !== undefined) {
      // First unschedule the existing job
      await cronScheduler.unscheduleCronJob(id);
      
      // Reschedule if enabled
      if (cronJob.enabled) {
        await cronScheduler.scheduleCronJob(cronJob);
      }
    }

    logger.info('Cron job updated successfully', { 
      requestId: context.requestId,
      cronJobId: id,
      rescheduled: cronJobData.enabled !== undefined || cronJobData.cronExpression !== undefined
    });
    
    return NextResponse.json(cronJob);
  } catch (error) {
    if ((error as any).name === 'NotFoundError') {
      throw error;
    }
    
    logger.databaseError('updateCronJob', error as Error, { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    throw createDatabaseError('Failed to update cron job', error instanceof Error ? error.message : undefined);
  }
});

export const DELETE = withApiMiddlewareParams<{ id: string }>(async (request, context, routeContext) => {
  const params = await routeContext.params;
  const id = parseInt(params.id, 10);
  
  if (isNaN(id) || id <= 0) {
    throw createValidationError('Invalid cron job ID');
  }

  logger.info('Deleting cron job', { 
    requestId: context.requestId,
    cronJobId: id
  });

  try {
    logger.databaseOperation('deleteCronJob', 'cron_jobs', { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    
    // First unschedule the cron job
    await cronScheduler.unscheduleCronJob(id);
    
    const db = getDb();
    const success = db.deleteCronJob(id);
    
    if (!success) {
      throw createNotFoundError('Cron job not found');
    }

    logger.info('Cron job deleted successfully', { 
      requestId: context.requestId,
      cronJobId: id
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Cron job ${id} deleted successfully` 
    });
  } catch (error) {
    if ((error as any).name === 'NotFoundError') {
      throw error;
    }
    
    logger.databaseError('deleteCronJob', error as Error, { 
      requestId: context.requestId,
      cronJobId: id.toString()
    });
    throw createDatabaseError('Failed to delete cron job', error instanceof Error ? error.message : undefined);
  }
});