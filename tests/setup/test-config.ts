/**
 * Test configuration and utilities for different test environments
 */

export const TEST_CONFIG = {
  // Database configuration
  database: {
    testPath: ':memory:',
    timeout: 5000,
  },
  
  // API testing configuration
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 10000,
    retries: 2,
  },
  
  // E2E testing configuration
  e2e: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
    retries: 2,
    headless: true,
  },
  
  // Screenshot testing configuration
  screenshots: {
    testDir: 'screenshots/test',
    formats: ['png'],
    quality: 80,
  },
  
  // Environment variables for testing
  env: {
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    SCREENSHOTS_DIR: 'screenshots/test',
    // Test credentials
    TEST_USERNAME: 'testuser',
    TEST_PASSWORD: 'testpass123',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'adminpass123',
  }
};

/**
 * Common test data for use across different test suites
 */
export const TEST_DATA = {
  targets: {
    simple: {
      name: 'Simple Target',
      requiresLogin: false,
      urls: [
        { name: 'Homepage', url: 'https://example.com' }
      ]
    },
    
    withLogin: {
      name: 'Login Required Target',
      requiresLogin: true,
      loginUrl: 'https://example.com/login',
      usernameSelector: '#username',
      passwordSelector: '#password',
      submitSelector: '#login-button',
      usernameEnvKey: 'TEST_USERNAME',
      passwordEnvKey: 'TEST_PASSWORD',
      urls: [
        { name: 'Dashboard', url: 'https://example.com/dashboard' },
        { name: 'Profile', url: 'https://example.com/profile' }
      ]
    },
    
    multiUrl: {
      name: 'Multi-URL Target',
      requiresLogin: false,
      urls: [
        { name: 'Homepage', url: 'https://example.com' },
        { name: 'About', url: 'https://example.com/about' },
        { name: 'Contact', url: 'https://example.com/contact' },
        { name: 'Services', url: 'https://example.com/services' }
      ]
    }
  },
  
  urls: {
    valid: [
      'https://example.com',
      'https://google.com',
      'https://github.com',
      'http://localhost:3000'
    ],
    
    invalid: [
      'not-a-url',
      'ftp://example.com',
      'javascript:alert("xss")',
      ''
    ]
  },
  
  selectors: {
    common: {
      username: ['#username', '#email', '[name="username"]', '[name="email"]'],
      password: ['#password', '[name="password"]', '[type="password"]'],
      submit: ['#submit', '[type="submit"]', 'button[type="submit"]', '.login-button']
    }
  }
};

/**
 * Test utilities for common operations
 */
export const TEST_UTILS = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Generate a unique test name with timestamp
   */
  generateTestName: (prefix: string = 'test') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  /**
   * Create a test URL with unique parameters
   */
  generateTestUrl: (base: string = 'https://example.com') => `${base}?test=${Date.now()}`,
  
  /**
   * Validate URL format
   */
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Clean up test data patterns
   */
  cleanupPatterns: {
    testTargets: /^test-target-\d+/,
    testUrls: /^test-url-\d+/,
    testFiles: /^test-.*\.(png|jpg|jpeg)$/
  }
};