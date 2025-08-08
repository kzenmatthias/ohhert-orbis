import { NextRequest } from 'next/server';

/**
 * Helper function to create a NextRequest for App Router API testing
 */
export function createNextRequest(method: string, url: string, body?: any): NextRequest {
  const requestInit: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(url, requestInit);
}

/**
 * Helper function to parse Response body as JSON
 */
export async function parseResponseBody(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Helper function to create test environment variables
 */
export function setupTestEnv(envVars: Record<string, string> = {}) {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
      ...envVars
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Helper function to mock file system operations
 */
export function mockFileSystem() {
  const fs = require('fs');
  const path = require('path');

  const mockFiles: Record<string, string> = {};
  const mockDirs: Set<string> = new Set();

  jest.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
    return mockFiles.hasOwnProperty(filePath) || mockDirs.has(filePath);
  });

  jest.spyOn(fs, 'readFileSync').mockImplementation((filePath: string) => {
    if (mockFiles[filePath]) {
      return mockFiles[filePath];
    }
    throw new Error(`File not found: ${filePath}`);
  });

  jest.spyOn(fs, 'writeFileSync').mockImplementation((filePath: string, data: string) => {
    mockFiles[filePath] = data;
  });

  jest.spyOn(fs, 'mkdirSync').mockImplementation((dirPath: string) => {
    mockDirs.add(dirPath);
  });

  jest.spyOn(fs, 'readdirSync').mockImplementation((dirPath: string) => {
    const files = Object.keys(mockFiles)
      .filter(file => path.dirname(file) === dirPath)
      .map(file => path.basename(file));
    return files;
  });

  return {
    addMockFile: (filePath: string, content: string) => {
      mockFiles[filePath] = content;
    },
    addMockDir: (dirPath: string) => {
      mockDirs.add(dirPath);
    },
    getMockFiles: () => ({ ...mockFiles }),
    getMockDirs: () => new Set(mockDirs)
  };
}

/**
 * Helper function to mock Playwright browser operations
 */
export function mockPlaywright() {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
    close: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue({}),
    waitForLoadState: jest.fn().mockResolvedValue(undefined),
  };

  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlaywright = {
    chromium: {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    },
  };

  jest.mock('playwright', () => mockPlaywright);

  return {
    mockPage,
    mockBrowser,
    mockPlaywright
  };
}