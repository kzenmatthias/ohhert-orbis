import Database from 'better-sqlite3';
import path from 'path';

export interface ScreenshotTarget {
  id?: number;
  name: string;
  url: string;
  requiresLogin: boolean;
  loginUrl?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  usernameEnvKey?: string;
  passwordEnvKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'screenshots.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
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

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_targets_timestamp 
      AFTER UPDATE ON targets
      BEGIN
        UPDATE targets SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);
  }

  getAllTargets(): ScreenshotTarget[] {
    const stmt = this.db.prepare('SELECT * FROM targets ORDER BY name');
    return stmt.all() as ScreenshotTarget[];
  }

  getTarget(id: number): ScreenshotTarget | undefined {
    const stmt = this.db.prepare('SELECT * FROM targets WHERE id = ?');
    return stmt.get(id) as ScreenshotTarget | undefined;
  }

  createTarget(target: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>): ScreenshotTarget {
    const stmt = this.db.prepare(`
      INSERT INTO targets (name, url, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      target.name,
      target.url,
      target.requiresLogin ? 1 : 0,
      target.loginUrl || null,
      target.usernameSelector || null,
      target.passwordSelector || null,
      target.submitSelector || null,
      target.usernameEnvKey || null,
      target.passwordEnvKey || null
    );

    return this.getTarget(result.lastInsertRowid as number)!;
  }

  updateTarget(id: number, target: Partial<ScreenshotTarget>): ScreenshotTarget | undefined {
    const fields = [];
    const values = [];

    if (target.name !== undefined) {
      fields.push('name = ?');
      values.push(target.name);
    }
    if (target.url !== undefined) {
      fields.push('url = ?');
      values.push(target.url);
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

    if (fields.length === 0) {
      return this.getTarget(id);
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getTarget(id);
  }

  deleteTarget(id: number): boolean {
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