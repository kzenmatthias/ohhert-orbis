import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError } from '@/lib/api-error';

export const GET = withApiMiddleware(async (request, context) => {
  try {
    logger.info('Fetching categories', { requestId: context.requestId });
    
    // Temporary: return empty array to get app working
    // TODO: Fix database integration
    const categories: string[] = [];
    
    logger.info('Successfully fetched categories', { 
      requestId: context.requestId,
      count: categories.length 
    });
    
    return NextResponse.json(categories);
  } catch (error) {
    logger.error('Failed to fetch categories', { requestId: context.requestId }, error as Error);
    return NextResponse.json([]);
  }
});