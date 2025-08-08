import { NextResponse } from 'next/server';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createValidationError } from '@/lib/api-error';
import { UrlHealthChecker } from '@/lib/url-health-checker';

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  const { baseUrl, parameters, action } = body as {
    baseUrl: string;
    parameters?: Record<string, string[]>;
    action: 'extract' | 'generate';
  };

  if (!baseUrl) {
    throw createValidationError('baseUrl is required');
  }

  if (!action || !['extract', 'generate'].includes(action)) {
    throw createValidationError('action must be either "extract" or "generate"');
  }

  logger.info('URL template request', { 
    requestId: context.requestId,
    action,
    baseUrl,
    parametersCount: parameters ? Object.keys(parameters).length : 0
  });

  try {
    if (action === 'extract') {
      // Extract template information from URL
      const template = UrlHealthChecker.extractUrlTemplate(baseUrl);
      
      logger.info('URL template extraction completed', {
        requestId: context.requestId,
        baseUrl,
        parametersCount: template.parameters.length
      });

      return NextResponse.json({
        success: true,
        baseUrl,
        template: template.template,
        parameters: template.parameters,
        action: 'extract'
      });
    } else {
      // Generate URL variations
      if (!parameters || typeof parameters !== 'object') {
        throw createValidationError('parameters object is required for generate action');
      }

      const paramKeys = Object.keys(parameters);
      if (paramKeys.length === 0) {
        throw createValidationError('At least one parameter must be provided');
      }

      // Validate parameter values
      const invalidParams = paramKeys.filter(key => 
        !Array.isArray(parameters[key]) || parameters[key].length === 0
      );
      
      if (invalidParams.length > 0) {
        throw createValidationError(
          `Parameters must be non-empty arrays: ${invalidParams.join(', ')}`
        );
      }

      // Calculate total combinations
      const totalCombinations = paramKeys.reduce(
        (total, key) => total * parameters[key].length, 
        1
      );

      if (totalCombinations > 100) {
        throw createValidationError(
          `Too many combinations (${totalCombinations}). Maximum allowed is 100.`
        );
      }

      const variations = UrlHealthChecker.generateUrlVariations(baseUrl, parameters);

      logger.info('URL variations generated', {
        requestId: context.requestId,
        baseUrl,
        parametersCount: paramKeys.length,
        variationsCount: variations.length
      });

      return NextResponse.json({
        success: true,
        baseUrl,
        parameters,
        variations,
        totalVariations: variations.length,
        action: 'generate'
      });
    }
  } catch (error) {
    logger.error('URL template operation failed', { 
      requestId: context.requestId,
      action,
      baseUrl
    }, error as Error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action
    }, { status: 500 });
  }
});

export const GET = withApiMiddleware(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl');

  if (!baseUrl) {
    throw createValidationError('baseUrl parameter is required');
  }

  logger.info('URL template GET request', { requestId: context.requestId, baseUrl });

  try {
    // Extract template and validate URL
    const validation = UrlHealthChecker.validateUrl(baseUrl);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error,
        baseUrl
      }, { status: 400 });
    }

    const template = UrlHealthChecker.extractUrlTemplate(validation.normalizedUrl!);

    logger.info('URL template GET completed', {
      requestId: context.requestId,
      baseUrl,
      parametersCount: template.parameters.length
    });

    return NextResponse.json({
      success: true,
      baseUrl: validation.normalizedUrl,
      originalUrl: baseUrl,
      template: template.template,
      parameters: template.parameters,
      isValid: validation.isValid
    });
  } catch (error) {
    logger.error('URL template GET failed', { 
      requestId: context.requestId,
      baseUrl
    }, error as Error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});