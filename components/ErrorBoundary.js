import React from 'react';
import { AiOutlineWarning, AiOutlineReload } from 'react-icons/ai';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
    
    // Set up global error handlers in constructor
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // Direct window error event handler
      window.addEventListener('error', this.handleWindowError, true);
      
      // Direct unhandled rejection handler
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection, true);
    }
  }

  static getDerivedStateFromError(error) {
    // Skip certain errors that should be handled locally
    if (
      error?.message?.includes('verification code') ||
      error?.message?.includes('Invalid verification code')
    ) {
      // Don't update state for these errors
      return null;
    }
    
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Skip logging for certain errors
    if (
      error?.message?.includes('verification code') ||
      error?.message?.includes('Invalid verification code')
    ) {
      return;
    }
    
    // Log error information
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  // Handler for window error events
  handleWindowError = (event) => {
    if (
      event.error && 
      event.error.message && 
      (event.error.message.includes('verification code') || 
       event.error.message.includes('Invalid verification code'))
    ) {
      // Prevent the error from propagating
      event.preventDefault();
      event.stopPropagation();
      console.debug('Window error suppressed:', event.error.message);
      return false;
    }
  }
  
  // Handler for unhandled promise rejections
  handleUnhandledRejection = (event) => {
    if (
      event.reason && 
      event.reason.message && 
      (event.reason.message.includes('verification code') || 
       event.reason.message.includes('Invalid verification code'))
    ) {
      // Prevent the rejection from propagating
      event.preventDefault();
      event.stopPropagation();
      console.debug('Unhandled rejection suppressed:', event.reason.message);
      return false;
    }
  }

  componentWillUnmount() {
    // Clean up event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.handleWindowError, true);
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection, true);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '50px auto',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ color: '#ff5252', fontSize: '48px', marginBottom: '20px' }}>
            <AiOutlineWarning />
          </div>
          <h1 style={{ color: '#fff', fontSize: '24px', marginBottom: '10px' }}>Something went wrong</h1>
          <p style={{ color: '#ccc', marginBottom: '20px' }}>
            We encountered an error while processing your request.
          </p>
          {this.state.error && (
            <div style={{
              backgroundColor: 'rgba(255, 82, 82, 0.1)',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '20px',
              textAlign: 'left',
              fontFamily: 'monospace',
              color: '#ff7070',
              fontSize: '14px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {this.state.error.toString()}
            </div>
          )}
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#4D4DA5',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginRight: '10px'
              }}
            >
              <AiOutlineReload /> Refresh Page
            </button>
            <button 
              onClick={() => {
                this.resetErrorBoundary();
                window.history.back();
              }}
              style={{
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
