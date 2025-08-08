import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError, createValidationError } from '@/lib/api-error';

export const PUT = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  if (!body.targetIds || !Array.isArray(body.targetIds) || body.targetIds.length === 0) {
    throw createValidationError('targetIds must be a non-empty array');
  }
  
  if (!body.updates || typeof body.updates !== 'object') {
    throw createValidationError('updates must be an object');
  }
  
  const { targetIds, updates } = body as {
    targetIds: number[];
    updates: {
      category?: string;
      tags?: string[];
      requiresLogin?: boolean;
    };
  };
  
  logger.info('Bulk updating targets', { 
    requestId: context.requestId,
    targetIds: targetIds.join(','),
    updateFields: Object.keys(updates).join(',')
  });

  try {
    logger.databaseOperation('bulkUpdateTargets', 'targets', { requestId: context.requestId });
    const db = getDb();
    
    const updatedCount = db.bulkUpdateTargets(targetIds, updates);

    logger.info('Targets bulk updated successfully', { 
      requestId: context.requestId,
      updatedCount
    });
    
    return NextResponse.json({ 
      success: true, 
      updatedCount,
      message: `Successfully updated ${updatedCount} targets`
    });
  } catch (error) {
    logger.databaseError('bulkUpdateTargets', error as Error, { 
      requestId: context.requestId,
      targetIds: targetIds.join(',')
    });
    throw createDatabaseError('Failed to bulk update targets', error instanceof Error ? error.message : undefined);
  }
});

export const DELETE = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  if (!body.targetIds || !Array.isArray(body.targetIds) || body.targetIds.length === 0) {
    throw createValidationError('targetIds must be a non-empty array');
  }
  
  const { targetIds } = body as { targetIds: number[] };
  
  logger.info('Bulk deleting targets', { 
    requestId: context.requestId,
    targetIds: targetIds.join(',')
  });

  try {
    logger.databaseOperation('bulkDeleteTargets', 'targets', { requestId: context.requestId });
    const db = getDb();
    
    const deletedCount = db.bulkDeleteTargets(targetIds);

    logger.info('Targets bulk deleted successfully', { 
      requestId: context.requestId,
      deletedCount
    });
    
    return NextResponse.json({ 
      success: true, 
      deletedCount,
      message: `Successfully deleted ${deletedCount} targets`
    });
  } catch (error) {
    logger.databaseError('bulkDeleteTargets', error as Error, { 
      requestId: context.requestId,
      targetIds: targetIds.join(',')
    });
    throw createDatabaseError('Failed to bulk delete targets', error instanceof Error ? error.message : undefined);
  }
});