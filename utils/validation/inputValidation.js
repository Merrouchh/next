/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
}

/**
 * Validate email format
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate username format
 */
export function validateUsername(username) {
  if (typeof username !== 'string') return false;
  
  // Allow alphanumeric, underscore, dash, 3-20 characters
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Validate integer within range
 */
export function validateInteger(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value, 10);
  return Number.isInteger(num) && num >= min && num <= max;
}

/**
 * Validate gizmo ID
 */
export function validateGizmoId(gizmoId) {
  return validateInteger(gizmoId, 1, 999999);
}

/**
 * Validate time seconds for game time API
 */
export function validateGameTimeSeconds(seconds) {
  // Allow 1 second to 60 seconds (max 1 minute for rewards)
  return validateInteger(seconds, 1, 60);
}

/**
 * Validate price (must be 0 for free rewards)
 */
export function validatePrice(price) {
  return validateInteger(price, 0, 0); // Only allow 0
}

/**
 * Sanitize and validate request body
 */
export function validateRequestBody(body, schema) {
  const errors = [];
  const sanitized = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // Skip validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Type validation and sanitization
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
          break;
        }
        
        const sanitizedString = sanitizeString(value);
        
        if (rules.minLength && sanitizedString.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
          break;
        }
        
        if (rules.maxLength && sanitizedString.length > rules.maxLength) {
          errors.push(`${field} must be no more than ${rules.maxLength} characters`);
          break;
        }
        
        if (rules.pattern && !rules.pattern.test(sanitizedString)) {
          errors.push(`${field} format is invalid`);
          break;
        }
        
        sanitized[field] = sanitizedString;
        break;
        
      case 'integer':
        if (!validateInteger(value, rules.min, rules.max)) {
          errors.push(`${field} must be an integer between ${rules.min || 'any'} and ${rules.max || 'any'}`);
          break;
        }
        
        sanitized[field] = parseInt(value, 10);
        break;
        
      case 'email':
        if (!validateEmail(value)) {
          errors.push(`${field} must be a valid email address`);
          break;
        }
        
        sanitized[field] = value.toLowerCase().trim();
        break;
        
      default:
        sanitized[field] = value;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Common validation schemas
 */
export const VALIDATION_SCHEMAS = {
  gameTimeRequest: {
    gizmoId: { type: 'integer', required: true, min: 1, max: 999999 },
    seconds: { type: 'integer', required: true, min: 1, max: 60 },
    price: { type: 'integer', required: true, min: 0, max: 0 }
  },
  
  userRegistration: {
    username: { type: 'string', required: true, minLength: 3, maxLength: 20, pattern: /^[a-zA-Z0-9_-]+$/ },
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, minLength: 8, maxLength: 128 }
  },
  
  adminUserLookup: {
    username: { type: 'string', required: true, minLength: 1, maxLength: 50 }
  }
};
