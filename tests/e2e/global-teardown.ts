import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  // Clean up test database
  const testDbPath = path.join(process.cwd(), 'data', 'test-screenshots.db');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      console.log('🗑️  Test database cleaned up');
    } catch (error) {
      console.warn('⚠️  Could not clean up test database:', error);
    }
  }

  // Clean up test screenshots
  const testScreenshotsDir = path.join(process.cwd(), 'screenshots', 'test');
  if (fs.existsSync(testScreenshotsDir)) {
    try {
      fs.rmSync(testScreenshotsDir, { recursive: true, force: true });
      console.log('🗑️  Test screenshots cleaned up');
    } catch (error) {
      console.warn('⚠️  Could not clean up test screenshots:', error);
    }
  }

  // Reset environment variables
  delete process.env.DATABASE_PATH;
  delete process.env.SCREENSHOTS_DIR;

  console.log('✅ Global teardown completed');
}

export default globalTeardown;