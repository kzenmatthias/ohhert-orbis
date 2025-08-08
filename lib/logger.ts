// Structured logging utility for API operations
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  targetId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLogEntry(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Pretty format for development
      const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
      const errorStr = entry.error ? ` | Error: ${entry.error.message}` : '';
      return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${errorStr}`;
    } else {
      // JSON format for production
      return JSON.stringify(entry);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const formattedEntry = this.formatLogEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedEntry);
        break;
      case LogLevel.INFO:
        console.info(formattedEntry);
        break;
      case LogLevel.WARN:
        console.warn(formattedEntry);
        break;
      case LogLevel.ERROR:
        console.error(formattedEntry);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // API-specific logging methods
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, {
      ...context,
      operation: 'api_request',
    });
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info(`API Response: ${method} ${path} - ${statusCode}`, {
      ...context,
      operation: 'api_response',
      statusCode,
      duration,
    });
  }

  apiError(method: string, path: string, error: Error, context?: LogContext): void {
    this.error(`API Error: ${method} ${path}`, {
      ...context,
      operation: 'api_error',
    }, error);
  }

  databaseOperation(operation: string, table?: string, context?: LogContext): void {
    this.debug(`Database Operation: ${operation}`, {
      ...context,
      operation: 'database',
      table,
    });
  }

  databaseError(operation: string, error: Error, context?: LogContext): void {
    this.error(`Database Error: ${operation}`, {
      ...context,
      operation: 'database_error',
    }, error);
  }

  screenshotOperation(operation: string, targetName?: string, context?: LogContext): void {
    this.info(`Screenshot Operation: ${operation}`, {
      ...context,
      operation: 'screenshot',
      targetName,
    });
  }

  screenshotError(operation: string, error: Error, context?: LogContext): void {
    this.error(`Screenshot Error: ${operation}`, {
      ...context,
      operation: 'screenshot_error',
    }, error);
  }
}

// Export singleton logger instance
export const logger = new Logger();