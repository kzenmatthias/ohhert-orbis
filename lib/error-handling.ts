// Frontend error handling utilities

export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
  path?: string;
}

export class FrontendError extends Error {
  public readonly code?: string;
  public readonly details?: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code?: string,
    details?: string,
    statusCode?: number
  ) {
    super(message);
    this.name = 'FrontendError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

// Parse API error responses
export function parseApiError(response: Response, data?: unknown): FrontendError {
  if (data && typeof data === 'object' && 'error' in data) {
    const apiError = data as ApiErrorResponse;
    return new FrontendError(
      apiError.error,
      apiError.code,
      apiError.details,
      response.status
    );
  }

  // Fallback for non-API error responses
  return new FrontendError(
    `HTTP ${response.status}: ${response.statusText}`,
    'HTTP_ERROR',
    undefined,
    response.status
  );
}

// Handle fetch errors with proper error parsing
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      // Response is not JSON
      errorData = null;
    }
    
    throw parseApiError(response, errorData);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new FrontendError(
      'Invalid JSON response from server',
      'INVALID_JSON',
      error instanceof Error ? error.message : undefined,
      response.status
    );
  }
}

// Wrapper for fetch with error handling
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    return await handleApiResponse<T>(response);
  } catch (error) {
    if (error instanceof FrontendError) {
      throw error;
    }

    // Network or other fetch errors
    throw new FrontendError(
      'Network error occurred',
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Unknown network error'
    );
  }
}

// Form validation error handling
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrorState {
  hasErrors: boolean;
  errors: ValidationError[];
  generalError?: string;
}

export function createFormErrorState(): FormErrorState {
  return {
    hasErrors: false,
    errors: [],
  };
}

export function addFormError(
  state: FormErrorState,
  field: string,
  message: string
): FormErrorState {
  const existingErrorIndex = state.errors.findIndex(e => e.field === field);
  
  if (existingErrorIndex >= 0) {
    // Update existing error
    const newErrors = [...state.errors];
    newErrors[existingErrorIndex] = { field, message };
    return {
      ...state,
      hasErrors: true,
      errors: newErrors,
    };
  } else {
    // Add new error
    return {
      ...state,
      hasErrors: true,
      errors: [...state.errors, { field, message }],
    };
  }
}

export function removeFormError(
  state: FormErrorState,
  field: string
): FormErrorState {
  const newErrors = state.errors.filter(e => e.field !== field);
  return {
    ...state,
    hasErrors: newErrors.length > 0 || !!state.generalError,
    errors: newErrors,
  };
}

export function setGeneralError(
  state: FormErrorState,
  error?: string
): FormErrorState {
  return {
    ...state,
    hasErrors: state.errors.length > 0 || !!error,
    generalError: error,
  };
}

export function clearFormErrors(): FormErrorState {
  return createFormErrorState();
}

export function getFieldError(
  state: FormErrorState,
  field: string
): string | undefined {
  const error = state.errors.find(e => e.field === field);
  return error?.message;
}

// User-friendly error messages
export function getUserFriendlyErrorMessage(error: FrontendError): string {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return error.details || 'Please check your input and try again.';
    case 'NOT_FOUND':
      return 'The requested item was not found.';
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection.';
    case 'DATABASE_ERROR':
      return 'A database error occurred. Please try again later.';
    case 'BROWSER_ERROR':
      return 'An error occurred during screenshot capture. Please try again.';
    case 'FILE_SYSTEM_ERROR':
      return 'A file system error occurred. Please check permissions and try again.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

// Toast notification helpers
export interface ToastNotification {
  title?: string;
  description: string;
  variant: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
}

export function createErrorToast(error: FrontendError): ToastNotification {
  return {
    title: 'Error',
    description: getUserFriendlyErrorMessage(error),
    variant: 'destructive',
    duration: 6000,
  };
}

export function createSuccessToast(message: string): ToastNotification {
  return {
    title: 'Success',
    description: message,
    variant: 'success',
    duration: 4000,
  };
}

export function createWarningToast(message: string): ToastNotification {
  return {
    title: 'Warning',
    description: message,
    variant: 'warning',
    duration: 5000,
  };
}

export function createInfoToast(message: string): ToastNotification {
  return {
    description: message,
    variant: 'default',
    duration: 4000,
  };
}