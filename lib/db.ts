import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface ScreenshotUrl {
  id?: number;
  targetId: number;
  name: string;
  url: string;
  createdAt?: string;
}

export interface ScreenshotTarget {
  id?: number;
  name: string;
  requiresLogin: boolean;
  loginUrl?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  usernameEnvKey?: string;
  passwordEnvKey?: string;
  createdAt?: string;
  updatedAt?: string;
  urls?: ScreenshotUrl[];
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dataDir, 'screenshots.db');
    
    // Ensure data directory exists
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }
    
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    // Check if we need to migrate from old schema
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const hasTargets = tables.some((t) => t.name === 'targets');
    const hasTargetUrls = tables.some((t) => t.name === 'target_urls');

    if (!hasTargets && !hasTargetUrls) {
      // Fresh install - create new schema
      this.createNewSchema();
    } else if (hasTargets && !hasTargetUrls) {
      // Need to migrate existing data
      this.migrateFromOldSchema();
    }

    // Ensure target_urls table exists
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

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_targets_timestamp 
      AFTER UPDATE ON targets
      BEGIN
        UPDATE targets SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);
  }

  private createNewSchema() {
    // Create targets table without url column
    this.db.exec(`
      CREATE TABLE targets (
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
  }

  private migrateFromOldSchema() {
    // Create new targets table without url column
    this.db.exec(`
      CREATE TABLE targets_new (
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

    // Copy data from old table (excluding url column)
    this.db.exec(`
      INSERT INTO targets_new (id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, createdAt, updatedAt)
      SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, createdAt, updatedAt
      FROM targets
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

    // Move URL data to target_urls table
    this.db.exec(`
      INSERT INTO target_urls (targetId, name, url)
      SELECT id, name || ' - Main', url 
      FROM targets 
      WHERE url IS NOT NULL AND url != ''
    `);

    // Drop old table and rename new one
    this.db.exec(`DROP TABLE targets`);
    this.db.exec(`ALTER TABLE targets_new RENAME TO targets`);
  }

  getAllTargets(): ScreenshotTarget[] {
    const stmt = this.db.prepare('SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, createdAt, updatedAt FROM targets ORDER BY name');
    const targets = stmt.all() as ScreenshotTarget[];
    
    // Get URLs for each target
    const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
    return targets.map(target => ({
      ...target,
      urls: urlStmt.all(target.id) as ScreenshotUrl[]
    }));
  }

  getTarget(id: number): ScreenshotTarget | undefined {
    const stmt = this.db.prepare('SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, createdAt, updatedAt FROM targets WHERE id = ?');
    const target = stmt.get(id) as ScreenshotTarget | undefined;
    
    if (target) {
      const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
      target.urls = urlStmt.all(target.id) as ScreenshotUrl[];
    }
    
    return target;
  }

  createTarget(target: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>): ScreenshotTarget {
    const stmt = this.db.prepare(`
      INSERT INTO targets (name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      target.name,
      target.requiresLogin ? 1 : 0,
      target.loginUrl || null,
      target.usernameSelector || null,
      target.passwordSelector || null,
      target.submitSelector || null,
      target.usernameEnvKey || null,
      target.passwordEnvKey || null
    );

    const targetId = result.lastInsertRowid as number;

    // Add URLs if provided
    if (target.urls && target.urls.length > 0) {
      const urlStmt = this.db.prepare(`
        INSERT INTO target_urls (targetId, name, url)
        VALUES (?, ?, ?)
      `);

      for (const url of target.urls) {
        urlStmt.run(targetId, url.name, url.url);
      }
    }

    return this.getTarget(targetId)!;
  }

  updateTarget(id: number, target: Partial<ScreenshotTarget>): ScreenshotTarget | undefined {
    const fields = [];
    const values = [];

    if (target.name !== undefined) {
      fields.push('name = ?');
      values.push(target.name);
    }
    if (target.requiresLogin !== undefined) {
      fields.push('requiresLogin = ?');
      values.push(target.requiresLogin ? 1 : 0);
    }
    if (target.loginUrl !== undefined) {
      fields.push('loginUrl = ?');
      values.push(target.loginUrl);
    }
    if (target.usernameSelector !== undefined) {
      fields.push('usernameSelector = ?');
      values.push(target.usernameSelector);
    }
    if (target.passwordSelector !== undefined) {
      fields.push('passwordSelector = ?');
      values.push(target.passwordSelector);
    }
    if (target.submitSelector !== undefined) {
      fields.push('submitSelector = ?');
      values.push(target.submitSelector);
    }
    if (target.usernameEnvKey !== undefined) {
      fields.push('usernameEnvKey = ?');
      values.push(target.usernameEnvKey);
    }
    if (target.passwordEnvKey !== undefined) {
      fields.push('passwordEnvKey = ?');
      values.push(target.passwordEnvKey);
    }

    // Update target table
    if (fields.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    // Update URLs if provided
    if (target.urls !== undefined) {
      // Delete existing URLs
      const deleteStmt = this.db.prepare('DELETE FROM target_urls WHERE targetId = ?');
      deleteStmt.run(id);

      // Add new URLs
      if (target.urls.length > 0) {
        const urlStmt = this.db.prepare(`
          INSERT INTO target_urls (targetId, name, url)
          VALUES (?, ?, ?)
        `);

        for (const url of target.urls) {
          urlStmt.run(id, url.name, url.url);
        }
      }
    }

    return this.getTarget(id);
  }

  deleteTarget(id: number): boolean {
    // Delete URLs first (though CASCADE should handle this)
    const deleteUrlsStmt = this.db.prepare('DELETE FROM target_urls WHERE targetId = ?');
    deleteUrlsStmt.run(id);
    
    // Delete target
    const stmt = this.db.prepare('DELETE FROM targets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  close() {
    this.db.close();
  }
}

let dbInstance: DatabaseManager;

export function getDb(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}