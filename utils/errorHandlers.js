/**
 * Standardized Error Handling Utilities
 * For consistent error handling across event detail components
 */

import { toast } from 'react-hot-toast';

// Standard error types
export const ERROR_TYPES = {
  AUTHENTICATION: 'authentication',
  NETWORK: 'network',
  VALIDATION: 'validation',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
  SERVER: 'server',
  UNKNOWN: 'unknown'
};

// Error classification function
export const classifyError = (error, response = null) => {
  if (!error) return ERROR_TYPES.UNKNOWN;
  
  const message = error.message?.toLowerCase() || '';
  const status = response?.status;
  
  // Authentication errors
  if (message.includes('authentication') || message.includes('access token') || status === 401) {
    return ERROR_TYPES.AUTHENTICATION;
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('forbidden') || status === 403) {
    return ERROR_TYPES.PERMISSION;
  }
  
  // Not found errors
  if (message.includes('not found') || status === 404) {
    return ERROR_TYPES.NOT_FOUND;
  }
  
  // Network/fetch errors
  if (message.includes('fetch') || message.includes('network') || !status) {
    return ERROR_TYPES.NETWORK;
  }
  
  // Server errors
  if (status >= 500) {
    return ERROR_TYPES.SERVER;
  }
  
  // Validation errors
  if (status === 400 || message.includes('validation') || message.includes('invalid')) {
    return ERROR_TYPES.VALIDATION;
  }
  
  return ERROR_TYPES.UNKNOWN;
};

// Get user-friendly error messages
export const getErrorMessage = (errorType, customMessage = null) => {
  if (customMessage) return customMessage;
  
  switch (errorType) {
    case ERROR_TYPES.AUTHENTICATION:
      return 'Authentication required. Please try logging out and back in.';
    case ERROR_TYPES.PERMISSION:
      return 'You do not have permission to perform this action.';
    case ERROR_TYPES.NOT_FOUND:
      return 'The requested resource was not found.';
    case ERROR_TYPES.NETWORK:
      return 'Network error. Please check your connection and try again.';
    case ERROR_TYPES.SERVER:
      return 'Server error. Please try again later.';
    case ERROR_TYPES.VALIDATION:
      return 'Invalid input. Please check your data and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

// Standard error handler with toast notification
export const handleError = (error, options = {}) => {
  const {
    showToast = true,
    customMessage = null,
    response = null,
    context = 'Unknown',
    onError = null
  } = options;
  
  const errorType = classifyError(error, response);
  const message = getErrorMessage(errorType, customMessage);
  
  // Log error for debugging
  console.error(`[Error Handler - ${context}]:`, {
    type: errorType,
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    response: response ? {
      status: response.status,
      statusText: response.statusText
    } : null
  });
  
  // Show toast notification
  if (showToast) {
    toast.error(message, {
      duration: errorType === ERROR_TYPES.AUTHENTICATION ? 5000 : 4000,
      position: 'top-right'
    });
  }
  
  // Call custom error handler if provided
  if (onError) {
    onError(error, errorType, message);
  }
  
  return { errorType, message };
};

// Async operation wrapper with error handling
export const withErrorHandling = async (
  operation, 
  context = 'Operation',
  options = {}
) => {
  try {
    return await operation();
  } catch (error) {
    const { onError, ...otherOptions } = options;
    
    handleError(error, {
      context,
      onError,
      ...otherOptions
    });
    
    // Re-throw if specified
    if (options.rethrow) {
      throw error;
    }
    
    return null;
  }
};

// API call wrapper with standardized error handling
export const apiCall = async (url, options = {}, context = 'API Call') => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use the HTTP error
      }
      
      const error = new Error(errorMessage);
      throw error;
    }
    
    return await response.json();
  } catch (error) {
    handleError(error, { context, response: error.response });
    throw error;
  }
};

const errorHandlers = {
  ERROR_TYPES,
  classifyError,
  getErrorMessage,
  handleError,
  withErrorHandling,
  apiCall
};

export default errorHandlers; 