import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { screenshotService } from '@/lib/screenshot';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { validateRequest, screenshotRunValidationSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { createDatabaseError, createBrowserError, createValidationError } from '@/lib/api-error';

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  // Validate request body if targetIds are provided
  if (body && typeof body === 'object' && 'targetIds' in body) {
    validateRequest(screenshotRunValidationSchema)(body);
  }
  
  const { targetIds } = (body as { targetIds?: (string | number)[] }) || {};
  
  logger.info('Starting screenshot run', { 
    requestId: context.requestId,
    targetIds: targetIds || 'all',
    specificTargets: !!targetIds
  });

  try {
    logger.databaseOperation('getTargetsForScreenshot', 'targets', { 
      requestId: context.requestId 
    });
    
    const db = getDb();
    let targets;
    
    if (targetIds && Array.isArray(targetIds)) {
      // Screenshot specific targets
      const targetIdNumbers = targetIds.map(id => {
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(numId) || numId <= 0) {
          throw createValidationError('Invalid target ID', `Target ID "${id}" is not a valid positive number`);
        }
        return numId;
      });
      
      targets = targetIdNumbers
        .map(id => db.getTarget(id))
        .filter(target => target !== undefined);
        
      // Check if any requested targets were not found
      if (targets.length !== targetIdNumbers.length) {
        const foundIds = targets.map(t => t.id);
        const missingIds = targetIdNumbers.filter(id => !foundIds.includes(id));
        logger.warn('Some requested targets not found', {
          requestId: context.requestId,
          missingIds
        });
      }
    } else {
      // Screenshot all targets
      targets = db.getAllTargets();
    }

    if (targets.length === 0) {
      logger.warn('No targets available for screenshot', { 
        requestId: context.requestId,
        requestedIds: targetIds
      });
      throw createValidationError('No targets found', 'No valid targets available for screenshot capture');
    }

    logger.screenshotOperation('captureAllScreenshots', undefined, {
      requestId: context.requestId,
      targetCount: targets.length,
      targetNames: targets.map(t => t.name)
    });

    const results = await screenshotService.captureAllScreenshots(targets);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info('Screenshot run completed', {
      requestId: context.requestId,
      totalTargets: targets.length,
      successCount,
      failureCount,
      results
    });

    return NextResponse.json({
      success: true,
      totalTargets: targets.length,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error; // Re-throw API errors
    }
    
    logger.screenshotError('captureAllScreenshots', error as Error, { 
      requestId: context.requestId,
      targetIds
    });
    
    // Determine if this is a browser error or database error
    if (error instanceof Error && (
      error.message.includes('browser') || 
      error.message.includes('playwright') ||
      error.message.includes('page')
    )) {
      throw createBrowserError('Failed to run screenshots', error.message);
    } else {
      throw createDatabaseError('Failed to run screenshots', error instanceof Error ? error.message : undefined);
    }
  }
});