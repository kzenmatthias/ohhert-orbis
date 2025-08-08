import { test, expect } from '@playwright/test';

test.describe('E2E Testing Infrastructure', () => {
  test('should be able to navigate to a basic page', async ({ page }) => {
    // Navigate to a simple page to test basic functionality
    await page.goto('data:text/html,<html><body><h1>Test Page</h1><p>E2E infrastructure is working!</p></body></html>');
    
    // Verify the page loaded correctly
    await expect(page.locator('h1')).toContainText('Test Page');
    await expect(page.locator('p')).toContainText('E2E infrastructure is working!');
  });

  test('should be able to take screenshots', async ({ page }) => {
    // Navigate to a test page
    await page.goto('data:text/html,<html><body style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4); height: 100vh; display: flex; align-items: center; justify-content: center;"><h1 style="color: white; font-family: Arial;">Screenshot Test</h1></body></html>');
    
    // Take a screenshot to verify screenshot functionality
    const screenshot = await page.screenshot();
    expect(screenshot).toBeDefined();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('should support different viewport sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('data:text/html,<html><body><div id="viewport-test">Mobile View</div></body></html>');
    
    const mobileElement = page.locator('#viewport-test');
    await expect(mobileElement).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(mobileElement).toBeVisible();
  });

  test('should handle basic interactions', async ({ page }) => {
    // Create a simple interactive page
    await page.goto('data:text/html,<html><body><button id="test-button">Click Me</button><div id="result" style="display:none;">Button Clicked!</div><script>document.getElementById("test-button").onclick = function() { document.getElementById("result").style.display = "block"; }</script></body></html>');
    
    // Test button interaction
    await page.click('#test-button');
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#result')).toContainText('Button Clicked!');
  });

  test('should support form interactions', async ({ page }) => {
    // Create a simple form
    await page.goto('data:text/html,<html><body><form><input id="name-input" type="text" placeholder="Enter name"><input id="email-input" type="email" placeholder="Enter email"><button type="submit" id="submit-btn">Submit</button></form></body></html>');
    
    // Test form filling
    await page.fill('#name-input', 'Test User');
    await page.fill('#email-input', 'test@example.com');
    
    // Verify values were entered
    await expect(page.locator('#name-input')).toHaveValue('Test User');
    await expect(page.locator('#email-input')).toHaveValue('test@example.com');
  });
});