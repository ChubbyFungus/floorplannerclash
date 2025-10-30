/**
 * Error Boundary System - Main Export
 * Comprehensive error handling system for React applications
 */

export { default as ErrorBoundary } from './ErrorBoundary';
export { default as ErrorBoundaryFallback } from './ErrorBoundaryFallback';

export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorBoundaryFallbackProps,
  BaseError,
  NetworkError,
  AppError,
  AuthError,
  ValidationError,
  SystemError,
  ApplicationError,
  ErrorHandlingResult,
  ErrorReportingConfig,
  ErrorStats,
  ErrorHistoryEntry,
  ErrorFilterOptions,
  GlobalErrorHandler,
} from '../../types/errors';

export {
  // Error utilities
  generateErrorId,
  createNetworkError,
  createAppError,
  createAuthError,
  createValidationError,
  createSystemError,
  shouldRetry,
  getUserFriendlyMessage,
  getNetworkErrorMessage,
  getAuthErrorMessage,
  getValidationErrorMessage,
  getSystemErrorMessage,
  handleError,
  normalizeError,
  logError,
  createErrorHistoryEntry,
  filterErrorHistory,
  calculateErrorStats,
  debounce,
  throttle,
  
  // Error messages
  ERROR_MESSAGES,
} from '../../utils/errorUtils';

/**
 * Quick start example:
 * 
 * ```tsx
 * import { ErrorBoundary } from '@/components/ErrorBoundary';
 * 
 * function App() {
 *   return (
 *     <ErrorBoundary
 *       maxRetries={3}
 *       enableRetry={true}
 *       enableLogging={true}
 *       onError={(error, errorInfo) => {
 *         // Custom error handling
 *         console.error('Error caught by boundary:', error);
 *       }}
 *       onRetry={(retryCount) => {
 *         console.log(`Retrying... Attempt ${retryCount}`);
 *       }}
 *     >
 *       <YourComponent />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */