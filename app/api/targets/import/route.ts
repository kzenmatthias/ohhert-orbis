import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError, createValidationError } from '@/lib/api-error';

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  if (!body.targets || !Array.isArray(body.targets)) {
    throw createValidationError('targets must be an array');
  }
  
  const { targets, replaceExisting = false } = body as {
    targets: unknown[];
    replaceExisting?: boolean;
  };
  
  logger.info('Importing targets', { 
    requestId: context.requestId,
    targetCount: targets.length,
    replaceExisting
  });

  try {
    logger.databaseOperation('importTargets', 'targets', { requestId: context.requestId });
    const db = getDb();
    
    const result = db.importTargets(targets, replaceExisting);

    logger.info('Targets imported successfully', { 
      requestId: context.requestId,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.length
    });
    
    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      message: `Successfully imported ${result.imported} targets${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`
    });
  } catch (error) {
    logger.databaseError('importTargets', error as Error, { 
      requestId: context.requestId,
      targetCount: targets.length
    });
    throw createDatabaseError('Failed to import targets', error instanceof Error ? error.message : undefined);
  }
});