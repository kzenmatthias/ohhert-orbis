import { NextResponse } from 'next/server';

// Standardized error response format
export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
  path?: string;
}

// Error codes for different types of errors
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  DATABASE_ERROR = 'DATABASE_ERROR',
  BROWSER_ERROR = 'BROWSER_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

// Custom error class for API errors
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: string;

  constructor(
    message: string,
    code: ApiErrorCode,
    statusCode: number,
    details?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Predefined error creators
export const createValidationError = (message: string, details?: string) =>
  new ApiError(message, ApiErrorCode.VALIDATION_ERROR, 400, details);

export const createNotFoundError = (message: string, details?: string) =>
  new ApiError(message, ApiErrorCode.NOT_FOUND, 404, details);

export const createInternalServerError = (message: string, details?: string) =>
  new ApiError(message, ApiErrorCode.INTERNAL_SERVER_ERROR, 500, details);

export const createDatabaseError = (message: string, details?: string) =>
  new ApiError(message, ApiErrorCode.DATABASE_ERROR, 500, details);

export const createBrowserError = (message: string, details?: string) =>
  new ApiError(message, ApiErrorCode.BROWSER_ERROR, 500, details);

export const createFileSystemError = (message: string, details?: string) =>
  new ApiError(message, ApiErrorCode.FILE_SYSTEM_ERROR, 500, details);

// Error response formatter
export function formatErrorResponse(
  error: unknown,
  path?: string
): ApiErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    return {
      error: error.message,
      details: error.details,
      code: error.code,
      timestamp,
      path,
    };
  }

  if (error instanceof Error) {
    return {
      error: 'Internal server error',
      details: error.message,
      code: ApiErrorCode.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
    };
  }

  return {
    error: 'Unknown error occurred',
    code: ApiErrorCode.INTERNAL_SERVER_ERROR,
    timestamp,
    path,
  };
}

// Error response creator
export function createErrorResponse(
  error: unknown,
  path?: string
): NextResponse<ApiErrorResponse> {
  const errorResponse = formatErrorResponse(error, path);
  
  let statusCode = 500;
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
  }

  return NextResponse.json(errorResponse, { status: statusCode });
}