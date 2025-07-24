/**
 * Simple logger utility that respects environment variables
 * Use this instead of console.log for better control over logging in different environments
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  // Always log errors, even in production (for debugging critical issues)
  error: (...args) => {
    console.error(...args);
  },

  // Only log warnings in development or if explicitly enabled
  warn: (...args) => {
    if (!isProduction || process.env.ENABLE_PROD_WARNINGS === 'true') {
      console.warn(...args);
    }
  },

  // Only log info in development
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Only log debug info in development
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Only log debug info in development
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  // Force log (even in production) - use sparingly for critical information
  force: (...args) => {
    console.log(...args);
  },
};

export default logger; 