import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { validateRequest, targetValidationSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { createDatabaseError } from '@/lib/api-error';

export const GET = withApiMiddleware(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
    
    logger.databaseOperation('searchTargets', 'targets', { 
      requestId: context.requestId,
      query,
      category,
      tags: tags?.join(',')
    });
    
    const db = getDb();
    const targets = query || category || tags ? 
      db.searchTargets(query, category, tags) : 
      db.getAllTargets();
    
    logger.info('Successfully fetched targets', { 
      requestId: context.requestId,
      count: targets.length,
      filtered: !!(query || category || tags)
    });
    
    return NextResponse.json(targets);
  } catch (error) {
    logger.databaseError('searchTargets', error as Error, { requestId: context.requestId });
    throw createDatabaseError('Failed to fetch targets', error instanceof Error ? error.message : undefined);
  }
});

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  // Validate request body
  validateRequest(targetValidationSchema)(body);
  
  const targetData = body as {
    name: string;
    requiresLogin?: boolean;
    loginUrl?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    usernameEnvKey?: string;
    passwordEnvKey?: string;
    urls?: Array<{ name: string; url: string }>;
  };
  
  logger.info('Creating target', { 
    requestId: context.requestId,
    targetName: targetData.name,
    requiresLogin: targetData.requiresLogin,
    urlCount: targetData.urls?.length || 0
  });

  try {
    logger.databaseOperation('createTarget', 'targets', { requestId: context.requestId });
    const db = getDb();
    
    const target = db.createTarget({
      name: targetData.name,
      requiresLogin: targetData.requiresLogin || false,
      loginUrl: targetData.loginUrl,
      usernameSelector: targetData.usernameSelector,
      passwordSelector: targetData.passwordSelector,
      submitSelector: targetData.submitSelector,
      usernameEnvKey: targetData.usernameEnvKey,
      passwordEnvKey: targetData.passwordEnvKey,
      category: (targetData as { category?: string }).category,
      tags: (targetData as { tags?: string[] }).tags,
      urls: targetData.urls?.map(url => ({ 
        name: url.name, 
        url: url.url,
        targetId: 0 // This will be set by the database layer
      })) || [],
    });

    logger.info('Target created successfully', { 
      requestId: context.requestId,
      targetId: target.id?.toString(),
      targetName: target.name
    });
    
    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    logger.databaseError('createTarget', error as Error, { 
      requestId: context.requestId,
      targetName: targetData.name
    });
    throw createDatabaseError('Failed to create target', error instanceof Error ? error.message : undefined);
  }
});