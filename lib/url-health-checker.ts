import { logger } from './logger';

export interface UrlHealthResult {
  url: string;
  isHealthy: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  redirectUrl?: string;
  lastChecked: string;
}

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
}

export class UrlHealthChecker {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_REDIRECTS = 5;

  /**
   * Validate a URL format
   */
  static validateUrl(url: string): UrlValidationResult {
    try {
      if (!url || typeof url !== 'string') {
        return { isValid: false, error: 'URL must be a non-empty string' };
      }

      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        return { isValid: false, error: 'URL cannot be empty' };
      }

      // Add protocol if missing
      let normalizedUrl = trimmedUrl;
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Validate URL format
      const urlObject = new URL(normalizedUrl);
      
      // Check for valid protocols
      if (!['http:', 'https:'].includes(urlObject.protocol)) {
        return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
      }

      // Check for valid hostname
      if (!urlObject.hostname) {
        return { isValid: false, error: 'URL must have a valid hostname' };
      }

      // Check for localhost/private IPs in production
      const hostname = urlObject.hostname.toLowerCase();
      if (process.env.NODE_ENV === 'production') {
        const privatePatterns = [
          /^localhost$/i,
          /^127\./,
          /^192\.168\./,
          /^10\./,
          /^172\.(1[6-9]|2\d|3[01])\./
        ];
        
        if (privatePatterns.some(pattern => pattern.test(hostname))) {
          return { isValid: false, error: 'Private/local URLs are not allowed in production' };
        }
      }

      return { isValid: true, normalizedUrl };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Invalid URL format' 
      };
    }
  }

  /**
   * Check the health of a single URL
   */
  static async checkUrlHealth(
    url: string, 
    options: { timeout?: number; followRedirects?: boolean } = {}
  ): Promise<UrlHealthResult> {
    const startTime = Date.now();
    const { timeout = this.DEFAULT_TIMEOUT, followRedirects = true } = options;

    logger.info('Checking URL health', { url });

    try {
      // Validate URL first
      const validation = this.validateUrl(url);
      if (!validation.isValid) {
        return {
          url,
          isHealthy: false,
          error: validation.error,
          lastChecked: new Date().toISOString()
        };
      }

      const normalizedUrl = validation.normalizedUrl!;
      
      // Create fetch options
      const fetchOptions: RequestInit = {
        method: 'HEAD', // Use HEAD to avoid downloading content
        headers: {
          'User-Agent': 'Orbis-Health-Checker/1.0',
        },
        signal: AbortSignal.timeout(timeout),
        redirect: followRedirects ? 'follow' : 'manual'
      };

      const response = await fetch(normalizedUrl, fetchOptions);
      const responseTime = Date.now() - startTime;

      let redirectUrl: string | undefined;
      if (response.redirected && response.url !== normalizedUrl) {
        redirectUrl = response.url;
      }

      const isHealthy = response.ok; // 200-299 status codes

      const result: UrlHealthResult = {
        url: normalizedUrl,
        isHealthy,
        statusCode: response.status,
        responseTime,
        redirectUrl,
        lastChecked: new Date().toISOString()
      };

      if (!isHealthy) {
        result.error = `HTTP ${response.status} ${response.statusText}`;
      }

      logger.info('URL health check completed', { 
        url: normalizedUrl,
        statusCode: response.status,
        responseTime,
        isHealthy
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = `Request timeout (${timeout}ms)`;
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error';
        } else {
          errorMessage = error.message;
        }
      }

      logger.warn('URL health check failed', { url, error: errorMessage });

      return {
        url,
        isHealthy: false,
        error: errorMessage,
        responseTime,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check the health of multiple URLs in parallel
   */
  static async checkMultipleUrls(
    urls: string[],
    options: { timeout?: number; followRedirects?: boolean; maxConcurrent?: number } = {}
  ): Promise<UrlHealthResult[]> {
    const { maxConcurrent = 5 } = options;
    const results: UrlHealthResult[] = [];

    logger.info('Checking multiple URL health', { count: urls.length });

    // Process URLs in batches to avoid overwhelming the system
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(url => this.checkUrlHealth(url, options));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        logger.error('Batch URL health check failed', { 
          batchIndex: Math.floor(i / maxConcurrent),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Add error results for the failed batch
        batch.forEach(url => {
          results.push({
            url,
            isHealthy: false,
            error: 'Batch processing error',
            lastChecked: new Date().toISOString()
          });
        });
      }
    }

    logger.info('Multiple URL health check completed', { 
      total: urls.length,
      healthy: results.filter(r => r.isHealthy).length,
      unhealthy: results.filter(r => !r.isHealthy).length
    });

    return results;
  }

  /**
   * Generate URL variations for testing (useful for dynamic URLs)
   */
  static generateUrlVariations(baseUrl: string, parameters: Record<string, string[]>): string[] {
    const validation = this.validateUrl(baseUrl);
    if (!validation.isValid) {
      throw new Error(`Invalid base URL: ${validation.error}`);
    }

    const normalizedUrl = validation.normalizedUrl!;
    const paramKeys = Object.keys(parameters);
    
    if (paramKeys.length === 0) {
      return [normalizedUrl];
    }

    // Generate all combinations of parameters
    const generateCombinations = (keys: string[], currentCombination: Record<string, string> = {}): Record<string, string>[] => {
      if (keys.length === 0) {
        return [currentCombination];
      }

      const [currentKey, ...remainingKeys] = keys;
      const values = parameters[currentKey];
      const combinations: Record<string, string>[] = [];

      for (const value of values) {
        const newCombination = { ...currentCombination, [currentKey]: value };
        combinations.push(...generateCombinations(remainingKeys, newCombination));
      }

      return combinations;
    };

    const combinations = generateCombinations(paramKeys);
    const variations = combinations.map(combination => {
      const url = new URL(normalizedUrl);
      
      Object.entries(combination).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      return url.toString();
    });

    return variations;
  }

  /**
   * Extract template parameters from a URL pattern
   */
  static extractUrlTemplate(url: string): { template: string; parameters: string[] } {
    const validation = this.validateUrl(url);
    if (!validation.isValid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    const normalizedUrl = validation.normalizedUrl!;
    const urlObject = new URL(normalizedUrl);
    
    // Extract query parameters as template variables
    const parameters: string[] = [];
    const template = urlObject.toString();
    
    // This is a simple implementation - could be enhanced to detect
    // patterns like /users/{id}/posts/{postId}
    urlObject.searchParams.forEach((value, key) => {
      parameters.push(key);
    });

    return { template, parameters };
  }

  /**
   * Monitor URL for changes (checks for redirects, status changes)
   */
  static async monitorUrl(
    url: string,
    previousResult?: UrlHealthResult
  ): Promise<{ result: UrlHealthResult; hasChanged: boolean; changes: string[] }> {
    const currentResult = await this.checkUrlHealth(url);
    const changes: string[] = [];
    let hasChanged = false;

    if (previousResult) {
      // Check for status code changes
      if (previousResult.statusCode !== currentResult.statusCode) {
        changes.push(`Status code changed from ${previousResult.statusCode} to ${currentResult.statusCode}`);
        hasChanged = true;
      }

      // Check for redirect changes
      if (previousResult.redirectUrl !== currentResult.redirectUrl) {
        changes.push(`Redirect URL changed from ${previousResult.redirectUrl || 'none'} to ${currentResult.redirectUrl || 'none'}`);
        hasChanged = true;
      }

      // Check for health status changes
      if (previousResult.isHealthy !== currentResult.isHealthy) {
        changes.push(`Health status changed from ${previousResult.isHealthy ? 'healthy' : 'unhealthy'} to ${currentResult.isHealthy ? 'healthy' : 'unhealthy'}`);
        hasChanged = true;
      }

      // Check for significant response time changes (>50% difference)
      if (previousResult.responseTime && currentResult.responseTime) {
        const timeDiff = Math.abs(previousResult.responseTime - currentResult.responseTime);
        const timePercentage = timeDiff / previousResult.responseTime;
        
        if (timePercentage > 0.5) {
          changes.push(`Response time changed significantly from ${previousResult.responseTime}ms to ${currentResult.responseTime}ms`);
          hasChanged = true;
        }
      }
    }

    return { result: currentResult, hasChanged, changes };
  }
}