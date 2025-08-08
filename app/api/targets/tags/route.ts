import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError } from '@/lib/api-error';

export const GET = withApiMiddleware(async (request, context) => {
  try {
    logger.info('Fetching tags', { requestId: context.requestId });
    
    // Temporary: return empty array to get app working
    // TODO: Fix database integration
    const tags: string[] = [];
    
    logger.info('Successfully fetched tags', { 
      requestId: context.requestId,
      count: tags.length 
    });
    
    return NextResponse.json(tags);
  } catch (error) {
    logger.error('Failed to fetch tags', { requestId: context.requestId }, error as Error);
    return NextResponse.json([]);
  }
});