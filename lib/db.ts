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
  // URL health tracking
  isHealthy?: boolean;
  lastHealthCheck?: string;
  statusCode?: number;
  responseTime?: number;
  healthError?: string;
  redirectUrl?: string;
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
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  urls?: ScreenshotUrl[];
}

export interface CronJob {
  id?: number;
  name: string;
  cronExpression: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastRun?: string;
  nextRun?: string;
  cronJobTargets?: CronJobTarget[];
}

export interface CronJobTarget {
  id?: number;
  cronJobId: number;
  targetId: number;
  createdAt?: string;
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
    } else if (hasTargets) {
      // Check if we need to add new columns to existing schema
      this.migrateToGroupingSchema();
    }

    // Ensure target_urls table exists with health tracking columns
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS target_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        targetId INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        isHealthy BOOLEAN,
        lastHealthCheck DATETIME,
        statusCode INTEGER,
        responseTime INTEGER,
        healthError TEXT,
        redirectUrl TEXT,
        FOREIGN KEY (targetId) REFERENCES targets (id) ON DELETE CASCADE
      )
    `);

    // Add health tracking columns to existing target_urls table if they don't exist
    this.addUrlHealthColumns();

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_targets_timestamp 
      AFTER UPDATE ON targets
      BEGIN
        UPDATE targets SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    // Ensure cron job tables exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        cronExpression TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastRun DATETIME,
        nextRun DATETIME
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cron_job_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cronJobId INTEGER NOT NULL,
        targetId INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cronJobId, targetId),
        FOREIGN KEY (cronJobId) REFERENCES cron_jobs (id) ON DELETE CASCADE,
        FOREIGN KEY (targetId) REFERENCES targets (id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_cron_jobs_timestamp 
      AFTER UPDATE ON cron_jobs
      BEGIN
        UPDATE cron_jobs SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
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
        category TEXT,
        tags TEXT,
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
        category TEXT,
        tags TEXT,
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

  private migrateToGroupingSchema() {
    // Check if category and tags columns exist
    const columns = this.db.prepare("PRAGMA table_info(targets)").all() as { name: string }[];
    const hasCategory = columns.some((col) => col.name === 'category');
    const hasTags = columns.some((col) => col.name === 'tags');

    if (!hasCategory) {
      this.db.exec(`ALTER TABLE targets ADD COLUMN category TEXT`);
      logger.info('Added category column to targets table');
    }

    if (!hasTags) {
      this.db.exec(`ALTER TABLE targets ADD COLUMN tags TEXT`);
      logger.info('Added tags column to targets table');
    }
  }

  getAllTargets(): ScreenshotTarget[] {
    return this.withRetry(() => {
      logger.databaseOperation('getAllTargets', 'targets');
      
      const stmt = this.db.prepare('SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, category, tags, createdAt, updatedAt FROM targets ORDER BY category, name');
      const targets = stmt.all() as (ScreenshotTarget & { tags: string | null })[];
      
      // Get URLs for each target and parse tags
      const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
      return targets.map(target => ({
        ...target,
        tags: target.tags ? JSON.parse(target.tags) : [],
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
      
      const stmt = this.db.prepare('SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, category, tags, createdAt, updatedAt FROM targets WHERE id = ?');
      const target = stmt.get(id) as (ScreenshotTarget & { tags: string | null }) | undefined;
      
      if (target) {
        const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
        target.urls = urlStmt.all(target.id) as ScreenshotUrl[];
        target.tags = target.tags ? JSON.parse(target.tags) : [];
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
        INSERT INTO targets (name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, category, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        target.name,
        target.requiresLogin ? 1 : 0,
        target.loginUrl || null,
        target.usernameSelector || null,
        target.passwordSelector || null,
        target.submitSelector || null,
        target.usernameEnvKey || null,
        target.passwordEnvKey || null,
        target.category || null,
        target.tags ? JSON.stringify(target.tags) : null
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
      if (target.category !== undefined) {
        fields.push('category = ?');
        values.push(target.category);
      }
      if (target.tags !== undefined) {
        fields.push('tags = ?');
        values.push(target.tags ? JSON.stringify(target.tags) : null);
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

  // Cron Job CRUD Operations
  getAllCronJobs(): CronJob[] {
    return this.withRetry(() => {
      logger.databaseOperation('getAllCronJobs', 'cron_jobs');
      
      const stmt = this.db.prepare(`
        SELECT id, name, cronExpression, enabled, createdAt, updatedAt, lastRun, nextRun 
        FROM cron_jobs 
        ORDER BY name
      `);
      
      const jobs = stmt.all() as CronJob[];
      
      // Get associated targets for each job
      for (const job of jobs) {
        job.cronJobTargets = this.getCronJobTargets(job.id!);
      }
      
      return jobs;
    }, 'getAllCronJobs');
  }

  getCronJob(id: number): CronJob | undefined {
    return this.withRetry(() => {
      logger.databaseOperation('getCronJob', 'cron_jobs', { cronJobId: id.toString() });
      
      const stmt = this.db.prepare(`
        SELECT id, name, cronExpression, enabled, createdAt, updatedAt, lastRun, nextRun 
        FROM cron_jobs 
        WHERE id = ?
      `);
      
      const job = stmt.get(id) as CronJob | undefined;
      if (job) {
        job.cronJobTargets = this.getCronJobTargets(job.id!);
      }
      
      return job;
    }, `getCronJob(${id})`);
  }

  createCronJob(cronJob: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>): CronJob {
    try {
      logger.info('Creating cron job - START', { name: cronJob.name, enabled: cronJob.enabled, expression: cronJob.cronExpression });
      
      // Check if database is available
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      
      logger.info('Database is available, preparing statement');
      
      // Insert cron job
      const stmt = this.db.prepare(`
        INSERT INTO cron_jobs (name, cronExpression, enabled)
        VALUES (?, ?, ?)
      `);
      
      logger.info('Statement prepared, executing...');
      
      const result = stmt.run(cronJob.name, cronJob.cronExpression, cronJob.enabled ? 1 : 0);
      const cronJobId = result.lastInsertRowid as number;
      
      logger.info('Cron job created with ID', { cronJobId });
      
      // Insert associated targets if provided
      if (cronJob.cronJobTargets && cronJob.cronJobTargets.length > 0) {
        logger.info('Adding targets to cron job', { targetCount: cronJob.cronJobTargets.length });
        
        const targetStmt = this.db.prepare(`
          INSERT INTO cron_job_targets (cronJobId, targetId)
          VALUES (?, ?)
        `);
        
        for (const target of cronJob.cronJobTargets) {
          logger.info('Adding target to cron job', { cronJobId, targetId: target.targetId });
          targetStmt.run(cronJobId, target.targetId);
        }
      }
      
      logger.info('Cron job creation completed successfully');
      
      // Return the created cron job (simplified - just return basic data)
      return {
        id: cronJobId,
        name: cronJob.name,
        cronExpression: cronJob.cronExpression,
        enabled: cronJob.enabled,
        cronJobTargets: cronJob.cronJobTargets || []
      };
    } catch (error) {
      logger.error('Failed to create cron job - ERROR DETAILS', { 
        name: cronJob.name, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new DatabaseError('Failed to create cron job', 'CREATE_ERROR', error as Error);
    }
  }

  updateCronJob(id: number, cronJob: Partial<CronJob>): CronJob | undefined {
    return this.withTransaction(() => {
      logger.databaseOperation('updateCronJob', 'cron_jobs', { 
        cronJobId: id.toString(),
        updates: Object.keys(cronJob).join(',')
      });

      // Build update query
      const updateFields: string[] = [];
      const params: any[] = [];
      
      if (cronJob.name !== undefined) {
        updateFields.push('name = ?');
        params.push(cronJob.name);
      }
      if (cronJob.cronExpression !== undefined) {
        updateFields.push('cronExpression = ?');
        params.push(cronJob.cronExpression);
      }
      if (cronJob.enabled !== undefined) {
        updateFields.push('enabled = ?');
        params.push(cronJob.enabled ? 1 : 0);
      }
      if (cronJob.lastRun !== undefined) {
        updateFields.push('lastRun = ?');
        params.push(cronJob.lastRun);
      }
      if (cronJob.nextRun !== undefined) {
        updateFields.push('nextRun = ?');
        params.push(cronJob.nextRun);
      }
      
      if (updateFields.length === 0 && !cronJob.cronJobTargets) {
        return this.getCronJob(id);
      }
      
      // Update cron job if there are field changes
      if (updateFields.length > 0) {
        const sql = `UPDATE cron_jobs SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(id);
        
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...params);
        
        if (result.changes === 0) {
          return undefined;
        }
      }
      
      // Update associated targets if provided
      if (cronJob.cronJobTargets !== undefined) {
        // Delete existing associations
        const deleteStmt = this.db.prepare('DELETE FROM cron_job_targets WHERE cronJobId = ?');
        deleteStmt.run(id);
        
        // Insert new associations
        if (cronJob.cronJobTargets.length > 0) {
          const insertStmt = this.db.prepare(`
            INSERT INTO cron_job_targets (cronJobId, targetId)
            VALUES (?, ?)
          `);
          
          for (const target of cronJob.cronJobTargets) {
            insertStmt.run(id, target.targetId);
          }
        }
      }
      
      return this.getCronJob(id);
    }, `updateCronJob(${id})`);
  }

  deleteCronJob(id: number): boolean {
    return this.withTransaction(() => {
      logger.databaseOperation('deleteCronJob', 'cron_jobs', { cronJobId: id.toString() });
      
      // Delete the cron job (cascade will handle cron_job_targets)
      const stmt = this.db.prepare('DELETE FROM cron_jobs WHERE id = ?');
      const result = stmt.run(id);
      
      return result.changes > 0;
    }, `deleteCronJob(${id})`);
  }

  getCronJobTargets(cronJobId: number): CronJobTarget[] {
    return this.withRetry(() => {
      const stmt = this.db.prepare(`
        SELECT id, cronJobId, targetId, createdAt 
        FROM cron_job_targets 
        WHERE cronJobId = ?
        ORDER BY createdAt
      `);
      
      return stmt.all(cronJobId) as CronJobTarget[];
    }, `getCronJobTargets(${cronJobId})`);
  }

  // URL Health Management
  updateUrlHealth(urlId: number, healthData: {
    isHealthy: boolean;
    statusCode?: number;
    responseTime?: number;
    healthError?: string;
    redirectUrl?: string;
  }): boolean {
    return this.withRetry(() => {
      logger.databaseOperation('updateUrlHealth', 'target_urls', { 
        urlId: urlId.toString(),
        isHealthy: healthData.isHealthy.toString()
      });
      
      const stmt = this.db.prepare(`
        UPDATE target_urls 
        SET 
          isHealthy = ?,
          lastHealthCheck = CURRENT_TIMESTAMP,
          statusCode = ?,
          responseTime = ?,
          healthError = ?,
          redirectUrl = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        healthData.isHealthy,
        healthData.statusCode || null,
        healthData.responseTime || null,
        healthData.healthError || null,
        healthData.redirectUrl || null,
        urlId
      );
      
      return result.changes > 0;
    }, `updateUrlHealth(${urlId})`);
  }

  getUrlsForHealthCheck(limit?: number): ScreenshotUrl[] {
    return this.withRetry(() => {
      logger.databaseOperation('getUrlsForHealthCheck', 'target_urls', { 
        limit: limit?.toString() 
      });
      
      let sql = `
        SELECT id, targetId, name, url, createdAt, 
               isHealthy, lastHealthCheck, statusCode, 
               responseTime, healthError, redirectUrl
        FROM target_urls 
        ORDER BY 
          CASE 
            WHEN lastHealthCheck IS NULL THEN 0 
            ELSE 1 
          END,
          lastHealthCheck ASC
      `;
      
      if (limit) {
        sql += ` LIMIT ?`;
      }
      
      const stmt = this.db.prepare(sql);
      const params = limit ? [limit] : [];
      
      return stmt.all(...params) as ScreenshotUrl[];
    }, 'getUrlsForHealthCheck');
  }

  getUnhealthyUrls(): ScreenshotUrl[] {
    return this.withRetry(() => {
      logger.databaseOperation('getUnhealthyUrls', 'target_urls');
      
      const stmt = this.db.prepare(`
        SELECT id, targetId, name, url, createdAt,
               isHealthy, lastHealthCheck, statusCode,
               responseTime, healthError, redirectUrl
        FROM target_urls 
        WHERE isHealthy = 0
        ORDER BY lastHealthCheck DESC
      `);
      
      return stmt.all() as ScreenshotUrl[];
    }, 'getUnhealthyUrls');
  }

  private addUrlHealthColumns(): void {
    try {
      // Check if health tracking columns exist
      const columns = this.db.pragma('table_info(target_urls)') as any[];
      const existingColumns = columns.map((col: any) => col.name);
      
      const healthColumns = [
        'isHealthy BOOLEAN',
        'lastHealthCheck DATETIME',
        'statusCode INTEGER', 
        'responseTime INTEGER',
        'healthError TEXT',
        'redirectUrl TEXT'
      ];

      healthColumns.forEach(columnDef => {
        const columnName = columnDef.split(' ')[0];
        if (!existingColumns.includes(columnName)) {
          logger.info(`Adding column ${columnName} to target_urls table`);
          this.db.exec(`ALTER TABLE target_urls ADD COLUMN ${columnDef}`);
        }
      });
    } catch (error) {
      logger.warn('Failed to add URL health columns', {}, error as Error);
      // Non-fatal error - continue without health tracking
    }
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

  // Search and filter targets
  searchTargets(query: string, category?: string, tags?: string[]): ScreenshotTarget[] {
    return this.withRetry(() => {
      logger.databaseOperation('searchTargets', 'targets', { query, category, tags: tags?.join(',') });
      
      let sql = 'SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, category, tags, createdAt, updatedAt FROM targets WHERE 1=1';
      const params: any[] = [];
      
      // Add search query filter
      if (query.trim()) {
        sql += ' AND (name LIKE ? OR category LIKE ?)';
        const searchTerm = `%${query.trim()}%`;
        params.push(searchTerm, searchTerm);
      }
      
      // Add category filter
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      
      // Add tags filter
      if (tags && tags.length > 0) {
        const tagConditions = tags.map(() => 'tags LIKE ?').join(' AND ');
        sql += ` AND (${tagConditions})`;
        tags.forEach(tag => params.push(`%"${tag}"%`));
      }
      
      sql += ' ORDER BY category, name';
      
      const stmt = this.db.prepare(sql);
      const targets = stmt.all(...params) as (ScreenshotTarget & { tags: string | null })[];
      
      // Get URLs for each target and parse tags
      const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
      return targets.map(target => ({
        ...target,
        tags: target.tags ? JSON.parse(target.tags) : [],
        urls: urlStmt.all(target.id) as ScreenshotUrl[]
      }));
    }, 'searchTargets');
  }

  // Get all unique categories
  getCategories(): string[] {
    return this.withRetry(() => {
      logger.databaseOperation('getCategories', 'targets');
      
      const stmt = this.db.prepare('SELECT DISTINCT category FROM targets WHERE category IS NOT NULL AND category != "" ORDER BY category');
      const results = stmt.all() as { category: string }[];
      return results.map(r => r.category);
    }, 'getCategories');
  }

  // Get all unique tags
  getTags(): string[] {
    return this.withRetry(() => {
      logger.databaseOperation('getTags', 'targets');
      
      const stmt = this.db.prepare('SELECT tags FROM targets WHERE tags IS NOT NULL AND tags != ""');
      const results = stmt.all() as { tags: string }[];
      
      const allTags = new Set<string>();
      results.forEach(result => {
        try {
          const tags = JSON.parse(result.tags) as string[];
          tags.forEach(tag => allTags.add(tag));
        } catch {
          // Ignore invalid JSON
        }
      });
      
      return Array.from(allTags).sort();
    }, 'getTags');
  }

  // Bulk operations for targets
  bulkUpdateTargets(targetIds: number[], updates: Partial<ScreenshotTarget>): number {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      throw new DatabaseError('Target IDs must be a non-empty array', 'VALIDATION_ERROR');
    }
    
    // Validate all IDs are positive integers
    if (!targetIds.every(id => Number.isInteger(id) && id > 0)) {
      throw new DatabaseError('All target IDs must be positive integers', 'VALIDATION_ERROR');
    }
    
    this.validateTargetData(updates);
    
    return this.withTransaction(() => {
      logger.databaseOperation('bulkUpdateTargets', 'targets', { 
        targetIds: targetIds.join(','),
        updateFields: Object.keys(updates).join(',')
      });
      
      const fields = [];
      const values = [];

      if (updates.category !== undefined) {
        fields.push('category = ?');
        values.push(updates.category);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(updates.tags ? JSON.stringify(updates.tags) : null);
      }
      if (updates.requiresLogin !== undefined) {
        fields.push('requiresLogin = ?');
        values.push(updates.requiresLogin ? 1 : 0);
      }

      if (fields.length === 0) {
        return 0;
      }

      fields.push('updatedAt = CURRENT_TIMESTAMP');
      
      const placeholders = targetIds.map(() => '?').join(',');
      const sql = `UPDATE targets SET ${fields.join(', ')} WHERE id IN (${placeholders})`;
      
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...values, ...targetIds);
      
      return result.changes;
    }, 'bulkUpdateTargets');
  }

  bulkDeleteTargets(targetIds: number[]): number {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      throw new DatabaseError('Target IDs must be a non-empty array', 'VALIDATION_ERROR');
    }
    
    // Validate all IDs are positive integers
    if (!targetIds.every(id => Number.isInteger(id) && id > 0)) {
      throw new DatabaseError('All target IDs must be positive integers', 'VALIDATION_ERROR');
    }
    
    return this.withTransaction(() => {
      logger.databaseOperation('bulkDeleteTargets', 'targets', { 
        targetIds: targetIds.join(',')
      });
      
      // Delete URLs first (though CASCADE should handle this)
      const placeholders = targetIds.map(() => '?').join(',');
      const deleteUrlsStmt = this.db.prepare(`DELETE FROM target_urls WHERE targetId IN (${placeholders})`);
      const urlResult = deleteUrlsStmt.run(...targetIds);
      
      logger.debug('Bulk deleted target URLs', { 
        targetIds: targetIds.join(','),
        deletedUrls: urlResult.changes 
      });
      
      // Delete targets
      const deleteTargetsStmt = this.db.prepare(`DELETE FROM targets WHERE id IN (${placeholders})`);
      const result = deleteTargetsStmt.run(...targetIds);
      
      return result.changes;
    }, 'bulkDeleteTargets');
  }

  // Export targets to JSON
  exportTargets(targetIds?: number[]): ScreenshotTarget[] {
    return this.withRetry(() => {
      logger.databaseOperation('exportTargets', 'targets', { 
        targetIds: targetIds?.join(',') || 'all'
      });
      
      if (targetIds && targetIds.length > 0) {
        // Export specific targets
        const placeholders = targetIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`SELECT id, name, requiresLogin, loginUrl, usernameSelector, passwordSelector, submitSelector, usernameEnvKey, passwordEnvKey, category, tags, createdAt, updatedAt FROM targets WHERE id IN (${placeholders}) ORDER BY category, name`);
        const targets = stmt.all(...targetIds) as (ScreenshotTarget & { tags: string | null })[];
        
        const urlStmt = this.db.prepare('SELECT * FROM target_urls WHERE targetId = ? ORDER BY name');
        return targets.map(target => ({
          ...target,
          tags: target.tags ? JSON.parse(target.tags) : [],
          urls: urlStmt.all(target.id) as ScreenshotUrl[]
        }));
      } else {
        // Export all targets
        return this.getAllTargets();
      }
    }, 'exportTargets');
  }

  // Import targets from JSON
  importTargets(targets: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>[], replaceExisting = false): { imported: number; skipped: number; errors: string[] } {
    if (!Array.isArray(targets)) {
      throw new DatabaseError('Targets must be an array', 'VALIDATION_ERROR');
    }
    
    return this.withTransaction(() => {
      logger.databaseOperation('importTargets', 'targets', { 
        targetCount: targets.length,
        replaceExisting
      });
      
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      for (const target of targets) {
        try {
          this.validateTargetData(target);
          
          // Check if target already exists
          const existingStmt = this.db.prepare('SELECT id FROM targets WHERE name = ?');
          const existing = existingStmt.get(target.name);
          
          if (existing && !replaceExisting) {
            skipped++;
            continue;
          }
          
          if (existing && replaceExisting) {
            // Update existing target
            this.updateTarget(existing.id!, target);
          } else {
            // Create new target
            this.createTarget(target);
          }
          
          imported++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Target "${target.name}": ${errorMessage}`);
        }
      }
      
      return { imported, skipped, errors };
    }, 'importTargets');
  }

  // Get database statistics
  getStats(): { 
    totalTargets: number; 
    totalUrls: number; 
    dbSize: number;
    lastBackup?: string;
    categories: number;
    tags: number;
  } {
    return this.withRetry(() => {
      const targetCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM targets');
      const urlCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM target_urls');
      
      const targetCount = (targetCountStmt.get() as { count: number }).count;
      const urlCount = (urlCountStmt.get() as { count: number }).count;
      
      const categories = this.getCategories().length;
      const tags = this.getTags().length;
      
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
        categories,
        tags,
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