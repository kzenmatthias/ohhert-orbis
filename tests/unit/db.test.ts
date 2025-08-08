import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestDatabase } from '../utils/test-db';
import { ScreenshotTarget } from '@/lib/db';

describe('Database Operations', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = new TestDatabase();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Target Management', () => {
    it('should create a target successfully', () => {
      const target = testDb.createTestTarget({
        name: 'Test Target',
        requiresLogin: false
      });

      expect(target.id).toBeDefined();
      expect(target.name).toBe('Test Target');
      expect(target.requiresLogin).toBe(false);
      expect(target.createdAt).toBeDefined();
      expect(target.updatedAt).toBeDefined();
    });

    it('should create a target with login configuration', () => {
      const target = testDb.createTestTarget({
        name: 'Login Target',
        requiresLogin: true,
        loginUrl: 'https://example.com/login',
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        usernameEnvKey: 'TEST_USERNAME',
        passwordEnvKey: 'TEST_PASSWORD'
      });

      expect(target.requiresLogin).toBe(true);
      expect(target.loginUrl).toBe('https://example.com/login');
      expect(target.usernameSelector).toBe('#username');
      expect(target.passwordSelector).toBe('#password');
      expect(target.submitSelector).toBe('#submit');
      expect(target.usernameEnvKey).toBe('TEST_USERNAME');
      expect(target.passwordEnvKey).toBe('TEST_PASSWORD');
    });

    it('should enforce unique target names', () => {
      const targetName = 'Unique Target';
      
      testDb.createTestTarget({ name: targetName });
      
      expect(() => {
        testDb.createTestTarget({ name: targetName });
      }).toThrow();
    });
  });

  describe('URL Management', () => {
    it('should create URLs for a target', () => {
      const target = testDb.createTestTarget({ name: 'Target with URLs' });
      
      const url = testDb.createTestUrl(target.id!, {
        name: 'Homepage',
        url: 'https://example.com'
      });

      expect(url.id).toBeDefined();
      expect(url.targetId).toBe(target.id);
      expect(url.name).toBe('Homepage');
      expect(url.url).toBe('https://example.com');
      expect(url.createdAt).toBeDefined();
    });

    it('should retrieve targets with their URLs', () => {
      const target = testDb.createTestTarget({ name: 'Target with Multiple URLs' });
      
      testDb.createTestUrl(target.id!, {
        name: 'Page 1',
        url: 'https://example.com/page1'
      });
      
      testDb.createTestUrl(target.id!, {
        name: 'Page 2',
        url: 'https://example.com/page2'
      });

      const targetsWithUrls = testDb.getAllTargetsWithUrls();
      const targetWithUrls = targetsWithUrls.find(t => t.id === target.id);

      expect(targetWithUrls).toBeDefined();
      expect(targetWithUrls!.urls).toHaveLength(2);
      expect(targetWithUrls!.urls[0].name).toBe('Page 1');
      expect(targetWithUrls!.urls[1].name).toBe('Page 2');
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      // Create some test data
      const target = testDb.createTestTarget({ name: 'Test Target' });
      testDb.createTestUrl(target.id!, { name: 'Test URL', url: 'https://example.com' });

      // Verify data exists
      let targets = testDb.getAllTargetsWithUrls();
      expect(targets).toHaveLength(1);
      expect(targets[0].urls).toHaveLength(1);

      // Clear all data
      testDb.clearAllData();

      // Verify data is cleared
      targets = testDb.getAllTargetsWithUrls();
      expect(targets).toHaveLength(0);
    });

    it('should seed test data', () => {
      const { target1, target2 } = testDb.seedTestData();

      expect(target1.name).toBe('Google Homepage');
      expect(target1.requiresLogin).toBe(false);
      
      expect(target2.name).toBe('Admin Panel');
      expect(target2.requiresLogin).toBe(true);

      const targets = testDb.getAllTargetsWithUrls();
      expect(targets).toHaveLength(2);
      
      const googleTarget = targets.find(t => t.name === 'Google Homepage');
      const adminTarget = targets.find(t => t.name === 'Admin Panel');
      
      expect(googleTarget!.urls).toHaveLength(1);
      expect(adminTarget!.urls).toHaveLength(2);
    });
  });
});