import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError } from '@/lib/api-error';

export const GET = withApiMiddleware(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const targetIdsParam = searchParams.get('targetIds');
    const targetIds = targetIdsParam ? 
      targetIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : 
      undefined;
    
    logger.databaseOperation('exportTargets', 'targets', { 
      requestId: context.requestId,
      targetIds: targetIds?.join(',') || 'all'
    });
    
    const db = getDb();
    const targets = db.exportTargets(targetIds);
    
    logger.info('Successfully exported targets', { 
      requestId: context.requestId,
      count: targets.length 
    });
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `orbis-targets-${timestamp}.json`;
    
    return new NextResponse(JSON.stringify(targets, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.databaseError('exportTargets', error as Error, { requestId: context.requestId });
    throw createDatabaseError('Failed to export targets', error instanceof Error ? error.message : undefined);
  }
});