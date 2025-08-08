import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withApiMiddleware, parseJsonBody } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { createDatabaseError, createValidationError } from '@/lib/api-error';
import { UrlHealthChecker } from '@/lib/url-health-checker';

export const GET = withApiMiddleware(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const checkAll = searchParams.get('checkAll') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const onlyUnhealthy = searchParams.get('onlyUnhealthy') === 'true';

    logger.info('URL health check request', {
      requestId: context.requestId,
      checkAll,
      limit,
      onlyUnhealthy
    });

    const db = getDb();
    
    if (onlyUnhealthy) {
      // Return only unhealthy URLs
      const unhealthyUrls = db.getUnhealthyUrls();
      return NextResponse.json({
        success: true,
        urls: unhealthyUrls,
        totalCount: unhealthyUrls.length
      });
    }

    if (checkAll) {
      // Perform health checks on URLs that haven't been checked recently
      const urlsToCheck = db.getUrlsForHealthCheck(limit);
      
      if (urlsToCheck.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No URLs need health checking',
          results: []
        });
      }

      logger.info('Performing health checks', {
        requestId: context.requestId,
        urlCount: urlsToCheck.length
      });

      // Perform health checks
      const healthResults = await UrlHealthChecker.checkMultipleUrls(
        urlsToCheck.map(u => u.url),
        { maxConcurrent: 3, timeout: 5000 }
      );

      // Update database with results
      const updateResults = [];
      for (let i = 0; i < urlsToCheck.length; i++) {
        const url = urlsToCheck[i];
        const healthResult = healthResults[i];
        
        if (url.id) {
          const updated = db.updateUrlHealth(url.id, {
            isHealthy: healthResult.isHealthy,
            statusCode: healthResult.statusCode,
            responseTime: healthResult.responseTime,
            healthError: healthResult.error,
            redirectUrl: healthResult.redirectUrl
          });

          updateResults.push({
            urlId: url.id,
            url: url.url,
            updated,
            ...healthResult
          });
        }
      }

      logger.info('Health checks completed', {
        requestId: context.requestId,
        totalChecked: updateResults.length,
        healthy: updateResults.filter(r => r.isHealthy).length,
        unhealthy: updateResults.filter(r => !r.isHealthy).length
      });

      return NextResponse.json({
        success: true,
        results: updateResults,
        summary: {
          totalChecked: updateResults.length,
          healthy: updateResults.filter(r => r.isHealthy).length,
          unhealthy: updateResults.filter(r => !r.isHealthy).length
        }
      });
    } else {
      // Just return existing health data
      const urls = db.getUrlsForHealthCheck(limit);
      return NextResponse.json({
        success: true,
        urls,
        totalCount: urls.length
      });
    }
  } catch (error) {
    logger.error('URL health check failed', { requestId: context.requestId }, error as Error);
    throw createDatabaseError('Failed to check URL health', error instanceof Error ? error.message : undefined);
  }
});

export const POST = withApiMiddleware(async (request, context) => {
  const body = await parseJsonBody(request);
  
  if (!body.urls || !Array.isArray(body.urls)) {
    throw createValidationError('urls must be an array');
  }

  const { urls, options = {} } = body as {
    urls: string[];
    options?: { timeout?: number; followRedirects?: boolean };
  };

  if (urls.length === 0) {
    throw createValidationError('urls array cannot be empty');
  }

  if (urls.length > 50) {
    throw createValidationError('Maximum 50 URLs can be checked at once');
  }

  logger.info('Manual URL health check request', {
    requestId: context.requestId,
    urlCount: urls.length
  });

  try {
    // Validate all URLs first
    const validationResults = urls.map(url => ({
      url,
      ...UrlHealthChecker.validateUrl(url)
    }));

    const invalidUrls = validationResults.filter(r => !r.isValid);
    if (invalidUrls.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Some URLs are invalid',
        invalidUrls: invalidUrls.map(u => ({ url: u.url, error: u.error }))
      }, { status: 400 });
    }

    // Perform health checks
    const healthResults = await UrlHealthChecker.checkMultipleUrls(urls, {
      ...options,
      maxConcurrent: 5
    });

    logger.info('Manual health checks completed', {
      requestId: context.requestId,
      totalChecked: healthResults.length,
      healthy: healthResults.filter(r => r.isHealthy).length,
      unhealthy: healthResults.filter(r => !r.isHealthy).length
    });

    return NextResponse.json({
      success: true,
      results: healthResults,
      summary: {
        totalChecked: healthResults.length,
        healthy: healthResults.filter(r => r.isHealthy).length,
        unhealthy: healthResults.filter(r => !r.isHealthy).length,
        averageResponseTime: healthResults
          .filter(r => r.responseTime)
          .reduce((sum, r) => sum + (r.responseTime || 0), 0) / 
          healthResults.filter(r => r.responseTime).length
      }
    });
  } catch (error) {
    logger.error('Manual URL health check failed', { requestId: context.requestId }, error as Error);
    throw createDatabaseError('Failed to check URL health', error instanceof Error ? error.message : undefined);
  }
});