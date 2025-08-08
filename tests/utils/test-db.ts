import Database from 'better-sqlite3';
import { ScreenshotTarget, ScreenshotUrl } from '@/lib/db';

export class TestDatabase {
  private db: Database.Database;

  constructor() {
    // Use in-memory database for testing
    this.db = new Database(':memory:');
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create targets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        requiresLogin BOOLEAN NOT NULL DEFAULT 0,
        loginUrl TEXT,
        usernameSelector TEXT,
        passwordSelector TEXT,
        submitSelector TEXT,
        usernameEnvKey TEXT,
        passwordEnvKey TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create target_urls table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS target_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        targetId INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (targetId) REFERENCES targets (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_target_urls_target_id ON target_urls(targetId);
      CREATE INDEX IF NOT EXISTS idx_targets_name ON targets(name);
    `);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  // Helper methods for test data setup
  createTestTarget(target: Partial<ScreenshotTarget> = {}): ScreenshotTarget {
    const defaultTarget: ScreenshotTarget = {
      name: `test-target-${Date.now()}`,
      requiresLogin: false,
      ...target
    };

    const stmt = this.db.prepare(`
      INSERT INTO targets (name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      defaultTarget.name,
      defaultTarget.requiresLogin ? 1 : 0,
      defaultTarget.loginUrl || null,
      defaultTarget.usernameSelector || null,
      defaultTarget.passwordSelector || null,
      defaultTarget.submitSelector || null,
      defaultTarget.usernameEnvKey || null,
      defaultTarget.passwordEnvKey || null
    );

    return {
      ...defaultTarget,
      id: result.lastInsertRowid as number,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  createTestUrl(targetId: number, url: Partial<ScreenshotUrl> = {}): ScreenshotUrl {
    const defaultUrl: ScreenshotUrl = {
      targetId,
      name: `test-url-${Date.now()}`,
      url: `https://example.com/${Date.now()}`,
      ...url
    };

    const stmt = this.db.prepare(`
      INSERT INTO target_urls (targetId, name, url)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      defaultUrl.targetId,
      defaultUrl.name,
      defaultUrl.url
    );

    return {
      ...defaultUrl,
      id: result.lastInsertRowid as number,
      createdAt: new Date().toISOString()
    };
  }

  // Helper method to get all targets with URLs
  getAllTargetsWithUrls(): (ScreenshotTarget & { urls: ScreenshotUrl[] })[] {
    const targets = this.db.prepare('SELECT * FROM targets ORDER BY name').all() as ScreenshotTarget[];
    
    return targets.map(target => {
      const urls = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name')
        .all(target.id) as ScreenshotUrl[];
      
      return {
        ...target,
        requiresLogin: Boolean(target.requiresLogin),
        urls
      };
    });
  }

  // Helper method to clear all data
  clearAllData() {
    this.db.exec('DELETE FROM target_urls');
    this.db.exec('DELETE FROM targets');
    this.db.exec("DELETE FROM sqlite_sequence WHERE name IN ('targets', 'target_urls')");
  }

  // Helper method to close database connection
  close() {
    this.db.close();
  }

  // Helper method to seed test data
  seedTestData() {
    const target1 = this.createTestTarget({
      name: 'Google Homepage',
      requiresLogin: false
    });

    const target2 = this.createTestTarget({
      name: 'Admin Panel',
      requiresLogin: true,
      loginUrl: 'https://admin.example.com/login',
      usernameSelector: '#username',
      passwordSelector: '#password',
      submitSelector: '#login-button',
      usernameEnvKey: 'ADMIN_USERNAME',
      passwordEnvKey: 'ADMIN_PASSWORD'
    });

    // Add URLs for targets
    this.createTestUrl(target1.id!, {
      name: 'Homepage',
      url: 'https://google.com'
    });

    this.createTestUrl(target2.id!, {
      name: 'Dashboard',
      url: 'https://admin.example.com/dashboard'
    });

    this.createTestUrl(target2.id!, {
      name: 'Users',
      url: 'https://admin.example.com/users'
    });

    return { target1, target2 };
  }
}

// Global test database instance factory
export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}

// Helper function to mock database in tests
export function mockDatabase() {
  const testDb = createTestDatabase();
  
  // Mock the database module
  jest.mock('@/lib/db', () => ({
    getDatabase: () => testDb.getDatabase(),
    getAllTargets: jest.fn(),
    createTarget: jest.fn(),
    updateTarget: jest.fn(),
    deleteTarget: jest.fn(),
  }));

  return testDb;
}