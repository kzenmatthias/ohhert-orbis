import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

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

// Database error types
export class DatabaseError extends Error {
  public readonly code?: string;
  public readonly originalError?: Error;

  constructor(message: string, code?: string, originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.originalError = originalError;
  }
}

// Database configuration
interface DatabaseConfig {
  maxRetries: number;
  retryDelay: number;
  backupOnError: boolean;
  enableWAL: boolean;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backupOnError: true,
  enableWAL: true,
};

class DatabaseManager {
  private db!: Database.Database;
  private config: DatabaseConfig;
  private dbPath: string;
  private backupPath: string;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    const dataDir = path.join(process.cwd(), 'data');
    this.dbPath = path.join(dataDir, 'screenshots.db');
    this.backupPath = path.join(dataDir, 'screenshots.db.backup');
    
    // Ensure data directory exists
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', { dataDir }, error as Error);
      throw new DatabaseError('Failed to create data directory', 'DIRECTORY_ERROR', error as Error);
    }
    
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    try {
      this.db = new Database(this.dbPath);
      
      // Configure database for better performance and reliability
      if (this.config.enableWAL) {
        this.db.pragma('journal_mode = WAL');
      }
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
      
      // Note: better-sqlite3 doesn't have event emitters like other database drivers
      // Error handling is done through try-catch blocks in operations

      this.init();
      logger.info('Database initialized successfully', { dbPath: this.dbPath });
    } catch (error) {
      logger.error('Failed to initialize database', { dbPath: this.dbPath }, error as Error);
      throw new DatabaseError('Failed to initialize database', 'INIT_ERROR', error as Error);
    }
  }

  // Transaction wrapper with retry logic
  private withTransaction<T>(operation: () => T, context?: string): T {
    return this.withRetry(() => {
      const transaction = this.db.transaction(() => {
        try {
          return operation();
        } catch (error) {
          logger.error('Transaction operation failed', { context }, error as Error);
          throw error;
        }
      });
      
      try {
        return transaction();
      } catch (error) {
        logger.error('Transaction execution failed', { context }, error as Error);
        throw new DatabaseError(
          `Transaction failed: ${context || 'unknown operation'}`,
          'TRANSACTION_ERROR',
          error as Error
        );
      }
    }, context);
  }

  // Retry wrapper for database operations
  private withRetry<T>(operation: () => T, context?: string): T {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return operation();
      } catch (error) {
        lastError = error as Error;
        
        logger.warn('Database operation failed, retrying', {
          context,
          attempt,
          maxRetries: this.config.maxRetries,
          error: lastError.message
        });

        if (attempt === this.config.maxRetries) {
          break;
        }

        // Wait before retrying with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        this.sleep(delay);
      }
    }

    logger.error('Database operation failed after all retries', {
      context,
      maxRetries: this.config.maxRetries
    }, lastError!);

    throw new DatabaseError(
      `Database operation failed after ${this.config.maxRetries} attempts: ${context || 'unknown operation'}`,
      'RETRY_EXHAUSTED',
      lastError
    );
  }

  private sleep(ms: number): void {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait for small delays
    }
  }

  // Database backup functionality
  async createBackup(): Promise<void> {
    try {
      logger.info('Creating database backup', { 
        source: this.dbPath, 
        backup: this.backupPath 
      });

      // Close current connection temporarily
      const wasOpen = this.db.open;
      if (wasOpen) {
        this.db.close();
      }

      // Copy database file
      fs.copyFileSync(this.dbPath, this.backupPath);

      // Reopen connection
      if (wasOpen) {
        this.db = new Database(this.dbPath);
        if (this.config.enableWAL) {
          this.db.pragma('journal_mode = WAL');
        }
      }

      logger.info('Database backup created successfully', { backupPath: this.backupPath });
    } catch (error) {
      logger.error('Failed to create database backup', {
        source: this.dbPath,
        backup: this.backupPath
      }, error as Error);
      throw new DatabaseError('Failed to create database backup', 'BACKUP_ERROR', error as Error);
    }
  }

  // Database restore functionality
  async restoreFromBackup(): Promise<void> {
    try {
      if (!fs.existsSync(this.backupPath)) {
        throw new DatabaseError('Backup file does not exist', 'BACKUP_NOT_FOUND');
      }

      logger.info('Restoring database from backup', {
        backup: this.backupPath,
        target: this.dbPath
      });

      // Close current connection
      this.db.close();

      // Restore from backup
      fs.copyFileSync(this.backupPath, this.dbPath);

      // Reinitialize database
      this.initializeDatabase();

      logger.info('Database restored from backup successfully');
    } catch (error) {
      logger.error('Failed to restore database from backup', {
        backup: this.backupPath,
        target: this.dbPath
      }, error as Error);
      throw new DatabaseError('Failed to restore database from backup', 'RESTORE_ERROR', error as Error);
    }
  }

  // Database health check
  checkHealth(): { healthy: boolean; error?: string } {
    try {
      // Simple query to test database connectivity
      const result = this.db.prepare('SELECT 1 as test').get() as { test: number };
      
      if (result?.test === 1) {
        return { healthy: true };
      } else {
        return { healthy: false, error: 'Unexpected query result' };
      }
    } catch (error) {
      logger.error('Database health check failed', {}, error as Error);
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Data validation before operations
  private validateTargetData(target: Partial<ScreenshotTarget>): void {
    if (target.name !== undefined) {
      if (typeof target.name !== 'string' || target.name.trim().length === 0) {
        throw new DatabaseError('Target name must be a non-empty string', 'VALIDATION_ERROR');
      }
      if (target.name.length > 255) {
        throw new DatabaseError('Target name must be less than 255 characters', 'VALIDATION_ERROR');
      }
    }

    if (target.loginUrl !== undefined && target.loginUrl !== null) {
      if (typeof target.loginUrl !== 'string') {
        throw new DatabaseError('Login URL must be a string', 'VALIDATION_ERROR');
      }
      try {
        new URL(target.loginUrl);
      } catch {
        throw new DatabaseError('Login URL must be a valid URL', 'VALIDATION_ERROR');
      }
    }

    if (target.urls !== undefined) {
      if (!Array.isArray(target.urls)) {
        throw new DatabaseError('URLs must be an array', 'VALIDATION_ERROR');
      }
      
      for (const url of target.urls) {
        if (!url.name || typeof url.name !== 'string' || url.name.trim().length === 0) {
          throw new DatabaseError('Each URL must have a non-empty name', 'VALIDATION_ERROR');
        }
        if (!url.url || typeof url.url !== 'string') {
          throw new DatabaseError('Each URL must have a valid url field', 'VALIDATION_ERROR');
        }
        try {
          new URL(url.url);
        } catch {
          throw new DatabaseError(`URL "${url.url}" is not valid`, 'VALIDATION_ERROR');
        }
      }
    }
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
    return this.withRetry(() => {
      logger.databaseOperation('getAllTargets', 'targets');
      
      const stmt = this.db.prepare('SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, createdAt, updatedAt FROM targets ORDER BY name');
      const targets = stmt.all() as ScreenshotTarget[];
      
      // Get URLs for each target
      const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
      return targets.map(target => ({
        ...target,
        urls: urlStmt.all(target.id) as ScreenshotUrl[]
      }));
    }, 'getAllTargets');
  }

  getTarget(id: number): ScreenshotTarget | undefined {
    return this.withRetry(() => {
      logger.databaseOperation('getTarget', 'targets', { targetId: id.toString() });
      
      if (!Number.isInteger(id) || id <= 0) {
        throw new DatabaseError('Target ID must be a positive integer', 'VALIDATION_ERROR');
      }
      
      const stmt = this.db.prepare('SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, createdAt, updatedAt FROM targets WHERE id = ?');
      const target = stmt.get(id) as ScreenshotTarget | undefined;
      
      if (target) {
        const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
        target.urls = urlStmt.all(target.id) as ScreenshotUrl[];
      }
      
      return target;
    }, `getTarget(${id})`);
  }

  createTarget(target: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>): ScreenshotTarget {
    // Validate input data
    this.validateTargetData(target);
    
    return this.withTransaction(() => {
      logger.databaseOperation('createTarget', 'targets', { targetName: target.name });
      
      // Check for duplicate names
      const existingStmt = this.db.prepare('SELECT id FROM targets WHERE name = ?');
      const existing = existingStmt.get(target.name);
      if (existing) {
        throw new DatabaseError(`Target with name "${target.name}" already exists`, 'DUPLICATE_NAME');
      }
      
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

      const createdTarget = this.getTarget(targetId);
      if (!createdTarget) {
        throw new DatabaseError('Failed to retrieve created target', 'CREATION_ERROR');
      }
      
      return createdTarget;
    }, `createTarget(${target.name})`);
  }

  updateTarget(id: number, target: Partial<ScreenshotTarget>): ScreenshotTarget | undefined {
    // Validate input data
    if (!Number.isInteger(id) || id <= 0) {
      throw new DatabaseError('Target ID must be a positive integer', 'VALIDATION_ERROR');
    }
    this.validateTargetData(target);
    
    return this.withTransaction(() => {
      logger.databaseOperation('updateTarget', 'targets', { 
        targetId: id.toString(),
        targetName: target.name 
      });
      
      // Check if target exists
      const existingTarget = this.getTarget(id);
      if (!existingTarget) {
        return undefined;
      }
      
      // Check for duplicate names (excluding current target)
      if (target.name !== undefined && target.name !== existingTarget.name) {
        const duplicateStmt = this.db.prepare('SELECT id FROM targets WHERE name = ? AND id != ?');
        const duplicate = duplicateStmt.get(target.name, id);
        if (duplicate) {
          throw new DatabaseError(`Target with name "${target.name}" already exists`, 'DUPLICATE_NAME');
        }
      }
      
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
        fields.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);
        const stmt = this.db.prepare(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`);
        const result = stmt.run(...values);
        
        if (result.changes === 0) {
          throw new DatabaseError('No target was updated', 'UPDATE_ERROR');
        }
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
    }, `updateTarget(${id})`);
  }

  deleteTarget(id: number): boolean {
    if (!Number.isInteger(id) || id <= 0) {
      throw new DatabaseError('Target ID must be a positive integer', 'VALIDATION_ERROR');
    }
    
    return this.withTransaction(() => {
      logger.databaseOperation('deleteTarget', 'targets', { targetId: id.toString() });
      
      // Check if target exists
      const existingTarget = this.getTarget(id);
      if (!existingTarget) {
        return false;
      }
      
      // Delete URLs first (though CASCADE should handle this)
      const deleteUrlsStmt = this.db.prepare('DELETE FROM target_urls WHERE targetId = ?');
      const urlResult = deleteUrlsStmt.run(id);
      
      logger.debug('Deleted target URLs', { 
        targetId: id.toString(),
        deletedUrls: urlResult.changes 
      });
      
      // Delete target
      const stmt = this.db.prepare('DELETE FROM targets WHERE id = ?');
      const result = stmt.run(id);
      
      const success = result.changes > 0;
      if (!success) {
        throw new DatabaseError('Failed to delete target', 'DELETE_ERROR');
      }
      
      return success;
    }, `deleteTarget(${id})`);
  }

  close(): void {
    try {
      if (this.db) {
        logger.info('Closing database connection', { dbPath: this.dbPath });
        this.db.close();
        logger.info('Database connection closed successfully');
      }
    } catch (error) {
      logger.error('Error closing database connection', {}, error as Error);
      throw new DatabaseError('Failed to close database connection', 'CLOSE_ERROR', error as Error);
    }
  }

  // Get database statistics
  getStats(): { 
    totalTargets: number; 
    totalUrls: number; 
    dbSize: number;
    lastBackup?: string;
  } {
    return this.withRetry(() => {
      const targetCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM targets');
      const urlCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM target_urls');
      
      const targetCount = (targetCountStmt.get() as { count: number }).count;
      const urlCount = (urlCountStmt.get() as { count: number }).count;
      
      let dbSize = 0;
      let lastBackup: string | undefined;
      
      try {
        const stats = fs.statSync(this.dbPath);
        dbSize = stats.size;
      } catch {
        // Ignore file stat errors
      }
      
      try {
        const backupStats = fs.statSync(this.backupPath);
        lastBackup = backupStats.mtime.toISOString();
      } catch {
        // Ignore backup stat errors
      }
      
      return {
        totalTargets: targetCount,
        totalUrls: urlCount,
        dbSize,
        lastBackup,
      };
    }, 'getStats');
  }
}

let dbInstance: DatabaseManager | null = null;

export function getDb(): DatabaseManager {
  if (!dbInstance) {
    try {
      dbInstance = new DatabaseManager();
      logger.info('Database instance created successfully');
    } catch (error) {
      logger.error('Failed to create database instance', {}, error as Error);
      throw error;
    }
  }
  return dbInstance;
}

// Graceful shutdown
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      dbInstance = null;
      logger.info('Database instance closed and cleared');
    } catch (error) {
      logger.error('Error during database shutdown', {}, error as Error);
      throw error;
    }
  }
}

// Database health check endpoint
export function checkDatabaseHealth(): { 
  healthy: boolean; 
  error?: string; 
  stats?: { 
    totalTargets: number; 
    totalUrls: number; 
    dbSize: number;
    lastBackup?: string;
  } 
} {
  try {
    const db = getDb();
    const health = db.checkHealth();
    
    if (health.healthy) {
      const stats = db.getStats();
      return { healthy: true, stats };
    } else {
      return health;
    }
  } catch (error) {
    logger.error('Database health check failed', {}, error as Error);
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// DatabaseError is already exported above