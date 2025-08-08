import { createValidationError } from './api-error';

// Validation schema types
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: unknown) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Validation utility class
export class Validator {
  static validateValue(value: unknown, rule: ValidationRule, fieldName: string): string[] {
    const errors: string[] = [];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      return errors; // Don't continue validation if required field is missing
    }

    // Skip further validation if value is not provided and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        errors.push(`${fieldName} must be of type ${rule.type}`);
        return errors; // Don't continue if type is wrong
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push(`${fieldName} must be at least ${rule.minLength} characters long`);
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push(`${fieldName} must be no more than ${rule.maxLength} characters long`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${fieldName} format is invalid`);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${fieldName} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${fieldName} must be no more than ${rule.max}`);
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (typeof customResult === 'string') {
        errors.push(customResult);
      } else if (!customResult) {
        errors.push(`${fieldName} failed custom validation`);
      }
    }

    return errors;
  }

  static validate(data: unknown, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return {
        isValid: false,
        errors: ['Request body must be an object'],
      };
    }

    const dataObj = data as Record<string, unknown>;

    // Validate each field in the schema
    for (const [fieldName, rule] of Object.entries(schema)) {
      const fieldErrors = this.validateValue(dataObj[fieldName], rule, fieldName);
      errors.push(...fieldErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateAndThrow(data: unknown, schema: ValidationSchema): void {
    const result = this.validate(data, schema);
    if (!result.isValid) {
      throw createValidationError(
        'Validation failed',
        result.errors.join('; ')
      );
    }
  }
}

// Common validation schemas
export const targetValidationSchema: ValidationSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 255,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
  },
  requiresLogin: {
    type: 'boolean',
  },
  loginUrl: {
    type: 'string',
    pattern: /^https?:\/\/.+/,
    custom: (value) => {
      if (typeof value === 'string' && value.length > 0) {
        try {
          new URL(value);
          return true;
        } catch {
          return 'loginUrl must be a valid URL';
        }
      }
      return true;
    },
  },
  usernameSelector: {
    type: 'string',
    minLength: 1,
  },
  passwordSelector: {
    type: 'string',
    minLength: 1,
  },
  submitSelector: {
    type: 'string',
    minLength: 1,
  },
  usernameEnvKey: {
    type: 'string',
    minLength: 1,
    pattern: /^[A-Z_][A-Z0-9_]*$/,
  },
  passwordEnvKey: {
    type: 'string',
    minLength: 1,
    pattern: /^[A-Z_][A-Z0-9_]*$/,
  },
  urls: {
    type: 'array',
    custom: (value) => {
      if (!Array.isArray(value)) return false;
      if (value.length === 0) return 'At least one URL is required';
      
      for (const url of value) {
        if (typeof url !== 'object' || url === null) {
          return 'Each URL must be an object';
        }
        
        const urlObj = url as Record<string, unknown>;
        if (!urlObj.name || typeof urlObj.name !== 'string' || urlObj.name.trim().length === 0) {
          return 'Each URL must have a non-empty name';
        }
        
        if (!urlObj.url || typeof urlObj.url !== 'string') {
          return 'Each URL must have a valid url field';
        }
        
        try {
          new URL(urlObj.url);
        } catch {
          return `URL "${urlObj.url}" is not valid`;
        }
      }
      
      return true;
    },
  },
};

export const screenshotRunValidationSchema: ValidationSchema = {
  targetIds: {
    type: 'array',
    custom: (value) => {
      if (!Array.isArray(value)) return false;
      
      for (const id of value) {
        if (typeof id !== 'number' && typeof id !== 'string') {
          return 'All target IDs must be numbers or strings';
        }
        
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (isNaN(numId) || numId <= 0) {
          return 'All target IDs must be positive numbers';
        }
      }
      
      return true;
    },
  },
};

export const cronJobValidationSchema: ValidationSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 255,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
  },
  cronExpression: {
    required: true,
    type: 'string',
    minLength: 9, // Minimum valid cron expression: "* * * * *"
    maxLength: 100,
    custom: (value) => {
      if (typeof value !== 'string') return false;
      
      // Simple cron expression validation - should have 5 parts
      const parts = value.trim().split(/\s+/);
      if (parts.length !== 5) {
        return 'Invalid cron expression format. Use format: "minute hour day month weekday" (e.g., "0 9 * * 1-5" for 9 AM weekdays)';
      }
      
      return true;
    },
  },
  enabled: {
    type: 'boolean',
  },
  cronJobTargets: {
    type: 'array',
    custom: (value) => {
      if (!Array.isArray(value)) return false;
      if (value.length === 0) return 'At least one target must be associated with the cron job';
      
      for (const target of value) {
        if (typeof target !== 'object' || target === null) {
          return 'Each cron job target must be an object';
        }
        
        const targetObj = target as Record<string, unknown>;
        if (!targetObj.targetId || typeof targetObj.targetId !== 'number') {
          return 'Each cron job target must have a valid targetId';
        }
        
        if (targetObj.targetId <= 0) {
          return 'Target IDs must be positive numbers';
        }
      }
      
      return true;
    },
  },
};

// Validation middleware helper
export function validateRequest(schema: ValidationSchema) {
  return (data: unknown): void => {
    Validator.validateAndThrow(data, schema);
  };
}