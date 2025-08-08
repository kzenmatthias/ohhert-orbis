import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { withApiMiddlewareParams, parseRouteParams } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createFileSystemError, createValidationError, createNotFoundError, ApiError, ApiErrorCode } from '@/lib/api-error';

export const GET = withApiMiddlewareParams<{ path: string[] }>(async (request, context, { params }) => {
  const { path: pathSegments } = await parseRouteParams(params);
  
  // Validate path segments
  if (!pathSegments || pathSegments.length === 0) {
    throw createValidationError('Invalid path', 'Path segments are required');
  }
  
  // Validate each path segment for security
  for (const segment of pathSegments) {
    if (!segment || segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
      throw createValidationError('Invalid path segment', `Path segment "${segment}" contains invalid characters`);
    }
  }
  
  logger.info('Serving screenshot', {
    requestId: context.requestId,
    pathSegments: pathSegments.join('/'),
    segmentCount: pathSegments.length
  });

  try {
    // Reconstruct the file path from the segments
    const filePath = path.join(process.cwd(), 'screenshots', ...pathSegments);
    
    // Security check: ensure the path is within the screenshots directory
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const resolvedPath = path.resolve(filePath);
    const resolvedScreenshotsDir = path.resolve(screenshotsDir);
    
    if (!resolvedPath.startsWith(resolvedScreenshotsDir)) {
      logger.warn('Path traversal attempt detected', {
        requestId: context.requestId,
        requestedPath: pathSegments.join('/'),
        resolvedPath,
        screenshotsDir: resolvedScreenshotsDir
      });
      throw new ApiError('Access denied', ApiErrorCode.FORBIDDEN, 403, 'Path is outside allowed directory');
    }

    // Check if file exists and is a PNG
    if (!resolvedPath.endsWith('.png')) {
      logger.warn('Invalid file type requested', {
        requestId: context.requestId,
        requestedPath: pathSegments.join('/'),
        extension: path.extname(resolvedPath)
      });
      throw createValidationError('Invalid file type', 'Only PNG files are allowed');
    }

    logger.debug('Reading screenshot file', {
      requestId: context.requestId,
      filePath: resolvedPath
    });

    try {
      const fileBuffer = await fs.readFile(resolvedPath);
      
      logger.info('Screenshot served successfully', {
        requestId: context.requestId,
        filePath: pathSegments.join('/'),
        fileSize: fileBuffer.length
      });
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch {
      logger.warn('Screenshot file not found', {
        requestId: context.requestId,
        filePath: pathSegments.join('/'),
        resolvedPath
      });
      throw createNotFoundError('File not found', `Screenshot file "${pathSegments.join('/')}" does not exist`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ApiError') {
      throw error; // Re-throw API errors
    }
    
    logger.error('Error serving screenshot', {
      requestId: context.requestId,
      pathSegments: pathSegments.join('/')
    }, error as Error);
    
    throw createFileSystemError('Failed to serve screenshot', error instanceof Error ? error.message : undefined);
  }
});