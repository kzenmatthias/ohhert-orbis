import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  // Ensure test directories exist
  const testDirs = [
    'test-results',
    'playwright-report',
    'data',
    'screenshots'
  ];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Set up test database
  const testDbPath = path.join(process.cwd(), 'data', 'test-screenshots.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Set test environment variables
  // process.env.NODE_ENV = 'test'; // This is read-only in production builds
  process.env.DATABASE_PATH = testDbPath;
  process.env.SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

  // Create a browser instance for setup tasks if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Perform any global setup tasks here
  // For example, seed test data, authenticate, etc.

  await page.close();
  await context.close();
  await browser.close();

  console.log('✅ Global setup completed');
}

export default globalSetup;