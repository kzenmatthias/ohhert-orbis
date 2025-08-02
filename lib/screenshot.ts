import { chromium, Browser, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { ScreenshotTarget, ScreenshotUrl } from './db';

export interface ScreenshotResult {
  success: boolean;
  filename?: string;
  filepath?: string;
  error?: string;
  urlName?: string;
}

export class ScreenshotService {
  private browser: Browser | null = null;

  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.HEADLESS_MODE?.toLowerCase() !== 'false',
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async ensureScreenshotDir(): Promise<string> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const screenshotDir = path.join(process.cwd(), 'screenshots', today);
    
    try {
      await fs.access(screenshotDir);
    } catch {
      await fs.mkdir(screenshotDir, { recursive: true });
    }
    
    return screenshotDir;
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  private async performLogin(page: Page, target: ScreenshotTarget): Promise<void> {
    if (!target.loginUrl || !target.usernameSelector || !target.passwordSelector || !target.submitSelector) {
      throw new Error('Missing login configuration');
    }

    if (!target.usernameEnvKey || !target.passwordEnvKey) {
      throw new Error('Missing environment variable keys for credentials');
    }

    const username = process.env[target.usernameEnvKey];
    const password = process.env[target.passwordEnvKey];

    if (!username || !password) {
      throw new Error(`Missing credentials in environment variables: ${target.usernameEnvKey}, ${target.passwordEnvKey}`);
    }

    console.log(`Navigating to login page: ${target.loginUrl}`);
    await page.goto(target.loginUrl, { waitUntil: 'networkidle' });

    console.log('Filling login form...');
    await page.fill(target.usernameSelector, username);
    await page.fill(target.passwordSelector, password);
    
    console.log('Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click(target.submitSelector),
    ]);

    console.log('Login completed');
  }

  async captureScreenshotForUrl(target: ScreenshotTarget, url: ScreenshotUrl, page: Page): Promise<ScreenshotResult> {
    try {
      console.log(`Navigating to URL: ${url.name} (${url.url})`);
      await page.goto(url.url, { waitUntil: 'networkidle' });

      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(2000);

      const screenshotDir = await this.ensureScreenshotDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.sanitizeFilename(target.name)}-${this.sanitizeFilename(url.name)}-${timestamp}.png`;
      const filepath = path.join(screenshotDir, filename);

      console.log(`Taking screenshot: ${filename}`);
      await page.screenshot({
        path: filepath,
        fullPage: true,
      });

      console.log(`Screenshot saved: ${filepath}`);
      
      return {
        success: true,
        filename,
        filepath,
        urlName: url.name,
      };
    } catch (error) {
      console.error(`Screenshot failed for ${target.name} - ${url.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        urlName: url.name,
      };
    }
  }

  async captureScreenshot(target: ScreenshotTarget): Promise<ScreenshotResult[]> {
    let page: Page | null = null;
    const results: ScreenshotResult[] = [];
    
    try {
      console.log(`Starting screenshot capture for: ${target.name}`);
      
      const browser = await this.initBrowser();
      page = await browser.newPage();
      
      // Set viewport size
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Perform login if required
      if (target.requiresLogin) {
        await this.performLogin(page, target);
      }

      // If no URLs are defined, skip this target
      if (!target.urls || target.urls.length === 0) {
        console.log(`No URLs defined for target: ${target.name}`);
        return [{
          success: false,
          error: 'No URLs defined for this target',
        }];
      }

      // Capture screenshots for all URLs
      for (const url of target.urls) {
        const result = await this.captureScreenshotForUrl(target, url, page);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error(`Screenshot failed for ${target.name}:`, error);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }];
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async captureAllScreenshots(targets: ScreenshotTarget[]): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = [];
    
    try {
      await this.initBrowser();
      
      for (const target of targets) {
        const targetResults = await this.captureScreenshot(target);
        results.push(...targetResults);
      }
    } finally {
      await this.closeBrowser();
    }
    
    return results;
  }
}

export const screenshotService = new ScreenshotService();