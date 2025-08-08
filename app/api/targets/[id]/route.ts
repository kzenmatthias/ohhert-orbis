import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddlewareParams, parseJsonBody, parseRouteParams } from '@/lib/api-middleware';
import { validateRequest, targetValidationSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { createDatabaseError, createNotFoundError, createValidationError } from '@/lib/api-error';

export const GET = withApiMiddlewareParams<{ id: string }>(async (request, context, { params }) => {
  const { id } = await parseRouteParams(params);
  
  // Validate ID parameter
  const targetId = parseInt(id);
  if (isNaN(targetId) || targetId <= 0) {
    throw createValidationError('Invalid target ID', 'Target ID must be a positive number');
  }

  try {
    logger.databaseOperation('getTarget', 'targets', { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    
    const db = getDb();
    const target = db.getTarget(targetId);
    
    if (!target) {
      logger.warn('Target not found', { 
        requestId: context.requestId,
        targetId: targetId.toString()
      });
      throw createNotFoundError('Target not found', `No target found with ID ${targetId}`);
    }

    logger.info('Successfully fetched target', { 
      requestId: context.requestId,
      targetId: targetId.toString(),
      targetName: target.name
    });

    return NextResponse.json(target);
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error; // Re-throw API errors
    }
    
    logger.databaseError('getTarget', error as Error, { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    throw createDatabaseError('Failed to fetch target', error instanceof Error ? error.message : undefined);
  }
});

export const PUT = withApiMiddlewareParams<{ id: string }>(async (request, context, { params }) => {
  const { id } = await parseRouteParams(params);
  const body = await parseJsonBody(request);
  
  // Validate ID parameter
  const targetId = parseInt(id);
  if (isNaN(targetId) || targetId <= 0) {
    throw createValidationError('Invalid target ID', 'Target ID must be a positive number');
  }
  
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
  
  logger.info('Updating target', { 
    requestId: context.requestId,
    targetId: targetId.toString(),
    targetName: targetData.name,
    requiresLogin: targetData.requiresLogin,
    urlCount: targetData.urls?.length || 0
  });

  try {
    logger.databaseOperation('updateTarget', 'targets', { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    
    const db = getDb();
    const target = db.updateTarget(targetId, {
      name: targetData.name,
      requiresLogin: targetData.requiresLogin,
      loginUrl: targetData.loginUrl,
      usernameSelector: targetData.usernameSelector,
      passwordSelector: targetData.passwordSelector,
      submitSelector: targetData.submitSelector,
      usernameEnvKey: targetData.usernameEnvKey,
      passwordEnvKey: targetData.passwordEnvKey,
      urls: targetData.urls?.map(url => ({ 
        name: url.name, 
        url: url.url,
        targetId: targetId // This will be overridden by the database layer
      })) || [],
    });

    if (!target) {
      logger.warn('Target not found for update', { 
        requestId: context.requestId,
        targetId: targetId.toString()
      });
      throw createNotFoundError('Target not found', `No target found with ID ${targetId}`);
    }

    logger.info('Target updated successfully', { 
      requestId: context.requestId,
      targetId: targetId.toString(),
      targetName: target.name
    });

    return NextResponse.json(target);
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error; // Re-throw API errors
    }
    
    logger.databaseError('updateTarget', error as Error, { 
      requestId: context.requestId,
      targetId: targetId.toString(),
      targetName: targetData.name
    });
    throw createDatabaseError('Failed to update target', error instanceof Error ? error.message : undefined);
  }
});

export const DELETE = withApiMiddlewareParams<{ id: string }>(async (request, context, { params }) => {
  const { id } = await parseRouteParams(params);
  
  // Validate ID parameter
  const targetId = parseInt(id);
  if (isNaN(targetId) || targetId <= 0) {
    throw createValidationError('Invalid target ID', 'Target ID must be a positive number');
  }

  logger.info('Deleting target', { 
    requestId: context.requestId,
    targetId: targetId.toString()
  });

  try {
    logger.databaseOperation('deleteTarget', 'targets', { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    
    const db = getDb();
    const success = db.deleteTarget(targetId);
    
    if (!success) {
      logger.warn('Target not found for deletion', { 
        requestId: context.requestId,
        targetId: targetId.toString()
      });
      throw createNotFoundError('Target not found', `No target found with ID ${targetId}`);
    }

    logger.info('Target deleted successfully', { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error; // Re-throw API errors
    }
    
    logger.databaseError('deleteTarget', error as Error, { 
      requestId: context.requestId,
      targetId: targetId.toString()
    });
    throw createDatabaseError('Failed to delete target', error instanceof Error ? error.message : undefined);
  }
});