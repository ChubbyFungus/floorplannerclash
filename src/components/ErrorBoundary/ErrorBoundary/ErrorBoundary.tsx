import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorBoundaryFallbackProps,
  ApplicationError,
  AppError,
  ErrorHandlingResult,
} from '../../types/errors';
import {
  handleError,
  logError,
  getUserFriendlyMessage,
  createAppError,
  shouldRetry,
} from '../../utils/errorUtils';

import ErrorBoundaryFallback from './ErrorBoundaryFallback';

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private errorHistory: ApplicationError[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);

    // Initialize state
    const maxRetries = props.maxRetries ?? 3;
    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      maxRetries,
      isRetrying: false,
    };

    // Bind methods
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.handleRedirect = this.handleRedirect.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    const appError = createAppError(
      error.message || 'An unexpected error occurred',
      'BOUNDARY_ERROR',
      'high',
      getUserFriendlyMessage(createAppError(error.message || 'An unexpected error occurred', 'BOUNDARY_ERROR')),
      error.stack
    );

    return {
      hasError: true,
      error: appError,
      errorInfo: undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error details
    this.setState({
      errorInfo,
    });

    // Create application error with component stack
    const appError = createAppError(
      error.message || 'An unexpected error occurred',
      'BOUNDARY_ERROR',
      'high',
      getUserFriendlyMessage(createAppError(error.message || 'An unexpected error occurred', 'BOUNDARY_ERROR')),
      errorInfo.componentStack
    );

    // Add to error history
    this.errorHistory.push(appError);

    // Log error if enabled
    if (this.props.enableLogging !== false) {
      logError(appError);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // Handle error with default or custom logic
    const errorHandlingResult = handleError(appError, this.props.customErrorHandler);

    // Perform error-specific actions
    this.performErrorActions(errorHandlingResult);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Handle retry attempt
   */
  private async handleRetry(): Promise<void> {
    const { retryCount, maxRetries, isRetrying } = this.state;

    // Prevent multiple simultaneous retries
    if (isRetrying || retryCount >= maxRetries) {
      return;
    }

    // Check if error is retryable
    if (this.state.error && !shouldRetry(this.state.error.statusCode)) {
      return;
    }

    // Update state to show retrying
    this.setState({
      isRetrying: true,
    });

    try {
      // Wait a brief moment to show retrying state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reset error state and increment retry count
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
      }));

      // Call custom retry handler if provided
      if (this.props.onRetry) {
        this.props.onRetry(retryCount + 1);
      }

    } catch (retryError) {
      // If retry fails, update state and potentially stop retrying
      const retryErrorApp = createAppError(
        retryError instanceof Error ? retryError.message : 'Retry failed',
        'RETRY_FAILED',
        'medium'
      );

      this.errorHistory.push(retryErrorApp);

      this.setState({
        isRetrying: false,
        error: retryCount + 1 >= maxRetries ? retryErrorApp : this.state.error,
      });

      // Call error handler
      if (this.props.onError) {
        this.props.onError(retryErrorApp, { componentStack: '' });
      }
    }
  }

  /**
   * Handle error boundary reset
   */
  private handleReset(): void {
    // Reset state
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      isRetrying: false,
    });

    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  /**
   * Handle redirect (for authentication errors)
   */
  private handleRedirect(url?: string): void {
    if (url || (this.state.error && this.state.error.type === 'auth')) {
      const redirectUrl = url || '/login';
      window.location.href = redirectUrl;
    }
  }

  /**
   * Handle page reload
   */
  private handleReload(): void {
    window.location.reload();
  }

  /**
   * Perform actions based on error handling result
   */
  private performErrorActions(result: ErrorHandlingResult): void {
    if (!result.action || !this.state.error) {
      return;
    }

    switch (result.action) {
      case 'retry':
        if (this.props.enableRetry !== false) {
          // Auto-retry with exponential backoff for certain errors
          const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
          this.retryTimeoutId = setTimeout(() => {
            this.handleRetry();
          }, delay);
        }
        break;

      case 'redirect':
        if (this.state.error.type === 'auth') {
          this.handleRedirect((this.state.error as any).redirectTo);
        }
        break;

      case 'contact_support':
        // Could integrate with support ticket system
        console.warn('User should contact support');
        break;

      default:
        break;
    }
  }

  /**
   * Render error fallback UI
   */
  private renderErrorFallback(): ReactNode {
    const { fallbackComponent: FallbackComponent } = this.props;
    const { error, errorInfo, retryCount, maxRetries, isRetrying } = this.state;

    if (!error) {
      return null;
    }

    const fallbackProps: ErrorBoundaryFallbackProps = {
      error,
      retry: this.handleRetry,
      reset: this.handleReset,
      errorInfo,
      isRetrying,
      retryCount,
      maxRetries,
    };

    // Use custom fallback component if provided
    if (FallbackComponent) {
      return <FallbackComponent {...fallbackProps} />;
    }

    // Use default fallback component
    return <ErrorBoundaryFallback {...fallbackProps} />;
  }

  /**
   * Get component display name for debugging
   */
  static get displayName(): string {
    return 'ErrorBoundary';
  }

  /**
   * Check if error has been seen before
   */
  private hasErrorBeenSeen(error: ApplicationError): boolean {
    return this.errorHistory.some(seenError => 
      seenError.id === error.id || 
      (seenError.type === error.type && seenError.message === error.message)
    );
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(): string {
    if (!this.state.error) {
      return 'An unexpected error occurred';
    }

    return getUserFriendlyMessage(this.state.error);
  }

  /**
   * Render component tree or error fallback
   */
  render(): ReactNode {
    const { hasError } = this.state;

    if (hasError) {
      return this.renderErrorFallback();
    }

    return this.props.children;
  }
}

// Export the main component
export default ErrorBoundary;

// Export additional helper components and utilities
export { ErrorBoundaryFallback } from './ErrorBoundaryFallback';

// Export types for external use
export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorBoundaryFallbackProps,
};

// Export utility functions for external use
export {
  handleError,
  logError,
  getUserFriendlyMessage,
  createAppError,
} from '../../utils/errorUtils';