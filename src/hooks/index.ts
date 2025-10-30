/**
 * Custom Hooks for FloorPlanClash Application
 * 
 * This directory contains custom React hooks that extract complex logic from the main App component
 * into reusable, well-typed modules. Each hook handles a specific aspect of the application's state
 * and functionality.
 */

export { useAppState, default as useAppStateDefault } from './useAppState';
export type { AppState, LoadingState, ErrorState } from './useAppState';

export { useFloorplan, default as useFloorplanDefault } from './useFloorplan';
export type {
  FloorPlan,
  Room,
  Wall,
  Door,
  Window,
  ClashResult,
  FloorPlan3D,
} from './useFloorplan';

export { useConversation, default as useConversationDefault } from './useConversation';
export type {
  ConversationMessage,
  ConversationAction,
  ConversationContext,
  LLMResponse,
  ConversationState,
} from './useConversation';

/**
 * Hook Composition Example:
 *
 * See the main App.tsx for usage examples of these hooks.
 */

/**
 * Hook Responsibilities:
 * 
 * 1. **useAppState**: Manages global application state including:
 *    - Loading states and progress tracking
 *    - Error handling and display
 *    - Application initialization
 *    - Theme and UI preferences
 *    - View management
 * 
 * 2. **useFloorplan**: Handles floor plan data and 3D interactions:
 *    - Floor plan CRUD operations
 *    - Room, wall, door, and window management
 *    - Clash detection and resolution
 *    - 3D scene management
 *    - View controls (zoom, pan, grid)
 *    - Element selection and editing
 * 
 * 3. **useConversation**: Manages AI chat interactions:
 *    - Message history and context
 *    - LLM API integration
 *    - Conversation flow management
 *    - Action execution
 *    - User mood and stage tracking
 *    - Conversation persistence
 * 
 * Each hook includes:
 * - Comprehensive TypeScript types
 * - Proper error handling
 * - Cleanup on unmount
 * - Computed values and selectors
 * - Memoization for performance
 * - Proper dependency management
 */