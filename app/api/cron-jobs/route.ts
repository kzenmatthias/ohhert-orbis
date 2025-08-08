import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { validateRequest, cronJobValidationSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { createDatabaseError } from '@/lib/api-error';
import { cronScheduler } from '@/lib/cron-scheduler';

export const GET = withApiMiddleware(async (request, context) => {
  try {
    logger.databaseOperation('getAllCronJobs', 'cron_jobs', { requestId: context.requestId });
    const db = getDb();
    const cronJobs = db.getAllCronJobs();
    
    logger.info('Successfully fetched cron jobs', { 
      requestId: context.requestId,
      count: cronJobs.length 
    });
    
    return NextResponse.json(cronJobs);
  } catch (error) {
    logger.databaseError('getAllCronJobs', error as Error, { requestId: context.requestId });
    throw createDatabaseError('Failed to fetch cron jobs', error instanceof Error ? error.message : undefined);
  }
});

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  // Validate request body
  validateRequest(cronJobValidationSchema)(body);
  
  const cronJobData = body as {
    name: string;
    cronExpression: string;
    enabled?: boolean;
    cronJobTargets?: Array<{ targetId: number }>;
  };

  logger.info('Creating cron job', { 
    requestId: context.requestId,
    cronJobName: cronJobData.name,
    cronExpression: cronJobData.cronExpression,
    enabled: cronJobData.enabled ?? true,
    targetCount: cronJobData.cronJobTargets?.length || 0
  });

  try {
    logger.info('POST /api/cron-jobs - Starting cron job creation', {
      requestId: context.requestId,
      cronJobName: cronJobData.name,
      targetCount: cronJobData.cronJobTargets?.length
    });
    
    logger.databaseOperation('createCronJob', 'cron_jobs', { requestId: context.requestId });
    
    logger.info('Getting database instance...');
    const db = getDb();
    
    logger.info('Database instance retrieved, calling createCronJob...');
    
    const cronJob = db.createCronJob({
      name: cronJobData.name,
      cronExpression: cronJobData.cronExpression,
      enabled: cronJobData.enabled ?? true,
      cronJobTargets: (cronJobData.cronJobTargets || []).map(target => ({
        targetId: target.targetId,
        cronJobId: 0 // Will be set by the database
      }))
    });

    // Schedule the cron job if it's enabled
    // Temporarily disabled to debug creation issue
    // if (cronJob.enabled) {
    //   await cronScheduler.scheduleCronJob(cronJob);
    // }

    logger.info('Cron job created successfully', { 
      requestId: context.requestId,
      cronJobId: cronJob.id,
      scheduled: cronJob.enabled
    });
    
    return NextResponse.json(cronJob, { status: 201 });
  } catch (error) {
    logger.databaseError('createCronJob', error as Error, { 
      requestId: context.requestId,
      cronJobName: cronJobData.name
    });
    throw createDatabaseError('Failed to create cron job', error instanceof Error ? error.message : undefined);
  }
});