// hooks/index.ts
// Clean exports for all custom hooks

export { useAppState } from './useAppState';
export { useFloorplan } from './useFloorplan';  
export { useConversation } from './useConversation';

// Hook types for better TypeScript support
export type { AppState, LoadingState, ErrorState } from './useAppState';
export type { FloorPlan, Room, Wall, Door, Window, ClashResult } from './useFloorplan';
export type { ConversationMessage, ConversationAction, ConversationContext } from './useConversation';
