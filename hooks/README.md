// hooks/README.md
# Custom Hooks Architecture

## Overview
Three focused custom hooks replace 15+ useState hooks from the original App.tsx.

## useAppState (267 lines)
**Purpose**: UI state, loading, errors, theme, sidebar

**State**:
- `isLoading`, `loadingProgress`, `loadingMessage`
- `error`, `theme`, `sidebarOpen`

**Actions**:
- `setLoading()`, `setError()`, `clearError()`
- `toggleTheme()`, `toggleSidebar()`
- `initializeApp()`, `resetApp()`

## useFloorplan (576 lines) 
**Purpose**: 3D floorplan operations, object management

**State**:
- `floorplans`, `currentFloorplan`, `selectedObjectId`
- `roomStates`, `clashObjects`, `generatedCount`

**Actions**:
- `loadFloorplan()`, `saveFloorplan()`, `createNewFloorPlan()`
- `addRoom()`, `updateRoom()`, `deleteRoom()`
- `detectClashes()`, `resolveClash()`

## useConversation (600 lines)
**Purpose**: LLM interactions, chat flow

**State**:
- `messages`, `isTyping`, `isGenerating`
- `pendingActions`, `context`

**Actions**:
- `sendMessage()`, `executeAction()`
- `clearConversation()`, `endConversation()`
- `updateContext()`

## Benefits
✅ **Separation of Concerns** - Each hook handles one domain
✅ **Reusability** - Hooks can be used across components
✅ **Testability** - Easy to test in isolation
✅ **Type Safety** - Full TypeScript support
✅ **Performance** - Optimized with useCallback, useMemo

## Usage Pattern
```typescript
import { useAppState, useFloorplan, useConversation } from './hooks';

function Component() {
  const { state: uiState, actions: uiActions } = useAppState();
  const { state: floorplanState, actions: floorplanActions } = useFloorplan();
  const { state: conversationState, actions: conversationActions } = useConversation();
  
  // Use state and actions
  const handleAction = () => {
    uiActions.setLoading(true);
    floorplanActions.loadFloorplan('123');
  };
}
```

## Migration from useState
Replace multiple useState calls with single custom hook:

```typescript
// BEFORE (15+ useState hooks)
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [floorplans, setFloorplans] = useState([]);
const [selectedObject, setSelectedObject] = useState(null);
// ... 11 more useState calls

// AFTER (3 custom hooks)  
const { state, actions } = useAppState();
const { state, actions } = useFloorplan();
const { state, actions } = useConversation();
```
