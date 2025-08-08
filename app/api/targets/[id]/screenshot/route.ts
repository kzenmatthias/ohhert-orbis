import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getLatestSessionScreenshots } from '@/lib/screenshot-utils';
import { withApiMiddlewareParams, parseRouteParams } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError, createNotFoundError, createValidationError, createFileSystemError } from '@/lib/api-error';

export const GET = withApiMiddlewareParams<{ id: string }>(async (request, context, { params }) => {
  const { id } = await parseRouteParams(params);
  
  // Validate ID parameter
  const targetId = parseInt(id);
  if (isNaN(targetId) || targetId <= 0) {
    throw createValidationError('Invalid target ID', 'Target ID must be a positive number');
  }

  logger.info('Getting screenshots for target', {
    requestId: context.requestId,
    targetId: targetId.toString()
  });

  try {
    logger.databaseOperation('getTarget', 'targets', { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    
    const db = getDb();
    const target = db.getTarget(targetId);
    
    if (!target) {
      logger.warn('Target not found for screenshot retrieval', { 
        requestId: context.requestId,
        targetId: targetId.toString()
      });
      throw createNotFoundError('Target not found', `No target found with ID ${targetId}`);
    }

    logger.debug('Retrieving latest session screenshots', {
      requestId: context.requestId,
      targetId: targetId.toString(),
      targetName: target.name
    });

    try {
      const screenshots = await getLatestSessionScreenshots(target.name);
      
      logger.info('Screenshots retrieved successfully', {
        requestId: context.requestId,
        targetId: targetId.toString(),
        targetName: target.name,
        screenshotCount: screenshots.length
      });
      
      if (screenshots.length === 0) {
        return NextResponse.json({ screenshots: [] });
      }

      // Return screenshot info with API paths
      return NextResponse.json({
        screenshots: screenshots.map(screenshot => ({
          filename: screenshot.filename,
          date: screenshot.date,
          timestamp: screenshot.timestamp,
          url: `/api/screenshots/${screenshot.date}/${screenshot.filename}`,
        }))
      });
    } catch (screenshotError) {
      logger.error('Error retrieving screenshots from filesystem', {
        requestId: context.requestId,
        targetId: targetId.toString(),
        targetName: target.name
      }, screenshotError as Error);
      
      throw createFileSystemError(
        'Failed to retrieve screenshots', 
        screenshotError instanceof Error ? screenshotError.message : undefined
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error; // Re-throw API errors
    }
    
    logger.databaseError('getTarget', error as Error, { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    throw createDatabaseError('Failed to get target for screenshot retrieval', error instanceof Error ? error.message : undefined);
  }
});