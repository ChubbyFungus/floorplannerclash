/**
 * Improved Type Definitions for Matrix System
 * 
 * This file provides comprehensive TypeScript types for the application,
 * replacing Record<string, unknown> with proper interfaces and adding
 * specific type definitions for better type safety.
 * 
 * Version: 2.0.0
 * Last Updated: October 30, 2025
 */

// ============================================================================
// Core Application Types
// ============================================================================

/**
 * Application state with union types for better type safety
 */
export type AppState = 
  | 'initializing'
  | 'ready'
  | 'loading'
  | 'processing'
  | 'error'
  | 'completed'
  | 'cancelled';

/**
 * Status types for operations
 */
export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'pending';

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * API response status codes
 */
export type HttpStatusCode = 
  | 200 | 201 | 204  // Success
  | 400 | 401 | 403 | 404 | 409 | 422  // Client Error
  | 500 | 502 | 503 | 504;  // Server Error

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Specific error types for better error categorization
 */
export type ErrorType = 
  | 'network.error'
  | 'api.error'
  | 'validation.error'
  | 'timeout.error'
  | 'authentication.error'
  | 'authorization.error'
  | 'notfound.error'
  | 'server.error'
  | 'client.error'
  | 'console.error'
  | 'console.log'
  | 'image.error'
  | 'uncaught.error'
  | 'unhandled.promise'
  | 'supabase.api.error'
  | 'supabase.api.success'
  | 'supabase.api.non200';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Enhanced error interface with comprehensive error information
 */
export interface ErrorInfo {
  type: ErrorType;
  message: string;
  timestamp: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  severity?: ErrorSeverity;
  context?: Record<string, any>;
  element?: ElementInfo;
}

/**
 * Element information for DOM-related errors
 */
export interface ElementInfo {
  tagName: string;
  src?: string;
  id: string;
  className: string;
  attributes?: Record<string, string>;
}

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly statusCode?: HttpStatusCode;

  constructor(
    code: string, 
    message: string, 
    details?: Record<string, any>,
    statusCode?: HttpStatusCode
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

// ============================================================================
// Network and API Types
// ============================================================================

/**
 * API response interface
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: HttpStatusCode;
  metadata?: ResponseMetadata;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  duration?: number;
  timestamp?: string;
  requestId?: string;
  cacheHit?: boolean;
  rateLimitRemaining?: number;
}

/**
 * Network request configuration
 */
export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * HTTP headers interface
 */
export interface HttpHeaders {
  [key: string]: string;
}

/**
 * Form data interface
 */
export interface FormData {
  [key: string]: string | string[];
}

// ============================================================================
// Browser Extension Types
// ============================================================================

/**
 * Truncate configuration for data processing
 */
export interface TruncateConfig {
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectKeys: number;
  maxStackLines: number;
}

/**
 * Supabase API information extracted from URL
 */
export interface SupabaseApiInfo {
  projectId: string;
  apiType: 'rest' | 'functions' | 'auth' | 'storage' | 'unknown';
  apiPath: string;
  query: string;
}

/**
 * Supabase request information
 */
export interface SupabaseRequest {
  requestId: string;
  url: string;
  method: HttpMethod;
  tabId: number;
  timestamp: string;
  startTime: number;
  type: string;
  initiator?: string;
  requestBody?: RequestBody;
  headers?: HttpHeaders;
  responseHeaders?: HttpHeaders;
}

/**
 * Request body format
 */
export interface RequestBody {
  formData?: FormData;
  raw?: Array<{
    bytes: ArrayBuffer;
  }>;
}

/**
 * API log entry for network monitoring
 */
export interface APILogEntry {
  type: 'supabase.api.error' | 'supabase.api.success' | 'supabase.api.non200';
  timestamp: string;
  request: {
    projectId: string;
    apiType: string;
    apiPath: string;
    query: string;
    url: string;
    method: HttpMethod;
    headers: HttpHeaders;
    body: any;
    initiator?: string;
  };
  response: {
    status: HttpStatusCode;
    statusText: string;
    headers: HttpHeaders;
    duration: number;
  };
  success: boolean;
  error?: {
    message: string;
    name: string;
  };
  errorMessage?: string;
}

/**
 * Message types for content script communication
 */
export type ContentMessageType = 'MATRIX_ERROR_LOG' | 'MATRIX_API_SUCCESS_LOG';

export interface ContentMessage {
  type: ContentMessageType;
  data: any;
}

// ============================================================================
// Data Source Types
// ============================================================================

/**
 * Style selection parameters for floor plan generation
 */
export interface StyleSelectionParams {
  dimensions?: {
    width: number;
    height: number;
    scale?: number;
  };
  style?: string;
  preferences?: {
    colorScheme?: string;
    materialQuality?: 'basic' | 'standard' | 'premium';
    complexity?: 'simple' | 'moderate' | 'complex';
  };
  constraints?: string[];
  [key: string]: any; // For extensibility
}

/**
 * Legacy compatibility for existing Record<string, unknown> usage
 */
export type LegacyUnknownRecord = Record<string, unknown>;
export type LegacyAnyArray = Array<any>;

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event types for the application
 */
export type EventType = 
  | 'error'
  | 'warning'
  | 'info'
  | 'success'
  | 'network_request'
  | 'network_response'
  | 'api_call'
  | 'function_call'
  | 'data_processed';

/**
 * Event data interface
 */
export interface EventData {
  type: EventType;
  timestamp: string;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Event listener configuration
 */
export interface EventListenerConfig {
  eventType: EventType;
  handler: (event: EventData) => void;
  once?: boolean;
  filter?: (event: EventData) => boolean;
}

// ============================================================================
// Plugin and Extension Types
// ============================================================================

/**
 * Plugin information
 */
export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  dependencies?: string[];
  enabled: boolean;
}

/**
 * Extension manifest
 */
export interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  manifest_version: number;
  permissions: string[];
  content_scripts?: ContentScript[];
  background?: BackgroundScript;
}

/**
 * Content script configuration
 */
export interface ContentScript {
  matches: string[];
  js: string[];
  runAt: 'document_start' | 'document_end' | 'document_idle';
  allFrames: boolean;
}

/**
 * Background script configuration
 */
export interface BackgroundScript {
  scripts: string[];
  persistent: boolean;
}

// ============================================================================
// Export commonly used type guards
// ============================================================================

/**
 * Type guard for checking if a value is an error
 */
export function isError(value: any): value is ErrorInfo {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    typeof value.message === 'string' &&
    typeof value.timestamp === 'string'
  );
}

/**
 * Type guard for checking if a response is successful
 */
export function isSuccessfulResponse<T>(response: APIResponse<T>): response is APIResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard for checking if an error is a network error
 */
export function isNetworkError(error: ErrorInfo): boolean {
  return error.type.includes('network') || error.type.includes('api');
}

/**
 * Type guard for checking if a string is a valid HTTP method
 */
export function isHttpMethod(value: string): value is HttpMethod {
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(value);
}

/**
 * Type guard for checking if a status code indicates success
 */
export function isSuccessStatusCode(code: number): boolean {
  return code >= 200 && code < 300;
}

// ============================================================================
// Global type declarations for window object extensions
// ============================================================================

declare global {
  interface Window {
    __matrix_errors_initialized__?: boolean;
    __matrix_errors__?: ErrorInfo[];
    __matrix_api_success__?: APILogEntry[];
    __original_console_error__?: (...args: any[]) => void;
    __original_console_log__?: (...args: any[]) => void;
  }
}