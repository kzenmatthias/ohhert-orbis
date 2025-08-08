import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { createErrorResponse, ApiError, ApiErrorCode } from './api-error';

// Request context for tracking
export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  startTime: number;
}

// API handler type
export type ApiHandler = (
  request: NextRequest,
  context: RequestContext,
  params?: unknown
) => Promise<NextResponse>;

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract path from request
function extractPath(request: NextRequest): string {
  const url = new URL(request.url);
  return url.pathname;
}

// API middleware wrapper
export function withApiMiddleware(handler: ApiHandler) {
  return async (request: NextRequest, routeParams?: unknown): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const method = request.method;
    const path = extractPath(request);

    const context: RequestContext = {
      requestId,
      method,
      path,
      startTime,
    };

    // Log incoming request
    logger.apiRequest(method, path, { requestId });

    try {
      // Call the actual handler
      const response = await handler(request, context, routeParams);
      
      // Log successful response
      const duration = Date.now() - startTime;
      logger.apiResponse(method, path, response.status, duration, { requestId });
      
      return response;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      logger.apiError(method, path, error as Error, { 
        requestId, 
        duration,
      });

      // Return standardized error response
      return createErrorResponse(error, path);
    }
  };
}

// Wrapper for route handlers with params
export function withApiMiddlewareParams<T>(handler: (
  request: NextRequest,
  context: RequestContext,
  params: { params: Promise<T> }
) => Promise<NextResponse>) {
  return (request: NextRequest, routeParams: { params: Promise<T> }) => {
    const wrappedHandler: ApiHandler = async (req, ctx) => {
      return handler(req, ctx, routeParams);
    };
    return withApiMiddleware(wrappedHandler)(request);
  };
}

// Helper to parse JSON body with validation
export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    const body = await request.json();
    return body;
  } catch (error) {
    throw new ApiError(
      'Invalid JSON in request body',
      'VALIDATION_ERROR' as ApiErrorCode,
      400,
      error instanceof Error ? error.message : 'Unknown JSON parsing error'
    );
  }
}

// Helper to parse route parameters
export async function parseRouteParams<T>(params: Promise<T>): Promise<T> {
  try {
    return await params;
  } catch (error) {
    throw new ApiError(
      'Invalid route parameters',
      'VALIDATION_ERROR' as ApiErrorCode,
      400,
      error instanceof Error ? error.message : 'Unknown parameter parsing error'
    );
  }
}