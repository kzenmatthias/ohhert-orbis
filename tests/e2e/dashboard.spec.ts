import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main dashboard', async ({ page }) => {
    await expect(page).toHaveTitle(/Orbis/);
    await expect(page.locator('h1')).toContainText('Screenshot Targets');
  });

  test('should show empty state when no targets exist', async ({ page }) => {
    // Assuming fresh database with no targets
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('text=No screenshot targets configured')).toBeVisible();
  });

  test('should open target form when Add Target button is clicked', async ({ page }) => {
    await page.click('[data-testid="add-target-button"]');
    
    await expect(page.locator('[data-testid="target-form-dialog"]')).toBeVisible();
    await expect(page.locator('text=Add New Target')).toBeVisible();
  });

  test('should create a new target successfully', async ({ page }) => {
    // Open the form
    await page.click('[data-testid="add-target-button"]');
    
    // Fill in target details
    await page.fill('[data-testid="target-name-input"]', 'Test Target');
    
    // Add a URL
    await page.fill('[data-testid="url-name-input-0"]', 'Homepage');
    await page.fill('[data-testid="url-value-input-0"]', 'https://example.com');
    
    // Submit the form
    await page.click('[data-testid="save-target-button"]');
    
    // Verify the target was created
    await expect(page.locator('[data-testid="target-card"]')).toBeVisible();
    await expect(page.locator('text=Test Target')).toBeVisible();
  });

  test('should configure login settings for a target', async ({ page }) => {
    // Open the form
    await page.click('[data-testid="add-target-button"]');
    
    // Fill in basic details
    await page.fill('[data-testid="target-name-input"]', 'Login Target');
    
    // Enable login
    await page.click('[data-testid="requires-login-toggle"]');
    
    // Fill in login configuration
    await page.fill('[data-testid="login-url-input"]', 'https://example.com/login');
    await page.fill('[data-testid="username-selector-input"]', '#username');
    await page.fill('[data-testid="password-selector-input"]', '#password');
    await page.fill('[data-testid="submit-selector-input"]', '#login-button');
    await page.fill('[data-testid="username-env-key-input"]', 'TEST_USERNAME');
    await page.fill('[data-testid="password-env-key-input"]', 'TEST_PASSWORD');
    
    // Add a URL
    await page.fill('[data-testid="url-name-input-0"]', 'Dashboard');
    await page.fill('[data-testid="url-value-input-0"]', 'https://example.com/dashboard');
    
    // Submit the form
    await page.click('[data-testid="save-target-button"]');
    
    // Verify the target was created with login configuration
    await expect(page.locator('text=Login Target')).toBeVisible();
    await expect(page.locator('[data-testid="login-indicator"]')).toBeVisible();
  });

  test('should add multiple URLs to a target', async ({ page }) => {
    // Open the form
    await page.click('[data-testid="add-target-button"]');
    
    // Fill in target name
    await page.fill('[data-testid="target-name-input"]', 'Multi-URL Target');
    
    // Add first URL
    await page.fill('[data-testid="url-name-input-0"]', 'Homepage');
    await page.fill('[data-testid="url-value-input-0"]', 'https://example.com');
    
    // Add second URL
    await page.click('[data-testid="add-url-button"]');
    await page.fill('[data-testid="url-name-input-1"]', 'About');
    await page.fill('[data-testid="url-value-input-1"]', 'https://example.com/about');
    
    // Add third URL
    await page.click('[data-testid="add-url-button"]');
    await page.fill('[data-testid="url-name-input-2"]', 'Contact');
    await page.fill('[data-testid="url-value-input-2"]', 'https://example.com/contact');
    
    // Submit the form
    await page.click('[data-testid="save-target-button"]');
    
    // Verify the target was created
    await expect(page.locator('text=Multi-URL Target')).toBeVisible();
    await expect(page.locator('text=3 URLs')).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    // Open the form
    await page.click('[data-testid="add-target-button"]');
    
    // Try to submit without required fields
    await page.click('[data-testid="save-target-button"]');
    
    // Verify validation errors
    await expect(page.locator('text=Target name is required')).toBeVisible();
    await expect(page.locator('text=At least one URL is required')).toBeVisible();
  });

  test('should edit an existing target', async ({ page }) => {
    // First create a target (assuming we have a way to seed data)
    await page.click('[data-testid="add-target-button"]');
    await page.fill('[data-testid="target-name-input"]', 'Original Target');
    await page.fill('[data-testid="url-name-input-0"]', 'Homepage');
    await page.fill('[data-testid="url-value-input-0"]', 'https://original.com');
    await page.click('[data-testid="save-target-button"]');
    
    // Edit the target
    await page.click('[data-testid="edit-target-button"]');
    
    // Verify form is pre-populated
    await expect(page.locator('[data-testid="target-name-input"]')).toHaveValue('Original Target');
    
    // Make changes
    await page.fill('[data-testid="target-name-input"]', 'Updated Target');
    await page.fill('[data-testid="url-value-input-0"]', 'https://updated.com');
    
    // Save changes
    await page.click('[data-testid="save-target-button"]');
    
    // Verify changes were saved
    await expect(page.locator('text=Updated Target')).toBeVisible();
  });

  test('should delete a target', async ({ page }) => {
    // First create a target
    await page.click('[data-testid="add-target-button"]');
    await page.fill('[data-testid="target-name-input"]', 'Target to Delete');
    await page.fill('[data-testid="url-name-input-0"]', 'Homepage');
    await page.fill('[data-testid="url-value-input-0"]', 'https://delete.com');
    await page.click('[data-testid="save-target-button"]');
    
    // Delete the target
    await page.click('[data-testid="delete-target-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Verify target was deleted
    await expect(page.locator('text=Target to Delete')).not.toBeVisible();
  });
});