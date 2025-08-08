import { NextResponse } from 'next/server';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createValidationError } from '@/lib/api-error';
import { UrlHealthChecker } from '@/lib/url-health-checker';

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  if (!body.url && !body.urls) {
    throw createValidationError('Either url or urls must be provided');
  }

  logger.info('URL validation request', { requestId: context.requestId });

  try {
    if (body.url) {
      // Single URL validation
      const { url } = body as { url: string };
      const result = UrlHealthChecker.validateUrl(url);
      
      logger.info('Single URL validation completed', {
        requestId: context.requestId,
        url,
        isValid: result.isValid
      });

      return NextResponse.json({
        success: true,
        url,
        isValid: result.isValid,
        error: result.error,
        normalizedUrl: result.normalizedUrl
      });
    } else {
      // Multiple URLs validation
      const { urls } = body as { urls: string[] };
      
      if (!Array.isArray(urls)) {
        throw createValidationError('urls must be an array');
      }

      if (urls.length > 100) {
        throw createValidationError('Maximum 100 URLs can be validated at once');
      }

      const results = urls.map(url => ({
        url,
        ...UrlHealthChecker.validateUrl(url)
      }));

      const validCount = results.filter(r => r.isValid).length;
      const invalidCount = results.length - validCount;

      logger.info('Multiple URL validation completed', {
        requestId: context.requestId,
        totalUrls: urls.length,
        valid: validCount,
        invalid: invalidCount
      });

      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: urls.length,
          valid: validCount,
          invalid: invalidCount
        }
      });
    }
  } catch (error) {
    logger.error('URL validation failed', { requestId: context.requestId }, error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

export const GET = withApiMiddleware(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    throw createValidationError('url parameter is required');
  }

  logger.info('URL validation GET request', { requestId: context.requestId, url });

  try {
    const result = UrlHealthChecker.validateUrl(url);
    
    // Also extract template information
    let template = null;
    if (result.isValid && result.normalizedUrl) {
      try {
        template = UrlHealthChecker.extractUrlTemplate(result.normalizedUrl);
      } catch (error) {
        // Template extraction is optional
        logger.warn('Failed to extract URL template', { url }, error as Error);
      }
    }

    return NextResponse.json({
      success: true,
      url,
      isValid: result.isValid,
      error: result.error,
      normalizedUrl: result.normalizedUrl,
      template
    });
  } catch (error) {
    logger.error('URL validation GET failed', { requestId: context.requestId }, error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});